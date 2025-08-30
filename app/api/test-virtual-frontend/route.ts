import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Virtual frontend test endpoint working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    platform: 'Railway'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({
      success: true,
      message: 'Virtual frontend POST test working',
      receivedData: body,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'Error in virtual frontend test',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
