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
        // Columns loaded successfully
        return NextResponse.json({ success: true, columns: columnsData });
      } catch (e) {
        console.error('Error reading virtual-columns.json:', e);
      }
    }

    // If JSON file doesn't exist, read dynamically from database schema
    
    // Check if database exists and has data
    if (!fs.existsSync(VIRTUAL_DB_PATH)) {
      return NextResponse.json({ success: true, columns: [] });
    }

    // Read columns from database schema
    const db = new Database(VIRTUAL_DB_PATH);
    const tableInfo = db.prepare("PRAGMA table_info(products)").all();
    
    // Check if there are any products in the database
    const productCount = db.prepare("SELECT COUNT(*) as count FROM products").get() as any;
    db.close();

    if (tableInfo.length === 0) {
      return NextResponse.json({ success: true, columns: [] });
    }

    // If database is empty (no products), return empty columns
    if (productCount.count === 0) {
      return NextResponse.json({ success: true, columns: [] });
    }

    // Convert database schema to column format - but preserve actual field types if available
    const columns = tableInfo
      .filter((col: any) => !['createdAt', 'updatedAt', 'lastUpdated'].includes(col.name)) // Exclude internal columns
      .map((col: any) => {
        // Try to preserve the actual field type from Airtable if available
        // If not available, fall back to intelligent type inference
        let columnType: string = 'text'; // Default to text
        
        // Check if we have type information from the database or if we can infer it
        if (col.type && col.type !== 'TEXT') {
          // Database has specific type info
          if (col.type.includes('INT') || col.type.includes('REAL')) {
            columnType = 'number';
          } else if (col.type.includes('BOOL')) {
            columnType = 'boolean';
          } else {
            columnType = 'text';
          }
        } else {
          // Fall back to intelligent inference based on field name and content
          if (col.name.toLowerCase().includes('price') || col.name.toLowerCase().includes('stock') || col.name.toLowerCase().includes('amount') || col.name.toLowerCase().includes('quantity')) {
            columnType = 'number';
          } else if (col.name.toLowerCase().includes('image') || col.name.toLowerCase().includes('photo') || col.name.toLowerCase().includes('url') || col.name.toLowerCase().includes('attachment')) {
            columnType = 'attachment';
          } else if (col.name.toLowerCase().includes('color') || col.name.toLowerCase().includes('type') || col.name.toLowerCase().includes('category') || col.name.toLowerCase().includes('brand')) {
            columnType = 'select';
          } else if (col.name.toLowerCase().includes('starred') || col.name.toLowerCase().includes('active') || col.name.toLowerCase().includes('enabled')) {
            columnType = 'boolean';
          } else if (col.name.toLowerCase().includes('detail') || col.name.toLowerCase().includes('description') || col.name.toLowerCase().includes('notes')) {
            columnType = 'longText';
          } else if (col.name.toLowerCase().includes('email')) {
            columnType = 'email';
          } else if (col.name.toLowerCase().includes('phone') || col.name.toLowerCase().includes('telephone')) {
            columnType = 'phone';
          } else if (col.name.toLowerCase().includes('date') || col.name.toLowerCase().includes('created') || col.name.toLowerCase().includes('updated')) {
            columnType = 'date';
          }
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
    
    console.log(`📋 Read ${columns.length} columns from virtual database schema with inferred types`);
    console.log(`📋 Inferred column types:`, columns.map((c: any) => ({ key: c.key, type: c.type, label: c.label })));
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
    console.log(`📋 Updated virtual-columns.json with ${body.columns.length} columns`);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
} 