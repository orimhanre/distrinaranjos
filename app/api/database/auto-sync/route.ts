import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Auto-sync check for empty databases...');
    
    // Initialize databases
    const regularDb = initDatabase('regular');
    const virtualDb = initDatabase('virtual');
    
    if (!regularDb || !virtualDb) {
      console.log('⚠️ Databases not available, skipping auto-sync');
      return NextResponse.json({
        success: false,
        error: 'Databases not available'
      });
    }
    
    // Check if databases are empty
    const regularCount = regularDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const virtualCount = virtualDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
    
    console.log(`📊 Regular database: ${regularCount} products`);
    console.log(`📊 Virtual database: ${virtualCount} products`);
    
    const results = {
      regular: { count: regularCount, needsSync: regularCount === 0 },
      virtual: { count: virtualCount, needsSync: virtualCount === 0 }
    };
    
    // If either database is empty, trigger sync
    if (regularCount === 0 || virtualCount === 0) {
      console.log('🔄 Databases are empty, triggering auto-sync...');
      
      const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
      const syncResults = [];
      
      try {
        // Sync regular products
        if (regularCount === 0) {
          console.log('📥 Syncing regular products...');
          const regularResponse = await fetch(`${baseUrl}/api/database/sync-airtable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: 'regular' })
          });
          if (regularResponse.ok) {
            console.log('✅ Regular products synced');
            syncResults.push('Regular products synced');
          } else {
            console.log('⚠️ Regular products sync failed');
            syncResults.push('Regular products sync failed');
          }
        }
        
        // Sync virtual products
        if (virtualCount === 0) {
          console.log('📥 Syncing virtual products...');
          const virtualResponse = await fetch(`${baseUrl}/api/database/sync-airtable`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: 'virtual' })
          });
          if (virtualResponse.ok) {
            console.log('✅ Virtual products synced');
            syncResults.push('Virtual products synced');
          } else {
            console.log('⚠️ Virtual products sync failed');
            syncResults.push('Virtual products sync failed');
          }
        }
        
        // Sync web photos
        console.log('📸 Syncing web photos...');
        const webPhotosResponse = await fetch(`${baseUrl}/api/database/sync-webphotos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: 'virtual' })
        });
        if (webPhotosResponse.ok) {
          console.log('✅ Web photos synced');
          syncResults.push('Web photos synced');
        } else {
          console.log('⚠️ Web photos sync failed');
          syncResults.push('Web photos sync failed');
        }
        
        console.log('🎉 Auto-sync completed');
        
        return NextResponse.json({
          success: true,
          message: 'Auto-sync completed',
          results,
          syncResults
        });
        
      } catch (syncError) {
        console.error('❌ Auto-sync failed:', syncError);
        return NextResponse.json({
          success: false,
          error: 'Auto-sync failed',
          details: syncError instanceof Error ? syncError.message : 'Unknown error',
          results
        });
      }
    } else {
      console.log('✅ Databases already have data, no sync needed');
      return NextResponse.json({
        success: true,
        message: 'Databases already have data, no sync needed',
        results
      });
    }
    
  } catch (error) {
    console.error('❌ Auto-sync error:', error);
    return NextResponse.json({
      success: false,
      error: 'Auto-sync error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
