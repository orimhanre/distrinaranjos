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
    const { db, virtualDb } = await import('../..//lib/firebase');
  try {
    const { orderId, order } = await request.json();
    
    if (!orderId || !order) {
      return NextResponse.json(
        { success: false, error: 'Order ID and order data are required' },
        { status: 400 }
      );
    }

    // Determine which Firebase instance to use based on the request
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';



    const firestoreDb = isVirtualAdmin ? virtualDb : db;

    if (!firestoreDb) {
      throw new Error('Firebase database not initialized.');
    }

    // Add to deleted orders collection with 30-day retention
    const deletedOrderData = {
      ...order,
      deletedAt: serverTimestamp(),
      originalOrderId: orderId,
      retentionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
    };

    let deletedOrderRef: any;
    
    // For virtual admin, ensure product information is properly preserved
    if (isVirtualAdmin) {
      // Get client profile data from clients collection
      let clientProfile = null;
      try {
        const clientEmail = order.client?.email || order.userAuth?.email || order.email || orderId;
        const clientDoc = await getDoc(doc(firestoreDb, 'clients', clientEmail));
        if (clientDoc.exists()) {
          clientProfile = clientDoc.data();
        }
      } catch (error) {
        // Could not fetch client profile
      }

      // For virtual admin, preserve the EXACT same structure as iOS app
      // Get the client email to use as document ID
      const clientEmail = order.client?.email || order.userAuth?.email || order.email || orderId;
      
      // Add deletion metadata to the order while preserving ALL existing fields
      const deletionDate = new Date();
      const retentionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      
      // Calculate remaining days
      const now = new Date();
      const diffTime = retentionDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const remainingDays = Math.max(0, diffDays);
      
      // Create updated order data with deletion metadata
      const updatedOrderData = {
        ...order,
        deletedAt: deletionDate.toISOString(),
        deletedBy: 'web-admin', // Could be enhanced to get actual user email
        retentionDate: retentionDate.toISOString(),
        remainingDays: remainingDays
      };
      
      // Get or create the deleted customer document
      const deletedCustomerRef = doc(firestoreDb, 'deletedOrders', clientEmail);
      const deletedCustomerDoc = await getDoc(deletedCustomerRef);
      
      if (deletedCustomerDoc.exists()) {
        // Customer already exists in deletedOrders, add to their orders array
        const deletedCustomerData = deletedCustomerDoc.data();
        const deletedOrders = deletedCustomerData.orders || [];
        deletedOrders.push(updatedOrderData);
        
        await updateDoc(deletedCustomerRef, {
          orders: deletedOrders,
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create new customer document in deletedOrders with the same structure as virtualOrders
        const newDeletedCustomerData: any = {};
        
        // Copy ALL fields from the original order except the orders array
        for (const [key, value] of Object.entries(order)) {
          if (key !== 'orders') {
            newDeletedCustomerData[key] = value;
          }
        }
        
        newDeletedCustomerData.orders = [updatedOrderData];
        newDeletedCustomerData.lastUpdated = new Date().toISOString();
        
        await setDoc(deletedCustomerRef, newDeletedCustomerData);
      }
    } else {
      // For main admin, use the original logic
      deletedOrderRef = await addDoc(collection(firestoreDb, 'deletedOrders'), deletedOrderData);
    }

    // Delete from original orders collection
    const collectionName = isVirtualAdmin ? 'virtualOrders' : 'orders';
    if (isVirtualAdmin && collectionName === 'virtualOrders') {
      // For virtual orders, we need to remove the specific order from the orders array
      // The orderId format should be "clientEmail_orderIdentifier", but handle cases where it's just the email
      let clientEmail, orderIdentifier;
      
              if (orderId.includes('_')) {
          // Standard format: "clientEmail_orderIdentifier"
          const orderIdParts = orderId.split('_');
          clientEmail = orderIdParts[0];
          orderIdentifier = orderIdParts.slice(1).join('_');
        } else {
          // Fallback: orderId is just the client email, need to find the order differently
          clientEmail = orderId;
          orderIdentifier = null;
        }
      
      // Get the client document from virtualOrders collection
      const clientDocRef = doc(firestoreDb, collectionName, clientEmail);
      const clientDoc = await getDoc(clientDocRef);
      
              if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          const orders = clientData.orders || [];
        
        let updatedOrders;
        
        if (orderIdentifier) {
          // Remove the specific order from the orders array
          updatedOrders = orders.filter((order: any) => {
            // Check if this order matches the one we want to delete
            const matchesOrderId = order.orderId === orderIdentifier;
            const matchesInvoiceNumber = order.invoiceNumber === orderIdentifier;
            
            // Also check if the full orderId matches (as a fallback)
            const matchesFullOrderId = order.orderId === orderId || order.invoiceNumber === orderId;
            
            const shouldKeep = !matchesOrderId && !matchesInvoiceNumber && !matchesFullOrderId;
            
            if (!shouldKeep) {
              // Removing specific order from orders array
            }
            
            return shouldKeep;
          });
        } else {
          // Remove all orders for this client (when orderId is just the email)
          updatedOrders = [];
        }
        
        // Update the virtualOrders document with the filtered orders array
        await updateDoc(clientDocRef, {
          orders: updatedOrders,
          lastUpdated: new Date()
        });
        
        // If no orders left, consider deleting the entire client document
        if (updatedOrders.length === 0) {
          await deleteDoc(clientDocRef);
        }
      } else {
        // Client document not found in virtualOrders
      }
    } else {
      // For main database orders, use regular delete
      const orderRef = doc(firestoreDb, collectionName, orderId);
      await deleteDoc(orderRef);
    }

    // For virtual admin, also update the clients collection to mark the order as deleted
    if (isVirtualAdmin) {
      try {
        const clientEmail = order.client?.email || order.userAuth?.email || order.email;
        if (clientEmail) {
          const clientProfileRef = doc(firestoreDb, 'clients', clientEmail);
          const clientProfileDoc = await getDoc(clientProfileRef);
          
          if (clientProfileDoc.exists()) {
            const clientProfileData = clientProfileDoc.data();
            const clientOrders = clientProfileData.orders || [];
            
            // Find and update the specific order in the client's orders array
            const updatedClientOrders = clientOrders.map((clientOrder: any) => {
              // Try multiple matching strategies
              const matchesOrderId = clientOrder.orderId === order.orderId;
              const matchesInvoiceNumber = clientOrder.invoiceNumber === order.invoiceNumber;
              const matchesOrderNumber = clientOrder.orderNumber === order.orderNumber;
              
              if (matchesOrderId || matchesInvoiceNumber || matchesOrderNumber) {
                return {
                  ...clientOrder,
                  isDeleted: true,
                  deletedAt: new Date().toISOString()
                };
              }
              return clientOrder;
            });
            
            // Update the client profile
            await updateDoc(clientProfileRef, {
              orders: updatedClientOrders,
              lastUpdated: new Date()
            });
          }
        }
      } catch (clientUpdateError) {
        console.warn('⚠️ Could not update client profile for deletion:', clientUpdateError);
        // Continue even if client profile update fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Order moved to deleted orders successfully',
      deletedOrderId: orderId // Use the original orderId instead of generated ID
    });

  } catch (error) {
    console.error('❌ Error moving order to deleted:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error moving order to deleted orders',
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