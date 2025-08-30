"use client";
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import { fetchWebPhotos } from '@/lib/databaseService';
import { cacheBuster } from '@/lib/cacheBuster';

interface VirtualPhotoCarouselProps {
  autoPlay?: boolean;
  interval?: number;
  showArrows?: boolean;
  showDots?: boolean;
  className?: string;
}

const VirtualPhotoCarousel: React.FC<VirtualPhotoCarouselProps> = ({
  autoPlay = true,
  interval = 5000,
  showArrows = true,
  showDots = true,
  className = ""
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [virtualPhotos, setVirtualPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Load photos from virtual database
  useEffect(() => {
    const loadVirtualPhotos = async () => {
      try {
        setIsLoading(true);
        
        // Try to load WebPhotos, but don't fail if it doesn't work
        let webPhotos: Record<string, string> = {};
        try {
          webPhotos = await fetchWebPhotos('virtual');
          console.log('🖼️ VirtualPhotoCarousel - WebPhotos received:', webPhotos);
          console.log('🔍 VirtualPhotoCarousel - Available keys:', Object.keys(webPhotos));
        } catch (webPhotosError) {
          console.warn('VirtualPhotoCarousel - Failed to load WebPhotos, using fallback:', webPhotosError);
          webPhotos = {};
        }
        
        console.log('🎯 VirtualPhotoCarousel - Looking for:', ['producto_promocion1', 'producto_nuevo1', 'producto_popular1']);
        
        const addCacheBuster = (url: string) => {
          if (url === '/placeholder-product.svg') return url;
          return cacheBuster.bustCache(url);
        };
        
        const newVirtualPhotos = [
          addCacheBuster(webPhotos['producto_promocion1'] || '/placeholder-product.svg'),
          addCacheBuster(webPhotos['producto_nuevo1'] || '/placeholder-product.svg'),
          addCacheBuster(webPhotos['producto_popular1'] || '/placeholder-product.svg'),
        ];
        
        console.log('📸 VirtualPhotoCarousel - Final photos:', newVirtualPhotos);
        setVirtualPhotos(newVirtualPhotos);
      } catch (error) {
        console.error('Error loading virtual photos:', error);
        setVirtualPhotos([
          '/placeholder-product.svg',
          '/placeholder-product.svg',
          '/placeholder-product.svg',
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    loadVirtualPhotos();
    
    // Listen for sync completion events to refresh photos
    const handleSyncComplete = () => {
      console.log('🔄 VirtualPhotoCarousel - Sync completion detected, refreshing photos...');
      loadVirtualPhotos();
    };
    
    // Listen for virtual sync completion events
    window.addEventListener('virtual-sync-complete', handleSyncComplete);
    
    // Also listen for a custom WebPhotos sync event
    window.addEventListener('webphotos-sync-complete', handleSyncComplete);
    
    const intervalId = setInterval(loadVirtualPhotos, 300000);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('virtual-sync-complete', handleSyncComplete);
      window.removeEventListener('webphotos-sync-complete', handleSyncComplete);
    };
  }, []);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % virtualPhotos.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + virtualPhotos.length) % virtualPhotos.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  // Debug function to manually refresh photos
  const refreshPhotos = async () => {
    console.log('🔄 VirtualPhotoCarousel - Manual refresh triggered');
    setIsLoading(true);
    try {
      const webPhotos = await fetchWebPhotos('virtual');
      console.log('🖼️ VirtualPhotoCarousel - Manual refresh - WebPhotos received:', webPhotos);
      
      const addCacheBuster = (url: string) => {
        if (url === '/placeholder-product.svg') return url;
        return cacheBuster.bustCache(url);
      };
      
      const newVirtualPhotos = [
        addCacheBuster(webPhotos['producto_promocion1'] || '/placeholder-product.svg'),
        addCacheBuster(webPhotos['producto_nuevo1'] || '/placeholder-product.svg'),
        addCacheBuster(webPhotos['producto_popular1'] || '/placeholder-product.svg'),
      ];
      
      console.log('📸 VirtualPhotoCarousel - Manual refresh - Final photos:', newVirtualPhotos);
      setVirtualPhotos(newVirtualPhotos);
    } catch (error) {
      console.error('Error in manual refresh:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose refresh function globally for debugging
  useEffect(() => {
    (window as any).refreshVirtualPhotoCarousel = refreshPhotos;
    return () => {
      delete (window as any).refreshVirtualPhotoCarousel;
    };
  }, []);

  // Debug mode toggle with keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ctrl+Shift+D to toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        setDebugMode(prev => !prev);
        console.log('🔄 VirtualPhotoCarousel - Debug mode toggled:', !debugMode);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [debugMode]);

  // Touch handlers for mobile swipe
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      nextSlide();
    }
    if (isRightSwipe) {
      prevSlide();
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || isPaused || isLoading) return;

    autoPlayRef.current = setInterval(() => {
      nextSlide();
    }, interval);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [autoPlay, interval, isPaused, virtualPhotos.length, isLoading]);

  // Pause auto-play on hover (desktop) and touch (mobile)
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);
  const handleTouchStart = () => setIsPaused(true);
  const handleTouchEnd = () => {
    // Resume auto-play after a short delay on mobile
    setTimeout(() => setIsPaused(false), 2000);
  };

  if (isLoading) {
    return (
      <div className={`relative w-full overflow-hidden ${className}`}>
        <div className="relative w-full h-[250px] sm:h-[300px] md:h-[400px] lg:h-[500px] bg-gray-100 animate-pulse">
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm sm:text-base">Cargando...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!virtualPhotos || virtualPhotos.length === 0) {
    return null;
  }

  const currentPhoto = virtualPhotos[currentIndex];

  const slideContent = [
    {
      title: "Ofertas Especiales",
      subtitle: "Hasta 30% de descuento en productos seleccionados",
      cta: "Ver Ofertas",
      link: "/categoria/promocion",
      bgGradient: "from-orange-500 to-red-500"
    },
    {
      title: "Nuevos Productos",
      subtitle: "Descubre las últimas tendencias del mercado",
      cta: "Explorar",
      link: "/categoria/nuevo",
      bgGradient: "from-blue-600 to-purple-600"
    },
    {
      title: "Más Vendidos",
      subtitle: "Los favoritos de nuestros clientes",
      cta: "Ver Todos",
      link: "/categoria/popular",
      bgGradient: "from-green-600 to-teal-600"
    }
  ];

  const currentSlide = slideContent[currentIndex];

  return (
    <div 
      className={`relative w-full overflow-hidden ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Debug Button - Only visible in debug mode */}
      {debugMode && (
        <div className="absolute top-2 right-2 z-50 space-y-2">
          <button
            onClick={refreshPhotos}
            className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold shadow-lg block w-full"
            title="Refresh Photos (Debug)"
          >
            🔄 Refresh
          </button>
          <div className="bg-black bg-opacity-75 text-white p-2 rounded text-xs max-w-xs">
            <div className="font-bold mb-1">Debug Info:</div>
            <div>Photos loaded: {virtualPhotos.length}</div>
            <div>Current index: {currentIndex}</div>
            <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
            <div className="mt-1">
              {virtualPhotos.map((photo, idx) => (
                <div key={idx} className="truncate">
                  {idx + 1}: {photo.includes('placeholder') ? 'Placeholder' : 'Photo'}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
        {/* Main Carousel Container */}
        <div 
          className="relative w-full h-[300px] sm:h-[350px] md:h-[450px] lg:h-[550px]"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Background Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-r ${currentSlide.bgGradient} transition-all duration-300 ease-in-out`}></div>
          
          {/* Content Container */}
          <div className="relative z-10 w-full h-full">
            {/* Mobile Layout - Enhanced for better mobile experience */}
            <div className="lg:hidden w-full h-full relative">
              {/* Text Content - Top Right with better mobile spacing */}
              <div className="absolute top-10 sm:top-10 right-10 sm:right-10 z-20 text-white text-right max-w-[180px] sm:max-w-[220px] md:max-w-[250px]">
                <div className="space-y-2 sm:space-y-3">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold leading-tight tracking-wider drop-shadow-xl text-white font-serif">
                    {currentSlide.title}
                  </h2>
                  <p className="text-sm sm:text-base text-white/90 leading-relaxed font-medium drop-shadow-lg font-sans">
                    {currentSlide.subtitle === "Hasta 30% de descuento en productos seleccionados" && (
                      <>Hasta <span className="font-bold">30%</span> de descuento<br />en productos seleccionados</>
                    )}
                    {currentSlide.subtitle === "Descubre las últimas tendencias del mercado" && (
                      <>Descubre las últimas<br />tendencias del mercado</>
                    )}
                    {currentSlide.subtitle === "Los favoritos de nuestros clientes" && (
                      <>Los favoritos de<br />nuestros clientes</>
                    )}
                    {!["Hasta 30% de descuento en productos seleccionados", "Descubre las últimas tendencias del mercado", "Los favoritos de nuestros clientes"].includes(currentSlide.subtitle) && (
                      currentSlide.subtitle
                    )}
                  </p>
                </div>
              </div>
              
                            {/* Button - Right bottom on mobile */}
              <Link 
                href={currentSlide.link}
                className={`absolute bottom-3 right-3 sm:relative sm:bottom-auto sm:right-auto sm:inline-flex sm:items-center text-white px-3 py-2 sm:px-4 sm:py-2 md:px-6 md:py-2.5 rounded-full font-bold text-xs sm:text-sm transition-all duration-300 transform hover:scale-110 hover:shadow-2xl shadow-lg sm:mt-3 touch-manipulation z-50 border-2 border-white/20 backdrop-blur-sm ${
                  currentSlide.title === "Ofertas Especiales" 
                    ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" 
                    : currentSlide.title === "Nuevos Productos"
                    ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    : "bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                }`}
              >
                  {currentSlide.cta}
                </Link>
              
              {/* Image - Left side on mobile, centered on larger screens */}
              <div className="absolute -left-24 sm:left-4 top-1/2 transform -translate-y-1/2 sm:relative sm:top-auto sm:transform-none sm:flex sm:items-center sm:justify-center w-full sm:w-auto">
                <div className="relative w-full max-w-[140px] sm:max-w-[240px] md:max-w-[280px] h-66 sm:h-80 md:h-96">
                  <Image
                    src={currentPhoto}
                    alt={currentSlide.title}
                    fill
                    className="object-contain"
                    priority={currentIndex === 0}
                    sizes="(max-width: 640px) 75vw, (max-width: 768px) 65vw, (max-width: 1024px) 50vw"
                    style={{ 
                      objectPosition: 'center',
                      maxWidth: '100%',
                      maxHeight: '100%'
                    }}
                  />
                </div>
              </div>
            </div>
            
            {/* Desktop Layout - Original grid */}
            <div className="hidden lg:flex items-center w-full h-full">
              <div className="container mx-auto px-8 lg:px-16">
                <div className="grid grid-cols-2 gap-12 items-center">
                  
                  {/* Text Content */}
                  <div className="text-white space-y-6 order-1">
                    <div className="space-y-4">
                      <h2 className="text-4xl lg:text-5xl xl:text-6xl font-bold leading-tight">
                        {currentSlide.title}
                      </h2>
                      <p className="text-lg lg:text-xl text-white/90 leading-relaxed max-w-md">
                        {currentSlide.subtitle === "Hasta 30% de descuento en productos seleccionados" ? (
                          <>Hasta <span className="font-bold">30%</span> de descuento en productos seleccionados</>
                        ) : (
                          currentSlide.subtitle
                        )}
                      </p>
                    </div>
                    
                    <Link 
                      href={currentSlide.link}
                      className={`inline-flex items-center text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all duration-300 transform hover:scale-110 hover:shadow-2xl shadow-lg touch-manipulation border-2 border-white/20 backdrop-blur-sm ${
                        currentSlide.title === "Ofertas Especiales" 
                          ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600" 
                          : currentSlide.title === "Nuevos Productos"
                          ? "bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                          : "bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
                      }`}
                    >
                      {currentSlide.cta}
                      <IoChevronForward className="ml-1.5 text-sm" />
                    </Link>
                  </div>
                  
                  {/* Image */}
                  <div className="order-2 flex justify-end">
                    <div className="relative w-full max-w-3xl xl:max-w-4xl h-[32rem] xl:h-[36rem]">
                      <Image
                        src={currentPhoto}
                        alt={currentSlide.title}
                        fill
                        className="object-contain"
                        priority={currentIndex === 0}
                        sizes="50vw"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows - Enhanced for mobile */}
          {showArrows && virtualPhotos.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-1 sm:left-2 md:left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/50 active:bg-white/60 transition-all duration-300 z-20 touch-manipulation"
                aria-label="Previous slide"
              >
                <IoChevronBack className="text-sm sm:text-lg md:text-xl lg:text-2xl" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-1 sm:right-2 md:right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/50 active:bg-white/60 transition-all duration-300 z-20 touch-manipulation"
                aria-label="Next slide"
              >
                <IoChevronForward className="text-sm sm:text-lg md:text-xl lg:text-2xl" />
              </button>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {autoPlay && virtualPhotos.length > 1 && (
          <div className="absolute bottom-0 left-0 w-full h-0.5 sm:h-1 bg-white/20 z-20">
            <div 
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{
                width: `${((currentIndex + 1) / virtualPhotos.length) * 100}%`
              }}
            />
          </div>
        )}

        {/* Dots Navigation - Enhanced for mobile */}
        {showDots && virtualPhotos.length > 1 && (
          <div className="absolute bottom-1.5 sm:bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 z-30 flex space-x-1 sm:space-x-1.5 md:space-x-2">
            {virtualPhotos.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 rounded-full transition-all duration-300 touch-manipulation ${
                  index === currentIndex 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/75 active:bg-white/90'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        )}
    </div>
  );
};

export default VirtualPhotoCarousel;
