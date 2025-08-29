import PDFDocument from 'pdfkit';
import { OrderData } from '@/types';

// Function to get the correct price for an item (with promotional discount if applicable)
function getItemPrice(item: any): number {
  // If the item is already marked as promotional and has originalPrice, use the stored price
  if (item.isPromotional && item.originalPrice) {
    return item.product.price; // Use the already discounted price
  }
  
  // Check if this is a promotional product - check multiple possible category names
  const hasPromotionalPricing = item.product.category &&
    (Array.isArray(item.product.category) 
      ? item.product.category.some((cat: string) => 
          cat.toLowerCase().includes('promocion') || 
          cat.toLowerCase().includes('promotion') ||
          cat.toLowerCase().includes('oferta') ||
          cat.toLowerCase().includes('descuento')
        )
      : item.product.category.toLowerCase().includes('promocion') ||
        item.product.category.toLowerCase().includes('promotion') ||
        item.product.category.toLowerCase().includes('oferta') ||
        item.product.category.toLowerCase().includes('descuento')
    );

  // Handle price based on environment - virtual uses 'price', regular uses 'price1'/'price2'
  const basePrice = item.selectedPrice === 'price' ? item.product.price : 
                   (item.selectedPrice === 'price1' ? item.product.price1 : item.product.price2);
  
  if (hasPromotionalPricing) {
    // Apply 30% discount for promotional items
    return (basePrice ?? 0) * 0.7;
  }

  return basePrice ?? 0;
}

export async function generateOrderPDF(orderData: OrderData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.fontSize(20)
         .font('Helvetica-Bold')
         .fillColor('#1e40af')
         .text('QuickOrder', { align: 'center' });

      doc.moveDown(0.5);
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text('Professional Order Management', { align: 'center' });

      doc.moveDown(2);

      // Order Information
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('ORDER DETAILS');

      doc.moveDown(1);

      // Order ID and Date
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#374151')
         .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'right' });

      doc.moveDown(1);

      // Price Type with correct color and text for virtual environment
      const priceTypeColor = orderData.selectedPriceType === 'price' ? '#ff9800' : 
                            (orderData.selectedPriceType === 'price1' ? '#059669' : '#1e40af');
      const priceTypeText = orderData.selectedPriceType === 'price' ? 'Price (Virtual)' :
                           (orderData.selectedPriceType === 'price1' ? 'Price 1 (Standard)' : 'Price 2 (VIP)');
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor(priceTypeColor)
         .text(`Pricing Type: ${priceTypeText}`);

      doc.moveDown(2);

      // Client Information
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('CLIENT INFORMATION');

      doc.moveDown(1);

      const client = orderData.client;
      const clientInfo = [
        `Name: ${client.name || ''} ${client.surname || ''}`,
        `Phone: ${client.phone || ''}`,
        `Company: ${client.companyName || ''}`,
        `City: ${client.city || ''}`,
        `Department: ${client.department || ''}`,
        `Address: ${client.address || ''}`,
        `ID: ${client.identification || ''}`
      ].filter(info => info.split(': ')[1] !== '');

      clientInfo.forEach(info => {
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#374151')
           .text(info);
      });

      doc.moveDown(2);

      // Products Table
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('ORDER ITEMS');

      doc.moveDown(1);

      // Table Header
      const tableTop = doc.y;
      const colX = [50, 250, 330, 410];

      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor('#374151');

      doc.text('Product', colX[0], tableTop);
      doc.text('Price', colX[1], tableTop);
      doc.text('Qty', colX[2], tableTop);
      doc.text('Total', colX[3], tableTop);

      doc.moveDown(1);

      // Table Rows
      orderData.cartItems.forEach((item, index) => {
        const rowY = doc.y + (index * 25);
        // Use originalPrice if available (for promotional items), otherwise calculate from product
        const originalPrice = item.originalPrice || 
                             (item.selectedPrice === 'price' ? item.product.price : 
                              (item.selectedPrice === 'price1' ? item.product.price1 : item.product.price2));
        const discountedPrice = getItemPrice(item);
        const hasDiscount = discountedPrice !== originalPrice;

        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#374151');

        // Product name and details
        doc.text(item.product.name, colX[0], rowY);
        doc.fontSize(7)
           .fillColor('#6b7280')
           .text(`${item.product.brand} - ${item.selectedColor}`, colX[0], rowY + 12);
        doc.fontSize(6)
           .text(`Ref: ${item.product.id}`, colX[0], rowY + 20);

        // Price with discount display
        if (hasDiscount) {
          // Show original price struck through
          doc.fontSize(7)
             .font('Helvetica')
             .fillColor('#9ca3af')
             .text(`$${(originalPrice ?? 0).toFixed(2)}`, colX[1], rowY);
          // Show discounted price below
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor('#374151')
             .text(`$${discountedPrice.toFixed(2)}`, colX[1], rowY + 10);
        } else {
          // Show regular price
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#374151')
             .text(`$${discountedPrice.toFixed(2)}`, colX[1], rowY);
        }

        // Quantity
        doc.text(item.quantity.toString(), colX[2], rowY);

        // Total with discount display
        if (hasDiscount) {
          // Show original total struck through
          doc.fontSize(7)
             .font('Helvetica')
             .fillColor('#9ca3af')
             .text(`$${((originalPrice ?? 0) * item.quantity).toFixed(2)}`, colX[3], rowY);
          // Show discounted total below
          doc.fontSize(8)
             .font('Helvetica-Bold')
             .fillColor('#374151')
             .text(`$${(discountedPrice * item.quantity).toFixed(2)}`, colX[3], rowY + 10);
        } else {
          // Show regular total
          doc.fontSize(8)
             .font('Helvetica')
             .fillColor('#374151')
             .text(`$${(discountedPrice * item.quantity).toFixed(2)}`, colX[3], rowY);
        }
      });

      doc.moveDown(2);

      // Total
      const totalY = doc.y;
      const total = orderData.cartItems.reduce((sum, item) => {
        const discountedPrice = getItemPrice(item);
        return sum + (discountedPrice * item.quantity);
      }, 0);
      
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#111827')
         .text('TOTAL:', colX[2], totalY)
         .text(`$${total.toFixed(2)}`, colX[3], totalY);

      doc.moveDown(2);

      // Comentario section (if exists)
      if (orderData.comentario && orderData.comentario.trim() !== '') {
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('#1e40af')
           .text('Comentarios:');
        doc.moveDown(0.5);
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#374151');
        // Split comentario by line breaks and render each line
        orderData.comentario.split(/\r?\n/).forEach(line => {
          doc.text(line);
        });
        doc.moveDown(1.5);
      }

      doc.moveDown(3);

      // Footer
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#6b7280')
         .text('Generated by QuickOrder Web Form', { align: 'center' });

      doc.fontSize(7)
         .text(`Date: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `QO-${timestamp}-${random}`;
} 