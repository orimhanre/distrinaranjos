const fs = require('fs');
const path = require('path');

// List of all API routes with Firebase imports
const routes = [
  'app/api/track-visit/route.ts',
  'app/api/reset-invoice-counter/route.ts',
  'app/api/database/sync-airtable/route.ts',
  'app/api/admin-permissions/route.ts',
  'app/api/tracking-toggle/route.ts',
  'app/api/delete-order/route.ts',
  'app/api/add-admin/route.ts',
  'app/api/admin/update-order/route.ts',
  'app/api/admin/update-env/route.ts',
  'app/api/admin/mark-order-deleted/route.ts',
  'app/api/admin/move-to-deleted/route.ts',
  'app/api/admin/virtual-update-env/route.ts',
  'app/api/admin/sync-missing-orders/route.ts',
  'app/api/admin/virtual-auth-users/route.ts',
  'app/api/admin/virtual-permissions/route.ts',
  'app/api/admin/get-original-order/route.ts',
  'app/api/admin/migrate-to-virtual-orders/route.ts',
  'app/api/admin/cleanup-expired-orders/route.ts',
  'app/api/admin/orders/route.ts',
  'app/api/admin/debug-deleted-orders/route.ts',
  'app/api/admin/permanently-delete-order/route.ts',
  'app/api/admin/deleted-orders/route.ts',
  'app/api/firestore-trigger-sync/route.ts',
  'app/api/send-order/route.ts',
  'app/api/get-order-details/[orderId]/route.ts',
  'app/api/test-firebase/route.ts',
  'app/api/save-admin-token/route.ts',
  'app/api/confirm-bank-transfer/route.ts',
  'app/api/push-notifications/send-order-notification/route.ts',
  'app/api/push-notifications/send/route.ts',
  'app/api/generate-pdf/route.ts',
  'app/api/test-invoice-counter/route.ts',
  'app/api/webhooks/pse/route.ts',
  'app/api/webhooks/wompi/route.ts',
  'app/api/webhooks/stripe/route.ts',
  'app/api/check-virtual-orders/route.ts',
  'app/api/client-portal/delete-account/route.ts',
  'app/api/client-portal/profile/route.ts',
  'app/api/client-portal/create-profile/route.ts'
];

// Routes that have already been fixed
const alreadyFixed = [
  'app/api/firestore-trigger-sync/route.ts',
  'app/api/save-admin-token/route.ts',
  'app/api/admin/get-original-order/route.ts',
  'app/api/admin/deleted-orders/route.ts',
  'app/api/send-order/route.ts'
];

// Routes to fix (exclude already fixed ones)
const routesToFix = routes.filter(route => !alreadyFixed.includes(route));

console.log(`Found ${routes.length} routes with Firebase imports`);
console.log(`Already fixed: ${alreadyFixed.length}`);
console.log(`Routes to fix: ${routesToFix.length}`);

// Function to fix a single route
function fixRoute(routePath) {
  try {
    if (!fs.existsSync(routePath)) {
      console.log(`⚠️  Route not found: ${routePath}`);
      return false;
    }

    let content = fs.readFileSync(routePath, 'utf8');
    let modified = false;

    // Check if route uses both regular and virtual Firebase
    const usesBoth = content.includes('db, virtualDb') || content.includes('virtualDb, db');
    const usesVirtualOnly = content.includes('virtualDb') && !content.includes('db,') && !content.includes(', db');
    const usesRegularOnly = content.includes('db') && !content.includes('virtualDb');

    // Remove top-level Firebase imports
    const firebaseImportRegex = /import\s+.*from\s+['"]firebase\/firestore['"];?\s*\n?/g;
    const firebaseAppImportRegex = /import\s+.*from\s+['"]firebase\/app['"];?\s*\n?/g;
    const firebaseAdminImportRegex = /import\s+.*from\s+['"]firebase-admin\/app['"];?\s*\n?/g;
    const firebaseAdminMessagingImportRegex = /import\s+.*from\s+['"]firebase-admin\/messaging['"];?\s*\n?/g;
    const firebaseAdminFirestoreImportRegex = /import\s+.*from\s+['"]firebase-admin\/firestore['"];?\s*\n?/g;
    const firebaseLibImportRegex = /import\s+.*from\s+['"][^'"]*firebase['"];?\s*\n?/g;

    const originalContent = content;

    // Remove Firebase imports
    content = content.replace(firebaseImportRegex, '');
    content = content.replace(firebaseAppImportRegex, '');
    content = content.replace(firebaseAdminImportRegex, '');
    content = content.replace(firebaseAdminMessagingImportRegex, '');
    content = content.replace(firebaseAdminFirestoreImportRegex, '');
    content = content.replace(firebaseLibImportRegex, '');

    if (content !== originalContent) {
      modified = true;
    }

    // Find the first export function (POST, GET, etc.)
    const exportFunctionMatch = content.match(/export\s+async\s+function\s+(POST|GET|PUT|DELETE|PATCH)\s*\(/);
    if (!exportFunctionMatch) {
      console.log(`⚠️  No export function found in ${routePath}`);
      return false;
    }

    const functionName = exportFunctionMatch[1];
    const functionStart = content.indexOf(`export async function ${functionName}`);
    const functionBodyStart = content.indexOf('{', functionStart);
    
    if (functionBodyStart === -1) {
      console.log(`⚠️  Could not find function body in ${routePath}`);
      return false;
    }

    // Determine which environment variables to check
    let envCheckCode = '';
    if (usesBoth) {
      envCheckCode = `
    // Check if required environment variables are available for both regular and virtual environments
    const hasRegularFirebase = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                                 process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                                 process.env.FIREBASE_PRIVATE_KEY &&
                                 process.env.FIREBASE_CLIENT_EMAIL);
    
    const hasVirtualFirebase = !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                                 process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                                 process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                                 process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL);
    
    if (!hasRegularFirebase && !hasVirtualFirebase) {
      console.log('⚠️ Neither regular nor virtual Firebase environment variables available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured for either environment' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db, virtualDb } = await import('${getRelativePath(routePath)}/lib/firebase');`;
    } else if (usesVirtualOnly) {
      envCheckCode = `
    // Check if required virtual Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID ||
        !process.env.VIRTUAL_FIREBASE_PRIVATE_KEY ||
        !process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Virtual Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Virtual Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { virtualDb } = await import('${getRelativePath(routePath)}/lib/firebase');`;
    } else {
      envCheckCode = `
    // Check if required Firebase environment variables are available
    if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 
        !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
        !process.env.FIREBASE_PRIVATE_KEY ||
        !process.env.FIREBASE_CLIENT_EMAIL) {
      console.log('⚠️ Firebase environment variables not available, skipping operation');
      return NextResponse.json({ 
        success: false, 
        error: 'Firebase not configured' 
      }, { status: 503 });
    }

    // Only import Firebase when we actually need it
    const { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, setDoc, deleteDoc, getDocs, query, orderBy, limit, where } = await import('firebase/firestore');
    const { db } = await import('${getRelativePath(routePath)}/lib/firebase');`;
    }

    // Insert the environment check and dynamic imports after the function opening brace
    const insertPosition = functionBodyStart + 1;
    const beforeInsert = content.substring(0, insertPosition);
    const afterInsert = content.substring(insertPosition);
    
    content = beforeInsert + envCheckCode + afterInsert;

    // Add a GET method if it doesn't exist
    if (!content.includes('export async function GET')) {
      const getMethodCode = `

export async function GET() {
  // Handle build-time page data collection
  const hasRegularFirebase = !!(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
                               process.env.FIREBASE_PRIVATE_KEY &&
                               process.env.FIREBASE_CLIENT_EMAIL);
  
  const hasVirtualFirebase = !!(process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY && 
                               process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID &&
                               process.env.VIRTUAL_FIREBASE_PRIVATE_KEY &&
                               process.env.VIRTUAL_FIREBASE_CLIENT_EMAIL);
  
  return NextResponse.json({ 
    success: true, 
    message: 'API endpoint available',
    configured: hasRegularFirebase || hasVirtualFirebase,
    regularFirebase: hasRegularFirebase,
    virtualFirebase: hasVirtualFirebase
  });
}`;

      content += getMethodCode;
    }

    if (content !== originalContent) {
      fs.writeFileSync(routePath, content, 'utf8');
      console.log(`✅ Fixed: ${routePath}`);
      return true;
    } else {
      console.log(`⏭️  No changes needed: ${routePath}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ Error fixing ${routePath}:`, error.message);
    return false;
  }
}

// Helper function to get relative path to lib/firebase
function getRelativePath(routePath) {
  const depth = routePath.split('/').length - 3; // app/api/route.ts = 3 parts
  return '../'.repeat(depth);
}

// Fix all routes
let fixedCount = 0;
for (const route of routesToFix) {
  if (fixRoute(route)) {
    fixedCount++;
  }
}

console.log(`\n🎉 Fixed ${fixedCount} routes out of ${routesToFix.length} routes to fix`);
console.log('Ready to commit and push!');
