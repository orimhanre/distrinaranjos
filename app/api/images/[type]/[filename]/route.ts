import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; filename: string }> }
) {
  const { type, filename } = await params;
  try {
    
    // Validate type parameter
    if (type !== 'products' && type !== 'webphotos') {
      return NextResponse.json({ error: 'Invalid image type' }, { status: 400 });
    }
    
    // Determine the file path based on environment
    let filePath: string;
    
    if (process.env.NODE_ENV === 'production') {
      // For Railway, use /tmp directory
      filePath = path.join('/tmp', 'images', `virtual-${type}`, filename);
    } else {
      // For local development, use public directory
      filePath = path.join(process.cwd(), 'public', 'images', `virtual-${type}`, filename);
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }
    
    // Read the file
    const imageBuffer = fs.readFileSync(filePath);
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg'; // default
    
    switch (ext) {
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      case '.svg':
        contentType = 'image/svg+xml';
        break;
      case '.pdf':
        contentType = 'application/pdf';
        break;
    }
    
    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
      },
    });
    
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
