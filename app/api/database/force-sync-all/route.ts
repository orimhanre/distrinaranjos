import { NextResponse } from 'next/server';

export async function POST() {
  try {
    console.log('🔄 Force sync all databases requested...');
    
    const results = {
      regularProducts: { success: false, error: null as string | null },
      virtualProducts: { success: false, error: null as string | null },
      webPhotos: { success: false, error: null as string | null }
    };
    
    // Sync regular products
    try {
      const regularResponse = await fetch(`${process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000'}/api/database/sync-airtable`, {
        method: 'POST'
      });
      results.regularProducts.success = regularResponse.ok;
      if (!regularResponse.ok) {
        results.regularProducts.error = await regularResponse.text();
      }
    } catch (error) {
      results.regularProducts.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Sync virtual products
    try {
      const virtualResponse = await fetch(`${process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000'}/api/database/virtual-products`, {
        method: 'POST'
      });
      results.virtualProducts.success = virtualResponse.ok;
      if (!virtualResponse.ok) {
        results.virtualProducts.error = await virtualResponse.text();
      }
    } catch (error) {
      results.virtualProducts.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Sync web photos
    try {
      const webPhotosResponse = await fetch(`${process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000'}/api/database/sync-webphotos`, {
        method: 'POST'
      });
      results.webPhotos.success = webPhotosResponse.ok;
      if (!webPhotosResponse.ok) {
        results.webPhotos.error = await webPhotosResponse.text();
      }
    } catch (error) {
      results.webPhotos.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    const allSuccess = results.regularProducts.success && results.virtualProducts.success && results.webPhotos.success;
    
    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'All databases synced successfully' : 'Some syncs failed',
      results
    }, { status: allSuccess ? 200 : 207 });
    
  } catch (error) {
    console.error('❌ Force sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
