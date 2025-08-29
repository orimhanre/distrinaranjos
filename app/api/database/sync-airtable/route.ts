import { NextRequest, NextResponse } from 'next/server';
import { AirtableService, SyncResult } from '../../../../lib/airtable';
import { ProductDatabase } from '../../../../lib/database';
import { ImageDownloader } from '../../../../lib/imageDownloader';

// Firebase sync function for virtual database
async function syncToFirebase(context: string) {
  try {
    console.log('🔄 Starting Firebase sync for virtual database...');
    
    const { virtualDb } = await import('@/lib/firebase');
    const { collection, doc, setDoc, deleteDoc, getDocs } = await import('firebase/firestore');
    
    if (!virtualDb) {
      throw new Error('Virtual Firebase database not initialized');
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
    
    // Clear existing products in Firebase
    const productsRef = collection(virtualDb, 'products');
    const existingProducts = await getDocs(productsRef);
    const deletePromises = existingProducts.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    console.log(`🗑️ Cleared ${existingProducts.docs.length} existing products from Firebase`);
    
    // Convert and save products to Firebase
    let syncedCount = 0;
    const errors: string[] = [];
    
    for (const airtableRecord of airtableRecords) {
      try {
        const product = AirtableService.convertAirtableToProduct(airtableRecord);
        if (product) {
          const productId = `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await setDoc(doc(virtualDb, 'products', productId), {
            ...product,
            id: productId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          syncedCount++;
        }
      } catch (error) {
        const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`✅ Firebase sync completed: ${syncedCount} products synced, ${errors.length} errors`);
    
    return NextResponse.json({
      success: true,
      message: `Sincronización de productos completada: ${syncedCount} sincronizados, ${existingProducts.docs.length} eliminados`,
      syncedCount,
      deletedCount: existingProducts.docs.length,
      totalRecords: airtableRecords.length,
      errors,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now(),
      syncTimestamp: new Date().toLocaleString('es-ES')
    });
    
  } catch (error) {
    console.error('❌ Firebase sync error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during Firebase sync',
      syncedCount: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error']
    });
  }
}

// Create database instance based on context
let productDB: ProductDatabase;

export async function POST(request: NextRequest) {
    // Check if required virtual Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID ||
        !process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ||
        !process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Virtual Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { virtualDb } = await import('../..//lib/firebase');
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
    if (context === 'virtual' && config.baseId !== 'appyNH3iztQpMqHAY') {
      console.error(`❌ WRONG BASE ID! Expected: appyNH3iztQpMqHAY, Got: ${config.baseId}`);
    } else if (context === 'regular' && config.baseId !== 'appDCsBKlJPhUVcMr') {
      console.error(`❌ WRONG BASE ID! Expected: appDCsBKlJPhUVcMr, Got: ${config.baseId}`);
    } else {
      console.log(`✅ Correct base ID for ${context} environment: ${config.baseId}`);
    }
    
    // Initialize database with correct environment
    console.log(`🔄 Initializing database for ${context} environment...`);
    
    // For virtual environment, use Firebase instead of SQLite
    if (context === 'virtual') {
      console.log('🔄 Using Firebase for virtual database sync');
      return await syncToFirebase(context);
    }
    
    // For regular environment, use SQLite
    productDB = new ProductDatabase('regular');
    console.log(`✅ SQLite database initialized successfully for ${context} environment`);
    
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
    
    // Convert and sync each record with optimizations
    let syncedCount = 0;
    const errors: string[] = [];
    const totalRecords = airtableRecords.length;
    let processedRecords = 0;

    // Process records in larger batches for maximum performance
    const BATCH_SIZE = 100;
    const batches = [];
    
    for (let i = 0; i < airtableRecords.length; i += BATCH_SIZE) {
      batches.push(airtableRecords.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];

      // Process batch in parallel
      const batchPromises = batch.map(async (airtableRecord) => {
        try {
          // Skip records that might have problematic data
          if (!airtableRecord.id) {
            return { success: false, error: 'Missing ID' };
          }

          // Use the original record without limiting array fields
          const product = AirtableService.convertAirtableToProduct(airtableRecord);
          
          // Validate product data before saving
          if (!product.id) {
            throw new Error('Missing product ID');
          }

          // Download images if they exist and convert to local URLs
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
              // Continue with original URLs if download fails
            }
          }

          // Check if product already exists
          const existingProduct = productDB.getProduct(product.id);
          
          if (existingProduct) {
            // Update existing product for both environments
            const updatedProduct = productDB.updateProduct(product.id, product);
            if (updatedProduct) {
              return { success: true, type: 'update', product };
            } else {
              throw new Error('Failed to update product');
            }
          } else {
            // Create new product
            try {
              const createdProduct = await productDB.createProduct(product);
              return { success: true, type: 'create', product: createdProduct };
            } catch (error) {
              throw new Error('Failed to create product');
            }
          }
        } catch (error) {
          const errorMsg = `Failed to sync product ${airtableRecord.id}: ${error instanceof Error ? error.message : String(error)}`;
          
          // Skip problematic records instead of failing the entire sync
          if (error instanceof Error && error.message.includes('SQLite3 can only bind')) {
            return { success: false, error: 'Data type issues' };
          }
          
          return { success: false, error: errorMsg };
        }
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Use database transaction for batch operations
      const successfulResults = batchResults.filter(result => result.success);
      const failedResults = batchResults.filter(result => !result.success);
      const batchErrors: string[] = batchResults
        .filter(result => !result.success)
        .map(result => result.error)
        .filter((error): error is string => error !== undefined);
      
      // Count successful operations
      const creates = successfulResults.filter(r => r.type === 'create');
      const updates = successfulResults.filter(r => r.type === 'update');
      
      syncedCount += successfulResults.length;
      errors.push(...batchErrors);

      processedRecords += batch.length;
    }

    // Note: Image cleanup is now manual only - no automatic cleanup during sync
    // WebPhotos (like logos) are managed by the webPhotos sync process

    // Populate category-subcategory relations from synced products
    const relationsCreated = productDB.populateCategoryRelations();

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
      
      // Write updated timestamps
      writeFileSync(TIMESTAMPS_FILE, JSON.stringify(timestamps, null, 2), 'utf8');
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