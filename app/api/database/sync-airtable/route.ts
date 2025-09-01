import { NextRequest, NextResponse } from 'next/server';
import { AirtableService, SyncResult } from '../../../../lib/airtable';
import { ProductDatabase } from '../../../../lib/database';
import { ImageDownloader } from '../../../../lib/imageDownloader';
import { VirtualPhotoDownloader } from '../../../../lib/virtualPhotoDownloader';

// Create database instance based on context
let productDB: ProductDatabase;

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting Airtable sync...');
    
    // Get context from request body or headers
    const body = await request.json().catch(() => ({}));
    const context = body.context || request.headers.get('x-context') || 'virtual';
    
    console.log(`🔄 Context received: ${context}`);
    
    // Force environment switch and verify
    AirtableService.switchEnvironmentFromContext(context);
    console.log(`🔄 Using ${context} environment for Airtable sync`);
    console.log(`🔍 Current Airtable environment: ${AirtableService.getCurrentEnvironment()}`);
    
    // Debug: Check environment configuration
    const { EnvironmentLoader } = await import('@/lib/environmentLoader');
    const config = EnvironmentLoader.getEnvironmentConfig(context === 'virtual' ? 'virtual' : 'regular');
    console.log(`🔍 Environment config for ${context}:`, {
      apiKeyExists: !!config.apiKey,
      baseId: config.baseId,
      accountEmail: config.accountEmail
    });
    
    // Verify we're using the correct base ID
    if (context === 'virtual' && config.baseId !== process.env.VIRTUAL_AIRTABLE_BASE_ID) {
      console.error(`❌ WRONG BASE ID! Expected: ${process.env.VIRTUAL_AIRTABLE_BASE_ID}, Got: ${config.baseId}`);
    } else if (context === 'regular' && config.baseId !== process.env.AIRTABLE_BASE_ID) {
      console.error(`❌ WRONG BASE ID! Expected: ${process.env.AIRTABLE_BASE_ID}, Got: ${config.baseId}`);
    } else {
      console.log(`✅ Correct base ID for ${context} environment: ${config.baseId}`);
    }
    
    // Initialize database with correct environment
    console.log(`🔄 Initializing database for ${context} environment...`);
    
    productDB = new ProductDatabase(context === 'virtual' ? 'virtual' : 'regular');
    console.log(`✅ Database initialized successfully for ${context} environment`);
    
    // Clean up all existing images before starting fresh sync
    console.log('🧹 Cleaning up all existing product images before sync...');
    await ImageDownloader.cleanupAllImages();
    console.log('✅ Image cleanup completed');
    
    // Test Airtable connection first
    console.log(`🔄 Testing Airtable connection for ${context} environment...`);
    const connectionTest = await AirtableService.testConnection();
    console.log(`🔄 Airtable connection test result: ${connectionTest}`);
    
    if (!connectionTest) {
      console.error(`❌ Airtable connection failed for ${context} environment`);
      console.error(`❌ Current environment: ${AirtableService.getCurrentEnvironment()}`);
      return NextResponse.json({
        success: false,
        message: 'Failed to connect to Airtable. Please check your API key and base ID.',
        syncedCount: 0,
        errors: ['Airtable connection failed']
      });
    }
    
    console.log(`✅ Airtable connection successful for ${context} environment`);

    // Fetch all records from Airtable
    console.log(`🔄 Fetching all records from Airtable for ${context} environment...`);
    const airtableRecords = await AirtableService.fetchAllRecords();
    console.log(`📊 Found ${airtableRecords.length} records in Airtable for ${context} environment`);

    if (airtableRecords.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No records found in Airtable',
        syncedCount: 0,
        errors: []
      });
    }

    // Get Airtable schema to update column configuration
    const airtableSchema = await AirtableService.getTableSchema();
    console.log(`📋 Airtable schema for ${context} environment:`, airtableSchema);
    console.log(`📋 Current environment: ${AirtableService.getCurrentEnvironment()}`);
    console.log(`📋 Schema length: ${airtableSchema.length}`);

    // Update column configuration to match Airtable
    if (airtableSchema.length > 0) {
      try {
        console.log(`📋 Processing ${airtableSchema.length} fields from Airtable schema`);
        
        // Create new columns based on Airtable schema (keep original case and types)
        const newColumns = airtableSchema.map(fieldName => {
          console.log(`📋 Processing field: ${fieldName}`);
          
          // Determine column type based on field name or content
          let columnType: 'text' | 'number' | 'boolean' | 'select' | 'multipleSelect' | 'attachment' = 'text';
          
          // Check for specific field types
          if (fieldName.toLowerCase().includes('price') || fieldName.toLowerCase().includes('stock') || fieldName.toLowerCase().includes('amount')) {
            columnType = 'number';
          } else if (fieldName.toLowerCase().includes('image') || fieldName.toLowerCase().includes('photo') || fieldName.toLowerCase().includes('attachment')) {
            columnType = 'attachment';
          } else if (fieldName.toLowerCase().includes('starred') || fieldName.toLowerCase().includes('active') || fieldName.toLowerCase().includes('enabled')) {
            columnType = 'boolean';
          } else if (fieldName === 'colors' || fieldName === 'type' || fieldName === 'category' || fieldName === 'subCategory') {
            columnType = 'multipleSelect';
          } else if (fieldName === 'brand') {
            columnType = 'select';
          }
          
          return {
            key: fieldName,
            label: fieldName,
            type: columnType,
            required: false,
            sortable: true,
            filterable: true
          };
        });
        
        console.log(`📋 Created ${newColumns.length} column definitions`);
        
        // Write all columns to environment-specific columns file
        const fs = require('fs');
        const path = require('path');
        const COLUMNS_PATH = path.resolve(process.cwd(), `data/${context === 'virtual' ? 'virtual-' : ''}columns.json`);
        
        fs.writeFileSync(COLUMNS_PATH, JSON.stringify(newColumns, null, 2));
        console.log(`✅ Updated ${context === 'virtual' ? 'virtual-' : ''}columns.json with ${newColumns.length} columns from ${context} Airtable`);
        console.log(`📋 Column file path: ${COLUMNS_PATH}`);
        
        // Also update the database schema to ensure all columns exist (batch operation)
        console.log(`📋 Ensuring all columns exist in database...`);
        const columnKeys = newColumns.map(col => col.key);
        console.log(`📋 Ensuring ${columnKeys.length} columns exist:`, columnKeys);
        
        // Batch ensure columns exist
        productDB.ensureColumnsExist(columnKeys);
        
        console.log(`✅ Database schema updated with all columns`);
        
      } catch (error) {
        console.error('Error updating column configuration:', error);
      }
    }

    // Get all existing product IDs in the database (handle case where database is empty/cleared)
    let existingProductIds = new Set<string>();
    let deletedCount = 0;
    
    try {
      const existingProducts = productDB.getAllProducts();
      existingProductIds = new Set(existingProducts.map(p => p.id));
      
      // Get all Airtable record IDs
      const airtableRecordIds = new Set(airtableRecords.map(r => r.id));
      
      // Find products that exist in database but not in Airtable (to be deleted)
      const productsToDelete = Array.from(existingProductIds).filter(id => !airtableRecordIds.has(id));
      
      // Delete products that no longer exist in Airtable
      for (const productId of productsToDelete) {
        try {
          const deleted = productDB.deleteProduct(productId);
          if (deleted) {
            deletedCount++;
          }
        } catch (error) {
          console.error(`❌ Failed to delete product ${productId}:`, error);
        }
      }
    } catch (error) {
      console.log(`📋 Database appears to be empty or newly created, skipping deletion phase`);
    }
    
    // Convert and sync each record sequentially for better reliability
    let syncedCount = 0;
    const errors: string[] = [];
    const totalRecords = airtableRecords.length;
    let processedRecords = 0;

    console.log(`🔄 Processing ${totalRecords} records sequentially...`);

    // Process records one by one to avoid database conflicts
    for (let i = 0; i < airtableRecords.length; i++) {
      const airtableRecord = airtableRecords[i];
      processedRecords++;
      
      try {
        // Skip records that might have problematic data
        if (!airtableRecord.id) {
          console.warn(`⚠️ Skipping record without ID at index ${i}`);
          continue;
        }

        console.log(`🔄 Processing record ${i + 1}/${totalRecords}: ${airtableRecord.id}`);

        // Convert Airtable record to product
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        
        // Validate product data before saving
        if (!product.id) {
          console.warn(`⚠️ Skipping product without ID: ${airtableRecord.id}`);
          continue;
        }

        // For virtual environment, download images locally with original filenames
        if (context === 'virtual') {
          console.log(`🖼️ Virtual environment: Downloading images locally for ${product.id}`);
          
          const imageAttachments = product.imageURL || product.ImageURL;
          if (imageAttachments && Array.isArray(imageAttachments) && imageAttachments.length > 0) {
            try {
              const localImageUrls = await VirtualPhotoDownloader.downloadProductImages(imageAttachments);
              
              if (localImageUrls.length > 0) {
                product.imageURL = localImageUrls;
                product.ImageURL = localImageUrls;
                console.log(`✅ Virtual environment: Downloaded ${localImageUrls.length} images for ${product.id}`);
              } else {
                // If no images downloaded successfully, use placeholder
                console.log(`🖼️ Virtual environment: No images downloaded, using placeholder for ${product.id}`);
                product.imageURL = ['/placeholder-product.svg'];
              }
            } catch (error) {
              console.warn(`⚠️ Virtual image download failed for ${product.id}:`, error);
              // Use placeholder if download fails
              product.imageURL = ['/placeholder-product.svg'];
            }
          } else {
            // Ensure virtual environment products have placeholder images if no images are available
            console.log(`🖼️ Virtual environment: Adding placeholder image for product ${product.id}`);
            product.imageURL = ['/placeholder-product.svg'];
          }
        } else {
          // Download images if they exist and convert to local URLs (regular environment only)
          const imageUrls = product.imageURL || product.ImageURL;
          if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
            try {
              const downloadedImages = await ImageDownloader.downloadImages(imageUrls);
              
              // Replace original URLs with local paths
              const localImageUrls = downloadedImages
                .filter(img => img.success)
                .map(img => img.localPath);
              
              if (localImageUrls.length > 0) {
                product.imageURL = localImageUrls;
                product.ImageURL = localImageUrls;
              }
            } catch (error) {
              console.warn(`⚠️ Image download failed for ${product.id}:`, error);
              // Continue with original URLs if download fails
            }
          }
        }

        // Check if product already exists
        const existingProduct = productDB.getProduct(product.id);
        
        if (existingProduct) {
          // Update existing product
          const updatedProduct = productDB.updateProduct(product.id, product);
          if (updatedProduct) {
            syncedCount++;
            console.log(`✅ Updated product: ${product.id}`);
          } else {
            throw new Error('Failed to update product');
          }
        } else {
          // Create new product
          const createdProduct = productDB.createProduct(product);
          
          if (createdProduct) {
            syncedCount++;
            console.log(`✅ Created product: ${product.id}`);
          } else {
            throw new Error('Failed to create product');
          }
        }
        
        // Progress update every 10 records
        if (processedRecords % 10 === 0) {
          console.log(`📊 Progress: ${processedRecords}/${totalRecords} records processed, ${syncedCount} synced`);
        }
        
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
        
        // Continue with next record instead of failing the entire sync
        continue;
      }
    }

    // Note: Image cleanup is now manual only - no automatic cleanup during sync
    // WebPhotos (like logos) are managed by the webPhotos sync process

    // Populate category-subcategory relations from synced products
    const relationsCreated = productDB.populateCategoryRelations();

    // Post-sync cleanup for virtual environment: ensure all products have placeholder images
    if (context === 'virtual') {
      console.log('🖼️ Virtual environment: Running post-sync cleanup to ensure placeholder images...');
      const allProducts = productDB.getAllProducts();
      let placeholderCount = 0;
      
      for (const product of allProducts) {
        if (!product.imageURL || product.imageURL.length === 0) {
          console.log(`🖼️ Adding placeholder image to product: ${product.id} - ${product.name}`);
          const updatedProduct = { ...product, imageURL: ['/placeholder-product.svg'] };
          productDB.updateProduct(product.id, updatedProduct);
          placeholderCount++;
        }
      }
      
      console.log(`🖼️ Post-sync cleanup completed: ${placeholderCount} products updated with placeholder images`);
    }

    // Update sync timestamp directly
    const syncTimestamp = new Date().toLocaleString('es-ES');
    try {
      const { writeFileSync, existsSync } = require('fs');
      const { join } = require('path');
      
      const TIMESTAMPS_FILE = join(process.cwd(), 'data', 'virtual-sync-timestamps.json');
      const dataDir = join(process.cwd(), 'data');
      
      // Ensure data directory exists
      if (!existsSync(dataDir)) {
        const fs = require('fs');
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Read existing timestamps
      let timestamps: {
        lastProductSync: string | null;
        lastWebPhotosSync: string | null;
      } = {
        lastProductSync: null,
        lastWebPhotosSync: null
      };
      
      if (existsSync(TIMESTAMPS_FILE)) {
        try {
          const content = require('fs').readFileSync(TIMESTAMPS_FILE, 'utf8');
          timestamps = JSON.parse(content);
        } catch (error) {
          console.warn('⚠️ Error reading existing timestamps:', error);
        }
      }
      
      // Update product sync timestamp
      timestamps.lastProductSync = syncTimestamp;
      
      // Write updated timestamps to file
      writeFileSync(TIMESTAMPS_FILE, JSON.stringify(timestamps, null, 2), 'utf8');
      
      // Also update via API endpoint for immediate web page updates
      try {
        const baseUrl = process.env.RAILWAY_STATIC_URL || 'http://localhost:3000';
        const apiResponse = await fetch(`${baseUrl}/api/admin/virtual-sync-timestamps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'products', timestamp: syncTimestamp })
        });
        
        if (apiResponse.ok) {
          console.log('✅ Timestamp updated via API endpoint');
        } else {
          console.warn('⚠️ Failed to update timestamp via API endpoint');
        }
      } catch (apiError) {
        console.warn('⚠️ Error updating timestamp via API endpoint:', apiError);
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to update sync timestamp:', error);
    }

    // Add cache busting headers to response
    const response = NextResponse.json({
      success: true,
      message: `Sincronización de productos completada: ${syncedCount} sincronizados, ${deletedCount} eliminados`,
      syncedCount,
      deletedCount,
      totalRecords: airtableRecords.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now(), // Include cache buster timestamp
      syncTimestamp: syncTimestamp
    });

    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Buster', Date.now().toString());

    // Check final product count after sync
    const finalProducts = productDB.getAllProducts();
    
    // Clean up unused virtual images if this is virtual environment
    if (context === 'virtual') {
      try {
        console.log('🧹 Cleaning up unused virtual images...');
        
        // Get all current product image filenames
        const currentProductFilenames = new Set(
          finalProducts.flatMap(product => 
            (product.imageURL || [])
              .filter(Boolean)
              .map(url => {
                // Extract filename from URL
                const urlParts = url.split('/');
                return urlParts[urlParts.length - 1];
              })
          )
        );
        
        // Get current WebPhoto filenames
        const { WebPhotosDatabase } = await import('@/lib/database');
        const webPhotosDB = new WebPhotosDatabase('virtual');
        const currentWebPhotos = webPhotosDB.getAllWebPhotos();
        
        // Ensure currentWebPhotos is an array and handle it safely
        const currentWebPhotoFilenames = new Set<string>();
        if (Array.isArray(currentWebPhotos)) {
          currentWebPhotos
            .filter((webPhoto: any) => webPhoto && webPhoto.imageUrl)
            .forEach((webPhoto: any) => {
              const url = webPhoto.imageUrl;
              if (url && typeof url === 'string' && url.length > 0) {
                // Extract filename from URL
                const urlParts = url.split('/');
                const filename = urlParts[urlParts.length - 1];
                if (filename) {
                  currentWebPhotoFilenames.add(filename);
                }
              }
            });
        }
        
        // Clean up unused images
        await VirtualPhotoDownloader.cleanupUnusedImages(currentProductFilenames, 'products');
        await VirtualPhotoDownloader.cleanupUnusedImages(currentWebPhotoFilenames, 'webphotos');
        console.log('✅ Virtual image cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Virtual image cleanup failed:', cleanupError);
      }
    }
    
    // SUMMARY - Key numbers for debugging
    console.log(`\n📊 SYNC SUMMARY:`);
    console.log(`📊 Airtable records found: ${airtableRecords.length}`);
    console.log(`📊 Products successfully synced: ${syncedCount}`);
    console.log(`📊 Products deleted: ${deletedCount}`);
    console.log(`📊 Final database count: ${finalProducts.length}`);
    console.log(`📊 Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log(`📊 Error details:`, errors.slice(0, 3)); // Show first 3 errors
    }
    console.log(`📊 END SYNC SUMMARY\n`);
    
    return response;
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.error('❌ Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      context: 'virtual'
    });
    return NextResponse.json({
      success: false,
      message: 'Failed to sync from Airtable',
      syncedCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }, { status: 500 });
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