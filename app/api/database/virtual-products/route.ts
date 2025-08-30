import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';
import { Product } from '@/types';

// Virtual database instance
const virtualProductDB = new ProductDatabase('virtual');

// GET /api/database/virtual-products - Get all virtual products or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const marca = searchParams.get('marca');
    const tipo = searchParams.get('tipo');

    console.log('🔍 Fetching virtual products from SQLite database...');
    
    let products: Product[] = [];
    
    if (search) {
      products = virtualProductDB.searchProducts(search);
    } else if (category) {
      products = virtualProductDB.getProductsByCategory(category);
    } else if (marca) {
      products = virtualProductDB.getProductsByMarca(marca);
    } else if (tipo) {
      products = virtualProductDB.getProductsByTipo(tipo);
    } else {
      products = virtualProductDB.getAllProducts();
    }

    console.log(`✅ Found ${products.length} virtual products in SQLite database`);
    
    return NextResponse.json({
      success: true,
      products,
      count: products.length
    });

  } catch (error) {
    console.error('❌ Error fetching virtual products from SQLite:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch virtual products from SQLite database',
      products: [],
      count: 0
    }, { status: 500 });
  }
}

// POST /api/database/virtual-products - Create a new virtual product
export async function POST(request: NextRequest) {
  try {
    const productData = await request.json();
    
    // Set default values for required fields if they're empty
    const newProduct = {
      name: productData.name || 'Nuevo Producto Virtual',
      brand: productData.brand || 'Sin Marca',
      type: productData.type || '',
      category: productData.category || '',
              price: productData.price || 0,
      quantity: productData.quantity || 0,
      isProductStarred: productData.isProductStarred || false,
      colors: productData.colors || [],
      materials: productData.materials || '',
      dimensions: productData.dimensions || '',
      capacity: productData.capacity || '',
      imageURL: productData.imageURL || []
    };
    
    const product = virtualProductDB.createProduct(newProduct);
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Virtual product created successfully'
    });
  } catch (error) {
    console.error('Error creating virtual product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create virtual product' },
      { status: 500 }
    );
  }
}

// PUT /api/database/virtual-products - Update a virtual product (requires id in body)
export async function PUT(request: NextRequest) {
  try {
    const { id, ...updates } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Virtual product ID is required' },
        { status: 400 }
      );
    }
    
    const product = virtualProductDB.updateProduct(id, updates);
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Virtual product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Virtual product updated successfully'
    });
  } catch (error) {
    console.error('Error updating virtual product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update virtual product' },
      { status: 500 }
    );
  }
}

// DELETE /api/database/virtual-products - Delete a virtual product (requires id in body)
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Virtual product ID is required' },
        { status: 400 }
      );
    }
    
    const deleted = virtualProductDB.deleteProduct(id);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Virtual product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Virtual product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting virtual product:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete virtual product' },
      { status: 500 }
    );
  }
} 