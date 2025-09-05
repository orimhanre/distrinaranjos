import { NextRequest, NextResponse } from 'next/server';

// GET /api/server-info - Get server information for dynamic port discovery
export async function GET(request: NextRequest) {
  try {
    // Get the host from the request headers
    const host = request.headers.get('host') || '';
    
    // Get the protocol (http/https)
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    
    // In production, use the actual domain
    // In development, use local IP for iOS app compatibility
    let baseUrl: string;
    let port: number;
    let ip: string;
    
    if (process.env.NODE_ENV === 'production') {
      // Production: use the actual domain
      baseUrl = 'https://distrinaranjos.co';
      port = 443; // HTTPS port
      ip = 'distrinaranjos.co';
    } else {
      // Development: use local IP for iOS app compatibility
      port = 3001;
      ip = '192.168.1.29';
      baseUrl = `http://${ip}:${port}`;
    }
    
    console.log(`🌐 Server info request - Host: ${host}, Port: ${port}, IP: ${ip}, BaseURL: ${baseUrl}, Environment: ${process.env.NODE_ENV}`);
    
    return NextResponse.json({
      success: true,
      serverInfo: {
        port,
        protocol,
        ip,
        baseUrl,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      }
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error getting server info:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get server info' },
      { status: 500 }
    );
  }
}
