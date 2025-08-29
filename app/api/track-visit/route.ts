import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function POST(request: NextRequest) {
  try {
    const { page, userAgent, timestamp } = await request.json();
    
    // Check if tracking is enabled
    try {
      const trackingDoc = await getDoc(doc(db, 'settings', 'tracking'));
      const isTrackingEnabled = trackingDoc.exists() ? trackingDoc.data()?.enabled : true; // Default to enabled
      
      if (!isTrackingEnabled) {
    
        return NextResponse.json({ success: true, skipped: true, reason: 'tracking_disabled' });
      }
    } catch (error) {
      console.warn('Could not check tracking state, defaulting to enabled:', error);
    }
    
    // Add basic rate limiting to prevent excessive writes
    const now = Date.now();
    const lastVisit = parseInt(request.headers.get('x-last-visit') || '0');
    if (now - lastVisit < 5000) { // 5 second cooldown
      return NextResponse.json({ success: true, skipped: true });
    }

    const visitData = {
      page,
      userAgent: userAgent || 'Unknown',
      timestamp: serverTimestamp(),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
    };

    await addDoc(collection(db, 'visits'), visitData);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error tracking visit:', error);
    
    // Handle quota exceeded gracefully
    if (error.code === 'resource-exhausted' || error.message?.includes('quota')) {
      console.warn('Firestore quota exceeded - visit tracking disabled');
      return NextResponse.json({ success: false, error: 'Quota exceeded' }, { status: 429 });
    }
    
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 