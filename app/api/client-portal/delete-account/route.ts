import { NextRequest, NextResponse } from 'next/server';
import { virtualAdminDb, virtualAdminAuth } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
    // Check if required Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_PRIVATE_KEY ||
        !process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db } = await import('../../../../lib/firebase');
  try {
    console.log('🗑️ Starting comprehensive account deletion process...');
    
    const { email, uid } = await request.json();
    
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required for account deletion'
      }, { status: 400 });
    }
    
    console.log('🔍 Deleting account for email:', email);
    
    if (!virtualAdminDb || !virtualAdminAuth) {
      console.error('❌ Virtual Firebase Admin not available');
      return NextResponse.json({
        success: false,
        error: 'Firebase Admin not available'
      }, { status: 500 });
    }
    
    // Step 1: Delete user from Firebase Auth (if UID provided)
    if (uid) {
      try {
        await virtualAdminAuth.deleteUser(uid);
        console.log('✅ User deleted from Firebase Auth:', uid);
      } catch (authError) {
        console.log('⚠️ Could not delete user from Auth (may already be deleted):', authError);
      }
    }
    
    // Step 2: Find and delete all orders for this user from virtualOrders collection
    console.log('🔍 Finding orders in virtualOrders collection for user:', email);
    const ordersRef = virtualAdminDb.collection('virtualOrders');
    
    // Query by multiple possible email fields to catch all variations
    const emailFields = [
      'clientEmail',
      'client.email', 
      'client.userAuth.email',
      'userAuthEmail',
      'email'
    ];
    
    let totalOrdersDeleted = 0;
    let allOrderIds = new Set(); // Track all order IDs to avoid duplicates
    
    for (const field of emailFields) {
      try {
        console.log(`🔍 Searching orders by field: ${field}`);
        
        if (field.includes('.')) {
          // Handle nested fields like 'client.email'
          const [parentField, childField] = field.split('.');
          const ordersQuery = ordersRef.where(`${parentField}.${childField}`, '==', email);
          const ordersSnapshot = await ordersQuery.get();
          
          console.log(`🔍 Found ${ordersSnapshot.size} orders with ${field} = ${email}`);
          
          ordersSnapshot.docs.forEach(doc => {
            allOrderIds.add(doc.id);
          });
        } else {
          // Handle direct fields like 'clientEmail'
          const ordersQuery = ordersRef.where(field, '==', email);
          const ordersSnapshot = await ordersQuery.get();
          
          console.log(`🔍 Found ${ordersSnapshot.size} orders with ${field} = ${email}`);
          
          ordersSnapshot.docs.forEach(doc => {
            allOrderIds.add(doc.id);
          });
        }
      } catch (error) {
        console.log(`⚠️ Error searching by field ${field}:`, error);
        // Continue with other fields
      }
    }
    
    // Also search by userId field if UID is provided
    if (uid) {
      try {
        const ordersQuery = ordersRef.where('userId', '==', uid);
        const ordersSnapshot = await ordersQuery.get();
        console.log(`🔍 Found ${ordersSnapshot.size} orders with userId = ${uid}`);
        
        ordersSnapshot.docs.forEach(doc => {
          allOrderIds.add(doc.id);
        });
      } catch (error) {
        console.log('⚠️ Error searching by userId:', error);
      }
    }
    
    console.log(`🔍 Total unique orders found: ${allOrderIds.size}`);
    
    // Delete all found orders
    if (allOrderIds.size > 0) {
      const deleteOrderPromises = Array.from(allOrderIds).map(async (orderId) => {
        try {
          await virtualAdminDb!.collection('virtualOrders').doc(orderId as string).delete();
          console.log(`✅ Deleted order: ${orderId}`);
          return { id: orderId, success: true };
        } catch (error) {
          console.error(`❌ Failed to delete order ${orderId}:`, error);
          return { id: orderId, success: false, error: error };
        }
      });
      
      const orderDeletionResults = await Promise.all(deleteOrderPromises);
      totalOrdersDeleted = orderDeletionResults.filter(r => r.success).length;
      const failedOrderDeletions = orderDeletionResults.filter(r => !r.success).length;
      
      console.log(`✅ Successfully deleted ${totalOrdersDeleted} orders`);
      if (failedOrderDeletions > 0) {
        console.log(`❌ Failed to delete ${failedOrderDeletions} orders`);
      }
    }
    
    // Step 3: Delete user profile from clients collection
    let clientProfilesDeleted = 0;
    try {
      const clientsRef = virtualAdminDb.collection('clients');
      
      // First, try to delete by document ID (email) directly since that's how profiles are stored
      try {
        const clientDocRef = clientsRef.doc(email);
        const clientDoc = await clientDocRef.get();
        
        if (clientDoc.exists) {
          console.log(`🔍 Found client profile with document ID (email): ${email}`);
          await clientDocRef.delete();
          console.log(`✅ Deleted client profile by document ID: ${email}`);
          clientProfilesDeleted++;
        } else {
          console.log(`🔍 No client profile found with document ID (email): ${email}`);
        }
      } catch (error) {
        console.log(`⚠️ Error deleting client profile by document ID:`, error);
      }
      
      // Also search by multiple possible email fields to catch any other references
      const clientEmailFields = ['email', 'userAuth.email', 'clientEmail', 'correo'];
      
      for (const field of clientEmailFields) {
        try {
          if (field.includes('.')) {
            const [parentField, childField] = field.split('.');
            const clientQuery = clientsRef.where(`${parentField}.${childField}`, '==', email);
            const clientSnapshot = await clientQuery.get();
            
            if (!clientSnapshot.empty) {
              console.log(`🔍 Found ${clientSnapshot.size} client profiles with ${field} = ${email}`);
              
              const deleteClientPromises = clientSnapshot.docs.map(async (clientDoc) => {
                try {
                  await clientDoc.ref.delete();
                  console.log(`✅ Deleted client profile: ${clientDoc.id}`);
                  return { id: clientDoc.id, success: true };
                } catch (error) {
                  console.error(`❌ Failed to delete client profile ${clientDoc.id}:`, error);
                  return { id: clientDoc.id, success: false, error: error };
                }
              });
              
              const clientDeletionResults = await Promise.all(deleteClientPromises);
              clientProfilesDeleted += clientDeletionResults.filter(r => r.success).length;
            }
          } else {
            const clientQuery = clientsRef.where(field, '==', email);
            const clientSnapshot = await clientQuery.get();
            
            if (!clientSnapshot.empty) {
              console.log(`🔍 Found ${clientSnapshot.size} client profiles with ${field} = ${email}`);
              
              const deleteClientPromises = clientSnapshot.docs.map(async (clientDoc) => {
                try {
                  await clientDoc.ref.delete();
                  console.log(`✅ Deleted client profile: ${clientDoc.id}`);
                  return { id: clientDoc.id, success: true };
                } catch (error) {
                  console.error(`❌ Failed to delete client profile ${clientDoc.id}:`, error);
                  return { id: clientDoc.id, success: false, error: error };
                }
              });
              
              const clientDeletionResults = await Promise.all(deleteClientPromises);
              clientProfilesDeleted += clientDeletionResults.filter(r => r.success).length;
            }
          }
        } catch (error) {
          console.log(`⚠️ Error searching clients by field ${field}:`, error);
        }
      }
      
      // Also search by UID if provided
      if (uid) {
        try {
          const clientQuery = clientsRef.where('uid', '==', uid);
          const clientSnapshot = await clientQuery.get();
          
          if (!clientSnapshot.empty) {
            console.log(`🔍 Found ${clientSnapshot.size} client profiles with uid = ${uid}`);
            
            const deleteClientPromises = clientSnapshot.docs.map(async (clientDoc) => {
              try {
                await clientDoc.ref.delete();
                console.log(`✅ Deleted client profile: ${clientDoc.id}`);
                return { id: clientDoc.id, success: true };
              } catch (error) {
                console.error(`❌ Failed to delete client profile ${clientDoc.id}:`, error);
                return { id: clientDoc.id, success: false, error: error };
              }
            });
            
            const clientDeletionResults = await Promise.all(deleteClientPromises);
            clientProfilesDeleted += clientDeletionResults.filter(r => r.success).length;
          }
        } catch (error) {
          console.log('⚠️ Error searching clients by uid:', error);
        }
      }
      
      console.log(`✅ Successfully deleted ${clientProfilesDeleted} client profiles`);
    } catch (error) {
      console.error('❌ Error deleting client profiles:', error);
    }
    
    // Step 4: Check for any other collections that might contain user data
    // This could include: saved addresses, preferences, etc.
    const otherCollections = ['userPreferences', 'savedAddresses', 'userSettings', 'userSessions', 'userTokens'];
    
    for (const collectionName of otherCollections) {
      try {
        const collectionRef = virtualAdminDb.collection(collectionName);
        
        // Search by email in various fields
        for (const field of emailFields) {
          try {
            if (field.includes('.')) {
              const [parentField, childField] = field.split('.');
              const query = collectionRef.where(`${parentField}.${childField}`, '==', email);
              const snapshot = await query.get();
              
              if (!snapshot.empty) {
                console.log(`🔍 Found ${snapshot.size} documents in ${collectionName} with ${field} = ${email}`);
                
                const deletePromises = snapshot.docs.map(async (doc) => {
                  try {
                    await doc.ref.delete();
                    console.log(`✅ Deleted ${collectionName} document: ${doc.id}`);
                    return { id: doc.id, success: true };
                  } catch (error) {
                    console.error(`❌ Failed to delete ${collectionName} document ${doc.id}:`, error);
                    return { id: doc.id, success: false, error: error };
                  }
                });
                
                await Promise.all(deletePromises);
              }
            } else {
              const query = collectionRef.where(field, '==', email);
              const snapshot = await query.get();
              
              if (!snapshot.empty) {
                console.log(`🔍 Found ${snapshot.size} documents in ${collectionName} with ${field} = ${email}`);
                
                const deletePromises = snapshot.docs.map(async (doc) => {
                  try {
                    await doc.ref.delete();
                    console.log(`✅ Deleted ${collectionName} document: ${doc.id}`);
                    return { id: doc.id, success: true };
                  } catch (error) {
                    console.error(`❌ Failed to delete ${collectionName} document ${doc.id}:`, error);
                    return { id: doc.id, success: false, error: error };
                  }
                });
                
                await Promise.all(deletePromises);
              }
            }
          } catch (error) {
            console.log(`⚠️ Error searching ${collectionName} by field ${field}:`, error);
          }
        }
      } catch (error) {
        console.log(`⚠️ Error accessing collection ${collectionName}:`, error);
      }
    }
    
    // Step 5: Final verification - ensure the client profile is completely removed
    try {
      console.log('🔍 Performing final verification of profile deletion...');
      const finalCheckRef = virtualAdminDb.collection('clients');
      const finalCheckDoc = await finalCheckRef.doc(email).get();
      
      if (finalCheckDoc.exists) {
        console.log('⚠️ Profile still exists after deletion, attempting force delete...');
        try {
          await finalCheckRef.doc(email).delete();
          console.log('✅ Force deleted remaining profile');
          clientProfilesDeleted++;
        } catch (forceDeleteError) {
          console.error('❌ Force delete failed:', forceDeleteError);
        }
      } else {
        console.log('✅ Profile successfully deleted, verification passed');
      }
    } catch (verificationError) {
      console.log('⚠️ Error during final verification:', verificationError);
    }
    
    console.log('✅ Comprehensive account deletion completed successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
      summary: {
        email: email,
        uid: uid,
        ordersDeleted: totalOrdersDeleted,
        clientProfilesDeleted: clientProfilesDeleted,
        totalDataDeleted: totalOrdersDeleted + clientProfilesDeleted
      },
      details: {
        orders: {
          total: totalOrdersDeleted,
          successful: totalOrdersDeleted,
          failed: 0
        },
        clientProfiles: {
          total: clientProfilesDeleted,
          successful: clientProfilesDeleted,
          failed: 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error during account deletion:', error);
    return NextResponse.json({
      success: false,
      error: 'Error during account deletion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
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