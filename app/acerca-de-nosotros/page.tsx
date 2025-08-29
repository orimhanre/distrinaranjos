"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaInstagram, FaFacebook, FaTruck, FaShieldAlt, FaUsers, FaStar } from 'react-icons/fa';

export default function AcercaDeNosotrosPage() {
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch web photos from virtual database (where logos are stored after Airtable sync)
        const webPhotosResponse = await fetch('/api/webphotos');
        const webPhotosData = await webPhotosResponse.json();
        if (webPhotosData.success) {
          console.log('WebPhotos loaded from virtual DB:', webPhotosData.webPhotos);
          console.log('WebPhotos keys:', Object.keys(webPhotosData.webPhotos));
          console.log('WebPhotos values:', Object.values(webPhotosData.webPhotos));
          setWebPhotos(webPhotosData.webPhotos);
        }

        // Fetch brands from virtual metadata since this is a main page
        const virtualMetadataResponse = await fetch('/api/database/virtual-metadata');
        const virtualMetadataData = await virtualMetadataResponse.json();
        if (virtualMetadataData.success && virtualMetadataData.metadata) {
          if (virtualMetadataData.metadata.brands) {
            console.log('Brands loaded from virtual DB:', virtualMetadataData.metadata.brands);
            // Filter out empty or invalid brand names
            const validBrands = virtualMetadataData.metadata.brands.filter((brand: string) => brand && typeof brand === 'string' && brand.trim());
            setBrands(validBrands);
          }
        }
        
        // Fetch categories from actual product data in virtual database
        const categoriesResponse = await fetch('/api/database/virtual-product-categories');
        const categoriesData = await categoriesResponse.json();
        if (categoriesData.success) {
          console.log('Product categories loaded from virtual DB:', categoriesData.categories);
          console.log('Product subcategories loaded from virtual DB:', categoriesData.subCategories);
          
          // Use categories from actual products (filter out irrelevant ones)
          const validCategories = categoriesData.categories.filter((category: string) => 
            category && 
            typeof category === 'string' && 
            category.trim() && 
            !['Nuevo', 'Popular', 'Promocion'].includes(category) // Filter out marketing categories
          );
          setCategories(validCategories);
        }
        
        // Set loading to false after all data is processed
        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Fallback to hardcoded brands if API fails (matching virtual DB)
        setBrands(['Massnu', 'Reno', 'Najos', 'AJ', 'Tiber', 'Importado'].filter(brand => brand && brand.trim()));
        setCategories(['Uso Diario', 'Trabajo', 'Viaje', 'Escolar', 'Laptop', 'Camping'].filter(category => category && category.trim()));
        setLoading(false);
      }
    };

    fetchData();
    
    // Fallback timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      if (loading) {
        console.log('Loading timeout reached, using fallback data (matching virtual DB)');
        setBrands(['Massnu', 'Reno', 'Najos', 'AJ', 'Tiber', 'Importado'].filter(brand => brand && brand.trim()));
        setCategories(['Uso Diario', 'Trabajo', 'Viaje', 'Escolar', 'Laptop', 'Camping'].filter(category => category && category.trim()));
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    return () => clearTimeout(timeout);
  }, []); // Remove loading from dependencies to prevent infinite loop

  const getLogoPath = (brand: string) => {
    const brandLower = brand.toLowerCase();
    
    // WebPhotos are stored with "logo-" prefix (e.g., "logo-massnu", "logo-reno", etc.)
    const logoKey = `logo-${brandLower}`;
    
    if (webPhotos && webPhotos[logoKey]) {
      console.log(`✅ Found logo for ${brand}: ${logoKey} -> ${webPhotos[logoKey]}`);
      return webPhotos[logoKey];
    }
    
    // If no logo found in database, use a generic placeholder
    console.log(`⚠️ No logo found for ${brand}, using placeholder`);
    return '/placeholder-image.png';
  };

  const getLogoPathWithFallback = (brand: string) => {
    const brandLower = brand.toLowerCase();
    
    // Try multiple fallback paths
    const fallbackPaths = [
      // Try webPhotos first - look for exact logo matches from virtual database
      ...(webPhotos ? Object.entries(webPhotos)
        .filter(([key, value]) => key === `logo-${brandLower}` && value)
        .map(([key, value]) => value) : []),
      // Try webPhotos with partial brand name matches as fallback
      ...(webPhotos ? Object.entries(webPhotos)
        .filter(([key, value]) => key.toLowerCase().includes(brandLower) && value)
        .map(([key, value]) => value) : []),
      // Try current timestamp paths (based on actual files in directory)
      `/images/webphotos/logo_${brandLower}_1754879707528.png`, // massnu
      `/images/webphotos/logo_${brandLower}_1754879708405.png`, // reno
      `/images/webphotos/logo_${brandLower}_1754879709063.png`, // najos
      `/images/webphotos/logo_${brandLower}_1754879709553.png`, // aj
      `/images/webphotos/logo_${brandLower}_1754879709941.png`, // tiber
      `/images/webphotos/logo_${brandLower}_1754879710325.png`, // importado
      // Try generic paths without timestamps
      `/images/webphotos/logo_${brandLower}.png`,
      // Final fallback
      '/placeholder-image.png'
    ].filter(Boolean);
    
    const selectedPath = fallbackPaths[0] || '/placeholder-image.png';
    console.log(`Logo path for ${brand}: ${selectedPath} (from ${fallbackPaths.length} fallback options)`);
    console.log(`Available fallback paths for ${brand}:`, fallbackPaths);
    return selectedPath;
  };

  const getBrandDescription = (brand: string) => {
    const descriptions: Record<string, string> = {
      'massnu': 'Calidad acompañada de colores y diseños urbanos',
      'reno': 'Calidad y durabilidad especializada para trabajos pesados',
      'najos': 'Diseños urbanos y modernos resistentes para el dia a dia',
      'aj': 'Linea urbana y deportiva al alcanze de tu bolsillo',
      'tiber': 'Funcionalidad y resistencia',
      'importado': 'Alternativas a marcas nacionales',
    };
    return descriptions[brand.toLowerCase()] || 'Calidad y confianza garantizada';
  };

  const getBrandColor = (brand: string, index: number) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
      'from-red-500 to-red-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-yellow-500 to-yellow-600',
      'from-teal-500 to-teal-600',
      'from-cyan-500 to-cyan-600',
    ];
    return colors[index % colors.length];
  };

  const getCategoryDescription = (category: string) => {
    const descriptions: Record<string, string> = {
      'uso diario': 'Perfectos para el día a día, cómodos y prácticos',
      'trabajo': 'Profesionales y elegantes para el entorno laboral',
      'viaje': 'Ideal para viajes y aventuras, resistentes y funcionales',
      'escolar': 'Prácticos y duraderos para estudiantes',
      'laptop': 'Especialmente diseñados para proteger tu tecnología',
      'camping': 'Resistentes para actividades al aire libre y camping',
      'aeropuerto': 'Perfectos para viajes en avión y transporte',
      'moto': 'Especialmente diseñados para motociclistas',
      'senderismo': 'Ideal para caminatas y senderismo',
      'herramientas': 'Resistentes para llevar herramientas de trabajo',
    };
    return descriptions[category && typeof category === 'string' ? category.toLowerCase() : ''] || 'Productos de calidad para todas tus necesidades';
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      'uso diario': '👜',
      'trabajo': '💼',
      'viaje': '✈️',
      'escolar': '📚',
      'laptop': '💻',
      'camping': '🏕️',
      'aeropuerto': '🛫',
      'moto': '🏍️',
      'senderismo': '🥾',
      'herramientas': '🔧',
    };
    return icons[category && typeof category === 'string' ? category.toLowerCase() : ''] || '📦';
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50">
      {/* Hero Section */}
      <section className="relative py-12 md:py-20 px-4 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-0">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-6 font-contrail-one leading-tight">
              Acerca de Nosotros
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-2 md:px-0">
              Tu distribuidor confiable de productos de calidad en Colombia
            </p>
          </div>
        </div>
      </section>

      {/* Company Story Section */}
      <section className="py-8 md:py-2 px-4 md:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 md:mb-6 font-contrail-one leading-tight">
                Nuestra Historia
              </h2>
              <div className="space-y-3 md:space-y-4 text-sm md:text-base lg:text-lg text-gray-700 leading-relaxed">
                <p>
                  <strong>DistriNaranjos</strong> nació con la visión de convertirse en el distribuidor líder 
                  de productos de calidad en Colombia. Desde nuestros inicios, nos hemos comprometido a 
                  ofrecer una amplia gama de productos que satisfagan las necesidades de nuestros clientes.
                </p>
                <p>
                  Nos especializamos en la distribución de morrales, bolsos, maletines y accesorios de 
                  las mejores marcas del mercado, incluyendo Massnu, Reno, Najos, AJ e Importados. 
                  Cada producto en nuestro catálogo ha sido cuidadosamente seleccionado para garantizar 
                  calidad, durabilidad y estilo.
                </p>
                <p>
                  <strong>Nuestra marca propia Massnu</strong>, y nuestras marcas hermanas Reno, Najos y Aj son confeccionadas
                con los mejores materiales 
                  y por talento humano 100% colombiano. Estas líneas representa nuestro compromiso con la 
                  calidad nacional y el apoyo a la industria local, ofreciendo productos que combinan 
                  diseño moderno con la calidad colombiana.
                </p>
                <p>
                  Nuestro compromiso va más allá de simplemente vender productos; nos esforzamos por 
                  construir relaciones duraderas con nuestros clientes, ofreciendo un servicio excepcional 
                  y soporte continuo.
                </p>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 text-white">
                <h3 className="text-lg md:text-xl lg:text-2xl font-bold mb-3 md:mb-4 leading-tight">Nuestra Misión</h3>
                <p className="text-sm md:text-base lg:text-lg leading-relaxed">
                  Proporcionar productos de alta calidad que mejoren la vida diaria de nuestros clientes, 
                  ofreciendo un servicio excepcional y precios competitivos en todo Colombia.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-12 md:py-16 px-4 md:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 md:mb-12 font-contrail-one leading-tight">
            Nuestros Valores
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            <div className="text-center p-4 md:p-6 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-blue-500 rounded-full flex items-center justify-center">
                <FaStar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Calidad</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Seleccionamos únicamente productos de la más alta calidad para garantizar la satisfacción de nuestros clientes.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-gradient-to-br from-green-50 to-green-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-green-500 rounded-full flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Confianza</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Construimos relaciones duraderas basadas en la transparencia, honestidad y confianza mutua.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-purple-500 rounded-full flex items-center justify-center">
                <FaUsers className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Servicio</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Ofrecemos un servicio al cliente excepcional, siempre disponible para resolver cualquier consulta.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaTruck className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Entrega</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Garantizamos entregas rápidas y seguras en todo el territorio colombiano.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 md:py-16 px-4 md:px-16 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 md:mb-12 font-contrail-one leading-tight">
            Nuestros Compromisos
          </h2>
          <p className="text-center text-sm md:text-base lg:text-lg text-gray-600 mb-8 md:mb-12 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
            Nos comprometemos a ofrecerte la mejor experiencia con productos de calidad y servicio excepcional
          </p>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaStar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Calidad Garantizada</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Todas nuestras marcas cumplen con los más altos estándares de calidad y durabilidad.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Garantía de Fabrica</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              Garantía de fábrica 1 año por defecto de fabricación. Reparacion sin costo, para cambio de producto solo en algunos casos.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaTruck className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Distribución Nacional</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Llegamos a todo Colombia con entregas rápidas y seguras.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaStar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Variedad Completa</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Desde uso diario hasta aventuras extremas, tenemos la categoría perfecta para ti.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaShieldAlt className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Calidad Especializada</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Cada categoría está diseñada para cumplir con los estándares específicos de su uso.
              </p>
            </div>
            <div className="text-center p-4 md:p-6 rounded-xl bg-white shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 bg-orange-500 rounded-full flex items-center justify-center">
                <FaTruck className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">Envío Rápido</h3>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                Encuentra tu categoría ideal y recíbela en la puerta de tu casa.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Brands Section */}
      <section className="py-12 md:py-16 px-4 md:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 md:mb-12 font-contrail-one leading-tight">
            Nuestras Marcas
          </h2>
          <p className="text-center text-sm md:text-base lg:text-lg text-gray-600 mb-8 md:mb-12 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
            Trabajamos con las mejores marcas del mercado para ofrecerte productos de la más alta calidad
          </p>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {loading ? (
                // Loading state
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-2xl shadow-lg animate-pulse">
                    <div className="bg-gray-300 p-8 h-48"></div>
                  </div>
                ))
              ) : brands.length > 0 ? (
                // Dynamic brands from database
                brands.filter(brand => brand && brand.trim()).map((brand, index) => (
                <Link 
                  key={brand || `brand-${index}`} 
                  href={`/marca/${brand.toLowerCase().replace(/\s+/g, '-')}`}
                  className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer h-full"
                >
                                      <div className={`bg-gradient-to-br ${getBrandColor(brand, index)} p-4 md:p-6 lg:p-8 text-white relative z-10 h-full flex flex-col`}>
                      <div className="text-center flex flex-col h-full">
                        <div className="w-16 h-16 md:w-20 lg:w-24 md:h-20 lg:h-24 mx-auto mb-3 md:mb-4 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm overflow-hidden">
                          {/* Debug info */}
                          <div className="text-xs text-white opacity-50 absolute top-0 left-0 p-1">
                            {brand}
                          </div>
                          
                          <Image
                            src={getLogoPathWithFallback(brand)}
                            alt={`Logo ${brand}`}
                            width={80}
                            height={80}
                            className="w-12 h-12 md:w-16 lg:w-16 object-contain"
                            style={{ minWidth: '48px', minHeight: '48px' }}
                            onLoad={() => {
                              console.log(`✅ Logo loaded successfully for ${brand}`);
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const attemptedPath = target.src;
                              console.error(`Error loading logo for ${brand}:`, {
                                brand,
                                attemptedPath,
                                webPhotosKeys: webPhotos ? Object.keys(webPhotos) : [],
                                webPhotosValues: webPhotos ? Object.values(webPhotos) : []
                              });
                              
                              // Fallback to initial if image fails to load
                              target.style.display = 'none';
                              const fallback = target.parentElement?.querySelector('.fallback-initial');
                              if (fallback) {
                                (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                          
                          {/* Fallback initial */}
                          <div className="fallback-initial hidden w-12 h-12 md:w-16 lg:w-16 bg-white bg-opacity-30 rounded-full flex items-center justify-center">
                            <span className="text-lg md:text-xl lg:text-2xl font-bold text-white">
                              {brand.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <h3 className="text-lg md:text-xl lg:text-2xl font-bold mb-2 leading-tight">{brand}</h3>
                        <p className="text-white text-opacity-90 text-xs md:text-sm leading-relaxed flex-grow">
                          {getBrandDescription(brand)}
                        </p>
                      </div>
                    </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>
              ))
            ) : (
              // No brands found
              <div className="col-span-full text-center py-8 md:py-12">
                <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-400 text-2xl md:text-3xl">🏢</span>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 leading-tight">Cargando marcas...</h3>
                <p className="text-gray-500 text-sm md:text-base">Estamos preparando nuestras marcas para ti</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-12 md:py-16 px-4 md:px-16 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 md:mb-12 font-contrail-one leading-tight">
            Nuestras Categorías
          </h2>
          <p className="text-center text-sm md:text-base lg:text-lg text-gray-600 mb-8 md:mb-12 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
            Ofrecemos una amplia variedad de productos organizados por categorías para satisfacer todas tus necesidades
          </p>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {loading ? (
                // Loading state
                Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="group relative overflow-hidden rounded-2xl shadow-lg animate-pulse">
                    <div className="bg-gray-300 p-8 h-48"></div>
                  </div>
                ))
              ) : categories.length > 0 ? (
                // Dynamic categories from database
                categories.filter(category => category && category.trim()).map((category, index) => (
                <Link 
                  key={category || `category-${index}`} 
                  href={`/categoria/${encodeURIComponent(category)}`}
                  className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer"
                >
                  <div className={`bg-gradient-to-br ${getBrandColor(category, index)} p-4 md:p-6 lg:p-8 text-white relative z-10`}>
                    <div className="text-center">
                      <div className="w-16 h-16 md:w-20 lg:w-24 md:h-20 lg:h-24 mx-auto mb-3 md:mb-4 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                        <span className="text-2xl md:text-3xl lg:text-4xl">
                          {getCategoryIcon(category)}
                        </span>
                      </div>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-bold mb-2 capitalize leading-tight">{category}</h3>
                      <p className="text-white text-opacity-90 text-xs md:text-sm leading-relaxed">
                        {getCategoryDescription(category)}
                      </p>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </Link>
              ))
            ) : (
              // No categories found
              <div className="col-span-full text-center py-8 md:py-12">
                <div className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-gray-400 text-2xl md:text-3xl">📦</span>
                </div>
                <h3 className="text-lg md:text-xl font-semibold text-gray-700 mb-2 leading-tight">Cargando categorías...</h3>
                <p className="text-gray-500 text-sm md:text-base">Estamos preparando nuestras categorías para ti</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Location & Contact Section */}
      <section className="py-12 md:py-16 px-4 md:px-16">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-900 mb-8 md:mb-12 font-contrail-one leading-tight">
            Ubicación y Contacto
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12">
            <div className="space-y-4 md:space-y-6">
              <div className="flex items-start space-x-3 md:space-x-4 p-3 md:p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaMapMarkerAlt className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 leading-tight">Ubicación</h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                    Cra. 46 #47-66 Loc. 9901<br />
                    La Candelaria, Medellín, Antioquia<br />
                    Servicio de distribución en todo el territorio nacional
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 md:space-x-4 p-3 md:p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaPhone className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 leading-tight">Teléfono</h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                    <a href="tel:3113887955" className="text-orange-600 hover:text-orange-700 font-medium block py-1">311 388 7955</a>
                    <a href="tel:3105921767" className="text-orange-600 hover:text-orange-700 font-medium block py-1">310 592 1767</a>
                    <span className="block mt-2 text-gray-500">
                      Horario de atención: Lunes a Viernes 9:00 AM - 6:00 PM<br />
                      Sábados: 9:00 AM - 5:00 PM
                    </span>
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 md:space-x-4 p-3 md:p-4 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg">
                  <FaEnvelope className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2 leading-tight">Email</h3>
                  <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                                    <a href="mailto:info@distrinaranjos.com" className="text-orange-600 hover:text-orange-700 font-medium block py-1 break-all">
                  info@distrinaranjos.com
                </a>
                    <span className="block mt-2 text-gray-500">
                      Atención al cliente en horario de atención
                    </span>
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl md:rounded-2xl p-6 md:p-8 text-white shadow-xl">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-bold mb-4 md:mb-6 leading-tight">Síguenos en Redes Sociales</h3>
              <p className="mb-6 md:mb-8 text-base md:text-lg leading-relaxed text-orange-50">
                Mantente conectado con nosotros para conocer las últimas novedades, 
                ofertas especiales y nuevos productos.
              </p>
              <div className="flex space-x-4 md:space-x-6">
                <a 
                  href="https://www.instagram.com/mareedistrinaranjos?igsh=emd6Znh4aWp4dXEx" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 p-4 md:p-5 rounded-full hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-110 shadow-lg"
                  aria-label="Síguenos en Instagram"
                >
                  <FaInstagram className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </a>
                <a 
                  href="https://www.facebook.com/share/1YkqXbTM78/?mibextid=wwXIfr" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-blue-600 p-4 md:p-5 rounded-full hover:bg-blue-700 transition-all duration-200 transform hover:scale-110 shadow-lg"
                  aria-label="Síguenos en Facebook"
                >
                  <FaFacebook className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-16 px-4 md:px-16 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4 md:mb-6 font-contrail-one leading-tight">
            ¿Listo para descubrir nuestros productos?
          </h2>
          <p className="text-base md:text-lg lg:text-xl text-orange-100 mb-6 md:mb-8 px-4 md:px-0 leading-relaxed">
            Explora nuestro catálogo completo y encuentra el producto perfecto para ti.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
            <Link 
              href="/catalogo" 
              className="bg-white text-orange-600 px-6 md:px-8 py-2 md:py-3 rounded-lg font-semibold hover:bg-orange-50 transition-colors duration-200 text-sm md:text-base"
            >
              Ver Catálogo
            </Link>
            <Link 
              href="/contacto" 
              className="border-2 border-white text-white px-6 md:px-8 py-2 md:py-3 rounded-lg font-semibold hover:bg-white hover:text-orange-600 transition-colors duration-200 text-sm md:text-base"
            >
              Contactar
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
} 