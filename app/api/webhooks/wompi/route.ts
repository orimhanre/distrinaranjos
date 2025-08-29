import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';
import { EmailService } from '../../../../lib/emailService';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
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