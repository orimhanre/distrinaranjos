'use client';
import React, { useEffect, useState } from 'react';
import { virtualAuth, virtualGoogleProvider, virtualDb } from '@/lib/firebase';

export default function FirebaseDebugger() {
  const [debugInfo, setDebugInfo] = useState({
    virtualAuth: false,
    virtualGoogleProvider: false,
    virtualDb: false,
    currentUser: null,
    authState: 'unknown'
  });

  useEffect(() => {
    const updateDebugInfo = () => {
      setDebugInfo({
        virtualAuth: !!virtualAuth,
        virtualGoogleProvider: !!virtualGoogleProvider,
        virtualDb: !!virtualDb,
        currentUser: null,
        authState: virtualAuth ? 'initialized' : 'not initialized'
      });
    };

    updateDebugInfo();

    // Listen for auth state changes
    if (virtualAuth) {
      const unsubscribe = virtualAuth.onAuthStateChanged((user) => {
        // setDebugInfo(prev => ({
        //   ...prev,
        //   currentUser: user
        // }));
      });

      return () => unsubscribe();
    }
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">Firebase Debug Info</h3>
      <div className="space-y-1">
        <div>Virtual Auth: {debugInfo.virtualAuth ? '✅' : '❌'}</div>
        <div>Virtual Provider: {debugInfo.virtualGoogleProvider ? '✅' : '❌'}</div>
        <div>Virtual DB: {debugInfo.virtualDb ? '✅' : '❌'}</div>
        <div>Auth State: {debugInfo.authState}</div>
        {/* <div>Current User: {debugInfo.currentUser ? debugInfo.currentUser.email : 'None'}</div> */}
      </div>
    </div>
  );
}
