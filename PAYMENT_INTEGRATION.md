# Payment Gateway Integration

## Overview

The QuickOrder Web system now includes complete payment gateway integration for multiple payment methods. The system automatically updates order status from "Pendiente" to "Confirmado" when payments are successfully processed.

## Supported Payment Methods

### 1. Wompi (Digital Payment)
- **Type**: Digital payment platform
- **Countries**: Colombia
- **Features**: 
  - Credit/Debit card processing
  - Digital wallet support
  - Real-time payment confirmation
  - Automatic order status updates

### 2. Stripe (Credit/Debit Cards)
- **Type**: International payment processor
- **Countries**: Worldwide
- **Features**:
  - Visa, Mastercard, American Express support
  - Secure payment processing
  - Webhook-based confirmation
  - Automatic order status updates

### 3. PSE (Bank Transfer)
- **Type**: Colombian bank transfer system
- **Countries**: Colombia
- **Features**:
  - Bancolombia, Nequi, A la Mano support
  - Bank transfer processing
  - Manual confirmation option
  - Automatic order status updates

### 4. Cash on Delivery
- **Type**: Payment upon delivery
- **Features**:
  - No online payment required
  - Payment collected during delivery
  - Immediate order confirmation

## System Architecture

### Payment Flow

1. **Order Creation**: Customer creates order in checkout
2. **Payment Processing**: System creates payment session with selected gateway
3. **Payment Gateway**: Customer completes payment on gateway platform
4. **Webhook Notification**: Gateway sends confirmation to webhook endpoint
5. **Order Update**: System automatically updates order status to "Confirmado"
6. **Email Notification**: Customer receives payment confirmation email

### Webhook Endpoints

- **Wompi**: `/api/webhooks/wompi`
- **Stripe**: `/api/webhooks/stripe`
- **PSE**: `/api/webhooks/pse`

### Payment Service

The `PaymentService` class handles all payment processing:
- Payment session creation
- Payment verification
- Error handling
- Gateway-specific logic

## Environment Variables Required

### Wompi Configuration
```env
VIRTUAL_WOMPI_PUBLIC_KEY=your_wompi_public_key
VIRTUAL_WOMPI_PRIVATE_KEY=your_wompi_private_key
VIRTUAL_WOMPI_WEBHOOK_SECRET=your_wompi_webhook_secret
```

### Stripe Configuration
```env
VIRTUAL_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
VIRTUAL_STRIPE_SECRET_KEY=your_stripe_secret_key
VIRTUAL_STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

### PSE Configuration
```env
VIRTUAL_PSE_MERCHANT_ID=your_pse_merchant_id
VIRTUAL_PSE_API_KEY=your_pse_api_key
VIRTUAL_PSE_WEBHOOK_SECRET=your_pse_webhook_secret
```

### Email Configuration
```env
VIRTUAL_RESEND_API_KEY=your_resend_api_key
```

## Setup Instructions

### 1. Wompi Setup

1. Create a Wompi account at https://wompi.co
2. Get your public and private keys from the dashboard
3. Configure webhook URL: `https://yourdomain.com/api/webhooks/wompi`
4. Set webhook secret in environment variables

### 2. Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your publishable and secret keys from the dashboard
3. Configure webhook URL: `https://yourdomain.com/api/webhooks/stripe`
4. Set webhook secret in environment variables

### 3. PSE Setup

1. Contact Colombian banks for PSE integration
2. Get merchant ID and API key
3. Configure webhook URL: `https://yourdomain.com/api/webhooks/pse`
4. Set webhook secret in environment variables

### 4. Email Setup

1. Create a Resend account at https://resend.com
2. Get your API key
3. Configure sender email domain

## Order Status Flow

### Payment Status Values
- `pending`: Payment is being processed
- `paid`: Payment confirmed successfully
- `failed`: Payment failed or declined

### Order Status Values
- `new`: Order created, awaiting payment
- `confirmed`: Payment confirmed, order being processed
- `shipped`: Order shipped to customer
- `delivered`: Order delivered to customer
- `cancelled`: Order cancelled

### Automatic Status Updates

When payment is confirmed via webhook:
1. `paymentStatus` changes from `pending` to `paid`
2. `status` changes from `new` to `confirmed`
3. `paymentConfirmedAt` timestamp is added
4. Payment confirmation email is sent to customer

## Email Notifications

### Payment Confirmation Email
- Sent when payment is successfully confirmed
- Includes order details and payment information
- Professional HTML template with branding

### Order Confirmation Email
- Sent when order is created (for pending payments)
- Includes order details and payment instructions
- Professional HTML template with branding

## Admin Interface Updates

### Payment Method Column
- Shows actual payment method selected by customer
- Displays: Wompi, Transferencia Bancaria, Tarjeta de Crédito
- No longer shows "Precio 1" or "Precio 2"

### Payment Status Tracking
- Real-time payment status updates
- Automatic order status changes
- Payment confirmation timestamps

## Security Features

### Webhook Verification
- HMAC signature verification for all webhooks
- Prevents unauthorized webhook calls
- Secure payment confirmation

### Payment Data Storage
- Payment transaction IDs stored securely
- Payment gateway data encrypted
- No sensitive payment data in logs

## Error Handling

### Payment Failures
- Failed payments marked as `paymentStatus: 'failed'`
- Order remains in `new` status
- Customer can retry payment

### Webhook Failures
- Retry logic for failed webhook processing
- Logging of all webhook events
- Manual intervention available for edge cases

## Testing

### Test Mode
- Use test credentials for all payment gateways
- Test webhook endpoints with sample data
- Verify email notifications

### Production Mode
- Use production credentials
- Real payment processing
- Live webhook endpoints

## Monitoring

### Payment Monitoring
- Track payment success rates
- Monitor webhook delivery
- Alert on payment failures

### Order Monitoring
- Track order status changes
- Monitor payment confirmation times
- Alert on stuck orders

## Troubleshooting

### Common Issues

1. **Webhook Not Receiving**: Check webhook URL and secret configuration
2. **Payment Not Confirming**: Verify webhook signature verification
3. **Email Not Sending**: Check Resend API key and email configuration
4. **Order Status Not Updating**: Verify Firebase configuration and permissions

### Debug Steps

1. Check webhook logs in server console
2. Verify environment variables are set correctly
3. Test webhook endpoints with sample data
4. Check Firebase order updates
5. Verify email service configuration

## Future Enhancements

### Planned Features
- Payment retry logic
- Partial payment support
- Refund processing
- Payment analytics dashboard
- Multi-currency support

### Integration Opportunities
- Additional payment gateways
- Mobile payment apps
- Cryptocurrency payments
- Buy now, pay later options 