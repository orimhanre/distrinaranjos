const Database = require('better-sqlite3');
const path = require('path');

const VIRTUAL_DB_PATH = path.join(process.cwd(), 'data', 'virtual-products.db');

console.log('🧪 Testing Virtual Database Operations...');
console.log('📁 Database path:', VIRTUAL_DB_PATH);

try {
  // Check if database file exists
  const fs = require('fs');
  if (!fs.existsSync(VIRTUAL_DB_PATH)) {
    console.log('❌ Database file does not exist');
    process.exit(1);
  }
  
  console.log('✅ Database file exists');
  
  // Open database
  const db = new Database(VIRTUAL_DB_PATH);
  console.log('✅ Database opened successfully');
  
  // Check if products table exists
  const tableInfo = db.prepare("PRAGMA table_info(products)").all();
  console.log('📋 Products table info:', tableInfo.length, 'columns');
  
  // Check current product count
  const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get();
  console.log('📦 Current product count:', productCount.count);
  
  // Try to insert a test product
  console.log('🔍 Testing product insertion...');
  const testProduct = {
    id: 'test_product_' + Date.now(),
    name: 'Test Product',
    brand: 'Test Brand',
    price: 100,
    stock: 50
  };
  
  const insertQuery = `
    INSERT INTO products (id, name, brand, price, stock) 
    VALUES (?, ?, ?, ?, ?)
  `;
  
  try {
    db.prepare(insertQuery).run(
      testProduct.id,
      testProduct.name,
      testProduct.brand,
      testProduct.price,
      testProduct.stock
    );
    console.log('✅ Test product inserted successfully');
    
    // Check if product was actually saved
    const savedProduct = db.prepare("SELECT * FROM products WHERE id = ?").get(testProduct.id);
    if (savedProduct) {
      console.log('✅ Test product found in database:', savedProduct);
    } else {
      console.log('❌ Test product not found in database after insertion');
    }
    
    // Clean up - delete test product
    db.prepare("DELETE FROM products WHERE id = ?").run(testProduct.id);
    console.log('✅ Test product cleaned up');
    
  } catch (insertError) {
    console.error('❌ Error inserting test product:', insertError);
  }
  
  // Check final product count
  const finalCount = db.prepare("SELECT COUNT(*) as count FROM products").get();
  console.log('📦 Final product count:', finalCount.count);
  
  db.close();
  console.log('✅ Database closed successfully');
  
} catch (error) {
  console.error('❌ Database test failed:', error);
}
