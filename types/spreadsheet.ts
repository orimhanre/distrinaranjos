export interface SpreadsheetCell {
  id: string;
  value: string | number | boolean | string[]; // string[] for image arrays
  type: 'text' | 'longText' | 'number' | 'boolean' | 'image' | 'select' | 'multipleSelect' | 'date' | 'phone' | 'email' | 'createdTime' | 'lastModifiedTime';
  editable: boolean;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[]; // for select type
  };
  metadata?: {
    originalValue?: any;
    lastModified?: Date;
    modifiedBy?: string;
  };
}

export interface SpreadsheetColumn {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'longText' | 'number' | 'boolean' | 'image' | 'select' | 'multipleSelect' | 'date' | 'phone' | 'email' | 'createdTime' | 'lastModifiedTime';
  width?: number;
  sortable: boolean;
  editable: boolean;
  required: boolean;
  options?: string[]; // for select type
  order: number;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[]; // for select type
  };
}

export interface SpreadsheetRow {
  id: string;
  cells: Record<string, SpreadsheetCell>;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  isSelected?: boolean;
}

export interface Spreadsheet {
  id: string;
  name: string;
  description?: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
  settings: {
    allowRowReordering: boolean;
    allowColumnReordering: boolean;
    allowBulkOperations: boolean;
    autoSave: boolean;
    maxRows?: number;
    maxColumns?: number;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    version: number;
  };
}

export interface SpreadsheetOperation {
  type: 'create' | 'update' | 'delete' | 'reorder' | 'bulk';
  target: 'row' | 'column' | 'cell';
  data: any;
  timestamp: Date;
  userId?: string;
}

export interface ImageData {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  thumbnailUrl?: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy?: string;
}
