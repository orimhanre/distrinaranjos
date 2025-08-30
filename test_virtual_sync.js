const { AirtableService } = require('./lib/airtable');
const { ProductDatabase } = require('./lib/database');

async function testVirtualSync() {
  console.log('🧪 Testing Virtual Sync...');
  
  try {
    // Test environment switching
    console.log('🔍 Testing environment switching...');
    AirtableService.switchEnvironmentFromContext('virtual');
    console.log('✅ Current environment:', AirtableService.getCurrentEnvironment());
    
    // Test Airtable connection
    console.log('🔍 Testing Airtable connection...');
    const isConnected = await AirtableService.testConnection();
    console.log('✅ Airtable connection:', isConnected);
    
    if (!isConnected) {
      console.log('❌ Cannot connect to Airtable');
      return;
    }
    
    // Fetch records
    console.log('🔍 Fetching records from Airtable...');
    const records = await AirtableService.fetchAllRecords();
    console.log(`✅ Fetched ${records.length} records from Airtable`);
    
    if (records.length === 0) {
      console.log('❌ No records found in Airtable');
      return;
    }
    
    // Test conversion of first record
    console.log('🔍 Testing record conversion...');
    const firstRecord = records[0];
    console.log('🔍 First record fields:', Object.keys(firstRecord.fields));
    console.log('🔍 First record data:', {
      id: firstRecord.id,
      name: firstRecord.fields.Name,
      brand: firstRecord.fields.Brand,
      price: firstRecord.fields.Price || firstRecord.fields.price
    });
    
    const converted = AirtableService.convertAirtableToProduct(firstRecord);
    console.log('✅ Converted product:', {
      id: converted.id,
      name: converted.name,
      brand: converted.brand,
      price: converted.price,
      stock: converted.stock
    });
    
    // Test database operations
    console.log('🔍 Testing database operations...');
    const productDB = new ProductDatabase('virtual');
    
    // Get existing products
    const existingProducts = productDB.getAllProducts();
    console.log(`✅ Found ${existingProducts.length} existing products in database`);
    
    // Test creating a product
    console.log('🔍 Testing product creation...');
    try {
      const testProduct = productDB.createProduct(converted);
      console.log('✅ Successfully created test product:', testProduct.id);
      
      // Clean up - delete the test product
      productDB.deleteProduct(testProduct.id);
      console.log('✅ Cleaned up test product');
    } catch (error) {
      console.error('❌ Failed to create test product:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testVirtualSync();
