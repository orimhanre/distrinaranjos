import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug filesystem information...');
    
    const debugInfo: any = {
      environment: process.env.NODE_ENV,
      railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
      currentWorkingDirectory: process.cwd(),
      timestamp: new Date().toISOString()
    };
    
    // Check if /app/data exists
    const appDataPath = '/app/data';
    debugInfo.appDataExists = fs.existsSync(appDataPath);
    
    if (debugInfo.appDataExists) {
      try {
        const appDataContents = fs.readdirSync(appDataPath);
        debugInfo.appDataContents = appDataContents;
        
        // Check if images directory exists
        const imagesPath = path.join(appDataPath, 'images');
        debugInfo.imagesDirExists = fs.existsSync(imagesPath);
        
        if (debugInfo.imagesDirExists) {
          const imagesContents = fs.readdirSync(imagesPath);
          debugInfo.imagesContents = imagesContents;
          
          // Check specific directories
          const regularProductsPath = path.join(imagesPath, 'regular-products');
          const virtualProductsPath = path.join(imagesPath, 'virtual-products');
          const virtualWebphotosPath = path.join(imagesPath, 'virtual-webphotos');
          
          debugInfo.regularProductsExists = fs.existsSync(regularProductsPath);
          debugInfo.virtualProductsExists = fs.existsSync(virtualProductsPath);
          debugInfo.virtualWebphotosExists = fs.existsSync(virtualWebphotosPath);
          
          if (debugInfo.regularProductsExists) {
            const regularProductsContents = fs.readdirSync(regularProductsPath);
            debugInfo.regularProductsContents = regularProductsContents.slice(0, 10); // First 10 files
          }
          
          if (debugInfo.virtualProductsExists) {
            const virtualProductsContents = fs.readdirSync(virtualProductsPath);
            debugInfo.virtualProductsContents = virtualProductsContents.slice(0, 10); // First 10 files
          }
        }
      } catch (error) {
        debugInfo.appDataError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
    
    // Check if /tmp exists and what's in it
    const tmpPath = '/tmp';
    debugInfo.tmpExists = fs.existsSync(tmpPath);
    
    if (debugInfo.tmpExists) {
      try {
        const tmpContents = fs.readdirSync(tmpPath);
        debugInfo.tmpContents = tmpContents;
        
        // Check if /tmp/images exists
        const tmpImagesPath = path.join(tmpPath, 'images');
        debugInfo.tmpImagesExists = fs.existsSync(tmpImagesPath);
        
        if (debugInfo.tmpImagesExists) {
          const tmpImagesContents = fs.readdirSync(tmpImagesPath);
          debugInfo.tmpImagesContents = tmpImagesContents;
        }
      } catch (error) {
        debugInfo.tmpError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
    
    return NextResponse.json({
      success: true,
      debugInfo
    });
    
  } catch (error) {
    console.error('❌ Debug filesystem error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
