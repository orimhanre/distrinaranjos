const fs = require('fs');
const path = require('path');

// Routes that need fixing
const routesToFix = [
  'app/api/add-admin/route.ts',
  'app/api/admin-permissions/route.ts',
  'app/api/admin/cleanup-expired-orders/route.ts',
  'app/api/admin/debug-deleted-orders/route.ts',
  'app/api/admin/mark-order-deleted/route.ts',
  'app/api/admin/migrate-to-virtual-orders/route.ts',
  'app/api/confirm-bank-transfer/route.ts',
  'app/api/admin/update-env/route.ts',
  'app/api/admin/debug-deleted-orders/route.ts',
  'app/api/client-portal/create-profile/route.ts',
  'app/api/admin/update-order/route.ts',
  'app/api/admin/virtual-permissions/route.ts',
  'app/api/database/sync-airtable/route.ts',
  'app/api/admin/cleanup-expired-orders/route.ts',
  'app/api/test-firebase/route.ts',
  'app/api/client-portal/profile/route.ts',
  'app/api/admin/orders/route.ts',
  'app/api/admin/virtual-auth-users/route.ts',
  'app/api/check-virtual-orders/route.ts',
  'app/api/delete-order/route.ts',
  'app/api/test-invoice-counter/route.ts',
  'app/api/add-admin/route.ts',
  'app/api/admin/sync-missing-orders/route.ts',
  'app/api/client-portal/delete-account/route.ts',
  'app/api/generate-pdf/route.ts',
  'app/api/admin/move-to-deleted/route.ts',
  'app/api/admin/virtual-update-env/route.ts',
  'app/api/webhooks/stripe/route.ts',
  'app/api/webhooks/pse/route.ts',
  'app/api/webhooks/wompi/route.ts',
  'app/api/tracking-toggle/route.ts',
  'app/api/push-notifications/send-order-notification/route.ts',
  'app/api/push-notifications/send/route.ts',
  'app/api/reset-invoice-counter/route.ts',
  'app/api/track-visit/route.ts',
  'app/api/get-order-details/[orderId]/route.ts'
];

function getRelativePath(routePath) {
  const depth = routePath.split('/').length - 3; // Remove 'app/api' and filename
  return '../'.repeat(depth) + 'lib/firebase';
}

function fixRoute(routePath) {
  try {
    if (!fs.existsSync(routePath)) {
      console.log(`⚠️ File not found: ${routePath}`);
      return false;
    }

    let content = fs.readFileSync(routePath, 'utf8');
    const originalContent = content;

    // Fix the incorrect import paths
    content = content.replace(/\.\.\/\/lib\/firebase/g, getRelativePath(routePath));
    content = content.replace(/\.\.\/\.\.\/\/lib\/firebase/g, getRelativePath(routePath));

    if (content !== originalContent) {
      fs.writeFileSync(routePath, content, 'utf8');
      console.log(`✅ Fixed import path in: ${routePath}`);
      return true;
    } else {
      console.log(`ℹ️ No changes needed for: ${routePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${routePath}:`, error.message);
    return false;
  }
}

console.log('🔧 Fixing import paths...\n');

let fixedCount = 0;
routesToFix.forEach(routePath => {
  if (fixRoute(routePath)) {
    fixedCount++;
  }
});

console.log(`\n🎉 Fixed ${fixedCount} routes with incorrect import paths`);
console.log('Ready to commit and push!');
