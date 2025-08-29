'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
export default function OrderConfirmationPage() {
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundProcessing, setBackgroundProcessing] = useState(false);

  useEffect(() => {
    const fetchOrderData = async () => {
      console.log('🔄 Starting to fetch order data...');
      try {
        // Check URL parameters first (for bank transfer flow)
        const urlParams = new URLSearchParams(window.location.search);
        const urlPaymentMethod = urlParams.get('paymentMethod');
        const urlOrderId = urlParams.get('orderId');
        const storedPaymentMethod = sessionStorage.getItem('paymentMethod');
        const storedOrderId = sessionStorage.getItem('orderId');
        const storedPdfUrl = sessionStorage.getItem('pdfUrl');
        const storedBankProvider = sessionStorage.getItem('bankProvider');
        const storedTotalAmount = sessionStorage.getItem('totalAmount');
        
        console.log('📦 Session storage data:', {
          urlPaymentMethod,
          urlOrderId,
          storedPaymentMethod,
          storedOrderId,
          storedPdfUrl,
          storedBankProvider,
          storedTotalAmount
        });
        
        // Use URL parameters if available, otherwise use session storage
        setPaymentMethod(urlPaymentMethod || storedPaymentMethod);
        setOrderId(urlOrderId || storedOrderId);
        
        // For bank transfers, use the PDF URL from session storage if available
        if ((urlPaymentMethod || storedPaymentMethod) === 'bank_transfer' && storedPdfUrl) {
          setPdfUrl(storedPdfUrl);
        } else {
          setPdfUrl(storedPdfUrl);
        }
        
        // If we have orderId, fetch order details from Firestore for PDF URL
        const currentOrderId = urlOrderId || storedOrderId;
        if (currentOrderId) {
          try {
            // Add cache-busting parameter to ensure fresh data
            const response = await fetch(`/api/get-order-details/${currentOrderId}?t=${Date.now()}`);
            if (response.ok) {
              const orderData = await response.json();
              // Set PDF URL from Firestore if available (check both fileUrl and fileName)
              const firestorePdfUrl = orderData.fileUrl || orderData.fileName;
              console.log('PDF URL debug:', {
                fileUrl: orderData.fileUrl,
                fileName: orderData.fileName,
                firestorePdfUrl,
                paymentStatus: orderData.paymentStatus,
                fullOrderData: orderData
              });
              console.log('File URL checks:', {
                hasFileUrl: !!orderData.fileUrl,
                hasFileName: !!orderData.fileName,
                hasFirestorePdfUrl: !!firestorePdfUrl,
                fileUrlStartsWithHttp: orderData.fileUrl?.startsWith('http'),
                firestorePdfUrlStartsWithHttp: firestorePdfUrl?.startsWith('http')
              });
              // For bank transfer orders, if payment is confirmed, show PDF immediately
              console.log('Bank transfer PDF check:', {
                hasFirestorePdfUrl: !!firestorePdfUrl,
                firestorePdfUrl,
                startsWithHttp: firestorePdfUrl?.startsWith('http')
              });
              if ((urlPaymentMethod || storedPaymentMethod) === 'bank_transfer') {
                // For bank transfer orders, prefer session storage PDF URL, then Firestore
                if (storedPdfUrl) {
                  setPdfUrl(storedPdfUrl);
                  console.log('✅ Using PDF URL from session storage:', storedPdfUrl);
                } else if (firestorePdfUrl && firestorePdfUrl.startsWith('http')) {
                  setPdfUrl(firestorePdfUrl);
                  sessionStorage.setItem('pdfUrl', firestorePdfUrl);
                  console.log('✅ Using PDF URL from Firestore:', firestorePdfUrl);
                } else {
                  console.log('⚠️ No PDF URL available for bank transfer order');
                }
              } else if (firestorePdfUrl && firestorePdfUrl.startsWith('http')) {
                setPdfUrl(firestorePdfUrl);
                sessionStorage.setItem('pdfUrl', firestorePdfUrl);
                console.log('✅ Using PDF URL from Firestore for regular order:', firestorePdfUrl);
              }
            } else {
              console.log('❌ Failed to fetch order details from Firestore:', response.status);
            }
          } catch (error) {
            console.error('❌ Error fetching PDF URL from Firestore:', error);
          }
        }
        
        // Clear session storage after we've processed all the data
        // Keep pdfUrl in session storage to preserve the download button
        sessionStorage.removeItem('paymentMethod');
        sessionStorage.removeItem('orderId');
        // Don't clear bankProvider yet - it might be needed for order processing
        // sessionStorage.removeItem('bankProvider');
        sessionStorage.removeItem('totalAmount');
        
        // Don't clear pdfUrl from session storage - keep it available for the download button
        
        // Check if this is a bank transfer order that needs background processing
        if ((urlPaymentMethod || storedPaymentMethod) === 'bank_transfer') {
          setBackgroundProcessing(true);
          
          // Poll for PDF URL every 3 seconds for up to 3 minutes
          let attempts = 0;
          const maxAttempts = 60; // 3 minutes (60 * 3 seconds)
          
          const pollForPdf = async () => {
            if (attempts >= maxAttempts) {
              setBackgroundProcessing(false);
              console.log('⏰ PDF polling timeout - no PDF found after 3 minutes');
              return;
            }
            
            try {
              console.log(`🔄 Polling for PDF (attempt ${attempts + 1}/${maxAttempts})...`);
              const response = await fetch(`/api/get-order-details/${currentOrderId}?t=${Date.now()}`);
              if (response.ok) {
                const orderData = await response.json();
                console.log('📄 Poll response:', {
                  hasFileUrl: !!orderData.fileUrl,
                  fileUrl: orderData.fileUrl,
                  paymentStatus: orderData.paymentStatus
                });
                
                if (orderData.fileUrl && orderData.fileUrl.startsWith('http')) {
                  setPdfUrl(orderData.fileUrl);
                  sessionStorage.setItem('pdfUrl', orderData.fileUrl);
                  setBackgroundProcessing(false);
                  console.log('✅ PDF found during polling:', orderData.fileUrl);
                  return;
                }
              } else {
                console.log('❌ Poll request failed:', response.status);
              }
            } catch (error) {
              console.error('❌ Error polling for PDF:', error);
            }
            
            attempts++;
            setTimeout(pollForPdf, 3000); // Poll every 3 seconds
          };
          
          // Start polling after a short delay
          setTimeout(pollForPdf, 2000);
        }
      } catch (outerError) {
        // Handle unexpected errors silently
      } finally {
        // Always set loading to false, regardless of success or failure
        setLoading(false);
      }
    };
    fetchOrderData();
    }, []);


 
  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando detalles del pedido...</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Success Message */}
        <div className="text-center mb-6">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-3 ${
            paymentMethod === 'bank_transfer' ? 'bg-yellow-100' : 'bg-green-100'
          }`}>
            {paymentMethod === 'bank_transfer' ? (
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {paymentMethod === 'bank_transfer' ? '¡Pedido Recibido!' : '¡Pedido Confirmado!'}
          </h1>
          <p className="text-gray-600 text-sm">
            {paymentMethod === 'bank_transfer' 
              ? 'Tu pedido ha sido recibido y está pendiente de confirmación de pago'
              : 'Tu pedido ha sido procesado exitosamente'
            }
          </p>
        </div>
        {/* Order Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Detalles del Pedido</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha del Pedido:</span>
              <span className="font-medium text-gray-900">{(() => {
                const now = new Date();
                const day = now.getDate().toString().padStart(2, '0');
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                const year = now.getFullYear();
                const hours = now.getHours();
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'pm' : 'am';
                const displayHours = hours % 12 || 12;
                const formattedHours = displayHours.toString().padStart(2, '0');
                return `${day}.${month}.${year} ${formattedHours}:${minutes} ${ampm}`;
              })()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className={`font-medium ${
                paymentMethod === 'bank_transfer' ? 'text-orange-600' : 'text-green-600'
              }`}>
                {paymentMethod === 'bank_transfer' ? 'Pago Pendiente' : 'Pago Confirmado'}
              </span>
            </div>
          </div>
        </div>
        {/* PDF Download Section */}
        {pdfUrl ? (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Comprobante del Pedido</h2>
                  <p className="text-sm text-gray-600">Tu pedido ha sido confirmado exitosamente</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-100 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-blue-800 font-medium mb-1">✅ Comprobante listo para descargar</p>
                  <p className="text-sm text-blue-700 mb-2">Incluye todos los detalles de tu pedido, información de contacto y estado del pago</p>
                  <div className="flex items-center text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                    <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm font-medium">Tu factura electrónica será enviada junto con tu(s) producto(s)</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-center">
              <a
                href={pdfUrl}
                download="pedido.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-base font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ver y Descargar PDF
              </a>
              <p className="text-xs text-gray-500 mt-2">Haz clic para abrir o descargar el comprobante</p>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-6 mb-6 shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-full flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Comprobante del Pedido</h2>
                  <p className="text-sm text-gray-600">
                    {backgroundProcessing ? 'Procesando en segundo plano...' : 'Se está generando tu comprobante'}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-yellow-100 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-yellow-800 font-medium mb-1">
                    {backgroundProcessing ? '⚡ Procesando en segundo plano' : '⏳ Generando comprobante...'}
                  </p>
                  <p className="text-sm text-yellow-700">
                    {backgroundProcessing 
                      ? 'Tu pedido ha sido confirmado. El PDF y email se están procesando en segundo plano. Revisa tu email en unos momentos.'
                      : 'El PDF estará disponible en unos momentos. También revisa tu email para el comprobante adjunto.'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center text-yellow-600 bg-yellow-100 px-4 py-2 rounded-lg">
                <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium">
                  {backgroundProcessing ? 'Procesando...' : 'Generando...'}
                </span>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-700 transition-all duration-200 transform hover:scale-105"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
              {orderId && (
                <button
                  onClick={async () => {
                    try {
                      // Try to get PDF from Firestore
                      const response = await fetch(`/api/get-order-details/${orderId}`);
                      if (response.ok) {
                        const orderData = await response.json();
                        if (orderData.fileUrl && orderData.fileUrl.startsWith('http')) {
                          setPdfUrl(orderData.fileUrl);
                          sessionStorage.setItem('pdfUrl', orderData.fileUrl);
                          alert('¡PDF encontrado! La página se actualizará automáticamente.');
                        } else {
                          alert(`PDF no disponible en este momento. Datos del pedido: ${JSON.stringify(orderData)}`);
                        }
                      } else {
                        alert('Error al obtener información del pedido.');
                      }
                    } catch (error) {
                      alert('Error al obtener el PDF. Revisa tu email para el comprobante adjunto.');
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-105"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Buscar PDF
                </button>
              )}
            </div>
          </div>
        )}
        {/* Payment Instructions for Bank Transfer */}
        {paymentMethod === 'bank_transfer' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h2 className="text-base font-semibold text-yellow-800 mb-3">⏳ Pago Pendiente</h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-yellow-800 text-sm">Transferencia Pendiente de Verificación</h3>
                  <p className="text-xs text-yellow-700">
                    Has confirmado que realizaste la transferencia bancaria. Estamos verificando la recepción del pago.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-blue-800 text-sm">Próximos Pasos</h3>
                  <p className="text-xs text-blue-700">
                    Recibirás una notificación por email cuando confirmemos la recepción del pago y tu pedido esté listo para procesamiento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Next Steps */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">
            {paymentMethod === 'bank_transfer' ? 'Proceso del Pedido' : 'Próximos Pasos'}
          </h2>
          <div className="space-y-3">
            {paymentMethod === 'bank_transfer' ? (
              <>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Confirmación de Pago</h3>
                    <p className="text-xs text-gray-600">Verificaremos la recepción de tu transferencia bancaria</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Procesamiento</h3>
                    <p className="text-xs text-gray-600">Una vez confirmado el pago, tu pedido será preparado</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Envío</h3>
                    <p className="text-xs text-gray-600">Recibirás actualizaciones sobre el estado de tu envío</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">4</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Entrega</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><strong>En Medellín:</strong> 1-2 días hábiles</p>
                      <p><strong>Otras ciudades:</strong> 3-5 días hábiles (varía según departamento y zona urbana)</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Revisión del Pedido</h3>
                    <p className="text-xs text-gray-600">Verificaremos los detalles de tu pedido</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Confirmación</h3>
                    <p className="text-xs text-gray-600">Te contactaremos para confirmar tu pedido</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Preparación y Envío</h3>
                    <p className="text-xs text-gray-600">Una vez confirmado, prepararemos y enviaremos tu pedido</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-sm font-medium">4</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm">Entrega</h3>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p><strong>En Medellín:</strong> 1-2 días hábiles</p>
                      <p><strong>Otras ciudades:</strong> 3-5 días hábiles (varía según departamento y zona urbana)</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Contact Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
          <h2 className="text-base font-semibold text-gray-900 mb-3">¿Necesitas Ayuda?</h2>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
                              <span className="text-gray-600 text-sm">info@distrinaranjos.com</span>
            </div>
            <div className="flex items-center space-x-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="text-gray-600 text-sm">+57 311 388 7955</span>
            </div>
            <div className="flex items-center space-x-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-gray-600 text-sm">
                <p>Lunes a Viernes: 9:00 AM - 6:00 PM</p>
                <p>Sábados: 9:00 AM - 5:00 PM</p>
              </div>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/"
            className="flex-1 bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors duration-200 text-center"
          >
            Seguir Comprando
          </Link>
          <Link
            href="/contacto"
            className="flex-1 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200 text-center"
          >
            Contactar Soporte
          </Link>
        </div>
        

      </div>
    </div>
  );
} 