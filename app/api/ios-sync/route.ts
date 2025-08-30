import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { action, context = 'virtual' } = await request.json();
    
    console.log(`📱 iOS App sync request: ${action} for ${context} environment`);
    
    let syncEndpoint = '';
    let responseMessage = '';
    
    switch (action) {
      case 'sync-products':
        syncEndpoint = '/api/database/sync-airtable';
        responseMessage = 'Product sync triggered';
        break;
      case 'sync-webphotos':
        syncEndpoint = '/api/database/sync-webphotos';
        responseMessage = 'WebPhotos sync triggered';
        break;
      default:
        return NextResponse.json({
          success: false,
          message: 'Invalid action. Use "sync-products" or "sync-webphotos"',
          timestamp: new Date().toISOString()
        }, { status: 400 });
    }
    
    // Call the appropriate sync endpoint
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.RAILWAY_STATIC_URL 
      ? `https://${process.env.RAILWAY_STATIC_URL}`
      : 'http://localhost:3000';
    
    const syncUrl = `${baseUrl}${syncEndpoint}`;
    
    console.log(`📱 Calling sync endpoint: ${syncUrl}`);
    
    const syncResponse = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ context }),
    });
    
    const syncResult = await syncResponse.json();
    
    console.log(`📱 Sync result:`, syncResult);
    
    return NextResponse.json({
      success: true,
      message: responseMessage,
      syncResult,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ iOS sync error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during iOS sync',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
