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
    const clearType = body.clearType || 'complete'; // Default to complete clear
    
    console.log(`🗑️ Clearing ${context} database with type: ${clearType}`);
    
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
    
    // Clear sync timestamps file if it exists
    try {
      const syncTimestampsPath = path.resolve(process.cwd(), 'data/virtual-sync-timestamps.json');
      if (fs.existsSync(syncTimestampsPath)) {
        fs.unlinkSync(syncTimestampsPath);
        console.log(`🗑️ Deleted virtual-sync-timestamps.json`);
      }
    } catch (error) {
      console.error('Error clearing sync timestamps:', error);
    }
    
    return NextResponse.json({
      success: true,
      message: `✅ Base de datos ${context === 'virtual' ? 'virtual' : 'regular'} limpiada completamente`,
      context: context,
      clearType: 'complete'
    });
    
  } catch (error) {
    console.error('Error clearing database:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clear database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 