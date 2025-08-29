import { NextRequest, NextResponse } from 'next/server';
// Import Firebase configs directly to avoid client-side code in server context
// Initialize Firebase apps directly for server-side use
const getFirebaseApps = () => {
  // Main Firebase config
  const mainFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  };

  // Virtual Firebase config
  const virtualFirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID
  };

  let mainApp = null;
  let virtualApp = null;
  let db = null;
  let virtualDb = null;

  // Initialize main app
  try {
    if (mainFirebaseConfig.apiKey && mainFirebaseConfig.projectId) {
      const existingMainApp = getApps().find(app => app.name === '[DEFAULT]');
      mainApp = existingMainApp || initializeApp(mainFirebaseConfig);
      db = getFirestore(mainApp);
    }
  } catch (error) {
    console.log('Main Firebase not available:', error);
  }

  // Initialize virtual app
  try {
    if (virtualFirebaseConfig.apiKey && virtualFirebaseConfig.projectId) {
      const existingVirtualApp = getApps().find(app => app.name === 'virtual');
      virtualApp = existingVirtualApp || initializeApp(virtualFirebaseConfig, 'virtual');
      virtualDb = getFirestore(virtualApp);
    }
  } catch (error) {
    console.log('Virtual Firebase not available:', error);
  }

  return { db, virtualDb };
};

export async function GET(
  request: NextRequest,
  {
    // Check if required environment variables are available for both regular and virtual environments
    const hasRegularFirebase = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                                 process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                                 process.env.FIREBASE_PRIVATE_KEY &&
                                 process.env.FIREBASE_CLIENT_EMAIL);
    
    const hasVirtualFirebase = !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                                 process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                                 process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                                 process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL);
    
    if (!hasRegularFirebase && !hasVirtualFirebase) {
      console.log('⚠️ Neither regular nor virtual Firebase environment variables available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured for either environment' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db, virtualDb } = await import('../../../../lib/firebase'); params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    console.log('🔍 Fetching order details for ID:', orderId);

    // Get Firebase apps
    const { db, virtualDb } = getFirebaseApps();

    // Try virtual database first (most likely for main website orders)
    let orderDoc = null;
    let isVirtual = false;
    let foundOrder = null;

    if (virtualDb) {
      try {
        // Search through all client documents in virtualOrders collection
        const { collection, getDocs, query } = await import('firebase/firestore');
        const virtualOrdersQuery = query(collection(virtualDb, 'virtualOrders'));
        const virtualOrdersSnapshot = await getDocs(virtualOrdersQuery);
        
        for (const clientDoc of virtualOrdersSnapshot.docs) {
          const clientData = clientDoc.data();
          if (clientData.orders && Array.isArray(clientData.orders)) {
            const order = clientData.orders.find((o: any) => o.orderId === orderId);
            if (order) {
              foundOrder = order;
              orderDoc = clientDoc;
              isVirtual = true;
              console.log('✅ Found order in virtual database');
              break;
            }
          }
        }
      } catch (virtualError) {
        console.log('⚠️ Virtual database not available or error:', virtualError);
      }
    }

    // If not found in virtual, try regular database
    if (!orderDoc && db) {
      try {
        const regularDocRef = doc(db, 'orders', orderId);
        const regularOrderDoc = await getDoc(regularDocRef);
        
        if (regularOrderDoc.exists()) {
          orderDoc = regularOrderDoc;
          isVirtual = false;
          console.log('✅ Found order in regular database');
        }
      } catch (regularError) {
        console.log('⚠️ Regular database not available or error:', regularError);
      }
    }

    if (!orderDoc || !orderDoc.exists()) {
      console.log('❌ Order not found in any database');
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Use foundOrder for virtual orders, otherwise use orderDoc.data()
    const orderData = isVirtual && foundOrder ? foundOrder : orderDoc.data();
    console.log('📋 Order data found:', {
      invoiceNumber: orderData?.invoiceNumber,
      fileUrl: orderData?.fileUrl,
      timestamp: orderData?.timestamp,
      isVirtual
    });

    return NextResponse.json({
      success: true,
      invoiceNumber: orderData?.invoiceNumber || null,
      fileUrl: orderData?.fileUrl || null,
      fileName: orderData?.fileName || null,
      orderDetails: orderData?.orderDetails || null,
      timestamp: orderData?.timestamp || null,
      isVirtual
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}