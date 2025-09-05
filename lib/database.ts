import Database from 'better-sqlite3';
import path from 'path';
import { Product } from '../types';

// Database file paths - use Railway's persistent volume if available
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(process.cwd(), 'data');
const REGULAR_DB_PATH = path.join(DATA_DIR, 'products.db');
const VIRTUAL_DB_PATH = path.join(DATA_DIR, 'virtual-products.db');

// Initialize database instances
let regularDb: Database.Database | null = null;
let virtualDb: Database.Database | null = null;

// Function to reset database singletons
export function resetDatabaseSingletons(environment: 'regular' | 'virtual' = 'regular') {
  if (environment === 'virtual') {
    if (virtualDb) {
      try {
        virtualDb.close();
      } catch (error) {
        console.warn('Warning: Error closing virtual database:', error);
      }
      virtualDb = null;
      console.log(`🗑️ Reset virtual database singleton`);
    }
  } else {
    if (regularDb) {
      try {
        regularDb.close();
      } catch (error) {
        console.warn('Warning: Error closing regular database:', error);
      }
      regularDb = null;
      console.log(`🗑️ Reset regular database singleton`);
    }
  }
}

// Function to get a fresh database connection (forces reinitialization)
export function getFreshDatabase(environment: 'regular' | 'virtual' = 'regular') {
  resetDatabaseSingletons(environment);
  return initDatabase(environment);
}

export function initDatabase(environment: 'regular' | 'virtual' = 'regular'): Database.Database | null {
  if (typeof window !== 'undefined') {
    throw new Error('Database should only be initialized on the server side');
  }
  
  const dbPath = environment === 'virtual' ? VIRTUAL_DB_PATH : REGULAR_DB_PATH;
  console.log(`🗄️ Initializing ${environment} database at: ${dbPath}`);
  console.log(`📁 Data directory: ${DATA_DIR}`);
  console.log(`🔧 Railway volume mount path: ${process.env.RAILWAY_VOLUME_MOUNT_PATH || 'not set'}`);
  
  if (environment === 'virtual') {
    // Check if database is closed or corrupted and reinitialize if needed
    if (!virtualDb || !virtualDb.open) {
      if (virtualDb) {
        try {
          virtualDb.close();
        } catch (error) {
          console.warn('Warning: Error closing virtual database:', error);
        }
      }
      
      try {
        // Ensure data directory exists
        const fs = require('fs');
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        virtualDb = new Database(dbPath);
        createTables(virtualDb, 'virtual');
        console.log('✅ Virtual database initialized successfully');
        
        // Auto-sync if database is empty (only in production)
        if (process.env.NODE_ENV === 'production') {
          try {
            const count = virtualDb.prepare('SELECT COUNT(*) as count FROM products').get().count;
            if (count === 0) {
              console.log('🔄 Virtual database is empty, triggering auto-sync...');
              // Trigger sync asynchronously without blocking
              setTimeout(async () => {
                try {
                  const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3000';
                  const response = await fetch(`${baseUrl}/api/database/sync-airtable`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ context: 'virtual' })
                  });
                  if (response.ok) {
                    console.log('✅ Virtual database auto-sync completed');
                  } else {
                    console.log('⚠️ Virtual database auto-sync failed');
                  }
                } catch (error) {
                  console.log('⚠️ Virtual database auto-sync error:', error);
                }
              }, 5000); // Wait 5 seconds for server to be ready
            }
          } catch (error) {
            console.log('⚠️ Error checking virtual database count:', error);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing virtual database:', error);
        virtualDb = null;
        // Don't throw error in production to prevent app crash
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Continuing without virtual database in production');
          return null;
        }
        throw error;
      }
    }
    return virtualDb;
  } else {
    // Check if database is closed or corrupted and reinitialize if needed
    if (!regularDb || !regularDb.open) {
      if (regularDb) {
        try {
          regularDb.close();
        } catch (error) {
          console.warn('Warning: Error closing regular database:', error);
        }
      }
      
      try {
        // Ensure data directory exists
        const fs = require('fs');
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        
        regularDb = new Database(dbPath);
        createTables(regularDb, 'regular');
        console.log('✅ Regular database initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing regular database:', error);
        regularDb = null;
        // Don't throw error in production to prevent app crash
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Continuing without regular database in production');
          return null;
        }
        throw error;
      }
    }
    return regularDb;
  }
}

function createTables(db: Database.Database, environment: 'regular' | 'virtual' = 'regular') {
  // Create different schemas for regular and virtual environments
  let createProductsTable: string;
  
  if (environment === 'virtual') {
    // Virtual environment: Use 'price' field only, no price1/price2
    createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        type TEXT,
        category TEXT,
        subCategory TEXT,
        detail TEXT,
        colors TEXT,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        isProductStarred BOOLEAN DEFAULT 0,
        materials TEXT,
        dimensions TEXT,
        capacity TEXT,
        imageURL TEXT,
        SKU TEXT,
        checkMark TEXT,
        commercialName TEXT,
        distriPrice REAL,
        isProductStarredAirtable BOOLEAN DEFAULT 0,
        lastUpdated TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } else {
    // Regular environment: Use price1 and price2 fields
    createProductsTable = `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        type TEXT,
        category TEXT,
        subCategory TEXT,
        colors TEXT,
        price1 REAL NOT NULL,
        price2 REAL NOT NULL,
        isProductStarred BOOLEAN DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        stock INTEGER DEFAULT 0,
        materials TEXT,
        dimensions TEXT,
        capacity TEXT,
        imageURL TEXT,
        lastUpdated TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }
  
  const createWebPhotosTable = `
    CREATE TABLE IF NOT EXISTS webphotos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      imageUrl TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  const createCategorySubcategoryRelationsTable = `
    CREATE TABLE IF NOT EXISTS category_subcategory_relations (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      subcategory TEXT NOT NULL,
      isActive BOOLEAN DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, subcategory)
    )
  `;
  
  const createFcmTokensTable = `
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fcm_token TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      device_platform TEXT DEFAULT 'iOS',
      device_version TEXT,
      device_model TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const createBadgeCountsTable = `
    CREATE TABLE IF NOT EXISTS badge_counts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT UNIQUE NOT NULL,
      badge_count INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.exec(createProductsTable);
  db.exec(createWebPhotosTable);
  db.exec(createCategorySubcategoryRelationsTable);
  db.exec(createFcmTokensTable);
  db.exec(createBadgeCountsTable);
  
      // Database tables created successfully
}

// Product CRUD operations
export class ProductDatabase {
  private db: Database.Database;
  private environment: 'regular' | 'virtual';
  
  constructor(environment: 'regular' | 'virtual' = 'regular') {
    this.environment = environment;
    const db = initDatabase(environment);
    if (!db) {
      throw new Error(`Failed to initialize ${environment} database`);
    }
    this.db = db;
  }
  
  // Create a new product
  createProduct(product: Omit<Product, 'id'> & { id?: string }): Product {
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get ALL fields from the product - no more arbitrary limits!
    const allFields = Object.keys(product).filter(key => 
      key !== 'id' && 
      product[key as keyof typeof product] !== undefined && 
      product[key as keyof typeof product] !== null
    );
    
    // Ensure all columns exist before inserting
    allFields.forEach(key => {
      this.ensureColumnExists(key);
    });
    
    const placeholders = allFields.map(() => '?').join(', ');
    const values = allFields.map(field => {
      const fieldValue = product[field as keyof typeof product];
      
      // Handle special cases for SQLite compatibility
      if (field === 'colors' || field === 'type' || field === 'category' || field === 'subCategory') {
        // Convert arrays to JSON strings for storage
        return Array.isArray(fieldValue) ? JSON.stringify(fieldValue) : fieldValue;
      } else if (field === 'isProductStarred' || field === 'isProductStarredAirtable') {
        // Handle boolean fields
        return fieldValue === true || fieldValue === 1 || fieldValue === 'true' ? 1 : 0;
      } else if (this.environment === 'virtual' && field === 'price') {
        // Virtual environment: Handle 'price' field only
        return typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue)) || 0;
      } else if (this.environment === 'regular' && (field === 'price1' || field === 'price2')) {
        // Regular environment: Handle 'price1' and 'price2' fields
        return typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue)) || 0;
      } else if (field === 'quantity' || field === 'stock') {
        // Handle quantity and stock fields
        return typeof fieldValue === 'number' ? fieldValue : parseInt(String(fieldValue)) || 0;
      } else if (field === 'imageURL') {
        // Handle image URL fields
        return Array.isArray(fieldValue) ? JSON.stringify(fieldValue) : fieldValue;
      } else {
        // For all other fields, truncate if too long and use as is
        const stringValue = String(fieldValue || '');
        return stringValue.length > 1000 ? stringValue.substring(0, 1000) : fieldValue;
      }
    });
    
    const insertQuery = `
      INSERT INTO products (id, ${allFields.join(', ')}) 
      VALUES (?, ${placeholders})
    `;
    
    try {
      this.db.prepare(insertQuery).run(id, ...values);
      return this.getProduct(id)!;
    } catch (error) {
      console.error('Error creating product:', error);
      console.error('Product ID:', id);
      console.error('Fields count:', allFields.length);
      console.error('Fields:', allFields);
      console.error('All fields from product:', Object.keys(product));
      throw error;
    }
  }

  // Batch create products for better performance
  batchCreateProducts(products: (Omit<Product, 'id'> & { id?: string })[]): Product[] {
    if (products.length === 0) return [];
    
    const createdProducts: Product[] = [];
    
    const transaction = this.db.transaction(() => {
      for (const product of products) {
        try {
          const createdProduct = this.createProduct(product);
          createdProducts.push(createdProduct);
        } catch (error) {
          console.error('Error in batch create:', error);
          // Continue with other products even if one fails
        }
      }
    });
    
    transaction();
    return createdProducts;
  }
  
  // Get a single product by ID
  getProduct(id: string): Product | null {
    try {
      // Get all column names from the table
      const tableInfo = this.db.prepare("PRAGMA table_info(products)").all();
      const columns = tableInfo.map((col: any) => col.name);
      
      // Build dynamic SELECT statement
      const selectQuery = `SELECT ${columns.join(', ')} FROM products WHERE id = ?`;
      const row = this.db.prepare(selectQuery).get(id) as any;
      
      return row ? this.rowToProduct(row) : null;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }
  
  // Get all products
  getAllProducts(): Product[] {
    try {
      // Sort by brand then name for consistent ordering
      const rows = this.db.prepare("SELECT * FROM products ORDER BY brand, name").all();
      const products = rows.map((row: any) => {
        try {
          return this.rowToProduct(row);
        } catch (error) {
          console.error(`❌ Error converting row to product ${row?.id || 'unknown'}:`, error);
          return null;
        }
      }).filter(product => product !== null);
      return products;
    } catch (error) {
      console.error('Error getting all products:', error);
      return [];
    }
  }
  
  // Update a product
  updateProduct(id: string, updates: Partial<Product>): Product | null {
    const existing = this.getProduct(id);
    if (!existing) return null;
    
    // Build dynamic UPDATE statement
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    
    // Include ALL fields from updates - no more limits!
    const allFields = Object.keys(updates).filter(key => key !== 'id');
    
    for (const fieldName of allFields) {
      const fieldValue = updates[fieldName as keyof typeof updates];
      
      // Skip null/undefined values to avoid database corruption
      if (fieldValue === null || fieldValue === undefined) {
        continue;
      }
      
      // Ensure column exists for this field (preserve original case)
      this.ensureColumnExists(fieldName);
      
      let processedValue: any = fieldValue;
      
      // Handle special cases for SQLite compatibility
      if (fieldName === 'colors' || fieldName === 'type' || fieldName === 'category' || fieldName === 'subCategory') {
        // Convert arrays to JSON strings for storage
        processedValue = Array.isArray(fieldValue) ? JSON.stringify(fieldValue) : fieldValue;
      } else if (fieldName === 'isProductStarred' || fieldName === 'isProductStarredAirtable') {
        // Handle boolean fields
        processedValue = fieldValue === true || fieldValue === 1 || fieldValue === 'true' ? 1 : 0;
      } else if (fieldName === 'price') {
        // Handle price field
        processedValue = typeof fieldValue === 'number' ? fieldValue : parseFloat(String(fieldValue)) || 0;
      } else if (fieldName === 'stock') {
        // Handle stock field for virtual products
        processedValue = typeof fieldValue === 'number' ? fieldValue : parseInt(String(fieldValue)) || 0;
      } else if (typeof fieldValue === 'boolean') {
        // Persist generic boolean custom fields as 1/0
        processedValue = fieldValue ? 1 : 0;
      } else if (fieldName === 'imageURL') {
        // Handle image URL fields
        if (Array.isArray(fieldValue)) {
          // Filter out any invalid entries and ensure we have valid URLs
          const validImages = fieldValue.filter((img: any) => {
            if (typeof img === 'string') return img && img.trim().length > 0;
            if (typeof img === 'object' && img !== null) return (img as any).url && (img as any).url.trim().length > 0;
            return false;
          });
          processedValue = validImages.length > 0 ? JSON.stringify(validImages) : '[]';
        } else {
          processedValue = '[]'; // Default to empty array if not an array
        }
      } else {
        // For all other fields, truncate if too long and use as is
        const stringValue = String(fieldValue || '');
        processedValue = stringValue.length > 1000 ? stringValue.substring(0, 1000) : fieldValue;
      }
      
      // Add to update statement
      updateFields.push(`"${fieldName}" = ?`);
      updateValues.push(processedValue);
    }
    
    if (updateFields.length === 0) {
      return existing;
    }
    
    // Add updatedAt timestamp
    updateFields.push('"updatedAt" = ?');
    updateValues.push(new Date().toISOString());
    
    // Build and execute UPDATE statement
    const updateQuery = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);
    
    try {
      // Use a transaction to ensure data consistency
      const transaction = this.db.transaction(() => {
        this.db.prepare(updateQuery).run(...updateValues);
      });
      
      transaction();
      
      // Force database sync to ensure changes are written to disk
      this.sync();
      
      return this.getProduct(id);
    } catch (error) {
      console.error('Error updating product:', error);
      console.error('Product ID:', id);
      console.error('Fields count:', updateFields.length);
      console.error('Query:', updateQuery);
      return null;
    }
  }

  // Batch update products for better performance
  batchUpdateProducts(updates: { id: string; updates: Partial<Product> }[]): Product[] {
    if (updates.length === 0) return [];
    
    const updatedProducts: Product[] = [];
    
    const transaction = this.db.transaction(() => {
      for (const { id, updates: productUpdates } of updates) {
        try {
          const updatedProduct = this.updateProduct(id, productUpdates);
          if (updatedProduct) {
            updatedProducts.push(updatedProduct);
          }
        } catch (error) {
          console.error('Error in batch update:', error);
          // Continue with other products even if one fails
        }
      }
    });
    
    transaction();
    return updatedProducts;
  }
  
  // Force database sync to ensure all changes are written to disk
  public sync(): void {
    try {
      this.db.exec('PRAGMA wal_checkpoint(FULL)');
      this.db.exec('VACUUM');
    } catch (error) {
      console.warn('Warning: Could not sync database:', error);
    }
  }

  // Ensure a column exists in the products table
  public ensureColumnExists(columnName: string): void {
    try {
      // Check if column exists
      const tableInfo = this.db.prepare("PRAGMA table_info(products)").all();
      const columnExists = tableInfo.some((col: any) => col.name.toLowerCase() === columnName.toLowerCase());
      
      if (!columnExists) {
        // Add column dynamically
        const alterQuery = `ALTER TABLE products ADD COLUMN "${columnName}" TEXT`;
        this.db.prepare(alterQuery).run();
        // Reduced logging - only log if debugging is enabled
        if (process.env.DEBUG_DATABASE_COLUMNS === 'true') {
          console.log(`✅ Added dynamic column: ${columnName}`);
        }
      }
    } catch (error) {
      console.error(`Error ensuring column exists: ${columnName}`, error);
    }
  }

  // Ensure multiple columns exist in the products table (batch operation)
  public ensureColumnsExist(columnNames: string[]): void {
    try {
      // Check existing columns
      const tableInfo = this.db.prepare("PRAGMA table_info(products)").all();
      const existingColumns = new Set(tableInfo.map((col: any) => col.name.toLowerCase()));
      
      // Find columns that need to be added
      const columnsToAdd = columnNames.filter(colName => 
        !existingColumns.has(colName.toLowerCase())
      );
      
      if (columnsToAdd.length > 0) {
        // Reduced logging - only log if debugging is enabled
        if (process.env.DEBUG_DATABASE_COLUMNS === 'true') {
          console.log(`📋 Adding ${columnsToAdd.length} new columns:`, columnsToAdd);
        }
        
        // Add all missing columns in a single transaction
        const transaction = this.db.transaction(() => {
          for (const columnName of columnsToAdd) {
            const alterQuery = `ALTER TABLE products ADD COLUMN "${columnName}" TEXT`;
            this.db.prepare(alterQuery).run();
          }
        });
        
        transaction();
        // Reduced logging - only log if debugging is enabled
        if (process.env.DEBUG_DATABASE_COLUMNS === 'true') {
          console.log(`✅ Added ${columnsToAdd.length} dynamic columns in batch`);
        }
      } else {
        // Reduced logging - only log if debugging is enabled
        if (process.env.DEBUG_DATABASE_COLUMNS === 'true') {
          console.log(`✅ All ${columnNames.length} columns already exist`);
        }
      }
    } catch (error) {
      console.error(`Error ensuring columns exist:`, error);
    }
  }
  
  // Delete a product
  deleteProduct(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // Clear all products from database
  clearAllProducts(): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM products');
      const result = stmt.run();
      // Reduced logging - only log if debugging is enabled
      if (process.env.DEBUG_DATABASE_OPERATIONS === 'true') {
        console.log(`🗑️ Cleared ${result.changes} products from database`);
      }
      return true;
    } catch (error) {
      console.error('Error clearing products:', error);
      return false;
    }
  }

  // Reset database schema to default (removes all custom columns)
  resetDatabaseSchema(): boolean {
    try {
      // Drop the existing products table
      this.db.prepare('DROP TABLE IF EXISTS products').run();
      
      // Create different schemas for regular and virtual environments
      let createProductsTable: string;
      
      if (this.environment === 'virtual') {
        // Virtual environment: Use 'price' field only, no price1/price2
        createProductsTable = `
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            type TEXT,
            category TEXT,
            colors TEXT,
            price REAL NOT NULL,
            stock INTEGER DEFAULT 0,
            isProductStarred BOOLEAN DEFAULT 0,
            materials TEXT,
            dimensions TEXT,
            capacity TEXT,
            imageURL TEXT,
            lastUpdated TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log(`🗑️ Reset virtual database schema - using 'price' field only`);
      } else {
        // Regular environment: Use price1 and price2 fields
        createProductsTable = `
          CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            type TEXT,
            category TEXT,
            colors TEXT,
            price1 REAL NOT NULL,
            price2 REAL NOT NULL,
            isProductStarred BOOLEAN DEFAULT 0,
            quantity INTEGER DEFAULT 0,
            materials TEXT,
            dimensions TEXT,
            capacity TEXT,
            imageURL TEXT,
            lastUpdated TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `;
        console.log(`🗑️ Reset regular database schema - using 'price1' and 'price2' fields`);
      }
      
      this.db.exec(createProductsTable);
      console.log(`🗑️ Reset database schema to default for ${this.environment} environment`);
      return true;
    } catch (error) {
      console.error('Error resetting database schema:', error);
      return false;
    }
  }

  // Clear all products and reset schema
  clearAllProductsAndResetSchema(): boolean {
    try {
      const clearSuccess = this.clearAllProducts();
      const resetSuccess = this.resetDatabaseSchema();
      
      // Ensure the schema reset is applied by forcing a table recreation
      if (resetSuccess) {
        console.log(`🗑️ Schema reset completed successfully`);
      }
      
      return clearSuccess && resetSuccess;
    } catch (error) {
      console.error('Error clearing products and resetting schema:', error);
      return false;
    }
  }
  
  // Search products
  searchProducts(query: string): Product[] {
    const searchTerm = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM products 
      WHERE name LIKE ? OR brand LIKE ? OR type LIKE ? OR category LIKE ?
      ORDER BY name ASC
    `);
    const rows = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm);
    return rows.map(row => this.rowToProduct(row));
  }

  // Category-Subcategory Relations Methods
  createCategorySubcategoryRelation(relation: {
    id: string;
    category: string;
    subcategory: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
  }) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO category_subcategory_relations (id, category, subcategory, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      const result = stmt.run(
        relation.id,
        relation.category,
        relation.subcategory,
        relation.isActive ? 1 : 0,
        relation.createdAt || now,
        relation.updatedAt || now
      );
      
      if (result.changes > 0) {
        return this.getCategorySubcategoryRelation(relation.id);
      }
      return null;
    } catch (error) {
      console.error('Error creating category-subcategory relation:', error);
      return null;
    }
  }

  getCategorySubcategoryRelations() {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM category_subcategory_relations 
        ORDER BY category ASC, subcategory ASC
      `);
      const rows = stmt.all() as any[];
      return rows.map(row => ({
        id: row.id,
        category: row.category,
        subcategory: row.subcategory,
        isActive: row.isActive === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      console.error('Error getting category-subcategory relations:', error);
      return [];
    }
  }

  getCategorySubcategoryRelation(id: string) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM category_subcategory_relations WHERE id = ?
      `);
      const row = stmt.get(id) as any;
      
      if (row) {
        return {
          id: row.id,
          category: row.category,
          subcategory: row.subcategory,
          isActive: row.isActive === 1,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting category-subcategory relation:', error);
      return null;
    }
  }

  updateCategorySubcategoryRelation(id: string, updates: {
    category?: string;
    subcategory?: string;
    isActive?: boolean;
  }) {
    try {
      const currentRelation = this.getCategorySubcategoryRelation(id);
      if (!currentRelation) return null;

      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.category !== undefined) {
        updateFields.push('category = ?');
        values.push(updates.category);
      }
      if (updates.subcategory !== undefined) {
        updateFields.push('subcategory = ?');
        values.push(updates.subcategory);
      }
      if (updates.isActive !== undefined) {
        updateFields.push('isActive = ?');
        values.push(updates.isActive ? 1 : 0);
      }

      updateFields.push('updatedAt = ?');
      values.push(new Date().toISOString());
      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE category_subcategory_relations 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `);
      
      const result = stmt.run(...values);
      
      if (result.changes > 0) {
        return this.getCategorySubcategoryRelation(id);
      }
      return null;
    } catch (error) {
      console.error('Error updating category-subcategory relation:', error);
      return null;
    }
  }

  toggleCategorySubcategoryRelation(id: string) {
    try {
      const currentRelation = this.getCategorySubcategoryRelation(id);
      if (!currentRelation) return null;

      const newActiveState = !currentRelation.isActive;
      
      const stmt = this.db.prepare(`
        UPDATE category_subcategory_relations 
        SET isActive = ?, updatedAt = ?
        WHERE id = ?
      `);
      
      const result = stmt.run(
        newActiveState ? 1 : 0,
        new Date().toISOString(),
        id
      );
      
      if (result.changes > 0) {
        return this.getCategorySubcategoryRelation(id);
      }
      return null;
    } catch (error) {
      console.error('Error toggling category-subcategory relation:', error);
      return null;
    }
  }

  deleteCategorySubcategoryRelation(id: string): boolean {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM category_subcategory_relations WHERE id = ?
      `);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting category-subcategory relation:', error);
      return false;
    }
  }

  getActiveCategorySubcategoryRelations() {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM category_subcategory_relations 
        WHERE isActive = 1
        ORDER BY category ASC, subcategory ASC
      `);
      const rows = stmt.all() as any[];
      return rows.map(row => ({
        id: row.id,
        category: row.category,
        subcategory: row.subcategory,
        isActive: row.isActive === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }));
    } catch (error) {
      console.error('Error getting active category-subcategory relations:', error);
      return [];
    }
  }
  
  // Populate category-subcategory relations from products
  populateCategoryRelations(): number {
    try {
      console.log('🔄 Populating category-subcategory relations from products...');
      
      // Clear existing relations
      this.db.prepare('DELETE FROM category_subcategory_relations').run();
      console.log('🗑️ Cleared existing category relations');
      
      // Get all products
      const products = this.getAllProducts();
      console.log(`📊 Processing ${products.length} products for category relations`);
      
      const relations = new Set<string>();
      let createdCount = 0;
      
      products.forEach(product => {
        // Process categories
        if (product.category && Array.isArray(product.category)) {
          product.category.forEach(category => {
            if (category && typeof category === 'string') {
              const relationKey = `${category}|`;
              if (!relations.has(relationKey)) {
                relations.add(relationKey);
                const relationId = `cat_${category.replace(/\s+/g, '_').toLowerCase()}`;
                
                this.createCategorySubcategoryRelation({
                  id: relationId,
                  category: category,
                  subcategory: '',
                  isActive: true
                });
                createdCount++;
              }
            }
          });
        }
        
        // Process subcategories
        if (product.subCategory && Array.isArray(product.subCategory)) {
          product.subCategory.forEach(subcategory => {
            if (subcategory && typeof subcategory === 'string') {
              // Find the category for this subcategory (use first category if multiple)
              const category = product.category && Array.isArray(product.category) && product.category.length > 0 
                ? product.category[0] 
                : 'Sin Categoría';
              
              const relationKey = `${category}|${subcategory}`;
              if (!relations.has(relationKey)) {
                relations.add(relationKey);
                const relationId = `sub_${subcategory.replace(/\s+/g, '_').toLowerCase()}`;
                
                this.createCategorySubcategoryRelation({
                  id: relationId,
                  category: category,
                  subcategory: subcategory,
                  isActive: true
                });
                createdCount++;
              }
            }
          });
        }
      });
      
      console.log(`✅ Created ${createdCount} category-subcategory relations`);
      return createdCount;
    } catch (error) {
      console.error('❌ Error populating category relations:', error);
      return 0;
    }
  }
  
  // Get unique values for dropdowns
  getUniqueValues(field: 'brand' | 'type' | 'category'): string[] {
    const stmt = this.db.prepare(`SELECT DISTINCT ${field} FROM products WHERE ${field} IS NOT NULL AND ${field} != '' ORDER BY ${field}`);
    const rows = stmt.all() as any[];
    
    const uniqueValues = new Set<string>();
    
    rows.forEach(row => {
      const value = row[field];
      if (value) {
        // Check if it's a JSON array (multiple select)
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              // Add each value from the array
              parsed.forEach(item => uniqueValues.add(item));
            } else {
              uniqueValues.add(value);
            }
          } catch {
            // If parsing fails, treat as regular string
            uniqueValues.add(value);
          }
        } else {
          // Regular string value
          uniqueValues.add(value);
        }
      }
    });
    
    return Array.from(uniqueValues).sort();
  }
  
  // Convert database row to Product object
  private rowToProduct(row: any): Product {
    // Helper function to safely parse JSON
    const parseJson = (value: any): any => {
      if (!value || typeof value !== 'string') return value;
      if (value.trim() === '') return value; // Handle empty strings
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };
    
    // Debug: Check if row has required fields
    if (!row.id) {
      console.error(`❌ Row missing ID:`, row);
      throw new Error('Row missing ID');
    }

    // Helper function to safely convert boolean
    const parseBoolean = (value: any): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
      return false;
    };

    // Debug logging for subCategory
    if (row.id && row.name && row.name.includes('MORRAL AEROPUERTO')) {
          // Database rowToProduct - Raw row data logging removed
    }

    // Create a dynamic product object with environment-specific price handling
    const product: any = {
      id: row.id,
      name: row.name || '',
      brand: row.brand || '',
      type: row.type || '',
      category: parseJson(row.category) || [],
      subCategory: parseJson(row.subCategory) || [],
      colors: parseJson(row.colors) || [],
      isProductStarred: parseBoolean(row.isProductStarred),
      quantity: parseInt(row.quantity) || 0,
      stock: parseInt(row.stock) || 0,
      materials: row.materials || '',
      dimensions: row.dimensions || '',
      capacity: row.capacity || '',
      imageURL: (() => {
        const parsed = parseJson(row.imageURL);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        if (parsed && typeof parsed === 'string' && parsed.trim().length > 0) return [parsed];
        return [];
      })(),
      SKN: row.SKN || '',
      
      lastUpdated: row.lastUpdated || '',
      createdAt: row.createdAt || '',
      updatedAt: row.updatedAt || ''
    };

    // Handle price fields based on environment
    if (this.environment === 'virtual') {
      // Virtual environment uses 'price' field
      product.price = parseFloat(row.price) || 0;
      product.price1 = 0; // Set default for compatibility
      product.price2 = 0; // Set default for compatibility
    } else {
      // Regular environment uses 'price1' and 'price2' fields
      product.price1 = parseFloat(row.price1) || 0;
      product.price2 = parseFloat(row.price2) || 0;
      product.price = product.price1; // Set price to price1 for compatibility
    }

    // Debug logging for SKN
    // SKN logging removed for cleaner logs
    
    // Debug logging for price1 - removed for cleaner logs

    // Debug logging for parsed product - removed for cleaner logs

    // Add any additional dynamic columns
    Object.keys(row).forEach(key => {
      if (!product.hasOwnProperty(key)) {
        // Try to parse as JSON first, then use as string
        const value = parseJson(row[key]);
        product[key] = value;
      }
    });

    return product as Product;
  }
}

// WebPhotos CRUD operations
export class WebPhotosDatabase {
  private db: Database.Database;
  private environment: 'regular' | 'virtual';
  
  constructor(environment: 'regular' | 'virtual' = 'regular') {
    this.environment = environment;
    const db = initDatabase(environment);
    if (!db) {
      throw new Error(`Failed to initialize ${environment} database`);
    }
    this.db = db;
  }
  
  // Create or update a web photo
  upsertWebPhoto(name: string, imageUrl: string): boolean {
    const stmt = this.db.prepare(`
      INSERT INTO webphotos (name, imageUrl, updatedAt) 
      VALUES (?, ?, ?) 
      ON CONFLICT(name) DO UPDATE SET 
        imageUrl = excluded.imageUrl,
        updatedAt = excluded.updatedAt
    `);
    
    const result = stmt.run(name, imageUrl, new Date().toISOString());
    return result.changes > 0;
  }
  
  // Get all web photos as a map
  getAllWebPhotos(): Record<string, string> {
    try {
      const stmt = this.db.prepare('SELECT name, imageUrl FROM webphotos');
      const rows = stmt.all() as any[];
      
      const photos: Record<string, string> = {};
      rows.forEach(row => {
        photos[row.name] = row.imageUrl;
      });
      
      return photos;
    } catch (error) {
      console.error('❌ Error getting web photos:', error);
      throw error;
    }
  }
  
  // Delete a web photo
  deleteWebPhoto(name: string): boolean {
    const stmt = this.db.prepare('DELETE FROM webphotos WHERE name = ?');
    const result = stmt.run(name);
    return result.changes > 0;
  }
  
  // Clear all web photos from database
  clearAllWebPhotos(): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM webphotos');
      const result = stmt.run();
      console.log(`🗑️ Cleared ${result.changes} WebPhotos from database`);
      return true;
    } catch (error) {
      console.error('Error clearing WebPhotos:', error);
      return false;
    }
  }
}

// Export singleton instances
export const productDB = new ProductDatabase();
export const webPhotosDB = new WebPhotosDatabase(); 