import { Resend } from 'resend';

const resend = new Resend(process.env.VIRTUAL_RESEND_API_KEY);

export interface PaymentConfirmationEmailData {
  customerName: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  orderDate: string;
  estimatedDelivery: string;
}

export class EmailService {
  static async sendPaymentConfirmationEmail(data: PaymentConfirmationEmailData) {
    try {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP'
        }).format(amount);
      };

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirmación de Pago - DistriNaranjos</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px; }
            .content { padding: 20px; }
            .order-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .success-icon { color: #28a745; font-size: 48px; }
            .amount { font-size: 24px; font-weight: bold; color: #28a745; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1>¡Pago Confirmado!</h1>
              <p>Tu pedido ha sido procesado exitosamente</p>
            </div>
            
            <div class="content">
              <p>Hola <strong>${data.customerName}</strong>,</p>
              
              <p>Nos complace informarte que tu pago ha sido confirmado y tu pedido está siendo procesado.</p>
              
              <div class="order-details">
                <h3>Detalles del Pedido</h3>
                <p><strong>Número de Pedido:</strong> ${data.orderNumber}</p>
                <p><strong>Fecha del Pedido:</strong> ${data.orderDate}</p>
                <p><strong>Método de Pago:</strong> ${data.paymentMethod}</p>
                <p><strong>Total Pagado:</strong> <span class="amount">${formatCurrency(data.totalAmount)}</span></p>
                <p><strong>Entrega Estimada:</strong> ${data.estimatedDelivery}</p>
              </div>
              
              <p>Recibirás una notificación cuando tu pedido esté listo para ser enviado.</p>
              
              <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
              
              <p>¡Gracias por confiar en DistriNaranjos!</p>
            </div>
            
            <div class="footer">
              <p>DistriNaranjos</p>
              <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: 'DistriNaranjos <info@distrinaranjos.com>',
        to: data.customerEmail,
        subject: `Confirmación de Pago - Pedido #${data.orderNumber}`,
        html: emailContent,
      });

      console.log('Payment confirmation email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  static async sendOrderConfirmationEmail(data: PaymentConfirmationEmailData) {
    try {
      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP'
        }).format(amount);
      };

      const emailContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Pedido Recibido - DistriNaranjos</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #fff3cd; padding: 20px; text-align: center; border-radius: 8px; }
            .content { padding: 20px; }
            .order-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .pending-icon { color: #ffc107; font-size: 48px; }
            .amount { font-size: 24px; font-weight: bold; color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="pending-icon">⏳</div>
              <h1>¡Pedido Recibido!</h1>
              <p>Tu pedido está pendiente de confirmación de pago</p>
            </div>
            
            <div class="content">
              <p>Hola <strong>${data.customerName}</strong>,</p>
              
              <p>Hemos recibido tu pedido y está siendo procesado. Una vez confirmemos el pago, procederemos con el envío.</p>
              
              <div class="order-details">
                <h3>Detalles del Pedido</h3>
                <p><strong>Número de Pedido:</strong> ${data.orderNumber}</p>
                <p><strong>Fecha del Pedido:</strong> ${data.orderDate}</p>
                <p><strong>Método de Pago:</strong> ${data.paymentMethod}</p>
                <p><strong>Total:</strong> <span class="amount">${formatCurrency(data.totalAmount)}</span></p>
                <p><strong>Estado:</strong> Pendiente de confirmación</p>
              </div>
              
              <p>Te notificaremos cuando el pago sea confirmado y tu pedido esté listo para ser enviado.</p>
              
              <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
              
              <p>¡Gracias por confiar en DistriNaranjos!</p>
            </div>
            
            <div class="footer">
              <p>DistriNaranjos</p>
              <p>Este es un email automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const result = await resend.emails.send({
        from: 'DistriNaranjos <info@distrinaranjos.com>',
        to: data.customerEmail,
        subject: `Pedido Recibido - #${data.orderNumber}`,
        html: emailContent,
      });

      console.log('Order confirmation email sent:', result);
      return result;
    } catch (error) {
      console.error('Error sending order confirmation email:', error);
      throw error;
    }
  }
} 