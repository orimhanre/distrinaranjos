import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Check if required environment variables are available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_PRIVATE_KEY ||
        !process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Firebase environment variables not available, skipping admin token save');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured' 
      }, { status: 503 });
    }

    const { email, token } = await request.json();
    if (!email || !token) {
      return NextResponse.json({ success: false, error: 'Missing email or token' }, { status: 400 });
    }

    // Only import Firebase when we actually need it
    const { collection, doc, setDoc } = await import('firebase/firestore');
    const { db } = await import('@/lib/firebase');

    // Save or update the token for this admin
    await setDoc(doc(collection(db, 'admin_tokens'), email), { token }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving admin FCM token:', error);
    return NextResponse.json({ success: false, error: 'Failed to save token' }, { status: 500 });
  }
}

export async function GET() {
  // Handle build-time page data collection
  return NextResponse.json({ 
    success: true, 
    message: 'Save admin token endpoint available',
    configured: !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                  process.env.FIREBASE_PRIVATE_KEY &&
                  process.env.FIREBASE_CLIENT_EMAIL)
  });
} 