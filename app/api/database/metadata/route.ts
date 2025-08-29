import { NextRequest, NextResponse } from 'next/server';
import { productDB } from '@/lib/database';

// GET /api/database/metadata - Get unique values for dropdowns
export async function GET(request: NextRequest) {
  try {
    const brands = productDB.getUniqueValues('brand');
    const categories = productDB.getUniqueValues('category');
    const types = productDB.getUniqueValues('type');
    
    return NextResponse.json({
      success: true,
      metadata: {
        brands,
        categories,
        types
      }
    });
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
} 