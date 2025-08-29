import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
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
      console.log('⚠️ Neither regular nor virtual Firebase environment variables available, skipping deleted orders retrieval');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured for either environment' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const { db, virtualDb } = await import('../../../../lib/firebase');

    // Determine which Firebase instance to use based on the request
    const url = new URL(request.url);
    const isVirtualAdmin = url.pathname.includes('virtual') || url.searchParams.get('virtual') === 'true';

    console.log('🔍 API: /api/admin/deleted-orders called');
    console.log('🔍 API: isVirtualAdmin =', isVirtualAdmin);

    const firestoreDb = isVirtualAdmin ? virtualDb : db;
    console.log('🔍 API: firestoreDb =', firestoreDb ? 'configured' : 'not configured');

    if (!firestoreDb) {
      throw new Error('Firebase database not initialized.');
    }

    const deletedOrdersRef = collection(firestoreDb, 'deletedOrders');
    // Get all documents without any ordering or filtering to see what's actually there
    const querySnapshot = await getDocs(deletedOrdersRef);
    
    console.log('🔍 API: Found', querySnapshot.docs.length, 'deleted orders');
    querySnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`🔍 API: Order ${index + 1}:`, {
        id: doc.id,
        email: data.clientEmail || data.client?.email || data.email || data.userAuth?.email,
        deletedAt: data.deletedAt,
        ordersCount: data.orders?.length || 0,
        hasItems: !!(data.items || data.cartItems || (data.orders && data.orders[0]?.items)),
        hasClient: !!data.client,
        hasUserAuth: !!data.userAuth
      });
    });
    
    console.log('🔍 API: Found', querySnapshot.docs.length, 'deleted orders');
    console.log('🔍 API: Document IDs:', querySnapshot.docs.map(doc => doc.id));
    
    const deletedOrders = querySnapshot.docs.map(doc => {
      const orderData = doc.data();
      
      // Transform the data structure for virtual admin orders
      if (isVirtualAdmin) {
        return {
          id: doc.id,
          // Client information
          client: orderData.client || {
            name: orderData.client?.name || orderData.userAuth?.displayName || orderData.nombre || orderData.name || orderData.firstName || '',
            surname: orderData.client?.surname || orderData.apellido || orderData.lastName || '',
            companyName: orderData.client?.companyName || orderData.empresa || orderData.company || '',
            email: orderData.client?.email || orderData.userAuth?.email || orderData.email || '',
            phone: orderData.client?.phone || orderData.telefono || orderData.phone || '',
            address: orderData.client?.address || orderData.direccion || orderData.address || '',
            city: orderData.client?.city || orderData.ciudad || orderData.city || '',
            department: orderData.client?.department || orderData.departamento || orderData.department || '',
            cedula: orderData.client?.cedula || orderData.cedula || '',
            postalCode: orderData.client?.postalCode || orderData.codigoPostal || orderData.postalCode || ''
          },
          // Use the new orders array structure instead of single order object
          orders: orderData.orders || [{
            orderId: orderData.orderId || orderData.invoiceNumber || doc.id,
            invoiceNumber: orderData.invoiceNumber || 'N/A',
            status: orderData.status || 'nuevo', // Preserve original status, default to 'nuevo'
            paymentStatus: orderData.paymentStatus || 'pending',
            // Transform items to consistent format
            items: (orderData.items || orderData.cartItems || []).map((item: any) => ({
              productId: item.productId || item.id || 'unknown',
              productName: item.productName || item.name || 'Producto',
              quantity: item.quantity || 1,
              price: item.price || item.unitPrice || 0,
              selectedColor: item.selectedColor || item.color || '',
              brand: item.brand || ''
            })),
            // Financial information
            totalAmount: orderData.totalAmount || 0,
            subtotal: orderData.subtotal || orderData.totalAmount || 0,
            shippingCost: orderData.shippingCost || 0,
            // Order details
            orderDetails: orderData.orderDetails || '',
            comentario: orderData.comentario || '',
            // File information
            fileName: orderData.fileName || orderData.pdfFileName || orderData.filename || '',
            fileUrl: orderData.fileUrl || orderData.pdfUrl || orderData.pdf || orderData.file || '',
            // Tracking information
            trackingNumber: orderData.trackingNumber || '',
            courier: orderData.courier || '',
            // Timestamps
            orderDate: orderData.orderDate || orderData.timestamp || new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            // Payment information
            paymentMethod: orderData.paymentMethod || 'No especificado',
            // Admin message fields
            adminMessage: orderData.adminMessage || '',
            adminMessageDate: orderData.adminMessageDate || null
          }],
          // Metadata
          deletedAt: (() => {
            // Handle Firestore timestamp conversion
            if (orderData.deletedAt) {
              if (orderData.deletedAt.toDate && typeof orderData.deletedAt.toDate === 'function') {
                return orderData.deletedAt.toDate().toISOString();
              }
              if (typeof orderData.deletedAt === 'string') {
                return orderData.deletedAt;
              }
              if (orderData.deletedAt instanceof Date) {
                return orderData.deletedAt.toISOString();
              }
            }
            return null;
          })(),
          originalOrderId: orderData.originalOrderId || doc.id,
          retentionDate: (() => {
            // Handle Firestore timestamp conversion
            if (orderData.retentionDate) {
              if (orderData.retentionDate.toDate && typeof orderData.retentionDate.toDate === 'function') {
                return orderData.retentionDate.toDate().toISOString();
              }
              if (typeof orderData.retentionDate === 'string') {
                return orderData.retentionDate;
              }
              if (orderData.retentionDate instanceof Date) {
                return orderData.retentionDate.toISOString();
              }
            }
            return null;
          })(),
          environment: orderData.environment || 'virtual',
          source: orderData.source || 'web',
          labels: orderData.labels || []
        };
      } else {
        // For main admin, return the original structure
        return {
          id: doc.id,
          ...orderData
        };
      }
    });

    console.log('🔍 API: QuerySnapshot size:', querySnapshot.size);
    console.log('🔍 API: Returning deleted orders:', deletedOrders.length);
    console.log('🔍 API: Deleted order IDs:', deletedOrders.map(order => order.id));

    return NextResponse.json({ 
      success: true, 
      deletedOrders: deletedOrders 
    });

  } catch (error) {
    console.error('Error fetching deleted orders:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener los pedidos eliminados' },
      { status: 500 }
    );
  }
}

export async function POST() {
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
    message: 'Deleted orders endpoint available',
    configured: hasRegularFirebase || hasVirtualFirebase,
    regularFirebase: hasRegularFirebase,
    virtualFirebase: hasVirtualFirebase
  });
} 