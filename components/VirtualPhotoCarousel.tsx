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
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  // Preload images function
  const preloadImage = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (loadedImages.has(src)) {
        resolve();
        return;
      }
      
      const img = new window.Image();
      img.onload = () => {
        setLoadedImages(prev => new Set(prev).add(src));
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
        resolve(); // Resolve anyway to not block the carousel
      };
      img.src = src;
    });
  };

  // Preload all images when virtualPhotos change
  useEffect(() => {
    if (virtualPhotos.length > 0) {
      const preloadAllImages = async () => {
        const preloadPromises = virtualPhotos.map(photo => preloadImage(photo));
        await Promise.all(preloadPromises);
        console.log('✅ All carousel images preloaded');
      };
      
      preloadAllImages();
    }
  }, [virtualPhotos]);

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
    const intervalId = setInterval(loadVirtualPhotos, 300000);
    return () => clearInterval(intervalId);
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

  // Auto-play functionality - only start when images are loaded
  useEffect(() => {
    if (!autoPlay || isPaused || isLoading || virtualPhotos.length === 0) return;

    // Wait for current image to be loaded before starting auto-play
    const currentPhoto = virtualPhotos[currentIndex];
    if (!loadedImages.has(currentPhoto)) {
      return;
    }

    autoPlayRef.current = setInterval(() => {
      nextSlide();
    }, interval);

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [autoPlay, interval, isPaused, virtualPhotos.length, isLoading, currentIndex, loadedImages]);

  // Pause auto-play on hover (desktop) and touch (mobile)
  const handleMouseEnter = () => setIsPaused(true);
  const handleMouseLeave = () => setIsPaused(false);

  // Don't render until images are loaded
  if (isLoading || virtualPhotos.length === 0) {
    return (
      <div className={`relative w-full h-[32rem] xl:h-[36rem] bg-gray-100 rounded-lg flex items-center justify-center ${className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Get current photo and ensure it's loaded
  const currentPhoto = virtualPhotos[currentIndex];
  const isCurrentImageLoaded = loadedImages.has(currentPhoto);

  // Carousel content data
  const carouselContent = [
    {
      title: "Ofertas Especiales",
      subtitle: "Hasta 30% de descuento en productos seleccionados",
      cta: "Ver Ofertas",
      link: "/categoria/promocion"
    },
    {
      title: "Nuevos Productos",
      subtitle: "Descubre nuestra última colección de morrales",
      cta: "Explorar",
      link: "/categoria/nuevos"
    },
    {
      title: "Productos Populares",
      subtitle: "Los más elegidos por nuestros clientes",
      cta: "Ver Todos",
      link: "/categoria/popular"
    }
  ];

  const currentSlide = carouselContent[currentIndex] || carouselContent[0];

  return (
    <div 
      className={`relative w-full h-[32rem] xl:h-[36rem] overflow-hidden rounded-lg ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background with gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Main content container */}
      <div className="relative z-10 h-full flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center h-full">
            {/* Text Content */}
            <div className="order-1 lg:order-1 flex flex-col justify-center space-y-6">
              <div className="space-y-4">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold text-white leading-tight">
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
                {isCurrentImageLoaded ? (
                  <Image
                    src={currentPhoto}
                    alt={currentSlide.title}
                    fill
                    className="object-contain transition-opacity duration-300"
                    priority={currentIndex === 0}
                    sizes="50vw"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                )}
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
