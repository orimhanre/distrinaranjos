import Link from 'next/link';

export const metadata = {
  title: 'Garantías - DistriNaranjos',
  description: 'Política de garantías de DistriNaranjos',
};

export default function GarantiasPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Garantías</h1>
          <p className="text-lg text-gray-600">Información sobre nuestras garantías de productos</p>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Política de Garantías</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-blue-600 text-sm">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Garantía Estándar</h3>
                  <p className="text-gray-600">Todos nuestros productos incluyen garantía de 1 año contra defectos de fabricación.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Cobertura de Garantía</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">✅ Cubierto</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Defectos de fabricación</li>
                  <li>• Fallas en costuras</li>
                  <li>• Problemas con cremalleras</li>
                  <li>• Defectos en materiales</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">❌ No Cubierto</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Daños por mal uso</li>
                  <li>• Desgaste normal</li>
                  <li>• Daños por accidentes</li>
                  <li>• Modificaciones del producto</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Proceso de Garantía</h2>
            <ol className="list-decimal list-inside space-y-3 text-gray-600">
                              <li>Contáctanos por Correo Electrónico</li>
              <li>Describe el problema y proporciona la factura</li>
              <li>Envía fotos del defecto si es posible</li>
              <li>Evaluaremos el caso</li>
              <li>Si se aprueba, procederemos con la reparación o reemplazo</li>
            </ol>
          </div>

          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contacto para Garantías</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📞 Teléfonos</h3>
                <div className="space-y-1">
                  <p className="text-gray-600">
                    311 388 7955
                  </p>
                  <p className="text-gray-600">
                    310 592 1767
                  </p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">📧 Correo Electrónico</h3>
                <p className="text-gray-600">
                                  <a href="mailto:info@distrinaranjos.com" className="text-blue-600 hover:underline">
                  info@distrinaranjos.com
                </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 