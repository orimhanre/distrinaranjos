import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const COLUMNS_PATH = path.resolve(process.cwd(), 'data/virtual-columns.json');
const VIRTUAL_DB_PATH = path.resolve(process.cwd(), 'data/virtual-products.db');

export async function GET() {
  try {
    // First try to load columns from the JSON file (updated by sync)
    if (fs.existsSync(COLUMNS_PATH)) {
      try {
        const columnsData = JSON.parse(fs.readFileSync(COLUMNS_PATH, 'utf8'));
        console.log(`📋 Loaded ${columnsData.length} columns from virtual-columns.json`);
        console.log(`📋 Column file path: ${COLUMNS_PATH}`);
        console.log(`📋 Columns:`, columnsData.map((c: any) => c.key));
        return NextResponse.json({ success: true, columns: columnsData });
      } catch (e) {
        console.error('Error reading virtual-columns.json:', e);
      }
    }

    // If JSON file doesn't exist, read dynamically from database schema
    console.log(`📋 JSON file not found, reading columns from virtual database schema`);
    
    // Check if database exists and has data
    if (!fs.existsSync(VIRTUAL_DB_PATH)) {
      console.log(`📋 Virtual database doesn't exist, returning empty columns`);
      return NextResponse.json({ success: true, columns: [] });
    }

    // Read columns from database schema
    const db = new Database(VIRTUAL_DB_PATH);
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    
    // Check if there are any products in the database
    const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    db.close();

    if (tableInfo.length === 0) {
      console.log(`📋 No products table found in virtual database, returning empty columns`);
      return NextResponse.json({ success: true, columns: [] });
    }

    // If database is empty (no products), return empty columns
    if (productCount.count === 0) {
      console.log(`📋 Virtual database is empty (0 products), returning empty columns`);
      return NextResponse.json({ success: true, columns: [] });
    }

    // Convert database schema to column format
    const columns = tableInfo
      .filter((col: any) => !['createdAt', 'updatedAt', 'lastUpdated'].includes(col.name)) // Exclude internal columns
      .map((col: any) => {
        // Determine column type based on field name or content
        let columnType: 'text' | 'number' | 'boolean' | 'select' | 'multipleSelect' | 'attachment' = 'text';
        
        // Check for specific field types
        if (col.name.toLowerCase().includes('price') || col.name.toLowerCase().includes('stock') || col.name.toLowerCase().includes('amount')) {
          columnType = 'number';
        } else if (col.name.toLowerCase().includes('image') || col.name.toLowerCase().includes('photo') || col.name.toLowerCase().includes('url')) {
          columnType = 'attachment';
        } else if (col.name.toLowerCase().includes('color') || col.name.toLowerCase().includes('type')) {
          columnType = 'multipleSelect';
        } else if (col.name.toLowerCase().includes('starred') || col.name.toLowerCase().includes('active')) {
          columnType = 'boolean';
        }
        
        return {
          key: col.name,
          label: col.name,
          type: columnType,
          required: false,
          sortable: true,
          filterable: true
        };
      });
    
    console.log(`📋 Read ${columns.length} columns from virtual database schema`);
    return NextResponse.json({ success: true, columns });
  } catch (e: any) {
    console.error('Error fetching virtual columns:', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    fs.writeFileSync(COLUMNS_PATH, JSON.stringify(body.columns, null, 2));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
} 