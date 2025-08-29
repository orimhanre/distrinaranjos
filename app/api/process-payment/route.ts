import { NextRequest, NextResponse } from 'next/server';
import { PaymentService } from '../../../lib/paymentService';

export async function POST(request: NextRequest) {
  try {
    const {
      amount,
      currency,
      orderId,
      customerEmail,
      customerName,
      description,
      paymentMethod
    } = await request.json();

    console.log('Processing payment:', {
      amount,
      currency,
      orderId,
      customerEmail,
      paymentMethod
    });

    // Validate required fields
    if (!amount || !currency || !orderId || !customerEmail || !paymentMethod) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Process payment using PaymentService
    const paymentRequest = {
      amount,
      currency,
      orderId,
      customerEmail,
      customerName,
      description,
      paymentMethod
    };

    const paymentResponse = await PaymentService.processPayment(paymentRequest);

    if (paymentResponse.success) {
      console.log('Payment processed successfully:', paymentResponse);
      return NextResponse.json(paymentResponse);
    } else {
      console.error('Payment processing failed:', paymentResponse.error);
      return NextResponse.json(
        { success: false, error: paymentResponse.error },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 