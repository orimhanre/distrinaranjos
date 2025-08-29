import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db, virtualDb } from '../../../../lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Determine which Firebase instance to use based on the request
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';

    console.log('🔍 API: /api/admin/get-original-order called');
    console.log('🔍 API: isVirtualAdmin =', isVirtualAdmin);

    const firestoreDb = isVirtualAdmin ? virtualDb : db;
    console.log('🔍 API: firestoreDb =', firestoreDb ? 'configured' : 'not configured');

    if (!firestoreDb) {
      throw new Error('Firebase database not initialized.');
    }

    // Get original order from Firestore
    const collectionName = isVirtualAdmin ? 'virtualOrders' : 'orders';
    
    if (isVirtualAdmin && collectionName === 'virtualOrders') {
      // For virtual orders, the orderId format is "clientEmail_orderIdentifier"
      // We need to extract the client email and find the order in the orders array
      const orderIdParts = orderId.split('_');
      if (orderIdParts.length < 2) {
        return NextResponse.json(
          { success: false, error: 'Invalid orderId format for virtual orders' },
          { status: 400 }
        );
      }
      
      // The first part is the client email (document ID)
      const clientEmail = orderIdParts[0];
      // The rest is the order identifier
      const orderIdentifier = orderIdParts.slice(1).join('_');
      
      console.log('🔍 API: clientEmail:', clientEmail);
      console.log('🔍 API: orderIdentifier:', orderIdentifier);
      
      // Get the client document from virtualOrders collection
      const clientDocRef = doc(firestoreDb, collectionName, clientEmail);
      const clientDoc = await getDoc(clientDocRef);
      
      if (!clientDoc.exists()) {
        return NextResponse.json(
          { success: false, error: 'Client document not found' },
          { status: 404 }
        );
      }
      
      const clientData = clientDoc.data();
      const orders = clientData.orders || [];
      
      console.log('🔍 API: Found client document with orders:', orders.length);
      
      // Find the specific order in the orders array
      const order = orders.find((order: any) => {
        const matchesOrderId = order.orderId === orderIdentifier;
        const matchesInvoiceNumber = order.invoiceNumber === orderIdentifier;
        const matchesOrderIdDirect = order.orderId === orderId;
        const matchesInvoiceNumberDirect = order.invoiceNumber === orderId;
        
        console.log('🔍 API: Order matching debug:', {
          orderId: order.orderId,
          invoiceNumber: order.invoiceNumber,
          orderIdentifier,
          fullOrderId: orderId,
          matchesOrderId,
          matchesInvoiceNumber,
          matchesOrderIdDirect,
          matchesInvoiceNumberDirect
        });
        
        return matchesOrderId || matchesInvoiceNumber || matchesOrderIdDirect || matchesInvoiceNumberDirect;
      });
      
      if (!order) {
        console.log('🔍 API: Order not found in orders array. Available orders:', orders.map((o: any) => ({
          orderId: o.orderId,
          invoiceNumber: o.invoiceNumber
        })));
        return NextResponse.json(
          { success: false, error: 'Order not found in client orders array' },
          { status: 404 }
        );
      }
      
      console.log('🔍 API: Found order in orders array:', order.orderId);
      
      const orderData = {
        id: orderId,
        ...order
      };
      
      return NextResponse.json({
        success: true,
        order: orderData
      });
    } else {
      // For main database orders, use regular logic
      const orderRef = doc(firestoreDb, collectionName, orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) {
        return NextResponse.json(
          { success: false, error: 'Order not found' },
          { status: 404 }
        );
      }

      const orderData = {
        id: orderDoc.id,
        ...orderDoc.data()
      };

      return NextResponse.json({
        success: true,
        order: orderData
      });
    }

  } catch (error) {
    console.error('❌ Error getting original order:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error getting original order',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 