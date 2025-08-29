import { NextRequest, NextResponse } from 'next/server';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();
    if (!email || !token) {
      return NextResponse.json({ success: false, error: 'Missing email or token' }, { status: 400 });
    }
    // Save or update the token for this admin
    await setDoc(doc(collection(db, 'admin_tokens'), email), { token }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving admin FCM token:', error);
    return NextResponse.json({ success: false, error: 'Failed to save token' }, { status: 500 });
  }
} 