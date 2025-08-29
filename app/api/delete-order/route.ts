import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

// Log the project ID at startup
console.log('[API] Firebase projectId:', app.options.projectId);

export async function POST(request: NextRequest) {
  try {
    const { id } = await request.json();
    console.log('[API] /api/delete-order called with id:', id);
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing order ID' }, { status: 400 });
    }
    await deleteDoc(doc(db, 'orders', id));
    console.log('[API] Successfully deleted order:', id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Error deleting order:', error);
    return NextResponse.json({ success: false, error: error?.message || String(error) }, { status: 500 });
  }
} 