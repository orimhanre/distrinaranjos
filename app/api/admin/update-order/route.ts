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
    const { db, virtualDb } = await import('../../../lib/firebase');
  try {
    const { orderId, updates } = await request.json();
    

    
    if (!orderId || !updates) {
  
      return NextResponse.json(
        { success: false, error: 'Order ID and updates are required' },
        { status: 400 }
      );
    }

    // Determine which Firebase instance to use based on the request
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';
    

    
    // Use virtual Firebase for virtual admin, main Firebase for main admin
    const firestoreDb = isVirtualAdmin ? virtualDb : db;
    

    
    if (!firestoreDb) {
  
      return NextResponse.json(
        { success: false, error: 'Firebase not configured' },
        { status: 500 }
      );
    }

    // Process updates to handle DELETE_FIELD values
    const processedUpdates: any = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value === 'DELETE_FIELD') {
        processedUpdates[key] = deleteField();
      } else {
        processedUpdates[key] = value;
      }
    }
    

    
    // Update the order in Firestore
    const collectionName = isVirtualAdmin ? 'virtualOrders' : 'orders';
    

    
    if (isVirtualAdmin && collectionName === 'virtualOrders') {
      // For virtual orders, we need to update the specific order in the orders array
      try {

        
        // The orderId from the request has format: "clientEmail_orderIdentifier"
        // We need to extract the client email and find the document
        const orderIdParts = orderId.split('_');

        
        if (orderIdParts.length < 2) {

          return NextResponse.json(
            { success: false, error: 'Invalid orderId format' },
            { status: 400 }
          );
        }
        
        // The first part is the client email (document ID)
        const clientEmail = orderIdParts[0];
        // The rest is the order identifier
        const orderIdentifier = orderIdParts.slice(1).join('_');
        

        
        // Get the client document from virtualOrders collection
        const clientDocRef = doc(firestoreDb, collectionName, clientEmail);
        const clientDoc = await getDoc(clientDocRef);
        

        
        if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          const orders = clientData.orders || [];
          

          
          // Find the specific order in the orders array
          // Look for order by orderId or invoiceNumber
          const orderIndex = orders.findIndex((order: any) => 
            order.orderId === orderIdentifier || 
            order.invoiceNumber === orderIdentifier ||
            order.orderId === orderId || // Fallback for direct orderId match
            order.invoiceNumber === orderId // Fallback for direct invoiceNumber match
          );
          

          
          if (orderIndex !== -1) {

            
            // Update the specific order in the orders array
            const updatedOrders = [...orders];
            updatedOrders[orderIndex] = {
              ...updatedOrders[orderIndex],
              ...processedUpdates,
              lastUpdated: new Date()
            };
            

            
            // Update the virtualOrders document
            await updateDoc(clientDocRef, {
              orders: updatedOrders,
              lastUpdated: new Date()
            });
            

            
            // Also update the corresponding client profile in clients collection
            try {
              const clientProfileRef = doc(firestoreDb, 'clients', clientEmail);
              const clientProfileDoc = await getDoc(clientProfileRef);
              
              if (clientProfileDoc.exists()) {
                const clientProfileData = clientProfileDoc.data();
                const clientOrders = clientProfileData.orders || [];
                

                
                // Find the same order in clients collection
                const clientOrderIndex = clientOrders.findIndex((order: any) => {
                  // Try multiple matching strategies
                  const matchesOrderId = order.orderId === orders[orderIndex].orderId;
                  const matchesInvoiceNumber = order.invoiceNumber === orders[orderIndex].invoiceNumber;
                  const matchesOrderNumber = order.orderNumber === orders[orderIndex].orderNumber;
                  
                  // For virtual orders, the orderId might be in format "clientEmail_orderIdentifier"
                  // So we need to check if the extracted order identifier matches
                  const orderIdParts = orders[orderIndex].orderId?.split('_') || [];
                  const orderIdentifier = orderIdParts.slice(1).join('_');
                  const matchesExtractedId = order.orderId === orderIdentifier || 
                                           order.invoiceNumber === orderIdentifier ||
                                           order.orderNumber === orderIdentifier;
                  

                  
                  return matchesOrderId || matchesInvoiceNumber || matchesOrderNumber || matchesExtractedId;
                });
                
                if (clientOrderIndex !== -1) {
                  // Update the order in clients collection
                  const updatedClientOrders = [...clientOrders];
                  updatedClientOrders[clientOrderIndex] = {
                    ...updatedClientOrders[clientOrderIndex],
                    ...processedUpdates,
                    lastUpdated: new Date()
                  };
                  
                  await updateDoc(clientProfileRef, {
                    orders: updatedClientOrders,
                    lastUpdated: new Date()
                  });
                  
                  console.log(`✅ Updated order in clients collection for ${clientEmail}`);
                }
              }
            } catch (clientUpdateError) {
              console.warn('⚠️ Could not update client profile:', clientUpdateError);
              // Continue even if client profile update fails
            }
          } else {
            console.error(`❌ Order not found in orders array for orderId: ${orderId}, orderIdentifier: ${orderIdentifier}`);
            return NextResponse.json(
              { success: false, error: 'Order not found in orders array' },
              { status: 404 }
            );
          }
        } else {
          console.error(`❌ Client document not found: ${clientEmail}`);
          return NextResponse.json(
            { success: false, error: 'Client document not found' },
            { status: 404 }
          );
        }
      } catch (updateError) {
        console.error('❌ Error updating virtual order:', updateError);
        return NextResponse.json(
          { success: false, error: 'Error updating virtual order' },
          { status: 500 }
        );
      }
    } else {
      // For main database orders, use regular update
      console.log('🔍 API Debug: Processing main database order update');
      const orderRef = doc(firestoreDb, collectionName, orderId);
      await updateDoc(orderRef, processedUpdates);
    }

    
    return NextResponse.json({
      success: true,
      message: 'Order updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating order:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error updating order',
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