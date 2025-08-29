import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';
import { EmailService } from '../../../../lib/emailService';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-pse-signature');
    
    // Verify webhook signature
    const secret = process.env.VIRTUAL_PSE_WEBHOOK_SECRET;
    if (secret) {
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
      
      if (signature !== expectedSignature) {
        console.error('Invalid PSE webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const data = JSON.parse(body);
    console.log('PSE webhook received:', data);

    // Handle different webhook events
    switch (data.event) {
      case 'payment.completed':
        await handlePaymentCompleted(data);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data);
        break;
      case 'payment.pending':
        await handlePaymentPending(data);
        break;
      default:
        console.log('Unhandled PSE event:', data.event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PSE webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCompleted(data: any) {
  const payment = data.data;
  const orderId = payment.reference || payment.orderId;
  
  if (!orderId) {
    console.error('No order reference found in PSE payment');
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
        pseTransactionId: payment.transactionId,
        psePaymentData: payment,
        bankName: payment.bankName,
        accountNumber: payment.accountNumber,
        lastUpdated: new Date()
      });

      console.log(`Order ${orderId} payment confirmed via PSE`);
      
      // Send confirmation email to customer
      await sendPaymentConfirmationEmail(orderData);
    } else {
      console.error(`Order ${orderId} not found in virtualOrders collection`);
    }
  } catch (error) {
    console.error('Error updating order payment status:', error);
  }
}

async function handlePaymentFailed(data: any) {
  const payment = data.data;
  const orderId = payment.reference || payment.orderId;
  
  if (!orderId) {
    console.error('No order reference found in PSE payment');
    return;
  }

  try {
    if (!virtualDb) {
      console.error('Virtual Firebase not configured');
      return;
    }
    
    const orderRef = doc(virtualDb, 'virtualOrders', orderId);
    await updateDoc(orderRef, {
      paymentStatus: 'failed',
      pseTransactionId: payment.transactionId,
      psePaymentData: payment
    });
    
    console.log(`Order ${orderId} payment failed via PSE`);
  } catch (error) {
    console.error('Error updating failed payment status:', error);
  }
}

async function handlePaymentPending(data: any) {
  const payment = data.data;
  const orderId = payment.reference || payment.orderId;
  
  if (!orderId) {
    console.error('No order reference found in PSE payment');
    return;
  }

  try {
    if (!virtualDb) {
      console.error('Virtual Firebase not configured');
      return;
    }
    
    const orderRef = doc(virtualDb, 'virtualOrders', orderId);
    await updateDoc(orderRef, {
      paymentStatus: 'pending',
      pseTransactionId: payment.transactionId,
      psePaymentData: payment
    });
    
    console.log(`Order ${orderId} payment pending via PSE`);
  } catch (error) {
    console.error('Error updating pending payment status:', error);
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
      paymentMethod: 'Transferencia Bancaria',
      orderDate: new Date().toLocaleDateString('es-CO'),
      estimatedDelivery: estimatedDelivery.toLocaleDateString('es-CO')
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
} 