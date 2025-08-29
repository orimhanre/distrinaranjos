import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';

// Virtual database instance
const virtualProductDB = new ProductDatabase('virtual');

// GET /api/database/virtual-metadata - Get unique brands, categories, and types
export async function GET(request: NextRequest) {
  try {
    console.log('API: /api/database/virtual-metadata called');
    
    const products = virtualProductDB.getAllProducts();
    
    // Get unique brands
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
    
    // Get unique categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    
    // Get unique types
    const types = [...new Set(products.map(p => p.type).filter(Boolean))].sort();
    
    console.log('API: Virtual metadata - Brands:', brands.length, 'Categories:', categories.length, 'Types:', types.length);
    
    return NextResponse.json({
      success: true,
      metadata: {
        brands,
        categories,
        types
      }
    });
  } catch (error) {
    console.error('API Error fetching virtual metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch virtual metadata', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 