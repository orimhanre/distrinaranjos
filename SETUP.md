# QuickOrder Web App Setup

## Environment Variables Required

Create a `.env.local` file in the `quickorder-web` directory with the following variables:

### Firebase Configuration (for order sending)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Cloudinary Configuration (for PDF uploads)
```
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### Airtable Configuration (for products)
```
AIRTABLE_API_KEY=your_airtable_api_key
AIRTABLE_BASE_ID=your_airtable_base_id
```

## How to Get Firebase Configuration

1. Go to your Firebase Console (https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings (gear icon)
4. Scroll down to "Your apps" section
5. Click on "Web app" or create a new web app
6. Copy the configuration values

## Features

- **Automatic Order Sending**: When clients click "Enviar el Pedido en PDF a DistriNaranjos", the order is automatically sent to your Firestore orders collection
- **PDF Generation**: Creates PDFs matching your iOS app format
- **Cloudinary Integration**: Uploads PDFs to Cloudinary for storage
- **Airtable Integration**: Fetches products from your Airtable base
- **Dual Pricing**: Supports both Price 1 (green) and Price 2 (blue) forms

## Order Structure

Orders sent to Firestore match your iOS app's structure:
- `userId`: "web-client" (for web orders)
- `userName`: Client's company name or name
- `orderDetails`: Formatted order summary
- `fileUrl`: Cloudinary URL of the PDF
- `fileName`: PDF filename
- `timestamp`: Server timestamp
- `deliveredTo`: ["web-client"]
- `readBy`: []

The orders will appear in your iOS app's online orders system automatically! 