import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { resetDatabaseSingletons } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    console.log('🗑️ Starting database clear...');
    
    // Get context from request body or headers
    const body = await request.json().catch(() => ({}));
    const context = body.context || request.headers.get('x-context') || 'regular';
    const clearType = body.clearType || 'safe'; // 'safe' or 'complete'
    
    console.log(`🗑️ Clearing ${context} database with type: ${clearType}`);
    
    if (clearType === 'safe' && context === 'virtual') {
      // SAFE CLEAR: Only clear products and web photos, preserve admin messages and orders
      console.log('🛡️ Performing SAFE clear - preserving admin messages and order history');
      
      try {
        // Only clear products database
        const productsDbPath = path.resolve(process.cwd(), 'data/virtual-products.db');
        if (fs.existsSync(productsDbPath)) {
          fs.unlinkSync(productsDbPath);
          console.log(`🗑️ Deleted products database: ${productsDbPath}`);
        }
        
        // Only clear web photos
        const webPhotosPath = path.resolve(process.cwd(), 'data/virtual-webphotos.json');
        if (fs.existsSync(webPhotosPath)) {
          fs.unlinkSync(webPhotosPath);
          console.log(`🗑️ Deleted web photos: ${webPhotosPath}`);
        }
        
        // Reset only the products database singleton
        console.log('🔄 Resetting virtual database singleton...');
        resetDatabaseSingletons('virtual');
        console.log('✅ Virtual database singleton reset completed');
        
        return NextResponse.json({
          success: true,
          message: `🛡️ SAFE clear completed: Products and web photos cleared, admin messages and order history preserved`,
          context: context,
          clearType: 'safe'
        });
        
      } catch (error) {
        console.error('Error during safe clear:', error);
        return NextResponse.json(
          { success: false, error: 'Failed to perform safe clear', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        );
      }
      
    } else {
      // COMPLETE CLEAR: Clear everything (original behavior)
      console.log(`⚠️ Performing COMPLETE clear - this will delete ALL data including admin messages and orders`);
      
      // Determine database file path
      const dbPath = context === 'virtual' 
        ? path.resolve(process.cwd(), 'data/virtual-products.db')
        : path.resolve(process.cwd(), 'data/products.db');
      
      // Reset the singleton instance
      resetDatabaseSingletons(context === 'virtual' ? 'virtual' : 'regular');
      
      // Completely delete the database file
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
        console.log(`🗑️ Deleted database file: ${dbPath}`);
      }
      
      // Clear the column configuration files
      try {
        const columnsPath = path.resolve(process.cwd(), `data/${context === 'virtual' ? 'virtual-' : ''}columns.json`);
        
        // Remove the columns file if it exists
        if (fs.existsSync(columnsPath)) {
          fs.unlinkSync(columnsPath);
          console.log(`🗑️ Deleted ${context === 'virtual' ? 'virtual-' : ''}columns.json`);
        }
        
        // Also clear WebPhotos JSON file if it exists
        const webPhotosPath = path.resolve(process.cwd(), `data/${context === 'virtual' ? 'virtual-' : ''}webphotos.json`);
        if (fs.existsSync(webPhotosPath)) {
          fs.unlinkSync(webPhotosPath);
          console.log(`🗑️ Deleted ${context === 'virtual' ? 'virtual-' : ''}webphotos.json`);
        }
        
      } catch (error) {
        console.error('Error clearing column files:', error);
        // Don't fail the entire operation if column clearing fails
      }
      
              return NextResponse.json({
          success: true,
          message: `⚠️ LIMPIEZA COMPLETA completada: TODOS los datos eliminados incluyendo mensajes de administrador y pedidos`,
          context: context,
          clearType: 'complete'
        });
    }
    
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 