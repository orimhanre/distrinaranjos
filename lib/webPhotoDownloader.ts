import fs from 'fs';
import https from 'https';
import path from 'path';

/**
 * WebPhoto Downloader
 * 
 * IMPORTANT: NEVER use timestamps in filenames!
 * All filenames must be stable and consistent between syncs.
 * Use only: name, URL hash, Airtable ID, or original filename.
 */

export class WebPhotoDownloader {
  private static readonly IMAGES_DIR = 'public/images/webphotos';
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT = 10000; // 10 seconds

  /**
   * Ensure the images directory exists
   */
  private static ensureDirectoryExists(): void {
    if (!fs.existsSync(this.IMAGES_DIR)) {
      fs.mkdirSync(this.IMAGES_DIR, { recursive: true });
      console.log(`📁 Created directory: ${this.IMAGES_DIR}`);
    }
  }

  /**
   * Download a single image from URL and save it locally
   */
  private static async downloadImage(url: string, filename: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const filepath = path.join(this.IMAGES_DIR, filename);
      
      // Check if file already exists
      if (fs.existsSync(filepath)) {
        console.log(`✅ WebPhoto already exists: ${filename}`);
        resolve(`/images/webphotos/${filename}`);
        return;
      }

      // Check if there's an existing file with the same content (different filename)
      const existingFile = this.findExistingFileWithSameContent(url);
      if (existingFile) {
        console.log(`✅ Found existing WebPhoto with same content: ${existingFile} -> ${filename}`);
        // Copy the existing file to the new filename
        try {
          fs.copyFileSync(existingFile, filepath);
          resolve(`/images/webphotos/${filename}`);
          return;
        } catch (error) {
          console.warn('Failed to copy existing file, will download instead:', error);
        }
      }

      const file = fs.createWriteStream(filepath);
      
      const request = https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Downloaded WebPhoto: ${filename}`);
          resolve(`/images/webphotos/${filename}`);
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

      request.setTimeout(this.TIMEOUT, () => {
        request.destroy();
        fs.unlink(filepath, () => {});
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Find existing file with the same content by checking file size
   */
  private static findExistingFileWithSameContent(url: string): string | null {
    try {
      if (!fs.existsSync(this.IMAGES_DIR)) {
        return null;
      }

      const files = fs.readdirSync(this.IMAGES_DIR);
      
      // For now, just return null to avoid async complexity
      // In a future version, we could implement proper content comparison
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a unique filename for the image
   */
  private static async generateFilename(name: string, url: string): Promise<string> {
    const extension = await this.getExtensionFromContentType(url);
    
    // For brand logos and other files, use the name as-is (already normalized from Airtable)
    if (name.startsWith('logo_')) {
      return `${name}${extension}`;
    }
    
    // For other files, use the name as-is since it's already normalized
    const sanitizedName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    // Simple naming - just use the sanitized name with extension
    // NO TIMESTAMPS, NO RANDOM IDS, NO HASHES
    return `${sanitizedName}${extension}`;
  }

  /**
   * Simple hash function for URL stability
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract file extension from URL
   */
  private static getExtensionFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const extension = path.extname(pathname);
      return extension || '.jpg'; // Default to .jpg if no extension found
    } catch {
      return '.jpg'; // Default fallback
    }
  }

  /**
   * Get file extension from content type
   */
  private static async getExtensionFromContentType(url: string): Promise<string> {
    return new Promise((resolve) => {
      const request = https.request(url, { method: 'HEAD' }, (response) => {
        const contentType = response.headers['content-type'] || '';
        
        if (contentType.includes('pdf')) {
          resolve('.pdf');
        } else if (contentType.includes('png')) {
          resolve('.png');
        } else if (contentType.includes('gif')) {
          resolve('.gif');
        } else if (contentType.includes('webp')) {
          resolve('.webp');
        } else if (contentType.includes('svg')) {
          resolve('.svg');
        } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
          resolve('.jpg');
        } else {
          // Default to .jpg for unknown types
          resolve('.jpg');
        }
      });
      
      request.on('error', () => {
        // Fallback to URL-based detection on error
        resolve(this.getExtensionFromUrl(url));
      });
      
      request.setTimeout(5000, () => {
        request.destroy();
        resolve(this.getExtensionFromUrl(url));
      });
      
      request.end();
    });
  }

  /**
   * Download multiple WebPhotos and return local paths
   */
  static async downloadWebPhotos(webPhotos: Record<string, string>): Promise<Record<string, string>> {
    this.ensureDirectoryExists();
    
    const localWebPhotos: Record<string, string> = {};

    for (const [name, url] of Object.entries(webPhotos)) {
      if (!url || url.trim() === '') {
        console.log(`⚠️ Skipping WebPhoto ${name}: no URL provided`);
        continue;
      }

      try {
        const filename = await this.generateFilename(name, url);
        const localPath = await this.downloadImage(url, filename);
        
        if (localPath) {
          localWebPhotos[name] = localPath;
        }
      } catch (error) {
        console.error(`❌ Failed to download WebPhoto ${name}:`, error instanceof Error ? error.message : 'Unknown error');
        // Keep the original URL as fallback
        localWebPhotos[name] = url;
      }
    }

    console.log(`🎉 Downloaded ${Object.keys(localWebPhotos).length} WebPhotos locally`);
    
    return localWebPhotos;
  }

  /**
   * Clean up old WebPhoto files that are no longer needed
   */
  static async cleanupOldFiles(currentWebPhotos: Record<string, string>): Promise<void> {
    try {
      if (!fs.existsSync(this.IMAGES_DIR)) {
        return;
      }

      const files = fs.readdirSync(this.IMAGES_DIR);
      const currentFilenames = new Set(
        Object.values(currentWebPhotos).map(path => path.split('/').pop())
      );

      let deletedCount = 0;
      for (const file of files) {
        if (!currentFilenames.has(file)) {
          const filepath = path.join(this.IMAGES_DIR, file);
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🗑️ Cleaned up ${deletedCount} old WebPhoto files`);
      }
    } catch (error) {
      console.error('Error cleaning up old WebPhoto files:', error);
    }
  }
} 