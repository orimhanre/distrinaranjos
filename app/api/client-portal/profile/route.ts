import { NextRequest, NextResponse } from 'next/server';
import { virtualAdminDb } from '@/lib/firebaseAdmin';
import { virtualDb } from '@/lib/firebase';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('🔍 Profile API: Looking for profile with email:', email);
    console.log('🔍 Profile API: Virtual Admin database available:', !!virtualAdminDb);
    console.log('🔍 Profile API: Virtual Client database available:', !!virtualDb);
    
    // Debug environment variables
    console.log('🔍 Environment check:');
    console.log('VIRTUAL_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID);
    console.log('VIRTUAL_FIREBASE_CLIENT_EMAIL:', process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL ? 'Set' : 'Not set');
    console.log('VIRTUAL_FIREBASE_PRIVATE_KEY:', process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ? 'Set' : 'Not set');

    if (!virtualAdminDb && !virtualDb) {
      console.log('❌ No virtual database available');
      return NextResponse.json({ error: 'Virtual database not available' }, { status: 500 });
    }

    // Try to get profile from virtual admin database first
    let profileData = null;
    let foundInAdminDb = false;
    
    if (virtualAdminDb) {
      try {
        console.log('🔍 Looking for profile in Admin DB - collection: clients, document: ', email);
        
        // First, let's check if the collection exists and list all documents
        try {
          const collectionRef = virtualAdminDb.collection('clients');
          const snapshot = await collectionRef.get();
          console.log('🔍 Total documents in Admin DB clients collection:', snapshot.size);
          
          if (snapshot.size > 0) {
            snapshot.forEach(doc => {
              console.log('🔍 Admin DB Document ID:', doc.id, 'Data:', doc.data());
            });
          }
        } catch (collectionError) {
          console.log('❌ Error listing Admin DB collection:', collectionError);
        }
        
        const profileDoc = await virtualAdminDb.collection('clients').doc(email).get();
        
        if (profileDoc.exists) {
          profileData = profileDoc.data();
          foundInAdminDb = true;
          console.log('✅ Profile found in Admin DB (QuickOrder-Virtual):', profileData);
        } else {
          console.log('❌ Profile not found in Admin DB for email:', email);
          
          // Try to find any document that might contain this email
          try {
            const querySnapshot = await virtualAdminDb.collection('clients').where('email', '==', email).get();
            if (!querySnapshot.empty) {
              console.log('🔍 Found profile in Admin DB with email query:', querySnapshot.docs[0].data());
              profileData = querySnapshot.docs[0].data();
              foundInAdminDb = true;
            }
          } catch (queryError) {
            console.log('❌ Error querying Admin DB by email:', queryError);
          }
        }
      } catch (adminError) {
        console.log('❌ Error accessing Admin DB:', adminError);
      }
    }
    
    // If not found in Admin DB, try Client DB
    if (!profileData && virtualDb) {
      try {
        console.log('🔍 Looking for profile in Client DB - collection: clients, document: ', email);
        
        // Import client-side Firebase functions
        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
        
        const profileDoc = await getDoc(doc(virtualDb, 'clients', email));
        
        if (profileDoc.exists()) {
          profileData = profileDoc.data();
          console.log('✅ Profile found in Client DB (QuickOrder-Virtual):', profileData);
        } else {
          console.log('❌ Profile not found in Client DB for email:', email);
          
          // Try to find any document that might contain this email
          try {
            const querySnapshot = await getDocs(query(collection(virtualDb, 'clients'), where('email', '==', email)));
            if (!querySnapshot.empty) {
              console.log('🔍 Found profile in Client DB with email query:', querySnapshot.docs[0].data());
              profileData = querySnapshot.docs[0].data();
            }
          } catch (queryError) {
            console.log('❌ Error querying Client DB by email:', queryError);
          }
        }
      } catch (clientError) {
        console.log('❌ Error accessing Client DB:', clientError);
      }
    }
    
    if (!profileData) {
      console.log('❌ Profile not found in any database for email:', email);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      profile: profileData
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
