const { AirtableService } = require('./lib/airtable');

async function testAirtableSync() {
  console.log('🧪 Testing Airtable sync...');
  
  try {
    // Test connection
    const isConnected = await AirtableService.testConnection();
    console.log('✅ Connection test:', isConnected);
    
    if (!isConnected) {
      console.log('❌ Cannot connect to Airtable');
      return;
    }
    
    // Get table schema
    const schema = await AirtableService.getTableSchema();
    console.log('📋 Table schema:', schema);
    
    // Fetch a few records to see the data structure
    const records = await AirtableService.fetchAllRecords();
    console.log(`📦 Fetched ${records.length} records`);
    
    if (records.length > 0) {
      const firstRecord = records[0];
      console.log('🔍 First record fields:', Object.keys(firstRecord.fields));
      console.log('🔍 First record data:', firstRecord.fields);
      
      // Test conversion
      const converted = AirtableService.convertAirtableToProduct(firstRecord);
      console.log('🔄 Converted product:', converted);
      console.log('🖼️ ImageURL after conversion:', converted.imageURL);
      console.log('📦 Stock after conversion:', converted.stock);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testAirtableSync();
