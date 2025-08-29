import { NextRequest, NextResponse } from 'next/server';
import { WebPhotosDatabase } from '@/lib/database';

// Virtual webphotos database instance
const virtualWebPhotosDB = new WebPhotosDatabase('virtual');

// GET /api/virtual-webphotos - Get all virtual webphotos
export async function GET(request: NextRequest) {
  try {
    console.log('API: /api/virtual-webphotos called');
    
    const webPhotos = virtualWebPhotosDB.getAllWebPhotos();
    
    // // console.log('API: Returning', Object.keys(webPhotos).length, 'virtual webphotos');
    
    return NextResponse.json({
      success: true,
      webPhotos,
      count: Object.keys(webPhotos).length
    });
  } catch (error) {
    console.error('API Error fetching virtual webphotos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch virtual webphotos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/virtual-webphotos - Create or update a virtual webphoto
export async function POST(request: NextRequest) {
  try {
    const { name, imageUrl } = await request.json();
    
    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Name and imageUrl are required' },
        { status: 400 }
      );
    }
    
    const success = virtualWebPhotosDB.upsertWebPhoto(name, imageUrl);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create virtual webphoto' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Virtual webphoto created/updated successfully'
    });
  } catch (error) {
    console.error('Error creating virtual webphoto:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create virtual webphoto' },
      { status: 500 }
    );
  }
}

// DELETE /api/virtual-webphotos - Delete a virtual webphoto
export async function DELETE(request: NextRequest) {
  try {
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Webphoto name is required' },
        { status: 400 }
      );
    }
    
    const deleted = virtualWebPhotosDB.deleteWebPhoto(name);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Virtual webphoto not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Virtual webphoto deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting virtual webphoto:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete virtual webphoto' },
      { status: 500 }
    );
  }
} 