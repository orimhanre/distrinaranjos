import { NextRequest, NextResponse } from 'next/server';
import { EmailService } from '../../../../lib/emailService';
import crypto from 'crypto';
import { collection, doc, getDoc, updateDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';

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
    const body = await request.text();
    const signature = request.headers.get('x-wompi-signature');
    
    // Verify webhook signature
    const secret = process.env.VIRTUAL_WOMPI_WEBHOOK_SECRET;
    if (secret) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid Wompi webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const data = JSON.parse(body);
    console.log('Wompi webhook received:', data);

    // Handle different webhook events
    switch (data.event) {
      case 'transaction.updated':
        await handleTransactionUpdate(data);
        break;
      case 'transaction.created':
        await handleTransactionCreated(data);
        break;
      default:
        console.log('Unhandled Wompi event:', data.event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Wompi webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleTransactionUpdate(data: any) {
  const transaction = data.data;
  
  if (transaction.status === 'APPROVED') {
    // Find order by transaction reference
    const orderId = transaction.reference;
    if (!orderId) {
      console.error('No order reference found in transaction');
      return;
    }

    try {
      if (!virtualDb) {
        console.error('Virtual Firebase not configured');
        return;
      }
      
      // Look for order in virtualOrders collection
      const virtualOrdersRef = collection(virtualDb, 'virtualOrders');
      const q = query(virtualOrdersRef, where('invoiceNumber', '==', orderId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        const orderData = orderDoc.data();
        
        // Update order with payment confirmation
        await updateDoc(doc(virtualDb, 'virtualOrders', orderDoc.id), {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentConfirmedAt: new Date(),
          wompiTransactionId: transaction.id,
          wompiTransactionData: transaction,
          lastUpdated: new Date()
        });

        console.log(`Order ${orderId} payment confirmed via Wompi`);
        
        // Send confirmation email to customer
        await sendPaymentConfirmationEmail(orderData);
      } else {
        console.error(`Order ${orderId} not found in virtualOrders collection`);
      }
    } catch (error) {
      console.error('Error updating order payment status:', error);
    }
  } else if (transaction.status === 'DECLINED') {
    // Handle failed payment
    const orderId = transaction.reference;
    if (orderId && virtualDb) {
      try {
        // Look for order in virtualOrders collection
        const virtualOrdersRef = collection(virtualDb, 'virtualOrders');
        const q = query(virtualOrdersRef, where('invoiceNumber', '==', orderId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const orderDoc = querySnapshot.docs[0];
          await updateDoc(doc(virtualDb, 'virtualOrders', orderDoc.id), {
            paymentStatus: 'failed',
            wompiTransactionId: transaction.id,
            wompiTransactionData: transaction,
            lastUpdated: new Date()
          });
          
          console.log(`Order ${orderId} payment failed via Wompi`);
        }
      } catch (error) {
        console.error('Error updating failed payment status:', error);
      }
    }
  }
}

async function handleTransactionCreated(data: any) {
  const transaction = data.data;
  const orderId = transaction.reference;
  
  if (orderId && virtualDb) {
    try {
      // Look for order in virtualOrders collection
      const virtualOrdersRef = collection(virtualDb, 'virtualOrders');
      const q = query(virtualOrdersRef, where('invoiceNumber', '==', orderId));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const orderDoc = querySnapshot.docs[0];
        await updateDoc(doc(virtualDb, 'virtualOrders', orderDoc.id), {
          wompiTransactionId: transaction.id,
          wompiTransactionData: transaction,
          lastUpdated: new Date()
        });
        
        console.log(`Wompi transaction created for order ${orderId}`);
      }
    } catch (error) {
      console.error('Error updating order with transaction ID:', error);
    }
  }
}

async function sendPaymentConfirmationEmail(orderData: any) {
  try {
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

    await EmailService.sendPaymentConfirmationEmail({
      customerName: orderData.client?.name || orderData.client?.companyName || 'Cliente',
      customerEmail: orderData.client?.email || orderData.email || '',
      orderId: orderData.id || '',
      orderNumber: orderData.invoiceNumber || orderData.id || '',
      totalAmount: orderData.totalAmount || 0,
      paymentMethod: 'Wompi',
      orderDate: new Date().toLocaleDateString('es-CO'),
      estimatedDelivery: estimatedDelivery.toLocaleDateString('es-CO')
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
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