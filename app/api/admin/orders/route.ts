import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db, virtualDb } from '../../../../lib/firebase';
import { readFileSync } from 'fs';
import { join } from 'path';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Function to load environment variables from .env.virtual.local
function loadVirtualEnv() {
  try {
    const envPath = join(process.cwd(), '.env.virtual.local');
    const envContent = readFileSync(envPath, 'utf8');
    const envVars: { [key: string]: string } = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Error loading .env.virtual.local:', error);
    return {};
  }
}

// Load virtual environment variables
const virtualEnv = loadVirtualEnv();

// Initialize virtual Firebase app for API routes if not already available
let apiVirtualDb = virtualDb;
if (!apiVirtualDb && virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY) {
  try {
    const virtualFirebaseConfig = {
      apiKey: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY,
      authDomain: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN,
      projectId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID,
      storageBucket: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID,
      appId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID
    };
    
    const virtualApp = initializeApp(virtualFirebaseConfig, 'virtual-api');
    apiVirtualDb = getFirestore(virtualApp);
    console.log('✅ Virtual Firebase initialized for API route');
  } catch (error) {
    console.error('❌ Failed to initialize virtual Firebase for API route:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    
    // Determine if this is for virtual admin
    const url = new URL(request.url);
    const isVirtualAdmin = url.searchParams.get('virtual') === 'true';
    
    console.log('🔍 API Route Debug:', {
      isVirtualAdmin,
      virtualDbAvailable: !!virtualDb,
      apiVirtualDbAvailable: !!apiVirtualDb,
      mainDbAvailable: !!db,
      url: request.url
    });
    
    // Select database and collection
    const { firestoreDb, collectionName } = isVirtualAdmin 
      ? { firestoreDb: apiVirtualDb, collectionName: 'virtualOrders' }
      : { firestoreDb: db, collectionName: 'orders' };
    
    console.log('🔍 Selected Database:', {
      firestoreDbAvailable: !!firestoreDb,
      collectionName,
      isVirtualAdmin,
      usingApiVirtualDb: isVirtualAdmin && !!apiVirtualDb
    });
    
    if (!firestoreDb) {
      console.error('❌ Database not available for', isVirtualAdmin ? 'virtual' : 'main', 'admin');
      return NextResponse.json({ 
        success: false, 
        error: `Database not available for ${isVirtualAdmin ? 'virtual' : 'main'} admin`,
        debug: {
          isVirtualAdmin,
          virtualDbAvailable: !!virtualDb,
          apiVirtualDbAvailable: !!apiVirtualDb,
          mainDbAvailable: !!db
        }
      }, { status: 500 });
    }
    
    // Fetch all documents from the collection
    const collectionRef = collection(firestoreDb, collectionName);
    
    const snapshot = await getDocs(collectionRef);
    
    if (snapshot.empty) {
      return NextResponse.json({ success: true, orders: [] });
    }
    
    // Convert to array
    let orders: any[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log('🔍 API: Raw documents from virtualOrders collection:', {
      totalDocs: orders.length,
      sampleDoc: orders[0] ? {
        id: orders[0].id,
        hasOrders: !!orders[0].orders,
        ordersLength: orders[0].orders?.length || 0,
        keys: Object.keys(orders[0])
      } : null
    });
    
    // Log all documents and their order counts
    orders.forEach((doc, index) => {
      console.log(`🔍 Document ${index + 1}:`, {
        id: doc.id,
        ordersCount: doc.orders?.length || 0,
        orderNumbers: doc.orders?.map((order: any) => order.orderNumber || order.invoiceNumber) || []
      });
    });
    
    // For virtual admin, transform client documents to order format
    if (isVirtualAdmin) {
      
      // Transform and flatten the orders array
      const transformedOrders: any[] = [];
      
      orders.forEach((clientDoc: any) => {
        // Transform client document to order format using the orders array structure
        // Each client document can have multiple orders, so we'll create one row per order
        const clientOrders = clientDoc.orders || [];
        
        console.log(`🔍 Processing client document ${clientDoc.id} with ${clientOrders.length} orders`);
        
        if (clientOrders.length === 0) {
          // If no orders, add a basic client document
          transformedOrders.push({
            id: clientDoc.id,
            client: {
              name: clientDoc.client?.name || clientDoc.userAuth?.displayName || clientDoc.nombre || clientDoc.name || clientDoc.firstName || '',
              surname: clientDoc.client?.surname || clientDoc.apellido || clientDoc.lastName || '',
              companyName: clientDoc.client?.companyName || clientDoc.empresa || clientDoc.company || '',
              email: clientDoc.client?.email || clientDoc.userAuth?.email || clientDoc.email || '',
              phone: clientDoc.client?.phone || clientDoc.telefono || clientDoc.phone || '',
              address: clientDoc.client?.address || clientDoc.direccion || clientDoc.address || '',
              city: clientDoc.client?.city || clientDoc.ciudad || clientDoc.city || '',
              department: clientDoc.client?.department || clientDoc.departamento || clientDoc.state || '',
              postalCode: clientDoc.client?.codigoPostal || clientDoc.codigoPostal || clientDoc.postalCode || '',
              cedula: clientDoc.client?.cedula || clientDoc.cedula || clientDoc.identification || ''
            },
            status: 'no-orders',
            paymentStatus: 'no-orders',
            cartItems: [],
            totalAmount: 0,
            invoiceNumber: 'N/A',
            orderDate: null
          });
        } else {
          // Add one row per order
          clientOrders.forEach((order: any, index: number) => {
            console.log(`🔍 Processing order ${index + 1} for client ${clientDoc.id}:`, {
              orderId: order.orderId,
              invoiceNumber: order.invoiceNumber,
              totalPrice: order.totalPrice,
              status: order.status
            });
            
            // Generate a unique order ID - use orderId, invoiceNumber, or fallback to timestamp + index
            const orderUniqueId = order.orderId || order.invoiceNumber || `order_${Date.now()}_${index}`;
            const orderId = `${clientDoc.id}_${orderUniqueId}`;
            
            transformedOrders.push({
              id: orderId,
              client: {
                name: clientDoc.client?.name || clientDoc.userAuth?.displayName || clientDoc.nombre || clientDoc.name || clientDoc.firstName || '',
                surname: clientDoc.client?.surname || clientDoc.apellido || clientDoc.lastName || '',
                companyName: clientDoc.client?.companyName || clientDoc.empresa || clientDoc.company || '',
                email: clientDoc.client?.email || clientDoc.userAuth?.email || clientDoc.email || '',
                phone: clientDoc.client?.phone || clientDoc.telefono || clientDoc.phone || '',
                address: clientDoc.client?.address || clientDoc.direccion || clientDoc.address || '',
                city: clientDoc.client?.city || clientDoc.ciudad || clientDoc.city || '',
                department: clientDoc.client?.department || clientDoc.departamento || clientDoc.state || '',
                postalCode: clientDoc.client?.codigoPostal || clientDoc.codigoPostal || clientDoc.postalCode || '',
                cedula: clientDoc.client?.cedula || clientDoc.cedula || clientDoc.identification || ''
              },
            
              // Order details from the specific order in the orders array
              status: order.status || 'new',
              paymentStatus: order.paymentStatus || 'pending',
              isStarred: clientDoc.metadata?.isStarred || clientDoc.isStarred || false,
              isArchived: clientDoc.metadata?.isArchived || clientDoc.isArchived || false,
              labels: clientDoc.labels || clientDoc.metadata?.labels || [],
              
              // Order items and details from the specific order
              cartItems: order.items || [],
              orderDetails: order.orderDetails || '',
              comentario: order.comentario || '',
              
              // Financial information from the specific order
              totalAmount: order.totalPrice || order.totalAmount || 0,
              shippingCost: order.shippingCost || 0,
              
              // Payment information from the specific order
              paymentMethod: order.paymentMethod || '',
              wompiTransactionId: order.wompiTransactionId || '',
              pseTransactionId: order.pseTransactionId || '',
              
              // Files and documents from the specific order
              fileUrl: order.pdfUrl || order.fileUrl || '',
              fileName: order.fileName || '',
              
              // Invoice and order numbers from the specific order
              invoiceNumber: order.invoiceNumber || order.orderNumber || '',
              orderNumber: order.orderNumber || order.invoiceNumber || '',
              
              // Timestamps from the specific order
              timestamp: order.orderDate || order.createdAt || new Date(),
              lastUpdated: order.lastUpdated || new Date(),
              
              // Metadata
              environment: clientDoc.environment || clientDoc.metadata?.environment || 'virtual',
              source: clientDoc.source || clientDoc.metadata?.source || 'web',
              isActive: clientDoc.isActive || clientDoc.metadata?.isActive || true,
              
              // Tracking information from the specific order
              trackingNumber: order.trackingNumber || '',
              courier: order.courier || '',
              
              // Additional fields for compatibility
              orderId: order.orderId || order.invoiceNumber,
              pdfUrl: order.fileUrl || ''
            });
          });
        }
      });
      
      // Replace the orders array with the transformed and flattened version
      orders = transformedOrders;
      
      console.log('🔍 API: After transformation:', {
        totalOrders: orders.length,
        sampleOrder: orders[0] ? {
          id: orders[0].id,
          customerName: orders[0].client?.name,
          customerEmail: orders[0].client?.email,
          status: orders[0].status,
          totalAmount: orders[0].totalAmount
        } : null
      });
      
      // Log all transformed orders
      orders.forEach((order, index) => {
        console.log(`🔍 Transformed Order ${index + 1}:`, {
          id: order.id,
          orderNumber: order.orderNumber,
          invoiceNumber: order.invoiceNumber,
          customerEmail: order.client?.email,
          totalAmount: order.totalAmount
        });
      });
    } else {
      // For regular admin (main database), transform flat order structure to expected format
      console.log('🔍 API: Processing regular orders from orders collection');
      
      // Log the raw data structure first
      console.log('🔍 API: Raw orders data structure:', {
        totalOrders: orders.length,
        sampleOrderKeys: orders[0] ? Object.keys(orders[0]) : [],
        sampleOrderData: orders[0] ? {
          id: orders[0].id,
          hasOrders: !!orders[0].orders,
          ordersLength: orders[0].orders?.length || 0,
          directFields: {
            name: orders[0].name,
            surname: orders[0].surname,
            companyName: orders[0].companyName,
            email: orders[0].email,
            clientEmail: orders[0].clientEmail
          }
        } : null
      });
      
      // Log a few more orders to see their structure
      orders.slice(0, 3).forEach((order, index) => {
        console.log(`🔍 Order ${index} structure:`, {
          id: order.id,
          keys: Object.keys(order),
          hasOrders: !!order.orders,
          ordersLength: order.orders?.length || 0,
          name: order.name,
          surname: order.surname,
          companyName: order.companyName,
          client: order.client
        });
      });
      
      const transformedOrders = orders.map((orderDoc: any) => {
        console.log(`🔍 Processing regular order ${orderDoc.id}:`, {
          name: orderDoc.name,
          surname: orderDoc.surname,
          companyName: orderDoc.companyName,
          invoiceNumber: orderDoc.orders?.[0]?.invoiceNumber,
          totalAmount: orderDoc.orders?.[0]?.totalAmount
        });
        
        // Extract the first order from the orders array; if absent, build from top-level (flat) structure
        let order = orderDoc.orders?.[0] || {};
        if (!orderDoc.orders || orderDoc.orders.length === 0) {
          // Build a compatible order object from top-level fields
          const topLevelItems = Array.isArray(orderDoc.cartItems) ? orderDoc.cartItems : [];
          // Compute total from items if needed
          let computedTotal = orderDoc.totalAmount || 0;
          if ((!computedTotal || isNaN(computedTotal)) && topLevelItems.length > 0) {
            computedTotal = topLevelItems.reduce((sum: number, item: any) => {
              const unit = (item.product?.price1 ?? item.product?.price ?? 0);
              return sum + unit * (item.quantity || 1);
            }, 0);
          }
          // Fallback: try parse from orderDetails
          if ((!computedTotal || isNaN(computedTotal)) && orderDoc.orderDetails) {
            const match = (orderDoc.orderDetails as string).match(/Total:\s*([\d\.\,]+)/i);
            if (match) {
              const numeric = Number(match[1].replace(/[^\d]/g, ''));
              if (!isNaN(numeric)) computedTotal = numeric;
            }
          }
          order = {
            status: orderDoc.status || 'new',
            paymentStatus: orderDoc.paymentStatus || 'pending',
            items: topLevelItems,
            orderDetails: orderDoc.orderDetails || '',
            comentario: orderDoc.comentario || '',
            totalAmount: computedTotal || 0,
            shippingCost: orderDoc.shippingCost || 0,
            fileUrl: orderDoc.fileUrl || '',
            fileName: orderDoc.fileName || '',
            invoiceNumber: orderDoc.invoiceNumber || '',
            orderDate: orderDoc.orderDate || undefined,
            lastUpdated: orderDoc.lastUpdated || undefined
          };
        }
        
        // Handle both old and new data structures
        const clientName = orderDoc.name || orderDoc.client?.name || '';
        const clientSurname = orderDoc.surname || orderDoc.client?.surname || '';
        const clientCompanyName = orderDoc.companyName || orderDoc.userName || orderDoc.client?.companyName || '';
        const clientEmail = orderDoc.email || orderDoc.clientEmail || orderDoc.client?.email || '';
        const clientPhone = orderDoc.phone || orderDoc.client?.phone || '';
        const clientAddress = orderDoc.address || orderDoc.client?.address || '';
        const clientCity = orderDoc.city || orderDoc.client?.city || '';
        const clientDepartment = orderDoc.department || orderDoc.client?.department || '';
        const clientPostalCode = orderDoc.postalCode || orderDoc.client?.postalCode || '';
        const clientCedula = orderDoc.identification || orderDoc.client?.identification || orderDoc.client?.cedula || '';
        
        // Debug logging for this specific order
        console.log(`🔍 Order ${orderDoc.id} client data:`, {
          directFields: {
            name: orderDoc.name,
            surname: orderDoc.surname,
            companyName: orderDoc.companyName,
            email: orderDoc.email,
            clientEmail: orderDoc.clientEmail
          },
          extractedFields: {
            clientName,
            clientSurname,
            clientCompanyName,
            clientEmail
          }
        });
        
        // Explicit field mapping based on actual Firestore structure (prefer derived values)
        const finalClientName = clientName || 'N/A';
        const finalClientSurname = clientSurname || 'N/A';
        const finalClientCompanyName = clientCompanyName || 'N/A';
        const finalClientEmail = clientEmail || 'N/A';
        const finalClientPhone = clientPhone || 'N/A';
        const finalClientAddress = clientAddress || 'N/A';
        const finalClientCity = clientCity || 'N/A';
        const finalClientDepartment = clientDepartment || 'N/A';
        const finalClientPostalCode = clientPostalCode || 'N/A';
        const finalClientCedula = clientCedula || 'N/A';
        
        console.log(`🔍 Order ${orderDoc.id} final client data:`, {
          name: finalClientName,
          surname: finalClientSurname,
          companyName: finalClientCompanyName,
          email: finalClientEmail
        });
        
        // Prefer PDF generated datetime parsed from fileName when available
        const fileNameForDate = order.fileName || orderDoc.fileName || '';
        let pdfParsedDate: Date | null = null;
        try {
          const match = fileNameForDate.match(/(\d{2})\.(\d{2})\.(\d{4})_(\d{2})\.(\d{2})/);
          if (match) {
            const [, dd, MM, yyyy, HH, mm] = match;
            pdfParsedDate = new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(HH), Number(mm));
          }
        } catch {}

        // Normalize cart items for admin UI (prefer saved cartItems with nested product)
        const normalizedCartItems = Array.isArray(orderDoc.cartItems) && orderDoc.cartItems.length > 0
          ? orderDoc.cartItems
          : (Array.isArray(order.items) ? order.items.map((it: any) => ({
              product: {
                id: it.productId,
                name: it.productName || 'Producto',
                brand: it.brand || '',
                // Use unitPrice for display; admin reads price1/price
                price1: typeof it.unitPrice === 'number' ? it.unitPrice : 0,
                price: typeof it.unitPrice === 'number' ? it.unitPrice : 0
              },
              quantity: it.quantity || 1,
              selectedColor: it.color || '',
              selectedPrice: it.selectedPrice || undefined
            })) : []);

        return {
          id: orderDoc.id,
          // Provide userName for UI "Empresa" field
          userName: finalClientCompanyName,
          client: {
            name: finalClientName,
            surname: finalClientSurname,
            companyName: finalClientCompanyName,
            email: finalClientEmail,
            phone: finalClientPhone,
            address: finalClientAddress,
            city: finalClientCity,
            department: finalClientDepartment,
            postalCode: finalClientPostalCode,
            cedula: finalClientCedula,
            identification: finalClientCedula
          },
          status: order.status || orderDoc.status || 'new',
          paymentStatus: order.paymentStatus || orderDoc.paymentStatus || 'pending',
          isStarred: orderDoc.metadata?.isStarred || orderDoc.isStarred || false,
          isArchived: orderDoc.metadata?.isArchived || orderDoc.isArchived || false,
          archived: orderDoc.archived ?? orderDoc.metadata?.isArchived ?? false,
          labels: orderDoc.metadata?.labels || orderDoc.labels || [],
          
          // Order items and details
          cartItems: normalizedCartItems,
          orderDetails: order.orderDetails || orderDoc.orderDetails || '',
          comentario: order.comentario || orderDoc.comentario || '',
          
          // Financial information
          totalAmount: (typeof order.totalAmount === 'number' ? order.totalAmount : (orderDoc.totalAmount || 0)),
          shippingCost: (typeof order.shippingCost === 'number' ? order.shippingCost : (orderDoc.shippingCost || 0)),
          
          // Payment information
          paymentMethod: order.paymentMethod || orderDoc.paymentMethod || '',
          wompiTransactionId: order.wompiTransactionId || orderDoc.wompiTransactionId || '',
          pseTransactionId: order.pseTransactionId || orderDoc.pseTransactionId || '',
          
          // Files and documents
          fileUrl: order.fileUrl || orderDoc.fileUrl || '',
          fileName: order.fileName || orderDoc.fileName || '',
          
          // Invoice and order numbers
          invoiceNumber: order.invoiceNumber || orderDoc.invoiceNumber || '',
          orderNumber: order.orderNumber || order.invoiceNumber || orderDoc.orderNumber || orderDoc.invoiceNumber || '',
          
          // Timestamps: prefer PDF-generated date parsed from fileName; avoid defaulting to now
          timestamp: (pdfParsedDate as any) || order.orderDate || orderDoc.orderDate || orderDoc.metadata?.createdAt || null,
          lastUpdated: order.lastUpdated || orderDoc.lastUpdated || orderDoc.metadata?.lastUpdated || null,
          
          // Metadata
          environment: orderDoc.metadata?.environment || 'main',
          source: orderDoc.metadata?.source || 'web',
          isActive: orderDoc.metadata?.isActive || true,
          
          // Tracking information
          trackingNumber: order.trackingNumber || '',
          courier: order.courier || '',
          
          // Additional fields for compatibility
          orderId: order.orderId || order.invoiceNumber,
          pdfUrl: order.fileUrl || ''
        };
      }).filter(order => {
        // Be more permissive to include legacy docs
        const hasValidClient = order.client.name || order.client.companyName || order.client.email;
        const hasSomeOrderInfo = Boolean(
          order.invoiceNumber ||
          (typeof order.totalAmount === 'number' && order.totalAmount >= 0) ||
          (Array.isArray(order.cartItems) && order.cartItems.length > 0) ||
          (order.orderDetails && order.orderDetails.trim() !== '')
        );
        return !!hasValidClient && !!hasSomeOrderInfo;
      });
      
      // Replace the orders array with the transformed version
      orders = transformedOrders;
      
      console.log('🔍 API: After regular orders transformation:', {
        totalOrders: orders.length,
        sampleOrder: orders[0] ? {
          id: orders[0].id,
          customerName: orders[0].client?.name,
          customerEmail: orders[0].client?.email,
          status: orders[0].status,
          totalAmount: orders[0].totalAmount
        } : null
      });
    }
    
    // Sort all orders by PDF/generated timestamp (desc), then by lastUpdated
    const getTimestampMs = (ts: any): number => {
      try {
        if (!ts) return 0;
        if (typeof ts === 'object' && typeof ts.seconds === 'number') {
          return ts.seconds * 1000;
        }
        if (ts instanceof Date) {
          return ts.getTime();
        }
        if (typeof ts === 'string') {
          const d = new Date(ts);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        }
        if (typeof ts === 'number') {
          return ts;
        }
      } catch {}
      return 0;
    };
    orders.sort((a: any, b: any) => {
      const at = getTimestampMs(a.timestamp) || getTimestampMs(a.lastUpdated);
      const bt = getTimestampMs(b.timestamp) || getTimestampMs(b.lastUpdated);
      return bt - at;
    });
    
    return NextResponse.json({
      success: true,
      orders: orders
    });
    
  } catch (error) {
    console.error('🔍 API: Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
} 