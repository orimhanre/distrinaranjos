import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Vercel deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_RESEND_API_KEY: process.env.VIRTUAL_RESEND_API_KEY || '',
      VIRTUAL_FIREBASE_PROJECT_ID: process.env.VIRTUAL_FIREBASE_PROJECT_ID || '',
      VIRTUAL_FIREBASE_PRIVATE_KEY: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY || '',
      VIRTUAL_FIREBASE_CLIENT_EMAIL: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_RESEND_API_KEY) {
      console.log('✅ Using environment variables from process.env (Vercel deployment)');
      return envVars;
    }

    // Fallback to local file for development
    const fs = require('fs');
    const path = require('path');
    const envFilePath = path.join(process.cwd(), '.env.virtual.local');
    
    if (!fs.existsSync(envFilePath)) {
      console.log('Virtual environment file not found:', envFilePath);
      return envVars;
    }
    
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    
    envContent.split('\n').forEach((line: string) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const varKey = trimmedLine.substring(0, equalIndex);
          const varValue = trimmedLine.substring(equalIndex + 1);
          envVars[varKey] = varValue;
        }
      }
    });
    
    // // console.log('✅ Loaded virtual environment variables from local file (development):', Object.keys(envVars));
    return envVars;
  } catch (error) {
    console.error('Error loading virtual environment:', error);
    return {
      VIRTUAL_RESEND_API_KEY: process.env.VIRTUAL_RESEND_API_KEY || '',
      VIRTUAL_FIREBASE_PROJECT_ID: process.env.VIRTUAL_FIREBASE_PROJECT_ID || '',
      VIRTUAL_FIREBASE_PRIVATE_KEY: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY || '',
      VIRTUAL_FIREBASE_CLIENT_EMAIL: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL || '',
    };
  }
}

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
    const { virtualDb } = await import('../lib/firebase');
  try {
    const { orderId, invoiceNumber, bankProvider, totalAmount, confirmedAt } = await request.json();

    console.log('🔍 Confirm bank transfer - Input data:', {
      orderId,
      invoiceNumber,
      bankProvider,
      totalAmount,
      confirmedAt
    });

    // Load virtual environment variables
    const virtualEnv = loadVirtualEnv();

    if (!virtualDb) {
      console.error('Virtual Firebase not configured');
      return NextResponse.json(
        { success: false, error: 'Database not configured' },
        { status: 500 }
      );
    }

    // First, immediately update the order status to 'confirmed' for fast response
    console.log('🔍 Searching for order with invoice number:', invoiceNumber);
    console.log('🔍 Virtual database available:', !!virtualDb);
    
    const virtualOrdersRef = collection(virtualDb, 'virtualOrders');
    const allClientsSnapshot = await getDocs(virtualOrdersRef);
    
    console.log('🔍 Total client documents found:', allClientsSnapshot.size);
    
    let orderFound = false;
    let orderData: any = null;
    let clientEmail = '';
    
    // Search through each client document for the order
    for (const clientDoc of allClientsSnapshot.docs) {
      const clientData = clientDoc.data();
      const orders = clientData.orders || [];
      
      console.log(`🔍 Checking client ${clientDoc.id}, has ${orders.length} orders`);
      
      // Search through orders array for matching invoice number
      const matchingOrder = orders.find((order: any) => 
        order.invoiceNumber === invoiceNumber || order.orderId === orderId
      );
      
      if (matchingOrder) {
        orderData = {
          ...clientData,
          ...matchingOrder,
          orderId: matchingOrder.orderId,
          invoiceNumber: matchingOrder.invoiceNumber
        };
        clientEmail = clientData.email || clientData.clientEmail || '';
        orderFound = true;
        console.log('✅ Found order in client document:', {
          clientId: clientDoc.id,
          orderId: matchingOrder.orderId,
          invoiceNumber: matchingOrder.invoiceNumber,
          name: clientData.name,
          email: clientData.email
        });
        
        // Immediately update the order status for fast response
        const orderIndex = orders.findIndex((order: any) => 
          order.invoiceNumber === invoiceNumber || order.orderId === orderId
        );
        
        if (orderIndex !== -1) {
          // Update the order with payment confirmation immediately
          const updatedOrder = {
            ...orders[orderIndex],
            paymentStatus: 'confirmed',
            bankTransferConfirmed: true,
            bankTransferConfirmedAt: new Date(),
            lastUpdated: new Date()
          };
          
          orders[orderIndex] = updatedOrder;
          
          // Update the client document immediately
          await updateDoc(doc(virtualDb, 'virtualOrders', clientDoc.id), {
            orders: orders,
            lastUpdated: new Date()
          });
          
          console.log('✅ Updated order with payment confirmation immediately:', {
            orderId: updatedOrder.orderId,
            invoiceNumber: updatedOrder.invoiceNumber,
            paymentStatus: updatedOrder.paymentStatus
          });
          break;
        }
      }
    }
    
    if (!orderFound) {
      console.error(`❌ Order with invoice number ${invoiceNumber} or orderId ${orderId} not found in any client document`);
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // Return success immediately after updating the order status
    console.log('⚡ Returning success immediately - background processing will continue');
    
    // Start background processing without blocking the response
    processBackgroundTasks(orderId, invoiceNumber, bankProvider, totalAmount, orderData, virtualEnv).catch(error => {
      console.error('❌ Background processing error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'Bank transfer confirmed successfully',
      orderId: orderId,
      invoiceNumber: invoiceNumber,
      processingInBackground: true
    });

  } catch (error: any) {
    console.error('Bank transfer confirmation error:', error);
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

// Background processing function
async function processBackgroundTasks(
  orderId: string, 
  invoiceNumber: string, 
  bankProvider: string, 
  totalAmount: number, 
  orderData: any, 
  virtualEnv: any
) {
  console.log('🔄 Starting background processing for order:', orderId);
  
  let pdfUrl = '';
  let pdfFilename = 'pedido.pdf';
  
  try {
    // Step 1: Generate PDF in background
    console.log('📄 Generating PDF in background...');
    const foundOrder = orderData;
    
    // Debug: Log the complete order structure to see where cédula is stored
    console.log('🔍 Complete order data structure:', JSON.stringify(foundOrder, null, 2));
    console.log('🔍 Order client data:', foundOrder.client);
    console.log('🔍 Direct cédula fields:', {
      foundOrderCedula: foundOrder.cedula,
      clientCedula: foundOrder.client?.cedula,
      clientIdentification: foundOrder.client?.identification,
      finalCedula: foundOrder.cedula || foundOrder.client?.cedula || foundOrder.client?.identification || ''
    });
    
    if (foundOrder) {
      const pdfGenerationUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
      
      // Transform order items for PDF generation
      const cartItems = foundOrder.items?.map((item: any) => ({
        product: {
          id: item.productId,
          name: item.productName,
          brand: item.brand,
          price: item.unitPrice,
          price1: item.unitPrice,
          price2: item.unitPrice,
          imageURL: '',
          colors: [],
          isProductStarred: false,
          lastUpdated: new Date().toISOString()
        },
        quantity: item.quantity,
        selectedColor: item.color,
        selectedPrice: 'price'
      })) || [];

      const pdfRequestBody = {
        client: {
          name: foundOrder.name || '',
          surname: foundOrder.surname || '',
          email: foundOrder.email || '',
          phone: foundOrder.phone || '',
          address: foundOrder.address || '',
          city: foundOrder.city || '',
          department: foundOrder.department || '',
          postalCode: foundOrder.postalCode || '',
          cedula: foundOrder.cedula || foundOrder.client?.cedula || foundOrder.client?.identification || ''
        },
        cartItems: cartItems,
        selectedPriceType: 'price',
        comentario: foundOrder.comentario || '',
        paymentMethod: `Transferencia Bancaria - ${bankProvider}`,
        invoiceNumber: invoiceNumber,
        shippingCost: foundOrder.shippingCost || 0,
        subtotal: foundOrder.subtotal || totalAmount,
        total: totalAmount,
        useVirtualDb: true
      };
      
      console.log('🔍 PDF request body:', JSON.stringify(pdfRequestBody, null, 2));
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      console.log('🔍 Making PDF generation request to:', `${pdfGenerationUrl}/api/generate-pdf`);
      
      const pdfResponse = await fetch(`${pdfGenerationUrl}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfRequestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      console.log('📄 PDF generation response status:', pdfResponse.status);
      console.log('📄 PDF generation response headers:', Object.fromEntries(pdfResponse.headers.entries()));

      if (pdfResponse.ok) {
        const cloudinaryURL = pdfResponse.headers.get('X-Cloudinary-URL');
        const contentDisposition = pdfResponse.headers.get('Content-Disposition');

        console.log('📄 Cloudinary URL from header:', cloudinaryURL);
        console.log('📄 Content-Disposition from header:', contentDisposition);

        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch) {
            pdfFilename = filenameMatch[1];
            console.log('📄 Filename extracted from Content-Disposition:', pdfFilename);
          }
        }

        if (cloudinaryURL) {
          pdfUrl = cloudinaryURL;
          console.log('✅ PDF URL retrieved from header:', pdfUrl);
        } else {
          // Try to get URL from response body if not in headers
          try {
            const responseBody = await pdfResponse.json();
            console.log('📄 Response body:', responseBody);
            if (responseBody.cloudinaryUrl) {
              pdfUrl = responseBody.cloudinaryUrl;
              console.log('✅ PDF URL retrieved from response body:', pdfUrl);
            }
          } catch (err) {
            console.log('⚠️ Could not parse PDF response body as JSON:', err);
            // Try to get the response as text for debugging
            try {
              const responseText = await pdfResponse.text();
              console.log('📄 Response as text (first 500 chars):', responseText.substring(0, 500));
            } catch (textErr) {
              console.log('⚠️ Could not get response as text either:', textErr);
            }
          }
        }
        
        if (!pdfUrl) {
          console.log('❌ No PDF URL found in response');
          console.log('❌ PDF generation failed - no URL available');
        } else {
          console.log('✅ PDF generation successful - URL:', pdfUrl);
        }
      } else {
        console.log('❌ PDF generation request failed with status:', pdfResponse.status);
        try {
          const errorText = await pdfResponse.text();
          console.log('❌ Error response:', errorText);
        } catch (err) {
          console.log('❌ Could not read error response');
        }
      }
    }
  } catch (pdfError) {
    console.error('❌ PDF generation error:', pdfError);
    console.error('❌ PDF generation error details:', {
      message: pdfError instanceof Error ? pdfError.message : 'Unknown error',
      stack: pdfError instanceof Error ? pdfError.stack : undefined,
      orderId,
      invoiceNumber,
      bankProvider,
      totalAmount
    });
    // Continue without PDF if generation fails
  }
  
  try {
    // Step 2: Update order with PDF URL in background
    if (pdfUrl && virtualDb) {
      console.log('📝 Updating order with PDF URL in background...');
      
      const virtualOrdersRef = collection(virtualDb, 'virtualOrders');
      const allClientsSnapshot = await getDocs(virtualOrdersRef);
      
      for (const clientDoc of allClientsSnapshot.docs) {
        const clientData = clientDoc.data();
        const orders = clientData.orders || [];
        
        const orderIndex = orders.findIndex((order: any) => 
          order.invoiceNumber === invoiceNumber || order.orderId === orderId
        );
        
        if (orderIndex !== -1) {
          // Update the order with PDF URL
          const updatedOrder = {
            ...orders[orderIndex],
            fileUrl: pdfUrl,
            fileName: pdfFilename || `pedido_${invoiceNumber || orderId}.pdf`,
            lastUpdated: new Date()
          };
          
          orders[orderIndex] = updatedOrder;
          
          // Update the client document
          await updateDoc(doc(virtualDb, 'virtualOrders', clientDoc.id), {
            orders: orders,
            lastUpdated: new Date()
          });
          
          console.log('✅ Updated order with PDF URL in background:', {
            orderId: updatedOrder.orderId,
            invoiceNumber: updatedOrder.invoiceNumber,
            fileUrl: updatedOrder.fileUrl,
            fileName: updatedOrder.fileName
          });
          break;
        }
      }
    }
  } catch (updateError) {
    console.error('❌ Error updating order with PDF URL:', updateError);
  }

  try {
    // Step 3: Send email in background
    console.log('📧 Sending email in background...');
    
    // Initialize Resend with virtual environment variables
    const resend = new Resend(virtualEnv.VIRTUAL_RESEND_API_KEY || process.env.VIRTUAL_RESEND_API_KEY);
    
    const clientName = `${orderData.name || ''} ${orderData.surname || ''}`.trim() || orderData.companyName || 'Cliente';
    const senderName = virtualEnv.VIRTUAL_RESEND_API_KEY ? 
      `${clientName} <${virtualEnv.VIRTUAL_RESEND_FROM_EMAIL || 'info@distrinaranjos.com'}>` :
      'DistriNaranjos <info@distrinaranjos.com>';
    
    // Create email HTML for virtual order with payment confirmation
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Transferencia Bancaria Confirmada</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              max-width: 600px; 
              margin: 0 auto; 
              padding: 20px;
              background-color: #f4f4f4;
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #007bff; 
              padding-bottom: 20px; 
              margin-bottom: 30px;
            }
            .header h1 { 
              color: #007bff; 
              margin: 0; 
              font-size: 24px;
            }
            .header p { 
              color: #666; 
              margin: 5px 0 0 0;
            }
            .section { 
              margin-bottom: 30px; 
            }
            .section h2 { 
              color: #007bff; 
              border-bottom: 1px solid #eee; 
              padding-bottom: 10px;
              margin-bottom: 20px;
            }
            .info-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
            }
            .info-table td { 
              padding: 8px 0; 
              border-bottom: 1px solid #eee;
            }
            .info-table .label { 
              font-weight: bold; 
              width: 40%; 
              color: #007bff;
            }
            .order-table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 20px;
              table-layout: fixed;
            }
            .order-table th, .order-table td { 
              padding: 8px 4px; 
              text-align: left; 
              border-bottom: 1px solid #ddd;
              vertical-align: top;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .order-table th { 
              background-color: #f8f9fa; 
              font-weight: bold; 
              color: #007bff;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .order-table th.numeric { 
              text-align: right !important; 
              padding-right: 8px !important;
              white-space: nowrap !important;
            }
            .order-table .numeric { 
              text-align: right; 
              padding-right: 8px !important;
              white-space: nowrap !important;
            }
            .order-table .center { 
              text-align: center; 
            }
            .order-table .brand-column { 
              white-space: nowrap; 
              overflow: hidden; 
              text-overflow: ellipsis; 
            }
            .order-table .footer-row { 
              background-color: #f8f9fa; 
              font-weight: bold;
            }
            .order-table .footer-row td { 
              white-space: nowrap !important;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .order-table .total-amount { 
              font-size: 18px; 
              color: #007bff; 
              font-weight: bold;
            }
            .badge { 
              background: #007bff; 
              color: white; 
              padding: 2px 8px; 
              border-radius: 12px; 
              font-size: 12px;
            }
            .payment-status { 
              background: #d4edda; 
              border: 1px solid #c3e6cb; 
              border-radius: 5px; 
              padding: 15px; 
              margin: 20px 0;
            }
            .payment-status h3 { 
              color: #155724; 
              margin-top: 0; 
            }
            .payment-status p { 
              color: #155724; 
              margin-bottom: 10px; 
            }
            .footer { 
              text-align: center; 
              margin-top: 30px; 
              padding-top: 20px; 
              border-top: 1px solid #eee; 
              color: #666; 
              font-size: 14px;
            }
            
            /* Mobile responsive improvements */
            @media (max-width: 600px) {
              .desktop-only {
                display: none !important;
              }
              .mobile-only {
                display: block !important;
              }
              
              /* Products Card (Combined) */
              .products-card {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              
              .products-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #dee2e6;
                padding-bottom: 12px;
                margin-bottom: 12px;
              }
              
              .products-title {
                font-size: 16px;
                font-weight: bold;
                color: #007bff;
                margin: 0;
              }
              
              .products-count {
                font-size: 12px;
                color: #6c757d;
                background: #e9ecef;
                padding: 4px 8px;
                border-radius: 12px;
                font-weight: 500;
              }
              
              .products-list {
                display: flex;
                flex-direction: column;
                gap: 12px;
              }
              
              .product-item {
                padding: 12px;
                background: white;
                border-radius: 6px;
                border: 1px solid #e9ecef;
              }
              
              .product-item:not(.last-item) {
                border-bottom: 1px solid #f1f3f4;
              }
              
              .product-main-info {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 8px;
              }
              
              .product-name-brand {
                flex: 1;
                margin-right: 12px;
              }
              
              .product-name {
                font-size: 14px;
                font-weight: bold;
                color: #212529;
                margin: 0 0 2px 0;
                line-height: 1.3;
              }
              
              .product-brand {
                font-size: 12px;
                color: #6c757d;
                font-weight: 500;
              }
              
              .product-price-info {
                text-align: right;
                min-width: 80px;
              }
              
              .product-quantity {
                font-size: 12px;
                color: #007bff;
                font-weight: bold;
                margin-bottom: 2px;
              }
              
              .product-total {
                font-size: 14px;
                color: #28a745;
                font-weight: bold;
              }
              
              .product-details-compact {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
              }
              
              .detail-chip {
                font-size: 11px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: 500;
              }
              
              .color-chip {
                background: #e3f2fd;
                color: #1976d2;
                border: 1px solid #bbdefb;
              }
              
              .price-chip {
                background: #f3e5f5;
                color: #7b1fa2;
                border: 1px solid #e1bee7;
              }
              
              /* Mobile Summary */
              .mobile-summary {
                background: #e3f2fd;
                border: 1px solid #bbdefb;
                border-radius: 8px;
                padding: 16px;
                margin-top: 20px;
              }
              
              .summary-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                font-size: 15px;
              }
              
              .summary-label {
                font-weight: 600;
                color: #1976d2;
              }
              
              .summary-value {
                font-weight: bold;
                color: #1565c0;
              }
              
              .final-total {
                border-top: 2px solid #1976d2;
                padding-top: 12px;
                margin-top: 8px;
                font-size: 18px;
              }
              
              .final-total .summary-label {
                font-size: 18px;
                color: #0d47a1;
              }
              
              .final-total .summary-value {
                font-size: 18px;
                color: #d32f2f;
              }
              
              /* Order Info Card */
              .order-info-card {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              
              .info-item {
                display: flex;
                flex-direction: column;
                margin-bottom: 12px;
                padding-bottom: 12px;
                border-bottom: 1px solid #ffeaa7;
              }
              
              .info-item:last-child {
                border-bottom: none;
                margin-bottom: 0;
                padding-bottom: 0;
              }
              
              .info-label {
                font-weight: 600;
                color: #856404;
                font-size: 14px;
                margin-bottom: 4px;
              }
              
              .info-value {
                font-weight: 500;
                color: #212529;
                font-size: 15px;
                line-height: 1.4;
              }
              
              .info-value.invoice-number {
                color: #007bff;
                font-weight: bold;
                font-size: 16px;
              }
              
              .info-value.payment-method {
                color: #6c757d;
              }
              
              .info-value.status-confirmed {
                color: #28a745;
                font-weight: bold;
              }
              
              .info-value.comment {
                color: #495057;
                font-style: italic;
                background: #f8f9fa;
                padding: 8px;
                border-radius: 4px;
                border-left: 3px solid #007bff;
              }
              
              .info-value.total-amount {
                color: #d32f2f;
                font-weight: bold;
                font-size: 16px;
              }
              
              .info-value.payment-date {
                color: #6c757d;
                font-size: 14px;
              }
              
              /* Client Card */
              .client-card {
                background: #e8f5e8;
                border: 1px solid #c3e6c3;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 16px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              
              .client-header {
                border-bottom: 1px solid #c3e6c3;
                padding-bottom: 12px;
                margin-bottom: 12px;
              }
              
              .client-name {
                font-size: 18px;
                font-weight: bold;
                color: #155724;
                margin: 0;
                line-height: 1.3;
              }
              
              .client-details {
                display: flex;
                flex-direction: column;
                gap: 12px;
              }
              
              .client-item {
                display: flex;
                flex-direction: column;
                padding: 8px 0;
              }
              
              .client-label {
                font-weight: 600;
                color: #155724;
                font-size: 14px;
                margin-bottom: 4px;
              }
              
              .client-value {
                font-weight: 500;
                color: #212529;
                font-size: 15px;
                line-height: 1.4;
              }
              
              .client-value.email {
                color: #007bff;
                word-break: break-all;
              }
              
              .client-value.phone {
                color: #28a745;
                font-weight: bold;
              }
              
              .client-value.address {
                color: #6c757d;
                line-height: 1.5;
              }
            }
            
            /* Desktop styles */
            @media (min-width: 601px) {
              .desktop-only {
                display: block !important;
              }
              .mobile-only {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Transferencia Bancaria Confirmada</h1>
              <p>Pedido procesado exitosamente</p>
            </div>
            <div class="content">

              
              <div class="section">
                <h2>📋 Detalles del Cliente</h2>
                
                <!-- Desktop Layout (hidden on mobile) -->
                <div class="desktop-only">
                  <div class="client-info">
                    <h3>${clientName}</h3>
                    <p><strong>Email:</strong> ${orderData.email || 'N/A'}</p>
                    <p><strong>Teléfono:</strong> ${orderData.phone || 'N/A'}</p>
                    <p><strong>Dirección:</strong> ${orderData.address || ''} ${orderData.city || ''} ${orderData.department || ''}</p>
                  </div>
                </div>
                
                <!-- Mobile Cards (hidden on desktop) -->
                <div class="mobile-only">
                  <div class="client-card">
                    <div class="client-header">
                      <h3 class="client-name">${clientName}</h3>
                    </div>
                    <div class="client-details">
                      <div class="client-item">
                        <div class="client-label">Email</div>
                        <div class="client-value email">${orderData.email || 'N/A'}</div>
                      </div>
                      <div class="client-item">
                        <div class="client-label">Teléfono</div>
                        <div class="client-value phone">${orderData.phone || 'N/A'}</div>
                      </div>
                      <div class="client-item">
                        <div class="client-label">Dirección</div>
                        <div class="client-value address">${orderData.address || ''} ${orderData.city || ''} ${orderData.department || ''}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="section">
                <h2>🛍️ Productos del Pedido</h2>
                
                <!-- Desktop Table (hidden on mobile) -->
                <div class="desktop-only">
                  <table class="order-table">
                    <thead>
                      <tr>
                        <th style="width: 35%;">Producto</th>
                        <th style="width: 12%;">Marca</th>
                        <th style="width: 12%;">Color</th>
                        <th class="numeric" style="width: 8%;">Cantidad</th>
                        <th class="numeric" style="width: 16%;">Precio Unidad</th>
                        <th class="numeric" style="width: 17%;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${orderData.items?.map((item: any) => `
                        <tr>
                          <td>${item.productName}</td>
                          <td class="brand-column">${item.brand || ''}</td>
                          <td>${item.color || ''}</td>
                          <td class="numeric">${item.quantity}</td>
                          <td class="numeric">$${Math.round(item.unitPrice).toLocaleString('de-DE')}</td>
                          <td class="numeric">$${Math.round(item.totalPrice).toLocaleString('de-DE')}</td>
                        </tr>
                      `).join('') || ''}
                    </tbody>
                    <tfoot>
                      <tr class="footer-row">
                        <td colspan="5" style="text-align:right; padding-right: 8px;"><strong>Subtotal:</strong></td>
                        <td class="numeric" style="padding-right: 8px;">$${Math.round(orderData.subtotal || totalAmount).toLocaleString('de-DE')}</td>
                      </tr>
                      <tr class="footer-row">
                        <td colspan="5" style="text-align:right; padding-right: 8px;"><strong>Envío:</strong></td>
                        <td class="numeric" style="padding-right: 8px;">$${Math.round(orderData.shippingCost || 0).toLocaleString('de-DE')}</td>
                      </tr>
                      <tr class="footer-row">
                        <td colspan="5" style="text-align:right; padding-right: 8px;"><strong>Total:</strong></td>
                        <td class="numeric total-amount" style="padding-right: 8px;">$${Math.round(totalAmount).toLocaleString('de-DE')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                
                <!-- Mobile Cards (hidden on desktop) -->
                <div class="mobile-only">
                  <div class="products-card">
                    <div class="products-header">
                      <h3 class="products-title">Productos del Pedido</h3>
                      <div class="products-count">${orderData.items?.length || 0} producto${orderData.items?.length !== 1 ? 's' : ''}</div>
                    </div>
                    <div class="products-list">
                      ${orderData.items?.map((item: any, index: number) => `
                        <div class="product-item ${index === (orderData.items?.length || 0) - 1 ? 'last-item' : ''}">
                          <div class="product-main-info">
                            <div class="product-name-brand">
                              <div class="product-name">${item.productName}</div>
                              <div class="product-brand">${item.brand || ''}</div>
                            </div>
                            <div class="product-price-info">
                              <div class="product-quantity">x${item.quantity}</div>
                              <div class="product-total">$${Math.round(item.totalPrice).toLocaleString('de-DE')}</div>
                            </div>
                          </div>
                          <div class="product-details-compact">
                            <span class="detail-chip color-chip">${item.color || 'N/A'}</span>
                            <span class="detail-chip price-chip">$${Math.round(item.unitPrice).toLocaleString('de-DE')}</span>
                          </div>
                        </div>
                      `).join('') || ''}
                    </div>
                  </div>
                  
                  <!-- Mobile Summary -->
                  <div class="mobile-summary">
                    <div class="summary-row">
                      <span class="summary-label">Subtotal:</span>
                      <span class="summary-value">$${Math.round(orderData.subtotal || totalAmount).toLocaleString('de-DE')}</span>
                    </div>
                    <div class="summary-row">
                      <span class="summary-label">Envío:</span>
                      <span class="summary-value">$${Math.round(orderData.shippingCost || 0).toLocaleString('de-DE')}</span>
                    </div>
                    <div class="summary-row final-total">
                      <span class="summary-label">Total:</span>
                      <span class="summary-value">$${Math.round(totalAmount).toLocaleString('de-DE')}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="section">
                <h2>📄 Información del Pedido y Pago</h2>
                
                <!-- Desktop Table (hidden on mobile) -->
                <div class="desktop-only">
                  <table class="info-table">
                    <tr>
                      <td class="label">Número de Factura:</td>
                      <td>${invoiceNumber}</td>
                    </tr>
                    <tr>
                      <td class="label">Estado del Pago:</td>
                      <td><span class="badge confirmed">✅ Confirmado</span></td>
                    </tr>
                    <tr>
                      <td class="label">Método de Pago:</td>
                      <td>Transferencia Bancaria - ${bankProvider}</td>
                    </tr>
                    <tr>
                      <td class="label">Monto Total:</td>
                      <td><strong>$${Math.round(totalAmount).toLocaleString('de-DE')}</strong></td>
                    </tr>
                    <tr>
                      <td class="label">Fecha del Pago:</td>
                      <td>${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</td>
                    </tr>
                    ${orderData.comentario ? `<tr><td class="label">Comentarios:</td><td>${orderData.comentario}</td></tr>` : ''}
                  </table>
                </div>
                
                <!-- Mobile Cards (hidden on desktop) -->
                <div class="mobile-only">
                  <div class="order-info-card">
                    <div class="info-item">
                      <div class="info-label">Número de Factura</div>
                      <div class="info-value invoice-number">${invoiceNumber}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Estado del Pago</div>
                      <div class="info-value status-confirmed">✅ Confirmado</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Método de Pago</div>
                      <div class="info-value payment-method">Transferencia Bancaria - ${bankProvider}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Monto Total</div>
                      <div class="info-value total-amount">$${Math.round(totalAmount).toLocaleString('de-DE')}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Fecha del Pago</div>
                      <div class="info-value payment-date">${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
                    </div>
                    ${orderData.comentario ? `
                    <div class="info-item">
                      <div class="info-label">Comentarios</div>
                      <div class="info-value comment">${orderData.comentario}</div>
                    </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            </div>
            <div class="footer">
              <p>Este pedido ha sido confirmado y procesado exitosamente.</p>
              <p>ID del Pedido: ${orderId}</p>
              <p>Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Use the newly generated PDF URL
    console.log('📎 PDF URL for attachment:', pdfUrl);
    console.log('📎 PDF Filename for attachment:', pdfFilename || `pedido_${invoiceNumber || orderId}.pdf`);
    
    // Prepare attachment if PDF URL is available
    let attachments = undefined;
    if (pdfUrl) {
      try {
        const pdfResponse = await fetch(pdfUrl);
        const pdfBuffer = await pdfResponse.arrayBuffer();
        attachments = [{
          filename: pdfFilename || `pedido_${invoiceNumber || orderId}.pdf`,
          content: Buffer.from(new Uint8Array(pdfBuffer))
        }];
      } catch (attachmentError) {
        console.error('❌ Error preparing PDF attachment:', attachmentError);
      }
    }

    const emailResponse = await resend.emails.send({
      from: senderName,
      to: [virtualEnv.VIRTUAL_RESEND_TO_EMAIL || process.env.VIRTUAL_RESEND_TO_EMAIL || ''],
      subject: `${clientName} - ${Math.round(totalAmount).toLocaleString('de-DE')} - CONFIRMADO`,
      html: emailHtml,
      attachments: attachments
    });

    console.log('✅ Background email sent successfully:', emailResponse);

  } catch (emailError: any) {
    console.error('❌ Background email sending error:', emailError);
  }

  try {
    // Step 4: Send push notification in background (non-blocking)
    console.log('📱 Sending push notification in background...');
    
    const pushNotificationData = {
      clientName: orderData.name || '',
      clientSurname: orderData.surname || '',
      products: orderData.items?.map((item: any) => ({
        name: item.productName || 'Producto',
        quantity: item.quantity || 1
      })) || [],
      totalAmount: totalAmount,
      invoiceNumber: invoiceNumber
    };

    // Send push notification without waiting for response (non-blocking)
    fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/push-notifications/send-order-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushNotificationData),
    }).then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Background push notification failed:', errorText);
      } else {
        console.log('✅ Background push notification sent successfully');
      }
    }).catch((error) => {
      console.error('❌ Error sending background push notification:', error);
    });
    
    console.log('📱 Push notification request sent (non-blocking)');
  } catch (pushError) {
    console.error('❌ Error preparing push notification:', pushError);
  }

  console.log('✅ Background processing completed for order:', orderId);
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