import { NextRequest, NextResponse } from 'next/server';
import { AirtableService } from '@/lib/airtable';
import { WebPhotosDatabase } from '@/lib/database';
import { WebPhotoDownloader } from '@/lib/webPhotoDownloader';
import { VirtualPhotoDownloader } from '@/lib/virtualPhotoDownloader';
import { cacheBuster } from '@/lib/cacheBuster';

// Create database instance based on context
let webPhotosDB: WebPhotosDatabase;

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting WebPhotos sync from Airtable...');

    // Get context from request body or headers
    const body = await request.json().catch(() => ({}));
    const context = body.context || request.headers.get('x-context') || 'virtual';
    
    // Switch to appropriate environment based on context
    AirtableService.switchEnvironmentFromContext(context);
    console.log(`🔄 Using ${context} environment for WebPhotos sync`);
    
    // Initialize database with correct environment
    // Use the existing singleton instance to avoid database conflicts
    const { WebPhotosDatabase } = await import('@/lib/database');
    webPhotosDB = new WebPhotosDatabase(context === 'virtual' ? 'virtual' : 'regular');

    // Fetch all WebPhotos records from Airtable
    const airtableRecords = await AirtableService.fetchAllWebPhotosRecords();
    console.log(`📸 Found ${airtableRecords.length} WebPhotos records in Airtable`);

    let syncedCount = 0;
    const errors: string[] = [];

    // Get all existing WebPhoto names in the database
    const existingWebPhotoNames = new Set(Object.keys(webPhotosDB.getAllWebPhotos()));
    
    // Safety check: If Airtable returns no records, don't delete existing logos
    if (airtableRecords.length === 0) {
      console.log(`⚠️ No WebPhotos found in Airtable - preserving existing logos for safety`);
      return NextResponse.json({
        success: true,
        message: 'No WebPhotos found in Airtable - existing logos preserved',
        syncedCount: 0,
        deletedCount: 0,
        errors: ['No WebPhotos found in Airtable'],
        timestamp: new Date().toISOString(),
        cacheBuster: Date.now()
      });
    }
    
    // Get all Airtable WebPhoto names
    const airtableWebPhotoNames = new Set(airtableRecords.map(r => {
      try {
        const webPhoto = AirtableService.convertAirtableToWebPhoto(r);
        return webPhoto.name;
      } catch (error) {
        console.error(`Error converting WebPhoto ${r.id}:`, error);
        return null;
      }
    }).filter(Boolean));
    
    // Find WebPhotos that exist in database but not in Airtable (to be deleted)
    const webPhotosToDelete = Array.from(existingWebPhotoNames).filter(name => !airtableWebPhotoNames.has(name));
    
    // Define essential logos that should never be deleted (brand logos)
    const essentialLogos = [
      'logo-massnu', 'logo-reno', 'logo-najos', 'logo-aj', 'logo-tiber', 'logo-importado'
    ];
    
    // Filter out essential logos from deletion list
    const safeToDelete = webPhotosToDelete.filter(name => !essentialLogos.includes(name));
    const protectedLogos = webPhotosToDelete.filter(name => essentialLogos.includes(name));
    
    if (protectedLogos.length > 0) {
      console.log(`🛡️ Protecting essential logos from deletion: ${protectedLogos.join(', ')}`);
    }
    
    // Delete WebPhotos that no longer exist in Airtable (but not essential logos)
    let deletedCount = 0;
    for (const webPhotoName of safeToDelete) {
      try {
        const deleted = webPhotosDB.deleteWebPhoto(webPhotoName);
        if (deleted) {
          console.log(`🗑️ Deleted WebPhoto: ${webPhotoName} (no longer in Airtable)`);
          deletedCount++;
        }
      } catch (error) {
        console.error(`❌ Failed to delete WebPhoto ${webPhotoName}:`, error);
      }
    }
    
    // Convert all Airtable records to local format
    const webPhotosFromAirtable: Record<string, string> = {};
    
    for (const airtableRecord of airtableRecords) {
      try {
        console.log(`🔍 Processing WebPhoto record: ${airtableRecord.id}`);
        console.log(`🔍 Record fields:`, JSON.stringify(airtableRecord.fields, null, 2));
        
        // Convert Airtable record to local format
        const webPhoto = AirtableService.convertAirtableToWebPhoto(airtableRecord);
        
        console.log(`🔍 Converted WebPhoto:`, webPhoto);
        
        if (webPhoto.name && webPhoto.imageUrl) {
          webPhotosFromAirtable[webPhoto.name] = webPhoto.imageUrl;
          console.log(`✅ Added WebPhoto: ${webPhoto.name} -> ${webPhoto.imageUrl}`);
        } else {
          console.warn(`⚠️ Skipping WebPhoto with missing name or imageUrl:`, webPhoto);
        }
      } catch (error) {
        const errorMessage = `Error converting WebPhoto ${airtableRecord.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        console.error('Full error details:', error);
        errors.push(errorMessage);
      }
    }

    // Declare localWebPhotos variable at top level
    let localWebPhotos: Record<string, string> = {};
    
    // For virtual environment, download WebPhotos locally with stable names
    if (context === 'virtual') {
      console.log('🖼️ Virtual environment: Downloading WebPhotos locally with stable names');
      
      try {
        // Convert Record to array format for VirtualPhotoDownloader with original filenames
        const webPhotosArray = Object.entries(webPhotosFromAirtable).map(([name, url]) => {
          // Find the original WebPhoto object to get the original filename
          const originalWebPhoto = airtableRecords.find(record => {
            const webPhoto = AirtableService.convertAirtableToWebPhoto(record);
            return webPhoto.name === name;
          });
          
          const originalFilename = originalWebPhoto ? 
            AirtableService.convertAirtableToWebPhoto(originalWebPhoto).originalFilename : '';
          
          return {
            name,
            imageUrl: url,
            originalFilename: originalFilename
          };
        });
        
        // Download WebPhotos locally
        const localImageUrls = await VirtualPhotoDownloader.downloadWebPhotos(webPhotosArray);
        
        // Clear existing WebPhotos from database before adding new ones
        console.log('🗑️ Clearing existing WebPhotos from database...');
        webPhotosDB.clearAllWebPhotos();
        
        // Save local WebPhoto paths to database
        for (let i = 0; i < localImageUrls.length; i++) {
          const localPath = localImageUrls[i];
          const name = webPhotosArray[i]?.name || `webphoto_${i}`;
          
          try {
            const success = webPhotosDB.upsertWebPhoto(name, localPath);
            
            if (success) {
              syncedCount++;
              console.log(`✅ Synced WebPhoto: ${name} -> ${localPath}`);
            } else {
              errors.push(`Failed to sync WebPhoto: ${name}`);
            }
          } catch (error) {
            const errorMessage = `Error saving WebPhoto ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            console.error(errorMessage);
            errors.push(errorMessage);
          }
        }
      } catch (error) {
        const errorMessage = `Error downloading WebPhotos: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    } else {
      // Download WebPhotos locally (regular environment only)
      console.log('📥 Downloading WebPhotos locally...');
      localWebPhotos = await WebPhotoDownloader.downloadWebPhotos(webPhotosFromAirtable);
      
      // Clear existing WebPhotos from database before adding new ones
      console.log('🗑️ Clearing existing WebPhotos from database...');
      webPhotosDB.clearAllWebPhotos();
      
      // Save local paths to database
      for (const [name, localPath] of Object.entries(localWebPhotos)) {
        try {
          const success = webPhotosDB.upsertWebPhoto(name, localPath);
          
          if (success) {
            syncedCount++;
            console.log(`✅ Synced WebPhoto: ${name} -> ${localPath}`);
          } else {
            errors.push(`Failed to sync WebPhoto: ${name}`);
          }
        } catch (error) {
          const errorMessage = `Error saving WebPhoto ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMessage);
          errors.push(errorMessage);
        }
      }
    }

    // Clean up old files
    if (Object.keys(localWebPhotos).length > 0) {
      if (context === 'virtual') {
        // For virtual environment, use VirtualPhotoDownloader cleanup
        try {
          console.log('🧹 Cleaning up unused virtual WebPhotos...');
          const usedFilenames = new Set<string>(
            Object.values(localWebPhotos).map(url => {
              const urlParts = url.split('/');
              return urlParts[urlParts.length - 1];
            })
          );
          await VirtualPhotoDownloader.cleanupUnusedImages(usedFilenames, 'webphotos');
          console.log('✅ Virtual WebPhotos cleanup completed');
        } catch (cleanupError) {
          console.warn('⚠️ Virtual WebPhotos cleanup failed:', cleanupError);
        }
      } else {
        // For regular environment, use WebPhotoDownloader cleanup
        await WebPhotoDownloader.cleanupOldFiles(localWebPhotos);
      }
    }

    // Update cache buster timestamp
    cacheBuster.updateSyncTimestamp();

    // Update sync timestamp directly
    const syncTimestamp = new Date().toLocaleString('es-ES');
    try {
      const { writeFileSync, existsSync } = require('fs');
      const { join } = require('path');
      
      const TIMESTAMPS_FILE = join(process.cwd(), 'data', 'virtual-sync-timestamps.json');
      const dataDir = join(process.cwd(), 'data');
      
      // Ensure data directory exists
      if (!existsSync(dataDir)) {
        const fs = require('fs');
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Read existing timestamps
      let timestamps: {
        lastProductSync: string | null;
        lastWebPhotosSync: string | null;
      } = {
        lastProductSync: null,
        lastWebPhotosSync: null
      };
      
      if (existsSync(TIMESTAMPS_FILE)) {
        try {
          const content = require('fs').readFileSync(TIMESTAMPS_FILE, 'utf8');
          timestamps = JSON.parse(content);
        } catch (error) {
          console.warn('⚠️ Error reading existing timestamps:', error);
        }
      }
      
      // Update WebPhotos sync timestamp
      timestamps.lastWebPhotosSync = syncTimestamp;
      
      // Write updated timestamps
      writeFileSync(TIMESTAMPS_FILE, JSON.stringify(timestamps, null, 2), 'utf8');
      console.log('✅ WebPhotos sync timestamp updated successfully:', syncTimestamp);
    } catch (error) {
      console.warn('⚠️ Failed to update sync timestamp:', error);
    }

    // Add cache busting headers to response
    const response = NextResponse.json({
      success: true,
      message: `WebPhotos sync completed: ${syncedCount} synced, ${deletedCount} deleted`,
      syncedCount,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
      cacheBuster: Date.now(), // Include cache buster timestamp
      syncTimestamp: syncTimestamp
    });

    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Cache-Buster', Date.now().toString());

    console.log(`🎉 WebPhotos sync completed: ${syncedCount} synced, ${deletedCount} deleted`);
    console.log(`🔄 Cache buster timestamp: ${cacheBuster.getSyncTimestamp()}`);
    
    return response;

  } catch (error) {
    console.error('❌ WebPhotos sync failed:', error);
    return NextResponse.json({
      success: false,
      error: 'WebPhotos sync failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 