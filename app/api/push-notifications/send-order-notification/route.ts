import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';

function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Railway deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_FIREBASE_PROJECT_ID: process.env.VIRTUAL_FIREBASE_PROJECT_ID || '',
      VIRTUAL_FIREBASE_CLIENT_EMAIL: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL || '',
      VIRTUAL_FIREBASE_PRIVATE_KEY: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_FIREBASE_PROJECT_ID && envVars.VIRTUAL_FIREBASE_CLIENT_EMAIL && envVars.VIRTUAL_FIREBASE_PRIVATE_KEY) {
      console.log('✅ Using environment variables from process.env (Railway deployment)');
      return envVars;
    }

    // Fallback to local file for development
    const virtualEnvPath = path.resolve(process.cwd(), '.env.virtual.local');
    if (fs.existsSync(virtualEnvPath)) {
      const content = fs.readFileSync(virtualEnvPath, 'utf8');

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
    // Silent error handling
  }
  
  // Return process.env fallback
  return {
    VIRTUAL_FIREBASE_PROJECT_ID: process.env.VIRTUAL_FIREBASE_PROJECT_ID || '',
    VIRTUAL_FIREBASE_CLIENT_EMAIL: process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL || '',
    VIRTUAL_FIREBASE_PRIVATE_KEY: process.env.VIRTUAL_FIREBASE_PRIVATE_KEY || '',
  };
}

interface OrderNotificationPayload {
  clientName: string;
  clientSurname: string;
  products: Array<{
    name: string;
    quantity: number;
  }>;
  totalAmount: number;
  invoiceNumber: string;
}

export async function POST(request: NextRequest) {
    // Load virtual environment variables first
    const virtualEnv = loadVirtualEnv();
    
    // Check if required virtual Firebase environment variables are available
    if (!virtualEnv.VIRTUAL_FIREBASE_PROJECT_ID || 
        !virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL ||
        !virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY) {
      console.log('⚠️ Virtual Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db } = await import('../../../../lib/firebase');
  try {
    console.log('📱 Push notification request received');
    
    console.log('🔍 Virtual env keys loaded:', Object.keys(virtualEnv).filter(key => key.includes('FIREBASE')));
    
    // Initialize Firebase Admin - always initialize for this API
    console.log('🔥 Initializing Firebase Admin...');
    
    if (!virtualEnv.VIRTUAL_FIREBASE_PROJECT_ID || !virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL || !virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY) {
      console.error('❌ Missing Firebase Admin environment variables:', {
        projectId: !!virtualEnv.VIRTUAL_FIREBASE_PROJECT_ID,
        clientEmail: !!virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL,
        privateKey: !!virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY
      });
      throw new Error('Missing required Firebase Admin environment variables');
    }
    
    console.log('✅ Firebase Admin credentials found, initializing...');
    
    // Delete any existing apps to avoid conflicts
    getApps().forEach(app => {
      try {
        // app.delete(); // Commented out to fix TypeScript error
      } catch (error) {
        console.log('⚠️ Error deleting existing app:', error);
      }
    });
    
    // Initialize new app
    const app = initializeApp({
      credential: cert({
        projectId: virtualEnv.VIRTUAL_FIREBASE_PROJECT_ID,
        clientEmail: virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL,
        privateKey: virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized successfully with app:', app.name);

    const orderData: OrderNotificationPayload = await request.json();
    const { clientName, clientSurname, products, totalAmount, invoiceNumber } = orderData;

    console.log('📋 Order data received:', { clientName, clientSurname, products: products.length, totalAmount, invoiceNumber });

    if (!clientName || !clientSurname || !products || !invoiceNumber) {
      console.error('❌ Missing required order details');
      return NextResponse.json(
        { error: 'Missing required order details' },
        { status: 400 }
      );
    }

    console.log('🗄️ Initializing virtual database...');
    const db = initDatabase('virtual');
    console.log('✅ Virtual database initialized');
    
    // Get all FCM tokens for admin users
    console.log('🔍 Fetching FCM tokens from database...');
    const stmt = db.prepare("SELECT fcm_token FROM fcm_tokens WHERE fcm_token IS NOT NULL AND fcm_token != ''");
    const result = stmt.all() as { fcm_token: string }[];
    const tokens = result.map(row => row.fcm_token);

    console.log(`📱 Found ${tokens.length} FCM tokens`);

    if (tokens.length === 0) {
      console.error('❌ No FCM tokens found for admin users');
      return NextResponse.json(
        { error: 'No FCM tokens found for admin users' },
        { status: 404 }
      );
    }

    // Get current badge count and increment it
    const userStmt = db.prepare('SELECT DISTINCT user_email FROM fcm_tokens WHERE user_email IS NOT NULL');
    const users = userStmt.all() as { user_email: string }[];
    
    const badgeStmt = db.prepare('SELECT user_email, badge_count FROM badge_counts WHERE user_email IN (SELECT DISTINCT user_email FROM fcm_tokens)');
    const badgeResults = badgeStmt.all() as { user_email: string; badge_count: number }[];
    
    const updateStmt = db.prepare('INSERT OR REPLACE INTO badge_counts (user_email, badge_count, last_updated) VALUES (?, ?, CURRENT_TIMESTAMP)');
    for (const user of users) {
      const existingBadge = badgeResults.find(r => r.user_email === user.user_email);
      const newBadgeCount = (existingBadge?.badge_count || 0) + 1;
      updateStmt.run(user.user_email, newBadgeCount);
    }
    
    const badgeCount = Math.max(...badgeResults.map(r => r.badge_count + 1), 1);

    // Create Spanish notification content
    const notificationTitle = `🛒 Nuevo Pedido - ${invoiceNumber}`;
    const productList = products.map(p => `${p.name} (${p.quantity})`).join(', ');
    const notificationBody = `Cliente: ${clientName} ${clientSurname}\nProductos: ${productList}\nTotal: $${totalAmount.toLocaleString()}`;

    // Prepare notification message
    const message = {
      notification: {
        title: notificationTitle,
        body: notificationBody,
      },
      data: {
        type: 'new_order',
        clientName,
        clientSurname,
        invoiceNumber,
        totalAmount: totalAmount.toString(),
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

    // Send notifications in batches
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokens.length; i += batchSize) {
      batches.push(tokens.slice(i, i + batchSize));
    }

    const messaging = getMessaging(app);
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

          if (failedTokens.length > 0) {
            const deleteStmt = db.prepare('DELETE FROM fcm_tokens WHERE fcm_token = ?');
            for (const token of failedTokens) {
              deleteStmt.run(token);
            }
          }
        }

      } catch (error: any) {
        results.push({ error: error.message });
      }
    }

    const totalSuccess = results.reduce((sum, result) => sum + (result.successCount || 0), 0);
    const totalFailure = results.reduce((sum, result) => sum + (result.failureCount || 0), 0);

    return NextResponse.json({
      success: true,
      message: `Order notification sent to ${totalSuccess} devices`,
      results: {
        totalSuccess,
        totalFailure,
        batches: results,
      },
    });

  } catch (error: any) {
    console.error('❌ Push notification error:', error.message);
    console.error('❌ Error stack:', error.stack);
    return NextResponse.json(
      { error: 'Failed to send order notification' },
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