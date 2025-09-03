import { Spreadsheet, SpreadsheetRow, SpreadsheetColumn, SpreadsheetCell, SpreadsheetOperation } from '@/types/spreadsheet';
import fs from 'fs';
import path from 'path';

export class SpreadsheetDatabase {
  private dbPath: string;
  private data: Spreadsheet[];

  constructor(dbName: string = 'spreadsheets') {
    this.dbPath = path.join(process.cwd(), 'data', `${dbName}.json`);
    this.data = this.loadData();
  }

  private loadData(): Spreadsheet[] {
    try {
      if (fs.existsSync(this.dbPath)) {
        const fileContent = fs.readFileSync(this.dbPath, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Error loading spreadsheet data:', error);
    }
    return [];
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Error saving spreadsheet data:', error);
    }
  }

  // Spreadsheet Management
  createSpreadsheet(name: string, description?: string): Spreadsheet {
    const spreadsheet: Spreadsheet = {
      id: this.generateId(),
      name,
      description,
      columns: [],
      rows: [],
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

    this.data.push(spreadsheet);
    this.saveData();
    return spreadsheet;
  }

  getSpreadsheet(id: string): Spreadsheet | null {
    return this.data.find(s => s.id === id) || null;
  }

  getAllSpreadsheets(): Spreadsheet[] {
    return this.data;
  }

  updateSpreadsheet(id: string, updates: Partial<Spreadsheet>): Spreadsheet | null {
    const index = this.data.findIndex(s => s.id === id);
    if (index === -1) return null;

    this.data[index] = {
      ...this.data[index],
      ...updates,
      metadata: {
        ...this.data[index].metadata,
        updatedAt: new Date(),
        version: this.data[index].metadata.version + 1
      }
    };

    this.saveData();
    return this.data[index];
  }

  deleteSpreadsheet(id: string): boolean {
    const index = this.data.findIndex(s => s.id === id);
    if (index === -1) return false;

    this.data.splice(index, 1);
    this.saveData();
    return true;
  }

  // Column Management
  addColumn(spreadsheetId: string, column: Omit<SpreadsheetColumn, 'id' | 'order'>): SpreadsheetColumn | null {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return null;

    const newColumn: SpreadsheetColumn = {
      ...column,
      id: this.generateId(),
      order: spreadsheet.columns.length
    };

    spreadsheet.columns.push(newColumn);
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;

    // Add empty cells for this column to all existing rows
    spreadsheet.rows.forEach(row => {
      row.cells[newColumn.key] = {
        id: this.generateId(),
        value: '',
        type: newColumn.type,
        editable: newColumn.editable
      };
    });

    this.saveData();
    return newColumn;
  }

  updateColumn(spreadsheetId: string, columnId: string, updates: Partial<SpreadsheetColumn>): SpreadsheetColumn | null {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return null;

    const columnIndex = spreadsheet.columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return null;

    spreadsheet.columns[columnIndex] = {
      ...spreadsheet.columns[columnIndex],
      ...updates
    };

    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return spreadsheet.columns[columnIndex];
  }

  deleteColumn(spreadsheetId: string, columnId: string): boolean {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return false;

    const columnIndex = spreadsheet.columns.findIndex(c => c.id === columnId);
    if (columnIndex === -1) return false;

    const columnKey = spreadsheet.columns[columnIndex].key;
    
    // Remove column from columns array
    spreadsheet.columns.splice(columnIndex, 1);
    
    // Remove column cells from all rows
    spreadsheet.rows.forEach(row => {
      delete row.cells[columnKey];
    });

    // Reorder remaining columns
    spreadsheet.columns.forEach((col, index) => {
      col.order = index;
    });

    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return true;
  }

  reorderColumns(spreadsheetId: string, columnIds: string[]): boolean {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return false;

    // Reorder columns based on the new order
    const reorderedColumns: SpreadsheetColumn[] = [];
    columnIds.forEach((columnId, index) => {
      const column = spreadsheet.columns.find(c => c.id === columnId);
      if (column) {
        column.order = index;
        reorderedColumns.push(column);
      }
    });

    spreadsheet.columns = reorderedColumns;
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return true;
  }

  // Row Management
  addRow(spreadsheetId: string, data?: Record<string, any>): SpreadsheetRow | null {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return null;

    const newRow: SpreadsheetRow = {
      id: this.generateId(),
      cells: {},
      order: spreadsheet.rows.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize cells for all columns
    spreadsheet.columns.forEach(column => {
      newRow.cells[column.key] = {
        id: this.generateId(),
        value: data?.[column.key] || this.getDefaultValue(column.type),
        type: column.type,
        editable: column.editable
      };
    });

    spreadsheet.rows.push(newRow);
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return newRow;
  }

  updateRow(spreadsheetId: string, rowId: string, updates: Record<string, any>): SpreadsheetRow | null {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return null;

    const rowIndex = spreadsheet.rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return null;

    const row = spreadsheet.rows[rowIndex];
    
    // Update cells
    Object.entries(updates).forEach(([key, value]) => {
      if (row.cells[key]) {
        row.cells[key].value = value;
        row.cells[key].metadata = {
          ...row.cells[key].metadata,
          originalValue: row.cells[key].metadata?.originalValue || row.cells[key].value,
          lastModified: new Date()
        };
      }
    });

    row.updatedAt = new Date();
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return row;
  }

  deleteRow(spreadsheetId: string, rowId: string): boolean {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return false;

    const rowIndex = spreadsheet.rows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return false;

    spreadsheet.rows.splice(rowIndex, 1);
    
    // Reorder remaining rows
    spreadsheet.rows.forEach((row, index) => {
      row.order = index;
    });

    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return true;
  }

  reorderRows(spreadsheetId: string, rowIds: string[]): boolean {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return false;

    // Reorder rows based on the new order
    const reorderedRows: SpreadsheetRow[] = [];
    rowIds.forEach((rowId, index) => {
      const row = spreadsheet.rows.find(r => r.id === rowId);
      if (row) {
        row.order = index;
        reorderedRows.push(row);
      }
    });

    spreadsheet.rows = reorderedRows;
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return true;
  }

  // Cell Management
  updateCell(spreadsheetId: string, rowId: string, columnKey: string, value: any): SpreadsheetCell | null {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return null;

    const row = spreadsheet.rows.find(r => r.id === rowId);
    if (!row || !row.cells[columnKey]) return null;

    const cell = row.cells[columnKey];
    cell.value = value;
    cell.metadata = {
      ...cell.metadata,
      originalValue: cell.metadata?.originalValue || cell.value,
      lastModified: new Date()
    };

    row.updatedAt = new Date();
    spreadsheet.metadata.updatedAt = new Date();
    spreadsheet.metadata.version++;
    this.saveData();

    return cell;
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private getDefaultValue(type: string): any {
    switch (type) {
      case 'number': return 0;
      case 'boolean': return false;
      case 'image': return [];
      case 'date': return new Date().toISOString().split('T')[0];
      default: return '';
    }
  }

  // Search and Filter
  searchRows(spreadsheetId: string, query: string): SpreadsheetRow[] {
    const spreadsheet = this.getSpreadsheet(spreadsheetId);
    if (!spreadsheet) return [];

    const searchTerm = query.toLowerCase();
    return spreadsheet.rows.filter(row => {
      return Object.values(row.cells).some(cell => {
        const cellValue = String(cell.value).toLowerCase();
        return cellValue.includes(searchTerm);
      });
    });
  }

  // Bulk Operations
  bulkUpdateRows(spreadsheetId: string, rowIds: string[], updates: Record<string, any>): number {
    let updatedCount = 0;
    rowIds.forEach(rowId => {
      if (this.updateRow(spreadsheetId, rowId, updates)) {
        updatedCount++;
      }
    });
    return updatedCount;
  }

  bulkDeleteRows(spreadsheetId: string, rowIds: string[]): number {
    let deletedCount = 0;
    rowIds.forEach(rowId => {
      if (this.deleteRow(spreadsheetId, rowId)) {
        deletedCount++;
      }
    });
    return deletedCount;
  }
}
