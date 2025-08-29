import Link from 'next/link';

export const metadata = {
  title: 'Políticas de Envíos - DistriNaranjos',
  description: 'Políticas de envíos de DistriNaranjos',
};

export default function PoliticasEnviosPage() {
  return (
    <div className="min-h-screen bg-gray-50 pt-14 pb-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Políticas de Envíos</h1>
          <p className="text-lg text-gray-600">Información sobre nuestros envíos y entregas</p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Opciones de Envío</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">🚚 Envío Estándar</h3>
                <div className="text-gray-600 text-sm space-y-2">
                  <p><strong>En Medellín:</strong> 1-2 días hábiles</p>
                  <p><strong>Otras ciudades:</strong> 3-5 días hábiles (varía según departamento y zona urbana)</p>
                  <p>Envíos a todo Colombia con detalles de seguimiento enviados por WhatsApp.</p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">🏪 Recogida en Tienda</h3>
                <p className="text-gray-600 text-sm mb-2">Gratis</p>
                <div className="text-gray-600 text-sm space-y-1">
                  <p className="underline">Lunes a Viernes:</p>
                  <p>9:00 AM - 6:00 PM</p>
                  <p className="underline">Sábados:</p>
                  <p>9:00 AM - 5:00 PM</p>
                </div>
              </div>
            </div>
          </div>





          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Políticas de Entrega</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-green-600 text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Horarios de Entrega</h3>
                  <p className="text-gray-600">Entregas de lunes a viernes de 9:00 AM a 5:00 PM. Sábados de 9:00 AM a 12:00 PM.</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Documentación Requerida</h3>
                  <p className="text-gray-600">Para recibir tu pedido, necesitas presentar documento de identidad y firmar el comprobante de entrega.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contacto para Envíos</h2>
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