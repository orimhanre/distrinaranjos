import { NextRequest, NextResponse } from 'next/server';
import { ImageDownloader } from '@/lib/imageDownloader';
import { ProductDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting product images cleanup...');
    
    // Get context from request body or headers
    const body = await request.json().catch(() => ({}));
    const context = body.context || request.headers.get('x-context') || 'both';
    
    console.log(`🔄 Context received: ${context}`);
    
    let allProductImages: string[] = [];
    let regularCount = 0;
    let virtualCount = 0;
    
    // Clean up regular database images
    if (context === 'regular' || context === 'both') {
      console.log('🔄 Cleaning up regular database images...');
      const regularDB = new ProductDatabase('regular');
      const regularProducts = regularDB.getAllProducts();
      
      regularProducts.forEach((product: any) => {
        if (product.imageURL && Array.isArray(product.imageURL)) {
          product.imageURL.forEach((img: any) => {
            // Handle different image URL formats
            let imagePath = '';
            if (typeof img === 'string') {
              imagePath = img;
            } else if (img && img.url) {
              imagePath = img.url;
            }
            
            // Extract filename from various URL formats
            if (imagePath) {
              if (imagePath.startsWith('/images/products/')) {
                allProductImages.push(imagePath);
              } else if (imagePath.includes('/images/products/')) {
                const filename = imagePath.split('/images/products/')[1];
                if (filename) {
                  allProductImages.push(`/images/products/${filename}`);
                }
              }
            }
          });
        }
      });
      regularCount = regularProducts.length;
      console.log(`📊 Regular database: ${regularProducts.length} products, ${allProductImages.length} images`);
    }
    
    // Clean up virtual database images
    if (context === 'virtual' || context === 'both') {
      console.log('🔄 Cleaning up virtual database images...');
      const virtualDB = new ProductDatabase('virtual');
      const virtualProducts = virtualDB.getAllProducts();
      
      virtualProducts.forEach((product: any) => {
        if (product.imageURL && Array.isArray(product.imageURL)) {
          product.imageURL.forEach((img: any) => {
            // Handle different image URL formats
            let imagePath = '';
            if (typeof img === 'string') {
              imagePath = img;
            } else if (img && img.url) {
              imagePath = img.url;
            }
            
            // Extract filename from various URL formats
            if (imagePath) {
              if (imagePath.startsWith('/images/products/')) {
                allProductImages.push(imagePath);
              } else if (imagePath.includes('/images/products/')) {
                const filename = imagePath.split('/images/products/')[1];
                if (filename) {
                  allProductImages.push(`/images/products/${filename}`);
                }
              }
            }
          });
        }
      });
      virtualCount = virtualProducts.length;
      console.log(`📊 Virtual database: ${virtualProducts.length} products, ${allProductImages.length} total images`);
    }
    
    // Remove duplicates
    const uniqueImages = [...new Set(allProductImages)];
    console.log(`📸 Total unique images referenced: ${uniqueImages.length}`);
    
    // Clean up ALL images (not just unused ones)
    await ImageDownloader.cleanupAllImages();
    
    console.log('✅ Product images cleanup completed');
    
    return NextResponse.json({
      success: true,
      message: 'ALL product images cleaned up successfully',
      context,
      regularProducts: regularCount,
      virtualProducts: virtualCount,
      totalImages: uniqueImages.length,
      note: 'All images were deleted for fresh sync'
    });

  } catch (error) {
    console.error('❌ Product images cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Product images cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 