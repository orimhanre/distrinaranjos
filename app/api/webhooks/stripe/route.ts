import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { virtualDb } from '../../../../lib/firebase';
import { EmailService } from '../../../../lib/emailService';
import Stripe from 'stripe';

// Initialize Stripe conditionally
let stripe: Stripe | null = null;

if (process.env.VIRTUAL_STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.VIRTUAL_STRIPE_SECRET_KEY, {
      apiVersion: '2025-07-30.basil',
    });
  } catch (error) {
    console.warn('Failed to initialize Stripe:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!stripe) {
      console.error('Stripe not initialized');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;
    
    try {
      const webhookSecret = process.env.VIRTUAL_STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) {
        console.error('Stripe webhook secret not configured');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Invalid Stripe webhook signature:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Stripe webhook received:', event.type);

    // Handle different webhook events
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;
      default:
        console.log('Unhandled Stripe event:', event.type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  if (!orderId) {
    console.error('No order ID found in payment intent metadata');
    return;
  }

    try {
      if (!virtualDb) {
        console.error('Virtual Firebase not configured');
        return;
      }
      
      const orderRef = doc(virtualDb, 'virtualOrders', orderId);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        
        // Update order with payment confirmation
        await updateDoc(orderRef, {
          paymentStatus: 'paid',
          status: 'confirmed',
          paymentConfirmedAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
          stripePaymentData: paymentIntent
        });

        console.log(`Order ${orderId} payment confirmed via Stripe`);
        
        // Send confirmation email to customer
        await sendPaymentConfirmationEmail(orderData);
      } else {
        console.error(`Order ${orderId} not found`);
      }
    } catch (error) {
      console.error('Error updating order payment status:', error);
    }
}

async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId;
  if (!orderId) {
    console.error('No order ID found in payment intent metadata');
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
      stripePaymentIntentId: paymentIntent.id,
      stripePaymentData: paymentIntent
    });
    
    console.log(`Order ${orderId} payment failed via Stripe`);
  } catch (error) {
    console.error('Error updating failed payment status:', error);
  }
}

async function handleChargeSucceeded(charge: Stripe.Charge) {
  const orderId = charge.metadata.orderId;
  if (!orderId) {
    console.error('No order ID found in charge metadata');
    return;
  }

  try {
    if (!virtualDb) {
      console.error('Virtual Firebase not configured');
      return;
    }
    
    const orderRef = doc(virtualDb, 'virtualOrders', orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (orderSnap.exists()) {
      const orderData = orderSnap.data();
      
      // Update order with payment confirmation
      await updateDoc(orderRef, {
        paymentStatus: 'paid',
        status: 'confirmed',
        paymentConfirmedAt: new Date(),
        stripeChargeId: charge.id,
        stripeChargeData: charge
      });

      console.log(`Order ${orderId} payment confirmed via Stripe charge`);
      
      // Send confirmation email to customer
      await sendPaymentConfirmationEmail(orderData);
    } else {
      console.error(`Order ${orderId} not found`);
    }
  } catch (error) {
    console.error('Error updating order payment status:', error);
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
      paymentMethod: 'Tarjeta de Crédito/Débito',
      orderDate: new Date().toLocaleDateString('es-CO'),
      estimatedDelivery: estimatedDelivery.toLocaleDateString('es-CO')
    });
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
  }
} 