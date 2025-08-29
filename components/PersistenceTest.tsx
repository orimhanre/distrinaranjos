'use client';
import React, { useEffect, useState } from 'react';
import { useClientAuth } from '@/lib/useClientAuth';

export default function PersistenceTest() {
  const { user, loading, error } = useClientAuth();
  const [persistenceStatus, setPersistenceStatus] = useState<string>('Checking...');

  useEffect(() => {
    if (!loading) {
      if (user) {
        setPersistenceStatus('✅ User is authenticated and session is persistent');
      } else {
        setPersistenceStatus('❌ No authenticated user found');
      }
    }
  }, [user, loading]);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2 text-green-800">Persistence Test</h3>
      <div className="space-y-1 text-green-700">
        <div>Status: {persistenceStatus}</div>
        <div>Loading: {loading ? 'Yes' : 'No'}</div>
        <div>User: {user ? user.email : 'None'}</div>
        {error && <div className="text-red-600">Error: {error}</div>}
      </div>
      <div className="mt-2 text-xs text-green-600">
        Try refreshing the page to test persistence
      </div>
    </div>
  );
}
