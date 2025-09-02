import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';
import { Product } from '@/types';

// GET /api/database/virtual-products - Get all virtual products or search
export async function GET(request: NextRequest) {
  try {
    // // console.log('🔄 Fetching virtual products for iOS app...');
    
    // Initialize database for virtual environment
    const productDB = new ProductDatabase('virtual');
    
    // Get all products from the database
    const products = productDB.getAllProducts();
    

    
    // Helper function to ensure arrays for category/subcategory
    const ensureArray = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value.filter(item => item && item.trim());
      if (typeof value === 'string') {
        // Try to parse JSON string
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.filter(item => item && item.trim());
        } catch {
          // If parsing fails, treat as single value
          return value.trim() ? [value.trim()] : [];
        }
      }
      return [];
    };

            // Convert relative image paths to full URLs for iOS app
        const convertToFullUrls = (urls: any, forAdmin: boolean = false): string[] => {
          if (!urls) return [];
          const urlArray = Array.isArray(urls) ? urls : [urls];
          return urlArray.map(url => {
            if (typeof url === 'string' && url.startsWith('/')) {
              // For admin interface, keep relative paths
              if (forAdmin) {
                console.log('🔍 convertToFullUrls: Admin request, keeping relative path:', url);
                return url;
              }
              // Convert relative path to full URL for iOS app
              // Use the current domain for production, fallback for development
              const baseUrl = process.env.NEXTAUTH_URL || 
                             (process.env.NODE_ENV === 'production' 
                               ? 'https://distrinaranjos.co' 
                               : `http://192.168.1.29:${process.env.PORT || 3001}`);
              const fullUrl = `${baseUrl}${url}`;
              console.log('🔍 convertToFullUrls: Converting to full URL:', { original: url, baseUrl, fullUrl });
              return fullUrl;
            }
            return url;
          }).filter(url => url && typeof url === 'string');
        };

    // Check if request is from admin interface (by checking referer or user agent)
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const isAdminRequest = referer.includes('/adminvirtual') || userAgent.includes('admin');
    
    // Debug logging
    console.log('🔍 API Debug - virtual-products:', {
      userAgent: userAgent.substring(0, 100),
      referer: referer.substring(0, 100),
      isAdminRequest,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Transform products for API response
    const transformedProducts = products.map(product => {
      const fullImageUrls = convertToFullUrls(product.imageURL, isAdminRequest);
      
      // Debug logging for first few products
      if (typeof product.id === 'number' && product.id <= 3) {
        console.log('🔍 Product transformation debug:', {
          id: product.id,
          originalImageURL: product.imageURL,
          transformedImageURL: fullImageUrls,
          isAdminRequest
        });
      }
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        detail: product.detail, // Add the detail field
        price: product.price || 0,
        category: ensureArray(product.category),
        subcategory: ensureArray(product.subCategory),
        subCategory: product.subCategory, // Add the subCategory field directly
        brand: product.brand,
        type: ensureArray(product.type),
        imageURL: fullImageUrls,
        quantity: product.stock || 0, // Use stock field directly for virtual products
        stock: product.stock || 0, // Also include stock field for admin interface
        isActive: product.isActive !== false, // Default to true if not specified
        webPhotoUrl: product.webPhotoUrl,
        airtableId: product.airtableId || product.id,
        // Add any other fields that might be needed
        SKU: product.SKU,
        commercialName: product.commercialName,
        materials: product.materials,
        dimensions: product.dimensions,
        capacity: product.capacity,
        colors: Array.isArray(product.colors) ? product.colors : (product.colors ? [product.colors] : []),
        distriPrice: product.distriPrice,
        lastUpdated: product.lastUpdated,
        isProductStarred: product.isProductStarred || product.isProductStarredAirtable || false
      };
    });
    
    // Add cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      products: transformedProducts,
      count: transformedProducts.length,
      timestamp: Date.now() // Add timestamp to force cache refresh
    });
    
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Buster', Date.now().toString());
    response.headers.set('Last-Modified', new Date().toUTCString());
    
    return response;
    
  } catch (error) {
    console.error('❌ Error fetching virtual products:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
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
    
    const productDB = new ProductDatabase('virtual');
    const product = productDB.createProduct(newProduct);
    
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
    
    const productDB = new ProductDatabase('virtual');
    const product = productDB.updateProduct(id, updates);
    
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
    
    const productDB = new ProductDatabase('virtual');
    const deleted = productDB.deleteProduct(id);
    
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