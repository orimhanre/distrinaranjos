'use client';
import React, { useEffect, useState } from 'react';
import { Product } from '../../types';

interface WebPhoto {
  id: string;
  name: string;
  imageURL: string;
}

export default function DatabaseViewerPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [webPhotos, setWebPhotos] = useState<WebPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [timestamps, setTimestamps] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load products
      const productsResponse = await fetch('/api/database/virtual-products');
      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData.products || []);
      }
      
      // Load web photos
      const webPhotosResponse = await fetch('/api/database/virtual-webphotos');
      if (webPhotosResponse.ok) {
        const webPhotosData = await webPhotosResponse.json();
        setWebPhotos(webPhotosData.webPhotos || []);
      }
      
      // Load timestamps
      const timestampsResponse = await fetch('/api/admin/virtual-sync-timestamps');
      if (timestampsResponse.ok) {
        const timestampsData = await timestampsResponse.json();
        setTimestamps(timestampsData.timestamps);
      }
      
      setLastCheck(new Date().toLocaleString());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Database Viewer</h1>
        
        {/* Sync Status */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Sync Status</h2>
          {timestamps && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-800">Product Sync:</span>
                <span className="text-blue-600 ml-2">
                  {timestamps.lastProductSync || 'Never'}
                </span>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <span className="font-medium text-green-800">WebPhotos Sync:</span>
                <span className="text-green-600 ml-2">
                  {timestamps.lastWebPhotosSync || 'Never'}
                </span>
              </div>
            </div>
          )}
          <div className="mt-4 text-sm text-gray-500">
            Last checked: {lastCheck}
          </div>
        </div>

        {/* Products Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Products ({products.length})
          </h2>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.slice(0, 9).map((product) => (
                <div key={product.id} className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-2">{product.name}</h3>
                  {product.imageURL && (
                    <img 
                      src={Array.isArray(product.imageURL) ? product.imageURL[0] : product.imageURL} 
                      alt={product.name}
                      className="w-full h-32 object-cover rounded mb-2"
                    />
                  )}
                  <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                  <p className="text-lg font-bold text-green-600">${product.price}</p>
                  {product.category && (
                    <p className="text-xs text-gray-500">Category: {product.category}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No products found</p>
          )}
        </div>

        {/* Web Photos Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Web Photos ({webPhotos.length})
          </h2>
          {webPhotos.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {webPhotos.slice(0, 12).map((photo) => (
                <div key={photo.id} className="border rounded-lg p-2">
                  <img 
                    src={photo.imageURL} 
                    alt={photo.name}
                    className="w-full h-24 object-cover rounded mb-2"
                  />
                  <p className="text-xs text-gray-600 text-center">{photo.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No web photos found</p>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">How to Test:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-700">
            <li>Open the iOS app</li>
            <li>Go to "Base de Datos" tab</li>
            <li>Tap "Sincronizar Productos" or "Sincronizar WebPhotos"</li>
            <li>Watch this page update automatically</li>
            <li>If data appears here, the iOS app sync is working!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
