import { NextResponse } from 'next/server';
import { migrateData } from '../../../../scripts/migrate-to-postgres';

export async function POST() {
  try {
    console.log('🔄 Starting migration to PostgreSQL...');
    
    await migrateData();
    
    return NextResponse.json({
      success: true,
      message: 'Migration to PostgreSQL completed successfully'
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
