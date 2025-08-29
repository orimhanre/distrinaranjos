import { NextRequest, NextResponse } from 'next/server';
import { WebPhotoDownloader } from '@/lib/webPhotoDownloader';
import { webPhotosDB } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting WebPhotos cleanup...');
    
    // Get current WebPhotos from database
    const currentWebPhotos = webPhotosDB.getAllWebPhotos();
    
    // Clean up old files
    await WebPhotoDownloader.cleanupOldFiles(currentWebPhotos);
    
    console.log('✅ WebPhotos cleanup completed');
    
    return NextResponse.json({
      success: true,
      message: 'WebPhotos cleanup completed successfully',
      currentCount: Object.keys(currentWebPhotos).length
    });

  } catch (error) {
    console.error('❌ WebPhotos cleanup failed:', error);
    return NextResponse.json({
      success: false,
      error: 'WebPhotos cleanup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 