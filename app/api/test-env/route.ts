import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check all virtual environment variables
    const virtualEnvVars = {
      // Cloudinary
      VIRTUAL_CLOUDINARY_CLOUD_NAME: !!process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME,
      VIRTUAL_CLOUDINARY_API_KEY: !!process.env.VIRTUAL_CLOUDINARY_API_KEY,
      VIRTUAL_CLOUDINARY_API_SECRET: !!process.env.VIRTUAL_CLOUDINARY_API_SECRET,
      
      // Firebase
      VIRTUAL_FIREBASE_PROJECT_ID: !!process.env.VIRTUAL_FIREBASE_PROJECT_ID,
      VIRTUAL_FIREBASE_CLIENT_EMAIL: !!process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL,
      VIRTUAL_FIREBASE_PRIVATE_KEY: !!process.env.VIRTUAL_FIREBASE_PRIVATE_KEY,
      
      // Resend
      VIRTUAL_RESEND_API_KEY: !!process.env.VIRTUAL_RESEND_API_KEY,
      VIRTUAL_RESEND_FROM_EMAIL: !!process.env.VIRTUAL_RESEND_FROM_EMAIL,
      VIRTUAL_RESEND_TO_EMAIL: !!process.env.VIRTUAL_RESEND_TO_EMAIL,
      
      // Regular Firebase (for comparison)
      NEXT_PUBLIC_FIREBASE_API_KEY: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    };

    return NextResponse.json({
      success: true,
      message: 'Environment variables check',
      virtualEnvVars,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking environment variables:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check environment variables',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
