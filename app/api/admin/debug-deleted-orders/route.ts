import { NextRequest, NextResponse } from 'next/server';
export async function GET(request: NextRequest) {
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
    const { virtualDb } = await import('../..//lib/firebase');
  try {
    if (!virtualDb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual database not available' 
      }, { status: 500 });
    }

    console.log('🔍 Debug: Checking deletedOrders collection...');

    const deletedOrdersRef = collection(virtualDb, 'deletedOrders');
    const querySnapshot = await getDocs(deletedOrdersRef);
    
    const deletedOrders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        invoiceNumber: data.invoiceNumber,
        clientEmail: data.client?.email,
        deletedAt: data.deletedAt,
        orderStructure: {
          hasOrders: !!data.orders,
          ordersLength: data.orders?.length || 0,
          hasItems: !!data.items,
          itemsLength: data.items?.length || 0,
          hasCartItems: !!data.cartItems,
          cartItemsLength: data.cartItems?.length || 0
        },
        allFields: Object.keys(data)
      };
    });

    console.log(`🔍 Debug: Found ${deletedOrders.length} deleted orders`);

    return NextResponse.json({
      success: true,
      count: deletedOrders.length,
      deletedOrders: deletedOrders
    });

  } catch (error) {
    console.error('❌ Debug: Error checking deletedOrders:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check deletedOrders' 
    }, { status: 500 });
  }
}
