import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

function loadVirtualEnv() {
  try {
    const virtualEnvPath = path.resolve(process.cwd(), '.env.virtual.local');
    if (fs.existsSync(virtualEnvPath)) {
      const content = fs.readFileSync(virtualEnvPath, 'utf8');
      const envVars: { [key: string]: string } = {};

      content.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalIndex = trimmedLine.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmedLine.substring(0, equalIndex);
            const value = trimmedLine.substring(equalIndex + 1);
            envVars[key] = value;
          }
        }
      });

      return envVars;
    }
  } catch (error) {
    console.error('Error loading virtual environment:', error);
  }
  return {};
}

interface NotificationPayload {
  title: string;
  body: string;
  type: 'new_order' | 'order_update' | 'system';
  data?: Record<string, string>;
  targetUsers?: string[]; // Array of user emails to target
  targetAll?: boolean; // Send to all registered users
  // Order details for new_order type
  orderDetails?: {
    clientName: string;
    clientSurname: string;
    products: Array<{
      name: string;
      quantity: number;
    }>;
    totalAmount: number;
    invoiceNumber: string;
  };
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
    const { db } = await import('../../../../lib/firebase');
  try {
    // Initialize Firebase Admin if not already initialized
    if (!getApps().length) {
      console.log('🔧 Initializing Firebase Admin for push notifications...');
      
      const virtualEnv = loadVirtualEnv();
      
      initializeApp({
        credential: cert({
          projectId: virtualEnv.VIRTUAL_FIREBASE_PROJECT_ID || process.env.VIRTUAL_FIREBASE_PROJECT_ID,
          clientEmail: virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL || process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL,
          privateKey: (virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY || process.env.VIRTUAL_FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('✅ Firebase Admin initialized for push notifications');
    }

    const requestBody: NotificationPayload = await request.json();
    const { title, body: messageBody, type, data = {}, targetUsers, targetAll = false } = requestBody;

    if (!title || !messageBody || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: title, body, type' },
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
    
    // Get FCM tokens based on target
    let tokens: string[] = [];
    
    if (targetAll) {
      // Get all FCM tokens
      const stmt = db.prepare("SELECT fcm_token FROM fcm_tokens WHERE fcm_token IS NOT NULL AND fcm_token != ''");
      const result = stmt.all() as { fcm_token: string }[];
      tokens = result.map(row => row.fcm_token);
    } else if (targetUsers && targetUsers.length > 0) {
      // Get FCM tokens for specific users
      const placeholders = targetUsers.map(() => '?').join(',');
      const stmt = db.prepare(`SELECT fcm_token FROM fcm_tokens WHERE user_email IN (${placeholders}) AND fcm_token IS NOT NULL`);
      const result = stmt.all(...targetUsers) as { fcm_token: string }[];
      tokens = result.map(row => row.fcm_token);
    } else {
      return NextResponse.json(
        { error: 'Must specify either targetUsers or targetAll' },
        { status: 400 }
      );
    }

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No FCM tokens found for the specified targets' },
        { status: 404 }
      );
    }

    // Get current badge count for each user and increment it
    let badgeCount = 1;
    if (targetUsers && targetUsers.length > 0) {
      // For specific users, get their individual badge counts
      const placeholders = targetUsers.map(() => '?').join(',');
      const badgeStmt = db.prepare(`SELECT user_email, badge_count FROM badge_counts WHERE user_email IN (${placeholders})`);
      const badgeResults = badgeStmt.all(...targetUsers) as { user_email: string; badge_count: number }[];
      
      // Update badge counts for each user
      const updateStmt = db.prepare('INSERT OR REPLACE INTO badge_counts (user_email, badge_count, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)');
      for (const user of targetUsers) {
        const existingBadge = badgeResults.find(r => r.user_email === user);
        const newBadgeCount = (existingBadge?.badge_count || 0) + 1;
        updateStmt.run(user, newBadgeCount);
      }
      
      // Use the highest badge count for the notification
      badgeCount = Math.max(...badgeResults.map(r => r.badge_count + 1), 1);
    } else {
      // For all users, get all FCM token users and increment their badge counts
      const userStmt = db.prepare('SELECT DISTINCT user_email FROM fcm_tokens WHERE user_email IS NOT NULL');
      const users = userStmt.all() as { user_email: string }[];
      
      // Get current badge counts for these users
      const badgeStmt = db.prepare('SELECT user_email, badge_count FROM badge_counts WHERE user_email IN (SELECT DISTINCT user_email FROM fcm_tokens)');
      const badgeResults = badgeStmt.all() as { user_email: string; badge_count: number }[];
      
      // Update badge counts for all users
      const updateStmt = db.prepare('INSERT OR REPLACE INTO badge_counts (user_email, badge_count, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)');
      for (const user of users) {
        const existingBadge = badgeResults.find(r => r.user_email === user.user_email);
        const newBadgeCount = (existingBadge?.badge_count || 0) + 1;
        updateStmt.run(user.user_email, newBadgeCount);
      }
      
      // Use the highest badge count for the notification
      badgeCount = Math.max(...badgeResults.map(r => r.badge_count + 1), 1);
    }

    // Create Spanish notification content based on type
    let notificationTitle = title;
    let notificationBody = messageBody;

    if (type === 'new_order' && requestBody.orderDetails) {
      const { clientName, clientSurname, products, totalAmount, invoiceNumber } = requestBody.orderDetails;
      
      // Spanish notification for new orders
      notificationTitle = `🛒 Nuevo Pedido - ${invoiceNumber}`;
      
      // Create product list
      const productList = products.map(p => `${p.name} (${p.quantity})`).join(', ');
      
      notificationBody = `Cliente: ${clientName} ${clientSurname}\nProductos: ${productList}\nTotal: $${totalAmount.toLocaleString()}`;
    } else if (type === 'order_update') {
      notificationTitle = `📦 Actualización de Pedido`;
      notificationBody = messageBody || 'Tu pedido ha sido actualizado';
    } else if (type === 'system') {
      notificationTitle = `🔔 Notificación del Sistema`;
      notificationBody = messageBody;
    }

    // Prepare notification message
    const message = {
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        type,
        ...data,
        ...(requestBody.orderDetails && {
          clientName: requestBody.orderDetails.clientName,
          clientSurname: requestBody.orderDetails.clientSurname,
          invoiceNumber: requestBody.orderDetails.invoiceNumber,
          totalAmount: requestBody.orderDetails.totalAmount.toString(),
        }),
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high' as const,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: badgeCount,
          },
        },
      },
    };

    // Send notifications in batches (FCM allows max 500 tokens per request)
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    const messaging = getMessaging();
    const results = [];

    for (const batch of batches) {
      try {
        const multicastMessage: MulticastMessage = {
          tokens: batch,
          notification: message.notification,
          data: message.data,
          android: message.android,
          apns: message.apns,
        };

        const response = await messaging.sendEachForMulticast(multicastMessage);

        results.push({
          successCount: response.successCount,
          failureCount: response.failureCount,
          responses: response.responses,
        });

        // Handle failed tokens
        if (response.failureCount > 0) {
          const failedTokens = response.responses
            .map((resp: any, idx: number) => resp.success ? null : batch[idx])
            .filter((token: string | null) => token !== null);

          // Remove failed tokens from database
          if (failedTokens.length > 0) {
            const deleteStmt = db.prepare('DELETE FROM fcm_tokens WHERE fcm_token = ?');
            for (const token of failedTokens) {
              deleteStmt.run(token);
            }
            console.log(`🗑️ Removed ${failedTokens.length} invalid FCM tokens`);
          }
        }

      } catch (error: any) {
        console.error('❌ Error sending batch notification:', error);
        results.push({ error: error.message });
      }
    }

    const totalSuccess = results.reduce((sum, result) => sum + (result.successCount || 0), 0);
    const totalFailure = results.reduce((sum, result) => sum + (result.failureCount || 0), 0);

    console.log(`📱 Push notification sent: ${totalSuccess} successful, ${totalFailure} failed`);

    return NextResponse.json({
      success: true,
      message: `Notification sent to ${totalSuccess} devices`,
      results: {
        totalSuccess,
        totalFailure,
        batches: results,
      },
    });

  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification' },
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