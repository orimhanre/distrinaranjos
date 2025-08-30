import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

const TIMESTAMPS_FILE = join(process.cwd(), 'data', 'virtual-sync-timestamps.json');

// Ensure the data directory exists
const ensureDataDir = () => {
  const dataDir = join(process.cwd(), 'data');
  if (!existsSync(dataDir)) {
    const fs = require('fs');
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Read timestamps from file
const readTimestamps = () => {
  try {
    ensureDataDir();
    if (existsSync(TIMESTAMPS_FILE)) {
      const content = readFileSync(TIMESTAMPS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading timestamps file:', error);
    // Return default structure even if file read fails
  }
  return {
    lastProductSync: null,
    lastWebPhotosSync: null
  };
};

// Write timestamps to file
const writeTimestamps = (timestamps: any) => {
  try {
    ensureDataDir();
    writeFileSync(TIMESTAMPS_FILE, JSON.stringify(timestamps, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing timestamps file:', error);
    return false;
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, timestamp } = body;

    if (!type || !timestamp) {
      return NextResponse.json({ 
        error: 'Type and timestamp are required' 
      }, { status: 400 });
    }

    const timestamps = readTimestamps();
    
    if (type === 'products') {
      timestamps.lastProductSync = timestamp;
    } else if (type === 'webphotos') {
      timestamps.lastWebPhotosSync = timestamp;
    } else {
      return NextResponse.json({ 
        error: 'Invalid type. Must be "products" or "webphotos"' 
      }, { status: 400 });
    }

    const success = writeTimestamps(timestamps);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: `Timestamp saved for ${type}`,
        timestamps 
      });
    } else {
      return NextResponse.json({ 
        error: 'Failed to save timestamp' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error saving virtual sync timestamp:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const timestamps = readTimestamps();
    
    return NextResponse.json({ 
      success: true, 
      timestamps 
    });

  } catch (error) {
    console.error('Error retrieving virtual sync timestamps:', error);
    // Return default timestamps instead of error to prevent 500
    return NextResponse.json({ 
      success: true,
      timestamps: {
        lastProductSync: null,
        lastWebPhotosSync: null
      }
    });
  }
}
