import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Vercel deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_CLOUDINARY_CLOUD_NAME && envVars.VIRTUAL_CLOUDINARY_API_KEY && envVars.VIRTUAL_CLOUDINARY_API_SECRET) {
      console.log('✅ Using environment variables from process.env (Vercel deployment)');
      return envVars;
    }

    // Fallback to local file for development
    const fs = require('fs');
    const path = require('path');
    
    const envFilePath = path.join(process.cwd(), '.env.virtual.local');
    
    if (!fs.existsSync(envFilePath)) {
      console.log('Virtual environment file not found:', envFilePath);
      return envVars;
    }
    
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    
    envContent.split('\n').forEach((line: string) => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const equalIndex = trimmedLine.indexOf('=');
        if (equalIndex > 0) {
          const varKey = trimmedLine.substring(0, equalIndex);
          const varValue = trimmedLine.substring(equalIndex + 1);
          envVars[varKey] = varValue;
        }
      }
    });
    
    // // console.log('✅ Loaded virtual environment variables from local file (development):', Object.keys(envVars));
    return envVars;
  } catch (error) {
    console.error('Error loading virtual environment:', error);
    return {
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
    };
  }
}

// Load virtual environment variables
const virtualEnv = loadVirtualEnv();

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 File upload API called');
    
    // Check environment variables
    console.log('🔍 Environment check:', {
      cloudName: virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing',
      apiKey: virtualEnv.VIRTUAL_CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
      apiSecret: virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing'
    });
    
    // Configure Cloudinary
    cloudinary.config({
      cloud_name: virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME,
      api_key: virtualEnv.VIRTUAL_CLOUDINARY_API_KEY,
      api_secret: virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET,
    });

    console.log('☁️ Cloudinary configured for:', virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME);
    
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const orderId = formData.get('orderId') as string;

    console.log('📁 Files received:', files.length);
    console.log('🆔 Order ID:', orderId);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const uploadedFiles: Array<{ url: string; name: string; type: 'image' | 'pdf'; size: number }> = [];

    for (const file of files) {
      try {
        console.log(`📄 Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
        
        // Validate file type
        const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
        if (!isValidType) {
          console.warn(`❌ Skipping invalid file type: ${file.type}`);
          continue;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          console.warn(`❌ Skipping file too large: ${file.name} (${file.size} bytes)`);
          continue;
        }

        // Convert file to base64 for Cloudinary
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64String = buffer.toString('base64');
        const dataURI = `data:${file.type};base64,${base64String}`;

        // Generate folder path and public_id with original filename and extension
        const folderPath = `admin-messages/${orderId}`;
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
        const fileExtension = file.name.split('.').pop(); // Get file extension
        const publicId = `${folderPath}/${fileName}.${fileExtension}`;
        
        // Determine resource type based on file extension
        let resourceType: 'auto' | 'video' | 'image' | 'raw' = 'raw';
        if (file.type.startsWith('image/')) {
          resourceType = 'image';
        } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          resourceType = 'raw'; // PDFs are raw files in Cloudinary
        }

        console.log(`📤 Uploading to Cloudinary: ${file.name}`);
        console.log(`📁 Resource type: ${resourceType}, File type: ${file.type}`);
        console.log(`📁 Public ID will be: ${publicId}`);

        // Upload to Cloudinary
        console.log(`📤 Starting Cloudinary upload for: ${file.name}`);
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              public_id: publicId,
              resource_type: resourceType,
              folder: folderPath,
              overwrite: false,
              tags: ['admin-message', `order-${orderId}`],
              context: {
                originalName: file.name,
                orderId: orderId,
                uploadedAt: new Date().toISOString()
              }
            },
            (error, result) => {
              if (error) {
                console.error(`❌ Cloudinary upload error for ${file.name}:`, error);
                console.error(`❌ Error details:`, JSON.stringify(error, null, 2));
                reject(error);
              } else {
                console.log(`✅ Cloudinary upload success for ${file.name}:`, result?.secure_url);
                resolve(result);
              }
            }
          );
        });

        const result = uploadResult as any;
        
        uploadedFiles.push({
          url: result.secure_url,
          name: file.name,
          type: file.type.startsWith('image/') ? 'image' : 'pdf',
          size: file.size
        });

        console.log(`✅ File uploaded successfully: ${file.name} -> ${result.secure_url}`);
      } catch (fileError) {
        console.error(`❌ Error uploading file ${file.name}:`, fileError);
        // Continue with other files
      }
    }

    if (uploadedFiles.length === 0) {
      return NextResponse.json({ error: 'No files were uploaded successfully' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      files: uploadedFiles,
      message: `${uploadedFiles.length} file(s) uploaded successfully to Cloudinary`
    });

  } catch (error) {
    console.error('❌ Error in file upload API:', error);
    return NextResponse.json({ 
      error: 'Internal server error during file upload' 
    }, { status: 500 });
  }
}
