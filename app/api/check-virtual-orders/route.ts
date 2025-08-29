import { NextResponse } from 'next/server';
import { virtualAdminDb } from '@/lib/firebaseAdmin';

export async function GET() {
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
    const { db } = await import('../lib/firebase');
  try {
    console.log('🔍 Checking virtual orders for invoice number patterns...');
    
    if (!virtualAdminDb) {
      console.error('❌ Virtual admin database not available');
      return NextResponse.json({
        success: false,
        error: 'Virtual admin database not available',
        virtualAdminDb: false
      });
    }
    
    console.log('✅ Virtual admin database is available');
    
    // Get all orders from virtualOrders collection
    const ordersRef = virtualAdminDb.collection('virtualOrders');
    const querySnapshot = await ordersRef.get();
    
    if (querySnapshot.empty) {
      console.log('ℹ️ No virtual orders found');
      return NextResponse.json({
        success: true,
        message: 'No virtual orders found',
        orderCount: 0,
        orders: []
      });
    }
    
    console.log(`🔍 Found ${querySnapshot.size} virtual orders`);
    
    const orders = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        orderNumber: data.orderNumber || 'N/A',
        orderDate: data.orderDate || data.timestamp || 'N/A',
        clientName: data.client?.name || data.client?.companyName || 'N/A',
        status: data.status || 'N/A'
      };
    });
    
    // Analyze invoice number patterns
    const invoiceNumberAnalysis = orders.map(order => {
      const orderNumber = order.orderNumber;
      if (orderNumber === 'N/A') {
        return { ...order, pattern: 'No invoice number', isValid: false };
      }
      
      // Check if it follows the pattern INV-DDMMYYYY-XXX
      const pattern = /^INV-(\d{8})-(\d{3})$/;
      const match = orderNumber.match(pattern);
      
      if (match) {
        const dateString = match[1];
        const sequence = match[2];
        
        // Check if date is reasonable (not too far in past/future)
        const year = parseInt(dateString.substring(4, 8));
        const month = parseInt(dateString.substring(2, 4));
        const day = parseInt(dateString.substring(0, 2));
        
        const orderDate = new Date(year, month - 1, day);
        const now = new Date();
        const daysDiff = Math.abs((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff > 365) {
          return { ...order, pattern: 'Invalid date (too far in past/future)', isValid: false };
        }
        
        return { ...order, pattern: 'Valid format', isValid: true, date: orderDate, sequence: parseInt(sequence) };
      } else {
        return { ...order, pattern: 'Invalid format', isValid: false };
      }
    });
    
    // Group by date to check sequence patterns
    const ordersByDate: { [key: string]: any[] } = {};
    invoiceNumberAnalysis.forEach(order => {
      if (order.isValid && 'date' in order && order.date) {
        const dateKey = order.date.toISOString().split('T')[0];
        if (!ordersByDate[dateKey]) {
          ordersByDate[dateKey] = [];
        }
        ordersByDate[dateKey].push(order);
      }
    });
    
    // Check sequence patterns for each date
    const sequenceAnalysis = Object.entries(ordersByDate).map(([date, dateOrders]) => {
      const sortedOrders = dateOrders.sort((a, b) => a.sequence - b.sequence);
      const sequences = sortedOrders.map(o => o.sequence);
      
      // Check if sequences are sequential
      let isSequential = true;
      let missingSequences: number[] = [];
      
      for (let i = sequences[0]; i <= sequences[sequences.length - 1]; i++) {
        if (!sequences.includes(i)) {
          missingSequences.push(i);
          isSequential = false;
        }
      }
      
      return {
        date,
        orderCount: dateOrders.length,
        sequences,
        isSequential,
        missingSequences,
        orders: dateOrders
      };
    });
    
    // Summary statistics
    const totalOrders = orders.length;
    const validOrders = invoiceNumberAnalysis.filter(o => o.isValid).length;
    const invalidOrders = totalOrders - validOrders;
    const sequentialDates = sequenceAnalysis.filter(d => d.isSequential).length;
    const nonSequentialDates = sequenceAnalysis.length - sequentialDates;
    
    return NextResponse.json({
      success: true,
      message: 'Virtual orders analysis completed',
      summary: {
        totalOrders,
        validOrders,
        invalidOrders,
        sequentialDates,
        nonSequentialDates
      },
      orders: invoiceNumberAnalysis,
      sequenceAnalysis,
      recommendations: invalidOrders > 0 ? [
        'Some orders have invalid invoice number formats',
        'Consider regenerating invoice numbers for invalid orders',
        'Ensure all new orders use the sequential numbering system'
      ] : [
        'All orders have valid invoice number formats',
        'Sequential numbering is working correctly'
      ]
    });
    
  } catch (error) {
    console.error('❌ Error checking virtual orders:', error);
    return NextResponse.json({
      success: false,
      error: 'Error checking virtual orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
