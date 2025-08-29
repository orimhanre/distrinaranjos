import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, virtualDb } from '../../../../lib/firebase';

export async function POST(request: NextRequest) {
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