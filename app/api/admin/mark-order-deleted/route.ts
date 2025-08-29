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
    const { virtualDb } = await import('../../../lib/firebase');
  try {
    if (!virtualDb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual database not available' 
      }, { status: 500 });
    }

    const { clientEmail, orderNumber } = await request.json();

    if (!clientEmail || !orderNumber) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing clientEmail or orderNumber' 
      }, { status: 400 });
    }

    // Get the client document from clients collection
    const clientRef = doc(virtualDb, 'clients', clientEmail);
    const clientDoc = await getDoc(clientRef);

    if (!clientDoc.exists()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Client not found' 
      }, { status: 404 });
    }

    const clientData = clientDoc.data();
    const clientOrders = clientData.orders || [];

    // Find and mark the specific order as deleted
    let orderFound = false;
    const updatedOrders = clientOrders.map((order: any) => {
      const orderNum = order.orderNumber || order.invoiceNumber;
      
      if (orderNum === orderNumber) {
        orderFound = true;
        return {
          ...order,
          isDeleted: true,
          deletedAt: new Date().toISOString()
        };
      }
      return order;
    });

    if (!orderFound) {
      console.log(`❌ mark-order-deleted: Order ${orderNumber} not found for client ${clientEmail}`);
      return NextResponse.json({ 
        success: false, 
        error: 'Order not found' 
      }, { status: 404 });
    }

    // Update the client document
    await updateDoc(clientRef, {
      orders: updatedOrders,
      lastUpdated: new Date()
    });

    return NextResponse.json({
      success: true,
      message: 'Order marked as deleted successfully'
    });

  } catch (error) {
    console.error('❌ mark-order-deleted: Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to mark order as deleted' 
    }, { status: 500 });
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