'use client';

import React from 'react';
import Link from 'next/link';

export default function TerminosCondiciones() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Términos y Condiciones
          </h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6 text-center">
              Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>

            <div className="space-y-8">
              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Información General</h2>
                <p className="text-gray-700 mb-4">
                  DistriNaranjos S.A.S., con NIT 900743681, establece los presentes Términos y Condiciones 
                  que regulan el uso de nuestro sitio web y servicios. Al acceder y utilizar nuestros servicios, 
                  usted acepta estar sujeto a estos términos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Definiciones</h2>
                <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                  <li><strong>"Sitio Web":</strong> Refiere a distrinaranjos.com y todos sus subdominios</li>
                  <li><strong>"Usuario":</strong> Cualquier persona que acceda o utilice el sitio web</li>
                  <li><strong>"Servicios":</strong> Todos los productos y servicios ofrecidos por DistriNaranjos S.A.S.</li>
                  <li><strong>"Contenido":</strong> Toda la información, textos, imágenes y materiales disponibles en el sitio</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Uso del Sitio Web</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">3.1 Uso Permitido</h3>
                    <p className="text-gray-700">
                      El sitio web está destinado únicamente para uso personal y comercial legítimo. 
                      Los usuarios pueden navegar, consultar productos y realizar compras de acuerdo con estos términos.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">3.2 Uso Prohibido</h3>
                    <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                      <li>Usar el sitio para actividades ilegales o fraudulentas</li>
                      <li>Intentar acceder a sistemas o información no autorizada</li>
                      <li>Interferir con el funcionamiento del sitio web</li>
                      <li>Transmitir virus, malware o código dañino</li>
                      <li>Usar robots, spiders o herramientas automatizadas sin autorización</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Productos y Servicios</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">4.1 Disponibilidad</h3>
                    <p className="text-gray-700">
                      Nos esforzamos por mantener información precisa sobre nuestros productos, pero no garantizamos 
                      la disponibilidad de todos los productos en todo momento. Los precios y especificaciones 
                      pueden cambiar sin previo aviso.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">4.2 Descripción de Productos</h3>
                    <p className="text-gray-700">
                      Las descripciones, imágenes y especificaciones de los productos se proporcionan con fines informativos. 
                      Nos reservamos el derecho de corregir errores y modificar información sin previo aviso.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Precios y Pagos</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">5.1 Precios</h3>
                    <p className="text-gray-700">
                      Todos los precios están expresados en pesos colombianos (COP) e incluyen IVA. 
                      Los precios pueden cambiar sin previo aviso.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">5.2 Métodos de Pago</h3>
                    <p className="text-gray-700">
                      Aceptamos los métodos de pago especificados en nuestra página de{' '}
                      <Link href="/medios-pago" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        "Medios de Pago"
                      </Link>. 
                      Todos los pagos se procesan de forma segura a través de nuestros proveedores autorizados.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Envíos y Entregas</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">6.1 Tiempos de Entrega</h3>
                    <p className="text-gray-700">
                      Los tiempos de entrega estimados se proporcionan al momento de la compra. 
                      Estos pueden variar según la ubicación y disponibilidad del producto.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">6.2 Cobertura de Envío</h3>
                    <p className="text-gray-700">
                      Nuestros servicios de envío están disponibles en las zonas especificadas en nuestra 
                      página de{' '}
                      <Link href="/politicas-envios" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        "Políticas de Envíos"
                      </Link>. 
                      No realizamos envíos a zonas no cubiertas.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Garantías y Devoluciones</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">7.1 Garantía de Productos</h3>
                    <p className="text-gray-700">
                      Todos nuestros productos cuentan con garantía según lo especificado en nuestra página de{' '}
                      <Link href="/garantias" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        "Garantías"
                      </Link>. 
                      Los términos de garantía varían según el producto.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">7.2 Política de Devoluciones</h3>
                    <p className="text-gray-700">
                      Las devoluciones se rigen por nuestra política interna y las garantías aplicables. 
                      Para más información, consulte nuestra página de{' '}
                      <Link href="/garantias" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                        garantías
                      </Link>.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Propiedad Intelectual</h2>
                <p className="text-gray-700 mb-4">
                  Todo el contenido del sitio web, incluyendo textos, imágenes, logos, diseños y software, 
                  es propiedad de DistriNaranjos S.A.S. o sus licenciantes. Está prohibida la reproducción, 
                  distribución o modificación sin autorización expresa.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Privacidad y Datos Personales</h2>
                <p className="text-gray-700 mb-4">
                  El tratamiento de sus datos personales se rige por nuestra{' '}
                  <Link href="/politica-privacidad" className="text-blue-600 hover:text-blue-800 hover:underline font-medium">
                    Política de Privacidad
                  </Link>, 
                  disponible en nuestro sitio web. Al utilizar nuestros servicios, usted acepta el 
                  tratamiento de sus datos según dicha política.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Limitación de Responsabilidad</h2>
                <div className="space-y-4">
                  <p className="text-gray-700">
                    DistriNaranjos S.A.S. no será responsable por:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
                    <li>Daños indirectos, incidentales o consecuentes</li>
                    <li>Pérdida de datos o información</li>
                    <li>Interrupciones del servicio no causadas por nosotros</li>
                    <li>Actos de terceros o fuerza mayor</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Modificaciones</h2>
                <p className="text-gray-700 mb-4">
                  Nos reservamos el derecho de modificar estos términos en cualquier momento. 
                  Los cambios entrarán en vigor inmediatamente después de su publicación en el sitio web. 
                  El uso continuado del sitio después de los cambios constituye aceptación de los nuevos términos.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Ley Aplicable y Jurisdicción</h2>
                <p className="text-gray-700 mb-4">
                  Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa 
                  será resuelta en los tribunales competentes de Medellín, Colombia.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Contacto</h2>
                <p className="text-gray-700 mb-4">
                  Para cualquier consulta sobre estos términos y condiciones, puede contactarnos a través de:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-gray-700">
                    <strong>Email:</strong> 
                                    <a href="mailto:info@distrinaranjos.com" className="text-blue-600 hover:underline ml-1">
                  info@distrinaranjos.com
                </a>
                  </p>
                  <p className="text-gray-700">
                    <strong>Teléfonos: </strong> 
                    <a href="tel:3113887955" className="text-blue-600 hover:underline">311 388 7955</a> | 
                    <a href="tel:3105921767" className="text-blue-600 hover:underline"> 310 592 1767</a>
                  </p>
                  <p className="text-gray-700">
                    <strong>Dirección:</strong> Cra. 46 #47-66 Loc. 9901, La Candelaria, Medellín, Antioquia
                  </p>
                  <p className="text-gray-700">
                                                <strong>Horario de atención:</strong> Lunes a Viernes de 9:00 AM a 6:00 PM | Sábados de 9:00 AM a 5:00 PM
                  </p>
                </div>
              </section>
            </div>
          </div>
          
          {/* Back to Top Button */}
          <div className="mt-8 text-center">
            <button
              onClick={scrollToTop}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200 flex items-center mx-auto"
            >
              <span className="mr-2">⬆️</span>
              Volver al Inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 