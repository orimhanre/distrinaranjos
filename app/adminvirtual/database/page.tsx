'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { virtualAuth, virtualGoogleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';
import { usePathname } from 'next/navigation';


interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'multipleSelect' | 'attachment';
  editable: boolean;
}

  // Function to convert internal field types to Airtable field types
  const getAirtableFieldType = (type: string): string => {
    switch (type) {
      case 'text':
        return 'Single line text';
      case 'number':
        return 'Number';
      case 'boolean':
        return 'Checkbox';
      case 'select':
        return 'Single select';
      case 'multipleSelect':
        return 'Multiple select';
      case 'attachment':
        return 'Attachment';
      default:
        return type;
    }
  };

export default function VirtualDatabasePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [displayCount, setDisplayCount] = useState(25);
  const [syncingWebPhotos, setSyncingWebPhotos] = useState(false);
  const [webPhotosSyncResult, setWebPhotosSyncResult] = useState<any>(null);
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  const [showWebPhotosTable, setShowWebPhotosTable] = useState(false);
  const [showProductsTable, setShowProductsTable] = useState(false);
  const [lastProductSync, setLastProductSync] = useState<string | null>(null);
  const [lastWebPhotosSync, setLastWebPhotosSync] = useState<string | null>(null);
  const [showProductUpdate, setShowProductUpdate] = useState(false);
  const [showWebPhotosUpdate, setShowWebPhotosUpdate] = useState(false);
  const [externalSyncNotification, setExternalSyncNotification] = useState<string | null>(null);

  const [cacheRefreshResult, setCacheRefreshResult] = useState<any>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const pathname = usePathname();
  


  // Handle manual image cleanup
  const handleImageCleanup = async () => {
    try {
      setCacheRefreshResult({
        success: true,
        message: '🧹 Limpiando imágenes no utilizadas...'
      });
      
      const response = await fetch('/api/cleanup-images', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        setCacheRefreshResult({
          success: true,
          message: `✅ Limpieza completada: ${result.message}`
        });
      } else {
        setCacheRefreshResult({
          success: false,
          message: `❌ Error en limpieza: ${result.message}`
        });
      }
      
      // Clear the result after 5 seconds
      setTimeout(() => setCacheRefreshResult(null), 5000);
    } catch (error) {
      setCacheRefreshResult({
        success: false,
        message: `❌ Error al limpiar imágenes: ${error}`
      });
      
      // Clear the result after 5 seconds
      setTimeout(() => setCacheRefreshResult(null), 5000);
    }
  };

  // Clear database with confirmation
  const clearDatabase = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearDatabase = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.log('🗑️ Clear operation timed out after 30 seconds');
      setClearing(false);
      setClearResult({ success: false, message: 'Operación cancelada por timeout' });
    }, 30000);
    
    try {
      const response = await fetch('/api/database/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' }),
      });
      const result = await response.json();
      setClearResult(result);
      if (result.success) {
        // Clear sync timestamps when database is cleared
        setLastProductSync(null);
        setLastWebPhotosSync(null);
        localStorage.removeItem('adminvirtual-last-product-sync');
        localStorage.removeItem('adminvirtual-last-webphotos-sync');
        
        // Clear columns and selected columns when database is cleared
        setColumns([]);
        setSelectedColumns([]);
        localStorage.removeItem('virtual-admin-selected-columns');
        
        // Add a small delay to ensure file system operations are complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await loadProducts();
        await loadWebPhotos();
        await fetchColumns();
      }
    } catch (error) {
      console.error('🗑️ Error during database clear:', error);
      setClearResult({ success: false, message: 'Error al limpiar base de datos' });
    } finally {
      clearTimeout(timeoutId);
      setClearing(false);
    }
  };



  // Load sync timestamps from localStorage and server on component mount
  useEffect(() => {
    const loadSyncTimestamps = async () => {
      try {
        // First try localStorage
        const savedProductSync = localStorage.getItem('adminvirtual-last-product-sync');
        const savedWebPhotosSync = localStorage.getItem('adminvirtual-last-webphotos-sync');
        
        // Then try server backup
        try {
          const response = await fetch('/api/admin/virtual-sync-timestamps');
          if (response.ok) {
            const data = await response.json();
            
            // Use server timestamps if localStorage is empty
            if (!savedProductSync && data.timestamps.lastProductSync) {
              setLastProductSync(data.timestamps.lastProductSync);
              saveTimestampToStorage('adminvirtual-last-product-sync', data.timestamps.lastProductSync);
            } else if (savedProductSync) {
              setLastProductSync(savedProductSync);
            }
            
            if (!savedWebPhotosSync && data.timestamps.lastWebPhotosSync) {
              setLastWebPhotosSync(data.timestamps.lastWebPhotosSync);
              saveTimestampToStorage('adminvirtual-last-webphotos-sync', data.timestamps.lastWebPhotosSync);
            } else if (savedWebPhotosSync) {
              setLastWebPhotosSync(savedWebPhotosSync);
            }
          }
        } catch (serverError) {
          // Fallback to localStorage only
          if (savedProductSync) {
            setLastProductSync(savedProductSync);
          }
          
          if (savedWebPhotosSync) {
            setLastWebPhotosSync(savedWebPhotosSync);
          }
        }
        
      } catch (error) {
        console.error('❌ Error loading sync timestamps:', error);
      }
    };

    loadSyncTimestamps();
  }, []);

  // Function to refresh timestamps from server
  const refreshTimestamps = async () => {
    try {
      const response = await fetch('/api/admin/virtual-sync-timestamps');
      if (response.ok) {
        const data = await response.json();
        
        if (data.timestamps.lastProductSync) {
          setLastProductSync(data.timestamps.lastProductSync);
          saveTimestampToStorage('adminvirtual-last-product-sync', data.timestamps.lastProductSync);
        }
        
        if (data.timestamps.lastWebPhotosSync) {
          setLastWebPhotosSync(data.timestamps.lastWebPhotosSync);
          saveTimestampToStorage('adminvirtual-last-webphotos-sync', data.timestamps.lastWebPhotosSync);
        }
      }
    } catch (error) {
      console.error('❌ Error refreshing timestamps:', error);
    }
  };

      // Set up smart polling to check for external syncs
    useEffect(() => {
        let lastProductSync: string | null = null;
        let lastWebPhotosSync: string | null = null;
        
        const checkForUpdates = async () => {
            try {
                const response = await fetch('/api/admin/virtual-sync-timestamps');
                if (response.ok) {
                    const data = await response.json();
                    
                    // Check if timestamps have changed
                    if (data.timestamps.lastProductSync !== lastProductSync) {
                        lastProductSync = data.timestamps.lastProductSync;
                        if (data.timestamps.lastProductSync) {
                            setLastProductSync(data.timestamps.lastProductSync);
                            saveTimestampToStorage('adminvirtual-last-product-sync', data.timestamps.lastProductSync);
                    
                            
                            // Show update indicator
                            setShowProductUpdate(true);
                            setTimeout(() => setShowProductUpdate(false), 2000);
                            
                            // Show external sync notification
                            setExternalSyncNotification('📱 iOS App triggered Product Sync');
                            setTimeout(() => setExternalSyncNotification(null), 3000);
                            
                            // Reload data when sync is detected
                            await loadProducts();
                            await fetchColumns();
                        }
                    }
                    
                    if (data.timestamps.lastWebPhotosSync !== lastWebPhotosSync) {
                        lastWebPhotosSync = data.timestamps.lastWebPhotosSync;
                        if (data.timestamps.lastWebPhotosSync) {
                            setLastWebPhotosSync(data.timestamps.lastWebPhotosSync);
                            saveTimestampToStorage('adminvirtual-last-webphotos-sync', data.timestamps.lastWebPhotosSync);
                    
                            
                            // Show update indicator
                            setShowWebPhotosUpdate(true);
                            setTimeout(() => setShowWebPhotosUpdate(false), 2000);
                            
                            // Show external sync notification
                            setExternalSyncNotification('📱 iOS App triggered WebPhotos Sync');
                            setTimeout(() => setExternalSyncNotification(null), 3000);
                            
                            // Reload data when sync is detected
                            await loadWebPhotos();
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error checking for timestamp updates:', error);
            }
        };

        // Check immediately on mount
        checkForUpdates();
        
        // Then check every 2 seconds for faster response to iOS app triggers
        const interval = setInterval(checkForUpdates, 2000);

        return () => clearInterval(interval);
    }, []);

  // Function to refresh timestamps immediately and reload data
  const refreshTimestampsAndData = async () => {
    await refreshTimestamps();
    await loadProducts();
    await loadWebPhotos();
  };

  // Helper function to save timestamp to localStorage and server with error handling
  const saveTimestampToStorage = async (key: string, timestamp: string) => {
    let localStorageSuccess = false;
    let serverSuccess = false;
    
    // Save to localStorage
    try {
      localStorage.setItem(key, timestamp);
      localStorageSuccess = true;
    } catch (error) {
      console.error(`❌ Error saving timestamp to localStorage [${key}]:`, error);
    }
    
    // Save to server as backup
    try {
      const type = key.includes('product') ? 'products' : 'webphotos';
      const response = await fetch('/api/admin/virtual-sync-timestamps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, timestamp })
      });
      
      if (response.ok) {
        serverSuccess = true;
      }
    } catch (error) {
      // Silent fail for server backup
    }
    
    return localStorageSuccess || serverSuccess; // Return true if at least one succeeded
  };

  // Helper function to get timestamp from localStorage with fallback
  const getTimestampFromStorage = (key: string): string | null => {
    try {
      const timestamp = localStorage.getItem(key);
      return timestamp;
    } catch (error) {
      console.error(`❌ Error retrieving timestamp from localStorage [${key}]:`, error);
      return null;
    }
  };

  // Authentication setup
  useEffect(() => {
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      return;
    }
    
    const unsubscribe = onAuthStateChanged(virtualAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setPermissionLoading(true);
      checkVirtualAdminPermission(user.email).then((result) => {
        setHasPermission(result);
        setPermissionLoading(false);
      });
    } else {
      setHasPermission(false);
      setPermissionLoading(false);
    }
  }, [user]);

  // Reset display count when search query changes
  useEffect(() => {
    setDisplayCount(25);
  }, [searchQuery]);

  // Save selected columns to localStorage
  const saveSelectedColumns = (columns: string[]) => {
    try {
      localStorage.setItem('virtual-admin-selected-columns', JSON.stringify(columns));
    } catch (e) {
      console.error('Error saving column selection:', e);
    }
  };

  // Load columns from backend
  const fetchColumns = async () => {
    try {
  
      // Add cache buster to ensure fresh data
      const cacheBuster = Date.now();
      const res = await fetch(`/api/database/virtual-columns?cb=${cacheBuster}`);
      const data = await res.json();
      
      
      if (data.success && Array.isArray(data.columns)) {

        setColumns(data.columns);
        
        // If no columns (database cleared), set empty selection
        if (data.columns.length === 0) {
          setSelectedColumns([]);
          return;
        }
        
        // Load saved column selection from localStorage
        const savedColumns = localStorage.getItem('virtual-admin-selected-columns');
        if (savedColumns) {
          try {
            const parsedColumns = JSON.parse(savedColumns);
            // Only use saved columns that still exist in the current schema
            const validColumns = parsedColumns.filter((col: string) => 
              data.columns.some((c: any) => c.key === col)
            );
            if (validColumns.length > 0) {
              setSelectedColumns(validColumns);
            } else {
              // Default columns for virtual admin
              setSelectedColumns(['name', 'brand', 'type', 'category', 'price']);
            }
          } catch (e) {
            console.error('Error parsing saved columns:', e);
            setSelectedColumns(['name', 'brand', 'type', 'category', 'price']);
          }
        } else {
          // Default columns for virtual admin
          setSelectedColumns(['name', 'brand', 'type', 'category', 'price']);
        }
      } else {
        console.error('Invalid virtual columns data:', data);
        setColumns([]);
        setSelectedColumns([]);
      }
    } catch (error) {
      console.error('Error fetching virtual columns:', error);
      setColumns([]);
      setSelectedColumns([]);
    }
  };

  const loadProducts = async () => {
    try {
      console.log('🔍 Frontend: Starting to load virtual products...');
      // Add cache buster to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`/api/database/virtual-products?cb=${cacheBuster}`);
      console.log('🔍 Frontend: API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 Frontend: API response data:', {
          success: data.success,
          count: data.count,
          productsLength: data.products?.length || 0
        });

        setProducts(data.products || []);
        console.log('🔍 Frontend: Products state updated with', data.products?.length || 0, 'products');
      } else {
        console.error('🔍 Frontend: API response not ok:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error loading virtual products:', error);
    }
  };

  const loadWebPhotos = async () => {
    try {
      // Add cache buster to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`/api/database/virtual-webphotos?cb=${cacheBuster}`);
      if (response.ok) {
        const data = await response.json();
        setWebPhotos(data.webPhotos || {});
      }
    } catch (error) {
      console.error('Error loading virtual webPhotos:', error);
    }
  };

  const formatValue = (value: any, columnType: string) => {
    if (value === null || value === undefined || value === '') return '';
    
    switch (columnType) {
      case 'boolean':
        return value ? '✅' : '❌';
      case 'number':
        return typeof value === 'number' ? value.toLocaleString() : value;
      case 'multipleSelect':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return value;
      case 'attachment':
        if (Array.isArray(value) && value.length > 0) {
          return `${value.length} archivo(s)`;
        }
        return value;
      default:
        return value;
    }
  };

  const renderFilePreview = (fileUrl: any, fileName: string) => {
    // Debug logging
    console.log('renderFilePreview called with:', { 
      fileUrl, 
      fileName, 
      type: typeof fileUrl,
      isArray: Array.isArray(fileUrl),
      length: Array.isArray(fileUrl) ? fileUrl.length : 'N/A'
    });
    
    // Try to parse JSON string if it's a string that looks like JSON
    let processedFileUrl = fileUrl;
    if (typeof fileUrl === 'string' && (fileUrl.startsWith('[') || fileUrl.startsWith('{'))) {
      try {
        processedFileUrl = JSON.parse(fileUrl);
        console.log('🔍 renderFilePreview: Parsed JSON string:', processedFileUrl);
      } catch (error) {
        console.log('🔍 renderFilePreview: Failed to parse JSON, using as string');
      }
    }
    
    // Handle arrays (like imageURL arrays)
    if (Array.isArray(processedFileUrl)) {
      console.log('🔍 renderFilePreview: Processing as array, length:', processedFileUrl.length);
      if (processedFileUrl.length === 0) {
        return (
          <div className="text-center text-xs text-gray-500">
            sin fotos
          </div>
        );
      }
      
      // Extract URLs from any format - need full URLs for images to load
      const validImages = processedFileUrl.map((img: any) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object' && img.url) {
          // Use full URL (needed for images to load)
          return img.url;
        }
        if (img && typeof img === 'object' && img.filename) {
          // If we only have filename, we can't load the image
          return null;
        }
        return String(img);
      }).filter(url => url && url.length > 0);
      

      
      if (validImages.length === 0) {
        return (
          <div className="text-center text-xs text-gray-500">
            sin fotos
          </div>
        );
      }
      
      // Show multiple image thumbnails
      return (
        <div className="flex flex-wrap gap-1 justify-center">
          {validImages.slice(0, 4).map((imageUrl: string, index: number) => (
            <div 
              key={index}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => {
                setSelectedImage(imageUrl);
                setShowImageModal(true);
              }}
              title={`${fileName}_${index}: ${imageUrl}`}
            >
              <div className="w-8 h-8">
                <img 
                  src={`${imageUrl}?t=${Date.now()}`} 
                  alt={`Preview ${index + 1}`}
                  className="w-full h-full object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Use a placeholder image instead of showing error
                    target.src = '/placeholder-product.svg';
                    target.onerror = null; // Prevent infinite loop
                  }}
                />
              </div>
              {validImages.length > 4 && index === 3 && (
                <div className="text-xs text-gray-500 mt-1">+{validImages.length - 4}</div>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Handle single string values
    if (!processedFileUrl || typeof processedFileUrl !== 'string') {
      return (
        <div className="bg-gray-100 rounded-lg p-2 min-w-[60px] text-center">
          <div className="text-lg text-gray-400">❌</div>
          <div className="text-xs text-gray-400 font-medium">Sin URL</div>
        </div>
      );
    }
    
    const url = processedFileUrl.toLowerCase();
    const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp') || url.includes('.svg');
    const isPdf = url.includes('.pdf');
    const isVideo = url.includes('.mp4') || url.includes('.avi') || url.includes('.mov') || url.includes('.webm');
    const isDocument = url.includes('.doc') || url.includes('.docx') || url.includes('.txt');
    
    let fileType = 'Archivo';
    let icon = '📎';
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-600';
    
    if (isImage) {
      fileType = 'Imagen';
      icon = '🖼️';
      bgColor = 'bg-green-100';
      textColor = 'text-green-600';
    } else if (isPdf) {
      fileType = 'PDF';
      icon = '📄';
      bgColor = 'bg-red-100';
      textColor = 'text-red-600';
    } else if (isVideo) {
      fileType = 'Video';
      icon = '🎥';
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-600';
    } else if (isDocument) {
      fileType = 'Documento';
      icon = '📄';
      bgColor = 'bg-green-100';
      textColor = 'text-green-600';
    }
    
    return (
      <div 
        className="cursor-pointer hover:opacity-80 transition-opacity min-w-[60px] text-center"
        onClick={() => {
          if (isImage) {
            setSelectedImage(fileUrl);
            setShowImageModal(true);
          } else {
            window.open(fileUrl, '_blank');
          }
        }}
        title={`${fileName}: ${fileUrl}`}
      >
        {isImage ? (
          <div className="w-12 h-12 mx-auto">
            <img 
              src={`${fileUrl}?t=${Date.now()}`} 
              alt="Preview"
              className="w-full h-full object-cover rounded"
              onError={(e) => {
                // Fallback to icon if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<div class="text-lg text-gray-400">❌</div>`;
                }
              }}
            />
          </div>
        ) : (
          <div className={`text-lg ${textColor}`}>{icon}</div>
        )}
      </div>
    );
  };

  // Sync from Airtable (Virtual Environment)
  const syncFromAirtable = async () => {
    try {
      setSyncing(true);
      setSyncResult(null);
      
      console.log('🔄 Starting optimized virtual sync from Airtable...');
      
      const response = await fetch('/api/database/sync-airtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' })
      });

      const result = await response.json();
      setSyncResult(result);
      
      if (result.success) {
        // Save sync timestamp
        const timestamp = new Date().toLocaleString('es-ES');
        const saved = await saveTimestampToStorage('adminvirtual-last-product-sync', timestamp);
        if (saved) {
          setLastProductSync(timestamp);
        }
        
        console.log('✅ Virtual sync completed successfully, reloading data...');
        
        // Reload products and columns
        await loadProducts();
        await fetchColumns();
        
        // Trigger cache refresh after successful sync
        try {
          await fetch('/api/cache-refresh', { method: 'POST' });
          console.log('🔄 Cache refresh triggered after product sync');
        } catch (cacheError) {
          console.warn('⚠️ Cache refresh failed:', cacheError);
        }
        
        // Dispatch sync completion event
        window.dispatchEvent(new CustomEvent('virtual-sync-complete'));
        
        console.log('🎉 Virtual sync process completed');
      } else {
        console.error('❌ Virtual sync failed:', result.message || result.errors || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Virtual sync error:', error);
      setSyncResult({ success: false, error: 'Error syncing products' });
    } finally {
      setSyncing(false);
    }
  };

  // Sync WebPhotos from Airtable (Virtual Environment)
  const syncWebPhotosFromAirtable = async () => {
    setSyncingWebPhotos(true);
    try {
      const response = await fetch('/api/database/sync-webphotos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' }),
      });
      const result = await response.json();
      setWebPhotosSyncResult(result);
      if (result.success) {
        const timestamp = new Date().toLocaleString('es-CO');
        const saved = await saveTimestampToStorage('adminvirtual-last-webphotos-sync', timestamp);
        if (saved) {
          setLastWebPhotosSync(timestamp);
        }
        await loadWebPhotos();
        
        // Trigger cache refresh after successful WebPhotos sync
        try {
          await fetch('/api/cache-refresh', { method: 'POST' });
          console.log('🔄 Cache refresh triggered after WebPhotos sync');
          
          // Force refresh all WebPhotos images on the page
          setTimeout(() => {
            const images = document.querySelectorAll('img[src*="webphotos"]');
            images.forEach((img) => {
              const src = img.getAttribute('src');
              if (src) {
                const newSrc = src.includes('?') ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`;
                (img as HTMLImageElement).src = newSrc;
              }
            });
            console.log(`🔄 Forced refresh of ${images.length} WebPhotos images`);
          }, 1000);
        } catch (cacheError) {
          console.warn('⚠️ Cache refresh failed:', cacheError);
        }
      }
    } catch (error) {
      setWebPhotosSyncResult({ success: false, message: 'Error al sincronizar WebPhotos virtuales' });
    } finally {
      setSyncingWebPhotos(false);
    }
  };



  const handleLogin = async () => {
    if (virtualAuth && virtualGoogleProvider) {
      await signInWithPopup(virtualAuth, virtualGoogleProvider);
    }
  };

  const handleLogout = async () => {
    if (virtualAuth) {
      await signOut(virtualAuth);
    }
  };

  // Initialize data
  useEffect(() => {
    if (pathname !== '/adminvirtual/database') return;
    
    const initializeData = async () => {
      try {
        await Promise.all([
          loadProducts(),
          fetchColumns(),
          loadWebPhotos()
        ]);
      } catch (error) {
        console.error('Error initializing virtual data:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [pathname]);

  // Filter and sort products
  console.log('🔍 Frontend: Processing products for display:', {
    totalProducts: products.length,
    searchQuery: searchQuery || 'none'
  });
  
  const filteredAndSortedProducts = products
    .filter(product => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (product as any).name?.toLowerCase().includes(query) ||
        (product as any).brand?.toLowerCase().includes(query) ||
        (product as any).type?.toLowerCase().includes(query) ||
        (product as any).SKN?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const brandA = ((a as any).brand || '').toLowerCase();
      const brandB = ((b as any).brand || '').toLowerCase();
      if (brandA !== brandB) return brandA.localeCompare(brandB);
      
      const nameA = ((a as any).name || '').toLowerCase();
      const nameB = ((b as any).name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
  console.log('🔍 Frontend: Filtered and sorted products:', filteredAndSortedProducts.length);

  const displayedProducts = filteredAndSortedProducts.slice(0, displayCount);
  const displayColumns = Array.isArray(columns) ? columns.filter(col => selectedColumns.includes(col.key)) : [];
  const allDisplayColumns = [
    ...(selectedColumns.includes('id') ? [{ key: 'id', label: 'ID', type: 'text' }] : []),
    ...displayColumns
  ];

  if (loading || permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Inicio de Sesión de Admin Virtual</h1>
        <button
          onClick={handleLogin}
          className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 font-semibold"
        >
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Acceso denegado</h1>
        <p className="mb-4 text-black">Tu cuenta no está autorizada para ver esta página.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-1 sm:p-4">
      <div className="mx-auto space-y-2 sm:space-y-6">
        {/* User Info and Navigation */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Admin Tienda Virtual</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
                title="Cerrar sesión"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Header */}
        <div className="bg-white p-2 sm:p-6 rounded-lg shadow border">
          <h1 className="text-lg sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Base de Datos Virtual</h1>
          <p className="text-gray-600 text-xs sm:text-base">Gestiona los productos de la tienda virtual</p>
          
          {/* External Sync Notification */}
          {externalSyncNotification && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-pulse">
              <div className="flex items-center gap-2">
                <span className="text-green-600">🔄</span>
                <span className="text-sm font-medium text-green-800">{externalSyncNotification}</span>
              </div>
            </div>
          )}
        </div>

        {/* Airtable Sync Section */}
        <div className="bg-white p-2 sm:p-6 rounded-lg shadow border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
            <div className="mb-2 sm:mb-0">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">🔄 Sincronización con Airtable Virtual</h3>
              <p className="text-xs sm:text-sm text-gray-600">Sincroniza datos desde tu base de Airtable virtual</p>
            </div>
            
            {/* Clear Database Button - Aligned to the right */}
            <div className="mb-2 sm:mb-0">
              <button
                onClick={clearDatabase}
                disabled={clearing}
                className={`px-3 sm:px-4 py-2 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-sm ${
                  clearing
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {clearing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white inline mr-1"></div>
                    <span className="hidden sm:inline">Limpiando...</span>
                    <span className="sm:hidden">Limpiando</span>
                  </>
                ) : (
                  <>
                    <span>🗑️</span>
                    <span className="hidden sm:inline">Limpiar Base de Datos</span>
                    <span className="sm:hidden">Limpiar DB</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Sync Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <button
              onClick={syncFromAirtable}
              disabled={syncing}
              className={`flex-1 sm:flex-none px-2 sm:px-6 py-2 sm:py-3 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-base ${
                syncing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {syncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Sincronizando...</span>
                  <span className="sm:hidden">Sincronizando</span>
                </>
              ) : (
                <>
                  <span>📥</span>
                  <span className="hidden sm:inline">Sincronizar Productos Virtuales</span>
                  <span className="sm:hidden">Sincronizar Productos</span>
                </>
              )}
            </button>

            <button
              onClick={syncWebPhotosFromAirtable}
              disabled={syncingWebPhotos}
              className={`flex-1 sm:flex-none px-2 sm:px-6 py-2 sm:py-3 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-base ${
                syncingWebPhotos
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {syncingWebPhotos ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span className="hidden sm:inline">Sincronizando...</span>
                  <span className="sm:hidden">Sincronizando</span>
                </>
              ) : (
                <>
                  <span>📸</span>
                  <span className="hidden sm:inline">Sincronizar WebPhotos Virtuales</span>
                  <span className="sm:hidden">Sincronizar WebPhotos</span>
                </>
              )}
            </button>

            {/* Manual Image Cleanup Button */}
            <button
              onClick={handleImageCleanup}
              className="flex-1 sm:flex-none px-2 sm:px-6 py-2 sm:py-3 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-base bg-red-600 hover:bg-red-700 text-white transition-colors duration-200"
            >
              <span>🗑️</span>
              <span className="hidden sm:inline">
                Limpiar Imágenes No Utilizadas
              </span>
              <span className="sm:hidden">
                Limpiar Imágenes
              </span>
            </button>

          </div>

          {/* Sync Results */}
          <div className="space-y-3 sm:space-y-4 mt-4">
            {/* Products Sync Result */}
            {syncResult && (
              <div className={`p-3 sm:p-4 rounded-lg ${
                syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={syncResult.success ? 'text-green-600' : 'text-red-600'}>
                    {syncResult.success ? '✅' : '❌'}
                  </span>
                  <span className={`text-sm font-medium ${
                    syncResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {syncResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* WebPhotos Sync Result */}
            {webPhotosSyncResult && (
              <div className={`p-3 sm:p-4 rounded-lg ${
                webPhotosSyncResult.success ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={webPhotosSyncResult.success ? 'text-blue-600' : 'text-red-600'}>
                    {webPhotosSyncResult.success ? '✅' : '❌'}
                  </span>
                  <span className={`text-sm font-medium ${
                    webPhotosSyncResult.success ? 'text-blue-800' : 'text-red-800'
                  }`}>
                    {webPhotosSyncResult.message}
                  </span>
                </div>
              </div>
            )}



            {/* Cache Refresh Result */}
            {cacheRefreshResult && (
              <div className={`p-3 sm:p-4 rounded-lg ${
                cacheRefreshResult.success ? 'bg-orange-50 border border-orange-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={cacheRefreshResult.success ? 'text-orange-600' : 'text-red-600'}>
                    {cacheRefreshResult.success ? '🔄' : '❌'}
                  </span>
                  <span className={`text-sm font-medium ${
                    cacheRefreshResult.success ? 'text-orange-800' : 'text-red-800'
                  }`}>
                    {cacheRefreshResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Clear Database Result */}
            {clearResult && (
              <div className={`p-3 sm:p-4 rounded-lg ${
                clearResult.success ? 'bg-blue-50 border border-blue-200' : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={clearResult.success ? 'text-blue-600' : 'text-red-600'}>
                    {clearResult.success ? '✅' : '❌'}
                  </span>
                  <span className={`text-sm font-medium ${
                    clearResult.success ? 'text-blue-800' : 'text-red-800'
                  }`}>
                    {clearResult.message}
                  </span>
                </div>
              </div>
            )}

            {/* Last Sync Times */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {/* Products Last Sync */}
              <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 transition-all duration-300 ${
                showProductUpdate ? 'bg-green-50 border-green-300 shadow-md' : ''
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">📥</span>
                    <span className="text-sm font-medium text-gray-900">Productos</span>
                    {showProductUpdate && (
                      <span className="text-xs text-green-600 animate-pulse">🔄 Actualizado</span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/virtual-sync-timestamps');
                        if (response.ok) {
                          const data = await response.json();
                          if (data.timestamps.lastProductSync) {
                            setLastProductSync(data.timestamps.lastProductSync);
                            saveTimestampToStorage('adminvirtual-last-product-sync', data.timestamps.lastProductSync);
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error refreshing product sync timestamp:', error);
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    title="Refrescar desde servidor"
                  >
                    🔄
                  </button>
                </div>
                <div className="text-xs text-gray-600">
                  {lastProductSync ? (
                    <span>Última sincronización: {lastProductSync}</span>
                  ) : (
                    <span className="text-gray-400">Nunca sincronizado</span>
                  )}
                </div>
              </div>

              {/* WebPhotos Last Sync */}
              <div className={`bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 transition-all duration-300 ${
                showWebPhotosUpdate ? 'bg-green-50 border-green-300 shadow-md' : ''
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600">📸</span>
                    <span className="text-sm font-medium text-gray-900">WebPhotos</span>
                    {showWebPhotosUpdate && (
                      <span className="text-xs text-green-600 animate-pulse">🔄 Actualizado</span>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/admin/virtual-sync-timestamps');
                        if (response.ok) {
                          const data = await response.json();
                          if (data.timestamps.lastWebPhotosSync) {
                            setLastWebPhotosSync(data.timestamps.lastWebPhotosSync);
                            saveTimestampToStorage('adminvirtual-last-webphotos-sync', data.timestamps.lastWebPhotosSync);
                          }
                        }
                      } catch (error) {
                        console.error('❌ Error refreshing WebPhotos sync timestamp:', error);
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                    title="Refrescar desde servidor"
                  >
                    🔄
                  </button>
                </div>
                <div className="text-xs text-gray-600">
                  {lastWebPhotosSync ? (
                    <span>Última sincronización: {lastWebPhotosSync}</span>
                  ) : (
                    <span className="text-gray-400">Nunca sincronizado</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-1 sm:gap-4">
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow border text-center">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">{products.length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Productos</div>
          </div>
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow border text-center">
            <div className="text-lg sm:text-2xl font-bold text-green-600">{columns.length}</div>
            <div className="text-xs sm:text-sm text-gray-600">Columnas</div>
          </div>
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow border text-center">
            <div className="text-lg sm:text-2xl font-bold text-purple-600">
              {new Set(products.map(p => (p as any).brand)).size}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Marcas</div>
          </div>
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow border text-center">
            <div className="text-lg sm:text-2xl font-bold text-orange-600">
              {new Set(products.map(p => {
                const type = (p as any).type;
                if (Array.isArray(type)) {
                  return type.length > 0 ? type[0] : '';
                }
                return type || '';
              }).filter(t => t && t !== '')).size}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Tipos</div>
          </div>
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow border text-center">
            <div className="text-lg sm:text-2xl font-bold text-pink-600">
              {Object.keys(webPhotos).length}
            </div>
            <div className="text-xs text-gray-600 leading-tight">WebPhotos</div>
          </div>
        </div>

        {/* Column Management - Standalone */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="p-3 sm:p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h4 className="text-sm font-semibold text-gray-700">📋 Seleccionar Columnas de Productos</h4>
              <button
                onClick={() => setShowColumnSelector(!showColumnSelector)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm self-start sm:self-auto w-full sm:w-auto"
              >
                {showColumnSelector ? 'Ocultar Selector' : 'Mostrar Columnas'}
              </button>
            </div>

            {showColumnSelector && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mb-3">
                {/* ID Column */}
                <label className="flex items-center space-x-2 p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes('id')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newColumns = [...selectedColumns, 'id'];
                        setSelectedColumns(newColumns);
                        saveSelectedColumns(newColumns);
                      } else {
                        const newColumns = selectedColumns.filter(col => col !== 'id');
                        setSelectedColumns(newColumns);
                        saveSelectedColumns(newColumns);
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-xs font-medium text-black">ID</span>
                </label>

                {/* Other columns */}
                {columns.map((column) => (
                  <label key={column.key} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newColumns = [...selectedColumns, column.key];
                          setSelectedColumns(newColumns);
                          saveSelectedColumns(newColumns);
                        } else {
                          const newColumns = selectedColumns.filter(col => col !== column.key);
                          setSelectedColumns(newColumns);
                          saveSelectedColumns(newColumns);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-xs font-medium text-black">{column.label}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-600">
              Mostrando {selectedColumns.length} de {columns.length} columnas
            </div>
          </div>
        </div>

        {/* Products Table Section */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="p-3 sm:p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">📊 Tabla de Productos</h3>
                <div className="text-xs text-gray-600 mt-1">
                  {products.length} productos almacenados localmente
                  <span className="text-green-600 ml-1">✅ Cargados</span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  Mostrando {displayedProducts.length} de {products.length} productos con {allDisplayColumns.length} columnas
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowProductsTable(!showProductsTable)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm self-start sm:self-auto w-full sm:w-auto"
                >
                  {showProductsTable ? 'Ocultar Tabla' : 'Mostrar Tabla'}
                </button>
              </div>
            </div>

            {showProductsTable && (
              <>
                {/* Search and Controls */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Buscar productos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Mostrar:</span>
                    <select
                      value={displayCount}
                      onChange={(e) => setDisplayCount(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                    </select>
                  </div>
                </div>

                {/* Products Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        {allDisplayColumns.map((column) => (
                          <th
                            key={column.key}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300"
                          >
                            <div className="flex flex-col">
                              <span className="truncate">{column.label}</span>
                              <span className="text-xs text-gray-400 font-normal">({getAirtableFieldType(column.type)})</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {displayedProducts.map((product, index) => (
                        <tr key={product.id || index} className="hover:bg-gray-50">
                          {allDisplayColumns.map((column) => (
                            <td key={column.key} className="px-6 py-4 whitespace-nowrap text-xs text-gray-900 border border-gray-300">
                              {column.type === 'attachment' ? (
                                renderFilePreview((product as any)[column.key], `${column.key}_${index}`)
                              ) : (
                                formatValue((product as any)[column.key], column.type)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Load More Button and Results Summary */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-gray-600">
                    Mostrando {displayedProducts.length} de {products.length} productos con {allDisplayColumns.length} columnas
                  </div>
                  {displayedProducts.length < filteredAndSortedProducts.length && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setDisplayCount(displayCount + 25)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Cargar más ({displayedProducts.length} de {filteredAndSortedProducts.length})
                      </button>
                      <button
                        onClick={() => setDisplayCount(filteredAndSortedProducts.length)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Mostrar todos
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* WebPhotos Table Section */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="p-3 sm:p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-700">📸 Tabla de WebPhotos</h4>
                <div className="text-xs text-gray-600 mt-1">
                  {Object.keys(webPhotos).length} WebPhotos almacenados localmente
                  <span className="text-green-600 ml-1">✅ Cargados</span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setShowWebPhotosTable(!showWebPhotosTable)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs sm:text-sm self-start sm:self-auto w-full sm:w-auto"
                >
                  {showWebPhotosTable ? 'Ocultar Tabla' : 'Mostrar Tabla'}
                </button>
              </div>
            </div>

            {showWebPhotosTable && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nombre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vista Previa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(webPhotos).map(([name, url], index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <img 
                            src={url} 
                            alt={name}
                            className="w-12 h-12 object-cover rounded cursor-pointer"
                            onClick={() => {
                              setSelectedImage(url);
                              setShowImageModal(true);
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <span className="text-xs text-gray-500 break-all">{url}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="text-xs text-gray-600 mt-2">
              Mostrando {Object.keys(webPhotos).length} de {Object.keys(webPhotos).length} WebPhotos con vista previa
            </div>
          </div>
        </div>
      </div>

      {/* Custom Clear Database Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 border-b border-red-200 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Limpiar Base de Datos Virtual</h3>
                  <p className="text-sm text-gray-600">Acción crítica</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que quieres eliminar todos los datos de la base de datos virtual?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-red-800 mb-2">Esto eliminará:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Todos los productos virtuales
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Todas las imágenes virtuales
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    No se puede recuperar
                  </li>
                </ul>
              </div>

              <p className="text-sm text-gray-600">
                Esta acción no se puede deshacer. ¿Deseas continuar?
              </p>
            </div>

            {/* Actions */}
            <div className="bg-gray-50 px-6 py-4 flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmClearDatabase}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Sí, Eliminar Todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg max-w-2xl max-h-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Vista Previa</h3>
              <button
                onClick={() => setShowImageModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <img 
              src={`${selectedImage}?t=${Date.now()}`} 
              alt="Preview"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}


    </div>
  );
} 