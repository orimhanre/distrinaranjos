'use client';
import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { virtualAuth } from './firebase';

export function useClientAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 useClientAuth: Initializing...');
    
    if (!virtualAuth) {
      console.error('❌ useClientAuth: Virtual Auth not available for client portal');
      setError('Firebase authentication not configured');
      setLoading(false);
      return;
    }

    console.log('✅ useClientAuth: Virtual Auth is available');

    // Set persistence to local storage to keep user logged in
    const setupPersistence = async () => {
      try {
        if (virtualAuth) {
          await setPersistence(virtualAuth, browserLocalPersistence);
        }
        console.log('✅ useClientAuth: Persistence set to local storage');
      } catch (persistenceError) {
        console.error('❌ useClientAuth: Failed to set persistence:', persistenceError);
      }
    };

    setupPersistence();

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(
      virtualAuth, 
      (user) => {
        console.log('🔍 useClientAuth: Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
          console.log('👤 useClientAuth: User details:', {
            email: user.email,
            displayName: user.displayName,
            uid: user.uid
          });
        }
        setUser(user);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('❌ useClientAuth: Auth state error:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => {
      console.log('🔍 useClientAuth: Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
}
