'use client';
import React from 'react';
import { useCart } from '@/lib/cartContext';
import FlyingAnimation from './FlyingAnimation';
import { createPortal } from 'react-dom';
import { Product } from '../types';
import { getAllRailwayImages } from '../lib/railwayImageHelper';



interface ProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductModal({ product, isOpen, onClose }: ProductModalProps) {
  const cartContext = useCart();
  const [selectedColor, setSelectedColor] = React.useState<string>('');
  const [quantity, setQuantity] = React.useState<number>(1);
  const [currentImageIndex, setCurrentImageIndex] = React.useState<number>(0);
  const [mounted, setMounted] = React.useState(false);
  const [isFullScreenViewerOpen, setIsFullScreenViewerOpen] = React.useState(false);
  const lastOpenedAtRef = React.useRef<number>(0);
  const suppressCloseRef = React.useRef<boolean>(false);
  const openFullScreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    lastOpenedAtRef.current = Date.now();
    suppressCloseRef.current = true;
    setIsFullScreenViewerOpen(true);
    // Allow time for overlay to mount and avoid same-click close
    window.setTimeout(() => {
      suppressCloseRef.current = false;
    }, 400);
  };
  const maybeCloseFullScreen = () => {
    if (suppressCloseRef.current) return;
    setIsFullScreenViewerOpen(false);
  };
  const [showSuccessMessage, setShowSuccessMessage] = React.useState(false);
  const [categoryRelations, setCategoryRelations] = React.useState<any[]>([]);
  const [showFlyingAnimation, setShowFlyingAnimation] = React.useState(false);
  const [flyingImageUrl, setFlyingImageUrl] = React.useState('');
  const [flyingStartPosition, setFlyingStartPosition] = React.useState({ x: 0, y: 0 });
  const [flyingTargetPosition, setFlyingTargetPosition] = React.useState({ x: 0, y: 0 });
  const [isAnimationRunning, setIsAnimationRunning] = React.useState(false);
  const isAddingToCart = React.useRef(false);
  
  // Detect if we're on distri1/naranjos2 pages (cart at bottom-right) or main pages (cart at top-right)
  const isDistriPage = typeof window !== 'undefined' && (
    window.location.pathname.includes('/distri1') || 
    window.location.pathname.includes('/naranjos2')
  );

  // Detect if we're in virtual admin environment or using virtual database
  const isVirtualAdmin = typeof window !== 'undefined' && (
    window.location.pathname.includes('/adminvirtual') ||
    window.location.pathname.includes('/marca/') ||
    window.location.pathname.includes('/tipo/') ||
    window.location.pathname.includes('/categoria/') ||
    window.location.pathname === '/' // Main page also uses virtual database
  );

  // For virtual admin, use stock field, otherwise use quantity field
  const stockValue = isVirtualAdmin 
    ? ((product as any).stock || 0) // Use stock field for virtual admin
    : (product.quantity || 0); // Use quantity field for regular admin

  // Ensure component is mounted before rendering portal
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch category-subcategory relations
  React.useEffect(() => {
    if (isOpen) {
      fetch('/api/database/virtual-category-relations')
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setCategoryRelations(data.relations);
          }
        })
        .catch(error => {
          console.error('Error fetching category relations:', error);
        });
    }
  }, [isOpen]);

  
  
  // Test cart context functionality
  React.useEffect(() => {
    if (cartContext) {
      
    } else {
      console.error('Cart context is NOT available');
    }
  }, [cartContext]);

  // Get colors array
  const colors: string[] = (() => {
    if (Array.isArray(product.colors)) {
      return product.colors;
    }
    if (typeof product.colors === 'string') {
      return (product.colors as string).split(',').map((c: string) => c.trim());
    }
    return [];
  })();

  // Reset color/quantity and image index when product changes or modal opens
  React.useEffect(() => {
    setSelectedColor(colors.length > 0 ? colors[0] : '');
    setQuantity(1);
    setCurrentImageIndex(0);
    
    // Debug logging for modal state (temporary)
    if (isVirtualAdmin) {
      console.log('🔄 Virtual Admin Modal Reset:', {
        productName: product.name,
        productQuantity: product.quantity
      });
    }
    
    // Don't close full screen viewer when modal opens - let user control it
  }, [product, isOpen, colors.length, isVirtualAdmin]);

  // Auto-rotation for images - only if multiple images and modal is open
  React.useEffect(() => {
    if (!isOpen) return;
    
    const images = getProductImages();
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex(prev => 
        prev === images.length - 1 ? 0 : prev + 1
      );
    }, 4000); // Rotate every 4 seconds
    
    return () => clearInterval(interval);
  }, [isOpen, product]);

  if (!isOpen || !mounted) return null;

  // Get all product images
  const getProductImages = () => {
    // Use Railway image helper to handle URLs properly
    return getAllRailwayImages(product.imageURL);
  };

  // Get current image
  const getCurrentImage = () => {
    const images = getProductImages();
    return images[currentImageIndex] || '/placeholder-product.svg';
  };

  // Clean product name by removing ID part (e.g., "1000 - LONCHERA" becomes "LONCHERA")
  const getCleanProductName = () => {
    if (!product.name) return '';
    // Remove ID pattern like "1000 - " from the beginning
    return product.name.replace(/^\d+\s*-\s*/, '');
  };

  // Format currency
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const handleAddToCart = () => {
    try {
      if (!cartContext || !cartContext.addToCart) {
        console.error('Cart context or addToCart function is not available');
        alert('Error: Cart functionality not available');
        return;
      }
      
      // Prevent multiple calls
      if (isAddingToCart.current || isAnimationRunning) {
        return;
      }
      
      // Set flags immediately to prevent double calls
      isAddingToCart.current = true;
      setIsAnimationRunning(true);
      
            // Check if this is a promotional product
      const hasPromotionalPricing = product.category &&
        (Array.isArray(product.category) 
          ? product.category.some((cat: string) => cat.toLowerCase().includes('promocion'))
          : product.category.toLowerCase().includes('promocion')
        );
      
      // Calculate the correct price for cart
      let cartPrice = product.price || 0;
      let originalPrice = product.price || 0;
      
      if (hasPromotionalPricing) {
        // For promotional products, use the discounted price
        cartPrice = originalPrice * 0.7; // 30% discount
      }
      
      const cartItem = {
        id: product.id + (selectedColor ? `-${selectedColor}` : ''),
        name: product.name,
        price: cartPrice,
        price2: product.price2,
        originalPrice: originalPrice,
        isPromotional: hasPromotionalPricing || false,
        quantity,
                    image: Array.isArray(product.imageURL) ? product.imageURL[0] : product.imageURL || '',
        category: product.category || '', // Preserve all categories (array or string)
        subCategory: (product as any).subCategory || '',
        brand: product.brand || '',
        type: product.type || '',
        color: selectedColor || undefined,
      };
      
      // Start flying animation from button position
      const currentImage = getCurrentImage();
      setFlyingImageUrl(currentImage);
      
      // Get the button position for flying animation - use product-specific selector
      const button = document.querySelector(`[data-add-to-cart-button][data-product-id="${product.id}"]`) as HTMLElement;
      console.log('🔍 Looking for button with selector:', `[data-add-to-cart-button][data-product-id="${product.id}"]`);
      console.log('🔍 Found button:', button);
      
      if (button) {
        const rect = button.getBoundingClientRect();
        console.log('🔍 Button position:', rect);
        setFlyingStartPosition({
          x: rect.left + rect.width / 2 - 40, // Center the 80px (w-20) image on button
          y: rect.top + rect.height / 2 - 40
        });
      } else {
        // Fallback to center of screen if button not found
        console.log('⚠️ Button not found, using fallback position');
        setFlyingStartPosition({
          x: window.innerWidth / 2 - 40,
          y: window.innerHeight / 2 - 40
        });
      }
      
      // Calculate target position based on page type
      const targetPosition = isDistriPage 
        ? { x: window.innerWidth - 120, y: window.innerHeight - 120 } // Bottom-right for distri pages
        : { x: window.innerWidth - 120, y: 20 }; // Top-right for main pages
      
      setFlyingTargetPosition(targetPosition);
      setShowFlyingAnimation(true);
      setIsAnimationRunning(true);
      
      console.log('🚀 Flying animation started for product:', product.name);
      console.log('🚀 Start position:', flyingStartPosition);
      console.log('🚀 Target position:', targetPosition);
      
      // Add to cart immediately
      cartContext.addToCart(cartItem);
      console.log('🛒 Added to cart:', cartItem.name);
      
      // Show success message immediately
      setShowSuccessMessage(true);
      
      // Hide success message after 2 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
      
      // Safety timeout to reset flags in case animation fails
      setTimeout(() => {
        if (isAddingToCart.current || isAnimationRunning) {
          console.log('🔄 Safety timeout - resetting animation flags');
          isAddingToCart.current = false;
          setIsAnimationRunning(false);
        }
      }, 1000);
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Error al agregar al carrito: ' + error);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[999999]" 
      data-modal-open="true"
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0,
        zIndex: 999999,
        height: '100vh',
        width: '100vw'
      }}
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black"
        onClick={(e) => {
          // Only close if the click is directly on the backdrop, not on child elements
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        onTouchEnd={(e) => {
          // Handle touch events more carefully
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          zIndex: 1,
          backgroundColor: 'black'
        }}
      />
      
      {/* Flying Animation */}
      <FlyingAnimation 
        isVisible={showFlyingAnimation}
        imageUrl={flyingImageUrl}
        startPosition={flyingStartPosition}
        targetPosition={flyingTargetPosition}
        onComplete={() => {
          setShowFlyingAnimation(false);
          setFlyingImageUrl('');
          setIsAnimationRunning(false);
          isAddingToCart.current = false;
          // Close modal after animation completes
          onClose();
        }}
      />

      {/* Success Toast Message - Positioned above modal */}
      {showSuccessMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[9999999] bg-green-500 text-white px-4 py-3 rounded-lg shadow-xl max-w-[90vw] sm:max-w-md animate-fadeIn">
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-sm sm:text-base text-center">¡Agregado al carrito!</span>
          </div>
        </div>
      )}

      {/* Modal Content */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-1 sm:p-2 lg:p-4 pointer-events-none" 
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          pointerEvents: 'none'
        }}
      >
        <div 
          className="relative bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] sm:max-h-[95vh] overflow-y-auto mx-1 sm:mx-2 lg:mx-8 sm:rounded-2xl pointer-events-auto" 
          style={{ 
            maxHeight: '90vh',
            margin: '0 auto',
            width: 'calc(100vw - 1rem)',
            maxWidth: 'min(98vw, 80rem)',
            backgroundColor: 'white',
            background: 'white',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            pointerEvents: 'auto'
          }}
          onClick={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <style jsx>{`
            .animate-fadeIn {
              animation: fadeIn 0.3s ease-in-out;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 bg-white rounded-full p-2 shadow-lg text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="p-2 sm:p-4 lg:p-8 bg-white" style={{ backgroundColor: 'white' }}>
            
            {/* Product Layout - Stacked on mobile, side-by-side on desktop */}
            <div className="flex flex-col lg:flex-row lg:gap-6">
              {/* Product Image - Left side on desktop */}
              <div className="w-full lg:w-1/2 mb-2 lg:mb-0">
                {/* Product Name - Above photo on mobile, inside image container on desktop */}
                                  <div className="text-center lg:hidden">
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-2 leading-tight">
                      {getCleanProductName()}
                    </h2>
                    {(product.quantity || 0) <= 0 ? (
                      <div className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-medium">
                        <span>🔴</span>
                        <span>Agotado</span>
                      </div>
                    ) : (product.quantity || 0) === 1 ? (
                      <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-medium">
                        <span>⚠️</span>
                        <span>Última unidad</span>
                      </div>
                    ) : null}
                  </div>
                
                {/* Categories and Subcategories Section - Mobile - Compact */}
                <div className="mb-2 lg:hidden">
                  {/* Color mapping for categories and subcategories */}
                  {(() => {
                    const categoryColors = [
                      'bg-blue-100 text-blue-800',
                      'bg-purple-100 text-purple-800',
                      'bg-indigo-100 text-indigo-800',
                      'bg-cyan-100 text-cyan-800',
                      'bg-sky-100 text-sky-800'
                    ];
                    
                    const subcategoryColors = [
                      'bg-green-100 text-green-800',
                      'bg-emerald-100 text-emerald-800',
                      'bg-teal-100 text-teal-800',
                      'bg-lime-100 text-lime-800',
                      'bg-yellow-100 text-yellow-800'
                    ];
                    
                    // Get categories and subcategories
                    let categories: string[] = [];
                    if (Array.isArray(product.category)) {
                      categories = product.category;
                    } else if (typeof product.category === 'string') {
                      categories = product.category.split(',').map(cat => cat.trim());
                    }
                    
                    let subcategories: string[] = [];
                    if (Array.isArray((product as any).subCategory)) {
                      subcategories = (product as any).subCategory;
                    } else if (typeof (product as any).subCategory === 'string') {
                      subcategories = (product as any).subCategory.split(',').map((subcat: string) => subcat.trim());
                    }
                    
                    // Create a map of category to its related subcategories
                    const categoryToSubcategories = categoryRelations.reduce((acc: any, relation: any) => {
                      if (relation.isActive) {
                        if (!acc[relation.category]) {
                          acc[relation.category] = [];
                        }
                        acc[relation.category].push(relation.subcategory);
                      }
                      return acc;
                    }, {});
                    
                    return (
                      <div className="space-y-1">
                        {/* Categories with their related subcategories - Compact layout */}
                        {categories.map((category, catIndex) => {
                          const relatedSubcategories = categoryToSubcategories[category] || [];
                          const productSubcategories = subcategories.filter(subcat => 
                            relatedSubcategories.includes(subcat)
                          );
                          
                          return (
                            <div key={catIndex} className="border border-gray-200 rounded-md p-1.5 text-center">
                              <div className="flex items-center gap-1.5 justify-center flex-wrap">
                                <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${categoryColors[catIndex % categoryColors.length]}`}>
                                  {category}
                                </span>
                                {productSubcategories.length > 0 && (
                                  <>
                                    <span className="text-xs text-gray-400">→</span>
                                    {productSubcategories.map((subcat: string, subIndex: number) => (
                                      <span 
                                        key={subIndex}
                                        className={`inline-block text-xs px-1.5 py-0.5 rounded ${subcategoryColors[subIndex % subcategoryColors.length]}`}
                                      >
                                        {subcat}
                                      </span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="w-full h-48 sm:h-56 lg:h-[500px] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200 relative">
                  {/* Main Image */}
                  <img
                    src={getCurrentImage()}
                    alt={product.name}
                    className="w-full h-full object-contain transition-transform duration-300 hover:scale-105 cursor-pointer"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      maxHeight: '100%',
                      maxWidth: '100%'
                    }}
                    onClick={openFullScreen}
                    onError={(e) => {
                      console.warn(`Failed to load image for ${product.name}, using placeholder`);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      // Check if placeholder already exists to avoid duplicates
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.placeholder-content')) {
                        const placeholderDiv = document.createElement('div');
                        placeholderDiv.className = 'placeholder-content flex flex-col items-center justify-center text-gray-400 h-full absolute inset-0';
                        placeholderDiv.innerHTML = `
                          <svg class="w-8 h-8 sm:w-12 sm:h-12 mb-1 sm:mb-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                          </svg>
                          <span class="text-xs sm:text-sm text-center">Sin Imagen</span>
                        `;
                        parent.appendChild(placeholderDiv);
                      }
                    }}
                  />
                  
                  {/* Promoción Badge - Only show for promotional products */}
                  {(() => {
                    // Handle both array and string categories
                    const categories = Array.isArray(product.category) ? product.category : [product.category];
                    
                    // Safety check for undefined/null categories
                    if (!categories || categories.length === 0) {
                      return null;
                    }
                    
                    // Check for promotional categories
                    const isPromotional = categories.some(cat => 
                      cat && (cat.toLowerCase() === 'promoción' || cat.toLowerCase() === 'promocion')
                    );
                    
                    if (isPromotional) {
                      return (
                        <div className="absolute top-4 right-4 flex flex-col items-center z-30">
                          <div className="text-4xl animate-bounce drop-shadow-lg">🔥</div>
                          <div className="text-xs font-bold text-white bg-red-600 px-2 py-1 rounded">Promoción</div>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                  
                  {/* Nuevo Badge - Only show for new products */}
                  {(() => {
                    // Handle both array and string categories
                    const categories = Array.isArray(product.category) ? product.category : [product.category];
                    
                    // Safety check for undefined/null categories
                    if (!categories || categories.length === 0) {
                      return null;
                    }
                    
                    // Check for new product categories
                    const isNew = categories.some(cat => 
                      cat && cat.toLowerCase() === 'nuevo'
                    );
                    
                    if (isNew) {
                      return (
                        <div className="absolute top-4 right-4 flex flex-col items-center z-30">
                          <div className="text-4xl animate-pulse drop-shadow-lg">💎</div>
                          <div className="text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">Nuevo</div>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                  
                  {/* Magnifying Glass Overlay */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 rounded-full p-3 text-white transition-all duration-200 cursor-pointer shadow-lg z-20" onClick={openFullScreen}>
                    <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                  </div>
                  
                  {/* SKU Number - Bottom Left */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium z-10">
                    SKU: {(product as any).SKU || product.SKN || 'N/A'}
                  </div>
                  
                  {/* Navigation Arrows - Only show if multiple images */}
                  {getProductImages().length > 1 && (
                    <>
                      {/* Previous Button */}
                      <button
                        onClick={() => setCurrentImageIndex(prev => 
                          prev === 0 ? getProductImages().length - 1 : prev - 1
                        )}
                        className="absolute left-1 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-lg text-gray-600 hover:text-gray-800 transition-all duration-200 z-10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      {/* Next Button */}
                      <button
                        onClick={() => setCurrentImageIndex(prev => 
                          prev === getProductImages().length - 1 ? 0 : prev + 1
                        )}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-lg text-gray-600 hover:text-gray-800 transition-all duration-200 z-10"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
                

                
                {/* Thumbnail Gallery - Only show if multiple images */}
                {getProductImages().length > 1 && (
                  <div className="mt-3 sm:mt-4">
                    <div className="flex justify-center space-x-2 sm:space-x-3 overflow-x-auto pb-2">
                      {getProductImages().map((image, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 ${
                            currentImageIndex === index 
                              ? 'border-blue-500 shadow-lg ring-2 ring-blue-200' 
                              : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                          }`}
                        >
                          <img
                            src={image}
                            alt={`${product.name} - Imagen ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                    <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                                    </svg>
                                  </div>
                                `;
                              }
                            }}
                          />
                        </button>
                      ))}
                    </div>
                    {/* Image counter */}
                    <div className="text-center mt-2">
                      <span className="text-xs text-gray-500">
                        {currentImageIndex + 1} de {getProductImages().length} fotos
                      </span>
                    </div>
                  </div>
                )}
                

              </div>

              {/* Product Info - Right side on desktop */}
              <div className="lg:w-1/2 space-y-1.5 sm:space-y-3">
                {/* Product Name - Hidden on mobile, shown on desktop */}
                                  <div className="hidden lg:block">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-lg lg:text-xl font-bold text-gray-900 leading-tight">
                        {getCleanProductName()}
                      </h2>
                      {(product.quantity || 0) <= 0 ? (
                        <div className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-md text-xs font-medium">
                          <span>🔴</span>
                          <span>Agotado</span>
                        </div>
                      ) : (product.quantity || 0) === 1 ? (
                        <div className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-md text-xs font-medium">
                          <span>⚠️</span>
                          <span>Última unidad</span>
                        </div>
                      ) : null}
                    </div>
                  
                  {/* Categories and Subcategories Section */}
                  <div className="mb-3">
                    {/* Debug logging */}
                    
                    
                    {/* Color mapping for categories and subcategories */}
                    {(() => {
                      const categoryColors = [
                        'bg-blue-100 text-blue-800',
                        'bg-purple-100 text-purple-800',
                        'bg-indigo-100 text-indigo-800',
                        'bg-cyan-100 text-cyan-800',
                        'bg-sky-100 text-sky-800'
                      ];
                      
                      const subcategoryColors = [
                        'bg-green-100 text-green-800',
                        'bg-emerald-100 text-emerald-800',
                        'bg-teal-100 text-teal-800',
                        'bg-lime-100 text-lime-800',
                        'bg-yellow-100 text-yellow-800'
                      ];
                      
                      // Get categories and subcategories
                      let categories: string[] = [];
                      if (Array.isArray(product.category)) {
                        categories = product.category;
                      } else if (typeof product.category === 'string') {
                        categories = product.category.split(',').map(cat => cat.trim());
                      }
                      
                      let subcategories: string[] = [];
                      if (Array.isArray((product as any).subCategory)) {
                        subcategories = (product as any).subCategory;
                      } else if (typeof (product as any).subCategory === 'string') {
                        subcategories = (product as any).subCategory.split(',').map((subcat: string) => subcat.trim());
                      }
                      
                      
                      
                      // Create a map of category to its related subcategories
                      const categoryToSubcategories = categoryRelations.reduce((acc: any, relation: any) => {
                        if (relation.isActive) {
                          if (!acc[relation.category]) {
                            acc[relation.category] = [];
                          }
                          acc[relation.category].push(relation.subcategory);
                        }
                        return acc;
                      }, {});
                      
                      return (
                        <div className="space-y-2">
                          {/* Categories with their related subcategories */}
                          {categories.map((category, catIndex) => {
                            const relatedSubcategories = categoryToSubcategories[category] || [];
                            const productSubcategories = subcategories.filter(subcat => 
                              relatedSubcategories.includes(subcat)
                            );
                            
                            return (
                              <div key={catIndex} className="border border-gray-200 rounded-lg p-2">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block text-xs px-2 py-1 rounded-md ${categoryColors[catIndex % categoryColors.length]}`}>
                                    {category}
                                  </span>
                                  {productSubcategories.length > 0 && (
                                    <>
                                      <span className="text-xs text-gray-500">→</span>
                                      {productSubcategories.map((subcat: string, subIndex: number) => (
                                        <span 
                                          key={subIndex}
                                          className={`inline-block text-xs px-2 py-1 rounded-md ${subcategoryColors[subIndex % subcategoryColors.length]}`}
                                        >
                                          {subcat}
                                        </span>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                
                {/* Price and Category Row */}
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    {(() => {
                      // Check if this is a promotional product
            const hasPromotionalPricing = product.category &&
              (Array.isArray(product.category) 
                ? product.category.some((cat: string) => cat.toLowerCase().includes('promocion'))
                : product.category.toLowerCase().includes('promocion')
              );
            


            if (hasPromotionalPricing) {
              // For promotional products: show original price as striked price, calculate 30% discounted price
              const originalPrice = product.price || 0;
              // Apply 30% discount to get the actual selling price
              const discountedPrice = originalPrice * 0.7;

              return (
                <div className="space-y-1">
                  {/* Original price with strikethrough */}
                  <div className="text-sm sm:text-base font-medium text-gray-500 line-through">
                    {formatPrice(originalPrice)}
                  </div>
                  {/* Current price (30% discounted) */}
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600">
                    {formatPrice(discountedPrice)}
                  </div>
                  {/* Discount percentage */}
                  <div className="text-xs sm:text-sm font-medium text-green-600">
                    {Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)}% de descuento
                  </div>
                </div>
              );
            } else {
              // Regular pricing - use price
              const displayPrice = product.price || 0;

              return (
                <div className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600">
                  {formatPrice(displayPrice)}
                </div>
              );
            }
                    })()}
                  </div>
                </div>

                {/* Product Details Section */}
                <div className="bg-gray-50 rounded-lg p-1.5 sm:p-3 mb-2 lg:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 border-b border-gray-200 pb-1">
                    Detalles del Producto
                  </h3>
                  <div className="space-y-1">
                    {product.brand && (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-16 text-xs">Marca:</span>
                        <span className="text-gray-900 font-medium text-xs">{product.brand}</span>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16 text-xs">SKU:</span>
                      <span className="text-gray-900 font-medium text-xs">{(product as any).SKU || product.SKN || 'N/A'}</span>
                    </div>
                    {product.type && (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-16 text-xs">Tipo:</span>
                        <span className="text-gray-900 font-medium text-xs">{product.type}</span>
                      </div>
                    )}
                    {colors.length > 0 && (
                      <div className="flex items-center">
                        <span className="font-medium text-gray-700 w-16 text-xs">Color:</span>
                        <div className="relative flex-1">
                          <select
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-1 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer shadow-sm hover:shadow-md"
                            value={selectedColor}
                            onChange={e => setSelectedColor(e.target.value)}
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem'
                            }}
                          >
                            {colors.map(color => (
                              <option key={color} value={color}>{color}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16 text-xs">Cantidad:</span>
                      <div className="flex items-center gap-2 flex-1">
                        <div className="relative">
                          <select
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-1 text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer shadow-sm hover:shadow-md"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem'
                            }}
                          >
                            {(() => {
                              const maxQuantity = isVirtualAdmin 
                                ? Math.min(stockValue, 25) // Use actual stock, max 25
                                : 25; // Fixed 25 for distri1/naranjos2
                              
                              // Debug logging (temporary)
                              if (isVirtualAdmin) {
                                console.log('🔍 Virtual Admin Modal:', {
                                  productName: product.name,
                                  productStock: (product as any).stock,
                                  productQuantity: product.quantity,
                                  stockValue,
                                  maxQuantity
                                });
                              }
                              
                              return [...Array(Math.max(1, maxQuantity))].map((_, i) => (
                                <option key={i+1} value={i+1}>{i+1}</option>
                              ));
                            })()}
                          </select>
                        </div>
                        <span className={`text-xs font-medium ${
                          stockValue <= 0 
                            ? 'text-red-600' 
                            : stockValue === 1 
                              ? 'text-orange-600' 
                              : 'text-green-600'
                        }`}>
                          ({stockValue} disponibles)
                          {stockValue === 1 && (
                            <span className="ml-1">⚠️ Última unidad</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Specifications Section */}
                <div className="bg-gray-50 rounded-lg p-1.5 sm:p-3 mb-2 lg:mb-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1 border-b border-gray-200 pb-1">
                    Especificaciones Técnicas
                  </h3>
                  <div className="space-y-1">
                    <div className="flex items-start">
                      <span className="font-medium text-gray-700 w-20 text-xs flex-shrink-0">Capacidad:</span>
                      <span className="text-gray-900 font-medium text-xs">{product.capacity || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium text-gray-700 w-20 text-xs flex-shrink-0">Materiales:</span>
                      <span className="text-gray-900 font-medium text-xs">{product.materials || 'N/A'}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-medium text-gray-700 w-20 text-xs flex-shrink-0">Dimensiones:</span>
                      <span className="text-gray-900 font-medium text-xs">{product.dimensions || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Add to Cart Button */}
                <div className="pt-1.5 pb-3 sm:pb-2">
                  {(() => {
                    const isOutOfStock = stockValue <= 0;
                    const isDisabled = isOutOfStock || (colors.length > 0 && !selectedColor) || !quantity;
                    
                    return (
                      <button
                        data-add-to-cart-button
                        data-product-id={product.id}
                        className={`w-full font-semibold py-1.5 sm:py-2 px-4 rounded-lg text-sm ${
                          isOutOfStock 
                            ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                            : isDisabled 
                              ? 'bg-blue-600 text-white opacity-50 cursor-not-allowed' 
                              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                        }`}
                        disabled={isDisabled}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          console.log('🖱️ Add to cart button clicked for product:', product.name);
                          console.log('🖱️ Is out of stock:', isOutOfStock);
                          console.log('🖱️ Is disabled:', isDisabled);
                          
                          if (!isOutOfStock) {
                            handleAddToCart();
                            // Modal will close automatically when flying animation completes
                          }
                        }}
                      >
                        {isOutOfStock ? 'Agotado' : 'Agregar al carrito'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Photo Viewer */}
      {isFullScreenViewerOpen && (
          <div 
          className="fixed inset-0 z-[9999999] bg-black"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 9999999,
            backgroundColor: 'black'
          }}
            onClick={maybeCloseFullScreen}
        >
          {/* Photo Container */}
          <div className="flex items-center justify-center h-full p-8">
            <div className="relative max-w-4xl max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              
              {/* Main Image */}
              <div className="relative">
                <img
                  src={getCurrentImage()}
                  alt={product.name}
                  className="max-w-full max-h-full object-contain"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    console.warn(`Failed to load image for ${product.name}, using placeholder`);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex flex-col items-center justify-center text-gray-400 h-full">
                          <svg class="w-16 h-16 mb-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                          </svg>
                          <span class="text-lg text-center">Sin Imagen</span>
                        </div>
                      `;
                    }
                  }}
                />
                
                {/* Close button - positioned on top of the actual photo */}
                <button
                  onClick={() => setIsFullScreenViewerOpen(false)}
                  className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/70 rounded-full p-2 text-white transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Navigation Arrows - Only show if multiple images */}
              {getProductImages().length > 1 && (
                <>
                  {/* Previous Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => 
                        prev === 0 ? getProductImages().length - 1 : prev - 1
                      );
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-4 text-white transition-all duration-200"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {/* Next Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(prev => 
                        prev === getProductImages().length - 1 ? 0 : prev + 1
                      );
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-4 text-white transition-all duration-200"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}

              {/* Image Counter */}
              {getProductImages().length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                  {currentImageIndex + 1} / {getProductImages().length}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Use portal to render modal at root level
  return createPortal(modalContent, document.body);
} 