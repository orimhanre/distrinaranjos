import { NextRequest, NextResponse } from 'next/server';
import { initDatabase } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';

// GET /api/database/virtual-category-relations - Get all relations
export async function GET() {
  try {
    // API: /api/database/virtual-category-relations called
    
    const db = initDatabase('virtual');
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 }
      );
    }
    
    const stmt = db.prepare(`
      SELECT * FROM category_subcategory_relations 
      ORDER BY category ASC, subcategory ASC
    `);
    const relations = stmt.all() as any[];
    
    return NextResponse.json({
      success: true,
      relations,
      count: relations.length
    });
  } catch (error) {
    console.error('API Error fetching category relations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch category relations', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/database/virtual-category-relations - Create a new relation
export async function POST(request: NextRequest) {
  try {
    const { category, subcategory, isActive = true } = await request.json();
    
    if (!category || !subcategory) {
      return NextResponse.json(
        { success: false, error: 'Category and subcategory are required' },
        { status: 400 }
      );
    }
    
    const db = initDatabase('virtual');
    if (!db) {
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 }
      );
    }
    
    const stmt = db.prepare(`
      INSERT INTO category_subcategory_relations (id, category, subcategory, isActive, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const id = uuidv4();
    const now = new Date().toISOString();
    stmt.run(id, category, subcategory, isActive ? 1 : 0, now, now);
    
    const newRelation = {
      id,
      category,
      subcategory,
      isActive,
      createdAt: now,
      updatedAt: now
    };
    
    return NextResponse.json({
      success: true,
      relation: newRelation,
      message: 'Category-subcategory relation created successfully'
    });
  } catch (error) {
    console.error('Error creating category relation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create category relation' },
      { status: 500 }
    );
  }
} 