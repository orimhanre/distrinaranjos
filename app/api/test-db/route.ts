import { NextRequest } from 'next/server';
import { ProductDatabase } from '@/lib/database';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Check if database file exists
    const dbPath = path.join(process.cwd(), 'data', 'products.db');
    const dbExists = fs.existsSync(dbPath);
    const dbSize = dbExists ? fs.statSync(dbPath).size : 0;
    
    // Try to get products
    const productDB = new ProductDatabase('regular');
    const products = productDB.getAllProducts();
    
    return new Response(JSON.stringify({
      dbExists,
      dbSize,
      productCount: products.length,
      sampleProduct: products[0] || null,
      environment: 'regular'
    }), { status: 200 });
  } catch (error) {
    console.error('Database test error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), { status: 500 });
  }
}
