import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const testInfo: any = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      railwayVolumeMountPath: process.env.RAILWAY_VOLUME_MOUNT_PATH,
      currentWorkingDirectory: process.cwd(),
    };
    
    // Test if we can write to /app/data
    const testDataPath = '/app/data';
    const testFilePath = path.join(testDataPath, 'test.txt');
    
    try {
      // Try to create directory if it doesn't exist
      if (!fs.existsSync(testDataPath)) {
        fs.mkdirSync(testDataPath, { recursive: true });
        testInfo.createdDataDir = true;
      } else {
        testInfo.dataDirExists = true;
      }
      
      // Try to write a test file
      const testContent = `Test file created at ${new Date().toISOString()}`;
      fs.writeFileSync(testFilePath, testContent);
      testInfo.wroteTestFile = true;
      
      // Try to read it back
      const readContent = fs.readFileSync(testFilePath, 'utf8');
      testInfo.readTestFile = readContent;
      
      // Check if /app/data is writable
      testInfo.dataDirWritable = true;
      
    } catch (error) {
      testInfo.dataDirError = error instanceof Error ? error.message : 'Unknown error';
      testInfo.dataDirWritable = false;
    }
    
    // Test if we can write to /tmp
    const testTmpPath = '/tmp';
    const testTmpFilePath = path.join(testTmpPath, 'test.txt');
    
    try {
      const testContent = `Test file created at ${new Date().toISOString()}`;
      fs.writeFileSync(testTmpFilePath, testContent);
      testInfo.tmpWritable = true;
      
      const readContent = fs.readFileSync(testTmpFilePath, 'utf8');
      testInfo.tmpReadContent = readContent;
      
    } catch (error) {
      testInfo.tmpError = error instanceof Error ? error.message : 'Unknown error';
      testInfo.tmpWritable = false;
    }
    
    return NextResponse.json({
      success: true,
      testInfo
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
