import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Cache refresh requested');
    
    // Get the current timestamp for cache busting
    const timestamp = Date.now();
    
    // Add cache control headers to prevent caching
    const response = NextResponse.json({
      success: true,
      message: 'Cache refresh initiated',
      timestamp: new Date().toISOString(),
      cacheBuster: timestamp
    });

    // Add cache control headers
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Buster', timestamp.toString());

    console.log(`🔄 Cache refresh completed at: ${new Date(timestamp).toISOString()}`);
    
    return response;
  } catch (error) {
    console.error('❌ Cache refresh failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cache refresh failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Cache status requested');
    
    const timestamp = Date.now();
    
    return NextResponse.json({
      success: true,
      message: 'Cache status',
      timestamp: new Date().toISOString(),
      cacheBuster: timestamp,
      cacheStatus: 'active'
    });
  } catch (error) {
    console.error('❌ Cache status check failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Cache status check failed'
    }, { status: 500 });
  }
}
