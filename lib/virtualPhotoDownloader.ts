import fs from 'fs';
import https from 'https';
import path from 'path';
import { promisify } from 'util';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

export interface DownloadedVirtualImage {
  originalUrl: string;
  localPath: string;
  filename: string;
  success: boolean;
  error?: string;
}

export class VirtualPhotoDownloader {
  // Use Railway-compatible paths
  private static readonly IMAGES_DIR = process.env.NODE_ENV === 'production' 
    ? path.join('/tmp', 'images', 'virtual-products')  // Railway uses /tmp for writable storage
    : path.join(process.cwd(), 'public', 'images', 'virtual-products');
  
  private static readonly WEBPHOTOS_DIR = process.env.NODE_ENV === 'production'
    ? path.join('/tmp', 'images', 'virtual-webphotos')  // Railway uses /tmp for writable storage
    : path.join(process.cwd(), 'public', 'images', 'virtual-webphotos');
  
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT = 10000;

  /**
   * Get the public URL for an image (works for both local and Railway)
   */
  private static getPublicImageUrl(filename: string, type: 'products' | 'webphotos'): string {
    if (process.env.NODE_ENV === 'production') {
      // For production, use the custom domain
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://distrinaranjos.co';
      return `${baseUrl}/api/images/${type}/${filename}`;
    } else {
      // For local development, use localhost
      return `http://localhost:3000/api/images/${type}/${filename}`;
    }
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
  private static async downloadAndSaveImage(url: string, filename: string, dir: string): Promise<DownloadedVirtualImage> {
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

    console.log(`🚀 Starting virtual product images download: ${attachments.length} images...`);
    
    const results: DownloadedVirtualImage[] = [];
    
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      const url = typeof attachment === 'string' ? attachment : attachment.url;
      const filename = this.getOriginalFilename(attachment, i);
      
      const result = await this.downloadAndSaveImage(url, filename, this.IMAGES_DIR);
      results.push(result);
      
      console.log(`✅ Processed: ${filename}`);
    }
    
    const successfulDownloads = results.filter(r => r.success);
    console.log(`🎉 Virtual product images download completed: ${successfulDownloads.length}/${attachments.length} successful`);
    
    // Return public URLs for successful downloads
    return successfulDownloads.map(result => 
      this.getPublicImageUrl(result.filename, 'products')
    );
  }

  /**
   * Download WebPhotos and return local paths
   */
  static async downloadWebPhotos(webPhotos: any[]): Promise<string[]> {
    if (!webPhotos || webPhotos.length === 0) {
      return [];
    }

    console.log(`🚀 Starting virtual WebPhotos download: ${webPhotos.length} images...`);
    
    const results: DownloadedVirtualImage[] = [];
    
    for (let i = 0; i < webPhotos.length; i++) {
      const webPhoto = webPhotos[i];
      const url = webPhoto.imageUrl || webPhoto.url;
      
      // Use original filename if provided, otherwise extract from URL
      let filename: string;
      if (webPhoto.originalFilename && webPhoto.originalFilename.trim() !== '') {
        filename = webPhoto.originalFilename;
        console.log(`📝 Using original filename: ${filename}`);
      } else {
        filename = this.getOriginalFilename(webPhoto, i);
        console.log(`🔍 Extracted filename from URL: ${filename}`);
      }
      
      const result = await this.downloadAndSaveImage(url, filename, this.WEBPHOTOS_DIR);
      results.push(result);
      
      console.log(`✅ Processed: ${filename}`);
    }
    
    const successfulDownloads = results.filter(r => r.success);
    console.log(`🎉 Virtual WebPhotos download completed: ${successfulDownloads.length}/${webPhotos.length} successful`);
    
    // Return public URLs for successful downloads
    return successfulDownloads.map(result => 
      this.getPublicImageUrl(result.filename, 'webphotos')
    );
  }

  /**
   * Clean up unused images
   */
  static async cleanupUnusedImages(usedFilenames: Set<string>, type: 'products' | 'webphotos'): Promise<void> {
    const dir = type === 'products' ? this.IMAGES_DIR : this.WEBPHOTOS_DIR;
    
    try {
      const files = await promisify(fs.readdir)(dir);
      let cleanedCount = 0;
      
      for (const file of files) {
        if (!usedFilenames.has(file)) {
          const filePath = path.join(dir, file);
          await promisify(fs.unlink)(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} unused ${type} images`);
      }
    } catch (error) {
      console.log(`⚠️ Could not clean up ${type} images:`, error);
    }
  }
}
