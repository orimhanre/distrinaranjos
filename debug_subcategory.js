const Database = require('better-sqlite3');
const path = require('path');

// Database file path
const VIRTUAL_DB_PATH = path.join(process.cwd(), 'data', 'virtual-products.db');

console.log('🔍 Debugging subCategory field in virtual database...');
console.log('📁 Database path:', VIRTUAL_DB_PATH);

try {
  // Open the virtual database
  const db = new Database(VIRTUAL_DB_PATH);
  
  // Check table schema
  console.log('\n📋 Table schema:');
  const tableInfo = db.prepare("PRAGMA table_info(products)").all();
  tableInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  // Check if subCategory column exists
  const subCategoryColumn = tableInfo.find(col => 
    col.name.toLowerCase() === 'subcategory' || 
    col.name === 'subCategory'
  );
  
  if (subCategoryColumn) {
    console.log(`\n✅ Found subCategory column: ${subCategoryColumn.name}`);
  } else {
    console.log('\n❌ subCategory column not found in schema');
  }
  
  // Get a few sample products
  console.log('\n📊 Sample products:');
  const products = db.prepare("SELECT id, name, subCategory, subcategory FROM products LIMIT 5").all();
  
  products.forEach((product, index) => {
    console.log(`\nProduct ${index + 1}:`);
    console.log(`  ID: ${product.id}`);
    console.log(`  Name: ${product.name}`);
    console.log(`  subCategory: ${product.subCategory}`);
    console.log(`  subcategory: ${product.subcategory}`);
  });
  
  // Check all column names in the first product
  console.log('\n🔍 All columns in first product:');
  const firstProduct = db.prepare("SELECT * FROM products LIMIT 1").get();
  if (firstProduct) {
    Object.keys(firstProduct).forEach(key => {
      console.log(`  - ${key}: ${firstProduct[key]}`);
    });
  }
  
  db.close();
  
} catch (error) {
  console.error('❌ Error:', error);
}
