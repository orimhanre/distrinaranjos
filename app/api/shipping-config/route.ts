import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Railway deployment)
    const envVars: { [key: string]: string } = {
      VIRTUAL_SHIPPING_FREE_THRESHOLD: process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '',
      VIRTUAL_SHIPPING_COST: process.env.VIRTUAL_SHIPPING_COST || '',
      VIRTUAL_SHIPPING_ESTIMATED_DAYS: process.env.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_SHIPPING_FREE_THRESHOLD || envVars.VIRTUAL_SHIPPING_COST) {
      console.log('✅ Using environment variables from process.env (Railway deployment)');
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