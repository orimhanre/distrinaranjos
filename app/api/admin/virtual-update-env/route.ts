import { NextRequest, NextResponse } from 'next/server';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

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
    const { db } = await import('../..//lib/firebase');
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the token and check virtual admin permissions
    // Note: In a real implementation, you would verify the Firebase token here
    // For now, we'll assume the token is valid if it exists
    
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Clave y valor son requeridos' }, { status: 400 });
    }

    // Validate the key is one of the allowed environment variables for virtual admin
    const allowedKeys = [
      'VIRTUAL_RESEND_API_KEY',
      'VIRTUAL_RESEND_FROM_EMAIL',
      'VIRTUAL_RESEND_TO_EMAIL',
      'VIRTUAL_CLOUDINARY_CLOUD_NAME',
      'VIRTUAL_CLOUDINARY_API_KEY',
      'VIRTUAL_CLOUDINARY_API_SECRET',
      'VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID',
      'VIRTUAL_FIREBASE_ACCOUNT_EMAIL',
      'VIRTUAL_AIRTABLE_API_KEY',
      'VIRTUAL_AIRTABLE_BASE_ID',
      'VIRTUAL_AIRTABLE_ACCOUNT_EMAIL',
      'VIRTUAL_SHIPPING_FREE_THRESHOLD',
      'VIRTUAL_SHIPPING_COST',
      'VIRTUAL_SHIPPING_ESTIMATED_DAYS',
      'VIRTUAL_WOMPI_PUBLIC_KEY',
      'VIRTUAL_WOMPI_PRIVATE_KEY',
      'VIRTUAL_WOMPI_WEBHOOK_SECRET',
      'VIRTUAL_PSE_MERCHANT_ID',
      'VIRTUAL_PSE_API_KEY',
      'VIRTUAL_PSE_WEBHOOK_SECRET',
      'VIRTUAL_STRIPE_PUBLISHABLE_KEY',
      'VIRTUAL_STRIPE_SECRET_KEY',
      'VIRTUAL_STRIPE_WEBHOOK_SECRET',
      'VIRTUAL_BANK_ACCOUNT_HOLDER',
      'VIRTUAL_BANK_ACCOUNT_NUMBER',
      'VIRTUAL_BANK_ACCOUNT_TYPE',
      'VIRTUAL_BANK_NAME',
      'VIRTUAL_BANK_PHONE',
      'VIRTUAL_BANK_EMAIL',
      'VIRTUAL_JWT_SECRET',
      'VIRTUAL_SESSION_SECRET'
    ];

    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: 'Clave de variable no permitida' }, { status: 400 });
    }

    // Write to .env.virtual.local file (separate from regular admin)
    try {
      const envFilePath = join(process.cwd(), '.env.virtual.local');
      let envContent = '';
      
      // Read existing .env.virtual.local file if it exists
      if (existsSync(envFilePath)) {
        envContent = readFileSync(envFilePath, 'utf8');
      }
      
      // Parse existing variables
      const envLines = envContent.split('\n');
      const envVars: Record<string, string> = {};
      
      envLines.forEach(line => {
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
      
      // Update the specific variable
      envVars[key] = value;
      
      // Rebuild the .env.virtual.local content
      const newEnvContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';
      
      // Write back to file
      writeFileSync(envFilePath, newEnvContent, 'utf8');
      
      console.log(`✅ Virtual Admin: Environment variable ${key} updated in .env.virtual.local`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Variable ${key} actualizada correctamente en .env.virtual.local`,
        note: 'Los cambios se aplicarán después de reiniciar la aplicación'
      });

    } catch (fileError) {
      console.error('Error writing to .env.virtual.local:', fileError);
      return NextResponse.json({ 
        error: 'Error al escribir en .env.virtual.local. Verifica los permisos del archivo.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error updating virtual admin environment variable:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read from .env.virtual.local file
    const envFilePath = join(process.cwd(), '.env.virtual.local');
    const envVars: Record<string, string> = {};
    
    // Initialize with default values for virtual admin
    const defaultValues = {
      // Resend
      VIRTUAL_RESEND_API_KEY: '',
      VIRTUAL_RESEND_FROM_EMAIL: '',
      VIRTUAL_RESEND_TO_EMAIL: '',
      
      // Cloudinary
      VIRTUAL_CLOUDINARY_CLOUD_NAME: '',
      VIRTUAL_CLOUDINARY_API_KEY: '',
      VIRTUAL_CLOUDINARY_API_SECRET: '',
      VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL: '',
      
      // Firebase
      NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY: '',
      NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN: '',
      NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID: '',
      NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET: '',
      NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID: '',
      NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID: '',
      VIRTUAL_FIREBASE_ACCOUNT_EMAIL: '',
      
      // Airtable
      VIRTUAL_AIRTABLE_API_KEY: '',
      VIRTUAL_AIRTABLE_BASE_ID: '',
      VIRTUAL_AIRTABLE_ACCOUNT_EMAIL: '',
      
      // Shipping
      VIRTUAL_SHIPPING_FREE_THRESHOLD: '100000',
      VIRTUAL_SHIPPING_COST: '15000',
      VIRTUAL_SHIPPING_ESTIMATED_DAYS: '3',
      
      // Payment Processing
      VIRTUAL_WOMPI_PUBLIC_KEY: '',
      VIRTUAL_WOMPI_PRIVATE_KEY: '',
      VIRTUAL_WOMPI_WEBHOOK_SECRET: '',
      VIRTUAL_PSE_MERCHANT_ID: '',
      VIRTUAL_PSE_API_KEY: '',
      VIRTUAL_PSE_WEBHOOK_SECRET: '',
      VIRTUAL_STRIPE_PUBLISHABLE_KEY: '',
      VIRTUAL_STRIPE_SECRET_KEY: '',
      VIRTUAL_STRIPE_WEBHOOK_SECRET: '',
      
      // Bank Account Details
      VIRTUAL_BANK_ACCOUNT_HOLDER: 'DISTRI NARANJOS SAS',
      VIRTUAL_BANK_ACCOUNT_NUMBER: '1234567890',
      VIRTUAL_BANK_ACCOUNT_TYPE: 'Cuenta Corriente',
      VIRTUAL_BANK_NAME: 'Bancolombia',
      VIRTUAL_BANK_PHONE: '+57 311 388 7955',
      VIRTUAL_BANK_EMAIL: 'info@distrinaranjos.com',
      
      // Security
      VIRTUAL_JWT_SECRET: '',
      VIRTUAL_SESSION_SECRET: '',
    };

    // Start with default values
    Object.assign(envVars, defaultValues);
    
    // Read from .env.virtual.local if it exists
    if (existsSync(envFilePath)) {
      const envContent = readFileSync(envFilePath, 'utf8');
      const envLines = envContent.split('\n');
      
      envLines.forEach(line => {
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
    }

    return NextResponse.json({ envVars });

  } catch (error) {
    console.error('Error getting virtual admin environment variables:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 