import { NextRequest, NextResponse } from 'next/server';
import { WebPhotosDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Fetching WebPhotos from virtual database
    
    // Use virtual database since logos are stored there after Airtable sync
    const webPhotosDB = new WebPhotosDatabase('virtual');
    const webPhotos = webPhotosDB.getAllWebPhotos();
    
    // Found WebPhotos in virtual database
    // WebPhotos keys logging removed
    
    const response = NextResponse.json({
      success: true,
      webPhotos,
      count: Object.keys(webPhotos).length,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now()
    });

    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Buster', Date.now().toString());

    return response;

  } catch (error) {
    console.error('❌ Error fetching WebPhotos:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch WebPhotos',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 