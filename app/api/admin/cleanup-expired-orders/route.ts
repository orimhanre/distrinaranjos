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
    // Determine which Firebase instance to use
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';
    const firestoreDb = isVirtualAdmin ? virtualDb : db;

    if (!firestoreDb) {
      throw new Error('Firebase database not initialized.');
    }

    console.log('🔄 Starting manual cleanup of expired orders...');
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Current time: ${now.toISOString()}`);
    console.log(`📅 30 days ago: ${thirtyDaysAgo.toISOString()}`);
    
    // Get all documents from deletedOrders collection
    const deletedOrdersSnapshot = await getDocs(collection(firestoreDb, 'deletedOrders'));
    
    if (deletedOrdersSnapshot.empty) {
      console.log('✅ No deleted orders found');
      return NextResponse.json({ 
        success: true, 
        message: 'No deleted orders found',
        timestamp: now.toISOString()
      });
    }
    
    console.log(`📊 Found ${deletedOrdersSnapshot.size} customer documents in deletedOrders`);
    
    let totalExpiredOrders = 0;
    let totalDeletedCustomers = 0;
    
    // Process each customer document
    for (const customerDoc of deletedOrdersSnapshot.docs) {
      const customerData = customerDoc.data();
      const orders = customerData.orders || [];
      
      console.log(`🔍 Processing customer: ${customerDoc.id} with ${orders.length} orders`);
      
      // Filter out expired orders
      const validOrders = [];
      let hasExpiredOrders = false;
      
      for (const order of orders) {
        const deletedAt = order.deletedAt;
        if (!deletedAt) {
          console.log(`⚠️ Order ${order.invoiceNumber || 'unknown'} has no deletedAt, keeping it`);
          validOrders.push(order);
          continue;
        }
        
        const deletedDate = new Date(deletedAt);
        if (isNaN(deletedDate.getTime())) {
          console.log(`⚠️ Order ${order.invoiceNumber || 'unknown'} has invalid deletedAt: ${deletedAt}, keeping it`);
          validOrders.push(order);
          continue;
        }
        
        // Check if order is expired (older than 30 days)
        if (deletedDate < thirtyDaysAgo) {
          console.log(`🗑️ Expired order: ${order.invoiceNumber || 'unknown'} deleted on ${deletedDate.toISOString()}`);
          hasExpiredOrders = true;
          totalExpiredOrders++;
        } else {
          console.log(`✅ Valid order: ${order.invoiceNumber || 'unknown'} deleted on ${deletedDate.toISOString()}`);
          validOrders.push(order);
        }
      }
      
      // Update or delete the customer document
      if (validOrders.length === 0) {
        // All orders expired, delete the entire customer document
        console.log(`🗑️ Deleting customer document ${customerDoc.id} (all orders expired)`);
        await deleteDoc(customerDoc.ref);
        totalDeletedCustomers++;
      } else if (hasExpiredOrders) {
        // Some orders expired, update with remaining valid orders
        console.log(`📝 Updating customer document ${customerDoc.id} (${validOrders.length} orders remaining)`);
        await updateDoc(customerDoc.ref, {
          orders: validOrders,
          lastUpdated: now.toISOString()
        });
      }
    }
    
    console.log(`✅ Cleanup completed:`);
    console.log(`   - Total expired orders removed: ${totalExpiredOrders}`);
    console.log(`   - Total customer documents deleted: ${totalDeletedCustomers}`);
    
    return NextResponse.json({
      success: true,
      expiredOrdersRemoved: totalExpiredOrders,
      customerDocumentsDeleted: totalDeletedCustomers,
      timestamp: now.toISOString(),
      message: `Cleanup completed: ${totalExpiredOrders} expired orders removed, ${totalDeletedCustomers} customer documents deleted`
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error during cleanup',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual triggering
export async function GET(request: NextRequest) {
  return POST(request);
} 