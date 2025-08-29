import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Vercel deployment)
    const envVars: { [key: string]: string } = {
      VIRTUAL_BANK_ACCOUNT_HOLDER: process.env.VIRTUAL_BANK_ACCOUNT_HOLDER || '',
      VIRTUAL_BANK_NAME: process.env.VIRTUAL_BANK_NAME || '',
      VIRTUAL_BANK_ACCOUNT_NUMBER: process.env.VIRTUAL_BANK_ACCOUNT_NUMBER || '',
      VIRTUAL_BANK_ACCOUNT_TYPE: process.env.VIRTUAL_BANK_ACCOUNT_TYPE || '',
      VIRTUAL_BANK_PHONE: process.env.VIRTUAL_BANK_PHONE || '',
      VIRTUAL_BANK_EMAIL: process.env.VIRTUAL_BANK_EMAIL || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_BANK_ACCOUNT_HOLDER || envVars.VIRTUAL_BANK_NAME) {
      console.log('✅ Using environment variables from process.env (Vercel deployment)');
      return envVars;
    }

    // Fallback to local file for development
    const envPath = join(process.cwd(), '.env.virtual.local');
    const envContent = readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    // // console.log('✅ Loaded virtual environment variables from local file (development):', Object.keys(envVars));
    return envVars;
  } catch (error) {
    console.error('Error loading virtual environment:', error);
    return {
      VIRTUAL_BANK_ACCOUNT_HOLDER: process.env.VIRTUAL_BANK_ACCOUNT_HOLDER || '',
      VIRTUAL_BANK_NAME: process.env.VIRTUAL_BANK_NAME || '',
      VIRTUAL_BANK_ACCOUNT_NUMBER: process.env.VIRTUAL_BANK_ACCOUNT_NUMBER || '',
      VIRTUAL_BANK_ACCOUNT_TYPE: process.env.VIRTUAL_BANK_ACCOUNT_TYPE || '',
      VIRTUAL_BANK_PHONE: process.env.VIRTUAL_BANK_PHONE || '',
      VIRTUAL_BANK_EMAIL: process.env.VIRTUAL_BANK_EMAIL || '',
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Load virtual environment variables
    const virtualEnv = loadVirtualEnv();
    
    const bankDetails = {
      accountHolder: virtualEnv.VIRTUAL_BANK_ACCOUNT_HOLDER || process.env.VIRTUAL_BANK_ACCOUNT_HOLDER || 'DISTRI NARANJOS SAS',
      bankName: virtualEnv.VIRTUAL_BANK_NAME || process.env.VIRTUAL_BANK_NAME || 'Bancolombia',
      accountNumber: virtualEnv.VIRTUAL_BANK_ACCOUNT_NUMBER || process.env.VIRTUAL_BANK_ACCOUNT_NUMBER || '1234567890',
      accountType: virtualEnv.VIRTUAL_BANK_ACCOUNT_TYPE || process.env.VIRTUAL_BANK_ACCOUNT_TYPE || 'Cuenta Corriente',
      phoneNumber: virtualEnv.VIRTUAL_BANK_PHONE || process.env.VIRTUAL_BANK_PHONE || '+57 311 388 7955',
      email: virtualEnv.VIRTUAL_BANK_EMAIL || process.env.VIRTUAL_BANK_EMAIL || 'info@distrinaranjos.com'
    };

    return NextResponse.json(bankDetails, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching bank account details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank account details' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
