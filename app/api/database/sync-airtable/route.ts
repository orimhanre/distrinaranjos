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
    console.log(`🔍 Creating ProductDatabase instance for context: ${context}`);
    
    // Force a fresh database connection to ensure we're using the correct database
    const { resetDatabaseSingletons, getFreshDatabase } = await import('../../../../lib/database');
    resetDatabaseSingletons(context);
    console.log(`🔄 Reset database singletons for ${context} environment`);
    
    // Force a completely fresh database connection
    const freshDb = getFreshDatabase(context);
    console.log(`🔄 Created fresh database connection for ${context} environment`);
    
    productDB = new ProductDatabase(context);
    console.log(`✅ ProductDatabase instance created for ${context} environment`);
    
    // Verify database is working correctly
    console.log(`🔍 Testing database operations...`);
    const initialProductCount = productDB.getAllProducts().length;
    console.log(`🔍 Initial product count in database: ${initialProductCount}`);
    
    // Test database write operation
    const testProduct = {
      id: 'test_sync_' + Date.now(),
      name: 'Test Product',
      brand: 'Test Brand',
      type: 'Test Type',
      colors: ['Test Color'],
      price: 100,
      stock: 50
    };
    
    try {
      productDB.createProduct(testProduct);
      console.log(`✅ Test product created successfully`);
      
      const testCount = productDB.getAllProducts().length;
      console.log(`🔍 Product count after test creation: ${testCount}`);
      
      // Clean up test product
      productDB.deleteProduct(testProduct.id);
      console.log(`✅ Test product cleaned up`);
      
      const finalTestCount = productDB.getAllProducts().length;
      console.log(`🔍 Product count after cleanup: ${finalTestCount}`);
      
    } catch (testError) {
      console.error(`❌ Database test failed:`, testError);
    }
    
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
    console.log(`🔍 Found ${existingProducts.length} existing products before clearing`);
    productDB.clearAllProducts();
    console.log(`🗑️ Cleared ${existingProducts.length} existing products from SQLite database`);
    
    // Verify database is empty
    const productsAfterClear = productDB.getAllProducts();
    console.log(`🔍 Products after clearing: ${productsAfterClear.length}`);
    
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
            console.log(`📸 Processing images for product ${product.name}:`, {
              originalImageURLs: product.imageURL,
              count: product.imageURL.length
            });
            
            try {
              const downloadedImages = await ImageDownloader.downloadImages(product.imageURL);
              console.log(`📸 Download results for ${product.name}:`, {
                totalDownloaded: downloadedImages.length,
                successful: downloadedImages.filter(img => img.success).length,
                failed: downloadedImages.filter(img => !img.success).length
              });
              
              if (downloadedImages && downloadedImages.length > 0) {
                // Extract local paths from downloaded images
                const localPaths = downloadedImages
                  .filter(img => img.success)
                  .map(img => img.localPath);
                if (localPaths.length > 0) {
                  console.log(`📸 Updated imageURL for ${product.name}:`, {
                    from: product.imageURL,
                    to: localPaths
                  });
                  product.imageURL = localPaths;
                } else {
                  console.log(`⚠️ No successful image downloads for ${product.name}`);
                }
              }
            } catch (imageError) {
              console.warn(`⚠️ Failed to download images for product ${product.name}:`, imageError);
              // Continue with original URLs if download fails
            }
          } else {
            console.log(`📸 No images to process for product ${product.name}`);
          }
          
          // Save to SQLite database
          console.log(`💾 Saving product to database:`, {
            id: product.id,
            name: product.name,
            brand: product.brand,
            price: product.price,
            stock: product.stock
          });
          
          try {
            productDB.createProduct(product);
            syncedCount++;
            console.log(`✅ Successfully saved product ${product.id}`);
          } catch (saveError) {
            console.error(`❌ Failed to save product ${product.id}:`, saveError);
            errors.push(`Failed to save product ${product.id}: ${saveError}`);
          }
        }
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ SQLite sync completed: ${syncedCount} products synced, ${errors.length} errors`);
    
    // Verify the products were actually saved by checking the database
    console.log(`🔍 Verifying products were saved to database...`);
    const finalProductCount = productDB.getAllProducts().length;
    console.log(`🔍 Final product count in database: ${finalProductCount}`);
    console.log(`🔍 Expected count: ${syncedCount}, Actual count: ${finalProductCount}`);
    
    // Additional verification - check if database file exists and has data
    const fs = require('fs');
    const dbPath = context === 'virtual' ? 'data/virtual-products.db' : 'data/products.db';
    const dbExists = fs.existsSync(dbPath);
    const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
    console.log(`🔍 Database file exists: ${dbExists}, Size: ${dbSize} bytes`);
    
    if (finalProductCount === 0 && syncedCount > 0) {
      console.error(`❌ CRITICAL ISSUE: ${syncedCount} products were supposedly synced but database is empty!`);
      return NextResponse.json({
        success: false,
        message: `Error: ${syncedCount} productos fueron procesados pero no se guardaron en la base de datos`,
        syncedCount: 0,
        deletedCount: existingProducts.length,
        totalRecords: airtableRecords.length,
        errors: [...errors, 'Products were processed but not saved to database'],
        timestamp: new Date().toISOString(),
        cacheBuster: Date.now(),
        syncTimestamp: new Date().toLocaleString('es-ES')
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Sincronización de productos completada: ${syncedCount} sincronizados, ${existingProducts.length} eliminados`,
      syncedCount,
      deletedCount: existingProducts.length,
      totalRecords: airtableRecords.length,
      finalProductCount,
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