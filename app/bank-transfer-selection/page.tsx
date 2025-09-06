'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BankProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

const bankProviders: BankProvider[] = [
  {
    id: 'bancolombia',
    name: 'Bancolombia',
    description: 'Transferencia bancaria directa',
    icon: '🏦',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'nequi',
    name: 'Nequi',
    description: 'Transferencia desde Nequi',
    icon: '💜',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'a_la_mano',
    name: 'A la Mano',
    description: 'Transferencia desde A la Mano',
    icon: '💚',
    color: 'from-green-500 to-green-600'
  }
];

export default function BankTransferSelectionPage() {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [totalAmount, setTotalAmount] = useState<number>(0);

  useEffect(() => {
    // Get order details from session storage
    const storedOrderId = sessionStorage.getItem('orderId');
    const storedInvoiceNumber = sessionStorage.getItem('invoiceNumber');
    const storedTotal = sessionStorage.getItem('totalAmount');
    
    if (storedOrderId) {
      setOrderId(storedOrderId);
    }
    if (storedInvoiceNumber) {
      setInvoiceNumber(storedInvoiceNumber);
    }
    if (storedTotal) {
      setTotalAmount(parseFloat(storedTotal));
    }
  }, []);

  const handleProviderSelection = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  const handleContinue = async () => {
    if (selectedProvider) {
      // Store selected provider in both session storage and local storage for persistence
      sessionStorage.setItem('bankProvider', selectedProvider);
      localStorage.setItem('bankProvider', selectedProvider);
      
      // Update the order details with the selected bank provider
      try {
        const invoiceNumber = sessionStorage.getItem('invoiceNumber');
        const clientEmail = sessionStorage.getItem('clientEmail') || 'orhanimre@gmail.com'; // Get from session or use default
        
        if (invoiceNumber) {
          // For virtual orders, we can use the invoice number to identify the order
          // The update-order API can find orders by invoice number
          const fullOrderId = `${clientEmail}_${invoiceNumber}`;
          

          
          const updateResponse = await fetch('/api/admin/update-order?virtual=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: fullOrderId,
              updates: {
                comentario: `Método de pago: bank_transfer | Banco: ${selectedProvider}`
              }
            })
          });
          
          if (!updateResponse.ok) {
            console.warn('⚠️ Failed to update order with bank provider');
          }
        }
      } catch (error) {
        console.error('Error updating order with bank provider:', error);
      }
      
      // Redirect to bank transfer details page
      router.push('/bank-transfer-details');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pt-4 sm:pt-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <span className="text-xl sm:text-2xl">🏦</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Selecciona tu Banco</h1>
          <p className="text-base sm:text-lg text-gray-600">Elige el método de transferencia bancaria que prefieres</p>
        </div>



        {/* Bank Selection */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">Métodos de Transferencia Disponibles</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {bankProviders.map((provider) => (
              <div
                key={provider.id}
                onClick={() => handleProviderSelection(provider.id)}
                className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 hover:shadow-lg active:scale-95 hover:border-blue-300 hover:bg-blue-50/30 ${
                  selectedProvider === provider.id
                    ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-2 sm:mb-4">
                    <div className="flex items-center">
                      <span className="text-lg sm:text-xl mr-2">{provider.icon}</span>
                      <h3 className="text-sm sm:text-lg font-semibold text-gray-900">
                        {provider.name}
                      </h3>
                    </div>
                    {selectedProvider === provider.id && (
                      <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3">{provider.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs text-gray-500">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Pago seguro
                    </div>
                    <div className="flex items-center text-xs text-blue-600">
                      <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
                      </svg>
                      Seleccionar
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Información Importante</h3>
              <div className="text-xs sm:text-sm text-blue-800 space-y-1">
                <p>• Tu pedido será procesado una vez confirmemos la recepción del pago</p>
                <p>• Recibirás los datos bancarios en la siguiente página</p>
                <p>• Después de realizar la transferencia, deberás confirmar el pago</p>
                <p>• El proceso es completamente seguro y tus datos están protegidos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <button
            onClick={() => router.push('/checkout')}
            className="px-6 sm:px-8 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 active:scale-95"
          >
            Volver al Checkout
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedProvider}
            className={`px-6 sm:px-8 py-3 font-semibold rounded-xl transition-all duration-200 active:scale-95 ${
              selectedProvider
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
