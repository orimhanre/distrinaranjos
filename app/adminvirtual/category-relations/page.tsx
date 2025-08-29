'use client';
import React from 'react';
import CategorySubcategoryManager from '@/components/CategorySubcategoryManager';

export default function CategoryRelationsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Category-Subcategory Relations</h1>
          <p className="mt-2 text-gray-600">
            Manage the relationships between categories and subcategories in your product database.
          </p>
        </div>
        
        <CategorySubcategoryManager />
      </div>
    </div>
  );
} 