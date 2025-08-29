import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';

export async function GET(request: NextRequest) {
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
