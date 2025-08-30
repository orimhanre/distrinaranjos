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
    
    // Force database schema reset to ensure correct schema
    console.log(`🔄 Forcing database schema reset for ${context} environment`);
    const resetSuccess = productDB.resetDatabaseSchema();
    console.log(`🔄 Database schema reset result: ${resetSuccess}`);
    
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
    
    // For virtual products, we keep original Airtable URLs instead of downloading locally
    // This avoids Railway filesystem issues and ensures images are always accessible
    console.log(`📸 Virtual environment: Using original Airtable image URLs (no local download)`);
    
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
          // Handle image URLs differently for virtual vs regular environments
                  if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {

          if (context === 'virtual') {
              // For virtual products, ALWAYS use original Airtable URLs
              // This completely avoids Railway filesystem issues
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
                        } else {
              // For regular products, use original filenames (same as virtual)
              // This avoids long Airtable URLs and uses clean filenames
              console.log(`📥 Regular environment: Using original filenames for product ${product.id}`);
              
              const processedImageURLs = product.imageURL.map((img: any) => {
                if (typeof img === 'string') return img;
                if (img && typeof img === 'object' && img.filename) {
                  // Use the original filename (clean and short)
                  return `/images/products/${img.filename}`;
                }
                if (img && typeof img === 'object' && img.url) {
                  // Extract filename from Airtable URL if no filename available
                  const urlParts = img.url.split('/');
                  const lastPart = urlParts[urlParts.length - 1];
                  return `/images/products/${lastPart}`;
                }
                return String(img);
              }).filter((url: string | null) => url && url.length > 0);
              
              // Use the processed URLs (original filenames)
              product.imageURL = processedImageURLs;
            }
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
    
    // Download images for synced products
    console.log(`🖼️ Starting image download process...`);
    let downloadedImages = 0;
    let imageErrors = 0;
    
    try {
      const fs = require('fs');
      const path = require('path');
      const https = require('https');
      
      // Create images directory if it doesn't exist
      const imagesDir = path.join(process.cwd(), 'public', 'images', 'products');
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log(`📁 Created images directory: ${imagesDir}`);
      }
      
      // Get all products and download their images
      const allProducts = productDB.getAllProducts();
      for (const product of allProducts) {
        if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
          for (const imageUrl of product.imageURL) {
            try {
              // Extract filename from URL
              let filename = '';
              if (typeof imageUrl === 'string') {
                // Handle both local paths and Airtable URLs
                if (imageUrl.startsWith('/images/products/')) {
                  // Local path - extract filename
                  filename = imageUrl.split('/').pop() || '';
                  filename = filename.split('?')[0]; // Remove query parameters
                } else if (imageUrl.includes('dl.airtable.com')) {
                  // Airtable URL - extract attachment ID
                  const urlParts = imageUrl.split('/');
                  filename = urlParts[urlParts.length - 1] || '';
                  filename = filename.split('?')[0]; // Remove query parameters
                } else {
                  // Unknown format, skip
                  console.log(`⚠️ Unknown image URL format: ${imageUrl}`);
                  continue;
                }
              } else if (imageUrl && typeof imageUrl === 'object' && 'filename' in imageUrl) {
                const filenameObj = imageUrl as { filename: string };
                filename = filenameObj.filename;
              } else {
                continue;
              }
              
              if (!filename) continue;
              
              const filePath = path.join(imagesDir, filename);
              
              // Skip if file already exists
              if (fs.existsSync(filePath)) {
                console.log(`⏭️ Image already exists: ${filename}`);
                continue;
              }
              
              // Try to download from Airtable using the filename as attachment ID
              const airtableImageUrl = `https://dl.airtable.com/.attachments/${filename}`;
              console.log(`⬇️ Downloading: ${filename}`);
              
              const file = fs.createWriteStream(filePath);
              https.get(airtableImageUrl, (response: any) => {
                if (response.statusCode === 200) {
                  response.pipe(file);
                  file.on('finish', () => {
                    file.close();
                    downloadedImages++;
                    console.log(`✅ Downloaded: ${filename}`);
                  });
                } else {
                  console.log(`❌ Failed to download ${filename}: HTTP ${response.statusCode}`);
                  imageErrors++;
                  fs.unlink(filePath, () => {}); // Delete partial file
                }
              }).on('error', (err: any) => {
                console.log(`❌ Error downloading ${filename}: ${err.message}`);
                imageErrors++;
                fs.unlink(filePath, () => {}); // Delete partial file
              });
              
            } catch (error) {
              console.log(`❌ Error processing image for product ${product.id}: ${error}`);
              imageErrors++;
            }
          }
        }
      }
      
      console.log(`🖼️ Image download completed: ${downloadedImages} downloaded, ${imageErrors} errors`);
      
    } catch (error) {
      console.log(`❌ Image download process failed: ${error}`);
    }
    
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