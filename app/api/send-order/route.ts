import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db, virtualDb } from '../../../lib/firebase';
import { Resend } from 'resend';
import { generateInvoiceNumber } from '../../../lib/invoiceNumber';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Vercel deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_RESEND_API_KEY: process.env.VIRTUAL_RESEND_API_KEY || '',
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
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
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
    };
  }
}

// Load virtual environment variables
const virtualEnv = loadVirtualEnv();

// Utility to deeply sanitize objects for Firestore
function deepSanitize(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepSanitize);
  } else if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      
      const value = obj[key];
      if (typeof value === 'undefined') {
        sanitized[key] = null;
      } else if (typeof value === 'function') {
        // skip functions
        continue;
      } else if (typeof value === 'bigint') {
        // Firestore does not support BigInt
        sanitized[key] = value.toString();
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'object') {
        sanitized[key] = deepSanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  return obj;
}

export async function POST(request: NextRequest) {
  try {
    const { 
      client, 
      cartItems, 
      selectedPriceType, 
      comentario, 
      fileUrl: initialFileUrl, 
      fileName: initialFileName, 
      pdfBuffer, 
      useVirtualDb, 
      paymentStatus, 
      shippingCost, 
      subtotal, 
      totalWithShipping, 
      invoiceNumber: passedInvoiceNumber, 
      pdfGeneratedAt, 
      bankTransferDetails 
    } = await request.json();

    // Initialize Resend with the correct API key based on order type
    let resend: Resend;
    if (useVirtualDb) {
      // Virtual orders use virtual environment variables
      resend = new Resend(virtualEnv.VIRTUAL_RESEND_API_KEY || process.env.VIRTUAL_RESEND_API_KEY);
    } else {
      // Non-virtual orders (Distri1/Naranjos2) use regular .env.local environment variables
      resend = new Resend(process.env.RESEND_API_KEY);
    }

    // Debug logging for email configuration
    console.log('🔧 Email Configuration Debug:', {
      useVirtualDb,
      resendApiKey: useVirtualDb ? 
        (virtualEnv.VIRTUAL_RESEND_API_KEY || process.env.VIRTUAL_RESEND_API_KEY)?.substring(0, 10) + '...' : 
        process.env.RESEND_API_KEY?.substring(0, 10) + '...',
      resendToEmail: useVirtualDb ? 
        (virtualEnv.VIRTUAL_RESEND_TO_EMAIL || process.env.VIRTUAL_RESEND_TO_EMAIL) : 
        process.env.RESEND_TO_EMAIL,
      resendFromEmail: useVirtualDb ? 
        (virtualEnv.VIRTUAL_RESEND_FROM_EMAIL || process.env.VIRTUAL_RESEND_FROM_EMAIL) : 
        process.env.RESEND_FROM_EMAIL
    });

    // Use companyName for walk-in customers who don't have email
    const clientEmail = client.email || client.companyName || `cliente-${Date.now()}`;
    let fileUrl = initialFileUrl;
    let fileName = initialFileName;

    // Derive absolute base URL from request headers for email image links
    const headersIn = request.headers;
    const host = headersIn.get('x-forwarded-host') || headersIn.get('host') || '';
    const proto = headersIn.get('x-forwarded-proto') || (host && host.includes('localhost') ? 'http' : 'https');
    const absoluteBase = host ? `${proto}://${host}` : '';

    // Extract products from cartItems instead of parsing PDF
    let productos: Record<string, number> = {};
    if (cartItems && Array.isArray(cartItems)) {
      cartItems.forEach((item: any) => {
        const productName = item.product?.name || item.productName || 'Unknown Product';
        const quantity = item.quantity || 0;
        if (productName && quantity > 0) {
          productos[productName] = (productos[productName] || 0) + quantity;
        }
      });
    }

    // Clean up cartItems to remove unnecessary fields
    const cleanedCartItems = cartItems.map((item: any) => {
      const cleanedProduct: any = {
        id: item.product?.id,
        name: item.product?.name,
        brand: item.product?.brand,
        imageURL: item.product?.imageURL,
        colors: item.product?.colors,
        isProductStarred: item.product?.isProductStarred,
        lastUpdated: item.product?.lastUpdated
      };

      // Include appropriate price fields based on environment
      if (useVirtualDb) {
        cleanedProduct.price = item.product?.price; // Virtual environment uses only 'price'
      } else {
        cleanedProduct.price1 = item.product?.price1; // Admin environment uses price1/price2
        cleanedProduct.price2 = item.product?.price2;
      }

      return {
        id: item.id,
        product: cleanedProduct,
        quantity: item.quantity,
        selectedColor: item.selectedColor,
        selectedPrice: item.selectedPrice
      };
    });

    // Create order details string similar to iOS app
    const total = cartItems.reduce((sum: number, item: any) => {
      let price: number;
      if (useVirtualDb) {
        // Virtual environment uses only 'price' field
        price = item.product.price;
      } else {
        // Admin environment uses price1/price2
        if (item.selectedPrice === 'price1') {
          price = item.product.price1;
        } else {
          price = item.product.price2;
        }
      }
      return sum + (price * item.quantity);
    }, 0);

    // Determine price type label based on environment
    let priceTypeLabel: string;
    if (useVirtualDb) {
      priceTypeLabel = 'price'; // Virtual database uses 'price' field
    } else {
      priceTypeLabel = selectedPriceType === 'price1' ? '1' : '2'; // Regular database uses price1/price2
    }

    // Calculate shipping cost - only for virtual orders, not for regular orders
    let finalShippingCost = 0;
    let finalTotal = total;
    if (useVirtualDb) {
      // Only apply shipping cost for virtual orders
      const shippingThreshold = parseInt(virtualEnv.VIRTUAL_SHIPPING_FREE_THRESHOLD || process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '200000');
      const baseShippingCost = parseInt(virtualEnv.VIRTUAL_SHIPPING_COST || process.env.VIRTUAL_SHIPPING_COST || '25000');
      const needsShipping = total < shippingThreshold;
      finalShippingCost = needsShipping ? baseShippingCost : 0;
      finalTotal = total + finalShippingCost;
    }

    const orderDetails = `Cliente: ${client.companyName || 'N/A'} | Total: ${Math.round(finalTotal).toLocaleString('de-DE')} | Tipo: ${priceTypeLabel} | Comentario: ${comentario || 'N/A'}`;

    // Use passed invoice number if available; otherwise generate one
    const invoiceNumber = passedInvoiceNumber || await generateInvoiceNumber(useVirtualDb);
    console.log('🔢 Invoice number in send-order API:', { passedInvoiceNumber, finalInvoiceNumber: invoiceNumber });

    // Determine which Firebase database to use
    // For main website orders, always use main database and orders collection
    // For virtual database, use virtual database and clients collection
    let firestoreDb = db; // Always use main database for website orders
    let collectionName = 'orders'; // Always use orders collection for website orders

    if (useVirtualDb && virtualDb) {
      firestoreDb = virtualDb;
      collectionName = 'virtualOrders'; // Use virtualOrders collection for virtual orders
    }

    // Check if this is a bank transfer order
    const isBankTransferOrder = comentario?.includes('pse') || comentario?.includes('transferencia') || comentario?.includes('bank_transfer');



    // Check if this is a logged-in user
    const isLoggedInUser = Boolean(client.userAuth && client.userAuth.email);

    // Create order data with both nested structure (for admin) and flat structure (for iOS app)
    const orderData = {
      // CLIENT IDENTITY
      clientEmail: isLoggedInUser && client.userAuth?.email ? client.userAuth.email : clientEmail,
      userAuth: isLoggedInUser && client.userAuth ? {
        displayName: client.userAuth.displayName || null,
        email: client.userAuth.email || null,
        uid: client.userAuth.uid || null
      } : null,

      // CLIENT DETAILS
      name: client.name || '',
      surname: client.surname || '',
      companyName: client.companyName || '',
      identification: client.identification || '',
      phone: client.phone || '',
      address: client.address || '',
      city: client.city || '',
      department: client.department || '',
      postalCode: client.codigoPostal || client.postalCode || '',
      email: clientEmail || '',

      // ORDERS ARRAY (for admin panel compatibility)
      orders: [
        {
          orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          invoiceNumber: invoiceNumber,
          status: 'new',
          paymentStatus: paymentStatus || 'pending',
          paymentMethod: comentario?.includes('pse') || comentario?.includes('transferencia') || comentario?.includes('bank_transfer') ? 
                        (bankTransferDetails?.bankName ? `Transferencia Bancaria - ${bankTransferDetails.bankName}` : 'Transferencia Bancaria') : 
                        comentario?.includes('wompi') ? 'Wompi' :
                        comentario?.includes('credit_card') ? 'Tarjeta de Crédito' :
                        'No especificado',
          orderDate: pdfGeneratedAt ? new Date(pdfGeneratedAt) : new Date(),
          lastUpdated: new Date(),

          // ORDER ITEMS
          items: cleanedCartItems?.map((item: any) => {
            const resolvedUnitPrice = useVirtualDb
              ? (item.product?.price || 0)
              : (item.selectedPrice === 'price1' 
                  ? (item.product?.price1 || 0) 
                  : (item.product?.price2 || 0));
            const resolvedQuantity = item.quantity || 1;

            return {
              productId: item.product?.id || item.id,
              productName: item.product?.name || 'Producto',
              brand: item.product?.brand || '',
              color: item.selectedColor || '',
              quantity: resolvedQuantity,
              unitPrice: resolvedUnitPrice,
              totalPrice: resolvedUnitPrice * resolvedQuantity
            };
          }) || [],

          // FINANCIAL SUMMARY
          subtotal: total,
          shippingCost: finalShippingCost,
          totalAmount: finalTotal,

          // ORDER DETAILS
          orderDetails: orderDetails,
          comentario: comentario || '',
          fileUrl: fileUrl || '',
          fileName: fileName || '',

          // Add tracking and admin message fields for consistency
          trackingNumber: '',
          courier: '',
          adminMessage: '',
          adminMessageDate: null,

          // Add bank transfer details if available
          bankTransferDetails: bankTransferDetails || null
        }
      ],

      // FLAT STRUCTURE FOR iOS APP COMPATIBILITY
      // Order details at top level (like iOS app expects)
      orderId: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber: invoiceNumber,
      status: 'new',
      paymentStatus: paymentStatus || 'pending',
      paymentMethod: comentario?.includes('pse') || comentario?.includes('transferencia') || comentario?.includes('bank_transfer') ? 
                    (bankTransferDetails?.bankName ? `Transferencia Bancaria - ${bankTransferDetails.bankName}` : 'Transferencia Bancaria') : 
                    comentario?.includes('wompi') ? 'Wompi' :
                    comentario?.includes('credit_card') ? 'Tarjeta de Crédito' :
                    'No especificado',
      orderDate: pdfGeneratedAt ? new Date(pdfGeneratedAt) : new Date(),
      lastUpdated: new Date(),

      // Financial information at top level
      totalAmount: finalTotal,
      subtotal: total,
      shippingCost: finalShippingCost,
      // Add explicit total field for iOS app parsing
      total: finalTotal,

      // Order details at top level
      orderDetails: orderDetails,
      comentario: comentario || '',
      fileUrl: fileUrl || '',
      fileName: fileName || '',

      // iOS app specific fields
      deliveredTo: [],
      readBy: [],
      isOffline: false,
      userId: isLoggedInUser && client.userAuth?.uid ? client.userAuth.uid : null,
      timestamp: pdfGeneratedAt ? new Date(pdfGeneratedAt) : new Date(),
      selectedPriceType: selectedPriceType,

      // Tracking and admin message fields at top level
      trackingNumber: '',
      courier: '',
      adminMessage: '',
      adminMessageDate: null,

      // Add bank transfer details if available
      bankTransferDetails: bankTransferDetails || null,

      // SYSTEM METADATA
      metadata: {
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        environment: useVirtualDb ? 'virtual' : 'main',
        source: 'web',
        isActive: true,
        isStarred: false,
        isArchived: false,
        labels: ["Nuevo Pedido"]
      },

      // Backwards-compatibility fields expected by admin UI
      userName: client.companyName || '',
      client: {
        name: client.name || '',
        surname: client.surname || '',
        companyName: client.companyName || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || '',
        city: client.city || '',
        department: client.department || '',
        postalCode: client.codigoPostal || client.postalCode || '',
        identification: client.cedula || client.identification || ''
      },
      cartItems: cleanedCartItems,
      productos
    };

    // Sanitize only problematic parts (avoid touching metadata/serverTimestamp)
    const sanitizedOrderData = {
      ...orderData,
      client: deepSanitize(orderData.client),
      cartItems: deepSanitize(orderData.cartItems),
      orders: deepSanitize(orderData.orders)
    };

    // Add to Firestore orders collection
    let docRef: any = null;
    try {
      if (useVirtualDb && collectionName === 'virtualOrders') {
        // For virtual database, use client email as document ID to avoid duplicates
        const virtualClientEmail = isLoggedInUser && client.userAuth?.email ? client.userAuth.email : clientEmail;
        if (!virtualClientEmail) {
          throw new Error('No valid client email found for virtual order');
        }

        const clientDocRef = doc(firestoreDb!, collectionName, virtualClientEmail);

        // Check if client document already exists
        const clientDoc = await getDoc(clientDocRef);
        if (clientDoc.exists()) {
          // Update existing client document by adding new order to orders array
          const existingOrders = clientDoc.data().orders || [];
          const updatedOrders = [...existingOrders, orderData.orders[0]];

          await updateDoc(clientDocRef, {
            orders: updatedOrders,
            name: orderData.name,
            surname: orderData.surname,
            companyName: orderData.companyName,
            identification: orderData.identification,
            phone: orderData.phone,
            address: orderData.address,
            city: orderData.city,
            department: orderData.department,
            postalCode: orderData.postalCode,
            email: orderData.email,
            clientEmail: orderData.clientEmail,
            userAuth: orderData.userAuth,
            metadata: orderData.metadata,
            lastUpdated: serverTimestamp()
          });

          docRef = { id: virtualClientEmail };
        } else {
          // Create new client document with email as ID
          await setDoc(clientDocRef, orderData);
          docRef = { id: virtualClientEmail };
        }

        // Also save a copy to clients collection for client portal access
        try {
          const clientProfileRef = doc(firestoreDb!, 'clients', virtualClientEmail);
          const clientProfileDoc = await getDoc(clientProfileRef);

          // Create order summary for clients collection - ensure exact same structure as virtualOrders
          const orderSummary = {
            orderId: orderData.orders[0].orderId, // Use the same orderId as virtualOrders for consistency
            orderNumber: invoiceNumber,
            invoiceNumber: invoiceNumber, // Add both for compatibility
            orderDate: new Date(),
            status: 'new',
            paymentStatus: paymentStatus || 'pending',
            totalPrice: finalTotal,
            totalAmount: finalTotal, // Add both for compatibility
            items: cleanedCartItems?.map((item: any) => ({
              productId: item.product?.id || item.id,
              productName: item.product?.name || 'Producto',
              brand: item.product?.brand || '',
              color: item.selectedColor || '',
              quantity: item.quantity || 1,
              unitPrice: item.product?.price || 0,
              totalPrice: (item.product?.price || 0) * (item.quantity || 1)
            })) || [],
            cartItems: cleanedCartItems?.map((item: any) => ({
              productId: item.product?.id || item.id,
              productName: item.product?.name || 'Producto',
              brand: item.product?.brand || '',
              color: item.selectedColor || '',
              quantity: item.quantity || 1,
              unitPrice: item.product?.price || 0,
              totalPrice: (item.product?.price || 0) * (item.quantity || 1)
            })) || [], // Add both for compatibility
            pdfUrl: fileUrl || '',
            fileUrl: fileUrl || '', // Add both for compatibility
            comentario: comentario || '',
            trackingNumber: '',
            courier: '',
            isDeleted: false,

            // Add shipping address information
            shippingAddress: `${client.address || ''} ${client.city || ''} ${client.department || ''} ${client.codigoPostal || client.postalCode || ''}`.trim() || '',

            // Add client information for display
            client: {
              name: client.name || '',
              surname: client.surname || '',
              companyName: client.companyName || '',
              email: client.email || '',
              phone: client.phone || '',
              address: client.address || '',
              city: client.city || '',
              department: client.department || '',
              postalCode: client.codigoPostal || client.postalCode || '',
              cedula: client.cedula || client.identification || ''
            },

            // Add additional order details that were missing
            subtotal: total,
            shippingCost: finalShippingCost,
            paymentMethod: comentario?.includes('pse') || comentario?.includes('transferencia') ? 
                          (bankTransferDetails?.bankName ? `Transferencia Bancaria - ${bankTransferDetails.bankName}` : 'Transferencia Bancaria') : 
                          comentario?.includes('wompi') ? 'Wompi' :
                          comentario?.includes('credit_card') ? 'Tarjeta de Crédito' :
                          'No especificado',
            orderDetails: orderDetails || '',
            fileName: fileName || '',

            // Add metadata for tracking
            createdAt: new Date(),
            lastUpdated: new Date(),
            environment: 'virtual',
            source: 'web',

            // Add labels for categorization
            labels: ["Nuevo Pedido"],

            // Add admin message fields for future use
            adminMessage: '',
            adminMessageDate: null,

            // Add bank transfer details if available
            bankTransferDetails: bankTransferDetails || null
          };

          if (clientProfileDoc.exists()) {
            // Update existing client profile with new order
            const existingOrders = clientProfileDoc.data().orders || [];
            const updatedOrders = [...existingOrders, orderSummary];

            await updateDoc(clientProfileRef, {
              orders: updatedOrders,
              lastUpdated: serverTimestamp()
            });

            // Auto-trigger sync to virtualOrders collection
            try {
              const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/firestore-trigger-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clientEmail: virtualClientEmail,
                  orderData: orderSummary,
                  operation: 'add'
                })
              });
              
              if (syncResponse.ok) {
                const syncResult = await syncResponse.json();
              }
            } catch (syncError) {
              // Handle sync errors silently
            }
          } else {
            // Create new client profile with first order
            await setDoc(clientProfileRef, {
              email: virtualClientEmail,
              firstName: client.name || '',
              lastName: client.surname || '',
              phone: client.phone || '',
              cedula: client.cedula || '',
              address: client.address || '',
              city: client.city || '',
              department: client.department || '',
              postalCode: client.codigoPostal || client.postalCode || '',
              createdAt: serverTimestamp(),
              lastUpdated: serverTimestamp(),
              orders: [orderSummary]
            });

            // Auto-trigger sync to virtualOrders collection for new client
            try {
              const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/firestore-trigger-sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  clientEmail: virtualClientEmail,
                  orderData: orderSummary,
                  operation: 'create'
                })
              });
              
              if (syncResponse.ok) {
                const syncResult = await syncResponse.json();
              }
            } catch (syncError) {
              // Handle sync errors silently
            }
          }
        } catch (clientProfileError) {
          // Continue with main order save even if client profile save fails
        }
      } else {
        // For main database, use regular addDoc
        docRef = await addDoc(collection(firestoreDb!, collectionName), sanitizedOrderData);
      }
    } catch (firestoreError: any) {
      throw new Error(`Firestore Error: ${firestoreError.message}`);
    }

    // Create dynamic sender name using client's name and surname for distri1/naranjos2
    const companyName = client.companyName || client.name || 'Cliente Web';
    let senderName: string;
    let clientName: string;

    if (useVirtualDb) {
      // Main pages (virtual) - use customer's full name as sender, full name for subject
      const fullName = `${client.name || ''} ${client.surname || ''}`.trim();
      // Use virtual environment email configuration
      const fromEmail = virtualEnv.VIRTUAL_RESEND_FROM_EMAIL || process.env.VIRTUAL_RESEND_FROM_EMAIL || 'info@distrinaranjos.com';
      // Extract email from format like "DistriNaranjos <info@distrinaranjos.com>" or just "info@distrinaranjos.com"
      const emailMatch = fromEmail.match(/<(.+?)>/) || [null, fromEmail];
      const email = emailMatch[1] || fromEmail;
      senderName = `${fullName || companyName} <${email}>`;
      clientName = fullName || companyName;
    } else {
      // Distri1/Naranjos2 (regular) - use company name as sender, full name for subject
      const fullName = `${client.name || ''} ${client.surname || ''}`.trim();
      // Use regular .env.local environment email configuration
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'DistriNaranjos <info@distrinaranjos.com>';
      // Extract email from format like "DistriNaranjos <info@distrinaranjos.com>" or just "info@distrinaranjos.com"
      const emailMatch = fromEmail.match(/<(.+?)>/) || [null, fromEmail];
      const email = emailMatch[1] || fromEmail;
      senderName = `${companyName} <${email}>`;
      clientName = fullName || companyName;
    }

    // Before constructing emailHtml, convert comentario newlines to <br> for HTML display
    const comentarioHtml = comentario ? comentario.replace(/\n/g, '<br/>') : '';

    // Create email HTML based on database type
    let emailHtml = '';
    if (useVirtualDb) {
      // Main pages email template (with payment status)
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nuevo Pedido - ${clientName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 30px; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px; }
            .client-info { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; }
            .client-info h3 { margin-top: 0; color: #495057; }
             .client-info p { margin: 8px 0; color: #6c757d; }
             .icon { width: 14px; height: 14px; vertical-align: -2px; margin-right: 6px; opacity: 0.7; }
             .info-table { width: 100%; border-collapse: collapse; }
             .info-table td { padding: 6px 8px; vertical-align: top; border-bottom: 1px dashed #e9ecef; }
             .info-table tr:last-child td { border-bottom: none; }
             .info-table td.label { width: 32%; color: #6c757d; font-weight: 600; }
            .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
             .order-table th, .order-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
            .order-table th { background-color: #f8f9fa; font-weight: 600; color: #495057; }
             .order-table tr:hover { background-color: #f8f9fa; }
             .order-table tbody tr:nth-child(even) { background-color: #fafafa; }
             .numeric { text-align: right; white-space: nowrap; }
             .center { text-align: center; }
             .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-weight: 600; font-size: 12px; }
            .footer-row { background-color: #e9ecef !important; font-weight: 600; }
            .total-row { background-color: #e9ecef !important; font-weight: 600; }
            .total-amount { font-size: 18px; color: #28a745; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
            .payment-status { 
              background: ${paymentStatus === 'pending' ? '#fff3cd' : '#d4edda'}; 
              border: 1px solid ${paymentStatus === 'pending' ? '#ffeaa7' : '#c3e6cb'}; 
              padding: 15px; 
              margin-top: 20px; 
              border-radius: 8px; 
            }
            .payment-status h3 { 
              color: ${paymentStatus === 'pending' ? '#856404' : '#155724'}; 
              margin-top: 0; 
            }
            .payment-status p { 
              color: ${paymentStatus === 'pending' ? '#856404' : '#155724'}; 
              margin-bottom: 10px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ Nuevo Pedido Recibido</h1>
              <p>${clientName} - ${Math.round(finalTotal).toLocaleString('de-DE')}</p>
            </div>
            <div class="content">
              <div class="section">
                <h2>👤 Información del Cliente</h2>
                <div class="client-info">
                  <table class="info-table">
                    <tr>
                      <td class="label">👤 Nombre(s)</td>
                      <td>${client.name || ''}</td>
                    </tr>
                    <tr>
                      <td class="label">👤 Apellido(s)</td>
                      <td>${client.surname || ''}</td>
                    </tr>
                    <tr>
                      <td class="label">📞 Teléfono</td>
                      <td>${client.phone || 'No proporcionado'}</td>
                    </tr>
                    <tr>
                      <td class="label">📧 Email</td>
                      <td>${client.email || 'No proporcionado'}</td>
                    </tr>
                    <tr>
                      <td class="label">🏠 Dirección</td>
                      <td>${client.address || 'No proporcionada'}</td>
                    </tr>
                    <tr>
                      <td class="label">📍 Ciudad / Dep.</td>
                      <td>${client.city || 'No proporcionada'}${client.department ? ' / ' + client.department : ''}</td>
                    </tr>
                  </table>
                </div>
              </div>
              <div class="section">
                <h2>📦 Artículos del Pedido</h2>
                <table class="order-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Color</th>
                      <th class="numeric">Precio</th>
                      <th class="center">Cantidad</th>
                      <th class="numeric">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cartItems.map((item: any) => {
                      let price: number;
                      if (item.selectedPrice === 'price1') {
                        price = item.product.price1;
                      } else if (item.selectedPrice === 'price2') {
                        price = item.product.price2;
                      } else {
                        // For virtual database, use the 'price' field
                        price = item.product.price;
                      }
                      const subtotal = price * item.quantity;
                      return `
                        <tr>
                          <td><strong>${item.product.name}</strong></td>
                          <td>${item.selectedColor ? `<span class="badge">${item.selectedColor}</span>` : '-'}</td>
                          <td class="numeric">${Math.round(price).toLocaleString('de-DE')}</td>
                          <td class="center">${item.quantity}</td>
                          <td class="numeric">${Math.round(subtotal).toLocaleString('de-DE')}</td>
                        </tr>
                      `;
                    }).join('')}
                    ${finalShippingCost > 0 ? `
                      <tr>
                        <td><strong>🚚 Envío</strong></td>
                        <td>-</td>
                         <td class="numeric">${Math.round(finalShippingCost).toLocaleString('de-DE')}</td>
                         <td class="center">1</td>
                         <td class="numeric">${Math.round(finalShippingCost).toLocaleString('de-DE')}</td>
                      </tr>
                    ` : ''}
                  </tbody>
                  <tfoot>
                    <tr class="footer-row">
                      <td colspan="4" style="vertical-align:top;">
                        ${comentario ? `<div><strong>Comentarios:</strong><br/><span>${comentarioHtml}</span></div>` : ''}
                      </td>
                      <td style="text-align:right; vertical-align:top;">
                        <div class="total-amount">${Math.round(finalTotal).toLocaleString('de-DE')}</div>
                        <div style="font-size:13px; color:#007bff; margin-top:4px;">
                          Tipo de Precio: ${useVirtualDb ? 'price' : (selectedPriceType === 'price1' ? '1' : '2')}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              ${(() => {
                const paymentMethod = comentario?.includes('wompi') ? 'Wompi' :
                                     comentario?.includes('pse') || comentario?.includes('bank_transfer') ? 'Transferencia Bancaria' :
                                     comentario?.includes('credit_card') ? 'Tarjeta de Crédito' :
                                     'No especificado';
                if (paymentStatus === 'pending') {
                  return `
                    <div class="payment-status">
                      <h3>⚠️ PEDIDO PENDIENTE DE PAGO</h3>
                      <p><strong>Método de Pago:</strong> ${paymentMethod}</p>
                      <p><strong>Estado:</strong> Esperando confirmación de pago</p>
                      <p><strong>Acción Requerida:</strong> Verificar recepción del pago y confirmar en el panel de administración</p>
                    </div>
                  `;
                } else {
                  return `
                    <div class="payment-status">
                      <h3>✅ PEDIDO CONFIRMADO</h3>
                      <p><strong>Estado:</strong> Pago confirmado</p>
                      <p><strong>Próximo paso:</strong> Procesar y enviar el pedido</p>
                    </div>
                  `;
                }
              })()}
            </div>
            <div class="footer">
              <p>Este pedido ha sido guardado en Firestore y el PDF adjunto contiene todos los detalles.</p>
              <p>ID del Pedido: ${docRef.id}</p>
              <p>Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Distri1/Naranjos2 email template (without payment status)
      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Nuevo Pedido - ${clientName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
            .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 16px; }
            .content { padding: 30px; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px; }
            .client-info { background: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; }
            .client-info h3 { margin-top: 0; color: #495057; }
            .client-info p { margin: 8px 0; color: #6c757d; }
            .order-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .order-table th, .order-table td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
            .order-table th { background-color: #f8f9fa; font-weight: 600; color: #495057; }
            .order-table tr:hover { background-color: #f8f9fa; }
            .order-table tbody tr:nth-child(even) { background-color: #fafafa; }
            .numeric { text-align: right; white-space: nowrap; }
            .center { text-align: center; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-weight: 600; font-size: 12px; }
            .footer-row { background-color: #e9ecef !important; font-weight: 600; }
            .total-amount { font-size: 18px; color: #28a745; font-weight: bold; }
            .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #6c757d; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🛍️ Nuevo Pedido Recibido</h1>
              <p>${clientName} - ${Math.round(finalTotal).toLocaleString('de-DE')}</p>
            </div>
            <div class="content">
              <div class="section">
                <h2>👤 Información del Cliente</h2>
                <div class="client-info">
                  <h3>${client.name} ${client.surname}</h3>
                  <p><strong>Empresa:</strong> ${client.companyName || 'N/A'}</p>
                  <p><strong>Teléfono:</strong> ${client.phone || 'N/A'}</p>
                  <p><strong>Email:</strong> ${client.email || 'N/A'}</p>
                  <p><strong>Dirección:</strong> ${client.address || 'N/A'}</p>
                  <p><strong>Ciudad:</strong> ${client.city || 'N/A'}</p>
                  <p><strong>Departamento:</strong> ${client.department || 'N/A'}</p>
                </div>
              </div>
              <div class="section">
                <h2>📦 Artículos del Pedido</h2>
                <table class="order-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Color</th>
                      <th class="numeric">Precio</th>
                      <th class="center">Cantidad</th>
                      <th class="numeric">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cartItems.map((item: any) => {
                      let price: number;
                      if (item.selectedPrice === 'price1') {
                        price = item.product.price1;
                      } else if (item.selectedPrice === 'price2') {
                        price = item.product.price2;
                      } else {
                        price = item.product.price;
                      }
                      const subtotal = price * item.quantity;
                      return `
                        <tr>
                          <td><strong>${item.product.name}</strong></td>
                          <td>${item.selectedColor ? `<span class="badge">${item.selectedColor}</span>` : '-'}</td>
                          <td class="numeric">${Math.round(price).toLocaleString('de-DE')}</td>
                          <td class="center">${item.quantity}</td>
                          <td class="numeric">${Math.round(subtotal).toLocaleString('de-DE')}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                  <tfoot>
                    <tr class="footer-row">
                      <td colspan="4" style="vertical-align:top;">
                        ${comentario ? `<div><strong>Comentarios:</strong><br/><span>${comentarioHtml}</span></div>` : ''}
                      </td>
                      <td style="text-align:right; vertical-align:top;">
                        <div class="total-amount">${Math.round(finalTotal).toLocaleString('de-DE')}</div>
                        <div style="font-size:13px; color:#007bff; margin-top:4px;">
                          Tipo de Precio: ${selectedPriceType === 'price1' ? '1' : '2'}
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <div class="footer">
              <p>Este pedido ha sido guardado en Firestore y el PDF adjunto contiene todos los detalles.</p>
              <p>ID del Pedido: ${docRef.id}</p>
              <p>Fecha: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Send email only for non-virtual orders (Distri1/Naranjos2)
    // For virtual orders, email will be sent after bank transfer confirmation
    if (!useVirtualDb) {
      console.log('📧 Starting email sending process for regular order...');
      try {
        console.log('📧 Attempting to send email:', {
          from: senderName,
          to: process.env.RESEND_TO_EMAIL || '',
          subject: `${clientName} - ${Math.round(finalTotal).toLocaleString('de-DE')}`,
          hasAttachments: !!fileUrl
        });

        console.log('📧 About to call resend.emails.send...');
        const emailResponse = await resend.emails.send({
          from: senderName,
          to: [process.env.RESEND_TO_EMAIL || ''],
          subject: `${clientName} - ${Math.round(finalTotal).toLocaleString('de-DE')}`,
          html: emailHtml,
          attachments: fileUrl ? [{ 
            filename: fileName || 'pedido.pdf',
            path: fileUrl
          }] : undefined
        });
        console.log('📧 Email sent successfully:', emailResponse);

        return NextResponse.json({
          success: true,
          orderId: docRef.id,
          invoiceNumber: invoiceNumber,
          message: 'Order sent successfully',
          emailId: emailResponse.data?.id || 'unknown'
        });

      } catch (emailError: any) {
        console.error('❌ Email sending error:', emailError);
        console.error('❌ Email error details:', {
          message: emailError.message,
          status: emailError.status,
          statusCode: emailError.statusCode,
          code: emailError.code,
          stack: emailError.stack
        });
        
        // Return success even if email fails, since order was saved
        return NextResponse.json({
          success: true,
          orderId: docRef.id,
          invoiceNumber: invoiceNumber,
          message: 'Order saved but email failed',
          emailError: emailError.message
        });
      }
    } else {
      // For virtual orders, just save the order without sending email
      // Email will be sent after bank transfer confirmation
      console.log('📧 Virtual order - skipping email (will be sent after bank transfer confirmation)');
      

      
      return NextResponse.json({
        success: true,
        orderId: useVirtualDb ? orderData.orders[0].orderId : docRef.id,
        invoiceNumber: invoiceNumber,
        message: 'Order saved successfully (email will be sent after bank transfer confirmation)',
        emailId: 'pending_bank_transfer'
      });
    }

  } catch (error: any) {
    console.error('Send order error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}