import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';

export async function POST(request: NextRequest) {
  try {
    if (!virtualDb) {
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual database not available' 
      }, { status: 500 });
    }

    console.log('🔄 Starting sync of missing orders from clients to virtualOrders...');

    // Get all documents from clients collection
    const clientsRef = collection(virtualDb, 'clients');
    const clientsSnapshot = await getDocs(clientsRef);
    
    if (clientsSnapshot.empty) {
      return NextResponse.json({ 
        success: true, 
        message: 'No client documents found',
        migratedCount: 0,
        skippedCount: 0
      });
    }

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let deletedOrdersSkipped = 0;

    // Process each client document
    for (const clientDoc of clientsSnapshot.docs) {
      try {
        const clientData = clientDoc.data();
        const clientEmail = clientDoc.id;
        const clientOrders = clientData.orders || [];

                  console.log(`🔍 Processing client ${clientEmail} with ${clientOrders.length} orders`);

        if (clientOrders.length === 0) {
          skippedCount++;
          continue;
        }

        // Check if this client exists in virtualOrders collection
        const virtualOrderRef = doc(virtualDb, 'virtualOrders', clientEmail);
        const virtualOrderDoc = await getDoc(virtualOrderRef);

        if (virtualOrderDoc.exists()) {
          // Client exists in virtualOrders, check for missing orders
          const virtualOrderData = virtualOrderDoc.data();
          const virtualOrders = virtualOrderData.orders || [];
          
          // Find orders that exist in clients but not in virtualOrders
          // BUT only sync orders that are NOT marked as deleted in clients collection
          const missingOrders = clientOrders.filter((clientOrder: any) => {
            const clientOrderNumber = clientOrder.orderNumber || clientOrder.invoiceNumber;
            const isDeletedInClient = clientOrder.isDeleted === true;
            
            // Don't sync if order is marked as deleted in clients collection
            if (isDeletedInClient) {
              console.log(`⏭️ Skipping deleted order ${clientOrderNumber} from client ${clientEmail}`);
              deletedOrdersSkipped++;
              return false;
            }
            
            const existsInVirtual = virtualOrders.some((virtualOrder: any) => 
              (virtualOrder.orderNumber || virtualOrder.invoiceNumber) === clientOrderNumber
            );
            
            return !existsInVirtual;
          });

          if (missingOrders.length > 0) {
            console.log(`📝 Found ${missingOrders.length} missing orders for client ${clientEmail}`);
            
            // Add missing orders to virtualOrders
            const updatedVirtualOrders = [...virtualOrders, ...missingOrders];
            
            await updateDoc(virtualOrderRef, {
              orders: updatedVirtualOrders,
              lastUpdated: serverTimestamp()
            });

            migratedCount += missingOrders.length;
            console.log(`✅ Migrated ${missingOrders.length} orders for client ${clientEmail}`);
          } else {
            skippedCount++;
            console.log(`⏭️ No missing orders for client ${clientEmail}`);
          }
        } else {
          // Client doesn't exist in virtualOrders, create new document
          // BUT only include non-deleted orders
          const nonDeletedOrders = clientOrders.filter((clientOrder: any) => {
            const isDeletedInClient = clientOrder.isDeleted === true;
            if (isDeletedInClient) {
              console.log(`⏭️ Skipping deleted order ${clientOrder.orderNumber || clientOrder.invoiceNumber} from new client ${clientEmail}`);
              deletedOrdersSkipped++;
              return false;
            }
            return true;
          });

          if (nonDeletedOrders.length === 0) {
            console.log(`⏭️ All orders for client ${clientEmail} are deleted, skipping client creation`);
            skippedCount++;
            continue;
          }

          console.log(`📝 Creating new virtualOrders document for client ${clientEmail} with ${nonDeletedOrders.length} non-deleted orders`);
          
          const virtualOrderData = {
            id: clientEmail,
            client: {
              name: clientData.firstName || clientData.nombre || clientData.name || '',
              surname: clientData.lastName || clientData.apellido || clientData.surname || '',
              companyName: clientData.companyName || clientData.empresa || '',
              email: clientEmail,
              phone: clientData.phone || clientData.celular || clientData.telefono || '',
              address: clientData.address || clientData.direccion || '',
              city: clientData.city || clientData.ciudad || '',
              department: clientData.department || clientData.departamento || '',
              postalCode: clientData.postalCode || clientData.codigoPostal || '',
              cedula: clientData.cedula || clientData.identification || ''
            },
            orders: nonDeletedOrders,
            userAuth: {
              email: clientEmail,
              displayName: `${clientData.firstName || ''} ${clientData.lastName || ''}`.trim()
            },
            clientEmail: clientEmail,
            metadata: {
              environment: 'virtual',
              source: 'web',
              isActive: true
            },
            createdAt: clientData.createdAt || serverTimestamp(),
            lastUpdated: serverTimestamp()
          };

          await setDoc(virtualOrderRef, virtualOrderData);
          migratedCount += nonDeletedOrders.length;
          console.log(`✅ Created virtualOrders document with ${nonDeletedOrders.length} orders for client ${clientEmail}`);
        }

      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing client ${clientDoc.id}:`, error);
      }
    }

    console.log('✅ Sync completed:', {
      migratedCount,
      skippedCount,
      deletedOrdersSkipped,
      errorCount
    });

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      migratedCount,
      skippedCount,
      deletedOrdersSkipped,
      errorCount
    });

  } catch (error) {
    console.error('❌ Sync failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Sync failed' 
    }, { status: 500 });
  }
}
