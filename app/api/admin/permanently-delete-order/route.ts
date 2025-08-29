import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
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
    const { db, virtualDb } = await import('../../../../lib/firebase');
  try {
    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Determine which Firebase instance to use based on the request
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';

    console.log('🔍 API: /api/admin/permanently-delete-order called');
    console.log('🔍 API: isVirtualAdmin =', isVirtualAdmin);
    console.log('🔍 API: orderId =', orderId);

    const firestoreDb = isVirtualAdmin ? virtualDb : db;
    console.log('🔍 API: firestoreDb =', firestoreDb ? 'configured' : 'not configured');

    if (!firestoreDb) {
      throw new Error('Firebase database not initialized.');
    }

    // Get the deletedOrders collection
    const deletedOrdersCollection = collection(firestoreDb, 'deletedOrders');
    const snapshot = await getDocs(deletedOrdersCollection);
    
    let foundDocument = null;
    let foundOrderIndex = -1;
    
    // Search through all documents to find the order
    for (const document of snapshot.docs) {
      const data = document.data();
      if (data.orders && Array.isArray(data.orders)) {
        for (let index = 0; index < data.orders.length; index++) {
          const order = data.orders[index];
          // Check if this is the order we're looking for by comparing the constructed ID
          const constructedId = `${document.id}_${order.orderId || order.invoiceNumber || index}`;
          if (constructedId === orderId) {
            foundDocument = document;
            foundOrderIndex = index;
            break;
          }
        }
      }
      if (foundDocument) break;
    }
    
    if (!foundDocument || foundOrderIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Order not found in deleted collection' },
        { status: 404 }
      );
    }
    
    // Get the current orders array
    const data = foundDocument.data();
    const orders = data.orders || [];
    
    // Remove the specific order from the array
    orders.splice(foundOrderIndex, 1);
    
    // If the orders array is now empty, delete the entire document
    if (orders.length === 0) {
      await deleteDoc(foundDocument.ref);
      console.log('✅ Order permanently deleted and document removed from deletedOrders collection:', orderId);
    } else {
      // Update the document with the modified orders array
      await updateDoc(foundDocument.ref, {
        orders: orders,
        lastUpdated: new Date().toISOString()
      });
      console.log('✅ Order permanently deleted from deletedOrders collection:', orderId);
    }

    return NextResponse.json({
      success: true,
      message: 'Order permanently deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error permanently deleting order:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error permanently deleting order',
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