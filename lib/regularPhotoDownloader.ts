import fs from 'fs';
import https from 'https';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface DownloadedRegularImage {
  originalUrl: string;
  localPath: string;
  filename: string;
  success: boolean;
  error?: string;
}

export class RegularPhotoDownloader {
  // Use Railway-compatible paths
  private static readonly IMAGES_DIR = process.env.NODE_ENV === 'production' 
    ? path.join('/tmp', 'images', 'regular-products')  // Railway uses /tmp for writable storage
    : path.join(process.cwd(), 'public', 'images', 'products');
  
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT = 10000;

  /**
   * Get the public URL for an image (works for both local and Railway)
   */
  private static getPublicImageUrl(filename: string): string {
    // Always return relative paths for consistency
    return `/api/images/regular/${filename}`;
  }

  /**
   * Ensure the images directory exists
   */
  private static async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    } catch (error) {
      // Directory might already exist, that's fine
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
   * Use original filename from Airtable attachment object
   */
  private static getOriginalFilename(attachmentObj: any, index: number = 0): string {
    // If we have the original Airtable attachment object with filename, use it
    if (attachmentObj && typeof attachmentObj === 'object' && attachmentObj.filename) {
      const originalFilename = attachmentObj.filename;
      if (index > 0) {
        // Add index only if there are multiple images with same name
        const extension = path.extname(originalFilename) || '.jpg';
        const baseName = path.basename(originalFilename, extension);
        return `${baseName}_${index}${extension}`;
      }
      return originalFilename;
    }
    
    // Fallback for URLs without attachment objects
    if (typeof attachmentObj === 'string') {
      const url = attachmentObj;
      if (url.includes('dl.airtable.com')) {
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        if (filename) {
          return filename;
        }
      }
    }
    
    // Last resort: generate hash-based filename
    const crypto = require('crypto');
    const urlHash = crypto.createHash('md5').update(String(attachmentObj)).digest('hex').substring(0, 8);
    const extension = path.extname(String(attachmentObj)) || '.jpg';
    return `image_${urlHash}${index > 0 ? `_${index}` : ''}${extension}`;
  }

  /**
   * Download and save a single image locally
   */
  private static async downloadAndSaveImage(url: string, filename: string, dir: string): Promise<DownloadedRegularImage> {
    try {
      await this.ensureDirectoryExists(dir);
      
      console.log(`📥 Downloading image from: ${url}`);
      
      const imageData = await this.downloadImageData(url);
      const filePath = path.join(dir, filename);
      
      await writeFile(filePath, imageData);
      console.log(`✅ Successfully saved: ${filename}`);
      
      return {
        originalUrl: url,
        localPath: filePath,
        filename: filename,
        success: true
      };
    } catch (error) {
      console.error(`❌ Failed to download ${filename}:`, error);
      return {
        originalUrl: url,
        localPath: '',
        filename: filename,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Download product images and return local paths
   */
  static async downloadProductImages(attachments: any[]): Promise<string[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    console.log(`🚀 Starting regular product images download: ${attachments.length} images...`);
    
    const results: DownloadedRegularImage[] = [];
    
    // Process images in batches to avoid overwhelming the system
    const batchSize = 3;
    for (let i = 0; i < attachments.length; i += batchSize) {
      const batch = attachments.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (attachment, batchIndex) => {
        const globalIndex = i + batchIndex;
        const url = typeof attachment === 'string' ? attachment : attachment.url;
        const filename = this.getOriginalFilename(attachment, globalIndex);
        
        try {
          const result = await this.downloadAndSaveImage(url, filename, this.IMAGES_DIR);
          console.log(`✅ Processed: ${filename}`);
          return result;
        } catch (error) {
          console.error(`❌ Failed to process ${filename}:`, error);
          return {
            originalUrl: url,
            localPath: '',
            filename: filename,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < attachments.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    const successfulDownloads = results.filter(r => r.success);
    console.log(`🎉 Regular product images download completed: ${successfulDownloads.length}/${attachments.length} successful`);
    
    // Return public URLs for successful downloads
    return successfulDownloads.map(result => 
      this.getPublicImageUrl(result.filename)
    );
  }

  /**
   * Clean up unused images
   */
  static async cleanupUnusedImages(usedFilenames: Set<string>): Promise<void> {
    try {
      const files = await promisify(fs.readdir)(this.IMAGES_DIR);
      let cleanedCount = 0;
      
      for (const file of files) {
        if (!usedFilenames.has(file)) {
          const filePath = path.join(this.IMAGES_DIR, file);
          await promisify(fs.unlink)(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} unused regular product images`);
      }
    } catch (error) {
      console.log(`⚠️ Could not clean up regular product images:`, error);
    }
  }
}
