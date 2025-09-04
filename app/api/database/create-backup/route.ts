import { NextResponse } from 'next/server';
import { autoBackup } from '../../../scripts/backup-restore';

export async function POST() {
  try {
    console.log('🔄 Creating database backup...');
    
    autoBackup();
    
    return NextResponse.json({
      success: true,
      message: 'Database backup created successfully'
    });
    
  } catch (error) {
    console.error('❌ Backup creation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
