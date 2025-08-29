import { NextRequest, NextResponse } from 'next/server';

// GET /api/server-info - Get server information for dynamic port discovery
export async function GET(request: NextRequest) {
  try {
    // Get the port from the request headers or environment
    const host = request.headers.get('host') || '';
    const port = host.includes(':') ? host.split(':')[1] : '3001';
    
    // Get the protocol (http/https)
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    
    // Use a fixed IP address for better compatibility with iOS app
    // This prevents redirect loops and ensures consistent connectivity
    const ip = '192.168.1.29'; // Your computer's IP address
    
    // Construct the base URL
    const baseUrl = `${protocol}://${ip}:${port}`;
    
    console.log(`🌐 Server info request - Host: ${host}, Port: ${port}, IP: ${ip}, BaseURL: ${baseUrl}`);
    
    return NextResponse.json({
      success: true,
      serverInfo: {
        port: parseInt(port),
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
