/**
 * Cache Busting Utility for Dynamic Images
 * Prevents browser caching issues after Airtable syncs
 */

export class CacheBuster {
  private static instance: CacheBuster;
  private lastSyncTimestamp: number = 0;
  private version: string = '1.0.0';

  private constructor() {
    // Initialize with current timestamp
    this.lastSyncTimestamp = Date.now();
  }

  public static getInstance(): CacheBuster {
    if (!CacheBuster.instance) {
      CacheBuster.instance = new CacheBuster();
    }
    return CacheBuster.instance;
  }

  /**
   * Update sync timestamp when new data is synced
   */
  public updateSyncTimestamp(): void {
    this.lastSyncTimestamp = Date.now();
    console.log('🔄 Cache buster timestamp updated:', new Date(this.lastSyncTimestamp).toISOString());
  }

  /**
   * Get current sync timestamp
   */
  public getSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }

  /**
   * Add cache busting parameters to image URLs
   */
  public bustCache(url: string, forceRefresh: boolean = false): string {
    if (!url || url === '/placeholder-product.svg' || url === '/placeholder-image.png') {
      return url;
    }

    // Use sync timestamp for cache busting
    const timestamp = forceRefresh ? Date.now() : this.lastSyncTimestamp;
    
    // Add multiple cache busting parameters
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${this.version}&t=${timestamp}&cb=${timestamp}`;
  }

  /**
   * Force refresh all images on the page
   */
  public forceRefreshImages(): void {
    try {
      // Update timestamp
      this.updateSyncTimestamp();
      
      // Force reload all images with new cache buster
      const images = document.querySelectorAll('img');
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && !src.includes('placeholder')) {
          const newSrc = this.bustCache(src, true);
          if (newSrc !== src) {
            img.src = newSrc;
          }
        }
      });

      // Force reload background images
      const elementsWithBg = document.querySelectorAll('[style*="background-image"]');
      elementsWithBg.forEach((el) => {
        const style = el.getAttribute('style');
        if (style && style.includes('background-image')) {
          const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch) {
            const oldUrl = urlMatch[1];
            const newUrl = this.bustCache(oldUrl, true);
            if (newUrl !== oldUrl) {
              const newStyle = style.replace(oldUrl, newUrl);
              el.setAttribute('style', newStyle);
            }
          }
        }
      });

      console.log('🔄 Forced refresh of all images with new cache buster');
    } catch (error) {
      console.error('Error forcing image refresh:', error);
    }
  }

  /**
   * Clear browser cache for specific URLs
   */
  public async clearImageCache(urls: string[]): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        
        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          
          for (const url of urls) {
            await cache.delete(url);
          }
        }
        
        console.log('🗑️ Cleared browser cache for images');
      }
    } catch (error) {
      console.error('Error clearing image cache:', error);
    }
  }

  /**
   * Add cache headers to prevent future caching
   */
  public addNoCacheHeaders(): void {
    // This would be used in API responses or meta tags
    const meta = document.createElement('meta');
    meta.setAttribute('http-equiv', 'Cache-Control');
    meta.setAttribute('content', 'no-cache, no-store, must-revalidate');
    document.head.appendChild(meta);
  }

  /**
   * Get cache busted URL with current sync timestamp
   */
  public getBustedUrl(url: string): string {
    return this.bustCache(url, false);
  }

  /**
   * Check if URL needs cache busting
   */
  public needsCacheBusting(url: string): boolean {
    return Boolean(url && 
           !url.includes('placeholder') && 
           !url.includes('?t=') && 
           !url.includes('?v=') &&
           (url.startsWith('/images/') || url.includes('webphotos')));
  }
}

// Export singleton instance
export const cacheBuster = CacheBuster.getInstance();
