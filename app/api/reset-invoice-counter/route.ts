import { NextRequest, NextResponse } from 'next/server';
import { mainAdminDb } from '../../../lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Resetting invoice counter for today...');
    
    if (!mainAdminDb) {
      return NextResponse.json({
        success: false,
        error: 'Main Firebase Admin DB not available'
      }, { status: 500 });
    }
    
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const dateString = `${day}${month}${year}`;
    
    console.log('📅 Date string:', dateString);
    
    // Reset the counter for today to 0
    const counterDocRef = mainAdminDb.collection('invoiceCounters').doc(dateString);
    
    await counterDocRef.set({
      dateString,
      count: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastUpdated: FieldValue.serverTimestamp()
    });
    
    console.log('✅ Invoice counter reset to 0 for today');
    
    return NextResponse.json({
      success: true,
      dateString,
      message: 'Invoice counter reset successfully',
      nextInvoiceNumber: `INV-${dateString}-001`
    });
    
  } catch (error) {
    console.error('❌ Error resetting counter:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
