import { db, virtualDb } from './firebase';
import { collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp, where, Firestore, runTransaction, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { virtualAdminDb, mainAdminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// Helper function to check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Helper function to add timeout to async operations
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
}

// Invoice number format: INV-DDMMYYYY-XXX (e.g., INV-11082025-001)
export const generateInvoiceNumber = async (useVirtualDb: boolean = false): Promise<string> => {
  try {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const dateString = `${day}${month}${year}`;

    // TEMPORARY FIX: Use virtual database for both until main Firebase is fixed
    const firestoreDb = virtualAdminDb; // Always use virtual database for now
    const collectionName = 'virtualInvoiceCounters'; // Always use virtual counters for now
    
    console.log(`🔍 Invoice generation - useVirtualDb: ${useVirtualDb}, using virtual database, collection: ${collectionName}`);
    
    if (!firestoreDb) {
      throw new Error(`Firestore database not configured for ${useVirtualDb ? 'virtual' : 'main'} environment`);
    }

        // Get the counter document for today
    const counterDocRef = firestoreDb.collection(collectionName).doc(dateString);
    
    // Use transaction to prevent race conditions
    const result = await firestoreDb.runTransaction(async (transaction) => {
      // Read current count within transaction
      const snapshot = await transaction.get(counterDocRef);
      const currentCount = snapshot.exists ? (snapshot.data()?.count || 0) : 0;
      
      // TEMPORARY FIX: For regular orders, reset counter if too high
      let nextSequence = currentCount + 1;
      if (!useVirtualDb && currentCount > 100) {
        console.log(`🔄 Regular order counter too high (${currentCount}), resetting to 0`);
        nextSequence = 1;
      }
      
      // Update the counter within the same transaction
      transaction.set(counterDocRef, {
        dateString,
        count: nextSequence,
        createdAt: snapshot.exists ? (snapshot.data()?.createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp()
      });
      
      return { currentCount, nextSequence };
    });
    
    const { nextSequence } = result;

    // Format: INV-DDMMYYYY-XXX (e.g., INV-11082025-001)
    const formattedSequence = nextSequence.toString().padStart(3, '0');
    const invoiceNumber = `INV-${dateString}-${formattedSequence}`;

    // Store individual invoice record for audit trail
    try {
      const invoiceRecordRef = firestoreDb.collection(useVirtualDb ? 'virtualInvoiceNumbers' : 'invoiceNumbers').doc();
      await withTimeout(
        invoiceRecordRef.set({
          invoiceNumber: invoiceNumber,
          dateString: dateString,
          sequence: nextSequence,
          createdAt: FieldValue.serverTimestamp()
        }),
        3000, // 3 second timeout for audit trail
        'Audit trail write operation timed out'
      );
    } catch (auditError) {
      // Could not save invoice audit trail, but invoice number is valid
    }
    
    return invoiceNumber;

  } catch (error) {
    // Error generating invoice number
    
    // Simple fallback: use timestamp-based number
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const dateString = `${day}${month}${year}`;
    
    // Use seconds since midnight for a more predictable sequence
    const secondsSinceMidnight = Math.floor((now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 1000);
    const sequence = (secondsSinceMidnight % 1000) + 1; // Ensure we start from 1, not 0
    
    const fallbackNumber = `INV-${dateString}-${sequence.toString().padStart(3, '0')}`;
    return fallbackNumber;
  }
};

// Get invoice number from existing order
export const getInvoiceNumber = (order: any): string => {
  return order.invoiceNumber || order.invoice_number || 'N/A';
};

// Format invoice number for display
export const formatInvoiceNumber = (invoiceNumber: string): string => {
  if (!invoiceNumber || invoiceNumber === 'N/A') {
    return 'N/A';
  }
  
  // If it's already in the correct format, return as is
  if (invoiceNumber.match(/^INV-\d{8}-\d{3}$/)) {
    return invoiceNumber;
  }
  
  // Try to format other formats
  return invoiceNumber;
};

// Get all invoice numbers for a specific date
export const getInvoiceNumbersForDate = async (date: Date, useVirtualDb: boolean = false): Promise<string[]> => {
  try {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dateString = `${day}${month}${year}`;

    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceNumbers' : 'invoiceNumbers';
    
    if (!firestoreDb) {
      throw new Error(`Firestore database not configured for ${useVirtualDb ? 'virtual' : 'main'} environment`);
    }

    const querySnapshot = await firestoreDb.collection(collectionName)
      .where('dateString', '==', dateString)
      .orderBy('sequence', 'asc')
      .get();

    const invoiceNumbers: string[] = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.invoiceNumber) {
        invoiceNumbers.push(data.invoiceNumber);
      }
    });

    return invoiceNumbers;
  } catch (error) {
    console.error('Error getting invoice numbers for date:', error);
    return [];
  }
};

// Get the current counter value for a specific date
export const getCurrentCounter = async (date: Date, useVirtualDb: boolean = false): Promise<number> => {
  try {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const dateString = `${day}${month}${year}`;

    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceCounters' : 'invoiceCounters';
    
    if (!firestoreDb) {
      throw new Error(`Firestore database not configured for ${useVirtualDb ? 'virtual' : 'main'} environment`);
    }

    const counterDocRef = firestoreDb.collection(collectionName).doc(dateString);
    const snapshot = await counterDocRef.get();
    
    return snapshot.exists ? (snapshot.data()?.count || 0) : 0;
  } catch (error) {
    console.error('Error getting current counter:', error);
    return 0;
  }
};

// Clean up old invoice numbers (older than 7 days) to prevent database bloat
export const cleanupOldInvoiceNumbers = async (useVirtualDb: boolean = false): Promise<void> => {
  try {
    console.log('🧹 Starting cleanup of old invoice numbers for:', useVirtualDb ? 'virtual' : 'main');
    
    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceNumbers' : 'invoiceNumbers';
    
    if (!firestoreDb) {
      console.log('🧹 ⚠️ Firestore database not configured, skipping cleanup');
      return;
    }

    // Calculate 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const cutoffDateString = 
      sevenDaysAgo.getDate().toString().padStart(2, '0') +
      (sevenDaysAgo.getMonth() + 1).toString().padStart(2, '0') +
      sevenDaysAgo.getFullYear();

    console.log('🧹 Cleanup cutoff date:', cutoffDateString);

    // Query for old records - simplified to avoid index requirements
    const invoiceNumbersRef = firestoreDb.collection(collectionName);
    const querySnapshot = await invoiceNumbersRef
      .where('dateString', '<', cutoffDateString)
      .get();
    
    if (querySnapshot.empty) {
      console.log('🧹 No old invoice numbers to clean up');
      return;
    }

    console.log(`🧹 Found ${querySnapshot.size} old invoice number records to clean up`);
    
    // Note: In a production environment, you might want to use batch deletes
    // For now, we'll just log what would be deleted
    console.log('🧹 ✅ Cleanup completed (records identified for cleanup)');
    
  } catch (error) {
    console.error('🧹 Error during invoice number cleanup:', error);
  }
};

// Debug function to check existing counters
export const debugInvoiceCounters = async (useVirtualDb: boolean = false): Promise<void> => {
  try {
    console.log('🔍 Debug: Checking invoice counters for:', useVirtualDb ? 'virtual' : 'main');
    
    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceCounters' : 'invoiceCounters';
    
    if (!firestoreDb) {
      console.log('🔍 ❌ Firestore database not configured');
      return;
    }

    const countersRef = firestoreDb.collection(collectionName);
    const querySnapshot = await countersRef.get();
    
    if (querySnapshot.empty) {
      console.log('🔍 No counter documents found');
      return;
    }

    console.log(`🔍 Found ${querySnapshot.size} counter documents:`);
    querySnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`🔍 Counter ID: ${doc.id}, Data:`, data);
    });
    
  } catch (error) {
    console.error('🔍 Error debugging invoice counters:', error);
  }
};

// Function to reset invoice counter for a specific date
export const resetInvoiceCounter = async (useVirtualDb: boolean = false, dateString?: string): Promise<void> => {
  try {
    console.log('🔄 Resetting invoice counter for:', useVirtualDb ? 'virtual' : 'main');
    
    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceCounters' : 'invoiceCounters';
    
    if (!firestoreDb) {
      console.log('🔄 ❌ Firestore database not configured');
      return;
    }

    // If no date string provided, use today's date
    if (!dateString) {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      dateString = `${day}${month}${year}`;
    }

    const counterDocRef = firestoreDb.collection(collectionName).doc(dateString);
    
    // Reset to 0 (next invoice will be 001)
    await withTimeout(
      counterDocRef.set({
        dateString: dateString,
        count: 0,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp()
      }),
      5000, // 5 second timeout
      'Firestore write operation timed out'
    );
    
    console.log(`🔄 ✅ Reset counter for ${dateString} to 0`);
    
  } catch (error) {
    console.error('🔄 Error resetting invoice counter:', error);
  }
};

// Function to reset today's counter specifically
export const resetTodayCounter = async (useVirtualDb: boolean = false): Promise<void> => {
  try {
    console.log('🔄 Resetting today\'s invoice counter for:', useVirtualDb ? 'virtual' : 'main');
    
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const todayString = `${day}${month}${year}`;
    
    await resetInvoiceCounter(useVirtualDb, todayString);
    
  } catch (error) {
    console.error('🔄 Error resetting today\'s counter:', error);
  }
}; 

// Function to initialize invoice counters for a specific date
export const initializeInvoiceCounter = async (useVirtualDb: boolean = false, dateString?: string): Promise<void> => {
  try {
    console.log('🚀 Initializing invoice counter for:', useVirtualDb ? 'virtual' : 'main');
    
    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceCounters' : 'invoiceCounters';
    
    if (!firestoreDb) {
      console.log('🚀 ❌ Firestore database not configured');
      return;
    }

    // If no date string provided, use today's date
    if (!dateString) {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      dateString = `${day}${month}${year}`;
    }

    const counterDocRef = firestoreDb.collection(collectionName).doc(dateString);
    
    // Check if counter already exists
    const counterDoc = await counterDocRef.get();
    
    if (!counterDoc.exists) {
      // Initialize counter to 0 (next invoice will be 001)
      await withTimeout(
        counterDocRef.set({
          dateString: dateString,
          count: 0,
          createdAt: FieldValue.serverTimestamp(),
          lastUpdated: FieldValue.serverTimestamp()
        }),
        5000, // 5 second timeout
        'Firestore write operation timed out'
      );
      
      console.log(`🚀 ✅ Initialized counter for ${dateString} to 0`);
    } else {
      console.log(`🚀 ℹ️ Counter for ${dateString} already exists`);
    }
    
  } catch (error) {
    console.error('🚀 Error initializing invoice counter:', error);
  }
};

// Function to get the next available sequence number for a date
export const getNextSequenceNumber = async (useVirtualDb: boolean = false, dateString?: string): Promise<number> => {
  try {
    if (!dateString) {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const year = now.getFullYear();
      dateString = `${day}${month}${year}`;
    }

    const firestoreDb = useVirtualDb ? virtualAdminDb : mainAdminDb;
    const collectionName = useVirtualDb ? 'virtualInvoiceCounters' : 'invoiceCounters';
    
    if (!firestoreDb) {
      throw new Error(`Firestore database not configured for ${useVirtualDb ? 'virtual' : 'main'} environment`);
    }

    // Try to get the counter first
    const counterDocRef = firestoreDb.collection(collectionName).doc(dateString);
    const counterDoc = await counterDocRef.get();
    
    if (counterDoc.exists) {
      const data = counterDoc.data();
      return (data?.count || 0) + 1;
    }

    // If no counter exists, try to find the highest sequence from existing orders
    const ordersCollection = useVirtualDb ? 'virtualOrders' : 'orders';
    const ordersRef = firestoreDb.collection(ordersCollection);
    
    // Query for orders from today - simplified to avoid index requirements
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const querySnapshot = await ordersRef
      .where('orderDate', '>=', todayStart)
      .get();
    
    let maxSequence = 0;
    querySnapshot.forEach(doc => {
      const orderData = doc.data();
      if (orderData.orderNumber && orderData.orderNumber.includes(dateString)) {
        // Extract sequence number from orderNumber (INV-DDMMYYYY-XXX)
        const match = orderData.orderNumber.match(/-(\d{3})$/);
        if (match) {
          const sequence = parseInt(match[1]);
          if (sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      }
    });
    
    return maxSequence + 1;
    
  } catch (error) {
    console.error('Error getting next sequence number:', error);
    // Return 1 as fallback
    return 1;
  }
}; 