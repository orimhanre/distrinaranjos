import { NextRequest, NextResponse } from 'next/server';
import { AirtableService, SyncResult } from '../../../../lib/airtable';
import { ProductDatabase } from '../../../../lib/database';
import { ImageDownloader } from '../../../../lib/imageDownloader';
import { VirtualPhotoDownloader } from '../../../../lib/virtualPhotoDownloader';
import { RegularPhotoDownloader } from '../../../../lib/regularPhotoDownloader';
import fs from 'fs';
import path from 'path';

// Create database instance based on context
let productDB: ProductDatabase;

// Global sync lock to prevent multiple simultaneous syncs
let syncInProgress = false;

export async function POST(request: NextRequest) {
  // Check if sync is already in progress
  if (syncInProgress) {
    console.log('⚠️ Sync already in progress, rejecting request');
    return NextResponse.json({
      success: false,
      message: 'Sync already in progress. Please wait for the current sync to complete.',
      syncedCount: 0,
      errors: ['Sync already in progress']
    }, { status: 429 });
  }

  try {
    syncInProgress = true;
    console.log('🔄 Starting simple Airtable sync...');
    
    const { context = 'virtual' } = await request.json();
    console.log(`🔄 Context: ${context}`);
    
    // Switch Airtable environment
    AirtableService.switchEnvironmentFromContext(context);
    
    // Initialize database
    const productDB = new ProductDatabase(context);
    console.log(`✅ Database initialized for ${context}`);
    
    // STEP 1: Clear existing products (virtual environment)
    if (context === 'virtual') {
      console.log('🧹 STEP 1: Clearing existing products...');
      const existingProducts = productDB.getAllProducts();
      console.log(`📊 Found ${existingProducts.length} existing products to clear`);
      
      let deletedCount = 0;
      for (const product of existingProducts) {
        const deleted = productDB.deleteProduct(product.id);
        if (deleted) {
          deletedCount++;
        }
      }
      console.log(`✅ Cleared ${deletedCount} existing products`);
      
      // VERIFY: Check if clearing worked
      const remainingProducts = productDB.getAllProducts();
      console.log(`🔍 VERIFICATION: ${remainingProducts.length} products remaining after clear`);
      
      if (remainingProducts.length > 0) {
        console.error(`❌ CRITICAL: Database clear failed! Still have ${remainingProducts.length} products`);
        throw new Error(`Database clear failed: ${remainingProducts.length} products still exist`);
      }
      console.log('✅ Database clear verification successful');
    }
    
    // STEP 2: Test Airtable connection
    console.log('🔗 STEP 2: Testing Airtable connection...');
    const connectionTest = await AirtableService.testConnection();
    if (!connectionTest) {
      throw new Error('Airtable connection failed');
    }
    console.log('✅ Airtable connection successful');
    
    // STEP 3: Fetch products from Airtable
    console.log('📥 STEP 3: Fetching products from Airtable...');
    const airtableRecords = await AirtableService.fetchAllRecords();
    console.log(`📊 Found ${airtableRecords.length} products in Airtable`);
    
    // STEP 3.5: Get field types from Airtable and save to virtual-columns.json
    console.log('📋 STEP 3.5: Getting field types from Airtable...');
    const fieldTypes = await AirtableService.getTableSchemaWithTypes();
    console.log(`📋 Found ${fieldTypes.length} fields with types:`, fieldTypes);
    
    // Save field types to appropriate columns file based on context
    const columnsFileName = context === 'virtual' ? 'virtual-columns.json' : 'columns.json';
    const columnsPath = path.resolve(process.cwd(), `data/${columnsFileName}`);
    fs.writeFileSync(columnsPath, JSON.stringify(fieldTypes, null, 2));
    console.log(`💾 Saved field types to ${columnsPath}`);
    
    if (airtableRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No products found in Airtable',
        syncedCount: 0
      });
    }
    
    // STEP 4: Process each product
    console.log('💾 STEP 4: Processing products...');
    let syncedCount = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < airtableRecords.length; i++) {
      const airtableRecord = airtableRecords[i];
      
      try {
        if (!airtableRecord.id) {
          console.warn(`⚠️ Skipping record without ID at index ${i}`);
          continue;
        }
        
        // Convert to product
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        
        
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
        
        // Save to database (use upsert to handle existing products)
        const existingProduct = productDB.getProduct(product.id);
        let savedProduct;
        
        if (existingProduct) {
          // Update existing product
          savedProduct = productDB.updateProduct(product.id, product);
          if (savedProduct) {
            syncedCount++;
            console.log(`✅ Updated product ${i + 1}/${airtableRecords.length}: ${product.id}`);
          } else {
            console.warn(`⚠️ Failed to update product: ${product.id}`);
          }
        } else {
          // Create new product
          savedProduct = productDB.createProduct(product);
          if (savedProduct) {
            syncedCount++;
            console.log(`✅ Created product ${i + 1}/${airtableRecords.length}: ${product.id}`);
          } else {
            console.warn(`⚠️ Failed to create product: ${product.id}`);
          }
        }
        
        // Progress update every 10 products
        if ((i + 1) % 10 === 0) {
          console.log(`📊 Progress: ${i + 1}/${airtableRecords.length} products processed`);
        }
        
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    // STEP 5: Final verification
    console.log('🔍 STEP 5: Final verification...');
    const finalProducts = productDB.getAllProducts();
    console.log(`📊 Final database count: ${finalProducts.length}`);
    console.log(`📊 Expected count: ${airtableRecords.length}`);
    console.log(`📊 Products synced: ${syncedCount}`);
    
    if (finalProducts.length !== airtableRecords.length) {
      console.error(`❌ COUNT MISMATCH! Database: ${finalProducts.length}, Airtable: ${airtableRecords.length}`);
      console.error(`❌ This indicates a duplication or deletion problem!`);
    } else {
      console.log('✅ Product count verification successful!');
    }
    
    // Final summary
    console.log(`✅ Sync completed: ${syncedCount} products synced`);
    
    return NextResponse.json({
      success: true,
      message: `Sincronización completada: ${syncedCount} productos sincronizados`,
      syncedCount,
      totalRecords: airtableRecords.length,
      finalDatabaseCount: finalProducts.length,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to sync from Airtable',
      syncedCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
  } finally {
    syncInProgress = false;
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
        schema: [],
        fieldTypes: []
      });
    }

    // Get record count, schema, and field types
    const records = await AirtableService.fetchAllRecords();
    const schema = await AirtableService.getTableSchema();
    const fieldTypes = await AirtableService.getTableSchemaWithTypes();

    return NextResponse.json({
      success: true,
      message: 'Airtable connection successful',
      connected: true,
      recordCount: records.length,
      schema,
      fieldTypes
    });
  } catch (error) {
    console.error('Airtable connection test failed:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to test Airtable connection',
      connected: false,
      recordCount: 0,
      schema: [],
      fieldTypes: []
    }, { status: 500 });
  }
} 