import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// Function to load virtual environment variables
function loadVirtualEnv() {
  try {
    const virtualEnvPath = path.resolve(process.cwd(), '.env.virtual.local');
    if (fs.existsSync(virtualEnvPath)) {
      const content = fs.readFileSync(virtualEnvPath, 'utf8');
      const envVars: Record<string, string> = {};
      
      content.split('\n').forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const equalIndex = trimmedLine.indexOf('=');
          if (equalIndex > 0) {
            const key = trimmedLine.substring(0, equalIndex);
            const value = trimmedLine.substring(equalIndex + 1);
            envVars[key] = value;
          }
        }
      });
      
      return envVars;
    }
  } catch (error) {
    console.log('❌ Error loading virtual environment:', error);
  }
  return {};
}

// Load virtual environment variables
const virtualEnv = loadVirtualEnv();

// Helper function to clean private key
function cleanPrivateKey(privateKey: string | undefined): string | undefined {
  if (!privateKey) return undefined;
  
  // Remove quotes from beginning and end
  let cleaned = privateKey.replace(/^["']|["']$/g, '');
  
  // Replace literal \n with actual newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  
  // Remove any extra quotes within the key
  cleaned = cleaned.replace(/"/g, '');
  
  // Ensure it starts and ends with the proper format
  if (!cleaned.includes('-----BEGIN PRIVATE KEY-----')) {
    console.warn('⚠️ Private key format warning: Missing BEGIN marker');
  }
  if (!cleaned.includes('-----END PRIVATE KEY-----')) {
    console.warn('⚠️ Private key format warning: Missing END marker');
  }
  
  return cleaned;
}

// Main Firebase Admin SDK configuration (for QuickOrder project)
const mainAdminConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY),
};

// Virtual Firebase Admin SDK configuration (for QuickOrder-Virtual project)
const virtualAdminConfig = {
  projectId: virtualEnv.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID,
  clientEmail: virtualEnv.VIRTUAL_FIREBASE_CLIENT_EMAIL || process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL,
  privateKey: cleanPrivateKey(virtualEnv.VIRTUAL_FIREBASE_PRIVATE_KEY || process.env.VIRTUAL_FIREBASE_PRIVATE_KEY),
};

// Main and Virtual Admin Config loaded

// Initialize main Firebase Admin app
let mainAdminApp: any = null;
try {
  if (mainAdminConfig.projectId && mainAdminConfig.clientEmail && mainAdminConfig.privateKey) {
    // Check if main admin app already exists
    const existingApps = getApps();
    const existingMainApp = existingApps.find(app => app.name === 'main-admin');
    
    if (existingMainApp) {
      mainAdminApp = existingMainApp;
      // Main Firebase Admin already exists, reusing
    } else {
      mainAdminApp = initializeApp({
        credential: cert(mainAdminConfig),
        projectId: mainAdminConfig.projectId
      }, 'main-admin');
      // Main Firebase Admin initialized successfully
    }
      } else {
      // Main Firebase Admin config missing required fields
    }
} catch (error) {
  // Main Firebase Admin initialization error
  
  // Try to get existing app
  try {
    const existingApps = getApps();
    const existingMainApp = existingApps.find(app => app.name === 'main-admin');
    if (existingMainApp) {
      mainAdminApp = existingMainApp;
      // Main Firebase Admin retrieved from existing apps
    }
  } catch (getAppError) {
    // Could not retrieve existing main admin app
  }
}

// Initialize virtual Firebase Admin app
let virtualAdminApp: any = null;
try {
  if (virtualAdminConfig.projectId && virtualAdminConfig.clientEmail && virtualAdminConfig.privateKey) {
    // Check if virtual admin app already exists
    const existingApps = getApps();
    const existingVirtualApp = existingApps.find(app => app.name === 'virtual-admin');
    
    if (existingVirtualApp) {
      virtualAdminApp = existingVirtualApp;
      // Virtual Firebase Admin already exists, reusing
    } else {
      virtualAdminApp = initializeApp({
        credential: cert(virtualAdminConfig),
        projectId: virtualAdminConfig.projectId
      }, 'virtual-admin');
      // Virtual Firebase Admin initialized successfully
    }
      } else {
      // Virtual Firebase Admin config missing required fields
    }
} catch (error) {
  // Virtual Firebase Admin already initialized or config missing
  
  // Try to get existing app
  try {
    const existingApps = getApps();
    const existingVirtualApp = existingApps.find(app => app.name === 'virtual-admin');
    if (existingVirtualApp) {
      virtualAdminApp = existingVirtualApp;
      // Virtual Firebase Admin retrieved from existing apps
    }
  } catch (getAppError) {
    // Could not retrieve existing virtual admin app
  }
}

// Export main Firebase Admin instances
export const mainAdminAuth = mainAdminApp ? getAuth(mainAdminApp) : null;
export const mainAdminDb = mainAdminApp ? getFirestore(mainAdminApp) : null;

// Export virtual Firebase Admin instances
export const virtualAdminAuth = virtualAdminApp ? getAuth(virtualAdminApp) : null;
export const virtualAdminDb = virtualAdminApp ? getFirestore(virtualAdminApp) : null;

// Firebase Admin export status

export default virtualAdminApp; 