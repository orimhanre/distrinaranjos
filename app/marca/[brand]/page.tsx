"use client";
import useSWR from "swr";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { fetchWebPhotos } from "@/lib/databaseService";
import Link from "next/link";
import Image from "next/image";
import { FaChevronDown, FaChevronUp, FaEye, FaShoppingCart, FaStar, FaTags, FaIndustry, FaCrown } from "react-icons/fa";
import { useRouter, useParams } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import AutoRotatingProductCard from "@/components/AutoRotatingProductCard";

import { ModalStateProvider } from "@/lib/modalState";
import type { Product } from '@/types';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error('Response is not JSON');
  }
  return res.json();
};

export default function BrandMenuPage() {
  const { brand } = useParams() as { brand: string };
  const { data, error, isLoading } = useSWR<{ success: boolean; products: Product[]; count: number }>("/api/database/virtual-products", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorRetryCount: 1
  });
  const products = data?.products || [];
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Sorting state
  const [sortBy, setSortBy] = useState<string>('name');

  useEffect(() => {
    fetchWebPhotos().then(setPhotos).catch(console.error);
  }, []);

  // Helper to normalize strings for comparison (case, accents, etc)
  function normalizeStr(str: string) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[ -]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const decodedBrand = normalizeStr(decodeURIComponent(brand || ''));

  // Helper to prettify brand name for display
  function prettifyBrand(str: string) {
    const decoded = decodeURIComponent(str || '');
    console.log('Brand param:', str, 'Decoded:', decoded);
    return decoded
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((w, i) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  const prettyBrand = prettifyBrand(brand);

  // Optionally set the document title
  useEffect(() => {
    if (prettyBrand) {
      document.title = `${prettyBrand} | Marca | QuickOrder`;
    }
  }, [prettyBrand]);

  // Calculate all data before any early returns
  const brandProducts = products.filter((p: Product) => {
    if (Array.isArray(p.brand)) {
      return p.brand.some(b => normalizeStr(b) === decodedBrand);
    }
    if (typeof p.brand === 'string') {
      return normalizeStr(p.brand) === decodedBrand;
    }
    return false;
  });

  // Sort products by name
  const sortedProducts = brandProducts.sort((a: Product, b: Product) => 
    (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
  );

  // Calculate statistics
  const totalProducts = brandProducts.length;
  const avgPrice = brandProducts.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts;
  const allCategories = [...new Set(brandProducts.flatMap(p => 
    Array.isArray(p.category) ? p.category : [p.category]
  ).filter(Boolean))].sort();

  // Filter products by selected category
  const filteredProducts = selectedCategory === 'all' 
    ? sortedProducts 
    : sortedProducts.filter(product => {
        if (Array.isArray(product.category)) {
          return product.category.some(cat => cat === selectedCategory);
        }
        return product.category === selectedCategory;
      });

  // Apply sorting to filtered products
  const sortedAndFilteredProducts = useMemo(() => {
    let sorted = [...filteredProducts];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
        break;
      case 'price-low':
        sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
        break;
      case 'price-high':
        sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
        break;
      case 'category':
        sorted.sort((a, b) => {
          const catA = Array.isArray(a.category) ? a.category[0] || '' : a.category || '';
          const catB = Array.isArray(b.category) ? b.category[0] || '' : b.category || '';
          return catA.localeCompare(catB, 'es', { sensitivity: 'base' });
        });
        break;
      default:
        break;
    }
    
    return sorted;
  }, [filteredProducts, sortBy]);

  if (isLoading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <FaCrown className="w-10 h-10 text-white" />
          </div>
          <div className="absolute inset-0 w-20 h-20 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Descubriendo {prettyBrand}</h2>
        <p className="text-gray-600 mb-4">Cargando la colección de productos...</p>
        <div className="flex justify-center space-x-2">
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="text-red-500 text-4xl">⚠️</div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Error al cargar productos</h2>
        <p className="text-gray-600 mb-6 leading-relaxed">
          {error.message || 'Ocurrió un error inesperado al cargar la colección de productos.'}
        </p>
        <div className="space-y-3">
          <button 
            onClick={() => window.location.reload()} 
            className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            🔄 Reintentar
          </button>
          <button 
            onClick={() => router.push('/catalogo')} 
            className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
          >
            📚 Volver al Catálogo
          </button>
        </div>
      </div>
    </div>
  );



  console.log("Current brand param:", brand, "Decoded:", decodedBrand);

  return (
    <ModalStateProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Enhanced Hero Section */}
        <div className="relative bg-gradient-to-br from-orange-50 via-yellow-50 to-amber-50 border-b border-gray-200 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {/* Compact Breadcrumb */}
            <nav className="flex mb-3 sm:mb-4" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm">
                <li>
                  <Link href="/" className="flex items-center text-gray-600 hover:text-orange-600 transition-colors duration-200">
                    <span className="mr-1">🏠</span>
                    Inicio
                  </Link>
                </li>
                <li className="flex items-center">
                  <FaChevronDown className="w-3 h-3 rotate-[-90deg] mx-2 text-gray-400" />
                  <span className="text-gray-900 font-semibold truncate">{prettyBrand}</span>
                </li>
              </ol>
            </nav>

            {/* Compact Header */}
            <div className="text-center mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row items-center justify-center mb-3 sm:mb-4 space-y-3 sm:space-y-0">
                <div className="relative">
                  <div className="w-16 h-16 sm:w-16 bg-gradient-to-br from-orange-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg">
                    <FaCrown className="w-8 h-8 sm:w-8 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{totalProducts}</span>
                  </div>
                </div>
                <div className="text-center sm:text-left">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">
                    {prettyBrand || 'Marca'}
                  </h1>
                </div>
              </div>
              <p className="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto px-4 leading-relaxed">
                Descubre la excelencia y calidad de <strong>{prettyBrand}</strong>. Una marca que representa 
                innovación, confianza y las mejores soluciones para tus necesidades.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
                    {/* Compact & Friendly Results Summary */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-center space-x-8">
              {/* Total Products */}
              <div className="flex items-center space-x-1.5">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaTags className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="text-center min-w-0">
                  <div className="text-sm sm:text-xl font-semibold text-gray-900">{totalProducts}</div>
                  <div className="text-[10px] sm:text-base text-gray-500">Productos</div>
                </div>
              </div>
              
              {/* Average Price */}
              <div className="flex items-center space-x-1.5">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaStar className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="text-center min-w-0">
                  <div className="text-sm sm:text-xl font-semibold text-gray-900">
                    ${avgPrice ? avgPrice.toLocaleString('es-CO') : '0'}
                  </div>
                  <div className="text-[10px] sm:text-base text-gray-500">Precio Promedio</div>
                </div>
              </div>
              
              {/* Categories */}
              <div className="flex items-center space-x-1.5">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <FaIndustry className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" />
                </div>
                <div className="text-center min-w-0">
                  <div className="text-sm sm:text-xl font-semibold text-gray-900">{allCategories.length}</div>
                  <div className="text-[10px] sm:text-base text-gray-500">Categorías</div>
                </div>
              </div>
            </div>
          </div>

          {/* Products Grid Header with Sorting and Filtering */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 text-center sm:text-left mb-6">Productos de {prettyBrand}</h2>
            
            {/* Combined sorting and filtering section - always side by side */}
            <div className="flex flex-row items-start space-x-4">
              {/* Sorting section */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  🔽 Ordenar por:
                </label>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer hover:border-gray-400 transition-colors bg-white text-black"
                >
                  <option value="name" className="text-black">📝 Nombre (A-Z)</option>
                  <option value="price-low" className="text-black">💰 Precio: Menor a Mayor</option>
                  <option value="price-high" className="text-black">💰 Precio: Mayor a Menor</option>
                  <option value="category" className="text-black">🏷️ Categoría</option>
                </select>
              </div>

              {/* Category Filter section */}
              {allCategories.length > 0 && (
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                    🏷️ Filtrar por Categoría
                  </label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer hover:border-gray-400 transition-colors bg-white text-black"
                  >
                    <option value="all" className="text-black">🌟 Todas las Categorías</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat} className="text-black">{cat}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            
            {/* Results summary - below both sections */}
            {allCategories.length > 0 && (
              <div className="text-center lg:text-left mt-6">
                <p className="text-sm text-gray-600">
                  Mostrando <span className="font-semibold text-gray-900">{sortedAndFilteredProducts.length}</span> de {totalProducts} productos
                  {selectedCategory !== 'all' && (
                    <span className="text-orange-600"> en categoría "{selectedCategory}"</span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Products Grid */}
          {sortedAndFilteredProducts.length > 0 ? (
            <div 
              ref={gridRef} 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              {sortedAndFilteredProducts.map((product: Product, index: number) => (
                <div
                  key={product.id}
                  className={`animate-fadeInUp`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <AutoRotatingProductCard
                    product={product}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FaIndustry className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {selectedCategory !== 'all' 
                  ? `No se encontraron productos en "${selectedCategory}"`
                  : 'No se encontraron productos'
                }
              </h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">
                {selectedCategory !== 'all' 
                  ? `No hay productos de la categoría "${selectedCategory}" para la marca ${prettyBrand}.`
                  : `No hay productos disponibles para la marca ${prettyBrand} en este momento.`
                }
              </p>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
                {selectedCategory !== 'all' && (
                  <button 
                    onClick={() => setSelectedCategory('all')} 
                    className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors duration-200 font-medium"
                  >
                    🌟 Ver Todas las Categorías
                  </button>
                )}
                <button 
                  onClick={() => router.push('/catalogo')} 
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200 font-medium"
                >
                  📚 Ver Todo el Catálogo
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Footer Section */}
        <div className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {/* Brand Summary */}
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-center sm:justify-start">
                  <FaCrown className="w-5 h-5 text-orange-600 mr-2" />
                  {prettyBrand}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  Descubre la calidad y innovación que {prettyBrand} tiene para ofrecer. 
                  Una marca comprometida con la excelencia y la satisfacción del cliente.
                </p>
              </div>
              
              {/* Quick Stats */}
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex justify-center sm:justify-between">
                    <span>Total de Productos:</span>
                    <span className="font-semibold text-gray-900 ml-2 sm:ml-0">{totalProducts}</span>
                  </div>
                  <div className="flex justify-center sm:justify-between">
                    <span>Categorías:</span>
                    <span className="font-semibold text-gray-900 ml-2 sm:ml-0">{allCategories.length}</span>
                  </div>
                </div>
              </div>
              
              {/* Navigation */}
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Navegación</h3>
                <div className="space-y-2 text-sm">
                  <Link href="/catalogo" className="block text-gray-600 hover:text-orange-600 transition-colors duration-200">
                    📚 Ver Todo el Catálogo
                  </Link>
                  <Link href="/" className="block text-gray-600 hover:text-orange-600 transition-colors duration-200">
                    🏠 Volver al Inicio
                  </Link>
                  <Link href="/contacto" className="block text-gray-600 hover:text-orange-600 transition-colors duration-200">
                    📞 Contacto
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 mt-6 sm:mt-8 pt-6 sm:pt-8 text-center">
              <p className="text-sm text-gray-500">
                © 2024 QuickOrder. Todos los derechos reservados. | 
                <span className="text-orange-600 font-medium"> {prettyBrand}</span> - Calidad Garantizada
              </p>
            </div>
          </div>
        </div>

        <style jsx>{`
          .animate-fadeInUp {
            animation: fadeInUp 0.6s cubic-bezier(0.4,0,0.2,1) both;
          }
          @keyframes fadeInUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </ModalStateProvider>
  );
} 