import { NextRequest, NextResponse } from 'next/server';
export async function POST(request: NextRequest) {
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
    const { virtualDb } = await import('../../../../lib/firebase');
  try {
    console.log('🔄 Starting migration from clients to virtualOrders collection...');
    
    if (!virtualDb) {
      return NextResponse.json(
        { success: false, error: 'Virtual Firebase not configured' },
        { status: 500 }
      );
    }

    // Get all documents from clients collection
    const clientsRef = collection(virtualDb, 'clients');
    const clientsSnapshot = await getDocs(clientsRef);
    
    console.log(`🔍 Found ${clientsSnapshot.size} documents in clients collection`);
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const clientDoc of clientsSnapshot.docs) {
      try {
        const clientData = clientDoc.data();
        
        // Check if this document contains order data (has items, totalAmount, etc.)
        if (clientData.items && Array.isArray(clientData.items) && clientData.items.length > 0) {
          console.log(`🔄 Migrating order data for client: ${clientDoc.id}`);
          
          // Create order document in virtualOrders collection
          const orderData = {
            id: clientDoc.id,
            clientEmail: clientData.email || clientData.correo || clientDoc.id,
            client: {
              name: clientData.nombre || clientData.firstName || clientData.name || '',
              surname: clientData.apellido || clientData.lastName || clientData.surname || '',
              companyName: clientData.empresa || clientData.company || clientData.companyName || '',
              email: clientData.email || clientData.correo || clientDoc.id,
              phone: clientData.telefono || clientData.phone || clientData.celular || '',
              address: clientData.direccion || clientData.address || '',
              city: clientData.ciudad || clientData.city || '',
              department: clientData.departamento || clientData.department || '',
              cedula: clientData.cedula || '',
              postalCode: clientData.codigoPostal || clientData.postalCode || ''
            },
            items: clientData.items || [],
            totalAmount: clientData.totalAmount || 0,
            status: clientData.status || 'pending',
            paymentStatus: clientData.paymentStatus || 'pending',
            shippingAddress: clientData.direccion || clientData.address || clientData.shippingAddress || '',
            orderDate: clientData.orderDate || clientData.timestamp || clientData.createdAt || new Date().toISOString(),
            invoiceNumber: clientData.invoiceNumber || 'N/A',
            notes: clientData.notes || clientData.comentario || '',
            fileName: clientData.fileName || '',
            fileUrl: clientData.fileUrl || '',
            orderDetails: clientData.orderDetails || '',
            createdAt: clientData.createdAt || new Date(),
            lastUpdated: new Date()
          };
          
          // Add to virtualOrders collection
          await addDoc(collection(virtualDb, 'virtualOrders'), orderData);
          
          // Remove order-related fields from clients collection, keeping only profile data
          const profileData = {
            correo: clientData.correo || clientData.email || clientDoc.id,
            nombre: clientData.nombre || clientData.firstName || clientData.name || '',
            apellido: clientData.apellido || clientData.lastName || clientData.surname || '',
            celular: clientData.celular || clientData.telefono || clientData.phone || '',
            cedula: clientData.cedula || '',
            direccion: clientData.direccion || clientData.address || '',
            ciudad: clientData.ciudad || clientData.city || '',
            departamento: clientData.departamento || clientData.department || '',
            codigoPostal: clientData.codigoPostal || clientData.postalCode || '',
            createdAt: clientData.createdAt || new Date(),
            lastLogin: clientData.lastLogin || new Date(),
            isActive: clientData.isActive !== false
          };
          
          // Update the clients document to only contain profile data
          await deleteDoc(doc(virtualDb, 'clients', clientDoc.id));
          await addDoc(collection(virtualDb, 'clients'), profileData);
          
          migratedCount++;
          console.log(`✅ Successfully migrated order for client: ${clientDoc.id}`);
        } else {
          // This is just a profile document, skip migration
          skippedCount++;
          console.log(`⏭️ Skipping profile-only document: ${clientDoc.id}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating client ${clientDoc.id}:`, error);
      }
    }
    
    // Also migrate any existing deletedOrders to use the new structure
    console.log('🔄 Migrating existing deletedOrders to new structure...');
    const deletedOrdersRef = collection(virtualDb, 'deletedOrders');
    const deletedOrdersSnapshot = await getDocs(deletedOrdersRef);
    
    let deletedOrdersMigrated = 0;
    
    for (const deletedOrderDoc of deletedOrdersSnapshot.docs) {
      try {
        const deletedOrderData = deletedOrderDoc.data();
        
        // Check if this deletedOrder needs migration (has old structure)
        if (deletedOrderData.originalCollections && deletedOrderData.originalCollections.clientProfile === 'clients') {
          console.log(`🔄 Migrating deletedOrder: ${deletedOrderDoc.id}`);
          
          // Get updated client profile from clients collection
          let clientProfile = null;
          try {
            const clientEmail = deletedOrderData.client?.email || deletedOrderDoc.id;
            const clientDoc = await getDoc(doc(virtualDb, 'clients', clientEmail));
            if (clientDoc.exists()) {
              clientProfile = clientDoc.data();
            }
          } catch (error) {
            console.log(`⚠️ Could not fetch client profile for deletedOrder ${deletedOrderDoc.id}:`, error);
          }
          
          // Update the deletedOrder with new structure
          const updatedDeletedOrder = {
            ...deletedOrderData,
            client: clientProfile ? {
              name: clientProfile.nombre || clientProfile.firstName || clientProfile.name || '',
              surname: clientProfile.apellido || clientProfile.lastName || clientProfile.surname || '',
              companyName: clientProfile.empresa || clientProfile.company || clientProfile.companyName || '',
              email: clientProfile.correo || clientProfile.email || deletedOrderDoc.id,
              phone: clientProfile.celular || clientProfile.telefono || clientProfile.phone || '',
              address: clientProfile.direccion || clientProfile.address || '',
              city: clientProfile.ciudad || clientProfile.city || '',
              department: clientProfile.departamento || clientProfile.department || '',
              cedula: clientProfile.cedula || '',
              postalCode: clientProfile.codigoPostal || clientProfile.postalCode || ''
            } : deletedOrderData.client,
            originalCollections: {
              clientProfile: clientProfile ? 'clients' : null,
              orderData: 'virtualOrders'
            }
          };
          
          // Update the deletedOrder document - preserve the original ID
          await deleteDoc(doc(virtualDb, 'deletedOrders', deletedOrderDoc.id));
          await setDoc(doc(virtualDb, 'deletedOrders', deletedOrderDoc.id), updatedDeletedOrder);
          
          deletedOrdersMigrated++;
          console.log(`✅ Successfully migrated deletedOrder: ${deletedOrderDoc.id}`);
        }
      } catch (error) {
        console.error(`❌ Error migrating deletedOrder ${deletedOrderDoc.id}:`, error);
      }
    }
    
    console.log('🔄 Migration completed');
    console.log(`✅ Migrated: ${migratedCount} orders`);
    console.log(`✅ Migrated: ${deletedOrdersMigrated} deletedOrders`);
    console.log(`⏭️ Skipped: ${skippedCount} profiles`);
    console.log(`❌ Errors: ${errorCount}`);
    
    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      summary: {
        migrated: migratedCount,
        deletedOrdersMigrated: deletedOrdersMigrated,
        skipped: skippedCount,
        errors: errorCount,
        total: clientsSnapshot.size
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Also support GET for manual triggering
export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/admin/migrate-to-virtual-orders'));
}
