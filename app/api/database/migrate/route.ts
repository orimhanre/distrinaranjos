import { NextRequest, NextResponse } from 'next/server';
import { productDB, webPhotosDB } from '@/lib/database';
import { AirtableService } from '@/lib/airtable';

// POST /api/database/migrate - Migrate data from Airtable to internal database
export async function POST(request: NextRequest) {
  try {
    const { migrateProducts = true, migrateWebPhotos = true } = await request.json();
    
    let productsCount = 0;
    let webPhotosCount = 0;
    let deletedCount = 0;
    
    // Migrate products
    if (migrateProducts) {
      console.log('🔄 Starting product migration from Airtable...');
      const airtableRecords = await AirtableService.fetchAllRecords();
      const airtableProducts = airtableRecords.map(record => AirtableService.convertAirtableToProduct(record));
      
      // Get all existing product IDs from local database
      const existingProducts = productDB.getAllProducts();
      const existingProductIds = new Set(existingProducts.map((p: any) => p.id));
      const airtableProductIds = new Set(airtableProducts.map((p: any) => p.id));
      
      // Find products that exist locally but not in Airtable (deleted products)
      const productsToDelete = [...existingProductIds].filter(id => !airtableProductIds.has(id));
      
      // Delete products that no longer exist in Airtable
      for (const productId of productsToDelete) {
        const deleted = productDB.deleteProduct(productId);
        if (deleted) {
          deletedCount++;
          console.log(`🗑️ Deleted product: ${productId}`);
        }
      }
      
      // Add/update products from Airtable
      for (const airtableProduct of airtableProducts) {
        // Check if product already exists
        const existing = productDB.getProduct(airtableProduct.id);
        if (existing) {
          // Update existing product
          productDB.updateProduct(airtableProduct.id, airtableProduct);
        } else {
          // Create new product
          productDB.createProduct(airtableProduct);
        }
        
        productsCount++;
      }
      
      console.log(`✅ Migrated ${productsCount} products, deleted ${deletedCount} products`);
    }
    
    // Migrate web photos
    if (migrateWebPhotos) {
      console.log('🔄 Starting web photos migration from Airtable...');
      const webPhotos = await AirtableService.fetchWebPhotos();
      
      for (const [name, imageUrl] of Object.entries(webPhotos)) {
        webPhotosDB.upsertWebPhoto(name, imageUrl);
        webPhotosCount++;
      }
      
      console.log(`✅ Migrated ${webPhotosCount} web photos`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      results: {
        productsCount,
        webPhotosCount,
        deletedCount
      }
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json(
      { success: false, error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 