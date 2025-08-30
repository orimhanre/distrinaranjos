import { NextRequest, NextResponse } from 'next/server';
import { AirtableService } from '@/lib/airtable';
import { ProductDatabase } from '@/lib/database';
import fs from 'fs';
import path from 'path';
import https from 'https';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting product image download process...');
    
    // Get all products from database
    const productDB = new ProductDatabase('regular');
    const products = productDB.getAllProducts();
    
    if (products.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No products found in database. Please sync products first.',
        downloadedCount: 0,
        totalProducts: 0
      });
    }
    
    console.log(`📦 Found ${products.length} products to process`);
    
    // Ensure images directory exists
    const imagesDir = path.join(process.cwd(), 'public', 'images', 'products');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`📁 Created images directory: ${imagesDir}`);
    }
    
    let downloadedCount = 0;
    const errors: string[] = [];
    
    // Process each product
    for (const product of products) {
      if (!product.imageURL || !Array.isArray(product.imageURL) || product.imageURL.length === 0) {
        continue;
      }
      
      for (const imageUrl of product.imageURL) {
        try {
          // Extract filename from URL
          let filename: string;
          if (typeof imageUrl === 'string') {
            // If it's already a local path, skip
            if (imageUrl.startsWith('/images/products/')) {
              continue;
            }
            
            // Extract filename from Airtable URL
            const urlParts = imageUrl.split('/');
            filename = urlParts[urlParts.length - 1];
            
            // Clean filename (remove query parameters)
            filename = filename.split('?')[0];
          } else if (imageUrl && typeof imageUrl === 'object' && imageUrl.filename) {
            filename = imageUrl.filename;
          } else {
            continue;
          }
          
          const filepath = path.join(imagesDir, filename);
          
          // Skip if file already exists
          if (fs.existsSync(filepath)) {
            console.log(`✅ Image already exists: ${filename}`);
            downloadedCount++;
            continue;
          }
          
          // Download image
          const actualUrl = typeof imageUrl === 'string' ? imageUrl : imageUrl.url;
          if (!actualUrl) continue;
          
          await downloadImage(actualUrl, filepath);
          console.log(`✅ Downloaded: ${filename}`);
          downloadedCount++;
          
        } catch (error) {
          const errorMsg = `Failed to download image for product ${product.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }
    
    console.log(`🎉 Image download completed: ${downloadedCount} images downloaded`);
    
    return NextResponse.json({
      success: true,
      message: `Downloaded ${downloadedCount} product images`,
      downloadedCount,
      totalProducts: products.length,
      errors
    });
    
  } catch (error) {
    console.error('❌ Error during image download:', error);
    return NextResponse.json({
      success: false,
      message: 'Error during image download',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function downloadImage(url: string, filepath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    
    const request = https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(filepath, () => {}); // Delete the file if it exists
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(filepath, () => {}); // Delete the file if it exists
      reject(err);
    });
    
    request.setTimeout(10000, () => {
      request.destroy();
      fs.unlink(filepath, () => {});
      reject(new Error('Download timeout'));
    });
  });
}
