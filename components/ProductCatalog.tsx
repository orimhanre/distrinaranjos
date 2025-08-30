'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { fetchProductsFromDatabase } from '@/lib/databaseService';
import type { Product } from '@/types';
import { createPortal } from 'react-dom';

interface ProductCatalogProps {
  selectedPriceType: 'price1' | 'price2' | 'price';
  onAddToCart: (product: Product, quantity: number, selectedColor: string, buttonElement?: HTMLElement) => void;
  environment?: 'regular' | 'virtual';
}

export default function ProductCatalog({ selectedPriceType, onAddToCart, environment = 'regular' }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Initialize client-side state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({});
  const [selectedColors, setSelectedColors] = useState<{ [key: string]: string }>({});

  // Set client flag and load localStorage data
  useEffect(() => {
    setIsClient(true);
    
    // Load localStorage data only on client
    if (typeof window !== 'undefined') {
      const keyPrefix = selectedPriceType === 'price1' ? 'dn1' : 'dn2';
      
      const savedSearchTerm = localStorage.getItem(`searchTerm-${keyPrefix}`) || '';
      const savedBrand = localStorage.getItem(`selectedBrand-${keyPrefix}`);
      const savedQuantities = localStorage.getItem(`quantities-${keyPrefix}`);
      const savedColors = localStorage.getItem(`selectedColors-${keyPrefix}`);
      
      setSearchTerm(savedSearchTerm);
      setSelectedBrand(savedBrand ? JSON.parse(savedBrand) : null);
      setQuantities(savedQuantities ? JSON.parse(savedQuantities) : {});
      setSelectedColors(savedColors ? JSON.parse(savedColors) : {});
    }
  }, [selectedPriceType]);

  // Save search term to localStorage
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      const key = `searchTerm-${selectedPriceType === 'price1' ? 'dn1' : 'dn2'}`;
      localStorage.setItem(key, searchTerm);
    }
  }, [searchTerm, selectedPriceType, isClient]);

  // Save selected brand to localStorage
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      const key = `selectedBrand-${selectedPriceType === 'price1' ? 'dn1' : 'dn2'}`;
      localStorage.setItem(key, JSON.stringify(selectedBrand));
    }
  }, [selectedBrand, selectedPriceType, isClient]);

  // Save quantities to localStorage
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      const key = `quantities-${selectedPriceType === 'price1' ? 'dn1' : 'dn2'}`;
      localStorage.setItem(key, JSON.stringify(quantities));
    }
  }, [quantities, selectedPriceType, isClient]);

  // Save selected colors to localStorage
  useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      const key = `selectedColors-${selectedPriceType === 'price1' ? 'dn1' : 'dn2'}`;
      localStorage.setItem(key, JSON.stringify(selectedColors));
    }
  }, [selectedColors, selectedPriceType, isClient]);

  // Helper function to get all valid images from a product
  const getAllValidImages = (product: Product): string[] => {
    const isValidLocalUrl = (url: any): boolean => {
      if (!url || typeof url !== 'string') return false;
      const cleanUrl = url.trim();
      if (cleanUrl === '') return false;
      
      // Accept local paths starting with /
      if (cleanUrl.startsWith('/')) return true;
      
      // Accept Cloudinary URLs (for regular environment)
      if (cleanUrl.includes('res.cloudinary.com')) return true;
      
      // Accept Airtable URLs (for both virtual and regular environments)
      if (cleanUrl.includes('dl.airtable.com')) return true;
      
      // Reject other external URLs
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return false;
      }
      
      return false;
    };

    const validImages: string[] = [];

    // Check imageURL (primary field)
    if (product.imageURL && Array.isArray(product.imageURL)) {
      product.imageURL.forEach((image) => {
        if (typeof image === 'string' && isValidLocalUrl(image)) {
          validImages.push(image);
        } else if (typeof image === 'object' && image && 'url' in image) {
          const url = (image as any).url;
          if (isValidLocalUrl(url)) {
            validImages.push(url);
          }
        }
      });
    }

    return validImages;
  };

  // Fetch real products from internal database
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const databaseProducts = await fetchProductsFromDatabase(environment);
        
        // Products from database are already in the correct format
        const convertedProducts = databaseProducts;
        
        setProducts(convertedProducts);
        

        
        // Initialize quantities and colors for all products (only if not already set)
        const initialQuantities: { [key: string]: number } = { ...quantities };
        const initialColors: { [key: string]: string } = { ...selectedColors };
        
        convertedProducts.forEach((product: Product) => {
          if (!(product.id in initialQuantities)) {
            initialQuantities[product.id] = 1;
          }
          if (product.colors && product.colors.length > 0 && !(product.id in initialColors)) {
            initialColors[product.id] = product.colors[0];
          }
        });
        
        setQuantities(initialQuantities);
        setSelectedColors(initialColors);
      } catch (err) {
        setError('Error al cargar productos. Por favor intente de nuevo.');
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, []);

  // Get unique brands
  const availableBrands = [...new Set(products.map(p => p.brand).filter(brand => brand && brand.trim()))].sort();

  // Filter products based on search and selected brand
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchTerm === '' || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBrand = selectedBrand === null || product.brand === selectedBrand;
    
    return matchesSearch && matchesBrand;
  });

  // Sort products alphabetically when "Todos" is selected
  const sortedProducts = selectedBrand === null 
    ? filteredProducts.sort((a, b) => {
        // First sort by brand alphabetically
        const brandComparison = a.brand.localeCompare(b.brand);
        if (brandComparison !== 0) {
          return brandComparison;
        }
        // Then sort by name alphabetically within the same brand
        return a.name.localeCompare(b.name);
      })
    : filteredProducts.sort((a, b) => {
        // Sort by name alphabetically when a specific brand is selected
        return a.name.localeCompare(b.name);
      });

  // Group products by brand
  const productsByBrand = sortedProducts.reduce((acc, product) => {
    if (product.brand && product.brand.trim()) {
      if (!acc[product.brand]) {
        acc[product.brand] = [];
      }
      acc[product.brand].push(product);
    }
    return acc;
  }, {} as Record<string, Product[]>);

  const getProductCount = (brand: string) => {
    return products.filter(p => p.brand === brand).length;
  };

  // Format price with thousand separators using dots and no decimals
  const formatPrice = (price: number) => {
    return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const updateQuantity = (productId: string, change: number) => {
    setQuantities(prev => {
      const currentQuantity = prev[productId] || 1;
      const newQuantity = Math.max(1, Math.min(25, currentQuantity + change));
      return { ...prev, [productId]: newQuantity };
    });
  };

  const setQuantity = (productId: string, newQuantity: number) => {
    setQuantities(prev => {
      const validQuantity = Math.max(1, Math.min(25, newQuantity));
      return { ...prev, [productId]: validQuantity };
    });
  };

  const handleColorChange = (productId: string, color: string) => {
    setSelectedColors(prev => ({ ...prev, [productId]: color }));
  };

  const handleAddToCart = (product: Product, event?: React.MouseEvent<HTMLButtonElement>) => {
    const quantity = quantities[product.id] || 1;
    const selectedColor = selectedColors[product.id] || '';
    onAddToCart(product, quantity, selectedColor, event?.currentTarget);
    
    let price: number;
    if (environment === 'virtual') {
      // Virtual environment uses only 'price' field
      price = product.price || 0;
    } else {
      // Admin environment uses price1/price2
      if (selectedPriceType === 'price1') {
        price = product.price1 || 0;
      } else {
        price = product.price2 || 0;
      }
    }
    
    const subtotal = (price ?? 0) * quantity;
    const formattedSubtotal = Math.round(subtotal).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    // toast.success(`${product.name} agregado al carrito. Cantidad: ${quantity}, SubTotal Precio: $${formattedSubtotal}`); // Removed toast
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="border rounded-lg p-4 flex gap-4 items-center">
                <div className="w-20 h-20 bg-gray-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center py-8">
          <div className="text-red-500 text-lg mb-2">Error al Cargar Productos</div>
          <div className="text-gray-500 text-sm">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!isClient) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header with Search */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-2 sm:gap-0">
        <h2 className="text-2xl font-bold text-gray-900 w-full sm:w-auto mb-2 sm:mb-0">Catálogo de Productos</h2>
        {isClient && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <span className="sr-only">Buscar Productos</span>
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border-2 border-gray-300 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64 bg-white text-gray-900 placeholder-gray-400 transition-all"
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4-4m0 0A7 7 0 104 4a7 7 0 0013 13z" />
                </svg>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Brand Buttons */}
      {isClient && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-1 sm:gap-2">
            <button
              onClick={() => setSelectedBrand(null)}
              className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full border transition-all text-xs sm:text-sm ${
                selectedBrand === null
                  ? selectedPriceType === 'price1' 
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Todos ({products.length})
            </button>
            {availableBrands.filter(brand => brand && brand.trim()).map(brand => (
              <button
                key={brand || `brand-${Math.random()}`}
                onClick={() => setSelectedBrand(brand)}
                className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full border transition-all text-xs sm:text-sm ${
                  selectedBrand === brand
                    ? selectedPriceType === 'price1'
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {brand} ({getProductCount(brand)})
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Products Display */}
      {sortedProducts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No se encontraron productos que coincidan con tu búsqueda.
        </div>
      ) : selectedBrand === null ? (
        // Group view - show products grouped by brand
        <div className="space-y-8">
          {Object.entries(productsByBrand)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([brand, brandProducts]) => (
              <div key={brand} className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
                  {brand} ({brandProducts.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {brandProducts.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      selectedPriceType={selectedPriceType}
                      quantity={quantities[product.id] || 1}
                      selectedColor={selectedColors[product.id] || (product.colors?.[0] || '')}
                      onUpdateQuantity={updateQuantity}
                      onSetQuantity={setQuantity}
                      onColorChange={handleColorChange}
                      onAddToCart={handleAddToCart}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>
      ) : (
        // Single brand view
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              selectedPriceType={selectedPriceType}
              quantity={quantities[product.id] || 1}
              selectedColor={selectedColors[product.id] || (product.colors?.[0] || '')}
              onUpdateQuantity={updateQuantity}
              onSetQuantity={setQuantity}
              onColorChange={handleColorChange}
              onAddToCart={handleAddToCart}
              formatPrice={formatPrice}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Product Card Component
interface ProductCardProps {
  product: Product;
  selectedPriceType: 'price1' | 'price2' | 'price';
  quantity: number;
  selectedColor: string;
  onUpdateQuantity: (productId: string, change: number) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onColorChange: (productId: string, color: string) => void;
  onAddToCart: (product: Product, event: React.MouseEvent<HTMLButtonElement>) => void;
  formatPrice: (price: number) => string;
}

function ProductCard({
  product,
  selectedPriceType,
  quantity,
  selectedColor,
  onUpdateQuantity,
  onSetQuantity,
  onColorChange,
  onAddToCart,
  formatPrice
}: ProductCardProps) {
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  
  const price = selectedPriceType === 'price1' ? (product.price1 || 0) : (product.price2 || 0);
  const subtotal = price * quantity;
  
  // Fix image URL extraction with proper safety checks
  const getImageUrl = (product: Product) => {
    // Helper function to validate URLs
    const isValidLocalUrl = (url: any): boolean => {
      if (!url || typeof url !== 'string') return false;
      const cleanUrl = url.trim();
      if (cleanUrl === '') return false;
      
      // Accept local paths starting with /
      if (cleanUrl.startsWith('/')) return true;
      
      // Accept Cloudinary URLs (for regular environment)
      if (cleanUrl.includes('res.cloudinary.com')) return true;
      
      // Accept Airtable URLs (for both virtual and regular environments)
      if (cleanUrl.includes('dl.airtable.com')) return true;
      
      // Reject other external URLs
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return false;
      }
      
      return false;
    };

    // Check imageURL (primary field)
    if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
      const firstImage = product.imageURL[0];
      if (typeof firstImage === 'string' && isValidLocalUrl(firstImage)) {
        return firstImage;
      }
      if (typeof firstImage === 'object' && firstImage && 'url' in firstImage) {
        const url = (firstImage as any).url;
        if (isValidLocalUrl(url)) {
          return url;
        }
      }
    }
    
    // Handle case where imageURL is empty or null
    if (!product.imageURL || 
        (Array.isArray(product.imageURL) && product.imageURL.length === 0)) {
      return '/placeholder-product.svg';
    }
    
    // Fallback to placeholder
    return '/placeholder-product.svg';
  };
  
  const primaryImageUrl = getImageUrl(product);
  
  // Get all product images
  const getAllProductImages = () => {
    const isValidLocalUrl = (url: any): boolean => {
      if (!url || typeof url !== 'string') return false;
      const cleanUrl = url.trim();
      if (cleanUrl === '') return false;
      
      // Accept local paths starting with /
      if (cleanUrl.startsWith('/')) return true;
      
      // Accept Cloudinary URLs (for regular environment)
      if (cleanUrl.includes('res.cloudinary.com')) return true;
      
      // Accept Airtable URLs (for both virtual and regular environments)
      if (cleanUrl.includes('dl.airtable.com')) return true;
      
      // Reject other external URLs
      if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
        return false;
      }
      
      return false;
    };

    const validImages: string[] = [];

    // Check imageURL (primary field)
    if (product.imageURL && Array.isArray(product.imageURL)) {
      product.imageURL.forEach((image) => {
        if (typeof image === 'string' && isValidLocalUrl(image)) {
          validImages.push(image);
        } else if (typeof image === 'object' && image && 'url' in image) {
          const url = (image as any).url;
          if (isValidLocalUrl(url)) {
            validImages.push(url);
          }
        }
      });
    }

    // If no valid images found, return placeholder
    return validImages.length > 0 ? validImages : ['/placeholder-product.svg'];
  };

  const allProductImages = getAllProductImages();
  
  const priceColor = selectedPriceType === 'price1' ? 'text-green-600' : 'text-blue-600';
  const buttonColor = selectedPriceType === 'price1' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700';


  




  // SSR-safe order form detection and client flag
  const [isOrderForm, setIsOrderForm] = useState(false);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    const path = window.location.pathname.toLowerCase();
    setIsOrderForm(path.includes('/distrinaranjos1') || path.includes('/naranjos2'));
  }, []);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between relative h-auto"> 
      {/* Card Row Layout */}
      <div className="flex flex-row items-center gap-4">
        {/* Product Image on the left */}
        <div className="flex-shrink-0 flex items-center justify-center relative">
          <div 
            className="w-20 h-20 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors"
            onClick={() => {
              setSelectedImage(primaryImageUrl);
              setCurrentImageIndex(0);
              setShowImageModal(true);
            }}
          >
            <img
              src={primaryImageUrl}
              alt={product.name}
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                                      // Failed to load image, using placeholder
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                // Show placeholder icon and text
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `
                    <div class="flex flex-col items-center justify-center text-gray-400">
                      <svg class="w-8 h-8 mb-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                      </svg>
                      <span class="text-xs text-center">Sin Imagen</span>
                    </div>
                  `;
                }
              }}
            />
          </div>
        </div>
        {/* Product Info on the right, vertical column */}
        <div className="flex-1 flex flex-col justify-between h-auto">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight mb-1">{product.name}</h3>
          <p className="text-xs text-gray-600 mb-2">{product.brand}</p>
          <div className="flex flex-col gap-1 justify-between h-auto">
            {/* Color Dropdown */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center mb-0.5">
                <label className="text-xs font-medium text-black mr-2" htmlFor={`color-select-${product.id}`}>Color:</label>
                <div className="relative">
                  <select
                    id={`color-select-${product.id}`}
                    value={selectedColor}
                    onChange={e => onColorChange(product.id, e.target.value)}
                    className="border-2 border-gray-300 rounded-lg px-3 py-1 text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer shadow-sm hover:shadow-md min-w-[80px]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {product.colors.map(color => (
                      <option key={color} value={color} style={{ color: 'black' }}>{color}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {/* Quantity Dropdown */}
            <div className="flex items-center mb-0.5">
              <label className="text-xs font-medium text-black mr-2" htmlFor={`qty-select-${product.id}`}>Cantidad:</label>
              <div className="relative">
                <select
                  id={`qty-select-${product.id}`}
                  value={quantity}
                  onChange={e => onSetQuantity(product.id, Number(e.target.value))}
                  className="border-2 border-gray-300 rounded-lg px-3 py-1 text-sm text-black bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 appearance-none cursor-pointer shadow-sm hover:shadow-md min-w-[80px]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                >
                  {Array.from({ length: 25 }, (_, i) => i + 1).map(num => (
                    <option key={num} value={num} style={{ color: 'black' }}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Precio */}
            <div className="flex items-center mb-0.5">
              <span className="text-xs font-medium text-black mr-2">Precio:</span>
                             <span className={`text-xs font-bold ${priceColor}`}>${formatPrice(price ?? 0)}</span>
            </div>
            {/* SubTotal and Add to Cart Button in a row */}
            <div className="flex items-center justify-between mt-1 mb-0 gap-2">
              <div className="flex items-center">
                <span className="text-xs font-medium text-black mr-2">SubTotal:</span>
                <span className={`text-base font-bold ${priceColor}`}>${formatPrice(subtotal)}</span>
              </div>
              <button
                data-add-to-cart-button
                onClick={(e) => onAddToCart(product, e)}
                className={`py-1.5 px-3 rounded font-bold text-white text-xs transition-colors flex-shrink-0 ${buttonColor}`}
                style={{ minWidth: '72px' }}
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
        


      </div>
      
      {/* Image Modal */}
      {showImageModal && selectedImage && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[999999] p-2 sm:p-4"
          style={{ 
            position: 'fixed', 
            zIndex: 999999,
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
          onClick={() => setShowImageModal(false)}
        >
          {/* Modal Content Container - Fits Photo Tightly */}
          <div className="relative inline-block max-w-[95vw] max-h-[95vh]">
            {/* Main Image Container */}
            <div className="relative">
              {/* Close Button - Top Right of Photo */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImageModal(false);
                }}
                className="absolute top-2 right-2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full w-8 h-8 flex items-center justify-center transition-all duration-200"
              >
                ×
              </button>

              {/* Navigation Arrows - Left and Right of Photo */}
              {allProductImages.length > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : allProductImages.length - 1;
                      setCurrentImageIndex(newIndex);
                      setSelectedImage(allProductImages[newIndex]);
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200"
                  >
                    ‹
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newIndex = currentImageIndex < allProductImages.length - 1 ? currentImageIndex + 1 : 0;
                      setCurrentImageIndex(newIndex);
                      setSelectedImage(allProductImages[newIndex]);
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200"
                  >
                    ›
                  </button>
                </>
              )}

              {/* Main Image */}
              <img
                src={selectedImage}
                alt={product.name}
                className="max-w-[90vw] max-h-[80vh] sm:max-w-[80vw] sm:max-h-[75vh] object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                onError={(e) => {
                  e.currentTarget.src = '/placeholder-image.png';
                }}
              />

              {/* Image Previews - Inside Photo Area */}
              {allProductImages.length > 1 && (
                <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex justify-center gap-2 bg-black bg-opacity-30 backdrop-blur-sm rounded-lg p-2">
                  {allProductImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(index);
                        setSelectedImage(image);
                      }}
                      className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all duration-200 ${
                        index === currentImageIndex
                          ? 'border-white scale-110'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={image}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-image.png';
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}