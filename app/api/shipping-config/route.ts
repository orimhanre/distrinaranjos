import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    const envVars: { [key: string]: string } = {
      VIRTUAL_SHIPPING_FREE_THRESHOLD: '',
      VIRTUAL_SHIPPING_COST: '',
      VIRTUAL_SHIPPING_ESTIMATED_DAYS: '',
    };

    // Always try to read from .env.virtual.local file first (for real-time updates)
    const envPath = join(process.cwd(), '.env.virtual.local');
    try {
      const envContent = readFileSync(envPath, 'utf8');
      
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      });
      
      console.log('✅ Loaded virtual environment variables from .env.virtual.local file');
    } catch (fileError) {
      console.log('⚠️ Could not read .env.virtual.local, falling back to process.env');
    }

    // Fallback to process.env if file values are empty (for Railway deployment)
    if (!envVars.VIRTUAL_SHIPPING_FREE_THRESHOLD && !envVars.VIRTUAL_SHIPPING_COST) {
      envVars.VIRTUAL_SHIPPING_FREE_THRESHOLD = process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '';
      envVars.VIRTUAL_SHIPPING_COST = process.env.VIRTUAL_SHIPPING_COST || '';
      envVars.VIRTUAL_SHIPPING_ESTIMATED_DAYS = process.env.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '';
      console.log('✅ Using environment variables from process.env (Railway deployment)');
    }
    
    return envVars;
  } catch (error) {
    console.error('Error loading virtual environment:', error);
    return {
      VIRTUAL_SHIPPING_FREE_THRESHOLD: process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '',
      VIRTUAL_SHIPPING_COST: process.env.VIRTUAL_SHIPPING_COST || '',
      VIRTUAL_SHIPPING_ESTIMATED_DAYS: process.env.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '',
    };
  }
}

export async function GET() {
  try {
    // Load virtual environment variables
    const virtualEnv = loadVirtualEnv();
    
    const shippingConfig = {
      freeShippingThreshold: parseInt(virtualEnv.VIRTUAL_SHIPPING_FREE_THRESHOLD || process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '150000'),
      shippingCost: parseInt(virtualEnv.VIRTUAL_SHIPPING_COST || process.env.VIRTUAL_SHIPPING_COST || '25000'),
      estimatedDays: virtualEnv.VIRTUAL_SHIPPING_ESTIMATED_DAYS || process.env.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '2-5'
    };

    // Validate the configuration
    if (isNaN(shippingConfig.freeShippingThreshold) || isNaN(shippingConfig.shippingCost)) {
      console.error('Invalid shipping configuration values:', shippingConfig);
      throw new Error('Invalid shipping configuration values');
    }

    return NextResponse.json(shippingConfig, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept'
      }
    });
  } catch (error) {
    console.error('Error fetching shipping config:', error);
    // Return default values instead of an error to prevent client-side failures
    return NextResponse.json({
      freeShippingThreshold: 150000,
      shippingCost: 25000,
      estimatedDays: '2-5'
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept'
      }
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
} 