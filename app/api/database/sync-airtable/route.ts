import { NextRequest, NextResponse } from 'next/server';
import { AirtableService, SyncResult } from '../../../../lib/airtable';
import { ProductDatabase } from '../../../../lib/database';
import { ImageDownloader } from '../../../../lib/imageDownloader';

// Create database instance based on context
let productDB: ProductDatabase;

export async function POST(request: NextRequest) {
  try {
    const { context = 'virtual' } = await request.json();
    
    console.log(`🔄 Starting Airtable sync for ${context} environment...`);
    
    // Switch Airtable environment based on context
    AirtableService.switchEnvironmentFromContext(context);
    
    // Initialize database for the specified context
    productDB = new ProductDatabase(context);
    
    // Test Airtable connection
    const connectionTest = await AirtableService.testConnection();
    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        message: 'Failed to connect to Airtable',
        syncedCount: 0,
        errors: ['Airtable connection failed']
      });
    }
    
    // Fetch all records from Airtable
    const airtableRecords = await AirtableService.fetchAllRecords();
    console.log(`📊 Found ${airtableRecords.length} records in Airtable`);
    
    if (airtableRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records found in Airtable',
        syncedCount: 0,
        errors: []
      });
    }
    
    // Clear existing products in SQLite database
    const existingProducts = productDB.getAllProducts();
    productDB.clearAllProducts();
    console.log(`🗑️ Cleared ${existingProducts.length} existing products from SQLite database`);
    
    // Convert and save products to SQLite database
    let syncedCount = 0;
    const errors: string[] = [];
    
    console.log(`🔍 Current Airtable environment: ${AirtableService.getCurrentEnvironment()}`);
    console.log(`🔍 Total records to process: ${airtableRecords.length}`);
    
    for (const airtableRecord of airtableRecords) {
      try {
        console.log(`🔍 Processing record ${airtableRecord.id}:`, {
          fields: Object.keys(airtableRecord.fields),
          hasName: !!airtableRecord.fields.Name,
          hasBrand: !!airtableRecord.fields.Brand
        });
        
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        console.log(`🔍 Converted product:`, {
          id: product?.id,
          name: product?.name,
          brand: product?.brand,
          hasImageURL: !!product?.imageURL
        });
        
        if (product) {
          // Download images if needed
          if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
            try {
              const downloadedImages = await ImageDownloader.downloadImages(product.imageURL);
              if (downloadedImages && downloadedImages.length > 0) {
                // Extract local paths from downloaded images
                const localPaths = downloadedImages
                  .filter(img => img.success)
                  .map(img => img.localPath);
                if (localPaths.length > 0) {
                  product.imageURL = localPaths;
                }
              }
            } catch (imageError) {
              console.warn(`⚠️ Failed to download images for product ${product.name}:`, imageError);
              // Continue with original URLs if download fails
            }
          }
          
          // Save to SQLite database
          productDB.createProduct(product);
          syncedCount++;
        }
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ SQLite sync completed: ${syncedCount} products synced, ${errors.length} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Sincronización de productos completada: ${syncedCount} sincronizados, ${existingProducts.length} eliminados`,
      syncedCount,
      deletedCount: existingProducts.length,
      totalRecords: airtableRecords.length,
      errors,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now(),
      syncTimestamp: new Date().toLocaleString('es-ES')
    });
    
  } catch (error) {
    console.error('❌ SQLite sync error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during SQLite sync',
      syncedCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Test Airtable connection
    const connectionTest = await AirtableService.testConnection();
    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        message: 'Airtable connection failed',
        connected: false,
        recordCount: 0,
        schema: []
      });
    }

    // Get record count and schema
    const records = await AirtableService.fetchAllRecords();
    const schema = await AirtableService.getTableSchema();

    return NextResponse.json({
      success: true,
      message: 'Airtable connection successful',
      connected: true,
      recordCount: records.length,
      schema
    });
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test Airtable connection',
      connected: false,
      recordCount: 0,
      schema: []
    }, { status: 500 });
  }
} 