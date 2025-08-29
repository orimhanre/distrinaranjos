#!/bin/bash

# Clean files for compression - removes problematic cache and temporary files
echo "🧹 Cleaning files for compression..."

# Remove the entire .next directory (Next.js cache)
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Removed .next directory"
else
    echo "ℹ️  .next directory not found"
fi

# Remove all .webp files that might be corrupted
find . -name "*.webp" -type f -delete 2>/dev/null
echo "✅ Removed all .webp files"

# Remove macOS system files
find . -name ".DS_Store" -type f -delete 2>/dev/null
find . -name "._*" -type f -delete 2>/dev/null
echo "✅ Removed macOS system files"

# Remove temporary and log files
find . -name "*.tmp" -type f -delete 2>/dev/null
find . -name "*.temp" -type f -delete 2>/dev/null
find . -name "*.log" -type f -delete 2>/dev/null
find . -name "*.cache" -type f -delete 2>/dev/null
echo "✅ Removed temporary and log files"

# Remove TypeScript build info
if [ -f "tsconfig.tsbuildinfo" ]; then
    rm tsconfig.tsbuildinfo
    echo "✅ Removed TypeScript build info"
fi

# Remove server log if it exists
if [ -f "server.log" ]; then
    rm server.log
    echo "✅ Removed server log"
fi

# Clean empty directories
find . -type d -empty -delete 2>/dev/null
echo "✅ Cleaned empty directories"

echo "✅ Compression cleanup completed!"
echo ""
echo "📊 Current directory sizes:"
echo "   Product images: $(du -sh public/images/products/ 2>/dev/null | cut -f1 || echo 'N/A')"
echo "   Total project: $(du -sh . 2>/dev/null | cut -f1 || echo 'N/A')"
echo ""
echo "💡 Compression options:"
echo ""
echo "1️⃣  COMPRESS WITHOUT PRODUCT IMAGES (Recommended - ~100MB):"
echo "   tar --exclude='node_modules' --exclude='public/images/products' -czf QuickOrder_Web_clean.tar.gz ."
echo ""
echo "2️⃣  COMPRESS WITH PRODUCT IMAGES (Large - ~3GB):"
echo "   tar --exclude='node_modules' -czf QuickOrder_Web_full.tar.gz ."
echo ""
echo "3️⃣  ZIP WITHOUT PRODUCT IMAGES:"
echo "   zip -r QuickOrder_Web_clean.zip . -x 'node_modules/*' 'public/images/products/*'"
echo ""
echo "4️⃣  ZIP WITH PRODUCT IMAGES:"
echo "   zip -r QuickOrder_Web_full.zip . -x 'node_modules/*'"
echo ""
echo "🎯 Recommended: Use option 1 for deployment (without product images)"
echo "   Product images should be uploaded separately to your hosting service"
