import { Pool } from 'pg';

// PostgreSQL connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

export { pool };

// Initialize PostgreSQL database
export async function initPostgresDatabase() {
  try {
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
      
      console.log('✅ PostgreSQL database initialized successfully');
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ PostgreSQL database initialization failed:', error);
    throw error;
  }
}

// Check if PostgreSQL is available
export async function isPostgresAvailable(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.warn('⚠️ PostgreSQL not available:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}
