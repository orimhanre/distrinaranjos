import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';

interface TokenRegistration {
  fcmToken: string;
  userId: string;
  userEmail: string;
  deviceInfo?: {
    platform: string;
    version: string;
    model?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: TokenRegistration = await request.json();
    const { fcmToken, userId, userEmail, deviceInfo } = body;

    if (!fcmToken || !userId || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required fields: fcmToken, userId, userEmail' },
        { status: 400 }
      );
    }

    const db = initDatabase('virtual');
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 }
      );
    }

    // Store FCM token in database
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fcm_tokens (
        fcm_token, 
        user_id, 
        user_email, 
        device_platform, 
        device_version, 
        device_model, 
        created_at, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      fcmToken,
      userId,
      userEmail,
      deviceInfo?.platform || 'iOS',
      deviceInfo?.version || 'Unknown',
      deviceInfo?.model || 'Unknown'
    );

    console.log(`✅ FCM token registered for user: ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'FCM token registered successfully'
    });

  } catch (error) {
    console.error('❌ Error registering FCM token:', error);
    return NextResponse.json(
      { error: 'Failed to register FCM token' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fcmToken = searchParams.get('token');
    const userEmail = searchParams.get('email');

    if (!fcmToken || !userEmail) {
      return NextResponse.json(
        { error: 'Missing required parameters: token, email' },
        { status: 400 }
      );
    }

    const db = initDatabase('virtual');
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 }
      );
    }

    // Remove FCM token from database
    const stmt = db.prepare(`
      DELETE FROM fcm_tokens 
      WHERE fcm_token = ? AND user_email = ?
    `);

    const result = stmt.run(fcmToken, userEmail);

    if (result.changes > 0) {
      console.log(`✅ FCM token removed for user: ${userEmail}`);
      return NextResponse.json({
        success: true,
        message: 'FCM token removed successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'FCM token not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('❌ Error removing FCM token:', error);
    return NextResponse.json(
      { error: 'Failed to remove FCM token' },
      { status: 500 }
    );
  }
}
