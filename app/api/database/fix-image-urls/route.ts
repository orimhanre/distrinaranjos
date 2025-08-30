import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '../../../../lib/database';

export async function POST(request: NextRequest) {
  try {
    const { context = 'virtual' } = await request.json();
    
    console.log(`🔧 Starting image URL fix for ${context} environment...`);
    
    // Initialize database for the specified context
    const productDB = new ProductDatabase(context);
    
    // Get all products
    const allProducts = productDB.getAllProducts();
    console.log(`📊 Found ${allProducts.length} products to check`);
    
    let fixedCount = 0;
    const errors: string[] = [];
    
    for (const product of allProducts) {
      try {
        let needsUpdate = false;
        let updatedImageURL = product.imageURL;
        
        // Check if product has local file paths that need to be fixed
        if (product.imageURL && Array.isArray(product.imageURL)) {
          const fixedUrls = product.imageURL.map((img: any) => {
            if (typeof img === 'string') {
              // If it's a local path, we need to remove it since we can't serve it on Railway
              if (img.startsWith('/images/products/')) {
                needsUpdate = true;
                return null; // Remove local paths
              }
              // If it's already an Airtable URL, keep it
              if (img.includes('dl.airtable.com')) {
                return img;
              }
              // If it's just a filename, remove it
              if (img.includes('.')) {
                needsUpdate = true;
                return null;
              }
            }
            
            // If it's an object with URL property, use the URL
            if (typeof img === 'object' && img !== null && img.url) {
              return img.url;
            }
            
            // If it's an object with filename, remove it
            if (typeof img === 'object' && img !== null && img.filename) {
              needsUpdate = true;
              return null;
            }
            
            return img;
          }).filter((url: any) => url !== null);
          
          if (needsUpdate) {
            updatedImageURL = fixedUrls;
          }
        }
        
        // Update the product if needed
        if (needsUpdate) {
          console.log(`🔧 Fixing product ${product.id}: ${product.name}`);
          console.log(`   Old imageURL:`, product.imageURL);
          console.log(`   New imageURL:`, updatedImageURL);
          
          const updatedProduct = {
            ...product,
            imageURL: updatedImageURL
          };
          
          productDB.updateProduct(product.id, updatedProduct);
          fixedCount++;
        }
        
      } catch (error) {
        const errorMsg = `Failed to fix product ${product.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ Image URL fix completed: ${fixedCount} products fixed`);
    
    return NextResponse.json({
      success: true,
      message: `Fixed image URLs for ${fixedCount} products`,
      fixedCount,
      totalProducts: allProducts.length,
      errors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Image URL fix error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during image URL fix',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
