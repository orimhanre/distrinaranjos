import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';
import { Product } from '@/types';

// GET /api/database/products - Get all products or search
export async function GET(request: NextRequest) {
  try {
    // API: /api/database/products called
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');
    
    // API: Initializing productDB
    const productDB = new ProductDatabase();
    
    let products: Product[];
    
    if (query) {
      console.log('API: Searching products with query:', query);
      products = productDB.searchProducts(query);
    } else {
      // API: Getting all products
      products = productDB.getAllProducts();
    }
    
    // API: Returning products
    
    return NextResponse.json({
      success: true,
      products,
      count: products.length
    });
  } catch (error) {
    console.error('API Error fetching products:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/database/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();
    const productDB = new ProductDatabase();
    
    // Set default values for required fields if they're empty
    const newProduct = {
      name: productData.name || 'Nuevo Producto',
      brand: productData.brand || 'Sin Marca',
      type: productData.type || '',
      category: productData.category || '',
      price: productData.price || 0, // Primary price field
      price1: productData.price1 || 0, // Keep for compatibility
      price2: productData.price2 || 0, // Keep for compatibility
      quantity: productData.quantity || 0,
      isProductStarred: productData.isProductStarred || false,
      colors: productData.colors || [],
      materials: productData.materials || '',
      dimensions: productData.dimensions || '',
      capacity: productData.capacity || '',
      imageURL: productData.imageURL || []
    };
    
    const product = productDB.createProduct(newProduct);
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

// PUT /api/database/products - Update a product (requires id in body)
export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();
    const productDB = new ProductDatabase();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const product = productDB.updateProduct(id, updates);
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Product updated successfully'
    });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE /api/database/products - Delete a product or multiple products
export async function DELETE(request: NextRequest) {
  try {
    const { id, ids } = await request.json();
    const productDB = new ProductDatabase();
    
    // Handle bulk deletion
    if (ids && Array.isArray(ids)) {
      let deletedCount = 0;
      let failedCount = 0;
      
      for (const productId of ids) {
        const deleted = productDB.deleteProduct(productId);
        if (deleted) {
          deletedCount++;
        } else {
          failedCount++;
        }
      }
      
      return NextResponse.json({
        success: true,
        message: `Deleted ${deletedCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        deletedCount,
        failedCount
      });
    }
    
    // Handle single deletion
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const deleted = productDB.deleteProduct(id);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 500 }
    );
  }
} 