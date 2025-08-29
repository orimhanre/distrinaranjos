import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { virtualDb } from '../../../lib/firebase';

export async function POST(request: NextRequest) {
  try {
    // Check if required environment variables are available
    if (!process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID ||
        !process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ||
        !process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Virtual Firebase environment variables not available, skipping sync');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase not configured' 
      }, { status: 503 });
    }

    if (!virtualDb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual database not available' 
      }, { status: 500 });
    }

    const { clientEmail, orderData, operation } = await request.json();
    
    // Validate required parameters
    if (!clientEmail || !orderData) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters: clientEmail and orderData' 
      }, { status: 400 });
    }

    console.log(`🔄 Firestore trigger sync for client: ${clientEmail}, operation: ${operation}`);

    // Check if this client exists in virtualOrders collection
    const virtualOrderRef = doc(virtualDb, 'virtualOrders', clientEmail);
    const virtualOrderDoc = await getDoc(virtualOrderRef);

    if (virtualOrderDoc.exists()) {
      // Client exists in virtualOrders, check if order already exists
      const virtualOrderData = virtualOrderDoc.data();
      const virtualOrders = virtualOrderData.orders || [];
      
      // Check if this specific order already exists
      const orderExists = virtualOrders.some((existingOrder: any) => 
        (existingOrder.orderNumber || existingOrder.invoiceNumber) === 
        (orderData.orderNumber || orderData.invoiceNumber)
      );

      if (!orderExists) {
        // Add the new order to virtualOrders
        const updatedVirtualOrders = [...virtualOrders, orderData];
        
        await updateDoc(virtualOrderRef, {
          orders: updatedVirtualOrders,
          lastUpdated: serverTimestamp()
        });

        console.log(`✅ Auto-synced new order ${orderData.orderNumber} for client ${clientEmail}`);
        
        return NextResponse.json({
          success: true,
          message: 'Order synced successfully',
          syncedOrder: orderData.orderNumber,
          clientEmail
        });
      } else {
        console.log(`⏭️ Order ${orderData.orderNumber} already exists in virtualOrders for client ${clientEmail}`);
        
        return NextResponse.json({
          success: true,
          message: 'Order already exists',
          syncedOrder: orderData.orderNumber,
          clientEmail
        });
      }
    } else {
      // Client doesn't exist in virtualOrders, create new document
      console.log(`📝 Creating new virtualOrders document for client ${clientEmail}`);
      
      const virtualOrderData = {
        id: clientEmail,
        client: {
          name: orderData.client?.name || '',
          surname: orderData.client?.surname || '',
          companyName: orderData.client?.companyName || '',
          email: clientEmail,
          phone: orderData.client?.phone || '',
          address: orderData.client?.address || '',
          city: orderData.client?.city || '',
          department: orderData.client?.department || '',
          postalCode: orderData.client?.postalCode || '',
          cedula: orderData.client?.cedula || ''
        },
        orders: [orderData],
        userAuth: {
          email: clientEmail,
          displayName: `${orderData.client?.name || ''} ${orderData.client?.surname || ''}`.trim()
        },
        clientEmail: clientEmail,
        metadata: {
          environment: 'virtual',
          source: 'web',
          isActive: true
        },
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };

      await setDoc(virtualOrderRef, virtualOrderData);
      console.log(`✅ Created virtualOrders document with order ${orderData.orderNumber} for client ${clientEmail}`);
      
      return NextResponse.json({
        success: true,
        message: 'New client document created with order',
        syncedOrder: orderData.orderNumber,
        clientEmail
      });
    }

  } catch (error) {
    console.error('❌ Firestore trigger sync failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Firestore trigger sync failed' 
    }, { status: 500 });
  }
}

export async function GET() {
  // Handle build-time page data collection
  return NextResponse.json({ 
    success: true, 
    message: 'Firestore trigger sync endpoint available',
    configured: !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                  process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                  process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                  process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL)
  });
}
