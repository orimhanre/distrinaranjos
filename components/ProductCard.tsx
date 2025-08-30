'use client';
import React, { useState } from 'react';
import ProductModal from './ProductModal';
import { Product } from '../types';

// Cart functionality is now handled by @/lib/cartContext





// ============================================================================
// PRODUCT CARD COMPONENT
// ============================================================================

interface ProductCardProps {
  product: Product;
  className?: string;
}

export default function ProductCard({ product, className = '' }: ProductCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get the first image if it's an array, or use the single image
  const getProductImage = () => {
    let imagePath = '';
    
    // Handle both 'image', 'imageURL', and 'currentDisplayImage' properties
    // currentDisplayImage is used by AutoRotatingProductCard for rotating display
    const imageData = (product as any).currentDisplayImage || (product as any).imageURL || product.image;
    
    // Handle case where imageData is a string representation of an empty array "[]"
    if (imageData === '[]' || imageData === 'null' || imageData === null) {
      return '/placeholder-product.svg';
    }
    
    if (Array.isArray(imageData)) {
      imagePath = String(imageData[0] || '');
    } else {
      imagePath = String(imageData || '');
    }
    
    // Handle different URL formats
    if (imagePath && typeof imagePath === 'string') {
      // If it's already a full URL (starts with http/https), use it as is
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
      }
      
      // If it's a relative path that doesn't start with /images/products/, add the prefix
      if (!imagePath.startsWith('/images/products/')) {
        imagePath = `/images/products/${imagePath}`;
      }
    }
    
    const finalPath = imagePath || '/placeholder-product.svg';
    
    return finalPath;
  };

  // Clean product name by removing ID part (e.g., "1000 - LONCHERA" becomes "LONCHERA")
  const getCleanProductName = () => {
    if (!product.name) return '';
    // Remove ID pattern like "1000 - " from the beginning
    return product.name.replace(/^\d+\s*-\s*/, '');
  };



  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group ${className}`}>
      {/* Product Image */}
      <div className="relative">
        <div className="w-full h-48 bg-white group-hover:bg-gray-50 transition-colors duration-300 relative overflow-hidden flex items-center justify-center">
          <img
            src={getProductImage()}
            alt={product.name}
            className="max-w-full max-h-full w-auto h-auto object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              // Show placeholder icon and text
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `
                  <div class="flex flex-col items-center justify-center text-gray-400 h-full">
                    <svg class="w-12 h-12 mb-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-sm text-center">Sin Imagen</span>
                  </div>
                `;
              }
            }}
          />
        </div>

        {/* Brand Badge */}
        {product.brand && (
          <div className="absolute top-0 left-0">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {product.brand}
            </span>
          </div>
        )}
        
        {/* Stock Status Overlay */}
        {(() => {
          // For virtual products, use stock field; for regular products, use quantity field
          const stockLevel = product.stock !== undefined ? product.stock : (product.quantity || 0);
          
          if (stockLevel <= 0) {
            return (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-sm font-bold">
                  🔴 Agotado
                </div>
              </div>
            );
          } else if (stockLevel === 1) {
            return (
              <div className="absolute top-3 left-3">
                <div className="bg-orange-500 text-white px-2 py-1 rounded-lg text-xs font-bold">
                  ⚠️ Última unidad
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Category Badges */}
        {product.category && (
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
            {(() => {
              // Handle both array and string categories
              const categories = Array.isArray(product.category) ? product.category : [product.category];
              
              // Safety check for undefined/null categories
              if (!categories || categories.length === 0) {
                return null;
              }
              
              
              // Check for special attention-grabbing categories (priority)
              const specialCategories = ['popular', 'promoción', 'promocion', 'nuevo'];
              const hasSpecialCategory = categories.some(cat => 
                cat && specialCategories.includes(cat.toLowerCase())
              );
              
              // Get regular categories (non-special)
              const regularCategories = categories.filter(cat => 
                cat && !specialCategories.includes(cat.toLowerCase())
              );
              
              return (
                <>
                  {/* Special badges (top tier) */}
                  {hasSpecialCategory && (() => {
                    const specialCategory = categories.find(cat => 
                      cat && specialCategories.includes(cat.toLowerCase())
                    );
                    if (!specialCategory) return null;
                    const categoryLower = specialCategory.toLowerCase();
                    
                    if (categoryLower === 'popular') {
                      return (
                        <div className="flex flex-col items-center">
                          <div className="text-3xl drop-shadow-lg popular-star-animation">⭐</div>
                          <div className="text-xs font-bold text-white bg-black/50 px-1 rounded">Popular</div>
                          <style dangerouslySetInnerHTML={{
                            __html: `
                              .popular-star-animation {
                                animation: starRotateScale 2s ease-in-out infinite;
                              }
                              
                              @keyframes starRotateScale {
                                0% {
                                  transform: rotate(0deg) scale(1);
                                  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
                                }
                                25% {
                                  transform: rotate(90deg) scale(1.1);
                                  filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
                                }
                                50% {
                                  transform: rotate(180deg) scale(1.2);
                                  filter: drop-shadow(0 0 15px rgba(255, 215, 0, 1));
                                }
                                75% {
                                  transform: rotate(270deg) scale(1.1);
                                  filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8));
                                }
                                100% {
                                  transform: rotate(360deg) scale(1);
                                  filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.5));
                                }
                              }
                            `
                          }} />
                        </div>
                      );
                    }
                    
                    if (categoryLower === 'promoción' || categoryLower === 'promocion') {
                      return (
                        <div className="flex flex-col items-center">
                          <div className="text-3xl animate-bounce drop-shadow-lg">🔥</div>
                          <div className="text-xs font-bold text-white bg-red-600 px-1 rounded">Promoción</div>
                        </div>
                      );
                    }
                    
                    if (categoryLower === 'nuevo') {
                      return (
                        <div className="flex flex-col items-center">
                          <div className="text-3xl animate-pulse drop-shadow-lg">💎</div>
                          <div className="text-xs font-bold text-white bg-blue-600 px-1 rounded">Nuevo</div>
                        </div>
                      );
                    }
                  })()}
                  
                  {/* Regular category badges (bottom tier) */}
                  {regularCategories.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-end max-w-[120px]">
                      {regularCategories.map((category, index) => (
                        <span 
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-1 md:p-4">
        {/* Product Name */}
        <h3 className="font-semibold text-gray-900 text-xs leading-tight line-clamp-2 h-8 flex items-start">
          {getCleanProductName()}
        </h3>
        
        {/* Product Price */}
        <div className="mt-1 mb-3">
          {(() => {
            // Check if this is a promotional product
            const categories = Array.isArray(product.category) ? product.category : [product.category];
            const hasPromotionalPricing = categories.some((cat: string) => 
              cat && cat.toLowerCase().includes('promocion')
            );

            if (hasPromotionalPricing) {
              // For promotional products: show original price as striked, calculate 30% discounted price
              const originalPrice = product.price || 0;
              const discountedPrice = originalPrice * 0.7;

              return (
                <div className="space-y-1">
                  {/* Prices on same line: striked original + discounted */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-500 line-through">
                      ${originalPrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-red-600">
                      ${Math.round(discountedPrice).toLocaleString()}
                    </span>
                  </div>
                  {/* Discount percentage */}
                  <div className="text-xs text-green-600 font-medium">
                    30% OFF
                  </div>
                </div>
              );
            } else {
              // Regular pricing
              return (
                <span className="text-sm font-bold text-green-600">
                  ${product.price?.toLocaleString() || '0'}
                </span>
              );
            }
          })()}
        </div>
        
        {/* Ver Producto Button */}
        {(() => {
          // For virtual products, use stock field; for regular products, use quantity field
          const stockLevel = product.stock !== undefined ? product.stock : (product.quantity || 0);
          const isOutOfStock = stockLevel <= 0;
          
          return (
            <button
              onClick={() => {
                if (!isOutOfStock) {
                  setIsModalOpen(true);
                }
              }}
              className={`w-full mt-3 text-sm font-medium py-1 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 ${
                isOutOfStock
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              data-product-id={product.id}
              disabled={isOutOfStock}
            >
              {isOutOfStock ? (
                <>
                  <span>🔴</span>
                  <span>Agotado</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Ver Producto</span>
                </>
              )}
            </button>
          );
        })()}
      </div>

      {/* Product Modal */}
      <ProductModal
        product={product}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
} 