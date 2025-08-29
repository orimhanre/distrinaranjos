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

export default function SubcategoryPage() {
  const { subcategory } = useParams() as { subcategory: string };
  const { data, error, isLoading } = useSWR<{ success: boolean; products: Product[]; count: number }>("/api/database/virtual-products", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorRetryCount: 1
  });
  const products = data?.products || [];
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});

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
  const decodedSubcategory = normalizeStr(decodeURIComponent(subcategory || ''));

  // Helper to prettify subcategory name for display
  function prettifySubcategory(str: string) {
    const connectors = [
      'de', 'en', 'y', 'a', 'con', 'por', 'para', 'sin', 'o', 'u', 'e', 'ni', 'del', 'al'
    ];
    const decoded = decodeURIComponent(str || '');
    console.log('Subcategory param:', str, 'Decoded:', decoded);
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
  const prettySubcategory = prettifySubcategory(subcategory);

  // Optionally set the document title
  React.useEffect(() => {
    if (prettySubcategory) {
      document.title = `${prettySubcategory} | Subcategoría | QuickOrder`;
    }
  }, [prettySubcategory]);

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
        <div className="text-gray-600 text-lg">Cargando productos...</div>
        <div className="text-gray-400 text-sm mt-2">Explorando subcategoría {prettySubcategory}</div>
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
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Reintentar
        </button>
      </div>
    </div>
  );

  const subcategoryProducts = products.filter((p: Product) => {
    if (!p.subCategory) return false;
    
    const productSubcategories = Array.isArray(p.subCategory) 
      ? p.subCategory 
      : [p.subCategory];
    
    return productSubcategories.some(subcat => 
      subcat && normalizeStr(subcat) === decodedSubcategory
    );
  });

  // Sort products by brand and name
  const sortedProducts = subcategoryProducts.sort((a: Product, b: Product) => {
    const brandA = (a.brand || '').toString();
    const brandB = (b.brand || '').toString();
    const brandCompare = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
    if (brandCompare !== 0) return brandCompare;
    return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
  });

  // Calculate statistics
  const totalProducts = subcategoryProducts.length;
                  const avgPrice = subcategoryProducts.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts;
  const starredProducts = subcategoryProducts.filter(p => p.isProductStarred).length;
  const allBrands = [...new Set(subcategoryProducts.flatMap(p => 
    Array.isArray(p.brand) ? p.brand : [p.brand]
  ).filter(Boolean))].sort();

  console.log("Current subcategory param:", subcategory, "Decoded:", decodedSubcategory);

  return (
    <ModalStateProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Breadcrumb */}
            <nav className="flex mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2 text-sm text-gray-600">
                <li>
                  <Link href="/" className="hover:text-green-600 transition-colors">
                    Inicio
                  </Link>
                </li>
                <li className="flex items-center">
                  <FaChevronDown className="w-3 h-3 rotate-[-90deg] mx-2" />
                  <span className="text-gray-900 font-medium">{prettySubcategory}</span>
                </li>
              </ol>
            </nav>

            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4">
                {prettySubcategory || 'Subcategoría'}
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto">
                Explora nuestra selección especializada en la subcategoría {prettySubcategory}. 
                Productos cuidadosamente seleccionados para satisfacer tus necesidades específicas.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Results Summary */}
          <div className="mb-6">
            <p className="text-gray-600">
              Mostrando <span className="font-semibold text-gray-900">{totalProducts}</span> productos
            </p>
          </div>

          {/* Products Grid */}
          <div 
            ref={gridRef} 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {sortedProducts.map((product: Product, index: number) => (
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