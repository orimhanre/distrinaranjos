"use client";
import useSWR from "swr";
import React, { useEffect, useState, useRef } from "react";
import { fetchWebPhotos } from "@/lib/databaseService";
import Link from "next/link";
import Image from "next/image";
import { FaChevronDown, FaChevronUp, FaEye, FaStar, FaTags, FaIndustry } from "react-icons/fa";
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

export default function CategoryPage() {
  const { category } = useParams() as { category: string };
  const { data, error, isLoading } = useSWR<{ success: boolean; products: Product[]; count: number }>("/api/database/virtual-products", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorRetryCount: 1
  });
  const products = data?.products || [];
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  
  // State for category-subcategory relations
  const [categoryRelations, setCategoryRelations] = useState<any[]>([]);
  const [relationsLoaded, setRelationsLoaded] = useState(false);

  useEffect(() => {
    fetchWebPhotos().then(setPhotos).catch(console.error);
  }, []);

  // Load category-subcategory relations
  useEffect(() => {
    const loadRelations = async () => {
      try {
        const response = await fetch('/api/database/virtual-category-relations');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCategoryRelations(data.relations || []);
          }
        }
      } catch (error) {
        console.error('Error loading category relations:', error);
      } finally {
        setRelationsLoaded(true);
      }
    };
    
    loadRelations();
  }, []);

  // Helper to normalize strings for comparison (case, accents, etc)
  function normalizeStr(str: string) {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const decodedCategory = normalizeStr(decodeURIComponent(category || ''));

  // Helper to prettify category name for display
  function prettifyCategory(str: string) {
    const connectors = [
      'de', 'en', 'y', 'a', 'con', 'por', 'para', 'sin', 'o', 'u', 'e', 'ni', 'del', 'al'
    ];
    const decoded = decodeURIComponent(str || '');
    console.log('Category param:', str, 'Decoded:', decoded);
    return decoded
      .replace(/\s+/g, ' ')
      .split(' ')
      .map((w, i) => {
        const lw = w.toLowerCase();
        if (i > 0 && connectors.includes(lw)) return lw;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(' ');
  }
  const prettyCategory = prettifyCategory(category);

  // Optionally set the document title
  React.useEffect(() => {
    if (prettyCategory) {
      document.title = `${prettyCategory} | Categoría | QuickOrder`;
    }
  }, [prettyCategory]);

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
        <div className="text-gray-600 text-lg">Cargando productos...</div>
        <div className="text-gray-400 text-sm mt-2">Preparando la mejor selección para ti</div>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Error al cargar productos</h2>
        <p className="text-gray-600 mb-4">
          {error.message || 'Error desconocido'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors font-medium"
        >
          Reintentar
        </button>
      </div>
    </div>
  );

  const categoryProducts = products.filter((p: Product) => {
    if (Array.isArray(p.category)) {
      return p.category.some(cat => normalizeStr(cat) === decodedCategory);
    }
    if (typeof p.category === 'string') {
      return normalizeStr(p.category) === decodedCategory;
    }
    return false;
  });

  // Sort products by brand and name
  const sortedProducts = categoryProducts.sort((a: Product, b: Product) => {
    const brandA = (a.brand || '').toString();
    const brandB = (b.brand || '').toString();
    const brandCompare = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
    if (brandCompare !== 0) return brandCompare;
    return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
  });

  // Calculate statistics
  const totalProducts = categoryProducts.length;
                  const avgPrice = categoryProducts.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts;
  const starredProducts = categoryProducts.filter(p => p.isProductStarred).length;
  const allBrands = [...new Set(categoryProducts.flatMap(p => 
    Array.isArray(p.brand) ? p.brand : [p.brand]
  ).filter(Boolean))].sort();

  console.log("Current category param:", category, "Decoded:", decodedCategory);

  return (
    <ModalStateProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-pink-50 to-purple-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            {/* Breadcrumb */}
            <nav className="flex mb-4 sm:mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600">
                <li>
                  <Link href="/" className="hover:text-pink-600 transition-colors">
                    Inicio
                  </Link>
                </li>
                <li className="flex items-center">
                  <FaChevronDown className="w-2 h-2 sm:w-3 sm:h-3 rotate-[-90deg] mx-1 sm:mx-2" />
                  <span className="text-gray-900 font-medium truncate">{prettyCategory}</span>
                </li>
              </ol>
            </nav>

            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 mb-3 sm:mb-4">
                {prettyCategory || 'Categoría'}
              </h1>
              <p className="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto px-4 leading-relaxed">
                Descubre nuestra colección exclusiva de productos en la categoría {prettyCategory}. 
                Encuentra calidad, innovación y las mejores marcas.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
          {/* Results Summary */}
          <div className="mb-6">
            <p className="text-gray-600">
              Mostrando <span className="font-semibold text-gray-900">{totalProducts}</span> productos
            </p>
          </div>

          {/* Products organized by subcategories */}
          {(() => {
            // Get subcategories configured for this category
            const configuredSubcategories = categoryRelations
              .filter(relation => 
                relation.category && 
                relation.subcategory && 
                relation.isActive &&
                normalizeStr(relation.category) === normalizeStr(decodedCategory)
              )
              .map(relation => relation.subcategory)
              .sort();

            // Group products by configured subcategories only
            const subcategoryGroups: Record<string, Product[]> = {};
            let productsWithoutSubcategory: Product[] = [];

            sortedProducts.forEach(product => {
              const productSubcategories = Array.isArray(product.subCategory) ? product.subCategory : [product.subCategory];
              
              // Only group by subcategories that are configured for this category
              const matchingSubcategories = productSubcategories.filter(subcat => 
                subcat && 
                subcat.trim() !== '' && 
                configuredSubcategories.includes(subcat)
              );

              if (matchingSubcategories.length > 0) {
                // Product belongs to configured subcategories
                matchingSubcategories.forEach(subcat => {
                  if (subcat && !subcategoryGroups[subcat]) {
                    subcategoryGroups[subcat] = [];
                  }
                  if (subcat) {
                    subcategoryGroups[subcat].push(product);
                  }
                });
              } else {
                // Product has no configured subcategory for this category
                productsWithoutSubcategory.push(product);
              }
            });

            const subcategoryNames = Object.keys(subcategoryGroups).sort();

            return (
              <div className="space-y-12">
                {/* Render each subcategory section */}
                {subcategoryNames.map((subcategoryName, sectionIndex) => (
                  <div key={subcategoryName} className="space-y-6">
                    {/* Subcategory Header */}
                    <div className="flex items-center">
                      <div className="flex-grow border-t border-gray-300"></div>
                      <div className="mx-3 sm:mx-6">
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 bg-white px-3 sm:px-4 py-1 sm:py-2 rounded-lg shadow-sm border border-gray-200">
                          {subcategoryName}
                        </h2>
                      </div>
                      <div className="flex-grow border-t border-gray-300"></div>
                    </div>

                    {/* Products Grid for this subcategory */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {subcategoryGroups[subcategoryName].map((product: Product, index: number) => (
                        <div
                          key={product.id}
                          className={`animate-fadeInUp`}
                          style={{ animationDelay: `${(sectionIndex * 4 + index) * 0.1}s` }}
                        >
                          <AutoRotatingProductCard
                            product={product}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Products without subcategory */}
                {productsWithoutSubcategory.length > 0 && (
                  <div className="space-y-6">
                    {/* Products Grid for items without subcategory */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {productsWithoutSubcategory.map((product: Product, index: number) => (
                        <div
                          key={product.id}
                          className={`animate-fadeInUp`}
                          style={{ animationDelay: `${(subcategoryNames.length * 4 + index) * 0.1}s` }}
                        >
                          <AutoRotatingProductCard
                            product={product}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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