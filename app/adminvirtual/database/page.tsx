'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '../../../types';
import { virtualAuth, virtualGoogleProvider } from '../../../lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { checkVirtualAdminPermission } from '../../../lib/adminPermissions';
import { usePathname } from 'next/navigation';
import Spreadsheet from '../../../components/Spreadsheet';
import { Spreadsheet as SpreadsheetType, SpreadsheetColumn, SpreadsheetRow, SpreadsheetCell } from '../../../types/spreadsheet';



interface Column {
  key: string;
  label: string;
  type: 'text' | 'longText' | 'number' | 'boolean' | 'select' | 'multipleSelect' | 'attachment' | 'email' | 'date' | 'phone' | 'createdTime' | 'lastModifiedTime';
  editable: boolean;
}

  // Function to convert internal field types to Airtable field types
  const getAirtableFieldType = (type: string): string => {
    switch (type) {
      case 'text':
        return 'Single line text';
      case 'longText':
        return 'Long text';
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
      case 'email':
        return 'Email';
      case 'date':
        return 'Date';
      case 'phone':
        return 'Phone number';
      case 'createdTime':
        return 'Created time';
      case 'lastModifiedTime':
        return 'Last modified time';
      default:
        return type;
    }
  };

// Error boundary wrapper component
function VirtualDatabasePageContent() {
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

  const [syncingWebPhotos, setSyncingWebPhotos] = useState(false);
  const [webPhotosSyncResult, setWebPhotosSyncResult] = useState<any>(null);
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  const [showWebPhotosTable, setShowWebPhotosTable] = useState(false);
  const [showAirtableSync, setShowAirtableSync] = useState(false);
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
  const [spreadsheetData, setSpreadsheetData] = useState<SpreadsheetType | null>(null);
  const pathname = usePathname();

  // Simple debounced save function
  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSaveChanges = (updatedData: SpreadsheetType) => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(async () => {
      try {
        console.log('💾 Saving spreadsheet changes to database...', updatedData);
        
        // Check if API is accessible
        try {
          const healthCheck = await fetch('/api/database/virtual-products', { 
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          
          if (!healthCheck.ok) {
            console.error('❌ API health check failed:', healthCheck.status);
            return;
          }
        } catch (error) {
          console.error('❌ API health check error:', error);
          return;
        }
        
        // Extract individual product updates from spreadsheet data
        const productUpdates = updatedData.rows.map(row => {
          const updates: any = {};
          Object.keys(row.cells).forEach(key => {
            if (key !== 'id') {
              updates[key] = row.cells[key]?.value;
            }
          });
          return { id: row.id, updates };
        });
        
        console.log('📝 Product updates to save:', productUpdates);
        
        // Save each product update individually using POST method (since PUT doesn't exist)
        const savePromises = productUpdates.map(async (update) => {
          try {
            // Use POST method but send the update data
            const response = await fetch('/api/database/virtual-products', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...update.updates,
                id: update.id, // Include the ID so the API knows which product to update
                _action: 'update' // Add a flag to indicate this is an update, not a create
              })
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success) {
                // Success: product updated (log removed)
              } else {
                console.error(`❌ Product ${update.id} update failed:`, result.message);
              }
            } else {
              console.error(`❌ Product ${update.id} update request failed:`, response.status);
            }
          } catch (error) {
            console.error(`❌ Error updating product ${update.id}:`, error);
          }
        });
        
        // Wait for all updates to complete
        await Promise.all(savePromises);
        // All product updates completed (log removed)
        
      } catch (error) {
        console.error('❌ Save error:', error);
      }
    }, 1000);
  };

  // Create spreadsheet when both products and columns are loaded
  useEffect(() => {
    if (products.length > 0 && columns.length > 0 && !spreadsheetData) {
      console.log('🔄 Creating spreadsheet with:', { productsCount: products.length, columnsCount: columns.length });
      const newSpreadsheetData = convertToSpreadsheet(products, columns, spreadsheetData || undefined);
      console.log('📊 Spreadsheet created:', newSpreadsheetData);
      setSpreadsheetData(newSpreadsheetData);
    }
  }, [products, columns, spreadsheetData]); // Only create if spreadsheetData doesn't exist

  // Test API connection on page load (silent)
  useEffect(() => {
    const testAPIConnection = async () => {
      try {
        const response = await fetch('/api/database/virtual-products', { 
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          console.error('❌ API connection test failed on page load:', response.status, response.statusText);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('❌ API connection test error on page load:', errorMessage);
      }
    };

    // Test after a short delay to ensure server is ready
    const timer = setTimeout(testAPIConnection, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Preserve spreadsheet order when data changes (but not on initial creation)
  useEffect(() => {
    if (spreadsheetData && products.length > 0 && columns.length > 0) {
      // Only update if we have existing data and the order has changed
      const currentOrder = spreadsheetData.columns.map(col => col.key).join(',');
      const newOrder = columns.map(col => col.key).join(',');
      
      if (currentOrder !== newOrder) {
        const updatedSpreadsheetData = convertToSpreadsheet(products, columns, spreadsheetData);
        setSpreadsheetData(updatedSpreadsheetData);
      }
    }
  }, [columns]); // Only depend on columns changing

  // Handle spreadsheet data changes
  const handleSpreadsheetChange = (updatedData: SpreadsheetType) => {
    console.log('🔄 Spreadsheet data changed:', updatedData);
    
    // Filter out any ID column that might have been added
    const filteredData = {
      ...updatedData,
      columns: updatedData.columns.filter(col => col.key !== 'id')
    };
    
    setSpreadsheetData(filteredData);

    // If columns changed (added/removed/renamed or metadata like label/type/width), update parent columns immediately
    try {
      const currentByKey: Record<string, any> = {};
      columns.forEach(c => { currentByKey[c.key] = c; });
      let metaChanged = false;
      for (let i = 0; i < updatedData.columns.length; i++) {
        const u = updatedData.columns[i];
        const cur = currentByKey[u.key];
        if (!cur) { metaChanged = true; break; }
        // Don't convert types back - keep the types as they are in the spreadsheet
        if (cur.label !== u.label || cur.type !== u.type || (cur.width ?? undefined) !== (u.width ?? undefined) || (cur.order ?? i) !== i) {
          metaChanged = true; break;
        }
      }
      if (metaChanged || columns.length !== updatedData.columns.length) {
        const updatedColumns = updatedData.columns.map((col, index) => ({
          key: col.key,
          label: col.label,
          type: col.type, // Keep the type as is (image stays image, etc.)
          editable: true,
          ...(col.width != null ? { width: col.width } : {}),
          order: index
        })) as any[];
        setColumns(updatedColumns as any);
        // Ensure column visibility includes any new keys
        const incomingSet = new Set(updatedData.columns.map(c => c.key));
        const nextSelected = Array.from(new Set([...selectedColumns.filter(k => incomingSet.has(k)), ...updatedData.columns.map(c => c.key)]));
        setSelectedColumns(nextSelected);
        saveSelectedColumns(nextSelected);
      }
    } catch (e) {
      console.warn('⚠️ Failed to reconcile columns after spreadsheet change:', e);
    }

    // Don't update products state here - let the save process handle it
    // The spreadsheet data is the source of truth for the UI

    // Use debounced save to prevent excessive API calls
    debouncedSaveChanges(updatedData);
  };

  // Handle column deletion from spreadsheet
  const handleColumnDelete = (columnKey: string) => {
    console.log('🗑️ Deleting column:', columnKey);
    
    // Update columns state to remove the deleted column
    const updatedColumns = columns.filter(col => col.key !== columnKey);
    setColumns(updatedColumns);
    
    // Update spreadsheet data to remove the deleted column
    if (spreadsheetData) {
      const updatedSpreadsheetData = { ...spreadsheetData };
      
      // Remove the column from spreadsheet columns
      updatedSpreadsheetData.columns = updatedSpreadsheetData.columns.filter(col => col.key !== columnKey);
      
      // Remove cells for this column from all rows
      updatedSpreadsheetData.rows.forEach(row => {
        delete row.cells[columnKey];
      });
      
      // Reorder remaining columns
      updatedSpreadsheetData.columns.forEach((col, index) => {
        col.order = index;
      });
      
      updatedSpreadsheetData.metadata.updatedAt = new Date();
      updatedSpreadsheetData.metadata.version++;
      
      setSpreadsheetData(updatedSpreadsheetData);
      
      // Save the updated data immediately
      console.log('🔄 Saving column deletion to database...');
      debouncedSaveChanges(updatedSpreadsheetData);
    }
  };
  


  // Convert existing products to spreadsheet format
  const convertToSpreadsheet = (products: Product[], columns: Column[], existingSpreadsheet?: SpreadsheetType): SpreadsheetType => {
    // Filter out any ID columns to prevent them from being displayed
    const filteredColumns = columns.filter(col => col.key !== 'id');
    
    // If we have existing spreadsheet data, preserve the order
    if (existingSpreadsheet) {
      console.log('🔄 Preserving existing spreadsheet order');
      
      // Sort columns by their existing order
      const orderedColumns = [...filteredColumns].sort((a, b) => {
        const aOrder = existingSpreadsheet.columns.find(col => col.key === a.key)?.order ?? 0;
        const bOrder = existingSpreadsheet.columns.find(col => col.key === b.key)?.order ?? 0;
        return aOrder - bOrder;
      });
      
      // Sort rows by their existing order
      const orderedProducts = [...products].sort((a, b) => {
        const aOrder = existingSpreadsheet.rows.find(row => row.id === a.id)?.order ?? 0;
        const bOrder = existingSpreadsheet.rows.find(row => row.id === b.id)?.order ?? 0;
        return aOrder - bOrder;
      });
      
      columns = orderedColumns;
      products = orderedProducts;
    } else {
      // Use filtered columns if no existing spreadsheet
      columns = filteredColumns;
    }
    
    const spreadsheetColumns: SpreadsheetColumn[] = columns.map((col, index) => {
      // Calculate appropriate width based on column type and content
      // If backend provided a width, prefer it; otherwise compute
      let width = (col as any).width ?? 150; // Default width
      
      // Respect backend/edited types as-is
      let finalType = col.type;
      
      // Special handling for imageURL columns - treat them as image type
      if (col.key === 'imageURL' && col.type !== 'attachment') {
        finalType = 'attachment';
      }
      
      if ((col as any).width == null) {
        if (col.type === 'attachment' || col.key === 'imageURL') {
          width = 200; // Images need more space
        } else if (finalType === 'text') {
          // Estimate width based on label length
          width = Math.max(120, Math.min(300, col.label.length * 10 + 50));
        } else if (col.type === 'number') {
          width = 120; // Numbers are usually shorter
        } else if (col.type === 'boolean') {
          width = 100; // Checkboxes are compact
        } else if (col.type === 'select') {
          width = 160; // Select dropdowns need medium space
        } else if (col.type === 'multipleSelect') {
          width = 180; // Multiple select needs more space
        }
      }
      
      const column = {
        id: `col_${index}`,
        key: col.key,
        label: col.label,
        type: finalType === 'attachment' ? 'image' : finalType as any, // Preserve exact Airtable types
        width: width,
        sortable: true,
        editable: true, // Force all columns to be editable
        required: false,
        // If backend provided an order, prefer it; otherwise use the current index
        order: (col as any).order ?? index
      };
      
      return column;
    });

    // console.log('📋 Spreadsheet columns:', spreadsheetColumns); // Reduced logging

    const spreadsheetRows: SpreadsheetRow[] = products.map((product, index) => {
      const cells: Record<string, SpreadsheetCell> = {};
      
      columns.forEach(col => {
        let value: any = (product as any)[col.key];
        
        // Respect type as provided
        let finalType = col.type;
        
        // Special handling for imageURL columns - treat them as image type
        if (col.key === 'imageURL' && col.type !== 'attachment') {
          finalType = 'attachment';
        }
        
        // Handle image URLs
        if ((col.type === 'attachment' || col.key === 'imageURL') && value) {
          value = Array.isArray(value) ? value : [value];
        }
        
        // Special handling for price fields - pass raw values for EditableCell to format
        if (col.key === 'price' && value) {
          // Don't format here - let EditableCell handle the formatting
          // Just ensure it's a number
          const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
          if (!isNaN(numValue)) {
            value = numValue; // Keep as raw number
          }
        }
        
        const cell = {
          id: `cell_${index}_${col.key}`,
          value: value || '',
          type: (finalType === 'attachment' || col.key === 'imageURL') ? 'image' : finalType as any,
          editable: true // Force all cells to be editable
        };
        
        cells[col.key] = cell;
      });

      return {
        id: product.id || `row_${index}`,
        cells,
        order: index,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    return {
      id: 'virtual-products',
      name: 'Virtual Products Database',
      description: 'Product catalog managed in virtual environment',
      columns: spreadsheetColumns,
      rows: spreadsheetRows,
      settings: {
        allowRowReordering: true,
        allowColumnReordering: true,
        allowBulkOperations: true,
        autoSave: true,
        maxRows: 10000,
        maxColumns: 100
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        version: 1
      }
    };
  };

  // Handle manual image cleanup
  const handleImageCleanup = async () => {
    try {
      setCacheRefreshResult({
        success: true,
        message: '🧹 Limpiando imágenes no utilizadas...'
      });
      
      // VIRTUAL-ONLY: Only clean up virtual database images
      const response = await fetch('/api/cleanup-images', { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' }), // Only virtual context
      });
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
    console.log('🗑️ Clear database button clicked');
    setShowClearConfirm(true);
    console.log('🗑️ showClearConfirm set to true');
  };

  const confirmClearDatabase = async () => {
    console.log('🗑️ Confirm clear database button clicked');
    setShowClearConfirm(false);
    setClearing(true);
    try {
      console.log('🗑️ Making API call to /api/database/clear');
      const response = await fetch('/api/database/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' }),
      });
      console.log('🗑️ API response status:', response.status);
      const result = await response.json();
      console.log('🗑️ API response result:', result);
      setClearResult(result);
      if (result.success) {
        console.log('🗑️ Clear successful, updating UI');
        // Clear sync timestamps when database is cleared
        setLastProductSync(null);
        setLastWebPhotosSync(null);
        localStorage.removeItem('adminvirtual-last-product-sync');
        localStorage.removeItem('adminvirtual-last-webphotos-sync');
        
        // Add a small delay to ensure file system operations are complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Load columns first, then products (since products depend on columns)
        const freshColumns = await fetchColumns();
        if (freshColumns && freshColumns.length > 0) {
          await loadProducts(freshColumns);
        } else {
          await loadProducts();
        }
        await loadWebPhotos();
      } else {
        console.log('🗑️ Clear failed:', result.message);
      }
    } catch (error) {
      console.log('🗑️ Clear error:', error);
      setClearResult({ success: false, message: 'Error al limpiar base de datos' });
    } finally {
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
                            
                            // Reload data when sync is detected with error handling - columns first, then products
                            try {
                                const freshColumns = await fetchColumns();
                                if (freshColumns && freshColumns.length > 0) {
                                    await loadProducts(freshColumns);
                                } else {
                                    await loadProducts();
                                }
                            } catch (error) {
                                console.error('❌ Error reloading data after product sync:', error);
                                // Don't crash the component, just log the error
                            }
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
                            
                            // Reload data when sync is detected with error handling
                            try {
                                await loadWebPhotos();
                            } catch (error) {
                                console.error('❌ Error reloading data after WebPhotos sync:', error);
                                // Don't crash the component, just log the error
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Error checking for timestamp updates:', error);
                // Don't crash the component, just log the error and continue
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
    const freshColumns = await fetchColumns();
    if (freshColumns && freshColumns.length > 0) {
      await loadProducts(freshColumns);
    } else {
      await loadProducts();
    }
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

        // Filter out any ID columns from the backend data
        const filteredColumns = data.columns.filter((col: any) => col.key !== 'id');
        
        setColumns(filteredColumns);
        
        // Convert existing products to spreadsheet format - always update if we have columns
        if (filteredColumns.length > 0) {
          const spreadsheetData = convertToSpreadsheet(products, filteredColumns);
          setSpreadsheetData(spreadsheetData);
        }
        
        // If no columns (database cleared), set empty selection
        if (filteredColumns.length === 0) {
          setSelectedColumns([]);
          return filteredColumns;
        }
        
        // Load saved column selection from localStorage
        const savedColumns = localStorage.getItem('virtual-admin-selected-columns');
        
        if (savedColumns) {
          try {
            const parsedColumns = JSON.parse(savedColumns);
            // Only use saved columns that still exist in the current schema AND remove any 'id' column
            const validColumns = parsedColumns.filter((col: string) => 
              data.columns.some((c: any) => c.key === col) && col !== 'id'
            );
            if (validColumns.length > 0) {
              setSelectedColumns(validColumns);
              saveSelectedColumns(validColumns); // Update localStorage without ID
            } else {
              // Default columns for virtual admin - include all important fields
              const defaultColumns = ['name', 'SKU', 'brand', 'type', 'category', 'subCategory', 'materials', 'dimensions', 'capacity', 'detail', 'colors', 'price', 'distriPrice', 'stock', 'imageURL'];
              setSelectedColumns(defaultColumns);
              saveSelectedColumns(defaultColumns);
            }
          } catch (e) {
            console.error('Error parsing saved columns:', e);
            // Default columns for virtual admin - include all important fields
            const defaultColumns = ['name', 'SKU', 'brand', 'type', 'category', 'subCategory', 'materials', 'dimensions', 'capacity', 'detail', 'colors', 'price', 'distriPrice', 'stock', 'imageURL'];
            setSelectedColumns(defaultColumns);
            saveSelectedColumns(defaultColumns);
          }
        } else {
          // Default columns for virtual admin - include all important fields
          const defaultColumns = ['name', 'SKU', 'brand', 'type', 'category', 'subCategory', 'materials', 'dimensions', 'capacity', 'detail', 'colors', 'price', 'distriPrice', 'stock', 'imageURL'];
          setSelectedColumns(defaultColumns);
          saveSelectedColumns(defaultColumns);
        }
        
        return filteredColumns;
      } else {
        console.error('Invalid virtual columns data:', data);
        setColumns([]);
        setSelectedColumns([]);
        return [];
      }
    } catch (error) {
      console.error('Error fetching virtual columns:', error);
      setColumns([]);
      setSelectedColumns([]);
      return [];
    }
  };

  const loadProducts = async (columnsToUse?: any[]) => {
    try {
      // Add cache buster to ensure fresh data
      const cacheBuster = Date.now();
      const response = await fetch(`/api/database/virtual-products?cb=${cacheBuster}`);
      
      if (response.ok) {
        const data = await response.json();
        const productsData = data.products || [];
        setProducts(productsData);
        
        // Use provided columns or fall back to state columns
        const columnsForSpreadsheet = columnsToUse || columns;
        
        // Convert to spreadsheet format - always update, even with empty data
        if (columnsForSpreadsheet.length > 0) {
          const newSpreadsheetData = convertToSpreadsheet(productsData, columnsForSpreadsheet, spreadsheetData || undefined);
          setSpreadsheetData(newSpreadsheetData);
        }
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

  // Force refresh column selection to show all columns
  const forceRefreshColumns = () => {
    // Clear saved column selection from localStorage
    localStorage.removeItem('virtual-admin-selected-columns');
    
    // Set all available columns as selected (excluding ID column)
    const allColumns = columns.map(col => col.key);
    setSelectedColumns(allColumns);
    saveSelectedColumns(allColumns);
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
    if (typeof fileUrl === 'string' && fileUrl.trim() && (fileUrl.startsWith('[') || fileUrl.startsWith('{'))) {
      try {
        processedFileUrl = JSON.parse(fileUrl);
        console.log('🔍 renderFilePreview: Parsed JSON string:', processedFileUrl);
      } catch (error) {
        console.log('🔍 renderFilePreview: Failed to parse JSON, using as string. Error:', error);
        console.log('🔍 renderFilePreview: Problematic value:', fileUrl);
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

  const renderUrlsList = (fileUrl: any, fileName: string) => {
    // Try to parse JSON string if it's a string that looks like JSON
    let processedFileUrl = fileUrl;
    if (typeof fileUrl === 'string' && fileUrl.trim() && (fileUrl.startsWith('[') || fileUrl.startsWith('{'))) {
      try {
        processedFileUrl = JSON.parse(fileUrl);
      } catch (error) {
        // Use as string if parsing fails
      }
    }
    
    // Handle arrays (like imageURL arrays)
    if (Array.isArray(processedFileUrl)) {
      if (processedFileUrl.length === 0) {
        return (
          <div className="text-center text-xs text-gray-500">
            sin URLs
          </div>
        );
      }
      
      // Extract URLs from any format
      const validUrls = processedFileUrl.map((img: any) => {
        if (typeof img === 'string') return img;
        if (img && typeof img === 'object' && img.url) {
          return img.url;
        }
        return String(img);
      }).filter(url => url && url.length > 0);
      
      if (validUrls.length === 0) {
        return (
          <div className="text-center text-xs text-gray-500">
            sin URLs
          </div>
        );
      }
      
      // Show URLs in a compact format
      return (
        <div className="max-w-xs">
          {validUrls.slice(0, 3).map((url: string, index: number) => (
            <div key={index} className="text-xs text-gray-600 break-all mb-1">
              {url.length > 50 ? `${url.substring(0, 50)}...` : url}
            </div>
          ))}
          {validUrls.length > 3 && (
            <div className="text-xs text-gray-500">
              +{validUrls.length - 3} más
            </div>
          )}
        </div>
      );
    }
    
    // Handle single string values
    if (!processedFileUrl || typeof processedFileUrl !== 'string') {
      return (
        <div className="text-center text-xs text-gray-500">
          sin URLs
        </div>
      );
    }
    
    // Single URL
    return (
      <div className="max-w-xs">
        <div className="text-xs text-gray-600 break-all">
          {processedFileUrl.length > 50 ? `${processedFileUrl.substring(0, 50)}...` : processedFileUrl}
        </div>
      </div>
    );
  };

  // Sync from Airtable (Virtual Environment)
  const syncFromAirtable = async () => {
    // Prevent multiple simultaneous syncs
    if (syncing) {
      console.log('⚠️ Sync already in progress, ignoring request');
      return;
    }

    try {
      setSyncing(true);
      setSyncResult(null);
      
      // Add timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        setSyncing(false);
        setSyncResult({ 
          success: false, 
          message: '⏰ Sincronización cancelada por timeout (más de 45 segundos)' 
        });
      }, 45000); // 45 second timeout for products sync
      
      console.log('🔄 Starting simple virtual sync from Airtable...');
      
      const response = await fetch('/api/database/sync-airtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('🔄 Sync API response status:', response.status);
      const result = await response.json();
      console.log('🔄 Sync API response result:', result);
      
      clearTimeout(timeoutId);
      setSyncResult(result);
      
      if (result.success) {
        // Save sync timestamp
        const timestamp = new Date().toLocaleString('es-ES');
        const saved = await saveTimestampToStorage('adminvirtual-last-product-sync', timestamp);
        if (saved) {
          setLastProductSync(timestamp);
        }
        
        console.log('✅ Virtual sync completed successfully, reloading data...');
        
        // Reload products and columns - columns first, then products
        const freshColumns = await fetchColumns();
        if (freshColumns && freshColumns.length > 0) {
          await loadProducts(freshColumns);
        } else {
          await loadProducts();
        }
        
        setSyncResult({
          ...result,
          message: `${result.message} • Todos los productos están ahora visibles en la tabla`
        });
        
        // For virtual environment, we don't download images locally but we can trigger a cache refresh
        console.log('🖼️ Virtual environment: Using original Airtable URLs - no local download needed');
        
        // Trigger cache refresh in background (non-blocking)
        fetch('/api/cache-refresh', { method: 'POST' })
          .then(() => console.log('🔄 Cache refresh completed in background'))
          .catch(error => console.warn('⚠️ Cache refresh failed:', error));
        
        // Force refresh images on the page
        setTimeout(() => {
          console.log('🖼️ Forcing image refresh on page...');
          const images = document.querySelectorAll('img');
          images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src && (src.includes('dl.airtable.com') || src.includes('airtable'))) {
              const newSrc = src.includes('?') ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`;
              (img as HTMLImageElement).src = newSrc;
            }
          });
          console.log(`🖼️ Forced refresh of ${images.length} images`);
        }, 1000);
        
        // Dispatch sync completion event
        window.dispatchEvent(new CustomEvent('virtual-sync-complete'));
        
        console.log('🎉 Virtual sync process completed');
      } else {
        console.error('❌ Virtual sync failed:', result.message || result.errors || 'Unknown error');
      }
    } catch (error) {
      console.error('❌ Virtual sync error:', error);
      setSyncResult({ success: false, error: `Error syncing products: ${error}` });
    } finally {
      setSyncing(false);
    }
  };

  // Sync WebPhotos from Airtable (Virtual Environment)
  const syncWebPhotosFromAirtable = async () => {
    setSyncingWebPhotos(true);
    
    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      setSyncingWebPhotos(false);
      setWebPhotosSyncResult({ 
        success: false, 
        message: '⏰ Sincronización cancelada por timeout (más de 30 segundos)' 
      });
    }, 30000); // 30 second timeout
    
    try {
      const response = await fetch('/api/database/sync-webphotos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'virtual' }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      clearTimeout(timeoutId);
      
      setWebPhotosSyncResult(result);
      if (result.success) {
        const timestamp = new Date().toLocaleString('es-CO');
        const saved = await saveTimestampToStorage('adminvirtual-last-webphotos-sync', timestamp);
        if (saved) {
          setLastWebPhotosSync(timestamp);
        }
        
        // Load WebPhotos without waiting for cache refresh
        loadWebPhotos().catch(console.error);
        
        // Trigger cache refresh in background (non-blocking)
        fetch('/api/cache-refresh', { method: 'POST' })
          .then(() => console.log('🔄 Cache refresh completed in background'))
          .catch(error => console.warn('⚠️ Cache refresh failed:', error));
        
        // Force refresh images after a short delay
        setTimeout(() => {
          const images = document.querySelectorAll('img[src*="webphotos"]');
          images.forEach((img) => {
            const src = img.getAttribute('src');
            if (src) {
              const newSrc = src.includes('?') ? `${src}&cb=${Date.now()}` : `${src}?cb=${Date.now()}`;
              (img as HTMLImageElement).src = newSrc;
            }
          });
          console.log(`🔄 Refreshed ${images.length} WebPhotos images`);
        }, 2000);
        
        // Dispatch event for components to refresh
        window.dispatchEvent(new CustomEvent('webphotos-sync-complete'));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('❌ WebPhotos sync error:', error);
      setWebPhotosSyncResult({ 
        success: false, 
        message: `Error al sincronizar WebPhotos: ${error instanceof Error ? error.message : 'Error desconocido'}` 
      });
    } finally {
      clearTimeout(timeoutId);
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
        // Load columns first, then products (since products depend on columns)
        const freshColumns = await fetchColumns();
        if (freshColumns && freshColumns.length > 0) {
          await loadProducts(freshColumns);
        } else {
          await loadProducts();
        }
        await loadWebPhotos();
        
        // Force show all columns on first load if not all are visible
        setTimeout(() => {
          if (freshColumns && freshColumns.length > 0 && selectedColumns.length < freshColumns.length) {
            forceRefreshColumns();
          }
        }, 1000);
      } catch (error) {
        console.error('Error initializing virtual data:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeData();
  }, [pathname]);

  // Filter and sort products
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

  const displayedProducts = filteredAndSortedProducts;
  const displayColumns = Array.isArray(columns) ? columns.filter(col => selectedColumns.includes(col.key)) : [];
  
  // Create columns with URL columns for attachment fields
  const baseColumns = [
    ...displayColumns
  ];
  
  // Add URL columns for attachment fields
  const allDisplayColumns = baseColumns.reduce((acc: any[], column) => {
    acc.push(column);
    if (column.type === 'attachment') {
      acc.push({
        key: `${column.key}_urls`,
        label: `${column.label} URLs`,
        type: 'text',
        isUrlColumn: true,
        originalField: column.key
      });
    }
    return acc;
  }, []);

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

        {/* Airtable Sync Section (Collapsible) */}
        <div className="bg-white p-2 sm:p-6 rounded-lg shadow border">
          <button
            className="w-full flex items-center justify-between mb-2 sm:mb-4"
            onClick={() => setShowAirtableSync((v) => !v)}
            aria-expanded={showAirtableSync}
          >
            <div className="mb-2 sm:mb-0 text-left">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">🔄 Sincronización con Airtable Virtual</h3>
              <p className="text-xs sm:text-sm text-gray-600">Sincroniza datos desde tu base de Airtable virtual</p>
            </div>
            <span className="ml-3 text-gray-500">{showAirtableSync ? '▾' : '▸'}</span>
          </button>

          {showAirtableSync && (
            <>
              {/* Sync Buttons and Clear Database Button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 sm:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
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
              
              {/* Simple Progress Indicator */}
              {syncing && (
                <div className="w-full bg-gray-100 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                    <span>Sincronizando productos desde Airtable...</span>
                  </div>
                </div>
              )}
              
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
            </div>

            {/* Clear Database Button */}
            <button
              onClick={clearDatabase}
              disabled={clearing}
              className={`flex-1 sm:flex-none px-2 sm:px-6 py-2 sm:py-3 rounded-lg flex items-center justify-center gap-1 sm:gap-2 font-medium text-xs sm:text-base ${
                clearing ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {clearing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
            </>
          )}
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
                  {allDisplayColumns.some(col => col.isUrlColumn) && (
                    <span className="text-blue-600 ml-1">(incluye columnas de URLs)</span>
                  )}
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
                {/* Products Spreadsheet */}
                {spreadsheetData ? (
                  <div className="border border-gray-300 rounded-lg">
                    {/* Spreadsheet */}
                    <div className="min-h-[600px]">
                      <Spreadsheet
                        data={{
                          ...spreadsheetData,
                          columns: spreadsheetData.columns.filter(col => col.key !== 'id')
                        }}
                        onDataChange={handleSpreadsheetChange}
                        onColumnDelete={handleColumnDelete}
                        readOnly={false}
                        showAddRowAtEnd={true}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p>Cargando tabla de productos...</p>
                  </div>
                )}

                {/* Spreadsheet Info (buttons removed) */}
                <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-gray-600">
                    {spreadsheetData ? (
                      <>
                        {spreadsheetData.rows.length} productos • {spreadsheetData.columns.length} columnas
                      </>
                    ) : (
                      'Cargando datos...'
                    )}
                  </div>
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
          {(() => { console.log('🗑️ Modal is rendering, showClearConfirm:', showClearConfirm); return null; })()}
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

// Error boundary wrapper
export default function VirtualDatabasePage() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <VirtualDatabasePageContent />
    </ErrorBoundary>
  );
}

// Simple error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('❌ React error caught in VirtualDatabasePage:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Error fallback component
function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Error en la página
        </h2>
        <p className="text-gray-600 mb-4">
          Ha ocurrido un error al cargar la página de la base de datos.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
} 