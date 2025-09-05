import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Determine the directory based on environment
    let imageDir: string;
    if (process.env.NODE_ENV === 'production') {
      // For production (Railway), use persistent volume (same as database)
      const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
      imageDir = path.join(dataDir, 'images', 'regular-products');
    } else {
      // For local development, use public directory
      imageDir = path.join(process.cwd(), 'public', 'images', 'products');
    }
    
    const imagePath = path.join(imageDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.log(`❌ Regular image not found: ${imagePath}`);
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Content-Length': imageBuffer.length.toString(),
      },
    });
    
  } catch (error) {
    console.error('Error serving regular image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
