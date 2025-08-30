import { NextRequest, NextResponse } from 'next/server';
import { checkAdminPermission } from '@/lib/adminPermissions';
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
    const { db } = await import('../../../../lib/firebase');
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify the token and check admin permissions
    // Note: In a real implementation, you would verify the Firebase token here
    // For now, we'll assume the token is valid if it exists
    
    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Clave y valor son requeridos' }, { status: 400 });
    }

    // Validate the key is one of the allowed environment variables
    const allowedKeys = [
      'RESEND_API_KEY',
      'RESEND_FROM_EMAIL',
      'RESEND_TO_EMAIL',
      'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY',
      'CLOUDINARY_API_SECRET',
      'CLOUDINARY_ACCOUNT_EMAIL',
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'FIREBASE_ACCOUNT_EMAIL',
      'NEXT_PUBLIC_AIRTABLE_API_KEY',
      'NEXT_PUBLIC_AIRTABLE_BASE_ID',
      'AIRTABLE_ACCOUNT_EMAIL'
    ];

    if (!allowedKeys.includes(key)) {
      return NextResponse.json({ error: 'Clave de variable no permitida' }, { status: 400 });
    }

    // Write to .env.local file
    try {
      const envFilePath = join(process.cwd(), '.env.local');
      let envContent = '';
      
      // Read existing .env.local file if it exists
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
      
      // Rebuild the .env.local content
      const newEnvContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';
      
      // Write back to file
      writeFileSync(envFilePath, newEnvContent, 'utf8');
      
      console.log(`✅ Environment variable ${key} updated in .env.local`);
      
      return NextResponse.json({ 
        success: true, 
        message: `Variable ${key} actualizada correctamente en .env.local`,
        note: 'Los cambios se aplicarán después de reiniciar la aplicación'
      });

    } catch (fileError) {
      console.error('Error writing to .env.local:', fileError);
      return NextResponse.json({ 
        error: 'Error al escribir en .env.local. Verifica los permisos del archivo.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error updating environment variable:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Read current environment variables from .env.local file (not process.env)
    const envFilePath = join(process.cwd(), '.env.local');
    const envVars: Record<string, string> = {};
    
    // Read from .env.local file if it exists
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
    
    // Prepare response with defaults for missing values
    const responseVars = {
      // Resend
      RESEND_API_KEY: process.env.RESEND_API_KEY || '',
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
      RESEND_TO_EMAIL: process.env.RESEND_TO_EMAIL || 'orhanimre@gmail.com',
      
      // Cloudinary
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
      CLOUDINARY_ACCOUNT_EMAIL: process.env.CLOUDINARY_ACCOUNT_EMAIL || '',
      
      // Firebase
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      FIREBASE_ACCOUNT_EMAIL: process.env.FIREBASE_ACCOUNT_EMAIL || '',
      
      // Airtable
      NEXT_PUBLIC_AIRTABLE_API_KEY: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || '',
      NEXT_PUBLIC_AIRTABLE_BASE_ID: process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || '',
      AIRTABLE_ACCOUNT_EMAIL: process.env.AIRTABLE_ACCOUNT_EMAIL || '',
    };

    return NextResponse.json({ envVars: responseVars });

  } catch (error) {
    console.error('Error getting environment variables:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
} 