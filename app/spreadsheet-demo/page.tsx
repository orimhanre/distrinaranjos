'use client';

import React, { useState, useEffect } from 'react';
import Spreadsheet from '../../components/Spreadsheet';
import { Spreadsheet as SpreadsheetType, SpreadsheetColumn } from '../../types/spreadsheet';

// Simple in-memory database for demo purposes
class InMemorySpreadsheetDatabase {
  private data: SpreadsheetType[] = [];

  constructor(dbName: string = 'demo') {
    // Initialize with demo data
    this.initializeDemoData();
  }

  private initializeDemoData() {
    const demoSpreadsheet: SpreadsheetType = {
      id: 'demo-1',
      name: 'Product Catalog Demo',
      description: 'A sample product catalog with images',
      columns: [
        { id: 'col_1', key: 'id', label: 'ID', type: 'text', width: 100, sortable: true, editable: false, required: true, order: 0 },
        { id: 'col_2', key: 'name', label: 'Product Name', type: 'text', width: 200, sortable: true, editable: true, required: true, order: 1 },
        { id: 'col_3', key: 'category', label: 'Category', type: 'select', width: 150, sortable: true, editable: true, required: true, options: ['Electronics', 'Clothing', 'Home', 'Sports'], order: 2 },
        { id: 'col_4', key: 'price', label: 'Price', type: 'number', width: 120, sortable: true, editable: true, required: true, order: 3 },
        { id: 'col_5', key: 'inStock', label: 'In Stock', type: 'boolean', width: 100, sortable: true, editable: true, required: false, order: 4 },
        { id: 'col_6', key: 'images', label: 'Images', type: 'image', width: 150, sortable: false, editable: true, required: false, order: 5 },
        { id: 'col_7', key: 'description', label: 'Description', type: 'text', width: 250, sortable: false, editable: true, required: false, order: 6 },
        { id: 'col_8', key: 'createdAt', label: 'Created', type: 'date', width: 120, sortable: true, editable: false, required: false, order: 7 }
      ],
      rows: [
        {
          id: 'row_1',
          cells: {
            id: { id: 'cell_1_1', value: 'PROD-001', type: 'text', editable: false },
            name: { id: 'cell_1_2', value: 'Wireless Headphones', type: 'text', editable: true },
            category: { id: 'cell_1_3', value: 'Electronics', type: 'select', editable: true },
            price: { id: 'cell_1_4', value: 99.99, type: 'number', editable: true },
            inStock: { id: 'cell_1_5', value: true, type: 'boolean', editable: true },
            images: { id: 'cell_1_6', value: [], type: 'image', editable: true },
            description: { id: 'cell_1_7', value: 'High-quality wireless headphones with noise cancellation', type: 'text', editable: true },
            createdAt: { id: 'cell_1_8', value: '2024-01-15', type: 'date', editable: false }
          },
          order: 0,
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15')
        },
        {
          id: 'row_2',
          cells: {
            id: { id: 'cell_2_1', value: 'PROD-002', type: 'text', editable: false },
            name: { id: 'cell_2_2', value: 'Cotton T-Shirt', type: 'text', editable: true },
            category: { id: 'cell_2_3', value: 'Clothing', type: 'select', editable: true },
            price: { id: 'cell_2_4', value: 24.99, type: 'number', editable: true },
            inStock: { id: 'cell_2_5', value: true, type: 'boolean', editable: true },
            images: { id: 'cell_2_6', value: [], type: 'image', editable: true },
            description: { id: 'cell_2_7', value: 'Comfortable cotton t-shirt in various colors', type: 'text', editable: true },
            createdAt: { id: 'cell_2_8', value: '2024-01-20', type: 'date', editable: false }
          },
          order: 1,
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20')
        },
        {
          id: 'row_3',
          cells: {
            id: { id: 'cell_3_1', value: 'PROD-003', type: 'text', editable: false },
            name: { id: 'cell_3_2', value: 'Coffee Maker', type: 'text', editable: true },
            category: { id: 'cell_3_3', value: 'Home', type: 'select', editable: true },
            price: { id: 'cell_3_4', value: 149.99, type: 'number', editable: true },
            inStock: { id: 'cell_3_5', value: false, type: 'boolean', editable: true },
            images: { id: 'cell_3_6', value: [], type: 'image', editable: true },
            description: { id: 'cell_3_7', value: 'Programmable coffee maker with thermal carafe', type: 'text', editable: true },
            createdAt: { id: 'cell_3_8', value: '2024-01-25', type: 'date', editable: false }
          },
          order: 2,
          createdAt: new Date('2024-01-25'),
          updatedAt: new Date('2024-01-25')
        },
        {
          id: 'row_4',
          cells: {
            id: { id: 'cell_4_1', value: 'PROD-004', type: 'text', editable: false },
            name: { id: 'cell_4_2', value: 'Yoga Mat', type: 'text', editable: true },
            category: { id: 'cell_4_3', value: 'Sports', type: 'select', editable: true },
            price: { id: 'cell_4_4', value: 39.99, type: 'number', editable: true },
            inStock: { id: 'cell_4_5', value: true, type: 'boolean', editable: true },
            images: { id: 'cell_4_6', value: [], type: 'image', editable: true },
            description: { id: 'cell_4_7', value: 'Non-slip yoga mat with carrying strap', type: 'text', editable: true },
            createdAt: { id: 'cell_4_8', value: '2024-01-30', type: 'date', editable: false }
          },
          order: 3,
          createdAt: new Date('2024-01-30'),
          updatedAt: new Date('2024-01-30')
        }
      ],
      settings: {
        allowRowReordering: true,
        allowColumnReordering: true,
        allowBulkOperations: true,
        autoSave: true,
        maxRows: 10000,
        maxColumns: 100
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        version: 1
      }
    };

    this.data.push(demoSpreadsheet);
  }

  getAllSpreadsheets(): SpreadsheetType[] {
    return this.data;
  }

  getSpreadsheet(id: string): SpreadsheetType | undefined {
    return this.data.find(s => s.id === id);
  }
}

export default function SpreadsheetDemoPage() {
  const [spreadsheet, setSpreadsheet] = useState<SpreadsheetType | null>(null);
  const [db] = useState(() => new InMemorySpreadsheetDatabase('demo'));

  useEffect(() => {
    // Load demo spreadsheet
    const demoSpreadsheet = db.getAllSpreadsheets().find(s => s.name === 'Product Catalog Demo');
    if (demoSpreadsheet) {
      setSpreadsheet(demoSpreadsheet);
    }
  }, [db]);

  const handleDataChange = (updatedData: SpreadsheetType) => {
    setSpreadsheet(updatedData);
    // In a real app, you'd save this to the database
    console.log('Spreadsheet data updated:', updatedData);
  };

  if (!spreadsheet) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading spreadsheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{spreadsheet.name}</h1>
          {spreadsheet.description && (
            <p className="text-gray-600">{spreadsheet.description}</p>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow-lg h-[calc(100vh-200px)]">
          <Spreadsheet
            data={spreadsheet}
            onDataChange={handleDataChange}
            readOnly={false}
          />
        </div>
      </div>
    </div>
  );
}
