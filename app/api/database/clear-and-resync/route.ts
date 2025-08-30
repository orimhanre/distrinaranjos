import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '../../../../lib/database';
import { AirtableService } from '../../../../lib/airtable';

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
          // ALWAYS use original Airtable URLs for both virtual and regular environments
          if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
            const processedImageURLs = product.imageURL.map((img: any) => {
              if (typeof img === 'string') return img;
              if (img && typeof img === 'object' && img.url) {
                // Use the full Airtable URL (needed for images to load)
                return img.url;
              }
              if (img && typeof img === 'object' && img.filename) {
                // If we only have filename, we can't load the image
                return null;
              }
              return String(img);
            }).filter((url: string | null) => url && url.length > 0);
            
            // Always use the processed URLs (original Airtable URLs)
            product.imageURL = processedImageURLs;
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
