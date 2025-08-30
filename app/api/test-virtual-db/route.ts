import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ProductDatabase } from '@/lib/database';

export async function GET() {
  try {
    console.log('🧪 Testing virtual database...');
    
    // Check if virtual database file exists
    const virtualDbPath = path.resolve(process.cwd(), 'data/virtual-products.db');
    const virtualColumnsPath = path.resolve(process.cwd(), 'data/virtual-columns.json');
    
    const dbExists = fs.existsSync(virtualDbPath);
    const columnsExist = fs.existsSync(virtualColumnsPath);
    
    console.log('📁 Virtual DB exists:', dbExists);
    console.log('📁 Virtual columns exist:', columnsExist);
    
    if (dbExists) {
      const dbStats = fs.statSync(virtualDbPath);
      console.log('📊 Virtual DB size:', dbStats.size, 'bytes');
    }
    
    // Try to create database instance
    let dbInstance = null;
    let productCount = 0;
    let error = null;
    
    try {
      const productDB = new ProductDatabase('virtual');
      dbInstance = 'created';
      
      const products = productDB.getAllProducts();
      productCount = products.length;
      
      console.log('✅ Virtual database instance created successfully');
      console.log('📦 Product count:', productCount);
    } catch (dbError) {
      error = dbError instanceof Error ? dbError.message : 'Unknown error';
      console.error('❌ Virtual database error:', dbError);
    }
    
    return NextResponse.json({
      success: true,
      test: 'virtual-database',
      results: {
        dbExists,
        columnsExist,
        dbInstance,
        productCount,
        error,
        virtualDbPath,
        virtualColumnsPath
      }
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
