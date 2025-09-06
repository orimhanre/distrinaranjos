'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cartContext';
import { useMobileErrorHandler } from '@/lib/useMobileErrorHandler';



export default function CartPage() {
  // Add mobile error handler for chunk loading issues
  useMobileErrorHandler();
  
  // Helper function to process image URLs (same logic as ProductModal and other components)
  const getProcessedImageUrl = (rawUrl: string): string => {
    if (!rawUrl || rawUrl === '/placeholder-product.svg') {
      return '/placeholder-product.svg';
    }
    
    // If it's already an API endpoint, return as is
    if (rawUrl.startsWith('/api/images/')) {
      return rawUrl;
    }
    
    // If it's already a valid URL (Cloudinary, Airtable, etc.), return as is
    if (rawUrl.includes('res.cloudinary.com') || rawUrl.includes('dl.airtable.com')) {
      return rawUrl;
    }
    
    // Extract filename from URL
    const filename = rawUrl.split('/').pop() || rawUrl;
    
    // Use the correct API endpoint structure: /api/images/products/filename
    return `/api/images/products/${filename}`;
  };
  
  const { cartItems, updateQuantity, removeFromCart, clearCart, getTotalPrice, getTotalItems } = useCart();
  const [shippingConfig, setShippingConfig] = useState({
    freeShippingThreshold: 100000,
    shippingCost: 15000,
    estimatedDays: 3
  });
  const [loading, setLoading] = useState(true);
  const [orderSuccessMessage, setOrderSuccessMessage] = useState<React.ReactNode | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  // Check for success message from order confirmation
  useEffect(() => {
    // If there are items in the cart, clear any previous success messages
    if (cartItems.length > 0) {
      sessionStorage.removeItem('orderId');
      sessionStorage.removeItem('paymentMethod');
      sessionStorage.removeItem('pdfUrl');
      sessionStorage.removeItem('tempOrderSuccess');
      sessionStorage.removeItem('tempOrderPdfUrl');
      setOrderSuccessMessage(null);
      return;
    }

    const orderId = sessionStorage.getItem('orderId');
    const paymentMethod = sessionStorage.getItem('paymentMethod');
    const pdfUrl = sessionStorage.getItem('pdfUrl');
    
    if (orderId && paymentMethod) {
      // Set success message with PDF link if available
      if (pdfUrl) {
        setOrderSuccessMessage(
          <>
            <div className="mb-4">
              <span className="text-2xl">🎉</span>
              <span className="ml-2 text-xl font-extrabold">¡Tu pedido fue enviado correctamente!</span>
            </div>
            <p className="text-base mb-4">Nos pondremos en contacto contigo pronto.</p>
            <a 
              href={pdfUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 animate-pulse"
            >
              <span className="text-2xl mr-2">📄</span>
              Ver PDF del Pedido
            </a>
          </>
        );
        // Store only temporarily - will be cleared when navigating away
        sessionStorage.setItem('tempOrderSuccess', 'true');
        sessionStorage.setItem('tempOrderPdfUrl', pdfUrl);
      } else {
        setOrderSuccessMessage(
          <>
            <div className="mb-2">
              <span className="text-2xl">🎉</span>
              <span className="ml-2 text-xl font-extrabold">¡Tu pedido fue enviado correctamente!</span>
            </div>
            <p className="text-base">Nos pondremos en contacto contigo pronto.</p>
          </>
        );
        sessionStorage.setItem('tempOrderSuccess', 'true');
      }
      
      // Clear session storage after showing the message (prevents repeated showing on refresh)
      sessionStorage.removeItem('orderId');
      sessionStorage.removeItem('paymentMethod');
      sessionStorage.removeItem('pdfUrl');
    }
    
    // Also check if there's a temporary success message from sessionStorage
    const tempSuccessMessage = sessionStorage.getItem('tempOrderSuccess');
    const tempPdfUrl = sessionStorage.getItem('tempOrderPdfUrl');
    
    if (tempSuccessMessage && tempPdfUrl && !orderId) {
      // Show the temporary success message if no new order
      setOrderSuccessMessage(
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-2xl">🎉</span>
              <span className="ml-2 text-xl font-extrabold">¡Tu pedido fue enviado correctamente!</span>
            </div>
            <button 
              onClick={() => {
                sessionStorage.removeItem('tempOrderSuccess');
                sessionStorage.removeItem('tempOrderPdfUrl');
                setOrderSuccessMessage(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              title="Cerrar mensaje"
            >
              ×
            </button>
          </div>
          <p className="text-base mb-4">Nos pondremos en contacto contigo pronto.</p>
          <a 
            href={tempPdfUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-lg font-bold rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 animate-pulse"
          >
            <span className="text-2xl mr-2">📄</span>
            Ver PDF del Pedido
          </a>
        </>
      );
    } else if (tempSuccessMessage && !tempPdfUrl && !orderId) {
      // Show success message without PDF
      setOrderSuccessMessage(
        <>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="text-2xl">🎉</span>
              <span className="ml-2 text-xl font-extrabold">¡Tu pedido fue enviado correctamente!</span>
            </div>
            <button 
              onClick={() => {
                sessionStorage.removeItem('tempOrderSuccess');
                setOrderSuccessMessage(null);
              }}
              className="text-gray-500 hover:text-gray-700 text-2xl"
              title="Cerrar mensaje"
            >
              ×
            </button>
          </div>
          <p className="text-base">Nos pondremos en contacto contigo pronto.</p>
        </>
      );
    }
  }, [cartItems.length]);

  // Fetch shipping configuration with retry mechanism
  const fetchShippingConfig = async (retryCount = 0) => {
    const maxRetries = 2;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch('/api/shipping-config', {
        cache: 'no-store', // Prevent caching
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const config = await response.json();
        console.log('Cart received shipping config:', config);
        setShippingConfig(config);
      } else {
        console.warn('Initial shipping config fetch returned non-OK status:', response.status);
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`Error fetching shipping config (attempt ${retryCount + 1}):`, error);
      
      // Retry logic
      if (retryCount < maxRetries && (error instanceof Error && (error.name === 'AbortError' || error.message.includes('fetch')))) {
        console.log(`Retrying shipping config fetch in 1 second... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => fetchShippingConfig(retryCount + 1), 1000);
        return;
      }
      
      // Use default values if all retries fail
      console.log('Using default shipping config values after failed attempts');
      setShippingConfig({
        freeShippingThreshold: 150000,
        shippingCost: 25000,
        estimatedDays: 3
      });
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };



  useEffect(() => {
    fetchShippingConfig();
  }, []);

  // Refresh shipping config periodically (every 30 seconds) to catch environment changes
  useEffect(() => {
    let isActive = true;
    
    const interval = setInterval(async () => {
      if (!isActive) return;
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch('/api/shipping-config', {
          cache: 'no-store',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok && isActive) {
          const config = await response.json();
          setShippingConfig(config);
        } else if (isActive) {
          console.warn('Shipping config fetch returned non-OK status:', response.status);
        }
      } catch (error) {
        if (!isActive) return;
        
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn('Shipping config fetch timed out');
        } else {
          console.error('Error fetching shipping config:', error);
        }
        // Don't throw the error, just log it to prevent the interval from breaking
      }
    }, 30000); // Check every 30 seconds

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  // Amazon-style shipping logic
  const subtotal = getTotalPrice();
  const needsShipping = subtotal < shippingConfig.freeShippingThreshold;
  const shippingCost = needsShipping ? shippingConfig.shippingCost : 0;
  const total = subtotal + shippingCost;
  const remainingForFreeShipping = shippingConfig.freeShippingThreshold - subtotal;
  const progressToFreeShipping = Math.min((subtotal / shippingConfig.freeShippingThreshold) * 100, 100);


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Cargando configuración de envío...</p>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pt-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Carrito de Compras</h1>
            <p className="text-gray-600 mt-2">Tu carrito está vacío</p>
          </div>

          {/* Success Message */}
          {orderSuccessMessage && (
            <div className="mb-6 p-6 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl shadow-lg animate-pulse">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4 flex-1">
                  <div className="text-lg font-bold text-green-900 leading-relaxed">{orderSuccessMessage}</div>
                </div>
              </div>
            </div>
          )}

          {/* Empty Cart */}
          <div className="text-center py-12">
            <div className="mb-6">
              <img 
                src="/cart.png" 
                alt="Carrito vacío" 
                className="w-24 h-24 mx-auto opacity-50"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <svg class="w-24 h-24 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                      </svg>
                    `;
                  }
                }}
              />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Tu carrito está vacío</h2>
            <p className="text-gray-600 mb-8">Agrega productos a tu carrito para comenzar a comprar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-2 sm:py-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Carrito de Compras</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">{getTotalItems()} productos en tu carrito</p>
        </div>

        {/* Success Message */}
        {orderSuccessMessage && (
          <div className="mb-6 p-6 bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-xl shadow-lg animate-pulse">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <div className="text-lg font-bold text-green-900 leading-relaxed">{orderSuccessMessage}</div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-3 sm:px-4 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Productos ({getTotalItems()})</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {cartItems.map((item) => (
                  <div key={item.id} className="relative p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-200">
                                         {/* Mobile Layout */}
                     <div className="block sm:hidden">
                       <div className="flex items-start space-x-2 sm:space-x-3">
                         {/* Product Image */}
                         <div className="flex-shrink-0">
                           <div className="relative">
                             <img
                               src={getProcessedImageUrl(item.image || '/placeholder-product.svg')}
                               alt={item.name}
                               className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-gray-200"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement;
                                 target.src = '/placeholder-product.svg';
                               }}
                             />
                             <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                               {item.quantity}
                             </div>
                           </div>
                         </div>

                         {/* Product Info */}
                         <div className="flex-1 min-w-0">
                           <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{item.name}</h3>
                           <div className="flex flex-col mt-1 space-y-1">
                             {/* Compact mobile layout for tags */}
                             <div className="flex flex-col gap-1 text-xs">
                               <div className="flex gap-2">
                                 <span className="text-gray-700 font-medium">
                                   {item.brand}
                                 </span>
                                 <span className="text-gray-500">-</span>
                                 <span className="text-gray-700 font-medium">
                                   {item.type || 'N/A'}
                                 </span>
                               </div>
                               {/* Categories */}
                               <div className="flex flex-wrap gap-1">
                                 <span className="text-gray-600 font-medium">Categorías:</span>
                                 <span className="text-gray-700">
                                   {(() => {
                                     // Handle both array and string categories
                                     if (Array.isArray(item.category)) {
                                       return item.category.join(', ');
                                     } else if (typeof item.category === 'string') {
                                       return item.category;
                                     }
                                     return 'N/A';
                                   })()}
                                 </span>
                               </div>
                               {item.color && (
                                 <span className="text-gray-700 font-medium">
                                   {item.color}
                                 </span>
                               )}
                             </div>
                           </div>
                                                     <div className="mt-2">
                            {(() => {
                              // Check if this is a promotional product - check multiple possible category names
                              const hasPromotionalPricing = item.category &&
                                (Array.isArray(item.category) 
                                  ? item.category.some((cat: string) => 
                                      cat.toLowerCase().includes('promocion') || 
                                      cat.toLowerCase().includes('promotion') ||
                                      cat.toLowerCase().includes('oferta') ||
                                      cat.toLowerCase().includes('descuento')
                                    )
                                  : item.category.toLowerCase().includes('promocion') ||
                                    item.category.toLowerCase().includes('promotion') ||
                                    item.category.toLowerCase().includes('oferta') ||
                                    item.category.toLowerCase().includes('descuento')
                                );

                              // Debug logging to help identify issues
                              console.log('Cart item pricing debug:', {
                                itemName: item.name,
                                itemCategory: item.category,
                                hasPromotionalPricing,
                                itemPrice: item.price
                              });

                              if (hasPromotionalPricing) {
                                // For promotional products: show original price as striked, use stored discounted price
                                const originalPrice = item.originalPrice || item.price || 0;
                                const discountedPrice = item.price || 0;
                                const totalOriginal = originalPrice * item.quantity;
                                const totalDiscounted = discountedPrice * item.quantity;

                                return (
                                  <div className="space-y-1">
                                    {/* Total prices */}
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-gray-500 line-through">
                                        {formatCurrency(totalOriginal)}
                                      </span>
                                      <span className="text-sm font-bold text-red-600">
                                        {formatCurrency(totalDiscounted)}
                                      </span>
                                    </div>
                                    {/* Unit prices */}
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs text-gray-400 line-through">
                                        {formatCurrency(originalPrice)} c/u
                                      </span>
                                      <span className="text-xs text-red-500">
                                        {formatCurrency(discountedPrice)} c/u
                                      </span>
                                    </div>
                                    <div className="text-xs text-green-600 font-medium">
                                      30% OFF
                                    </div>
                                  </div>
                                );
                              } else {
                                // Regular pricing
                                return (
                                  <div>
                                    <p className="text-sm font-bold text-orange-600">
                                      {formatCurrency(item.price * item.quantity)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatCurrency(item.price)} c/u
                                    </p>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                         </div>

                         {/* Stepper and Remove Button */}
                         <div className="flex flex-col items-end space-y-2">
                           {/* Remove Button */}
                           <button
                             onClick={() => removeFromCart(item.id)}
                             className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                           >
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                             </svg>
                           </button>

                           {/* Quantity Controls */}
                           <div className="flex items-center">
                             <button
                               onClick={() => updateQuantity(item.id, item.quantity - 1)}
                               className="px-2 py-1.5 text-red-800 hover:bg-red-200 transition-colors rounded-l border border-red-600 bg-white"
                             >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                               </svg>
                             </button>
                             <span className="px-3 py-1.5 text-gray-900 min-w-[1.5rem] text-center font-semibold text-xs border-t border-b border-gray-300 bg-white">{item.quantity}</span>
                             <button
                               onClick={() => updateQuantity(item.id, item.quantity + 1)}
                               className="px-2 py-1.5 text-blue-800 hover:bg-blue-200 transition-colors rounded-r border border-blue-600 bg-white"
                             >
                               <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                               </svg>
                             </button>
                           </div>
                         </div>
                       </div>
                     </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex sm:items-center sm:space-x-3">
                      {/* Product Image */}
                      <div className="flex-shrink-0">
                        <div className="relative">
                          <img
                            src={getProcessedImageUrl(item.image || '/placeholder-product.svg')}
                            alt={item.name}
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 shadow-sm"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = '/placeholder-product.svg';
                            }}
                          />
                          <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {item.quantity}
                          </div>
                        </div>
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{item.name}</h3>
                            <div className="flex flex-col mt-1 space-y-1">
                              <div className="flex items-center space-x-4 text-xs">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-gray-700">Marca:</span>
                                  <span className="text-xs text-gray-800">
                                    {item.brand}
                                  </span>
                                </div>
                                {item.color && (
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-700">Color:</span>
                                    <span className="text-xs text-gray-800">
                                      {item.color}
                                    </span>
                                  </div>
                                )}
                                {item.subCategory && (
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-700">Subcategoría:</span>
                                    <span className="text-xs text-gray-800">
                                      {item.subCategory}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center space-x-4 text-xs">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-gray-700">Categoría:</span>
                                  <span className="text-xs text-gray-800">
                                    {(() => {
                                      // Handle both array and string categories
                                      if (Array.isArray(item.category)) {
                                        return item.category.join(', ');
                                      } else if (typeof item.category === 'string') {
                                        return item.category;
                                      }
                                      return 'N/A';
                                    })()}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-gray-700">Tipo:</span>
                                  <span className="text-xs text-gray-800">
                                    {item.type || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center">
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                    className="px-1.5 py-1 text-red-800 hover:bg-red-200 transition-colors rounded-l border border-red-600 bg-white"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                    </svg>
                                  </button>
                                  <span className="px-2 py-1 text-gray-900 min-w-[1.5rem] text-center font-semibold text-xs border-t border-b border-gray-300 bg-white">{item.quantity}</span>
                                  <button
                                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                    className="px-1.5 py-1 text-blue-800 hover:bg-blue-200 transition-colors rounded-r border border-blue-600 bg-white"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              <div className="text-right">
                                {(() => {
                                  // Check if this is a promotional product - check multiple possible category names
                                  const hasPromotionalPricing = item.category &&
                                    (Array.isArray(item.category) 
                                      ? item.category.some((cat: string) => 
                                          cat.toLowerCase().includes('promocion') || 
                                          cat.toLowerCase().includes('promotion') ||
                                          cat.toLowerCase().includes('oferta') ||
                                          cat.toLowerCase().includes('descuento')
                                        )
                                      : item.category.toLowerCase().includes('promocion') ||
                                        item.category.toLowerCase().includes('promotion') ||
                                        item.category.toLowerCase().includes('oferta') ||
                                        item.category.toLowerCase().includes('descuento')
                                    );

                                  // Debug logging to help identify issues
                                  console.log('Cart item pricing debug (desktop):', {
                                    itemName: item.name,
                                    itemCategory: item.category,
                                    hasPromotionalPricing,
                                    itemPrice: item.price
                                  });

                                  if (hasPromotionalPricing) {
                                    // For promotional products: show original price as striked, use stored discounted price
                                    const originalPrice = item.originalPrice || item.price || 0;
                                    const discountedPrice = item.price || 0;
                                    const totalOriginal = originalPrice * item.quantity;
                                    const totalDiscounted = discountedPrice * item.quantity;

                                    return (
                                      <div className="space-y-1">
                                        {/* Total prices */}
                                        <div className="flex items-center justify-end space-x-2">
                                          <span className="text-xs text-gray-500 line-through">
                                            {formatCurrency(totalOriginal)}
                                          </span>
                                          <span className="text-sm font-bold text-red-600">
                                            {formatCurrency(totalDiscounted)}
                                          </span>
                                        </div>
                                        {/* Unit prices */}
                                        <div className="flex items-center justify-end space-x-2">
                                          <span className="text-xs text-gray-400 line-through">
                                            {formatCurrency(originalPrice)} c/u
                                          </span>
                                          <span className="text-xs text-red-500">
                                            {formatCurrency(discountedPrice)} c/u
                                          </span>
                                        </div>
                                        <div className="text-xs text-green-600 font-medium text-right">
                                          30% OFF
                                        </div>
                                      </div>
                                    );
                                  } else {
                                    // Regular pricing
                                    return (
                                      <div>
                                        <p className="text-sm font-bold text-orange-600">
                                          {formatCurrency(item.price * item.quantity)}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {formatCurrency(item.price)} c/u
                                        </p>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            </div>
                          </div>
                          
                          {/* Remove Button */}
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Clear Cart Button */}
              <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                <button
                  onClick={clearCart}
                  className="inline-flex items-center px-3 py-2 text-gray-600 hover:text-red-600 transition-colors duration-200 font-medium text-sm border-b border-gray-300 hover:border-red-400"
                >
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Vaciar Carrito
                </button>
              </div>
            </div>


          </div>

          {/* Order Summary & Payment */}
          <div className="lg:col-span-1 space-y-3 sm:space-y-4 lg:space-y-6 order-2 lg:order-2">
            {/* Order Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Resumen del Pedido</h2>
              
              {/* Free Shipping Progress */}
              {needsShipping && (
                <div className="mb-3 sm:mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs sm:text-sm font-medium text-blue-900">
                      ¡Agrega {formatCurrency(remainingForFreeShipping)} más para envío gratis!
                    </span>
                    <span className="text-xs text-blue-600">
                      {Math.round(progressToFreeShipping)}%
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressToFreeShipping}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Shipping Status */}
              {!needsShipping && (
                <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm font-medium text-green-900">
                      ¡Envío gratis aplicado!
                    </span>
                  </div>
                </div>
              )}
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Subtotal ({getTotalItems()} productos)</span>
                  <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Envío</span>
                  <span className={`font-medium ${needsShipping ? 'text-gray-900' : 'text-green-600'}`}>
                    {needsShipping ? formatCurrency(shippingCost) : 'Gratis'}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3">
                  <div className="flex justify-between text-lg font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-orange-600">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              <Link 
                href="/checkout"
                className="w-full bg-orange-500 text-white py-3 sm:py-4 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors duration-200 mb-3 sm:mb-4 block text-center text-sm sm:text-base touch-manipulation"
              >
                Proceder al Pago
              </Link>

              <div className="text-xs text-gray-500 text-center">
                Al proceder, aceptas nuestros{' '}
                <Link href="/terminos-condiciones" className="text-orange-600 hover:underline">
                  términos y condiciones
                </Link>
              </div>
            </div>

            {/* Shipping Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
              <h3 className="text-sm sm:text-md font-semibold text-gray-900 mb-2 sm:mb-3">Información de Envío</h3>
              <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Envío gratis en pedidos superiores a {formatCurrency(shippingConfig.freeShippingThreshold)}</span>
                </div>
                <div className="flex items-start">
                  <svg className="w-4 h-4 text-blue-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Entrega en {shippingConfig.estimatedDays} días hábiles</span>
                </div>

              </div>
            </div>


          </div>
        </div>
      </div>
    </div>
  );
} 