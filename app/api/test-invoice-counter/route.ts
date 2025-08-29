import { NextRequest, NextResponse } from 'next/server';
import { virtualAdminDb } from '../../../lib/firebaseAdmin';

export async function GET(request: NextRequest) {
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
    const { db } = await import('../../../lib/firebase');
  try {
    console.log('🧪 Testing invoice counter functionality...');
    
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const dateString = `${day}${month}${year}`;
    
    console.log('🧪 Date string:', dateString);
    console.log('🧪 Virtual Admin DB available:', !!virtualAdminDb);
    
    if (!virtualAdminDb) {
      return NextResponse.json({
        success: false,
        error: 'Virtual Admin DB not available'
      });
    }
    
    // Test reading from virtualInvoiceCounters
    const counterDocRef = virtualAdminDb.collection('virtualInvoiceCounters').doc(dateString);
    console.log('🧪 Counter document path:', counterDocRef.path);
    
    const snapshot = await counterDocRef.get();
    console.log('🧪 Snapshot exists:', snapshot.exists);
    
    const currentCount = snapshot.exists ? (snapshot.data()?.count || 0) : 0;
    console.log('🧪 Current count:', currentCount);
    
    // Test updating the counter
    const nextSequence = currentCount + 1;
    console.log('🧪 Next sequence:', nextSequence);
    
    await counterDocRef.set({
      dateString,
      count: nextSequence,
      lastUpdated: new Date()
    });
    
    console.log('🧪 Counter updated successfully');
    
    return NextResponse.json({
      success: true,
      dateString,
      currentCount,
      nextSequence,
      invoiceNumber: `INV-${dateString}-${nextSequence.toString().padStart(3, '0')}`,
      message: 'Invoice counter test completed successfully'
    });
    
  } catch (error) {
    console.error('🧪 ❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
