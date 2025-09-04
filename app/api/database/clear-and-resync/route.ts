import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '../../../../lib/database';
import { AirtableService } from '../../../../lib/airtable';
import { VirtualPhotoDownloader } from '../../../../lib/virtualPhotoDownloader';
import { RegularPhotoDownloader } from '../../../../lib/regularPhotoDownloader';

export async function POST(request: NextRequest) {
  try {
    const { context = 'virtual' } = await request.json();
    
    console.log(`🔄 Starting clear and resync for ${context} environment...`);
    
    // Initialize database for the specified context
    const productDB = new ProductDatabase(context);
    
    // Clear all products
    console.log(`🗑️ Clearing all products from database...`);
    const existingProducts = productDB.getAllProducts();
    productDB.clearAllProducts();
    console.log(`🗑️ Cleared ${existingProducts.length} existing products from SQLite database`);
    
    // Switch Airtable environment based on context
    AirtableService.switchEnvironmentFromContext(context);
    
    // Fetch all records from Airtable
    console.log(`📥 Fetching records from Airtable...`);
    const airtableRecords = await AirtableService.fetchAllRecords();
    console.log(`📥 Found ${airtableRecords.length} records in Airtable`);
    
    let syncedCount = 0;
    const errors: string[] = [];
    
    // Convert and save products to SQLite database
    for (const airtableRecord of airtableRecords) {
      try {
        console.log(`🔍 Processing record ${airtableRecord.id}`);
        
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        
        if (product) {
          // Handle images based on environment
          if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
            if (context === 'virtual') {
              // For virtual environment, download images locally
              try {
                const downloadedImagePaths = await VirtualPhotoDownloader.downloadProductImages(product.imageURL);
                if (downloadedImagePaths.length > 0) {
                  product.imageURL = downloadedImagePaths;
                } else {
                  product.imageURL = ['/placeholder-product.svg'];
                }
              } catch (imageError) {
                console.error(`❌ Error downloading images for virtual product ${product.id}:`, imageError);
                product.imageURL = ['/placeholder-product.svg'];
              }
            } else if (context === 'regular') {
              // For regular environment, download images locally
              try {
                const downloadedImagePaths = await RegularPhotoDownloader.downloadProductImages(product.imageURL);
                if (downloadedImagePaths.length > 0) {
                  product.imageURL = downloadedImagePaths;
                } else {
                  product.imageURL = ['/placeholder-product.svg'];
                }
              } catch (imageError) {
                console.error(`❌ Error downloading images for regular product ${product.id}:`, imageError);
                product.imageURL = ['/placeholder-product.svg'];
              }
            } else {
              // Fallback: use original Airtable URLs
              const processedImageURLs = product.imageURL.map((img: any) => {
                if (typeof img === 'string') return img;
                if (img && typeof img === 'object' && img.url) {
                  return img.url;
                }
                if (img && typeof img === 'object' && img.filename) {
                  return null;
                }
                return String(img);
              }).filter((url: string | null) => url && url.length > 0);
              
              product.imageURL = processedImageURLs;
            }
          } else {
            // No images available, use placeholder
            product.imageURL = ['/placeholder-product.svg'];
          }
          
          // Save to SQLite database
          productDB.createProduct(product);
          syncedCount++;
          console.log(`✅ Successfully saved product ${product.id}`);
        }
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ Clear and resync completed: ${syncedCount} products synced`);
    
    return NextResponse.json({
      success: true,
      message: `Clear and resync completed: ${syncedCount} products synced`,
      syncedCount,
      deletedCount: existingProducts.length,
      totalRecords: airtableRecords.length,
      errors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Clear and resync error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during clear and resync',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
