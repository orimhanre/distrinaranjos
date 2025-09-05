import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
    const testFile = path.join(dataDir, 'persistence-test.txt');
    
    // Read existing content
    let existingContent = '';
    try {
      existingContent = fs.readFileSync(testFile, 'utf8');
    } catch (error) {
      existingContent = 'File does not exist';
    }
    
    // Write new content with timestamp
    const newContent = `Test written at: ${new Date().toISOString()}\nPrevious content: ${existingContent}`;
    fs.writeFileSync(testFile, newContent);
    
    return NextResponse.json({
      success: true,
      dataDir,
      testFile,
      existingContent,
      newContent,
      railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
      currentWorkingDirectory: process.cwd(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      dataDir: process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data'),
      railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
      currentWorkingDirectory: process.cwd(),
      environment: process.env.NODE_ENV
    }, { status: 500 });
  }
}
