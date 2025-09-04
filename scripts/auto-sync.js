#!/usr/bin/env node

const { initDatabase } = require('../lib/database');

async function autoSyncIfEmpty() {
  console.log('🔄 Checking if databases need auto-sync...');
  
  try {
    // Initialize databases
    const regularDb = initDatabase('regular');
    const virtualDb = initDatabase('virtual');
    
    if (!regularDb || !virtualDb) {
      console.log('⚠️ Databases not available, skipping auto-sync');
      return;
    }
    
    // Check if databases are empty
    const regularCount = regularDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const virtualCount = virtualDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    
    console.log(`📊 Regular database: ${regularCount} products`);
    console.log(`📊 Virtual database: ${virtualCount} products`);
    
    // If either database is empty, trigger sync
    if (regularCount === 0 || virtualCount === 0) {
      console.log('🔄 Databases are empty, triggering auto-sync...');
      
      // Call the sync API endpoints
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
      
      try {
        // Sync regular products
        if (regularCount === 0) {
          console.log('📥 Syncing regular products...');
          const regularResponse = await fetch(`${baseUrl}/api/database/sync-airtable`);
          if (regularResponse.ok) {
            console.log('✅ Regular products synced');
          } else {
            console.log('⚠️ Regular products sync failed');
          }
        }
        
        // Sync virtual products
        if (virtualCount === 0) {
          console.log('📥 Syncing virtual products...');
          const virtualResponse = await fetch(`${baseUrl}/api/database/virtual-products`);
          if (virtualResponse.ok) {
            console.log('✅ Virtual products synced');
          } else {
            console.log('⚠️ Virtual products sync failed');
          }
        }
        
        // Sync web photos
        console.log('📸 Syncing web photos...');
        const webPhotosResponse = await fetch(`${baseUrl}/api/database/sync-webphotos`);
        if (webPhotosResponse.ok) {
          console.log('✅ Web photos synced');
        } else {
          console.log('⚠️ Web photos sync failed');
        }
        
        console.log('🎉 Auto-sync completed');
        
      } catch (syncError) {
        console.error('❌ Auto-sync failed:', syncError.message);
      }
    } else {
      console.log('✅ Databases already have data, no sync needed');
    }
    
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  autoSyncIfEmpty();
}

module.exports = { autoSyncIfEmpty };
