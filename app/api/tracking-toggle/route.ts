import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

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

// Function to update VISITOR_TRACKING_ENABLED in .env.local
function updateEnvFile(enabled: boolean) {
  try {
    const envPath = join(process.cwd(), '.env.local');
    let envContent = '';
    
    if (existsSync(envPath)) {
      envContent = readFileSync(envPath, 'utf8');
    }
    
    // Remove existing VISITOR_TRACKING_ENABLED line if it exists
    const lines = envContent.split('\n').filter(line => !line.startsWith('VISITOR_TRACKING_ENABLED='));
    
    // Add the new value
    lines.push(`VISITOR_TRACKING_ENABLED=${enabled}`);
    
    // Write back to file
    writeFileSync(envPath, lines.join('\n') + '\n');
    console.log(`✅ Environment variable VISITOR_TRACKING_ENABLED updated to ${enabled} in .env.local`);
  } catch (error) {
    console.error('Error updating .env.local:', error);
  }
}

// GET: Retrieve tracking state
export async function GET() {
    // Check if required Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_PRIVATE_KEY ||
        !process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db } = await import('../lib/firebase');
  try {
    const trackingDoc = await getDoc(doc(db, 'settings', 'tracking'));
    
    // If document exists, use its value
    if (trackingDoc.exists()) {
      const isEnabled = trackingDoc.data()?.enabled;
      return NextResponse.json({ enabled: isEnabled });
    }
    
    // If document doesn't exist, use environment variable as default
    const envEnabled = process.env.VISITOR_TRACKING_ENABLED === 'true';
    return NextResponse.json({ enabled: envEnabled });
  } catch (error: any) {
    console.error('Error fetching tracking state:', error);
    // Fallback to environment variable on error
    const envEnabled = process.env.VISITOR_TRACKING_ENABLED === 'true';
    return NextResponse.json({ enabled: envEnabled });
  }
}

// POST: Update tracking state
export async function POST(request: NextRequest) {
  try {
    const { enabled } = await request.json();
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 });
    }
    
    // Update Firebase
    await setDoc(doc(db, 'settings', 'tracking'), { 
      enabled,
      updatedAt: new Date()
    });
    
    // Update environment file
    updateEnvFile(enabled);
    
    return NextResponse.json({ success: true, enabled });
  } catch (error: any) {
    console.error('Error updating tracking state:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 