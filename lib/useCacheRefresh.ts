import { useCallback, useEffect, useState } from 'react';
import { cacheBuster } from './cacheBuster';

export const useCacheRefresh = () => {
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen for sync completion events
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('🔄 Sync completion detected, triggering cache refresh...');
      refreshCache();
    };

    const handleWebPhotosSync = () => {
      console.log('🖼️ WebPhotos sync detected, triggering cache refresh...');
      refreshCache();
    };

    // Listen for custom events
    window.addEventListener('virtual-sync-complete', handleSyncComplete);
    window.addEventListener('webphotos-sync-complete', handleWebPhotosSync);

    return () => {
      window.removeEventListener('virtual-sync-complete', handleSyncComplete);
      window.removeEventListener('webphotos-sync-complete', handleWebPhotosSync);
    };
  }, []);

  // Manual cache refresh function
  const refreshCache = useCallback(async () => {
    try {
      setIsRefreshing(true);
      console.log('🔄 Starting manual cache refresh...');

      // Update cache buster timestamp
      cacheBuster.updateSyncTimestamp();

      // Force refresh all images on the page
      cacheBuster.forceRefreshImages();

      // Call cache refresh API
      const response = await fetch('/api/cache-refresh', { method: 'POST' });
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Cache refresh API completed:', result);
      }

      // Update last refresh timestamp
      setLastRefresh(Date.now());
      
      console.log('🎉 Cache refresh completed successfully');
    } catch (error) {
      console.error('❌ Cache refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Force refresh specific images
  const refreshImages = useCallback((imageUrls: string[]) => {
    try {
      console.log('🔄 Refreshing specific images...');
      
      imageUrls.forEach(url => {
        const img = document.querySelector(`img[src="${url}"]`) as HTMLImageElement;
        if (img) {
          const newSrc = cacheBuster.bustCache(url, true);
          img.src = newSrc;
        }
      });
      
      console.log('✅ Specific images refreshed');
    } catch (error) {
      console.error('❌ Image refresh failed:', error);
    }
  }, []);

  // Get cache busted URL
  const getBustedUrl = useCallback((url: string) => {
    return cacheBuster.getBustedUrl(url);
  }, []);

  // Check if URL needs cache busting
  const needsCacheBusting = useCallback((url: string) => {
    return cacheBuster.needsCacheBusting(url);
  }, []);

  return {
    lastRefresh,
    isRefreshing,
    refreshCache,
    refreshImages,
    getBustedUrl,
    needsCacheBusting,
    cacheBuster: cacheBuster
  };
};
