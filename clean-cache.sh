#!/bin/bash

# Clean Next.js cache files that can cause compression issues
echo "🧹 Cleaning Next.js cache..."

# Remove the entire .next directory
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Removed .next directory"
else
    echo "ℹ️  .next directory not found"
fi

# Remove specific problematic cache files if they exist
find . -name "*Qrwt4Gr_FcLvBP2cM0trctTuvAMAroaYAXz8vxM870w*" -type f -delete 2>/dev/null
echo "✅ Cleaned problematic cache files"

# Remove other temporary files that might cause compression issues
find . -name "*.tmp" -type f -delete 2>/dev/null
find . -name "*.temp" -type f -delete 2>/dev/null
find . -name "*.webp" -type f -delete 2>/dev/null

echo "✅ Cache cleaning completed!"
echo "💡 Run this script before compression to avoid issues" 