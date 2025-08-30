import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Vercel deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
      VIRTUAL_RESEND_API_KEY: process.env.VIRTUAL_RESEND_API_KEY || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_CLOUDINARY_CLOUD_NAME && envVars.VIRTUAL_CLOUDINARY_API_KEY && envVars.VIRTUAL_CLOUDINARY_API_SECRET) {
      console.log('✅ Using environment variables from process.env (Vercel deployment)');
      return envVars;
    }

    // Fallback to local file for development
    const fs = require('fs');
    const path = require('path');
    const envFilePath = path.join(process.cwd(), '.env.virtual.local');
    
    if (!fs.existsSync(envFilePath)) {
      // Don't log error for missing .env.virtual.local as it's expected in production
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
    
    return envVars;
  } catch (error) {
    // During build time or production, file system access might be restricted
    // Don't log errors for missing .env.virtual.local as it's expected in production
    return {
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
      VIRTUAL_RESEND_API_KEY: process.env.VIRTUAL_RESEND_API_KEY || '',
    };
  }
}

export async function POST(request: NextRequest) {
    // Check if required Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_PRIVATE_KEY ||
        !process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db } = await import('../../../lib/firebase');
  try {
    const { client, cartItems, selectedPriceType, comentario, paymentMethod, invoiceNumber, useVirtualDb, shippingCost, subtotal, total } = await request.json();
    
    // Provide fallback for invoiceNumber if not provided
    const finalInvoiceNumber = invoiceNumber || `PED-${Date.now()}`;
    
    // Debug: Log client data for virtual orders
    if (useVirtualDb) {
      console.log('🔍 Virtual PDF Generation - Client data received:', {
        name: client?.name,
        surname: client?.surname,
        email: client?.email,
        phone: client?.phone,
        address: client?.address,
        city: client?.city,
        department: client?.department,
        postalCode: client?.postalCode,
        companyName: client?.companyName,
        identification: client?.identification,
        cedula: client?.cedula
      });
    }
    

    // Configure Cloudinary based on whether this is virtual or regular
    const isVirtual = useVirtualDb === true;
    // Force modern layout for all PDFs (virtual and non-virtual)
    const useModernLayout = true;
    
    // Load virtual environment variables if needed
    let virtualEnv: { [key: string]: string } = {};
    if (isVirtual) {
      virtualEnv = loadVirtualEnv();
      console.log('🔍 Loaded virtual environment variables for Cloudinary');
      console.log('🔍 Virtual environment keys:', Object.keys(virtualEnv));
      console.log('🔍 Virtual Cloudinary config:', {
        cloudName: virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
        apiKey: virtualEnv.VIRTUAL_CLOUDINARY_API_KEY ? 'Set' : 'Missing',
        apiSecret: virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
      });
    }
    
    cloudinary.config({
      cloud_name: isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME || process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME : process.env.CLOUDINARY_CLOUD_NAME,
      api_key: isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_API_KEY || process.env.VIRTUAL_CLOUDINARY_API_KEY : process.env.CLOUDINARY_API_KEY,
      api_secret: isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET || process.env.VIRTUAL_CLOUDINARY_API_SECRET : process.env.CLOUDINARY_API_SECRET,
    });
    


    // Create PDF document - Letter size (8.5 x 11 inches) with high quality
    const doc = new jsPDF('p', 'pt', 'letter');
    
    // Set high quality rendering
    doc.setProperties({
      title: isVirtual ? 'Orden de Pedido - DistriNaranjos' : 'Pedido - DistriNaranjos',
      subject: isVirtual ? 'Orden de Pedido Virtual' : 'Pedido Regular',
      author: 'DistriNaranjos S.A.S.',
      creator: 'QuickOrder Web System'
    });
    
    const pageWidth = 612; // 8.5 * 72
    const pageHeight = 792; // 11 * 72
    const margin = 50;
    const contentWidth = pageWidth - 2 * margin;

    let yPosition = 30;
    let isEvenRow = false;
    
    // Helper function to ensure high quality text rendering
    const setHighQualityFont = (fontFamily: string, fontStyle: string, fontSize: number) => {
      doc.setFont(fontFamily, fontStyle);
      doc.setFontSize(fontSize);
    };

    // Professional footer function
    const drawFooter = () => {
      const footerY = pageHeight - 40;

      // Footer background
      doc.setFillColor(248, 249, 250);
      doc.rect(0, footerY - 25, pageWidth, 40, 'F');
      
      // Top border line
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(2);
      doc.line(0, footerY - 25, pageWidth, footerY - 25);
      
      // Company name
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      const companyName = 'DISTRINARANJOS S.A.S.';
      const companyWidth = doc.getTextWidth(companyName);
      doc.text(companyName, (pageWidth - companyWidth) / 2, footerY - 8);
      
      // Contact information
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const contactInfo = 'Cra. 46 N 47-66, Local: 9901 • La Candelaria, Medellín, Antioquia • Tel: 310 5921767 • info@distrinaranjos.com';
      const contactWidth = doc.getTextWidth(contactInfo);
      doc.text(contactInfo, (pageWidth - contactWidth) / 2, footerY + 5);
      
      // Professional note
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      const note = 'Este documento es un comprobante de pedido generado automáticamente';
      const noteWidth = doc.getTextWidth(note);
      doc.text(note, (pageWidth - noteWidth) / 2, footerY + 15);
    };

    // Helper function to add new page if needed
    const addNewPageIfNeeded = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - 80) { // Leave more space for footer (80pt from bottom)
        drawFooter(); // Add footer to current page before creating new one
        doc.addPage();
        yPosition = 30;
        drawHeader();
      }
    };

    // Load logo image
    let logoBase64: string | null = null;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-distrinaranjos.png');
      const logoBuffer = fs.readFileSync(logoPath);
      logoBase64 = logoBuffer.toString('base64');
    } catch (error) {
      console.log('⚠️ Logo not found, continuing without logo');
    }

    // Professional header design
    const drawHeader = () => {
      yPosition = 20;
      
      // Top colored band
      doc.setFillColor(25, 118, 210); // Professional blue
      doc.rect(0, 0, pageWidth, 8, 'F');
      
      // Header background with subtle gradient effect
      doc.setFillColor(248, 249, 250);
      doc.rect(0, 8, pageWidth, 110, 'F');
      
      // Company section (left side)
      yPosition = 30;
      
      // Add logo if available
      let logoWidth = 0;
      if (logoBase64) {
        try {
          const logoHeight = 50;
          logoWidth = 80;
          doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', margin, yPosition, logoWidth, logoHeight);
        } catch (error) {
          console.log('⚠️ Error adding logo to PDF:', error);
        }
      }
      
      // Company name - larger and more prominent
      setHighQualityFont('helvetica', 'bold', 16);
      doc.setTextColor(25, 118, 210);
      doc.text('DISTRINARANJOS S.A.S.', margin + logoWidth + 15, yPosition + 25);
      
      // Company contact info
      setHighQualityFont('helvetica', 'normal', 7);
      doc.setTextColor(120, 120, 120);
      doc.text('Cra. 46 N 47-66, Local: 9901', margin + logoWidth + 15, yPosition + 40);
      doc.text('La Candelaria, Medellín, Antioquia', margin + logoWidth + 15, yPosition + 53);
      doc.text('Tel: 310 5921767', margin + logoWidth + 15, yPosition + 66);
              doc.text('info@distrinaranjos.com', margin + logoWidth + 15, yPosition + 79);
      
      // Add extra spacing after email for modern layout to prevent overlap
      if (useModernLayout) {
        yPosition += 15; // Add extra space after email
      }
      
      // Invoice section (right side) - modern design
      const invoiceBoxX = pageWidth - 200;
      const invoiceBoxY = useModernLayout ? 35 : yPosition + 5; // Fixed position for modern layout
      const invoiceBoxWidth = 150;
      const invoiceBoxHeight = 70;
      
      // Invoice box background
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(2);
      doc.roundedRect(invoiceBoxX, invoiceBoxY, invoiceBoxWidth, invoiceBoxHeight, 8, 8, 'FD');
      
      // "FACTURA" or "PEDIDO" title
      setHighQualityFont('helvetica', 'bold', 14);
      doc.setTextColor(25, 118, 210);
      const invoiceTitle = useModernLayout ? 'Orden de Pedido' : 'PEDIDO';
      const titleWidth = doc.getTextWidth(invoiceTitle);
      doc.text(invoiceTitle, invoiceBoxX + (invoiceBoxWidth - titleWidth) / 2, invoiceBoxY + 20);
      
      // Invoice number
      setHighQualityFont('helvetica', 'bold', 10);
      doc.setTextColor(50, 50, 50);

      const invNumWidth = doc.getTextWidth(finalInvoiceNumber);
      doc.text(finalInvoiceNumber, invoiceBoxX + (invoiceBoxWidth - invNumWidth) / 2, invoiceBoxY + 38);
      
      // Date and time
      setHighQualityFont('helvetica', 'normal', 8);
      doc.setTextColor(100, 100, 100);
      const dateString = new Date().toLocaleDateString('es-CO', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: 'America/Bogota'
      });
      const timeString = new Date().toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/Bogota'
      });
      const dateTimeText = `${dateString} - ${timeString}`;
      const dateTimeWidth = doc.getTextWidth(dateTimeText);
      doc.text(dateTimeText, invoiceBoxX + (invoiceBoxWidth - dateTimeWidth) / 2, invoiceBoxY + 55);
      
      // Professional separator line - adjusted position for modern layout to prevent overlap
      const separatorY = useModernLayout ? 125 : yPosition; // Increased from 110 to 125
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(1);
      doc.line(margin, separatorY, pageWidth - margin, separatorY);
      
      // Set final yPosition for next sections
      yPosition = useModernLayout ? 140 : separatorY + 20; // Increased from 125 to 140
    };

    // Start first page
    drawHeader();
    
    // Debug: Log positioning for virtual orders
    if (isVirtual) {
      console.log('🔍 Virtual PDF - After header, yPosition:', yPosition);
    }

    // Professional client information section
    if (client) {
      addNewPageIfNeeded(200);
      
      // Section title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text('INFORMACIÓN DEL CLIENTE', margin, yPosition);
      yPosition += isVirtual ? 25 : 25; // Increased spacing for virtual orders to prevent overlap
      
      // Two-column layout for client info
      const leftColumnX = margin;
      const rightColumnX = margin + 280;
      const columnWidth = 250;
      
      // Professional card-style background - more compact for modern layout
      const cardHeight = 100;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(1);
      doc.roundedRect(margin - 10, yPosition - 10, pageWidth - 2 * margin + 20, cardHeight, 8, 8, 'FD');
      
      // Add subtle inner border
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin - 5, yPosition - 5, pageWidth - 2 * margin + 10, cardHeight - 10, 5, 5, 'S');
      
      let leftYPos = yPosition + 10;
      let rightYPos = yPosition + 10;
      const lineHeight = 11; // Better line height for readability
      
      // Enhanced field helper function
      const addClientField = (label: string, value: string, xPos: number, yPos: number, isLeftColumn: boolean = true) => {
        if (value && value.trim()) {
          // Label with professional styling
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(100, 100, 100);
          doc.text(`${label.toUpperCase()}:`, xPos, yPos);
          
          // Value with emphasis
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(50, 50, 50);
          const wrappedText = doc.splitTextToSize(value, columnWidth - 80);
          doc.text(wrappedText, xPos + 80, yPos);
          
          // Update position for next field with better spacing
          const textHeight = Array.isArray(wrappedText) ? wrappedText.length * lineHeight : lineHeight;
          const spacing = 2; // Add small spacing between fields
          if (isLeftColumn) {
            leftYPos += textHeight + spacing;
          } else {
            rightYPos += textHeight + spacing;
          }
          
          return textHeight;
        }
        return 0;
      };
      
      // Left column fields: Empresa first, then Nombre
      // Only show Empresa for non-virtual orders (regular orders)
      if (client.companyName && !isVirtual) {
        addClientField('Empresa', client.companyName, leftColumnX, leftYPos);
      }
      if (client.name) {
        addClientField('Nombre', client.name, leftColumnX, leftYPos);
      }
      if (client.surname) {
        addClientField('Apellido', client.surname, leftColumnX, leftYPos);
      }
      if (client.identification || client.cedula) {
        const label = 'Cédula';
        const cedulaValue = client.cedula || client.identification;
        addClientField(label, cedulaValue, leftColumnX, leftYPos);
      }
      // For modern layout, move some fields to left column for better balance
      if (client.email) {
        addClientField('Correo', client.email, leftColumnX, leftYPos);
      }
      if (client.phone) {
        addClientField('Teléfono', client.phone, leftColumnX, leftYPos);
      }
      
      // Right column fields
      // (no alternate right-column duplicates for modern layout)
      
      if (client.address) {
        addClientField('Dirección', client.address, rightColumnX, rightYPos, false);
      }
      
      // Location fields - modern layout shows separate fields
      if (true) {
        if (client.city) {
          addClientField('Ciudad', client.city, rightColumnX, rightYPos, false);
        }
        if (client.department) {
          addClientField('Departamento', client.department, rightColumnX, rightYPos, false);
        }
        if (client.postalCode) {
          addClientField('Código Postal', client.postalCode, rightColumnX, rightYPos, false);
        }
      }
      
      yPosition += cardHeight + 3; // Reduced spacing for modern layout
      
      // Payment method section
      if (paymentMethod && paymentMethod.trim()) {
        // Payment method section title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(25, 118, 210);
        doc.text('MÉTODO DE PAGO', margin, yPosition + 10);
        yPosition += 25; // Reduced spacing for modern layout
        
        // Payment method card - more compact for modern layout
        const paymentHeight = 45;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(1);
        doc.roundedRect(margin - 10, yPosition - 10, pageWidth - 2 * margin + 20, paymentHeight, 8, 8, 'FD');
        
        // Inner border with accent color
        doc.setDrawColor(255, 152, 0);
        doc.setLineWidth(0.5);
        doc.roundedRect(margin - 5, yPosition - 5, pageWidth - 2 * margin + 10, paymentHeight - 10, 5, 5, 'S');
        
        // Payment method content
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(70, 70, 70);
        const wrappedPaymentMethod = doc.splitTextToSize(paymentMethod, pageWidth - 2 * margin - 20);
        doc.text(wrappedPaymentMethod, margin, yPosition + 15);
        
        yPosition += paymentHeight + 15; // Reduced spacing for modern layout
      }
    }

    // Professional products table section
    addNewPageIfNeeded(80);
    
    // Products section title
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 118, 210);
    doc.text('DETALLE DE PRODUCTOS', margin, yPosition);
    yPosition += 20; // Reduced spacing for modern layout
    
    // Professional table header with gradient-like effect - more compact for virtual orders
    const tableHeaderHeight = 28;
    doc.setFillColor(25, 118, 210);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, tableHeaderHeight, 'F');
    
    // Header border
    doc.setDrawColor(20, 100, 180);
    doc.setLineWidth(1);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, tableHeaderHeight, 'S');
    
    // Table column definitions with better spacing
    const colWidths = [230, 50, 65, 75, 60]; // Optimized column widths for better spacing
    const columnX = [
      margin + 10,                           // Referencia
      margin + 10 + colWidths[0],           // Color  
      margin + 10 + colWidths[0] + colWidths[1], // Cantidad
      margin + 10 + colWidths[0] + colWidths[1] + colWidths[2], // Precio
      margin + 10 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] // Subtotal
    ];
    
    // Table headers with white text
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('REFERENCIA', columnX[0], yPosition + 18);
    doc.text('COLOR', columnX[1], yPosition + 18);
    doc.text('CANT.', columnX[2], yPosition + 18);
    doc.text('PRECIO', columnX[3], yPosition + 18);
    doc.text('SUBTOTAL', columnX[4], yPosition + 18);
    
    yPosition += tableHeaderHeight + 3; // Reduced spacing for modern layout

    // Add products
    let calculatedSubtotal = 0;
    let totalItems = 0;

    // Check if cartItems is empty or null
    if (!cartItems || cartItems.length === 0) {
      // Add a message to the PDF indicating no items
      doc.setFontSize(12);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(255, 0, 0);
      doc.text('No hay productos en este pedido', margin + 10, yPosition + 20);
      yPosition += 40;
    } else {

      // Sort items by brand and name (like iOS app)
      const sortedItems = cartItems.sort((a: unknown, b: unknown) => {
      if ((a as any).product.brand.toLowerCase() === (b as any).product.brand.toLowerCase()) {
        return (a as any).product.name.toLowerCase().localeCompare((b as any).product.name.toLowerCase());
      }
      return (a as any).product.brand.toLowerCase().localeCompare((b as any).product.brand.toLowerCase());
    });

    sortedItems.forEach((item: unknown, index: number) => {
      let price: number;
      if (isVirtual) {
        // Virtual environment always uses the 'price' field
        price = (item as any).product.price;
      } else {
        // Regular environment uses price1/price2
        if ((item as any).selectedPrice === 'price1') {
          price = (item as any).product.price1;
        } else {
          price = (item as any).product.price2;
        }
      }
      const itemTotal = price * (item as any).quantity;
      calculatedSubtotal += itemTotal;
      totalItems += (item as any).quantity;

      addNewPageIfNeeded(35);

      const rowHeight = 30;
      
      // Professional alternating row background
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(margin, yPosition, pageWidth - 2 * margin, rowHeight, 'F');
      
      // Row border
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.5);
      doc.rect(margin, yPosition, pageWidth - 2 * margin, rowHeight, 'S');

      // Product information with better typography
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);

      // Product name with brand - truncate if too long
      const productText = `${(item as any).product.brand} - ${(item as any).product.name}`;
      const maxProductWidth = colWidths[0] - 10;
      const truncatedProduct = doc.splitTextToSize(productText, maxProductWidth)[0];
      doc.text(truncatedProduct, columnX[0], yPosition + 20);

      // Color with better styling
      doc.setTextColor(100, 100, 100);
      doc.text((item as any).selectedColor || 'N/A', columnX[1], yPosition + 20);

      // Quantity with emphasis
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      let quantityColor: number[];
      if (isVirtual) {
        quantityColor = [255, 152, 0]; // Orange for virtual
      } else if ((item as any).selectedPrice === 'price1') {
        quantityColor = [34, 139, 34]; // Forest green
      } else {
        quantityColor = [25, 118, 210]; // Professional blue
      }
      doc.setTextColor(quantityColor[0], quantityColor[1], quantityColor[2]);
      doc.text((item as any).quantity.toString(), columnX[2] + 15, yPosition + 20);

      // Price with professional formatting
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      const priceText = `$${Math.round(price).toLocaleString('es-CO')}`;
      doc.text(priceText, columnX[3], yPosition + 20);

      // Subtotal with emphasis
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      const totalText = `$${Math.round(itemTotal).toLocaleString('es-CO')}`;
      doc.text(totalText, columnX[4], yPosition + 20);

      yPosition += rowHeight;
    });
    } // Close the else block for non-empty cartItems

    // Professional totals section
    addNewPageIfNeeded(140);
    yPosition += 20;

    // Totals section title - only show for classic layout (disabled for modern)
    if (false) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text('RESUMEN DEL PEDIDO', margin, yPosition);
      yPosition += 25;
    }

    // Professional totals box - more compact
    const totalBoxWidth = 280;
    const totalBoxHeight = 107;
    const totalBoxX = pageWidth - margin - totalBoxWidth;
    const totalBoxY = yPosition;

    // Main totals background with professional styling
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(25, 118, 210);
    doc.setLineWidth(2);
    doc.roundedRect(totalBoxX, totalBoxY, totalBoxWidth, totalBoxHeight, 10, 10, 'FD');

    // Inner content area
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(1);
    doc.roundedRect(totalBoxX + 10, totalBoxY + 10, totalBoxWidth - 20, totalBoxHeight - 20, 5, 5, 'FD');

    let currentY = totalBoxY + 25;
    const labelX = totalBoxX + 20;
    const valueX = totalBoxX + totalBoxWidth - 80;

    // Total quantity with professional styling
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Total de Artículos:', labelX, currentY);
    
    doc.setFont('helvetica', 'bold');
    let totalQuantityColor: number[];
    if (isVirtual) {
      totalQuantityColor = [255, 152, 0]; // Orange for virtual
    } else if (selectedPriceType === 'price1') {
      totalQuantityColor = [34, 139, 34]; // Forest green
    } else {
      totalQuantityColor = [25, 118, 210]; // Professional blue
    }
    doc.setTextColor(totalQuantityColor[0], totalQuantityColor[1], totalQuantityColor[2]);
    doc.text(`${totalItems} unidades`, valueX, currentY);
    currentY += 15;

    // Professional separator line
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(1);
    doc.line(labelX, currentY - 3, totalBoxX + totalBoxWidth - 20, currentY - 3);
    currentY += 8;

    // Use provided totals or fallback to calculated values
    const finalSubtotal = subtotal || calculatedSubtotal;
    
    // Calculate shipping cost properly for virtual environment
    let finalShippingCost = 0;
    if (isVirtual) {
      // If shipping cost was provided, use it; otherwise calculate it
      if (typeof shippingCost === 'number') {
        finalShippingCost = shippingCost;
      } else {
        // Calculate shipping based on virtual environment settings
        const shippingThreshold = parseInt(process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '200000');
        const baseShippingCost = parseInt(process.env.VIRTUAL_SHIPPING_COST || '25000');
        finalShippingCost = finalSubtotal < shippingThreshold ? baseShippingCost : 0;
  
      }
    } else {
      // Regular environment doesn't show shipping
      finalShippingCost = 0;
    }
    
    const finalTotal = total || (finalSubtotal + finalShippingCost);
    


    // Subtotal with professional styling
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(70, 70, 70);
    doc.text('Subtotal:', labelX, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`$${Math.round(finalSubtotal).toLocaleString('es-CO')}`, valueX, currentY);
    currentY += 14;

    if (isVirtual) {
      // Shipping line with enhanced styling
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      doc.text('Costo de Envío:', labelX, currentY);
      
      if (finalShippingCost > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 152, 0);
        doc.text(`$${Math.round(finalShippingCost).toLocaleString('es-CO')}`, valueX, currentY);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(34, 139, 34); // Green for free shipping
        doc.text('GRATIS', valueX, currentY);
      }
      currentY += 16;

      // Professional separator before total
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(2);
      doc.line(labelX, currentY - 3, totalBoxX + totalBoxWidth - 20, currentY - 3);
      currentY += 10; // Increased spacing after separator line

      // Final total with emphasis
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text('TOTAL:', labelX, currentY);
      doc.setTextColor(220, 53, 69); // Professional red
      doc.text(`$${Math.round(finalTotal).toLocaleString('es-CO')}`, valueX, currentY);
    } else {
      // For regular environment, enhanced total styling
      currentY += 8; // Increased spacing before separator
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(2);
      doc.line(labelX, currentY - 5, totalBoxX + totalBoxWidth - 20, currentY - 5);
      currentY += 8;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text('TOTAL:', labelX, currentY);
      doc.setTextColor(220, 53, 69);
      doc.text(`$${Math.round(finalTotal).toLocaleString('es-CO')}`, valueX, currentY);
    }

    // Add comentario section for distri1 and naranjos2 (regular pages only)
    if (!isVirtual && comentario && comentario.trim() !== '') {
      addNewPageIfNeeded(80);
      
      // Comentario section title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(25, 118, 210);
      doc.text('COMENTARIOS', margin, yPosition);
      yPosition += 20;
      
      // Comentario content box - flexible height based on text content
      const comentarioBoxWidth = pageWidth - 2 * margin - 320; // Leave space for totals box
      
      // Calculate required height based on text content
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const wrappedComentario = doc.splitTextToSize(comentario, comentarioBoxWidth - 20);
      const lineHeight = 12; // Height per line of text
      const minHeight = 40; // Minimum box height
      const textHeight = wrappedComentario.length * lineHeight;
      const comentarioBoxHeight = Math.max(minHeight, textHeight + 20); // Add padding
      
      // Draw the flexible box
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(1);
      doc.roundedRect(margin - 10, yPosition - 10, comentarioBoxWidth + 20, comentarioBoxHeight, 8, 8, 'FD');
      
      // Inner border with accent color
      doc.setDrawColor(25, 118, 210);
      doc.setLineWidth(0.5);
      doc.roundedRect(margin - 5, yPosition - 5, comentarioBoxWidth + 10, comentarioBoxHeight - 10, 5, 5, 'S');
      
      // Comentario content
      doc.setTextColor(70, 70, 70);
      doc.text(wrappedComentario, margin, yPosition + 15);
      
      yPosition += comentarioBoxHeight + 20;
    }

    // Add footer to final page

    drawFooter();


    // Generate current date and time for filename
    const now = new Date();
    // Convert to Bogota time
    const bogotaNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const day = String(bogotaNow.getDate()).padStart(2, '0');
    const month = String(bogotaNow.getMonth() + 1).padStart(2, '0');
    const year = bogotaNow.getFullYear();
    const hours = String(bogotaNow.getHours()).padStart(2, '0');
    const minutes = String(bogotaNow.getMinutes()).padStart(2, '0');
    const companyName = client?.companyName || 'Cliente';
    const filename = `${companyName} - ${day}.${month}.${year}_${hours}.${minutes}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Upload to Cloudinary (required for frontend download)
    let cloudinaryResponse: any = null;
    try {
      const cloudName = isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME || process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME : process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_API_KEY || process.env.VIRTUAL_CLOUDINARY_API_KEY : process.env.CLOUDINARY_API_KEY;
      const apiSecret = isVirtual ? virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET || process.env.VIRTUAL_CLOUDINARY_API_SECRET : process.env.CLOUDINARY_API_SECRET;
      
      console.log('🔧 Cloudinary config check:', {
        isVirtual,
        cloudName: cloudName ? '✅ Set' : '❌ Missing',
        apiKey: apiKey ? '✅ Set' : '❌ Missing',
        apiSecret: apiSecret ? '✅ Set' : '❌ Missing'
      });
      
      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Missing Cloudinary credentials');
      }
      
      // Re-configure cloudinary with the correct credentials before upload
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      
      const base64PDF = pdfBuffer.toString('base64');
      const dataURI = `data:application/pdf;base64,${base64PDF}`;
      
      console.log('📤 Uploading PDF to Cloudinary...');
      console.log('📤 Cloudinary config:', {
        cloud_name: cloudName,
        api_key: apiKey ? 'Set' : 'Missing',
        api_secret: apiSecret ? 'Set' : 'Missing'
      });
      console.log('📤 Upload params:', {
        resource_type: 'raw',
        public_id: `pedidos/${filename}`,
        format: 'pdf',
        dataURI_length: dataURI.length
      });
      
      cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
        resource_type: 'raw',
        public_id: `pedidos/${filename}`,
        format: 'pdf'
      });
      
      console.log('✅ Cloudinary upload successful:', {
        url: cloudinaryResponse.secure_url,
        public_id: cloudinaryResponse.public_id,
        format: cloudinaryResponse.format,
        resource_type: cloudinaryResponse.resource_type
      });
    } catch (cloudinaryError) {
      console.error('❌ Cloudinary upload failed:', cloudinaryError);
      console.error('📋 Error details:', {
        message: cloudinaryError instanceof Error ? cloudinaryError.message : 'Unknown error',
        stack: cloudinaryError instanceof Error ? cloudinaryError.stack : undefined,
        isVirtual,
        filename,
        cloudName: 'Not set',
        apiKey: 'Missing',
        apiSecret: 'Missing'
      });
    }

    // Remove Firestore saving from here - it will be handled by send-order endpoint
    // if (db && cloudinaryResponse) {
    //   try {
    //     const orderDetails = `Cliente: ${client.companyName || 'N/A'} | Total: ${Math.round(total).toLocaleString('de-DE')} | Tipo: ${isVirtual ? 'Virtual' : (selectedPriceType === 'price1' ? 'Precio 1' : 'Precio 2')} | Método de Pago: ${paymentMethod || 'N/A'}`;

    //     const orderData = {
    //       userId: 'web-client',
    //       userName: client.companyName || client.name || 'Cliente Web',
    //       timestamp: serverTimestamp(),
    //       orderDetails: orderDetails,
    //       fileUrl: cloudinaryResponse.secure_url,
    //       fileName: filename,
    //       deliveredTo: ['ZXV4MSAsQEeGUzSm5YMj7FICXII3'], // iOS app user ID
    //       readBy: []
    //     };

    //     const docRef = await addDoc(collection(db, 'orders'), orderData);
    //     console.log('✅ Order sent to Firestore successfully');
    //     console.log('📄 PDF URL:', cloudinaryResponse.secure_url);
    //     console.log('📄 Filename:', filename);
    //     console.log('📄 Order ID:', docRef.id);
    //     console.log('📄 Order Data:', JSON.stringify(orderData, null, 2));
    //     console.log('📄 Collection: orders');
    //     console.log('📄 Firestore Project ID: quickorder-b33b4');
    //     console.log('📄 Test: Order should be visible to iOS app');
    //     console.log('📄 iOS User ID: ZXV4MSAsQEeGUzSm5YMj7FICXII3');
    //     console.log('📄 Web Order User ID: web-client');
    //     console.log('📄 Delivered To: ZXV4MSAsQEeGUzSm5YMj7FICXII3');
    //   } catch (firestoreError) {
    //     console.error('❌ Error sending to Firestore:', firestoreError);
    //     // Continue with PDF generation even if Firestore fails
    //   }
    // } else {
    //   if (!db) {
    //     console.log('ℹ️ Firebase not configured - order not sent to Firestore');
    //   }
    //   if (!cloudinaryResponse) {
    //     console.log('ℹ️ Cloudinary upload failed - order not sent to Firestore');
    //   }
    // }

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    };

    if (cloudinaryResponse) {
      headers['X-Cloudinary-URL'] = cloudinaryResponse.secure_url;
      headers['X-Cloudinary-Public-ID'] = cloudinaryResponse.public_id;
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: 'Error al generar PDF. Por favor intente de nuevo.' },
      { status: 500 }
    );
  }
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