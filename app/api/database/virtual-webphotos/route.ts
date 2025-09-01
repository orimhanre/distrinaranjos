import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

// GET /api/database/virtual-webphotos - Get all virtual webphotos
export async function GET(request: NextRequest) {
  try {
    // // console.log('API: /api/database/virtual-webphotos called');
    
    const db = initDatabase('virtual');
    
    // Check if the webphotos table exists
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webphotos'").get();
    
    if (!tableExists) {
      console.log('API: webphotos table does not exist, creating it...');
      const createWebPhotosTable = `
        CREATE TABLE IF NOT EXISTS webphotos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          imageUrl TEXT NOT NULL,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `;
      db.exec(createWebPhotosTable);
    }
    
    const stmt = db.prepare('SELECT name, imageUrl FROM webphotos');
    const rows = stmt.all() as any[];
    
    // Convert relative image paths to full URLs for iOS app
    const convertToFullUrls = (url: string): string => {
      if (typeof url === 'string' && url.startsWith('/')) {
        // Convert relative path to full URL for iOS app
        // Use Mac's IP address for iOS compatibility instead of localhost
        const baseUrl = process.env.NEXTAUTH_URL || `http://192.168.1.29:${process.env.PORT || 3001}`;
        return `${baseUrl}${url}`;
      }
      return url;
    };

    // Check if request is from admin interface (by checking referer or user agent)
    const userAgent = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const isAdminRequest = referer.includes('/adminvirtual') || userAgent.includes('admin');

    const webPhotos: Record<string, string> = {};
    rows.forEach(row => {
      // For admin interface, keep relative paths; for iOS app, convert to full URLs
      const imageUrl = isAdminRequest ? row.imageUrl : convertToFullUrls(row.imageUrl);
      webPhotos[row.name] = imageUrl;
    });
    
    // // console.log('API: Returning', Object.keys(webPhotos).length, 'virtual webphotos');
    
    return NextResponse.json({
      success: true,
      webPhotos,
      count: Object.keys(webPhotos).length,
      timestamp: Date.now() // Add timestamp to force cache refresh
    });
  } catch (error) {
    console.error('API Error fetching virtual webphotos:', error);
    return NextResponse.json(
      { success: true, webPhotos: {}, count: 0, error: 'No webphotos available' },
      { status: 200 }
    );
  }
}

// POST /api/database/virtual-webphotos - Create or update a virtual webphoto
export async function POST(request: NextRequest) {
  try {
    const { name, imageUrl } = await request.json();
    
    if (!name || !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Name and imageUrl are required' },
        { status: 400 }
      );
    }
    
    const db = initDatabase('virtual');
    const stmt = db.prepare('INSERT OR REPLACE INTO webphotos (name, imageUrl) VALUES (?, ?)');
    stmt.run(name, imageUrl);
    
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

// DELETE /api/database/virtual-webphotos - Delete a virtual webphoto
export async function DELETE(request: NextRequest) {
  try {
    const { name } = await request.json();
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Webphoto name is required' },
        { status: 400 }
      );
    }
    
    const db = initDatabase('virtual');
    const stmt = db.prepare('DELETE FROM webphotos WHERE name = ?');
    const result = stmt.run(name);
    
    if (result.changes === 0) {
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