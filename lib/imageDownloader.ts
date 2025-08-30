import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';
import { v2 as cloudinary } from 'cloudinary';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface DownloadedImage {
  originalUrl: string;
  localPath: string;
  filename: string;
  success: boolean;
  error?: string;
}

export class ImageDownloader {
  private static readonly IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'products');
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT = 5000; // Reduced from 10 to 5 seconds for faster timeouts

  /**
   * Configure Cloudinary for regular environment
   */
  private static configureCloudinary(): void {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    console.log(`☁️ Cloudinary config check:`, {
      cloudName: cloudName ? 'Set' : 'Missing',
      apiKey: apiKey ? 'Set' : 'Missing',
      apiSecret: apiSecret ? 'Set' : 'Missing'
    });

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      console.log(`☁️ Cloudinary configured successfully`);
    } else {
      console.error(`❌ Missing Cloudinary credentials`);
      throw new Error('Missing Cloudinary credentials');
    }
  }

  /**
   * Download image data from URL
   */
  private static async downloadImageData(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const request = https.get(url, { timeout: this.TIMEOUT }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Upload image to Cloudinary
   */
  private static async uploadToCloudinary(imageBuffer: Buffer, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
          public_id: filename.replace(/\.[^/.]+$/, ''), // Remove extension for public_id
          resource_type: 'image',
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve(result.secure_url);
          } else {
            reject(new Error('No result from Cloudinary'));
          }
        }
      );

      uploadStream.end(imageBuffer);
    });
  }

  /**
   * Download and upload a single image to Cloudinary
   */
  private static async downloadAndUploadImage(url: string, filename: string, forceRedownload: boolean = false): Promise<DownloadedImage> {
    try {
      console.log(`📥 Downloading image from: ${url}`);
      
      // Download image data
      const imageBuffer = await this.downloadImageData(url);
      
      // Configure Cloudinary
      this.configureCloudinary();
      
      // Upload to Cloudinary
      console.log(`☁️ Uploading to Cloudinary: ${filename}`);
      const cloudinaryUrl = await this.uploadToCloudinary(imageBuffer, filename);
      
      console.log(`✅ Successfully uploaded to Cloudinary: ${cloudinaryUrl}`);
      
      return {
        originalUrl: url,
        localPath: cloudinaryUrl, // Use Cloudinary URL as localPath
        filename,
        success: true
      };
    } catch (error) {
      console.error(`❌ Failed to process image ${filename}:`, error);
      console.error(`❌ Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        url,
        filename
      });
      return {
        originalUrl: url,
        localPath: '',
        filename,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate unique filename for image
   */
  private static generateFilename(originalUrl: string, index: number = 0): string {
    const urlParts = originalUrl.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const extension = lastPart.includes('.') ? path.extname(lastPart) : '.jpg';
    const baseName = lastPart.replace(extension, '') || 'image';
    
    // Try to extract a stable identifier from Airtable URLs
    if (originalUrl.includes('dl.airtable.com')) {
      // Airtable URLs have format: https://dl.airtable.com/.attachments/[id]/[filename]
      const urlPath = originalUrl.split('/');
      const attachmentId = urlPath.find(part => part.length > 20 && /^[a-zA-Z0-9_-]+$/.test(part));
      
      if (attachmentId) {
        // Use Airtable attachment ID for stable naming
        return `${baseName}_${attachmentId}${extension}`;
      }
    }
    
    // For non-Airtable URLs, use a hash of the URL for stable naming
    // This ensures the same URL always gets the same filename
    const crypto = require('crypto');
    const urlHash = crypto.createHash('md5').update(originalUrl).digest('hex').substring(0, 8);
    return `${baseName}_${urlHash}${index > 0 ? `_${index}` : ''}${extension}`;
  }

  /**
   * Download multiple images and upload to Cloudinary (optimized with parallel processing)
   */
  static async downloadImages(urls: any[], forceRedownload: boolean = false): Promise<DownloadedImage[]> {
    if (urls.length === 0) {
      return [];
    }

    console.log(`🚀 Starting parallel download and Cloudinary upload of ${urls.length} images...`);
    
    // Process URLs in parallel with higher concurrency limit for faster downloads
    const CONCURRENCY_LIMIT = 10; // Reduced from 20 to 10 to avoid overwhelming Cloudinary
    const results: DownloadedImage[] = [];
    
    for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
      const batch = urls.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`📦 Processing batch ${Math.floor(i/CONCURRENCY_LIMIT) + 1}/${Math.ceil(urls.length/CONCURRENCY_LIMIT)} (${batch.length} images)`);
      
      const batchPromises = batch.map(async (urlObj, batchIndex) => {
        // Handle Airtable attachment objects
        let url: string;
        if (typeof urlObj === 'string') {
          url = urlObj;
        } else if (urlObj && typeof urlObj === 'object' && urlObj.url) {
          url = urlObj.url;
        } else {
          console.log(`⚠️ Skipping invalid URL object:`, urlObj);
          return {
            originalUrl: String(urlObj),
            localPath: '',
            filename: '',
            success: false,
            error: 'Invalid URL format'
          };
        }
        
        let filename = this.generateFilename(url);
        let retries = 0;
        let success = false;
        let result: DownloadedImage;

        // Retry logic
        while (retries < this.MAX_RETRIES && !success) {
          result = await this.downloadAndUploadImage(url, filename, forceRedownload);
          
          if (result.success) {
            success = true;
          } else {
            retries++;
            if (retries < this.MAX_RETRIES) {
              // Keep the same filename for retries to ensure consistency
              console.log(`Retrying download for ${url} (attempt ${retries + 1})`);
            }
          }
        }

        // Log progress
        if (result!.success) {
          console.log(`✅ Processed: ${result!.filename}`);
        } else {
          console.log(`❌ Failed to process: ${url} - ${result!.error}`);
        }
        
        return result!;
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`📊 Processed ${results.length}/${urls.length} images so far`);
    }

    console.log(`🎉 Parallel processing completed: ${results.filter(r => r.success).length}/${urls.length} successful`);
    return results;
  }

  /**
   * Clean up images that are no longer referenced in current products
   * Note: For Cloudinary, this would require listing all resources and deleting unused ones
   * This is a simplified version that just logs the cleanup intention
   */
  static async cleanupUnusedImages(currentProductImages: string[]): Promise<void> {
    try {
      console.log(`ℹ️ Cloudinary cleanup: Would clean up unused images from ${currentProductImages.length} current product images`);
      console.log(`ℹ️ Note: Cloudinary cleanup requires listing all resources and is not implemented for performance reasons`);
    } catch (error) {
      console.error('Error during product image cleanup:', error);
    }
  }

  /**
   * Clean up ALL images in the products directory (for fresh sync)
   * Note: For Cloudinary, this would require deleting all resources in the products folder
   * This is a simplified version that just logs the cleanup intention
   */
  static async cleanupAllImages(): Promise<void> {
    try {
      console.log(`ℹ️ Cloudinary cleanup: Would clean up ALL product images for fresh sync`);
      console.log(`ℹ️ Note: Cloudinary cleanup requires listing all resources and is not implemented for performance reasons`);
    } catch (error) {
      console.error('Error during complete image cleanup:', error);
    }
  }
} 