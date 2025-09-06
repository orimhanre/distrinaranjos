'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BankDetails {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  accountType: string;
  phoneNumber: string;
  email: string;
}

export default function BankTransferDetailsPage() {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [hasConfirmedTransfer, setHasConfirmedTransfer] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [isLoadingBankDetails, setIsLoadingBankDetails] = useState<boolean>(true);

  // Fetch bank account details from API
  const fetchBankDetails = async () => {
    try {
      const response = await fetch('/api/bank-account-details', {
        cache: 'no-store'
      });
      
      if (response.ok) {
        const details = await response.json();
        setBankDetails(details);
      } else {
        console.error('Failed to fetch bank details');
        // Use fallback values
        setBankDetails({
          accountHolder: 'DISTRI NARANJOS SAS',
          bankName: 'Bancolombia',
          accountNumber: '1234567890',
          accountType: 'Cuenta Corriente',
          phoneNumber: '+57 311 388 7955',
          email: 'info@distrinaranjos.com'
        });
      }
    } catch (error) {
      console.error('Error fetching bank details:', error);
      // Use fallback values
      setBankDetails({
        accountHolder: 'DISTRI NARANJOS SAS',
        bankName: 'Bancolombia',
        accountNumber: '1234567890',
        accountType: 'Cuenta Corriente',
        phoneNumber: '+57 311 388 7955',
        email: 'info@distrinaranjos.com'
      });
    } finally {
      setIsLoadingBankDetails(false);
    }
  };

  useEffect(() => {
    // Get order details from session storage
    const storedOrderId = sessionStorage.getItem('orderId');
    const storedInvoiceNumber = sessionStorage.getItem('invoiceNumber');
    const storedTotal = sessionStorage.getItem('totalAmount');
    const storedProvider = sessionStorage.getItem('bankProvider');
    
    if (storedOrderId) {
      setOrderId(storedOrderId);
    }
    if (storedInvoiceNumber) {
      setInvoiceNumber(storedInvoiceNumber);
    }
    if (storedTotal) {
      setTotalAmount(parseFloat(storedTotal));
    }
    if (storedProvider) {
      setSelectedProvider(storedProvider);
    }

    // Fetch bank details
    fetchBankDetails();
  }, []);

  const [copyNotification, setCopyNotification] = useState<string>('');

  const handleCopyToClipboard = async (text: string, fieldName: string) => {
    try {
      // Check if clipboard API is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyNotification(`${fieldName} copiado al portapapeles`);
        setTimeout(() => setCopyNotification(''), 2000);
      } else {
        // Fallback method for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
          setCopyNotification(`${fieldName} copiado al portapapeles`);
          setTimeout(() => setCopyNotification(''), 2000);
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
          setCopyNotification('Error al copiar al portapapeles');
          setTimeout(() => setCopyNotification(''), 2000);
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
      setCopyNotification('Error al copiar al portapapeles');
      setTimeout(() => setCopyNotification(''), 2000);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!hasConfirmedTransfer) {
      alert('Por favor confirma que has realizado la transferencia bancaria');
      return;
    }

    setIsProcessing(true);

    try {
      // Call API to confirm bank transfer
      const response = await fetch('/api/confirm-bank-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
          invoiceNumber: invoiceNumber,
          bankProvider: selectedProvider,
          totalAmount: totalAmount,
          confirmedAt: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        if (result.success) {
          // Redirect to order confirmation page
          router.push('/order-confirmation?paymentMethod=bank_transfer&orderId=' + orderId);
        } else {
          throw new Error(result.error || 'Error al confirmar la transferencia');
        }
      } else {
        throw new Error('Error al confirmar la transferencia');
      }
    } catch (error) {
      console.error('Error confirming transfer:', error);
      alert('Error al confirmar la transferencia. Por favor intenta de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const details = bankDetails;

  if (isLoadingBankDetails) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Cargando datos bancarios...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
            <p className="text-gray-600">No se encontraron los detalles bancarios. Por favor regresa al checkout.</p>
            <button
              onClick={() => router.push('/checkout')}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Volver al Checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pt-10">
      <style jsx>{`
        .no-underline {
          text-decoration: none !important;
          -webkit-text-decoration-line: none !important;
          text-decoration-line: none !important;
        }
        .no-underline:hover {
          text-decoration: none !important;
          -webkit-text-decoration-line: none !important;
          text-decoration-line: none !important;
        }
        .no-underline:focus {
          text-decoration: none !important;
          -webkit-text-decoration-line: none !important;
          text-decoration-line: none !important;
        }
        .no-underline:active {
          text-decoration: none !important;
          -webkit-text-decoration-line: none !important;
          text-decoration-line: none !important;
        }
        .select-text {
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
          user-select: text !important;
        }
      `}</style>
      {/* Copy Notification */}
      {copyNotification && (
        <div className="fixed top-32 left-4 right-4 sm:top-4 sm:left-auto sm:right-4 z-50 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg text-center font-medium animate-bounce">
          {copyNotification}
        </div>
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-4 sm:mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-4">
            <span className="text-xl sm:text-2xl">🏦</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Datos Bancarios</h1>
          <p className="text-sm sm:text-lg text-gray-600 mb-2 sm:mb-4">Realiza la transferencia con los siguientes datos</p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-4 inline-block">
            <p className="text-xs sm:text-sm text-green-700 mb-1">Total a transferir</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(totalAmount)}</p>
          </div>
        </div>



        {/* Bank Details */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-3 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center mb-3 sm:mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3 sm:mr-4">
              <span className="text-lg sm:text-xl">🏦</span>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Datos de la Cuenta</h2>
              <p className="text-xs sm:text-sm text-gray-600">Copia y pega estos datos en tu aplicación bancaria</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
            {/* Account Holder */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Titular de la Cuenta</label>
                <button
                  onClick={() => handleCopyToClipboard(details.accountHolder, 'Titular')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.accountHolder, 'Titular')}
                style={{ textDecoration: 'none' }}
              >
                {details.accountHolder}
              </div>
            </div>

            {/* Bank Name */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Banco</label>
                <button
                  onClick={() => handleCopyToClipboard(details.bankName, 'Banco')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.bankName, 'Banco')}
                style={{ textDecoration: 'none' }}
              >
                {details.bankName}
              </div>
            </div>

            {/* Account Number */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Número de Cuenta</label>
                <button
                  onClick={() => handleCopyToClipboard(details.accountNumber, 'Número de cuenta')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.accountNumber, 'Número de cuenta')}
                style={{ textDecoration: 'none', WebkitTextDecorationLine: 'none', textDecorationLine: 'none' }}
              >
                {details.accountNumber}
              </div>
            </div>

            {/* Account Type */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Tipo de Cuenta</label>
                <button
                  onClick={() => handleCopyToClipboard(details.accountType, 'Tipo de cuenta')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.accountType, 'Tipo de cuenta')}
                style={{ textDecoration: 'none' }}
              >
                {details.accountType}
              </div>
            </div>

            {/* Phone Number */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Teléfono</label>
                <button
                  onClick={() => handleCopyToClipboard(details.phoneNumber, 'Teléfono')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.phoneNumber, 'Teléfono')}
                style={{ textDecoration: 'none', WebkitTextDecorationLine: 'none', textDecorationLine: 'none' }}
              >
                {details.phoneNumber}
              </div>
            </div>

            {/* Email */}
            <div className="bg-gray-50 rounded-lg p-2 sm:p-4">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">Email</label>
                <button
                  onClick={() => handleCopyToClipboard(details.email, 'Email')}
                  className="text-blue-600 hover:text-blue-700 text-xs sm:text-sm select-none"
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                >
                  📋
                </button>
              </div>
              <div 
                className="bg-white border border-gray-200 rounded px-2 sm:px-3 py-1.5 sm:py-2 font-mono text-xs sm:text-sm text-black cursor-pointer hover:bg-gray-50 transition-colors no-underline select-text"
                onClick={() => handleCopyToClipboard(details.email, 'Email')}
                style={{ textDecoration: 'none', WebkitTextDecorationLine: 'none', textDecorationLine: 'none' }}
              >
                {details.email}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-2 sm:ml-3">
              <h3 className="text-xs sm:text-sm font-medium text-blue-900 mb-1 sm:mb-2">Instrucciones para la Transferencia</h3>
              <div className="text-xs sm:text-sm text-blue-800 space-y-1 sm:space-y-2">
                <p>1. <strong>Copia los datos bancarios</strong> haciendo clic en "Copiar" junto a cada campo</p>
                <p>2. <strong>Abre tu aplicación bancaria</strong> (Bancolombia, Nequi, A la Mano, etc.)</p>
                <p>3. <strong>Realiza la transferencia</strong> por el monto exacto: {formatCurrency(totalAmount)}</p>
                <p>4. <strong>Guarda el comprobante</strong> de la transferencia</p>
                <p>5. <strong>Regresa aquí y confirma</strong> que realizaste el pago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Checkbox */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl shadow-lg p-3 sm:p-6 mb-6 sm:mb-8 hover:shadow-xl transition-all duration-300">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <input
                type="checkbox"
                id="confirmTransfer"
                checked={hasConfirmedTransfer}
                onChange={(e) => setHasConfirmedTransfer(e.target.checked)}
                className="h-6 w-6 text-green-600 focus:ring-green-500 border-2 border-green-300 rounded-lg transition-all duration-200"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <label htmlFor="confirmTransfer" className="text-lg font-bold text-green-800 cursor-pointer hover:text-green-900 transition-colors duration-200">
                  ✅ Confirmo que he realizado la transferencia bancaria
                </label>
              </div>
              <div className="bg-white rounded-lg p-4 border border-green-200">
                <p className="text-sm text-gray-700 mb-2">
                  <span className="font-semibold text-green-700">Importante:</span> Al marcar esta casilla, confirmas que:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">•</span>
                    Has completado la transferencia por el monto exacto de <span className="font-semibold text-green-700">{formatCurrency(totalAmount)}</span>
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">•</span>
                    Recibirás una notificación por email cuando confirmemos el pago
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">•</span>
                    Tu pedido será procesado una vez verifiquemos la transferencia
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => router.push('/bank-transfer-selection')}
            className="px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
          >
            Volver
          </button>
          <button
            onClick={handleConfirmTransfer}
            disabled={!hasConfirmedTransfer || isProcessing}
            className={`px-8 py-3 font-semibold rounded-xl transition-all duration-200 ${
              hasConfirmedTransfer && !isProcessing
                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Confirmando...
              </>
            ) : (
              'Confirmar Transferencia'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
