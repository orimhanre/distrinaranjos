import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
    // Check if required virtual Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID ||
        !process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ||
        !process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Virtual Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { virtualDb } = await import('../lib/firebase');
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Add email to virtualAdminPermissions collection
    if (!virtualDb) {
      return NextResponse.json(
        { success: false, error: 'Virtual database not available' },
        { status: 500 }
      );
    }
    
    const docRef = await addDoc(collection(virtualDb, 'virtualAdminPermissions'), {
      email: email.toLowerCase(),
      addedAt: new Date().toISOString()
    });

    console.log('✅ Admin email added:', email, 'with ID:', docRef.id);

    return NextResponse.json({
      success: true,
      message: 'Admin email added successfully',
      docId: docRef.id
    });

  } catch (error) {
    console.error('❌ Error adding admin email:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error adding admin email',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 

export async function GET() {
  // Handle build-time page data collection
  const hasRegularFirebase = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                               process.env.FIREBASE_PRIVATE_KEY &&
                               process.env.FIREBASE_CLIENT_EMAIL);
  
  const hasVirtualFirebase = !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                               process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                               process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL);
  
  return NextResponse.json({ 
    success: true, 
    message: 'API endpoint available',
    configured: hasRegularFirebase || hasVirtualFirebase,
    regularFirebase: hasRegularFirebase,
    virtualFirebase: hasVirtualFirebase
  });
}