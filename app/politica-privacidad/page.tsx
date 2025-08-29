import Link from 'next/link';

export const metadata = {
  title: 'Política de Tratamiento de Datos Personales - DistriNaranjos S.A.S.',
  description: 'Política de privacidad y tratamiento de datos personales de DistriNaranjos S.A.S.',
};

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Política de Tratamiento de Datos Personales
          </h1>
          <p className="text-gray-600 text-lg">
            DistriNaranjos S.A.S. - Última actualización: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 space-y-6">
          
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Información General</h2>
            <p className="text-gray-700 mb-4">
              DistriNaranjos S.A.S., en cumplimiento de la Ley 1581 de 2012 "Por la cual se dictan disposiciones generales 
              para la protección de datos personales", el Decreto 1377 de 2013 "Por el cual se reglamenta la Ley 1581 de 2012", 
              y la Circular 002 de 2015 de la Superintendencia de Industria y Comercio, establece la presente Política de 
              Tratamiento de Datos Personales para informar a los titulares de datos sobre las condiciones del tratamiento 
              de su información personal.
            </p>
            <p className="text-gray-700">
              Esta política se aplica a todos los datos personales registrados en bases de datos que sean susceptibles 
              de tratamiento por parte de DistriNaranjos S.A.S., ya sea como responsable o encargado del tratamiento.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Responsable del Tratamiento</h2>
            <div className="text-gray-700 space-y-2">
              <p><strong>Razón Social:</strong> DistriNaranjos S.A.S.</p>
              <p><strong>NIT:</strong> 900743681</p>
              <p><strong>Dirección:</strong> Cra. 46 #47-66 Loc. 9901, La Candelaria, Medellín, Antioquia</p>
              <p><strong>Email:</strong> 
                <a href="mailto:info@distrinaranjos.com" className="text-blue-600 hover:underline ml-1">
                  info@distrinaranjos.com
                </a>
              </p>
              <p><strong>Teléfonos:</strong> 
                <a href="https://wa.me/573113887955" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                  311 388 7955
                </a>
                {' | '}
                <a href="https://wa.me/573105921767" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  310 592 1767
                </a>
              </p>
              <p><strong>Autoridad de Control:</strong> Superintendencia de Industria y Comercio (SIC)</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Finalidades del Tratamiento</h2>
            <p className="text-gray-700 mb-4">
              Sus datos personales serán utilizados para las siguientes finalidades:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Gestionar y procesar pedidos de productos y servicios</li>
              <li>Establecer comunicación comercial y de servicio al cliente</li>
              <li>Enviar información sobre productos, servicios y promociones</li>
              <li>Realizar análisis estadísticos y estudios de mercado</li>
              <li>Cumplir con obligaciones legales, contractuales y fiscales</li>
              <li>Gestionar la relación comercial y de servicios</li>
              <li>Enviar notificaciones sobre el estado de pedidos y facturación</li>
              <li>Mejorar la experiencia del usuario en nuestra plataforma</li>
              <li>Gestionar garantías y soporte técnico</li>
              <li>Realizar encuestas de satisfacción y calidad</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Datos Personales Recolectados</h2>
            <p className="text-gray-700 mb-4">
              Recolectamos los siguientes tipos de datos personales:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Datos de identificación:</strong> Nombres, apellidos, cédula, fecha de nacimiento</li>
              <li><strong>Datos de contacto:</strong> Dirección física, teléfono fijo y móvil, correo electrónico</li>
              <li><strong>Datos comerciales:</strong> Historial de compras, preferencias de productos, hábitos de consumo</li>
              <li><strong>Datos técnicos:</strong> Información de navegación, cookies, dirección IP, datos de geolocalización</li>
              <li><strong>Datos de la empresa:</strong> Razón social, NIT, dirección comercial, representante legal</li>
              <li><strong>Datos financieros:</strong> Información de facturación y métodos de pago</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Autorización del Titular</h2>
            <p className="text-gray-700 mb-4">
              Al utilizar nuestros servicios y proporcionar sus datos personales, usted autoriza 
              expresamente a DistriNaranjos S.A.S. para el tratamiento de su información personal de 
              acuerdo con las finalidades descritas en esta política.
            </p>
            <p className="text-gray-700 mb-4">
              La autorización se entiende otorgada desde el momento en que usted proporciona 
              sus datos personales a través de nuestros canales de contacto, y puede ser revocada 
              en cualquier momento mediante los procedimientos establecidos en esta política.
            </p>
            <p className="text-gray-700">
              <strong>Excepciones a la autorización:</strong> El tratamiento de datos personales podrá realizarse sin 
              autorización del titular en los casos previstos en el artículo 10 de la Ley 1581 de 2012.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Derechos del Titular</h2>
            <p className="text-gray-700 mb-4">
              Como titular de los datos personales, usted tiene los siguientes derechos reconocidos 
              en el artículo 8 de la Ley 1581 de 2012:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Conocer:</strong> Acceder de forma gratuita a sus datos personales que hayan sido objeto de tratamiento</li>
              <li><strong>Actualizar:</strong> Rectificar sus datos personales cuando sean parcial o totalmente inexactos, incompletos, fraccionados, que induzcan a error, o aquellos cuyo tratamiento esté prohibido o no haya sido autorizado</li>
              <li><strong>Suprimir:</strong> Solicitar la eliminación de sus datos personales cuando no exista una obligación legal o contractual que impida su supresión</li>
              <li><strong>Revocar:</strong> Revocar la autorización otorgada para el tratamiento de sus datos personales</li>
              <li><strong>Consultar:</strong> Solicitar prueba de la autorización otorgada para el tratamiento de sus datos personales</li>
              <li><strong>Reclamo:</strong> Presentar quejas ante la Superintendencia de Industria y Comercio por infracciones a la normativa de protección de datos</li>
              <li><strong>Información:</strong> Ser informado sobre el uso que se ha dado a sus datos personales</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Procedimiento para Ejercer los Derechos</h2>
            <p className="text-gray-700 mb-4">
              Para ejercer sus derechos como titular de datos personales, puede:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Enviar un correo electrónico a 
                <a href="mailto:info@distrinaranjos.com" className="text-blue-600 hover:underline ml-1">
                  info@distrinaranjos.com
                </a>
              </li>
              <li>Presentar una solicitud escrita en nuestras oficinas ubicadas en Cra. 46 #47-66 Loc. 9901, Medellín</li>
              <li>Utilizar los canales de contacto establecidos en nuestra página web</li>
            </ul>
            <p className="text-gray-700 mt-4 mb-4">
              <strong>Plazos de respuesta:</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Consultas: 10 días hábiles contados desde la fecha de recibo de la solicitud</li>
              <li>Reclamos: 15 días hábiles contados desde la fecha de recibo de la solicitud</li>
              <li>En caso de que no sea posible atender la solicitud dentro de estos términos, se informará al interesado antes del vencimiento de los plazos, expresando los motivos de la demora y la fecha en que se atenderá su solicitud</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Seguridad de los Datos</h2>
            <p className="text-gray-700 mb-4">
              DistriNaranjos S.A.S. implementa medidas técnicas, humanas y administrativas para 
              proteger la confidencialidad, integridad y disponibilidad de sus datos personales, 
              incluyendo:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Encriptación de datos sensibles y transmisiones</li>
              <li>Acceso restringido a la información personal mediante autenticación</li>
              <li>Capacitación del personal en protección de datos personales</li>
              <li>Auditorías regulares de seguridad y cumplimiento</li>
              <li>Copias de seguridad seguras y procedimientos de recuperación</li>
              <li>Protocolos de respuesta a incidentes de seguridad</li>
              <li>Destrucción segura de datos cuando ya no sean necesarios</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Transferencias y Transmisiones</h2>
            <p className="text-gray-700 mb-4">
              Sus datos personales pueden ser compartidos con:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Proveedores de servicios de pago y envío para el cumplimiento de las finalidades comerciales</li>
              <li>Autoridades competentes cuando sea requerido por ley o para el cumplimiento de obligaciones legales</li>
              <li>Empresas del grupo empresarial para fines administrativos y de gestión</li>
              <li>Proveedores de servicios tecnológicos y de hosting que nos apoyan en la operación</li>
              <li>Entidades financieras para el procesamiento de pagos</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Todas las transferencias se realizan con las garantías de seguridad apropiadas y 
              en cumplimiento de la normativa colombiana de protección de datos personales.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Conservación de Datos</h2>
            <p className="text-gray-700 mb-4">
              Sus datos personales serán conservados durante el tiempo necesario para cumplir 
              con las finalidades del tratamiento y las obligaciones legales aplicables, incluyendo:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Datos comerciales: 5 años según normativa comercial colombiana</li>
              <li>Datos contables y fiscales: 10 años según normativa tributaria</li>
              <li>Datos de contacto: Mientras mantenga una relación comercial activa</li>
              <li>Datos técnicos: Según la finalidad específica del tratamiento</li>
            </ul>
            <p className="text-gray-700">
              Una vez cumplidos estos propósitos, los datos serán eliminados de forma segura 
              o anonimizados para fines estadísticos o de investigación.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Cookies y Tecnologías Similares</h2>
            <p className="text-gray-700 mb-4">
              Nuestro sitio web utiliza cookies y tecnologías similares para:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Mejorar la experiencia de navegación y funcionalidad del sitio</li>
              <li>Recordar sus preferencias y configuraciones</li>
              <li>Analizar el tráfico del sitio web y comportamiento de usuarios</li>
              <li>Personalizar el contenido mostrado según sus intereses</li>
              <li>Garantizar la seguridad de la sesión y prevenir fraudes</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Puede configurar su navegador para rechazar cookies, aunque esto puede 
              afectar la funcionalidad del sitio web. Para más información sobre el uso 
              de cookies, consulte nuestra Política de Cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Menores de Edad</h2>
            <p className="text-gray-700">
              No recolectamos intencionalmente datos personales de menores de 18 años. 
              Si usted es menor de edad, debe obtener el consentimiento de sus padres 
              o tutores antes de proporcionar información personal. En caso de detectar 
              que hemos recolectado datos de menores sin la autorización correspondiente, 
              procederemos a eliminarlos de inmediato.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Modificaciones a la Política</h2>
            <p className="text-gray-700">
              DistriNaranjos S.A.S. se reserva el derecho de modificar esta política en cualquier momento. 
              Los cambios serán notificados a través de nuestro sitio web y, cuando sea necesario, 
              mediante comunicación directa a los titulares de datos. La versión más reciente de esta 
              política estará siempre disponible en nuestro sitio web con la fecha de última actualización.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Contacto</h2>
            <p className="text-gray-700 mb-4">
              Para cualquier consulta sobre esta política o el tratamiento de sus datos personales, 
              puede contactarnos a través de:
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
                <a href="tel:3113887955" className="text-blue-600 hover:underline md:pointer-events-none md:text-gray-700">311 388 7955</a> | 
                <a href="tel:3105921767" className="text-blue-600 hover:underline md:pointer-events-none md:text-gray-700"> 310 592 1767</a>
              </p>
                                        <p className="text-gray-700">
                            <strong>Dirección:</strong> Cra. 46 #47-66 Loc. 9901, La Candelaria, Medellín, Antioquia
                          </p>
              <p className="text-gray-700">
                                            <strong>Horario de atención:</strong> Lunes a Viernes de 9:00 AM a 6:00 PM | Sábados de 9:00 AM a 5:00 PM
              </p>
              <p className="text-gray-700">
                <strong>Autoridad de Control:</strong> Superintendencia de Industria y Comercio (SIC)
              </p>
            </div>
          </section>

          <section className="border-t pt-6">
            <p className="text-sm text-gray-600 text-center">
              Esta política de tratamiento de datos personales fue actualizada por última vez 
              el {new Date().toLocaleDateString('es-ES')} y está disponible en nuestro sitio web 
              para consulta permanente. Para reportar incidentes de seguridad relacionados con 
              datos personales, contacte inmediatamente a nuestro equipo de seguridad.
            </p>
          </section>

        </div>


      </div>
    </div>
  );
} 