import { NextRequest, NextResponse } from 'next/server';
import { ProductDatabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    console.log('📊 Fetching product categories from virtual database...');
    
    // Use virtual database
    const productDB = new ProductDatabase('virtual');
    
    // Get all products to extract unique categories and subcategories
    const products = productDB.getAllProducts();
    
    // Extract unique categories and subcategories
    const categorySet = new Set<string>();
    const subCategorySet = new Set<string>();
    
    products.forEach(product => {
      // Handle categories (can be string or array)
      if (product.category) {
        if (Array.isArray(product.category)) {
          product.category.forEach(cat => {
            if (cat && typeof cat === 'string' && cat.trim()) {
              categorySet.add(cat.trim());
            }
          });
        } else if (typeof product.category === 'string' && product.category.trim()) {
          categorySet.add(product.category.trim());
        }
      }
      
      // Handle subcategories (can be string or array)
      if (product.subCategory) {
        if (Array.isArray(product.subCategory)) {
          product.subCategory.forEach(subCat => {
            if (subCat && typeof subCat === 'string' && subCat.trim()) {
              subCategorySet.add(subCat.trim());
            }
          });
        } else if (typeof product.subCategory === 'string' && product.subCategory.trim()) {
          subCategorySet.add(product.subCategory.trim());
        }
      }
    });
    
    // Convert sets to sorted arrays
    const categories = Array.from(categorySet).sort();
    const subCategories = Array.from(subCategorySet).sort();
    
    console.log(`✅ Found ${categories.length} unique categories and ${subCategories.length} unique subcategories`);
    console.log('Categories:', categories);
    console.log('SubCategories:', subCategories);
    
    return NextResponse.json({
      success: true,
      categories,
      subCategories,
      count: {
        categories: categories.length,
        subCategories: subCategories.length
      }
    });

  } catch (error) {
    console.error('❌ Error fetching product categories:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch product categories',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
