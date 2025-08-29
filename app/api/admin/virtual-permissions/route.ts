import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase/auth';
import { virtualAdminAuth } from '@/lib/firebaseAdmin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to load environment variables from .env.virtual.local
function loadVirtualEnv() {
  try {
    const envPath = join(process.cwd(), '.env.virtual.local');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars: { [key: string]: string } = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.virtual.local:', error);
    return {};
  }
}

// Load virtual environment variables
const virtualEnv = loadVirtualEnv();

// Initialize virtual Firebase for server-side API routes
const virtualFirebaseConfig = {
  apiKey: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY,
  authDomain: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN,
  projectId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID,
  storageBucket: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID,
  appId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID
};



export async function GET() {
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
    const { initializeApp } = await import('firebase/app');
    const { getFirestore } = await import('firebase/firestore');
    const { virtualDb } = await import('../../../../lib/firebase');
  try {
    if (!virtualDb) {
      return NextResponse.json(
        { success: false, error: 'Virtual Firebase not configured' },
        { status: 500 }
      );
    }

    const adminsRef = collection(virtualDb, 'virtualAdminPermissions');
    const querySnapshot = await getDocs(adminsRef);
    
    const admins = querySnapshot.docs.map(doc => {
      const data = doc.data();
      let addedAt = data.addedAt;
      
      // Handle Firestore Timestamp
      if (addedAt && typeof addedAt === 'object' && addedAt.toDate) {
        addedAt = addedAt.toDate().toISOString();
      }
      // Handle regular Date object
      else if (addedAt && addedAt instanceof Date) {
        addedAt = addedAt.toISOString();
      }
      // Handle string date
      else if (typeof addedAt === 'string') {
        addedAt = addedAt;
      }
      // Handle timestamp in seconds
      else if (typeof addedAt === 'number') {
        addedAt = new Date(addedAt * 1000).toISOString();
      }
      // If no addedAt field exists, return null (will show "Fecha no disponible")
      else {
        addedAt = null;
      }
      
      return {
        id: doc.id,
        email: data.email,
        addedAt: addedAt
      };
    });

    return NextResponse.json({ 
      success: true, 
      admins: admins 
    });

  } catch (error) {
    console.error('Error fetching virtual admins:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los administradores virtuales' },
      { status: 500 }
    );
  }
}

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
  const { virtualDb } = await import('../../../../lib/firebase');

  try {
    console.log('=== ADD VIRTUAL ADMIN START ===');
    console.log('virtualDb available:', !!virtualDb);
    console.log('Environment variables check:');
    console.log('- VIRTUAL_FIREBASE_CLIENT_EMAIL:', process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set');
    console.log('- VIRTUAL_FIREBASE_PRIVATE_KEY:', process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set');
    
    if (!virtualDb) {
      console.log('Virtual Firebase not configured');
      return NextResponse.json(
        { success: false, error: 'Virtual Firebase not configured' },
        { status: 500 }
      );
    }

    const { email } = await request.json();
    console.log('POST request for email:', email);
    
    if (!email || typeof email !== 'string') {
      console.log('Invalid email provided');
      return NextResponse.json(
        { success: false, error: 'Email requerido' },
        { status: 400 }
      );
    }

    // Check if admin already exists in Firestore
    const adminsRef = collection(virtualDb, 'virtualAdminPermissions');
    const q = query(adminsRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      console.log('Admin already exists in Firestore');
      return NextResponse.json(
        { success: false, error: 'El administrador ya existe' },
        { status: 400 }
      );
    }

    // Add new admin to Firestore
    console.log('Adding admin to Firestore');
    await addDoc(adminsRef, {
      email: email.toLowerCase(),
      addedAt: new Date().toISOString()
    });

    console.log('=== ADD VIRTUAL ADMIN SUCCESS ===');
    return NextResponse.json({ 
      success: true, 
      message: 'Administrador virtual agregado exitosamente' 
    });

  } catch (error) {
    console.error('=== ADD VIRTUAL ADMIN ERROR ===');
    console.error('Error adding virtual admin:', error);
    return NextResponse.json(
      { success: false, error: 'Error al agregar administrador virtual' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
  const { virtualDb } = await import('../../../../lib/firebase');

  try {
    console.log('=== DELETE VIRTUAL ADMIN START ===');
    console.log('virtualDb available:', !!virtualDb);

    
    if (!virtualDb) {
      console.log('Virtual Firebase not configured');
      return NextResponse.json(
        { success: false, error: 'Virtual Firebase not configured' },
        { status: 500 }
      );
    }

    const { email } = await request.json();
    console.log('DELETE request for email:', email);
    
    if (!email || typeof email !== 'string') {
      console.log('Invalid email provided');
      return NextResponse.json(
        { success: false, error: 'Email requerido' },
        { status: 400 }
      );
    }

    // Find and delete the admin from Firestore
    const adminsRef = collection(virtualDb, 'virtualAdminPermissions');
    console.log('Collection reference created');
    
    const q = query(adminsRef, where('email', '==', email.toLowerCase()));
    console.log('Query created for email:', email.toLowerCase());
    
    const querySnapshot = await getDocs(q);
    console.log('Query executed - empty:', querySnapshot.empty, 'docs found:', querySnapshot.docs.length);
    
    if (querySnapshot.empty) {
      console.log('No documents found for email:', email);
      return NextResponse.json(
        { success: false, error: 'Administrador no encontrado' },
        { status: 404 }
      );
    }

    // Show all found documents
    querySnapshot.docs.forEach((doc, index) => {
      console.log(`Document ${index}:`, {
        id: doc.id,
        email: doc.data().email,
        data: doc.data()
      });
    });

    // Delete the admin document from Firestore
    const adminDoc = querySnapshot.docs[0];
    console.log('Attempting to delete document with ID:', adminDoc.id, 'email:', adminDoc.data().email);
    
    const docRef = doc(virtualDb, 'virtualAdminPermissions', adminDoc.id);
    console.log('Document reference created:', docRef.path);
    
    try {
      await deleteDoc(docRef);
      console.log('Firestore document deleted successfully');
    } catch (deleteError) {
      console.error('Error during deleteDoc:', deleteError);
      throw deleteError;
    }



    console.log('=== DELETE VIRTUAL ADMIN SUCCESS ===');
    return NextResponse.json({ 
      success: true, 
      message: 'Administrador virtual removido exitosamente' 
    });

  } catch (error) {
    console.error('=== DELETE VIRTUAL ADMIN ERROR ===');
    console.error('Error removing virtual admin:', error);
    return NextResponse.json(
      { success: false, error: 'Error al remover administrador virtual' },
      { status: 500 }
    );
  }
} 