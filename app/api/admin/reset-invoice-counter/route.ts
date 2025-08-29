import { NextRequest, NextResponse } from 'next/server';
import { resetTodayCounter } from '@/lib/invoiceNumber';

export async function POST(request: NextRequest) {
  try {
    const { useVirtualDb } = await request.json();
    
    console.log('🔄 API: Resetting invoice counter for:', useVirtualDb ? 'virtual' : 'main');
    
    await resetTodayCounter(useVirtualDb);
    
    return NextResponse.json({ 
      success: true, 
      message: `Invoice counter reset for ${useVirtualDb ? 'virtual' : 'main'} database`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('🔄 API Error resetting invoice counter:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
