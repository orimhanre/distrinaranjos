'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { fetchProductsFromDatabase, fetchWebPhotos } from '@/lib/databaseService';
import { useCart } from '@/lib/cartContext';
import { Product } from '@/types';

// Logo mapping function - Dynamic from webphotos
const getLogoPath = (brand: string, webPhotos: Record<string, string>) => {
  const brandLower = brand.toLowerCase();
  
  // WebPhotos are stored with "logo_" prefix (e.g., "logo_massnu", "logo_reno", etc.)
  const logoKey = `logo_${brandLower}`;
  
  if (webPhotos && webPhotos[logoKey]) {
    console.log(`✅ Found logo for ${brand}: ${logoKey} -> ${webPhotos[logoKey]}`);
    return webPhotos[logoKey];
  }
  
  // If no logo found in database, use a generic placeholder
  console.log(`⚠️ No logo found for ${brand}, using placeholder`);
  return '/placeholder-image.png';
};

interface DropdownProps {
  items: string[];
  title: string;
  baseUrl: string;
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  webPhotos: Record<string, string>;
}

interface CategoryWithSubcategories {
  category: string;
  subcategories: string[];
}

function Dropdown({ items, title, baseUrl, isOpen, onMouseEnter, onMouseLeave, webPhotos }: DropdownProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-full left-0 bg-white/95 backdrop-blur-md shadow-xl border border-gray-100 rounded-xl py-2 min-w-[200px] w-fit z-50 transform transition-all duration-300 ease-out"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {items.map((item, index) => (
        <div key={index}>
          <Link
            href={`${baseUrl}/${encodeURIComponent(item)}`}
            className={`block px-4 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 flex items-center ${
              index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
            }`}
          >
            {title === "Marcas" && (
              <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center mr-3 bg-white">
                <img 
                  src={getLogoPath(item, webPhotos)} 
                  alt={`${item} logo`}
                  className="w-4 h-4 object-contain"
                  onError={(e) => {
                    // Hide the image if it doesn't exist
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            {item}
          </Link>
          {index < items.length - 1 && (
            <div className="border-b border-gray-100 mx-3 my-1"></div>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryDropdown({ categories, isOpen, onMouseEnter, onMouseLeave }: {
  categories: CategoryWithSubcategories[];
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [isDropdownHovered, setIsDropdownHovered] = useState(false);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-full left-0 bg-white/95 backdrop-blur-md shadow-xl border border-gray-100 rounded-xl py-2 min-w-[200px] w-fit z-50 transform transition-all duration-300 ease-out"
      onMouseEnter={() => {
        onMouseEnter();
        setIsDropdownHovered(true);
      }}
      onMouseLeave={() => {
        onMouseLeave();
        setIsDropdownHovered(false);
        setHoveredCategory(null);
      }}
    >
      {/* Categories Column */}
      {categories.map((cat, index) => (
        <div key={index} className="relative">
          <div
            className="block px-4 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 flex items-center justify-between cursor-pointer"
            onMouseEnter={() => setHoveredCategory(cat.category)}
            onMouseLeave={() => {
              // Only clear if we're not hovering the submenu
              setTimeout(() => {
                if (!isDropdownHovered) {
                  setHoveredCategory(null);
                }
              }, 50);
            }}
          >
            <Link href={`/categoria/${encodeURIComponent(cat.category)}`} className="flex-1">
              {cat.category}
            </Link>
            {cat.subcategories.length > 0 && (
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
          
          {/* Subcategories Submenu */}
          {hoveredCategory === cat.category && cat.subcategories.length > 0 && (
            <>
              {/* Invisible bridge to prevent gap - wider and more reliable */}
              <div 
                className="absolute left-full top-0 w-4 h-full bg-transparent"
                onMouseEnter={() => setHoveredCategory(cat.category)}
                onMouseLeave={() => {
                  setTimeout(() => {
                    if (!isDropdownHovered) {
                      setHoveredCategory(null);
                    }
                  }, 100);
                }}
              />
              <div 
                className="absolute left-full top-0 bg-white/95 backdrop-blur-md shadow-xl border border-gray-100 rounded-xl py-2 min-w-[160px] z-50"
                onMouseEnter={() => setHoveredCategory(cat.category)}
                onMouseLeave={() => {
                  setTimeout(() => {
                    if (!isDropdownHovered) {
                      setHoveredCategory(null);
                    }
                  }, 100);
                }}
              >
                {cat.subcategories.map((subcat, subIndex) => (
                  <div key={subIndex}>
                    <Link
                      href={`/categoria/subcategoria/${encodeURIComponent(subcat)}`}
                      className="block px-4 py-2 text-gray-600 hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:text-blue-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 text-sm"
                    >
                      {subcat}
                    </Link>
                    {subIndex < cat.subcategories.length - 1 && (
                      <div className="border-b border-gray-100 mx-3 my-1"></div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {index < categories.length - 1 && (
            <div className="border-b border-gray-100 mx-3 my-1"></div>
          )}
        </div>
      ))}
    </div>
  );
}

// MobileDropdown function removed since we're using horizontal navigation instead

export default function Header() {
  const [brandsOpen, setBrandsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [brands, setBrands] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoriesWithSubcategories, setCategoriesWithSubcategories] = useState<CategoryWithSubcategories[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isDistriPage, setIsDistriPage] = useState(false);
  const [shippingConfig, setShippingConfig] = useState({
    freeShippingThreshold: 200000, // Default fallback
    shippingCost: 15000
  });
  const { getTotalItems, getTotalPrice, cartItems, addToCart } = useCart();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount).replace(/\$\s+/, '$');
  };

  // Calculate free shipping message
  const getFreeShippingMessage = (): string | { plus: string; amount: string; text: string; } => {
    const currentTotal = getTotalPrice();
    const remaining = shippingConfig.freeShippingThreshold - currentTotal;
    
    if (remaining <= 0) {
      return "¡Envío gratis!";
    } else {
      return {
        plus: "+ ",
        amount: formatCurrency(remaining),
        text: " = Envío Gratis"
      };
    }
  };

  // Mobile dropdown states for expandable sections
  const [mobileBrandsOpen, setMobileBrandsOpen] = useState(false);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [mobileTypesOpen, setMobileTypesOpen] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);

  // Check if we're on distri1 or naranjos2 pages
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isDistri = pathname === '/distri1' || pathname === '/naranjos2';
      setIsDistriPage(isDistri);
  
    }
  }, []);

  // Reload data when page type changes
  useEffect(() => {
    if (isDistriPage !== undefined) {

      loadData();
    }
  }, [isDistriPage]);

  // Listen for sync completion events
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('🔄 Header: Sync completed, refreshing dropdown data...');
      loadData();
    };

    // Listen for custom sync events
    window.addEventListener('airtable-sync-complete', handleSyncComplete);
    window.addEventListener('virtual-sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('airtable-sync-complete', handleSyncComplete);
      window.removeEventListener('virtual-sync-complete', handleSyncComplete);
    };
  }, []);

  // Listen for cart changes and trigger bounce animation
  useEffect(() => {
    if (cartItems.length > 0) {
      setCartBounce(true);
      const timer = setTimeout(() => setCartBounce(false), 600);
      return () => clearTimeout(timer);
    }
  }, [cartItems.length]);

  const loadData = async () => {
    try {
      // Load WebPhotos from appropriate environment based on current page
      try {
        const environment = isDistriPage ? 'regular' : 'virtual';
    
        const photos = await fetchWebPhotos();
        setWebPhotos(photos);
      } catch (webPhotosError) {
        console.warn('Failed to load WebPhotos, using empty object:', webPhotosError);
        setWebPhotos({});
      }

      // Fetch shipping configuration
      try {
        const shippingResponse = await fetch('/api/shipping-config', {
          cache: 'no-store'
        });
        if (shippingResponse.ok) {
          const config = await shippingResponse.json();
          setShippingConfig(config);
        }
      } catch (error) {
        console.error('Error fetching shipping config:', error);
      }
      
      try {
        const products = await fetchProductsFromDatabase();
      
      // Extract unique categories
      const allCategories = products.flatMap((p: Product) => {
        if (Array.isArray(p.category)) return p.category;
        if (typeof p.category === 'string' && p.category.trim()) return [p.category];
        return [];
      });
      const uniqueCategories = Array.from(new Set(allCategories.map((c: string) => c.trim()).filter(Boolean)));
      const sortedCategories = uniqueCategories.sort((a: string, b: string) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
      setCategories(sortedCategories);

      // Extract subcategories and organize them with categories
      const categorySubcategoryMap = new Map<string, Set<string>>();
      
      products.forEach((p: Product) => {
        const productCategories = Array.isArray(p.category) ? p.category : [p.category];
        const productSubcategories = Array.isArray(p.subCategory) ? p.subCategory : [p.subCategory];
        
        productCategories.forEach((cat: string | undefined) => {
          if (cat && cat.trim()) {
            if (!categorySubcategoryMap.has(cat)) {
              categorySubcategoryMap.set(cat, new Set());
            }
            
            productSubcategories.forEach((subcat: string | undefined) => {
              if (subcat && subcat.trim() && subcat !== 'null') {
                categorySubcategoryMap.get(cat)!.add(subcat);
              }
            });
          }
        });
      });
      
      // Fetch defined category-subcategory relations from the database
      const relationsResponse = await fetch('/api/database/virtual-category-relations');
      let definedRelations: any[] = [];
      
      if (relationsResponse.ok) {
        const relationsData = await relationsResponse.json();
        if (relationsData.success) {
          definedRelations = relationsData.relations || [];
        }
      }
      
      // Create a map of defined relations
      const definedRelationsMap = new Map<string, Set<string>>();
      definedRelations.forEach((relation: any) => {
        if (relation.isActive && relation.category && relation.subcategory) {
          if (!definedRelationsMap.has(relation.category)) {
            definedRelationsMap.set(relation.category, new Set());
          }
          definedRelationsMap.get(relation.category)!.add(relation.subcategory);
        }
      });
      
      // Only show subcategories that have defined relations
      const categoriesWithSubs = sortedCategories.map(category => ({
        category,
        subcategories: Array.from(definedRelationsMap.get(category) || []).sort()
      }));
      
      setCategoriesWithSubcategories(categoriesWithSubs);

      // Extract unique brands
      const allBrands = products.flatMap((p: Product) => {
        if (Array.isArray(p.brand)) return p.brand;
        if (typeof p.brand === 'string' && p.brand.trim()) return [p.brand];
        return [];
      });
      let uniqueBrands = Array.from(new Set(allBrands.map((b: string) => b.trim()).filter(Boolean)));
      // Ensure 'Massnu' is always first
      const massnuIndex = uniqueBrands.findIndex((b: string) => b.toLowerCase() === 'massnu');
      if (massnuIndex > 0) {
        const [massnu] = uniqueBrands.splice(massnuIndex, 1);
        uniqueBrands = [massnu, ...uniqueBrands];
      }
      setBrands(uniqueBrands);

      // Extract unique types
      const allTypes = products.flatMap((p: Product) => {
        if (Array.isArray(p.type)) return p.type;
        if (typeof p.type === 'string' && p.type.trim()) return [p.type];
        return [];
      });
      const uniqueTypes = Array.from(new Set(allTypes.map((t: string) => t.trim()).filter(Boolean)));
      const sortedTypes = uniqueTypes.sort((a: string, b: string) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
      setTypes(sortedTypes);
      } catch (productsError) {
        console.error('Error fetching products:', productsError);
        // Set empty arrays to prevent UI errors
        setCategories([]);
        setBrands([]);
        setTypes([]);
        setCategoriesWithSubcategories([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get cart count reactively
  const cartItemCount = getTotalItems();

  // Function to close all mobile dropdowns
  const closeAllMobileDropdowns = () => {
    setMobileBrandsOpen(false);
    setMobileCategoriesOpen(false);
    setMobileTypesOpen(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // No mobile menu overflow control needed anymore

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-black shadow-md w-full">
        <div className="max-w-7xl mx-auto pl-4 sm:pl-6 lg:pl-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-6">
                <img
                  src={webPhotos['logo_distrinaranjos'] || '/images/webphotos/logo_distrinaranjos.png'}
                  alt="DistriNaranjos logo"
                  width={60}
                  height={60}
                  className="object-contain"
                  onError={(e) => {
                    console.warn('Failed to load DistriNaranjos logo');
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="text-xl sm:text-2xl font-bold text-orange-500/80">
                  DistriNaranjos
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8 items-center">
              
              {/* Marcas Dropdown */}
              {!isDistriPage && (
                <div 
                  className="relative"
                  onMouseEnter={() => setBrandsOpen(true)}
                  onMouseLeave={() => setBrandsOpen(false)}
                >
                  <button className="text-white hover:text-gray-200 transition-colors duration-200 font-bold flex items-center">
                    Marcas
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <Dropdown
                    items={brands}
                    title="Marcas"
                    baseUrl="/marca"
                    isOpen={brandsOpen}
                    onMouseEnter={() => setBrandsOpen(true)}
                    onMouseLeave={() => setBrandsOpen(false)}
                    webPhotos={webPhotos}
                  />
                </div>
              )}

              {/* Categorías Dropdown */}
              {!isDistriPage && (
                <div 
                  className="relative"
                  onMouseEnter={() => setCategoriesOpen(true)}
                  onMouseLeave={() => setCategoriesOpen(false)}
                >
                  <button className="text-white hover:text-gray-200 transition-colors duration-200 font-bold flex items-center">
                    Categorías
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <CategoryDropdown
                    categories={categoriesWithSubcategories}
                    isOpen={categoriesOpen}
                    onMouseEnter={() => setCategoriesOpen(true)}
                    onMouseLeave={() => setCategoriesOpen(false)}
                  />
                </div>
              )}
              
              {/* Tipos Dropdown */}
              {!isDistriPage && (
                <div 
                  className="relative"
                  onMouseEnter={() => setTypesOpen(true)}
                  onMouseLeave={() => setTypesOpen(false)}
                >
                  <button className="text-white hover:text-gray-200 transition-colors duration-200 font-bold flex items-center">
                    Tipos
                    <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <Dropdown
                    items={types}
                    title="Tipos"
                    baseUrl="/tipo"
                    isOpen={typesOpen}
                    onMouseEnter={() => setTypesOpen(true)}
                    onMouseLeave={() => setTypesOpen(false)}
                    webPhotos={webPhotos}
                  />
                </div>
              )}

              <Link href="/contacto" className="text-white hover:text-gray-200 transition-colors duration-200 font-bold">
                Contacto
              </Link>
              {!isDistriPage && (
                <Link href="/client-portal/login" className="flex items-center space-x-2 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-2 py-1 rounded-lg transition-all duration-200 hover:shadow-lg hover:scale-105 text-sm">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Mi Cuenta</span>
                </Link>
              )}
              
              {/* Cart Icon */}
              {!isDistriPage && (
                <div className="relative hidden md:block">
                  <Link href="/cart" className="text-white hover:text-gray-200 transition-colors duration-200 font-bold relative flex items-center justify-center">
                    <div className="relative">
                      <img 
                        src="/cart.png" 
                        alt="Cart" 
                        className={`w-8 h-8 object-contain ${cartBounce ? 'animate-bounce' : ''}`}
                        style={{ filter: 'brightness(0) saturate(100%) invert(1)' }}
                        onError={(e) => {
                          // Fallback to SVG if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `
                              <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2 2H9a2 2 0 00-2 2v4.01" />
                              </svg>
                            `;
                          }
                        }}
                      />
                      {cartItemCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center font-bold">
                          {cartItemCount > 99 ? '99+' : cartItemCount}
                        </span>
                      )}
                    </div>
                  </Link>

                </div>
              )}
            </nav>

            {/* Mobile navigation - show Contacto and Mi Cuenta */}
            <div className="md:hidden flex space-x-3 pr-3">
              <Link
                href="/contacto"
                className="text-white hover:text-gray-200 transition-colors duration-200 font-medium text-xs"
              >
                Contacto
              </Link>
              {!isDistriPage && (
                <Link
                  href="/client-portal/login"
                  className="flex items-center space-x-1 bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-2 py-1 rounded-md transition-all duration-200 hover:shadow-lg hover:scale-105 text-xs"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Mi Cuenta</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation - Main navigation bar - Outside header for full width */}
      <div className="md:hidden border-t border-orange-500/30 fixed left-0 right-0 z-35" style={{ backgroundColor: '#1f2937', top: '72px', width: '100%', maxWidth: '100vw' }}>
        <div className="overflow-x-auto scrollbar-hide" style={{ overflow: 'visible' }}>
          <div className="flex space-x-1 pl-3 pr-2 py-1 min-w-max justify-between items-center" style={{ overflow: 'visible' }}>
            <div className="flex space-x-1">
                  {/* Marcas dropdown button */}
                  {!isDistriPage && (
                    <button
                      onClick={() => {
                        setMobileBrandsOpen(!mobileBrandsOpen);
                        setMobileCategoriesOpen(false);
                        setMobileTypesOpen(false);
                      }}
                      className="px-3 py-1 text-white hover:text-gray-200 transition-colors duration-200 font-medium text-sm whitespace-nowrap rounded-lg hover:bg-orange-500/20 flex items-center"
                    >
                      Marcas
                      <svg className={`ml-2 w-3 h-2 transition-transform duration-200 ${mobileBrandsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  {/* Categorías dropdown button */}
                  {!isDistriPage && (
                    <button
                      onClick={() => {
                        setMobileCategoriesOpen(!mobileCategoriesOpen);
                        setMobileBrandsOpen(false);
                        setMobileTypesOpen(false);
                      }}
                      className="px-3 py-1.5 text-white hover:text-gray-200 transition-colors duration-200 font-medium text-sm whitespace-nowrap rounded-lg hover:bg-orange-500/20 flex items-center"
                    >
                      Categorías
                      <svg className={`ml-1 w-3 h-3 transition-transform duration-200 ${mobileCategoriesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}

                  {/* Tipos dropdown button */}
                  {!isDistriPage && (
                    <button
                      onClick={() => {
                        setMobileTypesOpen(!mobileTypesOpen);
                        setMobileBrandsOpen(false);
                        setMobileCategoriesOpen(false);
                      }}
                      className="px-3 py-1.5 text-white hover:text-gray-800 transition-colors duration-200 font-medium text-sm whitespace-nowrap rounded-lg hover:bg-orange-500/20 flex items-center"
                    >
                      Tipos
                      <svg className={`ml-1 w-3 h-3 transition-transform duration-200 ${mobileTypesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
            </div>
            
            {/* Cart Icon on the right side */}
            {!isDistriPage && (
              <div className="relative mr-2 mobile-cart-container">
                <Link href="/cart" className="bg-black text-white hover:bg-gray-800 transition-colors duration-200 relative flex items-center justify-center p-2 rounded-full">
                  <div className="relative">
                    <img 
                      src="/cart.png" 
                      alt="Cart" 
                      className={`w-6 h-6 object-contain ${cartBounce ? 'animate-bounce' : ''}`}
                      style={{ filter: 'brightness(0) saturate(100%) invert(1)' }}
                      onError={(e) => {
                        // Fallback to SVG if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2 2v4.01" />
                            </svg>
                          `;
                        }
                      }}
                    />
                    {cartItemCount > 0 && (
                      <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold z-10 mobile-cart-badge">
                        {cartItemCount > 99 ? '99+' : cartItemCount}
                      </span>
                    )}
                  </div>
                </Link>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Overlays - Transparent overlay for closing */}
      {!isDistriPage && (mobileBrandsOpen || mobileCategoriesOpen || mobileTypesOpen) && (
        <div 
          className="md:hidden fixed inset-0 z-30"
          onClick={closeAllMobileDropdowns}
          style={{ top: '97px', backgroundColor: 'transparent', width: '100%', maxWidth: '100vw' }}
        />
      )}

      {/* Mobile Dropdown Menus - Positioned outside header */}
      {!isDistriPage && mobileBrandsOpen && (
        <div 
          className="md:hidden fixed left-0 right-0 z-40 bg-white shadow-lg border-t border-gray-200 max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '100vw', top: '112px' }}
        >
          <div className="py-2">
            {brands.length === 0 && <div className="px-8 py-2 text-gray-500">Cargando marcas...</div>}
            {brands.filter(brand => brand && brand.trim()).map((brand, index) => (
              <Link
                key={brand || `brand-${index}`}
                href={`/marca/${encodeURIComponent(brand)}`}
                onClick={closeAllMobileDropdowns}
                className={`block px-4 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 flex items-center border-b border-gray-100 last:border-b-0 ${
                  index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
                }`}
              >
                <div className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center mr-3 bg-white">
                  <img 
                    src={getLogoPath(brand, webPhotos)} 
                    alt={`${brand} logo`}
                    className="w-4 h-4 object-contain"
                    onError={(e) => {
                      // Hide the image if it doesn't exist
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                {brand}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Categorías Dropdown */}
      {!isDistriPage && mobileCategoriesOpen && (
        <div 
          className="md:hidden fixed left-0 right-0 z-40 bg-white shadow-lg border-t border-gray-200 max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%', maxWidth: '100vw', top: '112px' }}
        >
          <div className="py-2">
            {categories.length === 0 && <div className="px-4 py-2 text-gray-500">Cargando categorías...</div>}
            {categories.filter(category => category && category.trim()).map((category, index) => (
              <Link
                key={category || `category-${index}`}
                href={`/categoria/${encodeURIComponent(category)}`}
                onClick={closeAllMobileDropdowns}
                className={`block px-4 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 flex items-center border-b border-gray-100 last:border-b-0 ${
                  index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
                }`}
              >
                {category}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Tipos Dropdown */}
      {!isDistriPage && mobileTypesOpen && (
        <div 
          className="md:hidden fixed left-0 right-0 z-40 bg-white shadow-lg border-t border-gray-200 max-h-64 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
          style={{ top: '112px' }}
        >
          <div className="py-2">
            {types.length === 0 && <div className="px-2 py-2 text-gray-500">Cargando tipos...</div>}
            {types.filter(type => type && type.trim()).map((type, index) => (
              <Link
                key={type || `type-${index}`}
                href={`/tipo/${encodeURIComponent(type)}`}
                onClick={closeAllMobileDropdowns}
                className={`block px-4 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-orange-50 hover:to-orange-100 hover:text-orange-600 transition-all duration-200 font-['Calibri'] rounded-lg mx-2 flex items-center border-b border-gray-100 last:border-b-0 ${
                  index % 2 === 0 ? 'bg-white/50' : 'bg-gray-50/50'
                }`}
              >
                {type}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Floating Cart Info - Top Right (only show on non-admin pages and hide on distri pages) */}
      {cartItemCount > 0 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/distri1') && !window.location.pathname.includes('/naranjos2') && (
        <div className="hidden md:block floating-cart-info bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-md px-4 py-1 shadow-md border border-gray-600/50 pointer-events-none rounded-full flex items-center justify-start" style={{maxWidth: '400px'}}>
          <span className="text-[12px] text-green-400 font-medium text-left whitespace-nowrap">
            {(() => {
              const message = getFreeShippingMessage();
              return typeof message === 'string' ? (
                message
              ) : (
                `Agrega ${message.amount} para Envio Gratis!`
              );
            })()}
          </span>
        </div>
      )}

      {/* Mobile Floating Cart Info - Only show on non-admin pages and hide on distri pages */}
      {cartItemCount > 0 && typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin') && !window.location.pathname.includes('/distri1') && !window.location.pathname.includes('/naranjos2') && (
        <div className="md:hidden floating-cart-info bg-gradient-to-r from-gray-800/95 to-gray-900/95 backdrop-blur-md px-2 py-1 shadow-md border border-gray-600/50 pointer-events-none rounded-full flex items-center justify-center" style={{maxWidth: '120px'}}>
          <span className="text-[10px] text-green-400 font-medium text-center">
            {(() => {
              const message = getFreeShippingMessage();
              return typeof message === 'string' ? (
                message
              ) : (
                `Agrega ${message.amount} para Envio Gratis!`
              );
            })()}
          </span>
        </div>
      )}
    </>
  );
}
