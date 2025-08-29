#!/usr/bin/env node

/**
 * Debug script to test virtual database reading
 */

const Database = require('better-sqlite3');
const path = require('path');

const VIRTUAL_DB_PATH = path.join(process.cwd(), 'data', 'virtual-products.db');

function parseJson(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rowToProduct(row) {
  const product = {
    id: row.id,
    name: row.name || '',
    brand: row.brand || '',
    type: row.type || '',
    category: parseJson(row.category) || [],
    subCategory: parseJson(row.subCategory) || [],
    colors: parseJson(row.colors) || [],
    price1: parseFloat(row.price1) || 0,
    price2: parseFloat(row.price2) || 0,
    isProductStarred: row.isProductStarred === 1,
    stock: parseInt(row.stock) || 0,
    materials: row.materials || '',
    dimensions: row.dimensions || '',
    capacity: row.capacity || '',
    imageURL: parseJson(row.imageURL) || [],
    SKN: row.SKN || '',
    lastUpdated: row.lastUpdated || '',
    createdAt: row.createdAt || '',
    updatedAt: row.updatedAt || ''
  };

  return product;
}

async function debugVirtualDatabase() {
  console.log('🔍 Debugging Virtual Database Reading...\n');
  
  try {
    const db = new Database(VIRTUAL_DB_PATH);
    
    // Get a sample product
    const row = db.prepare("SELECT * FROM products WHERE name LIKE '%CANGURO%' LIMIT 1").get();
    
    if (row) {
      console.log('📋 Raw database row:');
      console.log('ID:', row.id);
      console.log('Name:', row.name);
      console.log('Raw imageURL:', row.imageURL);
      console.log('Type of imageURL:', typeof row.imageURL);
      
      // Parse the product
      const product = rowToProduct(row);
      
      console.log('\n📦 Parsed product:');
      console.log('ID:', product.id);
      console.log('Name:', product.name);
      console.log('imageURL:', product.imageURL);
      console.log('Type of imageURL:', typeof product.imageURL);
      console.log('Is Array:', Array.isArray(product.imageURL));
      console.log('Length:', product.imageURL?.length);
      
      // Test the transformation logic
      const images = Array.isArray(product.imageURL) ? product.imageURL : (product.imageURL ? [product.imageURL] : []);
      console.log('\n🖼️ Final images array:', images);
      
    } else {
      console.log('❌ No products found');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugVirtualDatabase();
