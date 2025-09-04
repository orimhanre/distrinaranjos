#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initDatabase } = require('../lib/database');

// Backup database to a JSON file
function backupDatabase(environment = 'regular') {
  try {
    const db = initDatabase(environment);
    if (!db) {
      console.log(`⚠️ ${environment} database not available for backup`);
      return false;
    }
    
    const products = db.prepare('SELECT * FROM products').all();
    const webPhotos = db.prepare('SELECT * FROM webphotos').all();
    const categoryRelations = db.prepare('SELECT * FROM category_subcategory_relations').all();
    
    const backup = {
      timestamp: new Date().toISOString(),
      environment,
      products,
      webPhotos,
      categoryRelations
    };
    
    const backupPath = path.join(process.cwd(), 'data', `${environment}-backup.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✅ ${environment} database backed up: ${products.length} products, ${webPhotos.length} web photos`);
    return true;
  } catch (error) {
    console.error(`❌ Backup failed for ${environment}:`, error.message);
    return false;
  }
}

// Restore database from JSON backup
function restoreDatabase(environment = 'regular') {
  try {
    const backupPath = path.join(process.cwd(), 'data', `${environment}-backup.json`);
    
    if (!fs.existsSync(backupPath)) {
      console.log(`⚠️ No backup found for ${environment} database`);
      return false;
    }
    
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const db = initDatabase(environment);
    
    if (!db) {
      console.log(`⚠️ ${environment} database not available for restore`);
      return false;
    }
    
    // Clear existing data
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM webphotos').run();
    db.prepare('DELETE FROM category_subcategory_relations').run();
    
    // Restore products
    if (backup.products && backup.products.length > 0) {
      const insertProduct = db.prepare(`
        INSERT INTO products (id, name, brand, type, category, subCategory, colors, price, stock, isProductStarred, materials, dimensions, capacity, imageURL, SKU, checkMark, commercialName, distriPrice, isProductStarredAirtable, lastUpdated, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      backup.products.forEach(product => {
        insertProduct.run(
          product.id, product.name, product.brand, product.type, product.category,
          product.subCategory, product.colors, product.price, product.stock,
          product.isProductStarred, product.materials, product.dimensions, product.capacity,
          product.imageURL, product.SKU, product.checkMark, product.commercialName,
          product.distriPrice, product.isProductStarredAirtable, product.lastUpdated,
          product.createdAt, product.updatedAt
        );
      });
    }
    
    // Restore web photos
    if (backup.webPhotos && backup.webPhotos.length > 0) {
      const insertWebPhoto = db.prepare(`
        INSERT INTO webphotos (name, imageUrl, createdAt, updatedAt)
        VALUES (?, ?, ?, ?)
      `);
      
      backup.webPhotos.forEach(photo => {
        insertWebPhoto.run(photo.name, photo.imageUrl, photo.createdAt, photo.updatedAt);
      });
    }
    
    // Restore category relations
    if (backup.categoryRelations && backup.categoryRelations.length > 0) {
      const insertRelation = db.prepare(`
        INSERT INTO category_subcategory_relations (id, category, subcategory, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      backup.categoryRelations.forEach(relation => {
        insertRelation.run(relation.id, relation.category, relation.subcategory, relation.isActive, relation.createdAt, relation.updatedAt);
      });
    }
    
    console.log(`✅ ${environment} database restored: ${backup.products?.length || 0} products, ${backup.webPhotos?.length || 0} web photos`);
    return true;
  } catch (error) {
    console.error(`❌ Restore failed for ${environment}:`, error.message);
    return false;
  }
}

// Auto-backup before deployment
function autoBackup() {
  console.log('🔄 Creating auto-backup...');
  const regularBackup = backupDatabase('regular');
  const virtualBackup = backupDatabase('virtual');
  
  if (regularBackup && virtualBackup) {
    console.log('✅ Auto-backup completed successfully');
  } else {
    console.log('⚠️ Auto-backup completed with some issues');
  }
}

// Auto-restore after deployment
function autoRestore() {
  console.log('🔄 Checking for auto-restore...');
  const regularRestore = restoreDatabase('regular');
  const virtualRestore = restoreDatabase('virtual');
  
  if (regularRestore || virtualRestore) {
    console.log('✅ Auto-restore completed');
  } else {
    console.log('⚠️ No backups found for auto-restore');
  }
}

// Run if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'backup':
      autoBackup();
      break;
    case 'restore':
      autoRestore();
      break;
    default:
      console.log('Usage: node backup-restore.js [backup|restore]');
  }
}

module.exports = { backupDatabase, restoreDatabase, autoBackup, autoRestore };
