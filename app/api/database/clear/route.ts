import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let context = 'virtual';
  
  try {
    console.log('🗑️ [Railway] Starting database clear...');
    console.log('🗑️ [Railway] Process CWD:', process.cwd());
    console.log('🗑️ [Railway] NODE_ENV:', process.env.NODE_ENV);
    
    // PROTECTION: Prevent database clearing in production unless explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DB_CLEAR !== 'true') {
      console.log('🚫 [Railway] Database clear blocked in production (ENABLE_DB_CLEAR not set)');
      return NextResponse.json({
        success: false,
        message: 'Database clearing is disabled in production for safety',
        blocked: true,
        reason: 'ENABLE_DB_CLEAR environment variable not set to true'
      }, { status: 403 });
    }
    
    // Get context from request
    try {
      const body = await request.json();
      context = body.context || 'virtual';
      console.log('🗑️ [Railway] Context from body:', context);
    } catch (parseError) {
      context = request.headers.get('x-context') || 'virtual';
      console.log('🗑️ [Railway] Context from header:', context);
    }
    
    // PROTECTION: Require explicit context in production
    if (process.env.NODE_ENV === 'production') {
      try {
        const body = await request.json();
        if (!body.context) {
          console.log('🚫 [Railway] Database clear blocked - no explicit context provided');
          return NextResponse.json({
            success: false,
            message: 'Context must be explicitly provided in production',
            blocked: true,
            reason: 'Missing context in request body'
          }, { status: 400 });
        }
      } catch (parseError) {
        console.log('🚫 [Railway] Database clear blocked - invalid request body');
        return NextResponse.json({
          success: false,
          message: 'Invalid request body in production',
          blocked: true,
          reason: 'Request body parsing failed'
        }, { status: 400 });
      }
    }
    
    console.log(`🗑️ [Railway] Clearing ${context} database`);
    
    // Initialize result tracking
    let dbDeleted = false;
    let filesDeleted = 0;
    const warnings: string[] = [];
    
    // Step 1: Define file paths
    const dataDir = path.resolve(process.cwd(), 'data');
    console.log('🗑️ [Railway] Data directory:', dataDir);
    
    // Ensure data directory exists
    try {
      await fs.mkdir(dataDir, { recursive: true });
      console.log('🗑️ [Railway] Data directory ensured');
    } catch (dirError) {
      console.log('🗑️ [Railway] Data directory already exists or error:', dirError);
    }
    
    // Define file paths based on context
    const dbFileName = context === 'virtual' ? 'virtual-products.db' : 'products.db';
    const dbPath = path.join(dataDir, dbFileName);
    
    const filesToDelete = [
      path.join(dataDir, `${context === 'virtual' ? 'virtual-' : ''}columns.json`),
      path.join(dataDir, `${context === 'virtual' ? 'virtual-' : ''}webphotos.json`)
    ];
    
    if (context === 'virtual') {
      filesToDelete.push(path.join(dataDir, 'virtual-sync-timestamps.json'));
    }
    
    console.log('🗑️ [Railway] Database path:', dbPath);
    console.log('🗑️ [Railway] Files to delete:', filesToDelete);
    
    // Step 2: Delete database file
    try {
      await fs.access(dbPath);
      await fs.unlink(dbPath);
      console.log(`🗑️ [Railway] Deleted database file: ${dbFileName}`);
      dbDeleted = true;
    } catch (dbError) {
      if ((dbError as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log(`🗑️ [Railway] Database file does not exist: ${dbFileName}`);
      } else {
        const errorMsg = dbError instanceof Error ? dbError.message : 'Unknown error';
        console.warn(`⚠️ [Railway] Warning: Could not delete database file:`, errorMsg);
        warnings.push(`Database deletion error: ${errorMsg}`);
      }
    }
    
    // Step 3: Delete configuration files
    for (const filePath of filesToDelete) {
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        const fileName = path.basename(filePath);
        console.log(`🗑️ [Railway] Deleted file: ${fileName}`);
        filesDeleted++;
      } catch (fileError) {
        const fileName = path.basename(filePath);
        if ((fileError as NodeJS.ErrnoException).code === 'ENOENT') {
          console.log(`🗑️ [Railway] File does not exist: ${fileName}`);
        } else {
          const errorMsg = fileError instanceof Error ? fileError.message : 'Unknown error';
          console.warn(`⚠️ [Railway] Warning: Could not delete file ${fileName}:`, errorMsg);
          warnings.push(`Config file deletion error: ${errorMsg}`);
        }
      }
    }
    
    const duration = Date.now() - startTime;
    console.log(`🗑️ [Railway] Database clear completed in ${duration}ms`);
    
    const response = {
      success: true,
      message: `✅ Base de datos ${context === 'virtual' ? 'virtual' : 'regular'} limpiada exitosamente`,
      context: context,
      environment: 'railway',
      dbDeleted,
      filesDeleted,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...(warnings.length > 0 && { warnings })
    };
    
    console.log('🗑️ [Railway] Sending response:', response);
    
    return NextResponse.json(response);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;
    
    console.error('❌ [Railway] Error in database clear operation:', errorMsg);
    if (stack) console.error('❌ [Railway] Stack trace:', stack);
    
    // Return a proper error response
    return NextResponse.json({
      success: false,
      message: `❌ Error al limpiar base de datos ${context === 'virtual' ? 'virtual' : 'regular'}`,
      context: context,
      environment: 'railway',
      error: errorMsg,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 