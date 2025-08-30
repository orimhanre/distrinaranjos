'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { checkAdminPermission } from '@/lib/adminPermissions';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";
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

export default function DatabasePage() {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [clearing, setClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [displayCount, setDisplayCount] = useState(25);
  const [showProductsTable, setShowProductsTable] = useState(false);
  const [lastProductSync, setLastProductSync] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [cacheRefreshResult, setCacheRefreshResult] = useState<any>(null);
  const pathname = usePathname();

  // Load sync timestamps from localStorage on component mount
  useEffect(() => {
    const savedProductSync = localStorage.getItem('admin-last-product-sync');
    
    if (savedProductSync) {
      setLastProductSync(savedProductSync);
    }
  }, []);

  // Authentication setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setPermissionLoading(true);
      checkAdminPermission(user.email).then((result) => {
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
      localStorage.setItem('admin-selected-columns', JSON.stringify(columns));
    } catch (e) {
      console.error('Error saving column selection:', e);
    }
  };

  // Load columns from backend
  const fetchColumns = async () => {
    try {
      console.log('Fetching columns from API...');
      const res = await fetch('/api/database/columns');
      const data = await res.json();
      console.log('Columns API response:', data);
      
      if (data.success && Array.isArray(data.columns)) {
        console.log('Setting columns from API:', data.columns.length, 'columns');
        setColumns(data.columns);
        
        // If no columns (database cleared), set empty selection
        if (data.columns.length === 0) {
          setSelectedColumns([]);
          return;
        }
        
        // Load saved column selection from localStorage
        const savedColumns = localStorage.getItem('admin-selected-columns');
        if (savedColumns) {
          try {
            const parsedColumns = JSON.parse(savedColumns);
            // Only use saved columns that still exist in the current schema
            const validColumns = parsedColumns.filter((col: string) => 
              data.columns.some((c: any) => c.key === col)
            );
            if (validColumns.length > 0) {
              setSelectedColumns(validColumns);
              saveSelectedColumns(validColumns);
              return;
            }
          } catch (e) {
            console.error('Error parsing saved columns:', e);
          }
        }
        
        // Fallback to auto-select important columns if no saved selection
        const importantColumns = ['name', 'brand', 'type', 'price1', 'price2', 'quantity', 'SKN'];
        const defaultSelection = importantColumns.filter(col => 
          col === 'id' || data.columns.some((c: any) => c.key === col)
        );
        setSelectedColumns(defaultSelection);
        saveSelectedColumns(defaultSelection);
      } else {
        console.error('Invalid columns data:', data);
        setColumns([]);
        setSelectedColumns([]);
      }
    } catch (e) {
      console.error('Error fetching columns:', e);
      setColumns([]);
      setSelectedColumns([]);
    }
  };

  // Load products from database
  const loadProducts = async () => {
    try {
      const response = await fetch('/api/database/products');
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products || []);
      }
    } catch (error) {
              console.error('Error cargando productos:', error);
    }
  };



  // Format value for display
  const formatValue = (value: any, columnType: string) => {
    if (value === null || value === undefined || value === '') return '';
    
    switch (columnType) {
      case 'boolean':
        return value ? '✅' : '❌';
      case 'multipleSelect':
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);
      case 'number':
        if (typeof value === 'number') {
          // Format numbers with points as thousand separators for Colombian format
          return value.toLocaleString('es-CO').replace(/,/g, '.');
        }
        return String(value);
      case 'attachment':
        if (Array.isArray(value) && value.length > 0) {
          const images = value.slice(0, 3);
          return (
            <div className="flex gap-1">
              {images.map((img: any, index: number) => {
                const imgSrc = typeof img === 'string' ? img : img.url || img;
                return (
                  <img 
                    key={index}
                    src={`${imgSrc}?t=${Date.now()}`} 
                    alt={`Imagen ${index + 1}`}
                    className="w-8 h-8 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      setSelectedImage(imgSrc);
                      setShowImageModal(true);
                    }}
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-image.png';
                    }}
                  />
                );
              })}
              {value.length > 3 && (
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600">
                  +{value.length - 3}
                </div>
              )}
            </div>
          );
        }
        // Show user-friendly message when no images
        if (Array.isArray(value) && value.length === 0) {
          return <span className="text-gray-400 text-xs">Sin fotos</span>;
        }
        // Handle null/undefined or non-array values
        if (!value || value === '[]') {
          return <span className="text-gray-400 text-xs">Sin fotos</span>;
        }
        return String(value);
      default:
        return String(value);
    }
  };

  // Render file preview for products
  const renderFilePreview = (fileUrl: string, fileName: string) => {
    // Debug logging
    console.log('renderFilePreview called with:', { fileUrl, fileName });
    
    if (!fileUrl) {
      return (
        <div className="bg-gray-100 rounded-lg p-2 min-w-[60px] text-center">
          <div className="text-lg text-gray-400">❌</div>
          <div className="text-xs text-gray-400 font-medium">Sin URL</div>
        </div>
      );
    }
    
    const url = fileUrl.toLowerCase();
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
        className={`${bgColor} rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity min-w-[60px] text-center`}
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
        <div className={`text-lg ${textColor}`}>{icon}</div>
        <div className={`text-xs ${textColor} font-medium`}>{fileType}</div>
      </div>
    );
  };

  // Clear database with confirmation
  const clearDatabase = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearDatabase = async () => {
    setShowClearConfirm(false);
    setClearing(true);
    try {
      const response = await fetch('/api/database/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'regular' }),
      });
      const result = await response.json();
      setClearResult(result);
      if (result.success) {
        // Clear sync timestamps when database is cleared
        setLastProductSync(null);
        localStorage.removeItem('admin-last-product-sync');
        
        // Add a small delay to ensure file system operations are complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await loadProducts();
        await fetchColumns();
      }
    } catch (error) {
      setClearResult({ success: false, message: 'Error al limpiar base de datos' });
    } finally {
      setClearing(false);
    }
  };

  // Sync from Airtable
  const syncFromAirtable = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      console.log('🔄 Starting optimized sync from Airtable...');
      
      const response = await fetch('/api/database/sync-airtable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ context: 'regular' }),
      });
      
      const result = await response.json();
      setSyncResult(result);
      
      if (result.success) {
        const timestamp = new Date().toLocaleString('es-CO');
        setLastProductSync(timestamp);
        localStorage.setItem('admin-last-product-sync', timestamp);
        
        console.log('✅ Sync completed successfully, reloading data...');
        await loadProducts();
        await fetchColumns();
        
        // Download images after successful sync
        console.log('🖼️ Starting image download process...');
        try {
          const imageResponse = await fetch('/api/download-product-images', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ context: 'regular' }),
          });
          
          const imageResult = await imageResponse.json();
          if (imageResult.success) {
            console.log(`✅ Image download completed: ${imageResult.downloadedCount} images downloaded`);
          } else {
            console.warn('⚠️ Image download failed:', imageResult.message);
          }
        } catch (imageError) {
          console.warn('⚠️ Image download error:', imageError);
        }
        
        console.log('🎉 Admin sync process completed');
      } else {
        console.error('❌ Sync failed:', result.message);
        console.error('❌ Sync error details:', result.errors);
      }
    } catch (error) {
      console.error('❌ Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al sincronizar';
      setSyncResult({ success: false, message: `Error al sincronizar: ${errorMessage}` });
    } finally {
      setSyncing(false);
    }
  };



  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };



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
      
      setTimeout(() => setCacheRefreshResult(null), 5000);
    } catch (error) {
      setCacheRefreshResult({
        success: false,
        message: `❌ Error al limpiar imágenes: ${error}`
      });
      setTimeout(() => setCacheRefreshResult(null), 5000);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Initialize data
  useEffect(() => {
    // Only fetch data when user is actually on this page
    // Check if we're on the database page specifically
    if (pathname !== '/admin/database') return;
    
    const initializeData = async () => {
      try {
        await Promise.all([
          loadProducts(),
          fetchColumns()
        ]);
      } catch (error) {
        console.error('Error initializing data:', error);
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

  const displayedProducts = filteredAndSortedProducts.slice(0, displayCount);
  const displayColumns = columns.filter(col => selectedColumns.includes(col.key));
  const allDisplayColumns = [
    ...(selectedColumns.includes('id') ? [{ key: 'id', label: 'ID', type: 'text' }] : []),
    ...displayColumns
  ];

  if (loading || permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Inicio de Sesión de Administrador</h1>
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
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
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Admin</p>
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
          <h1 className="text-lg sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Base de Datos Interna</h1>
          <p className="text-gray-600 text-xs sm:text-base">Gestiona tus productos con tu propia base de datos</p>
        </div>

        {/* Airtable Sync Section */}
        <div className="bg-white p-2 sm:p-6 rounded-lg shadow border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 sm:mb-4">
            <div className="mb-2 sm:mb-0">
              <h3 className="text-sm sm:text-lg font-semibold text-gray-900">🔄 Sincronización con Airtable</h3>
              <p className="text-xs sm:text-sm text-gray-600">Sincroniza datos desde tu base de Airtable</p>
            </div>
            <button
              onClick={clearDatabase}
              disabled={clearing}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                clearing
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {clearing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white inline mr-2"></div>
                  Limpiando...
                </>
              ) : (
                <>
                  🗑️ Limpiar Base de Datos
                </>
              )}
            </button>
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
                  <span className="hidden sm:inline">Sincronizar Productos</span>
                  <span className="sm:hidden">Productos</span>
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

            {/* Last Sync Times */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Products Last Sync */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600">📥</span>
                  <span className="text-sm font-medium text-gray-900">Productos</span>
                </div>
                <div className="text-xs text-gray-600">
                  {lastProductSync ? (
                    <span>Última sincronización: {lastProductSync}</span>
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
            <div className="text-lg sm:text-2xl font-bold text-blue-600">{products.length}</div>
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
              {new Set(products.map(p => (p as any).type)).size}
            </div>
            <div className="text-xs sm:text-sm text-gray-600">Tipos</div>
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
                      let newSelection: string[];
                      if (e.target.checked) {
                        newSelection = [...selectedColumns, 'id'];
                      } else {
                        newSelection = selectedColumns.filter(col => col !== 'id');
                      }
                      setSelectedColumns(newSelection);
                      saveSelectedColumns(newSelection);
                    }}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-xs">ID</div>
                    <div className="text-xs text-gray-500">text</div>
                  </div>
                </label>
                
                {/* Other Columns */}
                {columns.map((column) => (
                  <label key={column.key} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={selectedColumns.includes(column.key)}
                      onChange={(e) => {
                        let newSelection: string[];
                        if (e.target.checked) {
                          newSelection = [...selectedColumns, column.key];
                        } else {
                          newSelection = selectedColumns.filter(col => col !== column.key);
                        }
                        setSelectedColumns(newSelection);
                        saveSelectedColumns(newSelection);
                      }}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-xs">{column.label}</div>
                      <div className="text-xs text-gray-500">{column.type}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="text-xs text-gray-600">
              Mostrando {displayColumns.length} de {columns.length} columnas
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-lg shadow border">
          <div className="p-3 sm:p-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">📊 Tabla de Productos</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  {products.length} productos almacenados localmente
                  {products.length > 0 && (
                    <span className="ml-2 text-green-600">✅ Cargados</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Mostrando {displayedProducts.length} de {filteredAndSortedProducts.length} productos con {displayColumns.length} columnas
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => setShowProductsTable(!showProductsTable)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs sm:text-sm transition-colors w-full sm:w-auto"
                >
                  {showProductsTable ? 'Ocultar Tabla' : 'Mostrar Tabla'}
                </button>
              </div>
            </div>
          </div>
          
          {showProductsTable && (
            <div className="overflow-x-auto" style={{ width: 'max-content' }}>
              <table className="divide-y divide-gray-200" style={{ minWidth: `${(allDisplayColumns.length + 1) * 80}px`, width: 'max-content' }}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-1 sm:px-2 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 w-10 sticky left-0 bg-gray-50 z-10">Nº</th>
                    {allDisplayColumns.map((column) => (
                      <th key={column.key} className="px-1 sm:px-2 md:px-4 py-3 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 min-w-[70px] sm:min-w-[90px] md:min-w-[110px] bg-gray-50">
                        <div className="flex flex-col">
                          <span className="truncate">{column.label}</span>
                          <span className="text-xs text-gray-400 font-normal">({getAirtableFieldType(column.type)})</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {displayedProducts.map((product, index) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-1 sm:px-2 md:px-4 py-3 border-r border-gray-200 w-10 sticky left-0 bg-white z-10">
                        <div className="text-xs text-gray-900 font-mono text-gray-600">
                          {index + 1}
                        </div>
                      </td>
                      {allDisplayColumns.map((column) => {
                        const value = column.key === 'id' ? product.id : (product as any)[column.key];
                        const formattedValue = formatValue(value, column.type);
                        return (
                          <td key={column.key} className="px-1 sm:px-2 md:px-4 py-3 border-r border-gray-200 min-w-[70px] sm:min-w-[90px] md:min-w-[110px] bg-white">
                            <div className={`text-xs text-gray-900 ${column.key === 'id' ? 'font-mono text-gray-600' : ''} break-words`}>
                              {formattedValue}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {showProductsTable && displayedProducts.length === 0 && searchQuery && (
            <div className="p-6 sm:p-8 text-center text-gray-500">
              <p className="text-sm sm:text-base">No se encontraron productos que coincidan con "{searchQuery}"</p>
            </div>
          )}
          
          {showProductsTable && filteredAndSortedProducts.length > displayCount && (
            <div className="p-4 bg-gray-50 border-t text-center">
              <button
                onClick={() => setDisplayCount(displayCount + 25)}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm sm:text-base"
              >
                Cargar más ({displayedProducts.length} de {filteredAndSortedProducts.length})
              </button>
            </div>
          )}
        </div>



        {/* Footer */}
        <div className="mt-6 text-center text-xs sm:text-sm text-gray-600">
          <p>✅ Base de datos dinámica funcionando correctamente</p>
          <p className="mt-1">Todas las columnas se sincronizan automáticamente desde Airtable</p>
        </div>

        {/* Image Modal */}
        {showImageModal && selectedImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-2 sm:p-4"
            onClick={() => setShowImageModal(false)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowImageModal(false);
                }}
                className="absolute top-2 sm:top-4 right-2 sm:right-4 z-10 bg-black bg-opacity-50 text-white text-xl sm:text-2xl hover:text-gray-300 transition-colors rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-opacity-70"
              >
                ✕
              </button>
              
              {/* Check if it's an image file */}
              {(() => {
                const url = selectedImage.toLowerCase();
                const isImage = url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp') || url.includes('.svg');
                
                if (isImage) {
                  return (
                    <img
                      src={`${selectedImage}?t=${Date.now()}`}
                      alt="Vista previa"
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-image.png';
                      }}
                    />
                  );
                } else {
                  // For non-image files (PDF, documents, etc.)
                  const isPdf = url.includes('.pdf');
                  const isVideo = url.includes('.mp4') || url.includes('.avi') || url.includes('.mov') || url.includes('.webm');
                  const isDocument = url.includes('.doc') || url.includes('.docx') || url.includes('.txt');
                  
                  let fileType = 'Archivo';
                  let icon = '📎';
                  let bgColor = 'bg-gray-100';
                  let textColor = 'text-gray-600';
                  
                  if (isPdf) {
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
                    <div className={`${bgColor} rounded-lg p-4 sm:p-8 text-center max-w-sm sm:max-w-md mx-auto`}>
                      <div className={`text-4xl sm:text-6xl mb-4 ${textColor}`}>{icon}</div>
                      <h3 className={`text-lg sm:text-xl font-semibold mb-2 ${textColor}`}>{fileType}</h3>
                      <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">Este archivo no se puede previsualizar en el navegador</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(selectedImage, '_blank');
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base"
                      >
                        Abrir en nueva pestaña
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Account Section - Only visible on mobile */}
      <div className="block md:hidden mt-8">
        <div className="bg-white border-t border-gray-200 py-4">
          <div className="flex items-center justify-end gap-3">
            <span className="text-gray-800 font-medium truncate">{user.email}</span>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
              title="Cerrar sesión"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
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
                  <h3 className="text-lg font-semibold text-gray-900">Limpiar Base de Datos</h3>
                  <p className="text-sm text-gray-600">Acción crítica</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-gray-700 mb-4">
                ¿Estás seguro de que quieres eliminar todos los datos?
              </p>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-red-800 mb-2">Esto eliminará:</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Todos los productos
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                    Todas las imágenes
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
    </div>
  );
}
