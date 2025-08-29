"use client";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { fetchProductsFromDatabase, fetchWebPhotos } from "@/lib/databaseService";
import { FaChevronLeft, FaChevronRight, FaChevronDown, FaChevronUp, FaUser } from "react-icons/fa";

import { useRouter } from "next/navigation";
import React from 'react';
import ProductModal from '@/components/ProductModal';
import ProductCard from '@/components/ProductCard';
import VirtualPhotoCarousel from '@/components/VirtualPhotoCarousel';
import { cacheBuster } from '@/lib/cacheBuster';

// Auto-rotating product card component for carousel sections
function AutoRotatingProductCard({ product, className, ...props }: any) {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const stableProductRef = React.useRef(product);
  
  // Get all images for this product
  const productImages = React.useMemo(() => {
    const images = [];
    
    // Add main imageURL(s)
    if (product.imageURL) {
      if (Array.isArray(product.imageURL)) {
        images.push(...product.imageURL);
      } else {
        images.push(product.imageURL);
      }
    }
    
    // Add fallback image if available
    if (product.image && !images.includes(product.image)) {
      images.push(product.image);
    }
    
    // Filter out empty/null images and remove duplicates
    return [...new Set(images.filter(img => img && img.trim() !== ''))];
  }, [product]);

  // Auto-rotate images every 3 seconds, but pause when modals are open
  React.useEffect(() => {
    if (productImages.length <= 1) return;
    
    const interval = setInterval(() => {
      // Check if any modal is currently open
      const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
      
      // Only rotate if no modal is open
      if (!modalOpen) {
        setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
      }
    }, 3000);
    
    return () => clearInterval(interval);
  }, [productImages.length]);

  // Update stable ref only when base product changes
  React.useEffect(() => {
    stableProductRef.current = product;
  }, [product.id]); // Only update when product ID changes, not when product object reference changes

  // Create a modified product object with the current rotating image
  // Preserve the original imageURL array for ProductModal while showing current image for ProductCard
  const modifiedProduct = React.useMemo(() => ({
    ...stableProductRef.current,
    // Keep original imageURL array for ProductModal thumbnails
    imageURL: stableProductRef.current.imageURL,
    // Set current rotating image for ProductCard display
    currentDisplayImage: productImages[currentImageIndex] || stableProductRef.current.imageURL,
    image: productImages[currentImageIndex] || stableProductRef.current.image
  }), [productImages, currentImageIndex]);

  return (
    <div className="relative">
      {/* Container with custom CSS for badge positioning */}
      <div className="carousel-product-wrapper">
        <ProductCard 
          key={product.id} // Stable key to prevent remounting
          product={modifiedProduct}
          className={className}
          {...props}
        />
      </div>
      
      {/* Small indicator dots if multiple images - positioned at bottom left */}
      {productImages.length > 1 && (
        <div className="absolute bottom-1 left-1 flex space-x-1 z-20">
          {productImages.map((_, index) => (
            <div
              key={index}
              className={`w-1 h-1 rounded-full transition-all duration-200 ${
                index === currentImageIndex ? 'bg-blue-600' : 'bg-white/60 border border-gray-300'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Global styles for carousel product cards */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .carousel-product-wrapper .absolute.top-3.right-3 {
            top: 0px !important;
            right: 0px !important;
          }
          /* Ensure consistent styling for all carousel product cards */
          .carousel-product-wrapper .bg-white {
            border-radius: 0.75rem;
          }
        `
      }} />
    </div>
  );
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
} 

// Custom hook for fade+slide in on scroll (continuous)
function useFadeSlideInOnView(threshold = 0.01): [React.RefObject<HTMLDivElement>, boolean] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new window.IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);
  return [ref, inView];
}

export default function HomePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDesc, setActiveDesc] = useState<string>("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselInterval = useRef<NodeJS.Timeout | null>(null);
  const [manualPause, setManualPause] = useState(false);
  const manualPauseTimeout = useRef<NodeJS.Timeout | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [brandsOpen, setBrandsOpen] = useState(true);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const router = useRouter();
  const [brands, setBrands] = useState<string[]>([]);
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  const [isClient, setIsClient] = useState(false);
  const [shippingThreshold, setShippingThreshold] = useState(200000);


  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  // Debug cart on page load
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      
    }
  }, []);

  // Fetch shipping configuration
  useEffect(() => {
    const fetchShippingConfig = async () => {
      try {
        const response = await fetch('/api/shipping-config');
        if (response.ok) {
          const config = await response.json();
          setShippingThreshold(config.freeShippingThreshold);
        }
      } catch (error) {
        console.error('Error fetching shipping config:', error);
      }
    };

    fetchShippingConfig();
  }, []);



  // Model carousel state
  const [modelCarouselIndex, setModelCarouselIndex] = useState(0);
  const modelCarouselInterval = useRef<NodeJS.Timeout | null>(null);

  // Model carousel images - Dynamic from webphotos
  const [modelImages, setModelImages] = useState<string[]>([
    '/images/webphotos/modelo_massnu_1754165116821.png',
    '/images/webphotos/modelo_reno_1754165118095.png',
    '/images/webphotos/modelo_najos_1754165117387.png'
  ]);

  // Main page photos - Dynamic from webphotos
  const [featurePhoto1, setFeaturePhoto1] = useState<string | null>(null);
  const [featurePhoto2, setFeaturePhoto2] = useState<string>('/images/webphotos/modelo_inicio2_1754165115800.png');
  const [featurePhoto3, setFeaturePhoto3] = useState<string>('/images/webphotos/modelo_inicio2_1754165115800.png');
  const [heroPhotos, setHeroPhotos] = useState<string[]>([]);
  const [currentHeroPhotoIndex, setCurrentHeroPhotoIndex] = useState(0);
  
  // Carousel photos array - will be populated dynamically from virtual database
  const [carouselPhotos, setCarouselPhotos] = useState<string[]>([
    '/images/webphotos/modelo_inicio1_1754539922037.jpg',
    '/images/webphotos/modelo_inicio2_1754539922723.png',
    '/images/webphotos/chicas_inicio3_1754539923523.png',
    '/images/webphotos/modelo_massnu_1754539924208.png',
    '/images/webphotos/modelo_najos_1754539924893.png',
    '/images/webphotos/modelo_reno_1754539925623.png'
  ]);
  const [popularProducts, setPopularProducts] = useState<any[]>([]);
  const [productPhotoIndices, setProductPhotoIndices] = useState<{ [key: number]: number }>({});

  // Auto-advance model carousel
  useEffect(() => {
    if (modelCarouselInterval.current) clearInterval(modelCarouselInterval.current);
    modelCarouselInterval.current = setInterval(() => {
      setModelCarouselIndex((prev) => (prev + 1) % modelImages.length);
    }, 5000); // Change every 5 seconds
    return () => {
      if (modelCarouselInterval.current) clearInterval(modelCarouselInterval.current);
    };
  }, [modelImages.length]);

  // Auto-advance hero photos carousel
  useEffect(() => {
    if (heroPhotos.length > 1) {
      const heroCarouselInterval = setInterval(() => {
        setCurrentHeroPhotoIndex((prev) => (prev + 1) % heroPhotos.length);
      }, 4000); // Change every 4 seconds
      return () => clearInterval(heroCarouselInterval);
    }
  }, [heroPhotos.length]);

  // Auto-advance popular product photos
  useEffect(() => {
    const productPhotoInterval = setInterval(() => {
      setProductPhotoIndices(prev => {
        const newIndices = { ...prev };
        popularProducts.forEach((product, index) => {
          if (product.imageURL && product.imageURL.length > 1) {
            newIndices[index] = ((prev[index] || 0) + 1) % product.imageURL.length;
          }
        });
        return newIndices;
      });
    }, 3000);

    return () => clearInterval(productPhotoInterval);
  }, [popularProducts]);

  // Load dynamic photos from webphotos
  useEffect(() => {
    const loadDynamicPhotos = async () => {
      try {
        // Try to load WebPhotos, but don't fail if it doesn't work
        let photos: Record<string, string> = {};
        try {
          photos = await fetchWebPhotos('virtual'); // Use virtual environment for main page
          console.log('🏠 MainPage - WebPhotos received:', photos);
          console.log('🔍 MainPage - Available keys:', Object.keys(photos));
        } catch (webPhotosError) {
          console.warn('MainPage - Failed to load WebPhotos, using fallback:', webPhotosError);
          photos = {};
        }
        
        // Update carousel photos with better fallback handling and cache busting
        const newModelImages = [
          cacheBuster.bustCache(photos['producto_promocion1'] || '/images/webphotos/modelo_massnu_1754165116821.png'),
          cacheBuster.bustCache(photos['producto_nuevo1'] || '/images/webphotos/modelo_reno_1754165118095.png'),
          cacheBuster.bustCache(photos['producto_popular1'] || '/images/webphotos/modelo_najos_1754165117387.png')
        ];
        
        // Only set modelImages if we have at least one valid image
        if (newModelImages.some(img => img && img.trim() !== '')) {
          setModelImages(newModelImages);
        } else {
          // Fallback to static images if no dynamic images are available
          setModelImages([
            cacheBuster.bustCache('/images/webphotos/modelo_massnu_1754165116821.png'),
            cacheBuster.bustCache('/images/webphotos/modelo_reno_1754165118095.png'),
            cacheBuster.bustCache('/images/webphotos/modelo_najos_1754165117387.png')
          ]);
        }
        
        // Update feature photo 2 from webphotos (keep feature photo 1 for product-based logic)
        setFeaturePhoto2(cacheBuster.bustCache(photos['producto_popular2'] || '/images/webphotos/chicas_inicio3_1754165115800.png'));
        // Update feature photo 3 for "Calidad y estilo" section
        setFeaturePhoto3(cacheBuster.bustCache(photos['producto_nuevo2'] || '/images/webphotos/modelo_inicio2_1754165115800.png'));
        
        // Update carousel photos from virtual database with cache busting
        const newCarouselPhotos = [
          cacheBuster.bustCache(photos['producto_promocion1'] || '/images/webphotos/modelo_inicio1_1754539922037.jpg'),
          cacheBuster.bustCache(photos['producto_nuevo1'] || '/images/webphotos/modelo_inicio2_1754539922723.png'),
          cacheBuster.bustCache(photos['producto_popular1'] || '/images/webphotos/chicas_inicio3_1754539923523.png'),
          cacheBuster.bustCache(photos['producto_promocion2'] || '/images/webphotos/modelo_massnu_1754539924208.png'),
          cacheBuster.bustCache(photos['producto_deportivo1'] || '/images/webphotos/modelo_najos_1754539924893.png'),
          cacheBuster.bustCache(photos['producto_deportivo2'] || '/images/webphotos/modelo_reno_1754539925623.png')
        ];
        
        setCarouselPhotos(newCarouselPhotos);
        
        // Update hero photos with cache busting
        const newHeroPhotos = [
          cacheBuster.bustCache(photos['producto_promocion1'] || '/images/webphotos/modelo_inicio1_1754539922037.jpg'),
          cacheBuster.bustCache(photos['producto_nuevo1'] || '/images/webphotos/modelo_inicio2_1754539922723.png'),
          cacheBuster.bustCache(photos['producto_popular1'] || '/images/webphotos/chicas_inicio3_1754539923523.png')
        ];
        
        setHeroPhotos(newHeroPhotos);
        
        // Store almacen photo for use in "Nuestras Instalaciones" section
        setWebPhotos(photos);
        
        console.log('🖼️ Dynamic photos loaded with cache busting');
        console.log('🔄 Cache buster timestamp:', new Date(cacheBuster.getSyncTimestamp()).toISOString());
      } catch (error) {
        console.error('Error loading dynamic photos:', error);
      }
    };

    loadDynamicPhotos();
  }, []);



  // Function to get the first alphabetical type
  const getFirstAlphabeticalType = () => {
    if (products.length === 0) return 'Morral'; // fallback
    
    // Get all unique types
    const allTypes = products.flatMap((p: any) => {
      if (Array.isArray(p.type)) return p.type;
      if (typeof p.type === 'string' && p.type.trim()) return [p.type];
      return [];
    });
    
    const uniqueTypes = Array.from(new Set(allTypes.map(t => t.trim()).filter(Boolean)));
    
    // Sort alphabetically and return the first one
    const sortedTypes = uniqueTypes.sort((a, b) => 
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    
    return sortedTypes.length > 0 ? sortedTypes[0] : 'Morral';
  };

  // Function to get the first alphabetical category
  const getFirstAlphabeticalCategory = () => {
    if (products.length === 0) return 'Morrales de Carga'; // fallback
    
    // Get all unique categories
    const allCategories = products.flatMap((p: any) => {
      if (Array.isArray(p.category)) return p.category;
      if (typeof p.category === 'string' && p.category.trim()) return [p.category];
      return [];
    });
    
    const uniqueCategories = Array.from(new Set(allCategories.map(c => c.trim()).filter(Boolean)));
    
    // Sort alphabetically and return the first one
    const sortedCategories = uniqueCategories.sort((a, b) => 
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
    
    return sortedCategories.length > 0 ? sortedCategories[0] : 'Morrales de Carga';
  };

  // Visitor stats state
  const [visitorStats, setVisitorStats] = useState<{ week: number; month: number; year: number } | null>(null);


  // Feature section animation refs (type-safe)
  const [imgRef1, imgInView1] = useFadeSlideInOnView(0.05); // Marcas
  const [textRef1, textInView1] = useFadeSlideInOnView(0.05); // Marcas
  const [imgRef2, imgInView2] = useFadeSlideInOnView(0.05); // Tipos
  const [textRef2, textInView2] = useFadeSlideInOnView(0.05); // Tipos
  const [imgRef3, imgInView3] = useFadeSlideInOnView(0.05); // Categorias
  const [textRef3, textInView3] = useFadeSlideInOnView(0.05); // Categorias
  const [imgRef4, imgInView4] = useFadeSlideInOnView(0.05); // Calidad y estilo
  const [textRef4, textInView4] = useFadeSlideInOnView(0.05); // Calidad y estilo
  const [imgRef5, imgInView5] = useFadeSlideInOnView(0.05); // Comodidad y durabilidad
  const [textRef5, textInView5] = useFadeSlideInOnView(0.05); // Comodidad y durabilidad

  useEffect(() => {
    // Load products and web photos in parallel for faster loading
    const loadData = async () => {
      try {
        const [productsData, webPhotosData] = await Promise.all([
          fetchProductsFromDatabase('virtual'), // Use virtual environment for main page
          fetchWebPhotos('virtual') // Use virtual environment for main page
        ]);
        

        
        setProducts(productsData);
        setWebPhotos(webPhotosData);
        
        // Find all Popular products and combine their photos
        const popularProducts = productsData.filter(product => 
          product.category && 
          (Array.isArray(product.category) 
            ? product.category.some(cat => cat.toLowerCase() === 'popular')
            : product.category.toLowerCase() === 'popular'
          )
        );
        
        // Store popular products in state for the hero section
        setPopularProducts(popularProducts);
        
        if (popularProducts.length > 0) {
          // Combine all photos from all Popular products
          const allPopularPhotos = popularProducts.flatMap(product => 
            product.imageURL && Array.isArray(product.imageURL) ? product.imageURL : []
          );
          
          if (allPopularPhotos.length > 0) {
            setHeroPhotos(allPopularPhotos);
            setFeaturePhoto1(allPopularPhotos[0]);
    
          }
        }
        
        setBrands(() => {
          const uniqueBrands = Array.from(new Set(productsData.map((p: any) => (p.brand || "").trim())));
          const massnuIndex = uniqueBrands.findIndex((b: string) => b.toLowerCase() === 'massnu');
          if (massnuIndex > 0) {
            const [massnu] = uniqueBrands.splice(massnuIndex, 1);
            uniqueBrands.unshift(massnu);
          }
          return uniqueBrands;
        });
        
        // Set default active description
        const descs = Array.from(new Set(productsData.map((p: any) => p.type).filter(Boolean)));
        if (descs.length > 0) setActiveDesc(descs[0]);
        
        setLoading(false);
      } catch (err: any) {
        console.warn('Failed to fetch data:', err);
        setError("Error al cargar datos.");
        setLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      if (carouselInterval.current) clearInterval(carouselInterval.current);
    };
  }, []);

  useEffect(() => {
    // Track visit and fetch stats in background (non-blocking)
    const loadBackgroundData = async () => {
      try {
        // Check if tracking is enabled before making the API call
        const trackingResponse = await fetch('/api/tracking-toggle');
        const trackingData = await trackingResponse.json();
        
        // Only track visit if tracking is enabled and we're on client side
        if (trackingData.enabled) {
          try {
            // Simple device tracking without Bowser
            try {
              const deviceInfo = {
                deviceType: 'desktop', // Default to desktop
                os: 'unknown',
                browser: 'unknown',
                language: typeof navigator !== 'undefined' ? navigator.language : 'en',
                screen: {
                  width: typeof window !== 'undefined' ? window.screen.width : 1920,
                  height: typeof window !== 'undefined' ? window.screen.height : 1080,
                },
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
              };
              fetch('/api/track-visit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(deviceInfo),
              }).catch(error => {
                console.warn('Failed to track visit:', error);
              });
            } catch (error) {
              console.warn('Failed to track visit:', error);
            }
          } catch (error) {
            console.warn('Failed to parse browser info:', error);
          }
        } else {
  
        }
        
        // Only fetch stats if tracking is enabled
        if (trackingData.enabled) {
          const res = await fetch('/api/visitor-stats');
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          const contentType = res.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Response is not JSON');
          }
          const stats = await res.json();
          setVisitorStats(stats);
        } else {
  
          setVisitorStats(null);
        }
      } catch (error) {
        console.warn('Failed to fetch visitor stats:', error);
        setVisitorStats(null);
      }
    };
    
    // Load background data after a short delay to not block initial page load
    setTimeout(loadBackgroundData, 100);
  }, []);

  // WebPhotos are now loaded in parallel with products in the main useEffect



  // Simple scroll-based animation system
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    let timeoutId: NodeJS.Timeout;
    const handleScroll = () => {
      // Clear previous timeout to debounce scroll events
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setScrollY(window.scrollY);
      }, 100); // Increased delay to reduce frequency
    };
    
    // Add event listener after component mounts
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  // Calculate animation states based on scroll position - works for both directions
  const getAnimationState = (elementRef: React.RefObject<HTMLDivElement>, offset = 0) => {
    if (!elementRef.current || typeof window === 'undefined') return false;
    const rect = elementRef.current.getBoundingClientRect();
    const elementTop = rect.top + offset;
    const elementBottom = rect.bottom + offset;
    
    // Element is animated when it's in the center portion of the viewport
    const viewportCenter = window.innerHeight * 0.5;
    const elementCenter = rect.top + rect.height * 0.5;
    
    // Animate when element center is in the viewport center area
    return elementCenter > 0 && elementCenter < window.innerHeight;
  };

  const img1Animated = getAnimationState(imgRef1);
  const text1Animated = getAnimationState(textRef1);
  const img2Animated = getAnimationState(imgRef2);
  const text2Animated = getAnimationState(textRef2);
  const img3Animated = getAnimationState(imgRef3);
  const text3Animated = getAnimationState(textRef3);

  // Unique product descriptions
  const productDescs = Array.from(new Set(products.map((p: any) => p.type).filter(Boolean)));
  // Products for the active description
  const descProducts = products.filter((p: any) => p.type === activeDesc);
  const activeDescIdx = productDescs.indexOf(activeDesc);

  // Add normalization function
  const normalize = (str: string) =>
    str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .trim()
      .toLowerCase();
  // Extract unique categories (handle string and array, keep original for display, dedupe by normalized value)
  const subCategoriesMap = new Map<string, string>();
  products.forEach((p: any) => {
    if (Array.isArray(p.category)) {
      p.category.forEach((sc: string) => {
        if (sc && sc.trim()) {
          const norm = normalize(sc);
          if (!subCategoriesMap.has(norm)) subCategoriesMap.set(norm, sc.trim());
        }
      });
    } else if (typeof p.category === 'string' && p.category.trim()) {
      const norm = normalize(p.category);
      if (!subCategoriesMap.has(norm)) subCategoriesMap.set(norm, p.category.trim());
    }
  });
  const uniqueSubCategories = Array.from(subCategoriesMap.values());
  const [subCatIndex, setSubCatIndex] = useState(0);
  useEffect(() => {
    if (uniqueSubCategories.length === 0) return;
    const interval = setInterval(() => {
      setSubCatIndex((prev) => (prev + 1) % uniqueSubCategories.length);
    }, 2000); // Change every 2 seconds
    return () => clearInterval(interval);
  }, [uniqueSubCategories.length]);
  const half = Math.ceil(uniqueSubCategories.length / 2);
  const getRotatingSubCats = (start: number, count: number) => {
    return Array.from({ length: count }).map((_, i) => uniqueSubCategories[(subCatIndex + start + i) % uniqueSubCategories.length]);
  };
  const topSubCats = getRotatingSubCats(0, half);
  const bottomSubCats = getRotatingSubCats(half, uniqueSubCategories.length - half);


  // Carousel auto-advance
  useEffect(() => {
    if (descProducts.length <= 5 || manualPause) return;
    if (carouselInterval.current) clearInterval(carouselInterval.current);
    setCarouselIndex(0);
    carouselInterval.current = setInterval(() => {
      setCarouselIndex((prev) => {
        // If at the last visible set, move to next description type
        if (prev + 5 >= descProducts.length) {
          if (productDescs.length > 1) {
            const nextDescIdx = (activeDescIdx + 1) % productDescs.length;
            setActiveDesc(productDescs[nextDescIdx]);
          }
          return 0;
        } else {
          return prev + 1;
        }
      });
    }, 2000);
    return () => {
      if (carouselInterval.current) clearInterval(carouselInterval.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDesc, descProducts.length, productDescs.length, manualPause]);

  // Add an effect to always reset the carouselInterval when manualPause changes to false
  useEffect(() => {
    if (!manualPause && descProducts.length > 5) {
      if (carouselInterval.current) clearInterval(carouselInterval.current);
      carouselInterval.current = setInterval(() => {
        setCarouselIndex((prev) => {
          if (prev + 5 >= descProducts.length) {
            if (productDescs.length > 1) {
              const nextDescIdx = (activeDescIdx + 1) % productDescs.length;
              setActiveDesc(productDescs[nextDescIdx]);
            }
            return 0;
          } else {
            return prev + 1;
          }
        });
      }, 2000);
      return () => {
        if (carouselInterval.current) clearInterval(carouselInterval.current);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualPause, descProducts.length, productDescs.length, activeDescIdx]);

  // useEffect(() => {
  //   if (heroInterval.current) clearInterval(heroInterval.current);
  //   heroInterval.current = setInterval(() => {
  //     setHeroIndex((prev) => (prev + 1) % heroImages.length);
  //   }, 3000);
  //   return () => {
  //     if (heroInterval.current) clearInterval(heroInterval.current);
  //   };
  // }, [heroImages.length]);

  // Sidebar brands
  const currentBrand = null;

  useEffect(() => {
    if (!manualPause) return;
    if (carouselInterval.current) clearInterval(carouselInterval.current);
    // When manualPause ends, auto-sliding will resume via the main carousel effect
  }, [manualPause]);

  const isMobile = useIsMobile();
  const carouselRef = useRef<HTMLDivElement>(null);

  // For auto-slide on mobile
  useEffect(() => {
    if (!isMobile || typeof window === 'undefined') return;
    if (descProducts.length <= 4) return;
    const interval = setInterval(() => {
      if (carouselRef.current) {
        carouselRef.current.scrollBy({ left: 90, behavior: 'smooth' });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isMobile, descProducts.length]);

  // Helper function to normalize URLs
  const normalizeUrl = (url: string | undefined) => {
    if (!url || url.trim() === '') return undefined;
    
    // Fix malformed https:/ URLs (missing slash)
    if (url.startsWith('https:/') && !url.startsWith('https://')) {
      const fixed = url.replace('https:/', 'https://');
      return fixed;
    }
    
    // If URL starts with //, convert to https://
    if (url.startsWith('//')) {
      const normalized = `https://${url.substring(2)}`;
      return normalized;
    }
    // If URL starts with /, it's already a relative URL, return as is
    if (url.startsWith('/')) {
      return url;
    }
    // If URL starts with http:// or https://, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Otherwise, assume it's a relative URL
    return url;
  };

  
  
  // Logos are always loaded since we're using direct paths
  const logosLoaded = true;
  
  // Logos for Marcas card - using simplified file names directly
  const logos = [
    '/images/webphotos/logo_massnu.png',
    '/images/webphotos/logo_reno.png',
    '/images/webphotos/logo_najos.png',
    '/images/webphotos/logo_aj.png',
    '/images/webphotos/logo_tiber.png',
    '/images/webphotos/logo_importado.png',
  ];
  

  
  // Ensure we always have at least one logo and make them unique
  const safeLogos = logos.length > 0 ? logos : ['/placeholder-image.png'];
  
  // Create unique logos array to avoid duplicate keys
  const uniqueLogos = safeLogos.map((logo, index) => ({
    url: logo,
    id: `logo-${index}`
  }));
  const [logoIndex, setLogoIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setLogoIndex((prev) => (prev + 1) % uniqueLogos.length);
    }, 2000); // Change every 2 seconds
    return () => clearInterval(interval);
  }, [uniqueLogos.length]);
  const getRotatingLogos = (start: number, count: number) => {
    return Array.from({ length: count }).map((_, i) => uniqueLogos[(logoIndex + start + i) % uniqueLogos.length]);
  };
  const topLogos = getRotatingLogos(0, 3);
  const bottomLogos = getRotatingLogos(3, 3);

  // For Tipos card, before rendering:
  // Get unique types and pick a random product image for each type
  const [typeImages, setTypeImages] = useState<{ type: string; image: string }[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    const typeToImages: Record<string, string[]> = {};
    products.forEach((p: any) => {
      if (p.type) {
                        const img = p.imageURL?.[0]?.url;
        // Add safety check for valid image URLs
        if (img && typeof img === 'string' && img.trim() !== '' && img.startsWith('/')) {
          if (!typeToImages[p.type]) typeToImages[p.type] = [];
          typeToImages[p.type].push(img);
        }
      }
    });
    // For each type, pick a random image
    const newTypeImages: { type: string; image: string }[] = Object.entries(typeToImages).map(([type, images]) => ({
      type,
      image: images[Math.floor(Math.random() * images.length)]
    }));
    setTypeImages(newTypeImages);
  }, [products]);
  
  const flyingTypeImages = typeImages.slice(0, 6);
  const topTypeImages = flyingTypeImages.slice(0, 3);
  const bottomTypeImages = flyingTypeImages.slice(3, 6);
  // For Categorias card, before rendering:
  // const limitedSubCats = uniqueSubCategories.slice(0, 6);
  // const topSubCats = limitedSubCats.slice(0, 3);
  // const bottomSubCats = limitedSubCats.slice(3, 6);

  // Move colors array to the top of the component if not already there
  const colors = [
    'from-red-400 to-pink-400', 'from-blue-400 to-cyan-400', 'from-green-400 to-lime-400', 'from-yellow-400 to-orange-400',
    'from-pink-400 to-fuchsia-400', 'from-purple-400 to-indigo-400', 'from-orange-400 to-amber-400', 'from-cyan-400 to-emerald-400',
    'from-emerald-400 to-lime-400', 'from-fuchsia-400 to-pink-400', 'from-lime-400 to-green-400', 'from-indigo-400 to-blue-400',
  ];

  // Fix mobile scrolling issues
  useEffect(() => {
    // Ensure proper scrolling behavior on mobile
    document.body.style.overflow = 'auto';
    document.body.style.position = 'relative';
    document.body.style.height = 'auto';
    
    // Remove any conflicting CSS that might cause independent scrolling
    const style = document.createElement('style');
    style.textContent = `
      @media (max-width: 768px) {
        body, html {
          overflow: auto !important;
          position: relative !important;
          height: auto !important;
          -webkit-overflow-scrolling: touch !important;
        }
        .hero-section, .hero-content {
          overflow: visible !important;
          position: relative !important;
          transform: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);



  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50">
      
      {/* Amazon-style Photo Carousel */}
      <section className="pt-0 pb-0">
        <VirtualPhotoCarousel 
          autoPlay={true}
          interval={5000}
          showArrows={true}
          showDots={true}
          className="w-full"
        />
      </section>

      {/* Enhanced Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-4 md:py-16" style={{ overflow: 'visible', position: 'relative' }}>
        {/* Animated Background Elements */}
        <div className="absolute inset-0" style={{ overflow: 'visible', position: 'absolute' }}>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full animate-pulse opacity-30"></div>
          <div className="absolute -bottom-40 -left-40 w-60 h-60 bg-gradient-to-br from-blue-200 to-cyan-200 rounded-full animate-pulse delay-1000 opacity-30"></div>
          <div className="absolute top-1/2 left-1/4 w-40 h-40 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full animate-pulse delay-500 opacity-30"></div>
          <div className="absolute top-1/4 right-1/3 w-32 h-32 bg-gradient-to-br from-cyan-200 to-blue-200 rounded-full animate-pulse delay-700 opacity-20"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 md:px-16" style={{ overflow: 'visible', position: 'relative' }}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center" style={{ overflow: 'visible', position: 'relative' }}>
            {/* Hero Popular Products - AliExpress Style */}
            <div className="relative order-2 lg:order-2 flex justify-center items-center mb-6 lg:mb-0">
              <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-blue-100 rounded-lg p-6 shadow-md border border-gray-200 w-full max-w-lg">
                {/* Header */}
                <div className="relative mb-6">
                  <Link 
                    href="/categoria/popular"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">⭐</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Productos Populares
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Los más elegidos por nuestros clientes
                    </p>
                  </div>
                </div>
                
                {/* Product Carousel */}
                {(() => {
                  const [currentIndex, setCurrentIndex] = React.useState(0);
                  const itemsPerPage = 2;
                  const totalPages = Math.ceil(popularProducts.length / itemsPerPage);
                  
                  const nextSlide = () => {
                    setCurrentIndex((prev) => (prev + 1) % totalPages);
                  };
                  
                  const prevSlide = () => {
                    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                  };
                  
                  const currentProducts = popularProducts.slice(
                    currentIndex * itemsPerPage,
                    (currentIndex + 1) * itemsPerPage
                  );
                  
                  return (
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50"></div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Hero Content */}
            <div className="text-gray-800 space-y-3 md:space-y-4 order-1 lg:order-1 text-center lg:text-left relative z-10" style={{ overflow: 'visible', position: 'relative', willChange: 'auto' }}>
              {/* Enhanced Urgency Banner with Animations - Mobile Friendly */}
              <div className="bg-gradient-to-r from-purple-100 via-pink-100 to-purple-100 backdrop-blur-sm rounded-xl p-2 md:p-4 mb-3 md:mb-4 border-2 border-purple-300 shadow-lg md:shadow-xl hover:shadow-xl md:hover:shadow-2xl transition-all duration-300 md:duration-500 transform hover:scale-102 md:hover:scale-105 animate-pulse md:animate-bounce">
                <div className="flex items-center justify-center space-x-1 md:space-x-3">
                  <span className="text-purple-500 animate-pulse text-base md:text-xl">✨</span>
                  <span className="text-xs md:text-base font-bold text-purple-800 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse text-center">
                    ¡OFERTA ESPECIAL! Envío gratis en compras superiores a {formatCurrency(shippingThreshold)}
                  </span>
                  <span className="text-purple-500 animate-pulse text-base md:text-xl">✨</span>
                </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                {/* Mobile-specific styling */}
                <div className="sm:hidden">
                  <h1 className="text-2xl font-bold leading-tight text-center bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    Descubre la Elegancia
                  </h1>
                  <h2 className="text-xl font-semibold text-center text-gray-800 mt-1">
                    en Cada Detalle
                  </h2>
                </div>
                
                {/* Desktop styling */}
                <div className="hidden sm:block">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold font-contrail-one leading-relaxed text-left tracking-wider">
                    <span className="drop-shadow-sm">Descubre la</span>
                    <span className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mt-2 mb-1 drop-shadow-md">Elegancia</span>
                    <span className="drop-shadow-sm">en Cada Detalle</span>
                  </h1>
                </div>
                
                <p className="text-sm sm:text-lg md:text-xl lg:text-2xl text-gray-600 leading-relaxed font-alkatra px-4 sm:px-0 text-center sm:text-left max-w-2xl mx-auto sm:mx-0">
                  Morrales, bolsos y accesorios de las mejores marcas colombianas. 
                  <strong className="text-purple-600"> Calidad garantizada</strong> que acompaña tu estilo de vida.
                </p>
              </div>
              
              {/* Enhanced Value Propositions with Animations */}
              <div className="grid grid-cols-2 gap-2 md:gap-2 mb-3 md:mb-4">
                <div className="flex items-center space-x-1 md:space-x-1.5 bg-gradient-to-r from-green-50 to-emerald-100 rounded-lg p-2 md:p-2 border border-green-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-pulse">
                  <span className="text-green-600 text-sm md:text-base animate-bounce">✓</span>
                  <span className="text-xs md:text-sm text-green-800 font-bold font-alkatra leading-tight">Garantía 1 año</span>
                </div>
                <div className="flex items-center space-x-1 md:space-x-1.5 bg-gradient-to-r from-blue-50 to-cyan-100 rounded-lg p-2 md:p-2 border border-blue-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-pulse">
                  <span className="text-blue-600 text-sm md:text-base animate-bounce">✓</span>
                  <span className="text-xs md:text-sm text-blue-800 font-bold font-alkatra leading-tight">Envío nacional</span>
                </div>
                <div className="flex items-center space-x-1 md:space-x-1.5 bg-gradient-to-r from-purple-50 to-pink-100 rounded-lg p-2 md:p-2 border border-purple-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-pulse">
                  <span className="text-purple-600 text-sm md:text-base animate-bounce">✓</span>
                  <span className="text-xs md:text-sm text-purple-800 font-bold font-alkatra leading-tight">Pago seguro</span>
                </div>
                <div className="flex items-center space-x-1 md:space-x-1.5 bg-gradient-to-r from-pink-50 to-rose-100 rounded-lg p-2 md:p-2 border border-pink-200 shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 animate-pulse">
                  <span className="text-pink-600 text-sm md:text-base animate-bounce">✓</span>
                  <span className="text-xs md:text-sm text-pink-800 font-bold font-alkatra leading-tight">Atención personalizada</span>
                </div>
              </div>
              

              

              

            </div>
            

          </div>
        </div>
      </section>

      {/* Second Hero Section - Nuevo & Promocion Products */}
      <section className="relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-4 md:py-16" style={{ overflow: 'visible', position: 'relative' }}>
        {/* Animated Background Elements */}
        <div className="absolute inset-0" style={{ overflow: 'visible', position: 'absolute' }}>
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-green-200 to-emerald-200 rounded-full animate-pulse opacity-30"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-gradient-to-br from-teal-200 to-cyan-200 rounded-full animate-pulse delay-1000 opacity-30"></div>
          <div className="absolute top-1/3 left-1/4 w-40 h-40 bg-gradient-to-br from-emerald-200 to-green-200 rounded-full animate-pulse delay-500 opacity-30"></div>
          <div className="absolute top-1/4 right-1/3 w-32 h-32 bg-gradient-to-br from-cyan-200 to-teal-200 rounded-full animate-pulse delay-700 opacity-20"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 md:px-16" style={{ overflow: 'visible', position: 'relative' }}>
          
          {/* Section Header */}
          <div className="text-center mb-4 md:mb-8">
            <div className="flex items-center justify-between mb-2 md:mb-6">
              <div className="flex-1"></div>
              <div className="text-center">
                
                <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-2 md:mb-6 font-contrail-one leading-tight">
                  Lo Último en Tendencias
                </h2>
                <p className="text-xs sm:text-sm md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-2 md:px-0 leading-relaxed">
                  ✨ Explora las novedades que están causando sensación y aprovecha descuentos exclusivos antes que se agoten
                </p>
              </div>
              <div className="flex-1"></div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
            {/* Nuevo Products Section - AliExpress Style */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-emerald-50 to-green-100 rounded-lg p-6 shadow-md border border-gray-200 h-full flex flex-col">
                {/* Header */}
                <div className="relative mb-6">
                  <Link 
                    href="/categoria/nuevo"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded flex-shrink-0">nuevo</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Productos Recién Llegados
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      ¡Sé el primero en tener los diseños más frescos! Morrales y bolsos con las últimas tendencias internacionales
                    </p>
                  </div>
                </div>
                
                {/* Product Carousel */}
                <div className="flex-1">
                {(() => {
                  const nuevoProducts = products.filter((product: any) => 
                    product.category && 
                    (Array.isArray(product.category) 
                      ? product.category.some((cat: string) => cat.toLowerCase().includes('nuevo'))
                      : product.category.toLowerCase().includes('nuevo')
                    )
                  );
                  
                  const [currentIndex, setCurrentIndex] = React.useState(0);
                  const itemsPerPage = 2;
                  const totalPages = Math.ceil(nuevoProducts.length / itemsPerPage);
                  
                  const nextSlide = () => {
                    setCurrentIndex((prev) => (prev + 1) % totalPages);
                  };
                  
                  const prevSlide = () => {
                    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                  };
                  
                  const currentProducts = nuevoProducts.slice(
                    currentIndex * itemsPerPage,
                    (currentIndex + 1) * itemsPerPage
                  );
                  
                  return (
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50"></div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>
            
            {/* Promocion Products Section - AliExpress Style */}
            <div className="relative group">
              <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-lg p-6 shadow-md border border-gray-200 h-full flex flex-col">
                {/* Header */}
                <div className="relative mb-6">
                  <Link 
                    href="/categoria/promocion"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">🔥</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Promociones Imperdibles
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      💰 Ahorra hasta 30% en productos seleccionados. ¡Ofertas por tiempo limitado que no puedes dejar pasar!
                    </p>
                  </div>
                </div>
                
                {/* Product Carousel */}
                <div className="flex-1">
                {(() => {
                  const promocionProducts = products.filter((product: any) => 
                    product.category && 
                    (Array.isArray(product.category) 
                      ? product.category.some((cat: string) => cat.toLowerCase().includes('promocion'))
                      : product.category.toLowerCase().includes('promocion')
                    )
                  );
                  
                  const [currentIndex, setCurrentIndex] = React.useState(0);
                  const itemsPerPage = 2;
                  const totalPages = Math.ceil(promocionProducts.length / itemsPerPage);
                  
                  const nextSlide = () => {
                    setCurrentIndex((prev) => (prev + 1) % totalPages);
                  };
                  
                  const prevSlide = () => {
                    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                  };
                  
                  const currentProducts = promocionProducts.slice(
                    currentIndex * itemsPerPage,
                    (currentIndex + 1) * itemsPerPage
                  );
                  
                  return (
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50"></div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Product Categories & Popular Products Section - Merged */}
      <section className="px-4 md:px-16 py-6 md:py-16 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 md:mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 md:mb-6 font-contrail-one leading-tight">
              Encuentra tu Producto Ideal
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Descubre nuestra amplia gama de productos organizados por uso y estilo, incluyendo nuestros más populares
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Category 1 - Estudiantes */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/categoria/subcategoria/Escolar"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">📚</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Para Estudiantes
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Morrales funcionales para estudiantes
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const estudianteProducts = products.filter((product: any) => {
                  if (!product.subCategory) return false;
                  
                  const productSubcategories = Array.isArray(product.subCategory) 
                    ? product.subCategory 
                    : [product.subCategory];
                  
                  return productSubcategories.some((subcat: string) => 
                    subcat && normalizeStr(subcat) === normalizeStr('Escolar')
                  );
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(estudianteProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = estudianteProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">📚</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-blue-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Category 2 - Ejecutivos */}
            <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/tipo/Ejecutivo"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">💼</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Para Ejecutivos
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Maletines y bolsos elegantes profesionales
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const ejecutivoProducts = products.filter((product: any) => {
                  if (Array.isArray(product.type)) {
                    return product.type.some((t: string) => normalizeStr(t) === normalizeStr('Ejecutivo'));
                  }
                  if (typeof product.type === 'string') {
                    return normalizeStr(product.type) === normalizeStr('Ejecutivo');
                  }
                  return false;
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(ejecutivoProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = ejecutivoProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">💼</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-indigo-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Category 3 - Deportes */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/tipo/deportivo"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">🏃‍♂️</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Para Deportes
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Morrales deportivos resistentes
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const deportivoProducts = products.filter((product: any) => {
                  if (Array.isArray(product.type)) {
                    return product.type.some((t: string) => normalizeStr(t) === normalizeStr('deportivo'));
                  }
                  if (typeof product.type === 'string') {
                    return normalizeStr(product.type) === normalizeStr('deportivo');
                  }
                  return false;
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(deportivoProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = deportivoProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">🏃‍♂️</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-green-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Category 4 - Viajes */}
            <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/categoria/subcategoria/Aeropuerto"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">✈️</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Para Viajes
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Morrales y bolsos de viaje espaciosos
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const viajeProducts = products.filter((product: any) => {
                  if (!product.subCategory) return false;
                  
                  const productSubcategories = Array.isArray(product.subCategory) 
                    ? product.subCategory 
                    : [product.subCategory];
                  
                  return productSubcategories.some((subcat: string) => 
                    subcat && normalizeStr(subcat) === normalizeStr('Aeropuerto')
                  );
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(viajeProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = viajeProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">✈️</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-orange-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Category 5 - Multiusos */}
            <div className="bg-gradient-to-br from-purple-50 to-violet-100 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/tipo/multiusos"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">🛍️</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Multiusos
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Bolsos y morrales para el día a día
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const multiusosProducts = products.filter((product: any) => {
                  if (Array.isArray(product.type)) {
                    return product.type.some((t: string) => normalizeStr(t) === normalizeStr('multiusos'));
                  }
                  if (typeof product.type === 'string') {
                    return normalizeStr(product.type) === normalizeStr('multiusos');
                  }
                  return false;
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(multiusosProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = multiusosProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">🛍️</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-purple-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Category 6 - Canguros */}
            <div className="bg-gradient-to-br from-pink-50 to-rose-100 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 overflow-hidden group">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="relative mb-4">
                  <Link 
                    href="/tipo/canguro"
                    className="absolute top-0 right-0 text-sm text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap z-10"
                  >
                    Ver todos →
                  </Link>
                  <div className="flex-1 pt-6">
                    <div className="flex items-start space-x-2 mb-2">
                      <span className="text-xl">🎒</span>
                      <h3 className="text-lg font-semibold text-gray-800 min-w-0">
                        Canguros
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600">
                      Canguros compactos y prácticos
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Product Carousel */}
              {(() => {
                // Helper to normalize strings for comparison (same as individual pages)
                function normalizeStr(str: string) {
                  return str
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[ -]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                const canguroProducts = products.filter((product: any) => {
                  if (Array.isArray(product.type)) {
                    return product.type.some((t: string) => normalizeStr(t) === normalizeStr('canguro'));
                  }
                  if (typeof product.type === 'string') {
                    return normalizeStr(product.type) === normalizeStr('canguro');
                  }
                  return false;
                });
                
                const [currentIndex, setCurrentIndex] = React.useState(0);
                const itemsPerPage = 2;
                const totalPages = Math.ceil(canguroProducts.length / itemsPerPage);
                
                // Auto-rotate every 4 seconds
                React.useEffect(() => {
                  if (totalPages <= 1) return;
                  
                  const interval = setInterval(() => {
                    // Check if any modal is currently open
                    const modalOpen = document.querySelector('[data-modal-open="true"]') !== null;
                    
                    // Only rotate if no modal is open
                    if (!modalOpen) {
                      setCurrentIndex((prev) => (prev + 1) % totalPages);
                    }
                  }, 4000);
                  
                  return () => clearInterval(interval);
                }, [totalPages]);
                
                const nextSlide = () => {
                  setCurrentIndex((prev) => (prev + 1) % totalPages);
                };
                
                const prevSlide = () => {
                  setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
                };
                
                const currentProducts = canguroProducts.slice(
                  currentIndex * itemsPerPage,
                  (currentIndex + 1) * itemsPerPage
                );
                
                return (
                  <div className="p-6 pt-0">
                    <div className="relative">
                      {/* Navigation Arrows */}
                      {totalPages > 1 && (
                        <>
                          <button
                            onClick={prevSlide}
                            className="absolute left-1 md:left-0 top-1/2 transform -translate-y-1/2 md:-translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={nextSlide}
                            className="absolute right-1 md:right-0 top-1/2 transform -translate-y-1/2 md:translate-x-4 z-10 w-10 h-10 md:w-8 md:h-8 bg-white/90 md:bg-white border border-gray-300 rounded-full shadow-lg md:shadow-md hover:shadow-xl md:hover:shadow-lg transition-all duration-200 flex items-center justify-center hover:bg-gray-50 active:scale-95 touch-manipulation"
                          >
                            <svg className="w-5 h-5 md:w-4 md:h-4 text-gray-700 md:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {/* Product Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentProducts.map((product: any, index: number) => (
                          <AutoRotatingProductCard 
                            key={product.id || index} 
                            product={product}
                            className="border border-gray-200 hover:border-gray-300 rounded-lg"
                          />
                        ))}
                        {/* Fill empty slots if less than 2 products */}
                        {currentProducts.length < itemsPerPage && (
                          Array.from({ length: itemsPerPage - currentProducts.length }).map((_, index) => (
                            <div key={`empty-${index}`} className="border border-gray-100 rounded-lg h-80 bg-gray-50 flex items-center justify-center">
                              <div className="text-center text-gray-400">
                                <span className="text-4xl mb-2 block">🎒</span>
                                <p className="text-sm">Próximamente</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {/* Pagination Dots */}
                      {totalPages > 1 && (
                        <div className="flex justify-center mt-4 space-x-2">
                          {Array.from({ length: totalPages }).map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentIndex(index)}
                              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                index === currentIndex ? 'bg-pink-600' : 'bg-gray-300 hover:bg-gray-400'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="px-4 md:px-16 py-12 md:py-20 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 md:mb-6 font-contrail-one leading-tight">
              Ventajas que Nos Hacen Únicos
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Descubre por qué miles de clientes confían en nosotros para sus necesidades de morrales y accesorios
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
            {/* Advantage 1 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">🏭</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Fabricación Colombiana</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Productos 100% colombianos con los más altos estándares de calidad. 
                Apoyamos la industria nacional y garantizamos durabilidad.
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-blue-600">100%</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">Hecho en Colombia</div>
              </div>
            </div>
            
            {/* Advantage 2 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">⚡</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Entrega Nacional</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Envíos a todo Colombia. En Medellín: 1-2 días hábiles. 
                Otras ciudades: 3-5 días hábiles (varía según departamento y zona urbana).
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-green-600">1-2 días</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">En Medellín</div>
              </div>
            </div>
            
            {/* Advantage 3 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">💎</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Precios Competitivos</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Los mejores precios del mercado sin comprometer calidad. 
                Ofertas especiales y descuentos en productos seleccionados.
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-purple-600">Hasta -30%</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">En Productos Seleccionados</div>
              </div>
            </div>
            
            {/* Advantage 4 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">🛡️</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Garantía de Fábrica</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Garantía de fábrica 1 año por defecto de fabricación. 
                Reparacion sin costo, para cambio de producto solo en algunos casos.
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-orange-600">1 Año</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">Garantía</div>
              </div>
            </div>
            
            {/* Advantage 5 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">🎯</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Atención Personalizada</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Asesoramiento experto para elegir el producto perfecto. 
                Soporte al cliente disponible en horario de atención por WhatsApp y teléfono.
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-red-600">Horario Laboral</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">Soporte Disponible</div>
              </div>
            </div>
            
            {/* Advantage 6 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">🔄</span>
              </div>
              <h3 className="text-base md:text-lg lg:text-xl font-bold text-gray-800 mb-3 md:mb-4 text-center leading-tight">Cambios Fáciles</h3>
              <p className="text-sm md:text-base text-gray-600 text-center mb-3 md:mb-4 leading-relaxed px-2 md:px-0">
                Para cambios y devoluciones de productos sin usar, hasta 30 días. 
              </p>
              <div className="text-center">
                <div className="text-xl md:text-2xl font-bold text-indigo-600">30 Días</div>
                <div className="text-xs md:text-sm text-gray-500 leading-tight">Para Cambios</div>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* Testimonials Section */}
      <section className="px-4 md:px-16 py-12 md:py-24 bg-gradient-to-br from-orange-50 to-pink-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 md:mb-6 font-contrail-one leading-tight">
              Lo Que Dicen Nuestros Clientes
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Descubre por qué nuestros clientes confían en nosotros para sus necesidades de morrales y accesorios
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-3 md:mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-base md:text-lg">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4 md:mb-6 italic text-sm md:text-base leading-relaxed">
                "Compré el morral Massnu para la universidad y superó mis expectativas. Tiene espacio perfecto para mi laptop, libros y útiles. Después de 8 meses de uso diario, sigue como nuevo. El servicio al cliente fue excelente."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3 md:mr-4 text-sm md:text-base">
                  MC
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm md:text-base leading-tight">María Camila</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-tight">Estudiante de Medicina</p>
                  <p className="text-xs text-gray-500 leading-tight">Bogotá, Colombia</p>
                </div>
              </div>
            </div>
            
            {/* Testimonial 2 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-3 md:mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-base md:text-lg">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4 md:mb-6 italic text-sm md:text-base leading-relaxed">
                "El maletín Reno ejecutivo es perfecto para mis reuniones de trabajo. Elegante, funcional y con excelente calidad. La entrega fue rápida y el producto llegó en perfectas condiciones. Definitivamente volveré a comprar."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold mr-3 md:mr-4 text-sm md:text-base">
                  JC
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm md:text-base leading-tight">Juan Carlos</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-tight">Gerente de Ventas</p>
                  <p className="text-xs text-gray-500 leading-tight">Medellín, Colombia</p>
                </div>
              </div>
            </div>
            
            {/* Testimonial 3 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-3 md:mb-4">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-base md:text-lg">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-4 md:mb-6 italic text-sm md:text-base leading-relaxed">
                "Increíble atención al cliente. Me ayudaron a elegir el morral Najos deportivo para mis viajes de senderismo. Después de 6 meses de uso intenso, sigue resistente. La garantía de 2 años me da mucha tranquilidad."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3 md:mr-4 text-sm md:text-base">
                  AS
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-sm md:text-base leading-tight">Ana Sofía</h4>
                  <p className="text-xs md:text-sm text-gray-600 leading-tight">Guía de Turismo</p>
                  <p className="text-xs text-gray-500 leading-tight">Cali, Colombia</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Additional Testimonials Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mt-6 md:mt-8">
            {/* Testimonial 4 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-2 md:mb-3">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-xs md:text-sm">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-3 md:mb-4 italic text-xs md:text-sm leading-relaxed">
                "Excelente relación calidad-precio. Compré 3 morrales para mis hijos y todos están muy satisfechos. El envío fue rápido y el empaque muy seguro."
              </p>
              <div className="flex items-center">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold mr-2 md:mr-3 text-xs md:text-sm">
                  LM
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-xs md:text-sm leading-tight">Laura Martínez</h4>
                  <p className="text-xs text-gray-600 leading-tight">Madre de Familia</p>
                </div>
              </div>
            </div>
            
            {/* Testimonial 5 */}
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="flex items-center mb-2 md:mb-3">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-xs md:text-sm">★</span>
                  ))}
                </div>
              </div>
              <p className="text-gray-700 mb-3 md:mb-4 italic text-xs md:text-sm leading-relaxed">
                "Como empresario, necesito productos de calidad. El maletín AJ que compré es profesional y duradero. El servicio post-venta es excepcional."
              </p>
              <div className="flex items-center">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold mr-2 md:mr-3 text-xs md:text-sm">
                  CR
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800 text-xs md:text-sm leading-tight">Carlos Rodríguez</h4>
                  <p className="text-xs text-gray-600 leading-tight">Empresario</p>
                </div>
              </div>
            </div>
          </div>
          

        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 md:px-16 py-12 md:py-24 bg-gradient-to-br from-gray-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 md:mb-6 font-contrail-one leading-tight">
              ¿Cómo Funciona?
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Proceso simple y rápido para obtener tu producto ideal
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
            {/* Step 1 */}
            <div className="text-center">
              <div className="relative mb-4 md:mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                  1
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold">
                  ✓
                </div>
              </div>
              <h3 className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-3 leading-tight">Explora</h3>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2 md:px-0">
                Navega por nuestro catálogo y encuentra el producto perfecto para tus necesidades
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center">
              <div className="relative mb-4 md:mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                  2
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold">
                  ✓
                </div>
              </div>
              <h3 className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-3 leading-tight">Contacta</h3>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2 md:px-0">
                Llámanos o escríbenos por WhatsApp para asesoramiento personalizado
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center">
              <div className="relative mb-4 md:mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                  3
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold">
                  ✓
                </div>
              </div>
              <h3 className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-3 leading-tight">Paga</h3>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2 md:px-0">
                Múltiples opciones de pago seguras: Wompi, PSE, tarjetas de crédito
              </p>
            </div>
            
            {/* Step 4 */}
            <div className="text-center">
              <div className="relative mb-4 md:mb-6">
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white text-lg md:text-2xl font-bold">
                  4
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs md:text-sm font-bold">
                  ✓
                </div>
              </div>
              <h3 className="text-base md:text-xl font-bold text-gray-800 mb-2 md:mb-3 leading-tight">Recibe</h3>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2 md:px-0">
                Envíos a todo Colombia con detalles de seguimiento enviados por WhatsApp
              </p>
            </div>
          </div>
          
          {/* Process Benefits */}
          <div className="mt-12 md:mt-16 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">⏱️</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm md:text-base leading-tight">Entrega Rápida</h4>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed px-2 md:px-0">Medellín: 1-2 días. Otras ciudades: 3-5 días hábiles (varía según departamento y zona urbana)</p>
            </div>
            
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">🔒</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm md:text-base leading-tight">Pago Seguro</h4>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed px-2 md:px-0">Múltiples métodos de pago con total seguridad</p>
            </div>
            
            <div className="bg-white rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-3 md:mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">📞</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2 text-sm md:text-base leading-tight">Soporte WhatsApp</h4>
              <p className="text-xs md:text-sm text-gray-600 leading-relaxed px-2 md:px-0">Atención personalizada en horario laboral</p>
            </div>
          </div>

        </div>
      </section>




      {/* Brand Showcase Section */}
      <section className="px-4 md:px-16 py-12 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-800 mb-4 md:mb-6 font-contrail-one leading-tight">
              Marcas de Confianza
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Trabajamos con las mejores marcas del mercado para ofrecerte calidad garantizada
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6 lg:gap-8 items-center">
            {/* Brand 1 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                M
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">Massnu</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">100% Colombiano</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Calidad acompañada de colores y diseños urbanos</p>
            </div>
            
            {/* Brand 2 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                R
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">Reno</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">100% Colombiano</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Calidad y durabilidad especializada para trabajos pesados</p>
            </div>
            
            {/* Brand 3 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                N
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">Najos</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">100% Colombiano</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Diseños urbanos y modernos resistentes para el dia a dia</p>
            </div>
            
            {/* Brand 4 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                A
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">AJ</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">100% Colombiano</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Linea urbana y deportiva al alcanze de tu bolsillo</p>
            </div>
            
            {/* Brand 5 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                T
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">Tiber</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">100% Colombiano</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Funcionalidad y resistencia</p>
            </div>
            
            {/* Brand 6 */}
            <div className="flex flex-col items-center space-y-2 md:space-y-4 p-3 md:p-4 lg:p-6 rounded-xl md:rounded-2xl hover:bg-gray-50 transition-all duration-300 transform hover:scale-105">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg md:text-xl">
                I
              </div>
              <h3 className="text-xs md:text-sm font-semibold text-gray-800 text-center leading-tight">Importado</h3>
              <p className="text-xs text-gray-500 text-center leading-tight">Tendencias globales</p>
              <p className="text-xs text-gray-400 text-center leading-tight px-1 md:px-0">Alternativas a marcas nacionales</p>
            </div>
          </div>
          

        </div>
      </section>



      {/* Animations (Tailwind custom classes) */}
      <style jsx global>{`
        @keyframes fadeSlideLeft {
          0% { opacity: 0; transform: translateX(-60px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .fade-slide-left {
          opacity: 0;
          transform: translateX(-60px);
        }
        .fade-slide-left.visible {
          animation: fadeSlideLeft 1s cubic-bezier(0.4,0,0.2,1) both;
        }
        @keyframes fadeSlideRight {
          0% { opacity: 0; transform: translateX(60px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .fade-slide-right {
          opacity: 0;
          transform: translateX(60px);
        }
        .fade-slide-right.visible {
          animation: fadeSlideRight 1s cubic-bezier(0.4,0,0.2,1) both;
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.8s cubic-bezier(0.4,0,0.2,1) both; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        @keyframes fadeInDown {
          0% { opacity: 0; transform: translateY(-40px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInDown { animation: fadeInDown 0.8s cubic-bezier(0.4,0,0.2,1) both; }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        .animate-float { animation: float 3s ease-in-out infinite; }
        @keyframes float-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float-slow { animation: float-slow 3s ease-in-out infinite; }
        @keyframes float-reverse {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        .animate-float-reverse { animation: float-reverse 3s ease-in-out infinite; }
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 4s ease-in-out infinite;
        }
        .animate-bounce {
          animation: bounce 1.2s infinite;
        }
        @keyframes bounce-once {
          0% { transform: scale(1); }
          30% { transform: scale(1.12); }
          60% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        .animate-bounce-once {
          animation: bounce-once 0.4s cubic-bezier(0.4,0,0.2,1) 1;
        }
        .shine-capsule {
          position: relative;
          overflow: hidden;
        }
        .shine-capsule::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(
            45deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.3) 20%,
            rgba(255, 255, 255, 0.1) 40%,
            transparent 100%
          );
          transform: rotate(45deg);
          opacity: 0;
          transition: opacity 0.5s ease-in-out;
          z-index: 1;
        }
        .shine-capsule:hover::before {
          opacity: 1;
        }
        .shine-anim {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0.1) 0%,
            rgba(255, 255, 255, 0.3) 20%,
            rgba(255, 255, 255, 0.1) 40%,
            transparent 100%
          );
          opacity: 0;
          transition: opacity 0.5s ease-in-out;
          z-index: 0;
        }
        .shine-capsule:hover .shine-anim {
          opacity: 1;
        }
      `}</style>
      {modalImage && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={() => setModalImage(null)}>
          <div className="bg-white rounded-lg shadow-2xl p-4 max-w-2xl md:max-w-3xl w-full flex flex-col items-center relative max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl font-bold z-10" onClick={() => setModalImage(null)}>&times;</button>
            <img src={modalImage} alt="Producto grande" className="w-full h-auto max-h-[60vh] object-contain rounded-lg mt-6" />
          </div>
        </div>
      )}





      {/* Contact Information Section */}
      <section className="px-4 md:px-16 py-12 md:py-24 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6 font-contrail-one leading-tight">
              ¿Necesitas Ayuda?
            </h2>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto px-4 md:px-0 leading-relaxed">
              Nuestro equipo está disponible en horario de atención para ayudarte a encontrar el producto perfecto
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* WhatsApp */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">📱</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 leading-tight">WhatsApp</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed">Respuesta inmediata en horario de atención</p>
              <a 
                href="https://wa.me/573113887955"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-green-500 hover:bg-green-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition-colors duration-200 text-sm md:text-base"
              >
                <span>Chatear Ahora</span>
                <span className="ml-2">→</span>
              </a>
            </div>
            
            {/* Teléfono */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">📞</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 leading-tight">Teléfono</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed">Atención personalizada en horario laboral</p>
              <a 
                href="tel:3113887955"
                className="inline-flex items-center bg-blue-500 hover:bg-blue-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition-colors duration-200 text-sm md:text-base"
              >
                <span>Llamar Ahora</span>
                <span className="ml-2">📞</span>
              </a>
            </div>
            
            {/* Email */}
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 text-center">
              <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-lg md:text-2xl">✉️</span>
              </div>
              <h3 className="text-lg md:text-xl font-bold text-gray-800 mb-3 md:mb-4 leading-tight">Correo Electrónico</h3>
              <p className="text-sm md:text-base text-gray-600 mb-4 leading-relaxed">Consulta detallada con respuesta en horario laboral</p>
              <a 
                href="https://mail.google.com/mail/?view=cm&fs=1&to=info@distrinaranjos.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-purple-500 hover:bg-purple-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition-colors duration-200 text-sm md:text-base"
              >
                <span>Enviar Correo</span>
                <span className="ml-2">✉️</span>
              </a>
            </div>
          </div>
          

        </div>
      </section>

      {/* Product Modal */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
          }}
        />
      )}

    </div>
    
    </>
  );
}
