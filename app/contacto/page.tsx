import Link from 'next/link';

export const metadata = {
  title: 'Contacto - DistriNaranjos',
  description: 'Información de contacto de DistriNaranjos',
};

export default function ContactoPage() {
  return (
    <div className="min-h-screen bg-gray-100 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Contacto
          </h1>
          <p className="text-base sm:text-lg text-gray-600 px-4">
            Estamos aquí para ayudarte. Contáctanos para cualquier consulta.
          </p>
        </div>

        <div className="space-y-6 sm:space-y-8">
          {/* Información de Contacto */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
              Información de Contacto
            </h2>
            
            <div className="space-y-4 sm:space-y-6">
              {/* Teléfono */}
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">Teléfono</h3>
                  <div className="space-y-1">
                    <a 
                      href="tel:3113887955" 
                      className="text-blue-600 hover:text-blue-800 transition-colors duration-200 text-sm sm:text-base block"
                    >
                      311 388 7955
                    </a>
                    <a 
                      href="tel:3105921767" 
                      className="text-blue-600 hover:text-blue-800 transition-colors duration-200 text-sm sm:text-base block"
                    >
                      310 592 1767
                    </a>
                  </div>
                </div>
              </div>
              
              {/* Email */}
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">Email</h3>
                  <a 
                    href="mailto:info@distrinaranjos.com" 
                    className="text-green-600 hover:text-green-800 transition-colors duration-200 text-sm sm:text-base break-all"
                  >
                    info@distrinaranjos.com
                  </a>
                </div>
              </div>
              
              {/* Dirección */}
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">Dirección</h3>
                  <a 
                    href="https://maps.google.com/?q=Cra.+46+%2347-66+Loc.+9901+Medellín+Colombia" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:text-orange-800 transition-colors duration-200 text-sm sm:text-base block"
                  >
                    Cra. 46 #47-66 Loc. 9901<br />
                    La Candelaria, Medellín, Antioquia
                  </a>
                </div>
              </div>
              
              {/* Horarios */}
              <div className="flex items-start space-x-3 sm:space-x-4">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-1">Horarios de Atención</h3>
                  <div className="text-sm sm:text-base text-gray-600 space-y-1">
                    <p>Lunes a Viernes: 9:00 AM - 6:00 PM</p>
                    <p>Sábados: 9:00 AM - 5:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Redes Sociales */}
            <div className="mt-6 sm:mt-8">
              <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Síguenos</h3>
              <div className="flex space-x-4">
                <a
                  href="https://www.instagram.com/mareedistrinaranjos?igsh=emd6Znh4aWp4dXEx"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-500 hover:text-red-400 transition-colors duration-200 p-2"
                  aria-label="Instagram"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072-4.354-.2-6.782-2.618-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                <a
                  href="https://www.facebook.com/share/1YkqXbTM78/?mibextid=wwXIfr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-500 transition-colors duration-200 p-2"
                  aria-label="Facebook"
                >
                  <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Ubicación</h2>
            
            <div className="space-y-4">
              <div className="relative w-full h-96 sm:h-96 md:h-96 rounded-lg overflow-hidden shadow-md">
                <iframe
                  src="https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=Cra.+46+%2347-66+Loc.+9901+Medellín+Colombia"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '384px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ubicación de DistriNaranjos"
                  suppressHydrationWarning={true}
                ></iframe>
              </div>
              
              <div className="text-center">
                <p className="text-gray-600 mb-2 text-sm sm:text-base">
                  <strong>Dirección:</strong> Cra. 46 #47-66 Loc. 9901, La Candelaria, Medellín, Antioquia
                </p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Haz clic en el mapa para obtener direcciones
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 