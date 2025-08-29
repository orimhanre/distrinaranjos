import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

export async function GET() {
  try {
    // Check if Firebase Admin is already initialized
    if (!getApps().length) {
      console.log('🔧 Initializing Firebase Admin...');
      
      // Log environment variables (without sensitive data)
      console.log('📋 Environment check:');
      console.log('- VIRTUAL_FIREBASE_PROJECT_ID:', process.env.VIRTUAL_FIREBASE_PROJECT_ID ? '✅ Set' : '❌ Missing');
      console.log('- VIRTUAL_FIREBASE_CLIENT_EMAIL:', process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing');
      console.log('- VIRTUAL_FIREBASE_PRIVATE_KEY:', process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ? '✅ Set' : '❌ Missing');
      
      // Check if any of the required values are missing
      if (!process.env.VIRTUAL_FIREBASE_PROJECT_ID) {
        throw new Error('VIRTUAL_FIREBASE_PROJECT_ID is missing');
      }
      if (!process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL) {
        throw new Error('VIRTUAL_FIREBASE_CLIENT_EMAIL is missing');
      }
      if (!process.env.VIRTUAL_FIREBASE_PRIVATE_KEY) {
        throw new Error('VIRTUAL_FIREBASE_PRIVATE_KEY is missing');
      }
      
      console.log('✅ All environment variables are present');
      
      initializeApp({
        credential: cert({
          projectId: process.env.VIRTUAL_FIREBASE_PROJECT_ID,
          clientEmail: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.log('✅ Firebase Admin already initialized');
    }
    
    return NextResponse.json({
      success: true,
      message: 'Firebase Admin credentials are working correctly',
      projectId: process.env.VIRTUAL_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL ? 'Set' : 'Missing',
      privateKey: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ? 'Set' : 'Missing',
    });
    
  } catch (error) {
    console.error('❌ Firebase Admin test failed:', error);
    return NextResponse.json(
      { 
        error: 'Firebase Admin test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        envCheck: {
          projectId: process.env.VIRTUAL_FIREBASE_PROJECT_ID ? 'Set' : 'Missing',
          clientEmail: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL ? 'Set' : 'Missing',
          privateKey: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ? 'Set' : 'Missing',
        }
      },
      { status: 500 }
    );
  }
}
