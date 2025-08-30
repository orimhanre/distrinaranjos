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
    
    // Convert and save products to SQLite database
    let syncedCount = 0;
    const errors: string[] = [];
    
    console.log(`🔍 Current Airtable environment: ${AirtableService.getCurrentEnvironment()}`);
    console.log(`🔍 Total records to process: ${airtableRecords.length}`);
    
    for (const airtableRecord of airtableRecords) {
      try {
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        
        if (product) {
          // Handle image URLs differently for virtual vs regular environments
          if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
            if (context === 'virtual') {
              // For virtual products, use original Airtable URLs
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
            } else {
              // For regular products, prepare for local download
              const processedImageURLs = product.imageURL.map((img: any) => {
                if (typeof img === 'string') return img;
                if (img && typeof img === 'object' && img.url) {
                  return img.url;
                }
                if (img && typeof img === 'object' && img.filename) {
                  return `https://dl.airtable.com/.attachments/${img.filename}`;
                }
                return String(img);
              }).filter((url: string | null) => url && url.length > 0);
              
              product.imageURL = processedImageURLs;
            }
          }
          
          // Save to SQLite database
          try {
            productDB.createProduct(product);
            syncedCount++;
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
    
    // Download images for regular environment only
    if (context === 'regular' && syncedCount > 0) {
      console.log(`🖼️ Starting image download process for regular environment...`);
      
      try {
        // Get all products and download their images
        const allProducts = productDB.getAllProducts();
        let downloadedImages = 0;
        let imageErrors = 0;
        
        for (const product of allProducts) {
          if (product.imageURL && Array.isArray(product.imageURL) && product.imageURL.length > 0) {
            for (let i = 0; i < product.imageURL.length; i++) {
              const imageUrl = product.imageURL[i];
              try {
                if (typeof imageUrl === 'string' && imageUrl.includes('dl.airtable.com')) {
                  // Create meaningful filename based on product info
                  const productName = (product as any).name || 'unknown';
                  const productId = (product as any).id || 'unknown';
                  const brand = (product as any).brand || 'unknown';
                  
                  // Clean product name for filename
                  const cleanProductName = productName
                    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
                    .replace(/\s+/g, '_') // Replace spaces with underscores
                    .toLowerCase()
                    .substring(0, 30); // Limit length
                  
                  const cleanBrand = brand
                    .replace(/[^a-zA-Z0-9\s]/g, '')
                    .replace(/\s+/g, '_')
                    .toLowerCase()
                    .substring(0, 20);
                  
                  // Get file extension from original URL
                  const urlParts = imageUrl.split('/');
                  const originalFilename = urlParts[urlParts.length - 1]?.split('?')[0];
                  const extension = originalFilename ? originalFilename.split('.').pop() || 'jpg' : 'jpg';
                  
                  // Create meaningful filename
                  const filename = `${cleanBrand}_${cleanProductName}_${productId}_${i + 1}.${extension}`;
                  
                  // Download image using the ImageDownloader
                  const fs = require('fs');
                  const path = require('path');
                  const https = require('https');
                  
                  // Create images directory if it doesn't exist
                  const imagesDir = path.join(process.cwd(), 'public', 'images', 'products');
                  if (!fs.existsSync(imagesDir)) {
                    fs.mkdirSync(imagesDir, { recursive: true });
                  }
                  
                  const filePath = path.join(imagesDir, filename);
                  
                  // Skip if file already exists
                  if (!fs.existsSync(filePath)) {
                    console.log(`⬇️ Downloading image: ${filename} (from ${originalFilename})`);
                    
                    const file = fs.createWriteStream(filePath);
                    https.get(imageUrl, (response: any) => {
                      if (response.statusCode === 200) {
                        response.pipe(file);
                        file.on('finish', () => {
                          file.close();
                          downloadedImages++;
                          console.log(`✅ Downloaded: ${filename}`);
                          
                          // Update the product's imageURL to use the new local path
                          const localImageUrl = `/images/products/${filename}`;
                          product.imageURL[i] = localImageUrl;
                        });
                      } else {
                        console.log(`❌ Failed to download ${filename}: HTTP ${response.statusCode}`);
                        imageErrors++;
                        fs.unlink(filePath, () => {});
                      }
                    }).on('error', (err: any) => {
                      console.log(`❌ Error downloading ${filename}: ${err.message}`);
                      imageErrors++;
                      fs.unlink(filePath, () => {});
                    });
                  } else {
                    console.log(`⏭️ Image already exists: ${filename}`);
                    downloadedImages++;
                    
                    // Update the product's imageURL to use the existing local path
                    const localImageUrl = `/images/products/${filename}`;
                    product.imageURL[i] = localImageUrl;
                  }
                }
              } catch (error) {
                console.log(`❌ Error processing image for product ${product.id}: ${error}`);
                imageErrors++;
              }
            }
            
            // Update the product in the database with the new image URLs
            try {
              if (product.imageURL && Array.isArray(product.imageURL)) {
                productDB.updateProduct(product.id, { imageURL: product.imageURL });
              }
            } catch (updateError) {
              console.log(`❌ Failed to update product ${product.id} with new image URLs: ${updateError}`);
            }
          }
        }
        
        console.log(`🖼️ Image download completed: ${downloadedImages} downloaded, ${imageErrors} errors`);
        
      } catch (error) {
        console.log(`❌ Image download process failed: ${error}`);
      }
    }
    
    // Verify the products were actually saved by checking the database
    console.log(`🔍 Verifying products were saved to database...`);
    const finalProductCount = productDB.getAllProducts().length;
    console.log(`🔍 Final product count in database: ${finalProductCount}`);
    
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