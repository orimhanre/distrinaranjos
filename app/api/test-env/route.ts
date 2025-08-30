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

    // Check all regular environment variables
    const regularEnvVars = {
      // Airtable
      NEXT_PUBLIC_AIRTABLE_API_KEY: !!process.env.NEXT_PUBLIC_AIRTABLE_API_KEY,
      NEXT_PUBLIC_AIRTABLE_BASE_ID: !!process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID,
      AIRTABLE_ACCOUNT_EMAIL: !!process.env.AIRTABLE_ACCOUNT_EMAIL,
      
      // Cloudinary
      CLOUDINARY_CLOUD_NAME: !!process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: !!process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: !!process.env.CLOUDINARY_API_SECRET,
      
      // Resend
      RESEND_API_KEY: !!process.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,
      RESEND_TO_EMAIL: !!process.env.RESEND_TO_EMAIL,
    };

    // Check virtual Airtable variables
    const virtualAirtableVars = {
      VIRTUAL_AIRTABLE_API_KEY: !!process.env.VIRTUAL_AIRTABLE_API_KEY,
      VIRTUAL_AIRTABLE_BASE_ID: !!process.env.VIRTUAL_AIRTABLE_BASE_ID,
      VIRTUAL_AIRTABLE_ACCOUNT_EMAIL: !!process.env.VIRTUAL_AIRTABLE_ACCOUNT_EMAIL,
    };

    return NextResponse.json({
      success: true,
      message: 'Environment variables check',
      virtualEnvVars,
      regularEnvVars,
      virtualAirtableVars,
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
