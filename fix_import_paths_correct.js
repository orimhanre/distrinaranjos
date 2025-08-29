const fs = require('fs');
const path = require('path');

// Routes that need fixing with their correct relative paths
const routesToFix = [
  { path: 'app/api/add-admin/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/admin-permissions/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/admin/cleanup-expired-orders/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/debug-deleted-orders/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/mark-order-deleted/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/migrate-to-virtual-orders/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/confirm-bank-transfer/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/admin/update-env/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/client-portal/create-profile/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/update-order/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/virtual-permissions/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/database/sync-airtable/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/test-firebase/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/client-portal/profile/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/orders/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/virtual-auth-users/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/check-virtual-orders/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/delete-order/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/test-invoice-counter/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/admin/sync-missing-orders/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/client-portal/delete-account/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/generate-pdf/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/admin/move-to-deleted/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/admin/virtual-update-env/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/webhooks/stripe/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/webhooks/pse/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/webhooks/wompi/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/tracking-toggle/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/push-notifications/send-order-notification/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/push-notifications/send/route.ts', correctImport: '../../../lib/firebase' },
  { path: 'app/api/reset-invoice-counter/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/track-visit/route.ts', correctImport: '../../lib/firebase' },
  { path: 'app/api/get-order-details/[orderId]/route.ts', correctImport: '../../../lib/firebase' }
];

function fixRoute(routeInfo) {
  try {
    if (!fs.existsSync(routeInfo.path)) {
      console.log(`⚠️ File not found: ${routeInfo.path}`);
      return false;
    }

    let content = fs.readFileSync(routeInfo.path, 'utf8');
    const originalContent = content;

    // Replace any incorrect import path with the correct one
    content = content.replace(/await import\(['"`]\.\.\/lib\/firebase['"`]\)/g, `await import('${routeInfo.correctImport}')`);
    content = content.replace(/await import\(['"`]\.\.\/\.\.\/lib\/firebase['"`]\)/g, `await import('${routeInfo.correctImport}')`);
    content = content.replace(/await import\(['"`]\.\.\/\.\.\/\.\.\/lib\/firebase['"`]\)/g, `await import('${routeInfo.correctImport}')`);

    if (content !== originalContent) {
      fs.writeFileSync(routeInfo.path, content, 'utf8');
      console.log(`✅ Fixed import path in: ${routeInfo.path} -> ${routeInfo.correctImport}`);
      return true;
    } else {
      console.log(`ℹ️ No changes needed for: ${routeInfo.path}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${routeInfo.path}:`, error.message);
    return false;
  }
}

console.log('🔧 Fixing import paths with correct relative paths...\n');

let fixedCount = 0;
routesToFix.forEach(routeInfo => {
  if (fixRoute(routeInfo)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} routes with correct import paths`);
console.log('Ready to commit and push!');
