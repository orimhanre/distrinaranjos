import { NextRequest, NextResponse } from 'next/server';
import { generateInvoiceNumber } from '@/lib/invoiceNumber';

export async function POST(request: NextRequest) {
  try {
    const { useVirtualDb = false } = await request.json();
    
    console.log('🔍 Generating invoice number for:', {
      useVirtualDb,
      timestamp: new Date().toISOString()
    });
    
    const invoiceNumber = await generateInvoiceNumber(useVirtualDb);
    
    console.log('✅ Invoice number generated:', invoiceNumber);
    
    return NextResponse.json({ 
      invoiceNumber,
      success: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating invoice number:', error);
    
    return NextResponse.json(
      { 
        error: 'Error generating invoice number',
        message: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    );
  }
}
