const { VirtualPhotoDownloader } = require('./lib/virtualPhotoDownloader');

async function testVirtualPhotoDownloader() {
  console.log('🧪 Testing Virtual Photo Downloader...');
  
  // Test WebPhotos download
  const testWebPhotos = {
    'logo_massnu': 'https://dl.airtable.com/.attachments/test123/logo_massnu.png',
    'logo_reno': 'https://dl.airtable.com/.attachments/test456/logo_reno.jpg'
  };
  
  try {
    console.log('📸 Testing WebPhotos download...');
    const result = await VirtualPhotoDownloader.downloadWebPhotos(testWebPhotos);
    console.log('✅ WebPhotos test result:', result);
  } catch (error) {
    console.error('❌ WebPhotos test failed:', error);
  }
  
  // Test product images download
  const testProductImages = [
    'https://dl.airtable.com/.attachments/test789/product1.jpg',
    'https://dl.airtable.com/.attachments/test101/product2.png'
  ];
  
  try {
    console.log('📸 Testing product images download...');
    const result = await VirtualPhotoDownloader.downloadProductImages(testProductImages);
    console.log('✅ Product images test result:', result);
  } catch (error) {
    console.error('❌ Product images test failed:', error);
  }
}

testVirtualPhotoDownloader();
