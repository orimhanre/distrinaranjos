import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  try {
    const { type, filename } = await params;
    
    // Validate type parameter
    if (type !== 'products' && type !== 'webphotos') {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
    }
    
    // Determine the directory based on environment and type
    let imageDir: string;
    if (process.env.NODE_ENV === 'production') {
      // For production (Railway), use persistent volume (same as database)
      const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
      
      // Map API types to actual directory names
      if (type === 'products') {
        // For products, we need to determine if it's virtual or regular
        // Since virtual environment uses /api/images/products/ and regular uses /api/images/regular/
        // We'll check the URL to determine the environment
        const isVirtualRequest = request.url.includes('/api/images/products/');
        imageDir = path.join(dataDir, 'images', isVirtualRequest ? 'virtual-products' : 'regular-products');
      } else if (type === 'webphotos') {
        // WebPhotos are only used in virtual environment
        imageDir = path.join(dataDir, 'images', 'virtual-webphotos');
      } else {
        imageDir = path.join(dataDir, 'images', `virtual-${type}`);
      }
    } else {
      // For local development, use public directory
      imageDir = path.join(process.cwd(), 'public', 'images', `virtual-${type}`);
    }
    
    const imagePath = path.join(imageDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      console.log(`❌ Image not found: ${imagePath}`);
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
    console.error('Error serving image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
