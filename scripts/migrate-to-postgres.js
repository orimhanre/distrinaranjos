#!/usr/bin/env node

const { Pool } = require('pg');
const { initDatabase } = require('../lib/database');

// PostgreSQL connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function createTables() {
  const client = await pool.connect();
  
  try {
    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        type TEXT,
        category TEXT,
        subCategory TEXT,
        detail TEXT,
        colors TEXT,
        price REAL,
        price1 REAL,
        price2 REAL,
        stock INTEGER DEFAULT 0,
        isProductStarred BOOLEAN DEFAULT false,
        quantity INTEGER DEFAULT 0,
        materials TEXT,
        dimensions TEXT,
        capacity TEXT,
        imageURL TEXT,
        SKU TEXT,
        checkMark TEXT,
        commercialName TEXT,
        distriPrice REAL,
        isProductStarredAirtable BOOLEAN DEFAULT false,
        lastUpdated TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create webphotos table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webphotos (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        imageUrl TEXT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create category_subcategory_relations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS category_subcategory_relations (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        subcategory TEXT NOT NULL,
        isActive BOOLEAN DEFAULT true,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, subcategory)
      )
    `);
    
    // Create fcm_tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS fcm_tokens (
        id SERIAL PRIMARY KEY,
        fcm_token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        device_platform TEXT DEFAULT 'iOS',
        device_version TEXT,
        device_model TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create badge_counts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS badge_counts (
        id SERIAL PRIMARY KEY,
        user_email TEXT UNIQUE NOT NULL,
        badge_count INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ PostgreSQL tables created successfully');
    
  } finally {
    client.release();
  }
}

async function migrateData() {
  console.log('🔄 Starting migration from SQLite to PostgreSQL...');
  
  try {
    // Create tables first
    await createTables();
    
    // Migrate regular products
    const regularDb = initDatabase('regular');
    if (regularDb) {
      const products = regularDb.prepare('SELECT * FROM products').all();
      console.log(`📊 Found ${products.length} regular products to migrate`);
      
      if (products.length > 0) {
        const client = await pool.connect();
        try {
          for (const product of products) {
            await client.query(`
              INSERT INTO products (
                id, name, brand, type, category, subCategory, detail, colors,
                price, price1, price2, stock, isProductStarred, quantity,
                materials, dimensions, capacity, imageURL, SKU, checkMark,
                commercialName, distriPrice, isProductStarredAirtable,
                lastUpdated, createdAt, updatedAt
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                brand = EXCLUDED.brand,
                type = EXCLUDED.type,
                category = EXCLUDED.category,
                subCategory = EXCLUDED.subCategory,
                detail = EXCLUDED.detail,
                colors = EXCLUDED.colors,
                price = EXCLUDED.price,
                price1 = EXCLUDED.price1,
                price2 = EXCLUDED.price2,
                stock = EXCLUDED.stock,
                isProductStarred = EXCLUDED.isProductStarred,
                quantity = EXCLUDED.quantity,
                materials = EXCLUDED.materials,
                dimensions = EXCLUDED.dimensions,
                capacity = EXCLUDED.capacity,
                imageURL = EXCLUDED.imageURL,
                SKU = EXCLUDED.SKU,
                checkMark = EXCLUDED.checkMark,
                commercialName = EXCLUDED.commercialName,
                distriPrice = EXCLUDED.distriPrice,
                isProductStarredAirtable = EXCLUDED.isProductStarredAirtable,
                lastUpdated = EXCLUDED.lastUpdated,
                updatedAt = CURRENT_TIMESTAMP
            `, [
              product.id, product.name, product.brand, product.type, product.category,
              product.subCategory, product.detail, product.colors, product.price,
              product.price1, product.price2, product.stock, product.isProductStarred,
              product.quantity, product.materials, product.dimensions, product.capacity,
              product.imageURL, product.SKU, product.checkMark, product.commercialName,
              product.distriPrice, product.isProductStarredAirtable, product.lastUpdated,
              product.createdAt, product.updatedAt
            ]);
          }
          console.log('✅ Regular products migrated successfully');
        } finally {
          client.release();
        }
      }
    }
    
    // Migrate virtual products (if different from regular)
    const virtualDb = initDatabase('virtual');
    if (virtualDb) {
      const virtualProducts = virtualDb.prepare('SELECT * FROM products').all();
      console.log(`📊 Found ${virtualProducts.length} virtual products to migrate`);
      
      if (virtualProducts.length > 0) {
        const client = await pool.connect();
        try {
          for (const product of virtualProducts) {
            await client.query(`
              INSERT INTO products (
                id, name, brand, type, category, subCategory, detail, colors,
                price, stock, isProductStarred, materials, dimensions, capacity,
                imageURL, SKU, checkMark, commercialName, distriPrice,
                isProductStarredAirtable, lastUpdated, createdAt, updatedAt
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                brand = EXCLUDED.brand,
                type = EXCLUDED.type,
                category = EXCLUDED.category,
                subCategory = EXCLUDED.subCategory,
                detail = EXCLUDED.detail,
                colors = EXCLUDED.colors,
                price = EXCLUDED.price,
                stock = EXCLUDED.stock,
                isProductStarred = EXCLUDED.isProductStarred,
                materials = EXCLUDED.materials,
                dimensions = EXCLUDED.dimensions,
                capacity = EXCLUDED.capacity,
                imageURL = EXCLUDED.imageURL,
                SKU = EXCLUDED.SKU,
                checkMark = EXCLUDED.checkMark,
                commercialName = EXCLUDED.commercialName,
                distriPrice = EXCLUDED.distriPrice,
                isProductStarredAirtable = EXCLUDED.isProductStarredAirtable,
                lastUpdated = EXCLUDED.lastUpdated,
                updatedAt = CURRENT_TIMESTAMP
            `, [
              product.id, product.name, product.brand, product.type, product.category,
              product.subCategory, product.detail, product.colors, product.price,
              product.stock, product.isProductStarred, product.materials, product.dimensions,
              product.capacity, product.imageURL, product.SKU, product.checkMark,
              product.commercialName, product.distriPrice, product.isProductStarredAirtable,
              product.lastUpdated, product.createdAt, product.updatedAt
            ]);
          }
          console.log('✅ Virtual products migrated successfully');
        } finally {
          client.release();
        }
      }
    }
    
    // Migrate web photos
    if (regularDb) {
      const webPhotos = regularDb.prepare('SELECT * FROM webphotos').all();
      console.log(`📸 Found ${webPhotos.length} web photos to migrate`);
      
      if (webPhotos.length > 0) {
        const client = await pool.connect();
        try {
          for (const photo of webPhotos) {
            await client.query(`
              INSERT INTO webphotos (name, imageUrl, createdAt, updatedAt)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (name) DO UPDATE SET
                imageUrl = EXCLUDED.imageUrl,
                updatedAt = CURRENT_TIMESTAMP
            `, [photo.name, photo.imageUrl, photo.createdAt, photo.updatedAt]);
          }
          console.log('✅ Web photos migrated successfully');
        } finally {
          client.release();
        }
      }
    }
    
    // Migrate category relations
    if (regularDb) {
      const relations = regularDb.prepare('SELECT * FROM category_subcategory_relations').all();
      console.log(`🔗 Found ${relations.length} category relations to migrate`);
      
      if (relations.length > 0) {
        const client = await pool.connect();
        try {
          for (const relation of relations) {
            await client.query(`
              INSERT INTO category_subcategory_relations (id, category, subcategory, isActive, createdAt, updatedAt)
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (id) DO UPDATE SET
                category = EXCLUDED.category,
                subcategory = EXCLUDED.subcategory,
                isActive = EXCLUDED.isActive,
                updatedAt = CURRENT_TIMESTAMP
            `, [relation.id, relation.category, relation.subcategory, relation.isActive, relation.createdAt, relation.updatedAt]);
          }
          console.log('✅ Category relations migrated successfully');
        } finally {
          client.release();
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  migrateData().catch(console.error);
}

module.exports = { migrateData, createTables };
