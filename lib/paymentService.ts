import Stripe from 'stripe';

// Initialize Stripe conditionally
let stripe: Stripe | null = null;

if (process.env.VIRTUAL_STRIPE_SECRET_KEY) {
  try {
    stripe = new Stripe(process.env.VIRTUAL_STRIPE_SECRET_KEY, {
      apiVersion: '2025-08-27.basil',
    });
  } catch (error) {
    console.warn('Failed to initialize Stripe:', error);
  }
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  description: string;
  paymentMethod: 'wompi' | 'stripe' | 'pse' | 'bank_transfer';
}

export interface PaymentResponse {
  success: boolean;
  paymentUrl?: string;
  paymentIntentId?: string;
  transactionId?: string;
  error?: string;
}

export class PaymentService {
  // Wompi Payment Processing
  static async createWompiPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const wompiPublicKey = process.env.VIRTUAL_WOMPI_PUBLIC_KEY;
      const wompiPrivateKey = process.env.VIRTUAL_WOMPI_PRIVATE_KEY;

      if (!wompiPublicKey || !wompiPrivateKey) {
        console.error('Wompi credentials not configured. Please set VIRTUAL_WOMPI_PUBLIC_KEY and VIRTUAL_WOMPI_PRIVATE_KEY');
        return {
          success: false,
          error: 'Wompi payment gateway not configured. Please contact support.'
        };
      }

      // For now, return a mock response since Wompi requires proper setup
      // In production, you would need to:
      // 1. Get acceptance token from Wompi
      // 2. Create proper transaction with valid payment method
      // 3. Handle the actual payment flow
      
      console.log('Wompi payment requested but not fully configured. Returning mock response.');
      
      return {
        success: false,
        error: 'Wompi payment gateway is not fully configured. Please use a different payment method or contact support.'
      };
    } catch (error) {
      console.error('Wompi payment creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Stripe Payment Processing
  static async createStripePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      if (!stripe) {
        return {
          success: false,
          error: 'Stripe payment gateway not configured. Please set VIRTUAL_STRIPE_SECRET_KEY'
        };
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: request.amount * 100, // Convert to cents
        currency: request.currency,
        metadata: {
          orderId: request.orderId,
          customerEmail: request.customerEmail,
          customerName: request.customerName
        },
        description: request.description,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        paymentUrl: paymentIntent.next_action?.redirect_to_url?.url || undefined
      };
    } catch (error) {
      console.error('Stripe payment creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // PSE (Bank Transfer) Payment Processing
  static async createPSEPayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      const pseMerchantId = process.env.VIRTUAL_PSE_MERCHANT_ID;
      const pseApiKey = process.env.VIRTUAL_PSE_API_KEY;

      if (!pseMerchantId || !pseApiKey) {
        throw new Error('PSE credentials not configured');
      }

      // Create PSE payment request
      const paymentData = {
        merchantId: pseMerchantId,
        reference: request.orderId,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        customerEmail: request.customerEmail,
        customerName: request.customerName,
        returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/order-confirmation`,
        cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/checkout`
      };

      // Make API call to PSE
      const response = await fetch('https://api.pse.com.co/v1/payments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${pseApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`PSE API error: ${errorData.error?.message}`);
      }

      const payment = await response.json();

      return {
        success: true,
        paymentUrl: payment.redirectUrl,
        transactionId: payment.transactionId
      };
    } catch (error) {
      console.error('PSE payment creation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Bank Transfer - No immediate payment processing needed
  static async createBankTransferPayment(request: PaymentRequest): Promise<PaymentResponse> {
    // For bank transfer, we just return success
    // The payment will be confirmed when the customer confirms the transfer
    return {
      success: true,
      transactionId: `BANK-${request.orderId}`
    };
  }



  // Main payment processing method
  static async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    switch (request.paymentMethod) {
      case 'wompi':
        return await this.createWompiPayment(request);
      case 'stripe':
        return await this.createStripePayment(request);
      case 'pse':
        return await this.createPSEPayment(request);
      case 'bank_transfer':
        return await this.createBankTransferPayment(request);

      default:
        return {
          success: false,
          error: 'Unsupported payment method'
        };
    }
  }

  // Verify payment status
  static async verifyPaymentStatus(paymentMethod: string, transactionId: string): Promise<boolean> {
    try {
      switch (paymentMethod) {
        case 'wompi':
          return await this.verifyWompiPayment(transactionId);
        case 'stripe':
          return await this.verifyStripePayment(transactionId);
        case 'pse':
          return await this.verifyPSEPayment(transactionId);
        case 'bank_transfer':
          return true; // Always true for bank transfer (confirmed by customer)

        default:
          return false;
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      return false;
    }
  }

  private static async verifyWompiPayment(transactionId: string): Promise<boolean> {
    try {
      const wompiPrivateKey = process.env.VIRTUAL_WOMPI_PRIVATE_KEY;
      
      const response = await fetch(`https://production.wompi.co/v1/transactions/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${wompiPrivateKey}`
        }
      });

      if (!response.ok) return false;

      const transaction = await response.json();
      return transaction.data.status === 'APPROVED';
    } catch (error) {
      console.error('Wompi verification error:', error);
      return false;
    }
  }

  private static async verifyStripePayment(paymentIntentId: string): Promise<boolean> {
    try {
      if (!stripe) {
        console.error('Stripe not initialized');
        return false;
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status === 'succeeded';
    } catch (error) {
      console.error('Stripe verification error:', error);
      return false;
    }
  }

  private static async verifyPSEPayment(transactionId: string): Promise<boolean> {
    try {
      const pseApiKey = process.env.VIRTUAL_PSE_API_KEY;
      
      const response = await fetch(`https://api.pse.com.co/v1/payments/${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${pseApiKey}`
        }
      });

      if (!response.ok) return false;

      const payment = await response.json();
      return payment.status === 'completed';
    } catch (error) {
      console.error('PSE verification error:', error);
      return false;
    }
  }
} 