import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';

// GET: Fetch all admin emails
export async function GET() {
  try {
    const querySnapshot = await getDocs(collection(db, 'admin_permissions'));
    const admins = querySnapshot.docs.map(doc => ({
      id: doc.id,
      email: doc.data().email,
      addedAt: doc.data().addedAt
    }));
    
    return NextResponse.json({ success: true, admins });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Add a new admin email
export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    // Check if email already exists
    const existingQuery = query(collection(db, 'admin_permissions'), where('email', '==', email));
    const existingDocs = await getDocs(existingQuery);
    
    if (!existingDocs.empty) {
      return NextResponse.json({ success: false, error: 'Email already has admin access' }, { status: 400 });
    }

    // Add new admin
    await addDoc(collection(db, 'admin_permissions'), {
      email: email.toLowerCase(),
      addedAt: new Date()
    });

    return NextResponse.json({ success: true, message: 'Admin added successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE: Remove an admin email
export async function DELETE(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    // Find and delete the admin document
    const adminQuery = query(collection(db, 'admin_permissions'), where('email', '==', email));
    const adminDocs = await getDocs(adminQuery);
    
    if (adminDocs.empty) {
      return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
    }

    // Delete the first matching document
    await deleteDoc(doc(db, 'admin_permissions', adminDocs.docs[0].id));

    return NextResponse.json({ success: true, message: 'Admin removed successfully' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
} 