const fetch = require('node-fetch');

async function testAPIEndpoints() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing API endpoints...\n');
  
  // Test 1: Clear database (virtual)
  console.log('1. Testing clear database (virtual)...');
  try {
    const clearResponse = await fetch(`${baseUrl}/api/database/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'virtual' })
    });
    const clearResult = await clearResponse.json();
    console.log('✅ Clear result:', clearResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', clearResult.message);
  } catch (error) {
    console.log('❌ Clear test failed:', error.message);
  }
  
  // Test 2: Clear database (regular)
  console.log('\n2. Testing clear database (regular)...');
  try {
    const clearResponse2 = await fetch(`${baseUrl}/api/database/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'regular' })
    });
    const clearResult2 = await clearResponse2.json();
    console.log('✅ Clear result:', clearResult2.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', clearResult2.message);
  } catch (error) {
    console.log('❌ Clear test failed:', error.message);
  }
  
  // Test 3: Download product images (virtual)
  console.log('\n3. Testing download product images (virtual)...');
  try {
    const downloadResponse = await fetch(`${baseUrl}/api/download-product-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'virtual' })
    });
    const downloadResult = await downloadResponse.json();
    console.log('✅ Download result:', downloadResult.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', downloadResult.message);
  } catch (error) {
    console.log('❌ Download test failed:', error.message);
  }
  
  // Test 4: Download product images (regular)
  console.log('\n4. Testing download product images (regular)...');
  try {
    const downloadResponse2 = await fetch(`${baseUrl}/api/download-product-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'regular' })
    });
    const downloadResult2 = await downloadResponse2.json();
    console.log('✅ Download result:', downloadResult2.success ? 'SUCCESS' : 'FAILED');
    console.log('   Message:', downloadResult2.message);
  } catch (error) {
    console.log('❌ Download test failed:', error.message);
  }
  
  console.log('\n🎉 API endpoint tests completed!');
}

testAPIEndpoints().catch(console.error);
