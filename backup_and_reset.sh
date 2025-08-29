#!/bin/bash

echo "🔄 Backup and Reset Script for AdminVirtualApp"
echo "=============================================="

# Create backup
echo "📁 Creating backup of Swift files..."
BACKUP_DIR="/tmp/AdminVirtualApp_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r AdminVirtualApp "$BACKUP_DIR/"
echo "✅ Backup created at: $BACKUP_DIR"

# Clean derived data
echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData

echo ""
echo "🎯 NEXT STEPS:"
echo "1. Close Xcode completely"
echo "2. Reopen Xcode"
echo "3. Open AdminVirtualApp project"
echo "4. Go to Project → Target → General → Frameworks"
echo "5. Add Firebase products:"
echo "   - FirebaseCore"
echo "   - FirebaseAuth"
echo "   - FirebaseFirestore"
echo "   - GoogleSignIn"
echo "6. Build and run (⌘+R)"
echo ""
echo "🔧 If that doesn't work, try nuclear reset:"
echo "1. Delete AdminVirtualApp.xcodeproj"
echo "2. Create new Xcode project"
echo "3. Copy Swift files from backup: $BACKUP_DIR"
echo ""
echo "📱 You should see the beautiful tab bars! 🎉"
