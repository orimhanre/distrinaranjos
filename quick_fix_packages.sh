#!/bin/bash

echo "🔧 Quick Fix for Missing Package Products"
echo "========================================="

# Clean derived data
echo "🧹 Cleaning derived data..."
rm -rf ~/Library/Developer/Xcode/DerivedData

# Clean build folder
echo "🔨 Cleaning build folder..."
rm -rf ~/Library/Developer/Xcode/DerivedData

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "🎯 NEXT STEPS IN XCODE:"
echo "1. Open Xcode"
echo "2. Open AdminVirtualApp project"
echo "3. Go to 'Package Dependencies' tab"
echo "4. Remove all Firebase and Google packages"
echo "5. File → Add Package Dependencies"
echo "6. Add Firebase: https://github.com/firebase/firebase-ios-sdk"
echo "7. Select: FirebaseCore, FirebaseAuth, FirebaseFirestore"
echo "8. Add Google Sign-In: https://github.com/google/GoogleSignIn-iOS"
echo "9. Select: GoogleSignIn, GoogleSignInSwift"
echo "10. Build and run (⌘+R)"
echo ""
echo "📱 You should see the beautiful tab bars! 🎉"
