'use client';
import React, { useEffect, useState } from 'react';

export default function TestSyncPage() {
  const [timestamps, setTimestamps] = useState<any>(null);
  const [lastCheck, setLastCheck] = useState<string>('');

  const checkTimestamps = async () => {
    try {
      const response = await fetch('/api/admin/virtual-sync-timestamps');
      if (response.ok) {
        const data = await response.json();
        setTimestamps(data.timestamps);
        setLastCheck(new Date().toLocaleString());
      }
    } catch (error) {
      console.error('Error checking timestamps:', error);
    }
  };

  useEffect(() => {
    checkTimestamps();
    const interval = setInterval(checkTimestamps, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">iOS App Sync Test</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Sync Timestamps</h2>
          
          {timestamps ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <span className="font-medium text-blue-800">Product Sync:</span>
                <span className="text-blue-600">
                  {timestamps.lastProductSync || 'Never'}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <span className="font-medium text-green-800">WebPhotos Sync:</span>
                <span className="text-green-600">
                  {timestamps.lastWebPhotosSync || 'Never'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Loading timestamps...</p>
          )}
          
          <div className="mt-4 text-sm text-gray-500">
            Last checked: {lastCheck}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Open the iOS app</li>
            <li>Go to the "Base de Datos" tab</li>
            <li>Tap "Sincronizar Productos" or "Sincronizar WebPhotos"</li>
            <li>Watch the timestamps update above</li>
            <li>If timestamps update, the iOS app sync is working correctly!</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
