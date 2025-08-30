import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';

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
   * Ensure images directory exists
   */
  private static async ensureImagesDir(): Promise<void> {
    try {
      await mkdir(this.IMAGES_DIR, { recursive: true });
    } catch (error) {
      console.error('Error creating images directory:', error);
    }
  }

  /**
   * Download a single image from URL
   */
  private static async downloadImage(url: string, filename: string, forceRedownload: boolean = false): Promise<DownloadedImage> {
    const localPath = path.join(this.IMAGES_DIR, filename);
    const publicUrl = `/images/products/${filename}`;

    // Check if file already exists to avoid re-downloading (unless forceRedownload is true)
    if (fs.existsSync(localPath) && !forceRedownload) {
      console.log(`✅ Image already exists: ${filename}`);
      return {
        originalUrl: url,
        localPath: publicUrl,
        filename,
        success: true
      };
    }
    
    // If forceRedownload is true and file exists, delete it first
    if (fs.existsSync(localPath) && forceRedownload) {
      console.log(`🔄 Force re-download: deleting existing file ${filename}`);
      fs.unlinkSync(localPath);
    }

    return new Promise((resolve) => {
      const file = fs.createWriteStream(localPath);
      
      const request = https.get(url, { timeout: this.TIMEOUT }, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlink(localPath, () => {}); // Clean up failed download
          resolve({
            originalUrl: url,
            localPath: '',
            filename,
            success: false,
            error: `HTTP ${response.statusCode}`
          });
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve({
            originalUrl: url,
            localPath: publicUrl,
            filename,
            success: true
          });
        });

        file.on('error', (err) => {
          file.close();
          fs.unlink(localPath, () => {}); // Clean up failed download
          resolve({
            originalUrl: url,
            localPath: '',
            filename,
            success: false,
            error: err.message
          });
        });
      });

      request.on('error', (err) => {
        file.close();
        fs.unlink(localPath, () => {}); // Clean up failed download
        resolve({
          originalUrl: url,
          localPath: '',
          filename,
          success: false,
          error: err.message
        });
      });

      request.on('timeout', () => {
        request.destroy();
        file.close();
        fs.unlink(localPath, () => {}); // Clean up failed download
        resolve({
          originalUrl: url,
          localPath: '',
          filename,
          success: false,
          error: 'Download timeout'
        });
      });
    });
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
   * Download multiple images from URLs (optimized with parallel processing)
   */
  static async downloadImages(urls: any[], forceRedownload: boolean = false): Promise<DownloadedImage[]> {
    await this.ensureImagesDir();
    
    if (urls.length === 0) {
      return [];
    }

    console.log(`🚀 Starting parallel download of ${urls.length} images...`);
    
    // Process URLs in parallel with higher concurrency limit for faster downloads
    const CONCURRENCY_LIMIT = 20; // Increased from 10 to 20 for faster downloads
    const results: DownloadedImage[] = [];
    
    for (let i = 0; i < urls.length; i += CONCURRENCY_LIMIT) {
      const batch = urls.slice(i, i + CONCURRENCY_LIMIT);
      console.log(`📦 Downloading batch ${Math.floor(i/CONCURRENCY_LIMIT) + 1}/${Math.ceil(urls.length/CONCURRENCY_LIMIT)} (${batch.length} images)`);
      
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
          result = await this.downloadImage(url, filename, forceRedownload);
          
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
          console.log(`✅ Downloaded: ${result!.filename}`);
        } else {
          console.log(`❌ Failed to download: ${url} - ${result!.error}`);
        }
        
        return result!;
      });

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`📊 Downloaded ${results.length}/${urls.length} images so far`);
    }

    console.log(`🎉 Parallel download completed: ${results.filter(r => r.success).length}/${urls.length} successful`);
    return results;
  }

  /**
   * Clean up images that are no longer referenced in current products
   */
  static async cleanupUnusedImages(currentProductImages: string[]): Promise<void> {
    try {
      if (!fs.existsSync(this.IMAGES_DIR)) {
        return;
      }

      const files = fs.readdirSync(this.IMAGES_DIR);
      const currentFilenames = new Set(currentProductImages.map(path => path.split('/').pop()));

      let deletedCount = 0;
      for (const file of files) {
        if (!currentFilenames.has(file)) {
          const filePath = path.join(this.IMAGES_DIR, file);
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Cleaned up unused image: ${file}`);
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${deletedCount} unused product images`);
      } else {
        console.log(`✅ No unused product images to clean up`);
      }
    } catch (error) {
      console.error('Error during product image cleanup:', error);
    }
  }

  /**
   * Clean up ALL images in the products directory (for fresh sync)
   */
  static async cleanupAllImages(): Promise<void> {
    try {
      if (!fs.existsSync(this.IMAGES_DIR)) {
        return;
      }

      const files = fs.readdirSync(this.IMAGES_DIR);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(this.IMAGES_DIR, file);
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`🗑️ Deleted image: ${file}`);
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ALL ${deletedCount} product images for fresh sync`);
      } else {
        console.log(`✅ No product images to clean up`);
      }
    } catch (error) {
      console.error('Error during complete image cleanup:', error);
    }
  }
} 