import { NextRequest } from 'next/server';
import { productDB } from '@/lib/database';

let cache: { data: any; timestamp: number } | null = null;
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes

export async function GET(req: NextRequest) {
  if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
    return new Response(JSON.stringify(cache.data), { status: 200 });
  }
  try {
    const products = productDB.getAllProducts();
    cache = { data: products, timestamp: Date.now() };
    return new Response(JSON.stringify(products), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch products' }), { status: 500 });
  }
} 