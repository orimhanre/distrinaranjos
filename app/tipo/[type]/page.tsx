"use client";
import useSWR from "swr";
import React, { useEffect, useState, useRef } from "react";
import { fetchWebPhotos } from "@/lib/databaseService";
import Link from "next/link";
import Image from "next/image";
import { FaChevronDown, FaChevronUp, FaEye, FaShoppingCart, FaStar, FaTags, FaIndustry, FaCube } from "react-icons/fa";
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

export default function TypePage() {
  const { type } = useParams() as { type: string };
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
  const decodedType = normalizeStr(decodeURIComponent(type || ''));

  // Helper to prettify type name for display
  function prettifyType(str: string) {
    const connectors = [
      'de', 'en', 'y', 'a', 'con', 'por', 'para', 'sin', 'o', 'u', 'e', 'ni', 'del', 'al'
    ];
    const decoded = decodeURIComponent(str || '');
    console.log('Type param:', str, 'Decoded:', decoded);
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
  const prettyType = prettifyType(type);

  // Optionally set the document title
  React.useEffect(() => {
    if (prettyType) {
      document.title = `${prettyType} | Tipo | QuickOrder`;
    }
  }, [prettyType]);

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <div className="text-gray-600 text-lg">Cargando productos...</div>
        <div className="text-gray-400 text-sm mt-2">Explorando productos del tipo {prettyType}</div>
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
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Reintentar
        </button>
      </div>
    </div>
  );

  const typeProducts = products.filter((p: Product) => {
    if (Array.isArray(p.type)) {
      return p.type.some(t => normalizeStr(t) === decodedType);
    }
    if (typeof p.type === 'string') {
      return normalizeStr(p.type) === decodedType;
    }
    return false;
  });

  // Sort products by brand and name
  const sortedProducts = typeProducts.sort((a: Product, b: Product) => {
    const brandA = (a.brand || '').toString();
    const brandB = (b.brand || '').toString();
    const brandCompare = brandA.localeCompare(brandB, 'es', { sensitivity: 'base' });
    if (brandCompare !== 0) return brandCompare;
    return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
  });

  // Calculate statistics
  const totalProducts = typeProducts.length;
                  const avgPrice = typeProducts.reduce((sum, p) => sum + (p.price || 0), 0) / totalProducts;
  const starredProducts = typeProducts.filter(p => p.isProductStarred).length;
  const allBrands = [...new Set(typeProducts.flatMap(p => 
    Array.isArray(p.brand) ? p.brand : [p.brand]
  ).filter(Boolean))].sort();

  console.log("Current type param:", type, "Decoded:", decodedType);

  return (
    <ModalStateProvider>
      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
            {/* Breadcrumb */}
            <nav className="flex mb-4 sm:mb-6" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-gray-600">
                <li>
                  <Link href="/" className="hover:text-blue-600 transition-colors">
                    Inicio
                  </Link>
                </li>
                <li className="flex items-center">
                  <FaChevronDown className="w-2 h-2 sm:w-3 sm:h-3 rotate-[-90deg] mx-1 sm:mx-2" />
                  <span className="text-gray-900 font-medium">Tipo</span>
                </li>
                <li className="flex items-center">
                  <FaChevronDown className="w-2 h-2 sm:w-3 sm:h-3 rotate-[-90deg] mx-1 sm:mx-2" />
                  <span className="text-gray-900 font-medium truncate">{prettyType}</span>
                </li>
              </ol>
            </nav>

            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-blue-100 rounded-full flex items-center justify-center mr-3 sm:mr-4">
                  <FaCube className="w-5 h-5 sm:w-6 sm:h-6 lg:w-8 lg:h-8 text-blue-600" />
                </div>
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">
                  {prettyType || 'Tipo'}
                </h1>
              </div>
              <p className="text-sm sm:text-base text-gray-600 max-w-3xl mx-auto px-4 leading-relaxed">
                Explora nuestra selección especializada de productos del tipo {prettyType}. 
                Encuentra soluciones innovadoras y de alta calidad para tus necesidades específicas.
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