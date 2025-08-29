import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc } from 'firebase/firestore';
import { virtualDb } from '../../../lib/firebase';

export async function POST(request: NextRequest) {
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