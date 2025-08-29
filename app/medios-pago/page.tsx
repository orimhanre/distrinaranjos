import Link from 'next/link';

export const metadata = {
  title: 'Medios de Pago - DistriNaranjos',
  description: 'Medios de pago aceptados por DistriNaranjos',
};

export default function MediosPagoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Medios de Pago</h1>
          <p className="text-lg text-gray-600">Conoce todas las formas de pago que aceptamos</p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Métodos de Pago Aceptados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Wompi */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-indigo-600 text-lg">⚡</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Wompi</h3>
                  <p className="text-gray-600 text-sm">Pago digital seguro y rápido</p>
                </div>
              </div>
              {/* 2. PSE */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <span className="text-teal-600 text-lg">🏛️</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">PSE</h3>
                  <p className="text-gray-600 text-sm">Transferencia bancaria directa</p>
                </div>
              </div>
              {/* 3. Tarjetas de Crédito/Débito */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-lg">💳</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Tarjetas de Crédito/Débito</h3>
                  <p className="text-gray-600 text-sm">Visa, Mastercard</p>
                </div>
              </div>
              {/* 4. Transferencia Bancaria */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-lg">🏦</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Transferencia Bancaria</h3>
                  <p className="text-gray-600 text-sm">Bancolombia</p>
                </div>
              </div>
              {/* 5. Billeteras Digitales */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 text-lg">📱</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Billeteras Digitales</h3>
                  <p className="text-gray-600 text-sm">Nequi, A La Mano</p>
                </div>
              </div>
              {/* 6. Efectivo */}
              <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 text-lg">💵</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Efectivo</h3>
                  <p className="text-gray-600 text-sm">Solo en tienda física</p>
                </div>
              </div>
            </div>
          </div>





          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contacto para Pagos</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Teléfonos</h3>
                  <div className="space-y-1">
                    <a href="tel:3113887955" className="text-blue-600 hover:text-blue-800 transition-colors duration-200 block">
                      311 388 7955
                    </a>
                    <a href="tel:3105921767" className="text-blue-600 hover:text-blue-800 transition-colors duration-200 block">
                      310 592 1767
                    </a>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Correo Electrónico</h3>
                                      <a href="mailto:info@distrinaranjos.com" className="text-green-600 hover:text-green-800 transition-colors duration-200">
                        info@distrinaranjos.com
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 