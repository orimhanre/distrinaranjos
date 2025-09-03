import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';

// Determine which Firebase project to use based on URL
const isVirtualAdmin = typeof window !== 'undefined' && window.location.pathname.includes('adminvirtual');
const isClientPortal = typeof window !== 'undefined' && window.location.pathname.includes('client-portal');



// Main admin Firebase config (NEXT_PUBLIC_ environment variables for QuickOrder project)
const mainFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Virtual admin Firebase config (NEXT_PUBLIC_VIRTUAL_ environment variables for QuickOrder-Virtual project)
const virtualFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID
};

// Server-side Firebase config (for API routes) - uses main admin config
const serverFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};



// Initialize main Firebase app (for main admin - QuickOrder project)
let mainApp: any = null;
try {
  mainApp = getApps().length ? getApp() : initializeApp(mainFirebaseConfig);

} catch (error) {
  console.error('❌ Error initializing main Firebase app:', error);
}

// Initialize virtual Firebase app (for virtual admin - QuickOrder-Virtual project)
let virtualApp: any = null;
try {
  // Only initialize if we have the required config values
  if (virtualFirebaseConfig.apiKey && virtualFirebaseConfig.authDomain && virtualFirebaseConfig.projectId) {
    // Check if virtual app already exists
    const existingApps = getApps();
    const existingVirtualApp = existingApps.find(app => app.name === 'virtual');
    
    if (existingVirtualApp) {
      virtualApp = existingVirtualApp;

    } else {
      virtualApp = initializeApp(virtualFirebaseConfig, 'virtual');

    }
  } else {
    console.warn('⚠️ Virtual Firebase config incomplete, skipping initialization');
  }
} catch (error) {
  console.error('❌ Error initializing virtual Firebase app:', error);
}

// Initialize server-side Firebase if we're on the server
let serverApp: any = null;
if (typeof window === 'undefined') {
  try {
    serverApp = initializeApp(serverFirebaseConfig, 'server');
    console.log('✅ Server Firebase app initialized');
    
    // Also initialize virtual Firebase on server side if config is available
    if (virtualFirebaseConfig.apiKey && virtualFirebaseConfig.authDomain && virtualFirebaseConfig.projectId) {
      try {
        const virtualServerApp = initializeApp(virtualFirebaseConfig, 'virtual-server');
        // Use the server-side virtual app for virtualDb export
        virtualApp = virtualServerApp;
        console.log('✅ Virtual Firebase app initialized on server');
      } catch (virtualError) {
        console.error('❌ Failed to initialize virtual Firebase on server:', virtualError);
      }
    }
  } catch (error) {
    console.error('❌ Error initializing server Firebase app:', error);
  }
}

// Initialize Firestore (uses main app by default)
export const db = getFirestore(serverApp || mainApp);

// Initialize Auth (uses main app by default)
export const auth = getAuth(mainApp);
export const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Set auth persistence to local (keeps user logged in across tabs and reloads)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error('❌ Failed to set Firebase Auth persistence:', err);
  });
}

// Export virtual Firebase instances for adminvirtual pages
export const virtualDb = virtualApp ? getFirestore(virtualApp) : null;
export const virtualAuth = virtualApp ? getAuth(virtualApp) : null;
export const virtualGoogleProvider = virtualApp ? new GoogleAuthProvider() : null;

// console.log('🔍 Firebase exports check:', { hasVirtualDb: !!virtualDb, hasVirtualAuth: !!virtualAuth, hasVirtualGoogleProvider: !!virtualGoogleProvider }); // Reduced logging

// Configure virtual Google provider
if (virtualGoogleProvider && virtualAuth) {
  virtualGoogleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  
  // Set auth persistence to local for virtual auth as well
  if (typeof window !== 'undefined') {
    setPersistence(virtualAuth, browserLocalPersistence).catch((err) => {
      console.error('❌ Failed to set Firebase Auth persistence for virtual auth:', err);
    });
  }
  

}

export default mainApp; 