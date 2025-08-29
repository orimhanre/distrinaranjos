import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

// GET /api/push-notifications/list-tokens - List all stored FCM tokens
export async function GET() {
  try {
    const db = initDatabase('virtual');
    
    // Get all FCM tokens with user info
    const stmt = db.prepare(`
      SELECT 
        fcm_token,
        user_id,
        user_email,
        device_platform,
        device_version,
        device_model,
        created_at,
        updated_at
      FROM fcm_tokens 
      ORDER BY created_at DESC
    `);
    
    const tokens = stmt.all() as any[];
    
    return NextResponse.json({
      success: true,
      count: tokens.length,
      tokens: tokens.map(token => ({
        ...token,
        fcm_token: token.fcm_token ? `${token.fcm_token.substring(0, 20)}...` : null, // Mask for security
        created_at: token.created_at,
        updated_at: token.updated_at
      }))
    });
  } catch (error) {
    console.error('Error listing FCM tokens:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list FCM tokens' },
      { status: 500 }
    );
  }
}
