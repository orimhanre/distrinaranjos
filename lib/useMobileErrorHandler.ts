'use client';

import { useEffect } from 'react';

export function useMobileErrorHandler() {
  useEffect(() => {
    const handleChunkError = (event: ErrorEvent) => {
      // Check if it's a chunk loading error
      if (event.error && (
        event.error.message.includes('Loading chunk') ||
        event.error.message.includes('ChunkLoadError') ||
        event.error.message.includes('app/cart/page')
      )) {
        console.log('🔄 Mobile chunk loading error detected, attempting recovery...');
        
        // Clear any cached chunks
        if ('caches' in window) {
          caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
              if (cacheName.includes('next') || cacheName.includes('chunk')) {
                caches.delete(cacheName);
              }
            });
          });
        }
        
        // Clear service worker cache if available
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(registrations => {
            registrations.forEach(registration => {
              registration.unregister();
            });
          });
        }
        
        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && (
        event.reason.message?.includes('Loading chunk') ||
        event.reason.message?.includes('ChunkLoadError')
      )) {
        console.log('🔄 Mobile chunk loading promise rejection detected...');
        event.preventDefault();
        
        // Reload the page
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    };

    // Add event listeners
    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
}
