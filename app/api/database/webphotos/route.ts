import { NextRequest, NextResponse } from 'next/server';
import { WebPhotosDatabase } from '@/lib/database';

// Regular webphotos database instance
const regularWebPhotosDB = new WebPhotosDatabase('regular');

// GET /api/database/webphotos - Get all regular webphotos
export async function GET(request: NextRequest) {
  try {
    console.log('API: /api/database/webphotos called');
    
    const webPhotos = regularWebPhotosDB.getAllWebPhotos();
    
    console.log('API: Returning', Object.keys(webPhotos).length, 'regular webphotos');
    
    return NextResponse.json({
      success: true,
      webPhotos,
      count: Object.keys(webPhotos).length
    });
  } catch (error) {
    console.error('API Error fetching regular webphotos:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch regular webphotos', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/database/webphotos - Create or update a regular webphoto
export async function POST(request: NextRequest) {
  try {
    const { name, imageUrl } = await request.json();
    
    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Name and imageUrl are required' },
        { status: 400 }
      );
    }
    
    const success = regularWebPhotosDB.upsertWebPhoto(name, imageUrl);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to create regular webphoto' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Regular webphoto created/updated successfully'
    });
  } catch (error) {
    console.error('Error creating regular webphoto:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create regular webphoto' },
      { status: 500 }
    );
  }
}

// DELETE /api/database/webphotos - Delete a regular webphoto
export async function DELETE(request: NextRequest) {
  try {
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Webphoto name is required' },
        { status: 400 }
      );
    }
    
    const deleted = regularWebPhotosDB.deleteWebPhoto(name);
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Regular webphoto not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Regular webphoto deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting regular webphoto:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete regular webphoto' },
      { status: 500 }
    );
  }
}
