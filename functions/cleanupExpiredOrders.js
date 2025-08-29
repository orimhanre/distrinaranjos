const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Cloud Function to automatically delete expired orders from deletedOrders collection
 * Runs daily at 2:00 AM UTC
 */
exports.cleanupExpiredOrders = functions.pubsub
  .schedule('0 2 * * *') // Daily at 2:00 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🔄 Starting cleanup of expired orders...');
    
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      console.log(`📅 Current time: ${now.toISOString()}`);
      console.log(`📅 30 days ago: ${thirtyDaysAgo.toISOString()}`);
      
      // Get all documents from deletedOrders collection
      const deletedOrdersSnapshot = await db.collection('deletedOrders').get();
      
      if (deletedOrdersSnapshot.empty) {
        console.log('✅ No deleted orders found');
        return null;
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
          await customerDoc.ref.delete();
          totalDeletedCustomers++;
        } else if (hasExpiredOrders) {
          // Some orders expired, update with remaining valid orders
          console.log(`📝 Updating customer document ${customerDoc.id} (${validOrders.length} orders remaining)`);
          await customerDoc.ref.update({
            orders: validOrders,
            lastUpdated: now.toISOString()
          });
        }
      }
      
      console.log(`✅ Cleanup completed:`);
      console.log(`   - Total expired orders removed: ${totalExpiredOrders}`);
      console.log(`   - Total customer documents deleted: ${totalDeletedCustomers}`);
      
      return {
        success: true,
        expiredOrdersRemoved: totalExpiredOrders,
        customerDocumentsDeleted: totalDeletedCustomers,
        timestamp: now.toISOString()
      };
      
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      throw error;
    }
  });

/**
 * Manual trigger function for testing cleanup
 */
exports.manualCleanupExpiredOrders = functions.https.onRequest(async (req, res) => {
  // Add authentication check
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }
  
  try {
    console.log('🔄 Manual cleanup triggered...');
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    // Get all documents from deletedOrders collection
    const deletedOrdersSnapshot = await db.collection('deletedOrders').get();
    
    if (deletedOrdersSnapshot.empty) {
      res.json({ success: true, message: 'No deleted orders found' });
      return;
    }
    
    let totalExpiredOrders = 0;
    let totalDeletedCustomers = 0;
    
    // Process each customer document
    for (const customerDoc of deletedOrdersSnapshot.docs) {
      const customerData = customerDoc.data();
      const orders = customerData.orders || [];
      
      // Filter out expired orders
      const validOrders = [];
      let hasExpiredOrders = false;
      
      for (const order of orders) {
        const deletedAt = order.deletedAt;
        if (!deletedAt) {
          validOrders.push(order);
          continue;
        }
        
        const deletedDate = new Date(deletedAt);
        if (isNaN(deletedDate.getTime())) {
          validOrders.push(order);
          continue;
        }
        
        // Check if order is expired (older than 30 days)
        if (deletedDate < thirtyDaysAgo) {
          hasExpiredOrders = true;
          totalExpiredOrders++;
        } else {
          validOrders.push(order);
        }
      }
      
      // Update or delete the customer document
      if (validOrders.length === 0) {
        await customerDoc.ref.delete();
        totalDeletedCustomers++;
      } else if (hasExpiredOrders) {
        await customerDoc.ref.update({
          orders: validOrders,
          lastUpdated: now.toISOString()
        });
      }
    }
    
    res.json({
      success: true,
      expiredOrdersRemoved: totalExpiredOrders,
      customerDocumentsDeleted: totalDeletedCustomers,
      timestamp: now.toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during manual cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
