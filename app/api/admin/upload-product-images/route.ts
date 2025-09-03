import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Function to load environment variables from .env.virtual.local or process.env
function loadVirtualEnv() {
  try {
    // First, try to load from process.env (for Railway deployment)
    const envVars: Record<string, string> = {
      VIRTUAL_CLOUDINARY_CLOUD_NAME: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '',
      VIRTUAL_CLOUDINARY_API_KEY: process.env.VIRTUAL_CLOUDINARY_API_KEY || '',
      VIRTUAL_CLOUDINARY_API_SECRET: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '',
    };

    // If we have environment variables from process.env, use them
    if (envVars.VIRTUAL_CLOUDINARY_CLOUD_NAME && envVars.VIRTUAL_CLOUDINARY_API_KEY && envVars.VIRTUAL_CLOUDINARY_API_SECRET) {
      console.log('✅ Using environment variables from process.env (Railway deployment)');
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
    console.log('🚀 Product image upload API called');
    
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
    const productId = formData.get('productId') as string;
    const fieldName = formData.get('fieldName') as string;

    console.log('📁 Files received:', files.length);
    console.log('🆔 Product ID:', productId);
    console.log('🏷️ Field Name:', fieldName);

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    if (!fieldName) {
      return NextResponse.json({ error: 'Field name is required' }, { status: 400 });
    }

    const uploadedFiles: Array<{ url: string; name: string; type: 'image'; size: number; publicId: string }> = [];

    for (const file of files) {
      try {
        console.log(`📄 Processing file: ${file.name} (${file.type}, ${file.size} bytes)`);
        
        // Validate file type - only images for product images
        if (!file.type.startsWith('image/')) {
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

        // Generate folder path and public_id for product images
        const folderPath = `virtual-products/${productId}/${fieldName}`;
        const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove file extension
        const fileExtension = file.name.split('.').pop(); // Get file extension
        const timestamp = Date.now();
        const publicId = `${folderPath}/${fileName}_${timestamp}.${fileExtension}`;
        
        console.log(`📤 Uploading to Cloudinary: ${file.name}`);
        console.log(`📁 Public ID will be: ${publicId}`);

        // Upload to Cloudinary
        console.log(`📤 Starting Cloudinary upload for: ${file.name}`);
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload(
            dataURI,
            {
              public_id: publicId,
              resource_type: 'image',
              folder: folderPath,
              overwrite: false,
              tags: ['virtual-product', `product-${productId}`, fieldName],
              context: {
                originalName: file.name,
                productId: productId,
                fieldName: fieldName,
                uploadedAt: new Date().toISOString()
              }
            },
            (error, result) => {
              if (error) {
                console.error(`❌ Cloudinary upload error for ${file.name}:`, error);
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
          type: 'image',
          size: file.size,
          publicId: result.public_id
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
      message: `${uploadedFiles.length} image(s) uploaded successfully to Cloudinary`
    });

  } catch (error) {
    console.error('❌ Error in product image upload API:', error);
    return NextResponse.json({ 
      error: 'Internal server error during image upload' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Product image delete API called');
    
    const { searchParams } = new URL(request.url);
    const publicId = searchParams.get('publicId');
    
    if (!publicId) {
      return NextResponse.json({ error: 'Public ID is required' }, { status: 400 });
    }

    // Configure Cloudinary
    cloudinary.config({
      cloud_name: virtualEnv.VIRTUAL_CLOUDINARY_CLOUD_NAME,
      api_key: virtualEnv.VIRTUAL_CLOUDINARY_API_KEY,
      api_secret: virtualEnv.VIRTUAL_CLOUDINARY_API_SECRET,
    });

    console.log(`🗑️ Deleting image with public ID: ${publicId}`);

    // Delete from Cloudinary
    const deleteResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          console.error(`❌ Cloudinary delete error:`, error);
          reject(error);
        } else {
          console.log(`✅ Cloudinary delete success:`, result);
          resolve(result);
        }
      });
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Image deleted successfully from Cloudinary',
      result: deleteResult
    });

  } catch (error) {
    console.error('❌ Error in product image delete API:', error);
    return NextResponse.json({ 
      error: 'Internal server error during image deletion' 
    }, { status: 500 });
  }
}
