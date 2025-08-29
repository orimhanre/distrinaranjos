import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';

// Virtual database instance
const virtualProductDB = new ProductDatabase('virtual');

// PATCH /api/database/virtual-category-relations/[id] - Update a relation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { toggle, isActive, category, subcategory } = await request.json();
    
    if (toggle) {
      // Toggle the active status
      const relation = virtualProductDB.toggleCategorySubcategoryRelation(id);
      
      if (!relation) {
        return NextResponse.json(
          { success: false, error: 'Relation not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        relation,
        message: 'Relation status toggled successfully'
      });
    } else {
      // Update specific fields
      const updates: any = {};
      if (isActive !== undefined) updates.isActive = isActive;
      if (category) updates.category = category;
      if (subcategory) updates.subcategory = subcategory;
      
      const relation = virtualProductDB.updateCategorySubcategoryRelation(id, updates);
      
      if (!relation) {
        return NextResponse.json(
          { success: false, error: 'Relation not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        relation,
        message: 'Relation updated successfully'
      });
    }
  } catch (error) {
    console.error('Error updating category relation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update category relation' },
      { status: 500 }
    );
  }
}

// DELETE /api/database/virtual-category-relations/[id] - Delete a relation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const success = virtualProductDB.deleteCategorySubcategoryRelation(id);
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Relation not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Relation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting category relation:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete category relation' },
      { status: 500 }
    );
  }
} 