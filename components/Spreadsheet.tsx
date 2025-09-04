'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Spreadsheet, SpreadsheetRow, SpreadsheetColumn, SpreadsheetCell } from '@/types/spreadsheet';
import EditableCell from './EditableCell';
import SpreadsheetHeader from './SpreadsheetHeader';
import SpreadsheetToolbar from './SpreadsheetToolbar';

interface SpreadsheetProps {
  data: Spreadsheet;
  onDataChange: (updatedData: Spreadsheet) => void;
  onColumnDelete?: (columnKey: string) => void;
  readOnly?: boolean;
  showAddRowAtEnd?: boolean;
}

export default function Spreadsheet({ data, onDataChange, onColumnDelete, readOnly = false, showAddRowAtEnd = true }: SpreadsheetProps) {
  const [spreadsheet, setSpreadsheet] = useState<Spreadsheet>(data);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredRows, setFilteredRows] = useState<SpreadsheetRow[]>(data.rows);
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  const [openColumnEditor, setOpenColumnEditor] = useState<string | null>(null);
  const [showAddColumnEditor, setShowAddColumnEditor] = useState<boolean>(false);
  const editorOpenedAtRef = useRef<number>(0);
  const [showHiddenFieldsMenu, setShowHiddenFieldsMenu] = useState<boolean>(false);
  
  // Keep internal state in sync with incoming data prop
  // Preserve locally adjusted column widths to avoid snap-back after manual resize
  const lastManualResizeAtRef = useRef<number>(0);
  useEffect(() => {
    // Merge columns to preserve local widths where possible
    setSpreadsheet(prev => {
      if (!prev) return data;
      const merged = { ...data, columns: [...data.columns] } as Spreadsheet;
      const prevByKey: Record<string, SpreadsheetColumn> = {} as any;
      prev.columns.forEach(c => { prevByKey[c.key] = c; });
      merged.columns = data.columns.map(c => {
        const p = prevByKey[c.key];
        if (!p) return c;
        const width = (p as any).userResized ? p.width : (c.width ?? p.width);
        const userResized = (p as any).userResized ? true : (c as any).userResized;
        return { ...c, width, ...(userResized ? { userResized: true } as any : {}) } as any;
      });
      return merged;
    });
    setFilteredRows(data.rows);
  }, [data]);
  
  // Drag and drop state
  const [draggedRow, setDraggedRow] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverRow, setDragOverRow] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  
  // Column resize state
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragPreviewRef = useRef<{ el: HTMLElement | null; offsetX: number } | null>(null);
  const customDragCleanupRef = useRef<(() => void) | null>(null);
  const [copiedData, setCopiedData] = useState<string>('');

  // Measure text width roughly using canvas once
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const measureTextPx = useCallback((text: string): number => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return text.length * 8; // fallback approximation
    // Match tailwind text-sm (approx 14px) with default system font stack
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans';
    return ctx.measureText(text).width;
  }, []);

  // Auto-fit column widths only on mount (respect user/manual sizes afterward)
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    if (hasAutoFittedRef.current) return;
    const updated = { ...spreadsheet };
    let anyChanged = false;

    updated.columns.forEach((col) => {
      if ((col as any).hidden) return;
      if ((col as any).userResized) return; // respect manual resize
      if (col.width != null && col.width > 0) return; // keep explicit widths
      // Fixed widths for certain types
      if (col.type === 'image') {
        const desired = Math.max(160, col.width || 0);
        if ((col.width || 0) !== desired) { col.width = desired; anyChanged = true; }
        return;
      }
      if (col.type === 'boolean') {
        const desired = 100;
        if ((col.width || 0) !== desired) { col.width = desired; anyChanged = true; }
        return;
      }

      let maxPx = measureTextPx(col.label || '') + 32; // header padding
      // Check all rows, not only filtered, so width fits full dataset
      for (const row of updated.rows) {
        const cell = row.cells[col.key];
        if (!cell) continue;
        let text = '';
        if (Array.isArray(cell.value)) text = cell.value.join(', ');
        else if (cell.value == null) text = '';
        else text = String(cell.value);
        // Short-circuit for very long values to avoid extreme widths
        const px = Math.min(500, measureTextPx(text)) + 28; // cell padding
        if (px > maxPx) maxPx = px;
      }

      const clamped = Math.max(80, Math.min(420, Math.ceil(maxPx)));
      if (!col.width || Math.abs(clamped - col.width) > 2) {
        col.width = clamped;
        anyChanged = true;
      }
    });

    if (anyChanged) {
      updated.metadata.updatedAt = new Date();
      updated.metadata.version++;
      setSpreadsheet(updated);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updated), 0);
    }
    hasAutoFittedRef.current = true;
    // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update filtered rows when data or search changes
  useEffect(() => {
    let filtered = [...spreadsheet.rows];
    
    if (searchQuery) {
      filtered = filtered.filter(row => 
        Object.values(row.cells).some(cell => 
          String(cell.value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aValue = a.cells[sortConfig.key]?.value;
        const bValue = b.cells[sortConfig.key]?.value;
        
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setFilteredRows(filtered);
  }, [spreadsheet, searchQuery, sortConfig]);

  // Close column menu on outside click (but keep clicks inside menu functional)
  useEffect(() => {
    if (!openColumnMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest && target.closest('.col-menu')) return;
      setOpenColumnMenu(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openColumnMenu]);

  // Close column editor on outside click or Escape
  useEffect(() => {
    if (!openColumnEditor) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ignore clicks inside the editor
      if (target.closest && target.closest('.col-editor')) return;
      // Ignore the click that just opened the editor to prevent immediate close
      if (Date.now() - editorOpenedAtRef.current < 200) return;
      setOpenColumnEditor(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenColumnEditor(null);
    };
    document.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [openColumnEditor]);

  // Close hidden fields menu on outside click
  useEffect(() => {
    if (!showHiddenFieldsMenu) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest && target.closest('.hidden-fields-menu')) return;
      if (target.closest && target.closest('.hidden-fields-trigger')) return;
      setShowHiddenFieldsMenu(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showHiddenFieldsMenu]);

  // Local helper to convert UI type name before the main converter is defined
  const localFromUiTypeName = useCallback((name: string): SpreadsheetColumn['type'] => {
    const map: Record<string, SpreadsheetColumn['type']> = {
      'Single Line Text': 'text',
      'Long Text': 'longText',
      'Attachment': 'image',
      'Checkbox': 'boolean',
      'Multiple select': 'multipleSelect',
      'Email': 'email',
      'Number': 'number',
      'Created Time': 'createdTime',
      'Last Modified Time': 'lastModifiedTime',
      'Single select': 'select',
      'Date': 'date',
      'Phone': 'phone'
    };
    return map[name] || 'text';
  }, []);

  // Add new column (defined early so other handlers can reference it)
  const [lastAddedColumnKey, setLastAddedColumnKey] = useState<string | null>(null);
  const handleAddColumn = useCallback((labelArg?: string, uiTypeArg?: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const defaultLabel = `New Field ${updatedSpreadsheet.columns.length + 1}`;
    const label = (labelArg && labelArg.trim()) ? labelArg.trim() : defaultLabel;
    const uiType = uiTypeArg && uiTypeArg.trim() ? uiTypeArg.trim() : 'Single Line Text';
    const newType = localFromUiTypeName(uiType);

    const sanitizedLabel = label.trim() || defaultLabel;
    const baseKey = sanitizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    let uniqueKey = baseKey;
    let counter = 1;
    while (updatedSpreadsheet.columns.some(c => c.key === uniqueKey)) {
      uniqueKey = `${baseKey}_${counter++}`;
    }

    const newColumn: SpreadsheetColumn = {
      id: `col_${Date.now()}`,
      key: uniqueKey,
      label: sanitizedLabel,
      type: newType,
      width: 150,
      sortable: true,
      editable: true,
      required: false,
      order: updatedSpreadsheet.columns.length
    } as any;

    updatedSpreadsheet.columns.push(newColumn);

    // Add cells for new column to all rows
    updatedSpreadsheet.rows.forEach((row, idx) => {
      row.cells[newColumn.key] = {
        id: `cell_${row.id}_${newColumn.key}`,
        value: newType === 'multipleSelect' || newType === 'image' ? [] : newType === 'number' ? 0 : newType === 'boolean' ? false : '',
        type: newColumn.type,
        editable: true
      } as SpreadsheetCell;
    });

    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    setLastAddedColumnKey(uniqueKey);
    // Scroll to the new column after render
    setTimeout(() => {
      try {
        if (gridRef.current) {
          gridRef.current.scrollTo({ left: gridRef.current.scrollWidth, behavior: 'smooth' });
        }
      } catch {}
    }, 0);
  }, [spreadsheet, onDataChange, localFromUiTypeName]);

  // Close add-column editor on outside click or Escape
  useEffect(() => {
    if (!showAddColumnEditor) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest && target.closest('.addcol-editor')) return;
      setShowAddColumnEditor(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowAddColumnEditor(false); };
    document.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('click', onDocClick); window.removeEventListener('keydown', onKey); };
  }, [showAddColumnEditor]);

  // Focus name input when the add-column modal opens
  useEffect(() => {
    if (!showAddColumnEditor) return;
    setTimeout(() => {
      const input = document.getElementById('new-col-name') as HTMLInputElement | null;
      input?.focus();
    }, 0);
  }, [showAddColumnEditor]);

  const handleConfirmAddColumn = useCallback(() => {
    const nameEl = document.getElementById('new-col-name') as HTMLInputElement | null;
    const typeEl = document.getElementById('new-col-type') as HTMLSelectElement | null;
    const name = (nameEl?.value || '').trim();
    const typ = (typeEl?.value || 'Single Line Text').trim();
    console.log('➕ Adding field', { name, typ });
    handleAddColumn(name, typ);
    setShowAddColumnEditor(false);
  }, [handleAddColumn]);

  const handleToggleColumnHidden = useCallback((columnKey: string, hidden: boolean) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (!column) return;
    (column as any).hidden = hidden;
    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
  }, [spreadsheet, onDataChange]);

  // Helpers to map between UI names and internal types
  const toUiTypeName = useCallback((t: SpreadsheetColumn['type']): string => {
    const map: Record<SpreadsheetColumn['type'], string> = {
      text: 'Single Line Text',
      longText: 'Long Text',
      image: 'Attachment',
      boolean: 'Checkbox',
      multipleSelect: 'Multiple select',
      email: 'Email',
      number: 'Number',
      createdTime: 'Created Time',
      lastModifiedTime: 'Last Modified Time',
      select: 'Single select',
      date: 'Date',
      phone: 'Phone'
    };
    return map[t] || String(t);
  }, []);

  const fromUiTypeName = useCallback((name: string): SpreadsheetColumn['type'] => {
    const map: Record<string, SpreadsheetColumn['type']> = {
      'Single Line Text': 'text',
      'Long Text': 'longText',
      'Attachment': 'image',
      'Checkbox': 'boolean',
      'Multiple select': 'multipleSelect',
      'Email': 'email',
      'Number': 'number',
      'Created Time': 'createdTime',
      'Last Modified Time': 'lastModifiedTime',
      'Single select': 'select',
      'Date': 'date',
      'Phone': 'phone'
    };
    return map[name] || 'text';
  }, []);

  const applyColumnEdit = useCallback((columnKey: string, newLabel: string, newUiType: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (!column) return;
    const newType = fromUiTypeName(newUiType);
    const labelChanged = newLabel.trim() && newLabel.trim() !== column.label;
    const typeChanged = newType !== column.type;
    if (!labelChanged && !typeChanged) return;

    if (labelChanged) column.label = newLabel.trim();
    if (typeChanged) {
      column.type = newType;
      // Coerce cell values to the new type where reasonable
      updatedSpreadsheet.rows.forEach(row => {
        const cell = row.cells[column.key];
        if (!cell) return;
        cell.type = newType;
        if (newType === 'boolean') {
          const v = cell.value;
          let boolVal = false;
          if (typeof v === 'boolean') boolVal = v;
          else if (typeof v === 'number') boolVal = v !== 0;
          else if (Array.isArray(v)) boolVal = v.length > 0;
          else if (v != null) {
            const s = String(v).trim().toLowerCase();
            if (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on' || s === 'si' || s === 'sí' || s === 'checked') {
              boolVal = true;
            } else if (s === 'false' || s === '0' || s === 'no' || s === 'n' || s === 'off' || s === '') {
              boolVal = false;
            } else {
              boolVal = false; // default to unchecked for ambiguous values
            }
          }
          cell.value = boolVal;
        } else if (newType === 'number') {
          const n = Number(cell.value);
          cell.value = isNaN(n) ? 0 : n;
        } else if (newType === 'multipleSelect') {
          if (Array.isArray(cell.value)) cell.value = cell.value.map(String);
          else if (cell.value == null || cell.value === '') cell.value = [];
          else cell.value = String(cell.value).split(',').map(s => s.trim()).filter(Boolean);
        } else if (newType === 'image') {
          if (Array.isArray(cell.value)) cell.value = cell.value.map(String);
          else if (cell.value == null || cell.value === '') cell.value = [];
          else cell.value = [String(cell.value)];
        } else if (newType === 'email') {
          cell.value = cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
        } else if (newType === 'text' || newType === 'longText' || newType === 'select' || newType === 'date' || newType === 'phone') {
          cell.value = cell.value == null ? '' : String(cell.value);
        }
      });
    }
    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
  }, [spreadsheet, fromUiTypeName, onDataChange]);



  // Handle cell value changes
  const handleCellChange = useCallback((rowId: string, columnKey: string, value: any) => {
    
    const updatedSpreadsheet = { ...spreadsheet };
    const row = updatedSpreadsheet.rows.find(r => r.id === rowId);
    
    if (row && row.cells[columnKey]) {
      row.cells[columnKey].value = value;
      row.updatedAt = new Date();
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Handle row selection
  const handleRowSelect = useCallback((rowId: string, isSelected: boolean) => {
    const newSelected = new Set(selectedCells);
    if (isSelected) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedCells(newSelected);
  }, [selectedCells]);

  // Handle column sorting
  const handleColumnSort = useCallback((columnKey: string) => {
    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        return prev.direction === 'asc' 
          ? { key: columnKey, direction: 'desc' }
          : null;
      }
      return { key: columnKey, direction: 'asc' };
    });
  }, []);

  // Handle column resizing
  // During resize, update UI only (no version bump, no save) to avoid thrashing
  const handleColumnResize = useCallback((columnKey: string, newWidth: number) => {
    setSpreadsheet(prev => {
      const updated = { ...prev } as Spreadsheet;
      const column = updated.columns.find(col => col.key === columnKey);
      if (column) {
        column.width = newWidth;
        (column as any).userResized = true;
        lastManualResizeAtRef.current = Date.now();
      }
      return updated;
    });
  }, []);

  // Handle column resize start
  const handleColumnResizeStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const column = spreadsheet.columns.find(col => col.key === columnKey);
    if (column) {
      setResizing(columnKey);
      setStartX(e.clientX);
      setStartWidth(column.width || 128);
    }
  }, [spreadsheet]);

  // Handle column resize during mouse move
  const handleColumnResizeMove = useCallback((e: MouseEvent) => {
    if (resizing) {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + deltaX);
      handleColumnResize(resizing, newWidth);
    }
  }, [resizing, startX, startWidth, handleColumnResize]);

  // Handle column resize end
  const handleColumnResizeEnd = useCallback(() => {
    setResizing(null);
    // Persist once after drag ends
    setSpreadsheet(prev => {
      const updated = { ...prev } as Spreadsheet;
      updated.metadata.updatedAt = new Date();
      updated.metadata.version++;
      return updated;
    });
    // Call onDataChange after render cycle to avoid React errors
    setTimeout(() => {
      if (spreadsheet) {
        const updated = { ...spreadsheet } as Spreadsheet;
        updated.metadata.updatedAt = new Date();
        updated.metadata.version++;
        onDataChange(updated);
      }
    }, 0);
  }, [onDataChange, spreadsheet]);

  // Handle column type change
  const handleColumnTypeChange = useCallback((columnKey: string, newType: string, newLabel: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (column) {
      column.type = newType as any;
      column.label = newLabel;
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Handle column label change
  const handleColumnLabelChange = useCallback((columnKey: string, newLabel: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (column) {
      column.label = newLabel;
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Handle column duplicate
  const handleColumnDuplicate = useCallback((columnKey: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const originalColumn = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (originalColumn) {
      const newColumn = {
        ...originalColumn,
        key: `${originalColumn.key}_copy_${Date.now()}`,
        label: `${originalColumn.label} (Copy)`,
        order: updatedSpreadsheet.columns.length
      };
      updatedSpreadsheet.columns.push(newColumn);
      
              // Add cells for the new column to all rows
        updatedSpreadsheet.rows.forEach(row => {
          row.cells[newColumn.key] = {
            id: `cell_${row.id}_${newColumn.key}`,
            value: row.cells[columnKey]?.value || '',
            type: newColumn.type,
            editable: true
          };
        });
      
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Handle column hide
  const handleColumnHide = useCallback((columnKey: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (column) {
      (column as any).hidden = true;
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Add global mouse event listeners for column resizing
  useEffect(() => {
    if (resizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleColumnResizeMove);
      document.addEventListener('mouseup', handleColumnResizeEnd);
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleColumnResizeMove);
        document.removeEventListener('mouseup', handleColumnResizeEnd);
      };
    }
  }, [resizing, handleColumnResizeMove, handleColumnResizeEnd]);

  // Handle column deletion
  const handleColumnDelete = useCallback((columnKey: string) => {
    // Confirm deletion
    if (typeof window !== 'undefined') {
      const ok = window.confirm('¿Eliminar esta columna? Esta acción no se puede deshacer.');
      if (!ok) return;
    }
    const updatedSpreadsheet = { ...spreadsheet };
    
    // Remove the column
    updatedSpreadsheet.columns = updatedSpreadsheet.columns.filter(col => col.key !== columnKey);
    
    // Remove cells for this column from all rows
    updatedSpreadsheet.rows.forEach(row => {
      delete row.cells[columnKey];
    });
    
    // Reorder remaining columns
    updatedSpreadsheet.columns.forEach((col, index) => {
      col.order = index;
    });
    
    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    
    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    // Inform parent so it can update schema and persist
    if (onColumnDelete) {
      try { onColumnDelete(columnKey); } catch {}
    }
    
    console.log(`🗑️ Column "${columnKey}" deleted`);
  }, [spreadsheet, onDataChange, onColumnDelete]);

  // Add new column (redundant older definition removed)
  /* const handleAddColumn = useCallback((labelArg?: string, uiTypeArg?: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const defaultLabel = `New Field ${updatedSpreadsheet.columns.length + 1}`;
    const label = (labelArg && labelArg.trim()) ? labelArg.trim() : defaultLabel;
    const uiType = uiTypeArg && uiTypeArg.trim() ? uiTypeArg.trim() : 'Single Line Text';
    const newType = fromUiTypeName(uiType);

    const sanitizedLabel = label.trim() || defaultLabel;
    const baseKey = sanitizedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `field_${Date.now()}`;
    let uniqueKey = baseKey;
    let counter = 1;
    while (updatedSpreadsheet.columns.some(c => c.key === uniqueKey)) {
      uniqueKey = `${baseKey}_${counter++}`;
    }

    const newColumn: SpreadsheetColumn = {
      id: `col_${Date.now()}`,
      key: uniqueKey,
      label: sanitizedLabel,
      type: newType,
      width: 150,
      sortable: true,
      editable: true,
      required: false,
      order: updatedSpreadsheet.columns.length
    } as any;

    updatedSpreadsheet.columns.push(newColumn);

    // Add cells for new column to all rows
    updatedSpreadsheet.rows.forEach((row, idx) => {
      row.cells[newColumn.key] = {
        id: `cell_${row.id}_${newColumn.key}`,
        value: newType === 'multipleSelect' || newType === 'image' ? [] : newType === 'number' ? 0 : newType === 'boolean' ? false : '',
        type: newColumn.type,
        editable: true
      } as SpreadsheetCell;
    });

    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    setSpreadsheet(updatedSpreadsheet);
    onDataChange(updatedSpreadsheet);
  }, [spreadsheet, onDataChange, fromUiTypeName]); */

  // Edit column (simple label edit prompt for now)
  const handleColumnEdit = useCallback((columnKey: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const column = updatedSpreadsheet.columns.find(col => col.key === columnKey);
    if (!column) return;
    const newLabel = typeof window !== 'undefined' ? window.prompt('Edit field label', column.label) : null;
    if (newLabel && newLabel.trim() && newLabel !== column.label) {
      column.label = newLabel.trim();
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    }
  }, [spreadsheet, onDataChange]);

  // Handle copy/paste
  const handleCopy = useCallback(() => {
    if (selectedCells.size === 0) return;
    
    const selectedRows = filteredRows.filter(row => selectedCells.has(row.id));
    const csvData = selectedRows.map(row => 
      spreadsheet.columns.map(col => {
        const cell = row.cells[col.key];
        const value = cell?.value || '';
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',')
    ).join('\n');
    
    setCopiedData(csvData);
    navigator.clipboard.writeText(csvData);
  }, [selectedCells, filteredRows, spreadsheet.columns]);

  const handlePaste = useCallback(() => {
    if (!editingCell || !copiedData) return;
    
    const [rowId, columnKey] = editingCell.split(':');
    const lines = copiedData.trim().split('\n');
    
    if (lines.length > 0) {
      const firstValue = lines[0].split(',')[0].replace(/"/g, '');
      handleCellChange(rowId, columnKey, firstValue);
    }
  }, [editingCell, copiedData, handleCellChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'a':
            e.preventDefault();
            setSelectedCells(new Set(filteredRows.map(row => row.id)));
            break;
        }
      }
      
      if (e.key === 'Escape') {
        setEditingCell(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleCopy, handlePaste, filteredRows]);

  // Add new row
  const handleAddRow = useCallback(() => {
    const newRow: SpreadsheetRow = {
      id: `row_${Date.now()}`,
      cells: {},
      order: spreadsheet.rows.length,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize cells for all columns
    spreadsheet.columns.forEach(column => {
      newRow.cells[column.key] = {
        id: `cell_${Date.now()}_${column.key}`,
        value: '',
        type: column.type,
        editable: column.editable
      };
    });

    const updatedSpreadsheet = {
      ...spreadsheet,
      rows: [...spreadsheet.rows, newRow],
      metadata: {
        ...spreadsheet.metadata,
        updatedAt: new Date(),
        version: spreadsheet.metadata.version + 1
      }
    };

    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
  }, [spreadsheet, onDataChange]);

  // Delete selected rows
  const handleDeleteRows = useCallback(() => {
    if (selectedCells.size === 0) return;
    // Confirm deletion
    if (typeof window !== 'undefined') {
      const ok = window.confirm(`¿Eliminar ${selectedCells.size} fila(s) seleccionada(s)? Esta acción no se puede deshacer.`);
      if (!ok) return;
    }
    
    const updatedSpreadsheet = {
      ...spreadsheet,
      rows: spreadsheet.rows.filter(row => !selectedCells.has(row.id)),
      metadata: {
        ...spreadsheet.metadata,
        updatedAt: new Date(),
        version: spreadsheet.metadata.version + 1
      }
    };

    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
    setSelectedCells(new Set());
  }, [spreadsheet, selectedCells, onDataChange]);

  const handleRowDragStart = useCallback((e: React.DragEvent, rowId: string) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', rowId);
      e.dataTransfer.effectAllowed = 'move';
    }
    setDraggedRow(rowId);
  }, []);

  const handleRowDragOver = useCallback((e: React.DragEvent, rowId: string, rowIndex: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverRow(rowId);
  }, []);

  const handleRowDrop = useCallback((e: React.DragEvent, rowId: string, rowIndex: number) => {
    e.preventDefault();
    const draggedRowId = e.dataTransfer?.getData('text/plain');
    if (!draggedRowId) return;
    const draggedRowIndex = spreadsheet.rows.findIndex(row => row.id === draggedRowId);

    if (draggedRowIndex !== -1 && rowIndex !== draggedRowIndex) {
      const updatedSpreadsheet = { ...spreadsheet };
      const [draggedRow] = updatedSpreadsheet.rows.splice(draggedRowIndex, 1);
      updatedSpreadsheet.rows.splice(rowIndex, 0, draggedRow);

      // Reorder rows
      updatedSpreadsheet.rows.forEach((row, index) => {
        row.order = index;
      });

      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;

      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
      setDraggedRow(null);
      setDragOverRow(null);
    }
  }, [spreadsheet, onDataChange]);

  const handleRowDragEnd = useCallback(() => {
    setDraggedRow(null);
    setDragOverRow(null);
  }, []);

  // Column drag preview helpers
  const createColumnDragPreview = useCallback((columnKey: string, startClientX: number) => {
    const sourceEl = columnRefs.current[columnKey];
    if (!sourceEl) return;
    const rect = sourceEl.getBoundingClientRect();
    const clone = sourceEl.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.top = `${rect.top}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '2000';
    clone.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    clone.style.opacity = '0.95';
    document.body.appendChild(clone);
    // Hide original column while dragging so only the preview moves
    sourceEl.style.visibility = 'hidden';
    dragPreviewRef.current = { el: clone, offsetX: startClientX - rect.left };
  }, []);

  const moveColumnDragPreview = useCallback((clientX: number) => {
    const preview = dragPreviewRef.current;
    if (!preview || !preview.el) return;
    const newLeft = clientX - preview.offsetX;
    preview.el.style.left = `${newLeft}px`;
  }, []);

  const destroyColumnDragPreview = useCallback((columnKey?: string) => {
    const preview = dragPreviewRef.current;
    if (preview && preview.el) {
      try { document.body.removeChild(preview.el); } catch {}
    }
    dragPreviewRef.current = null;
    if (columnKey && columnRefs.current[columnKey]) {
      const src = columnRefs.current[columnKey]!;
      src.style.visibility = '';
    } else if (columnKey === undefined) {
      Object.values(columnRefs.current).forEach(el => { if (el) el.style.visibility = ''; });
    }
  }, []);

  // Helper to reorder columns programmatically
  const reorderColumns = useCallback((draggedColumnKey: string, targetColumnKey: string) => {
    const updatedSpreadsheet = { ...spreadsheet };
    const draggedColumnData = updatedSpreadsheet.columns.find(col => col.key === draggedColumnKey);
    const targetColumnData = updatedSpreadsheet.columns.find(col => col.key === targetColumnKey);
    if (!draggedColumnData || !targetColumnData) return;

    const draggedIndex = updatedSpreadsheet.columns.findIndex(col => col.key === draggedColumnKey);
    const targetIndex = updatedSpreadsheet.columns.findIndex(col => col.key === targetColumnKey);
    updatedSpreadsheet.columns.splice(draggedIndex, 1);
    updatedSpreadsheet.columns.splice(targetIndex, 0, draggedColumnData);
    updatedSpreadsheet.columns.forEach((col, index) => { col.order = index; });
    updatedSpreadsheet.rows.forEach(row => {
      const reordered: Record<string, any> = {};
      updatedSpreadsheet.columns.forEach(column => { if (row.cells[column.key]) reordered[column.key] = row.cells[column.key]; });
      row.cells = reordered;
    });
    updatedSpreadsheet.metadata.updatedAt = new Date();
    updatedSpreadsheet.metadata.version++;
    setSpreadsheet(updatedSpreadsheet);
    // Defer onDataChange to avoid React render cycle errors
    setTimeout(() => onDataChange(updatedSpreadsheet), 0);
  }, [spreadsheet, onDataChange]);

  // Custom column drag (mouse-based) for smooth UX and no ghost image
  const handleCustomColumnDragStart = useCallback((e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const startX = e.clientX;
    createColumnDragPreview(columnKey, startX);
    setDraggedColumn(columnKey);
    document.body.style.cursor = 'grabbing';

    const onMouseMove = (ev: MouseEvent) => {
      moveColumnDragPreview(ev.clientX);
      // Highlight potential drop target
      let targetKey: string | null = null;
      const entries = Object.entries(columnRefs.current);
      for (const [key, el] of entries) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        if (ev.clientX < center) { targetKey = key; break; }
      }
      if (!targetKey && entries.length) targetKey = entries[entries.length - 1][0];
      setDragOverColumn(targetKey || null);
    };
    const onMouseUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      const draggedKey = columnKey;
      // Determine final target index
      let targetKey: string | null = null;
      const entries = Object.entries(columnRefs.current);
      for (const [key, el] of entries) {
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        if (ev.clientX < center) { targetKey = key; break; }
      }
      if (!targetKey && entries.length) targetKey = entries[entries.length - 1][0];
      if (targetKey && targetKey !== draggedKey) reorderColumns(draggedKey, targetKey);
      destroyColumnDragPreview(draggedKey);
      setDraggedColumn(null);
      setDragOverColumn(null);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    customDragCleanupRef.current = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
  }, [createColumnDragPreview, moveColumnDragPreview, destroyColumnDragPreview, reorderColumns]);

  const handleColumnDragOver = useCallback((e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    setDragOverColumn(columnKey);
  }, []);

  const handleColumnDrop = useCallback((e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    const draggedColumnKey = e.dataTransfer?.getData('text/plain');
    if (!draggedColumnKey || draggedColumnKey === targetColumnKey) return;
    
    const updatedSpreadsheet = { ...spreadsheet };
    const draggedColumnData = updatedSpreadsheet.columns.find(col => col.key === draggedColumnKey);
    const targetColumnData = updatedSpreadsheet.columns.find(col => col.key === targetColumnKey);
    
    if (draggedColumnData && targetColumnData) {
      const draggedIndex = updatedSpreadsheet.columns.findIndex(col => col.key === draggedColumnKey);
      const targetIndex = updatedSpreadsheet.columns.findIndex(col => col.key === targetColumnKey);
      
      // Remove dragged column from current position
      updatedSpreadsheet.columns.splice(draggedIndex, 1);
      
      // Insert dragged column at target position
      updatedSpreadsheet.columns.splice(targetIndex, 0, draggedColumnData);
      
      // Update order property for all columns
      updatedSpreadsheet.columns.forEach((col, index) => {
        col.order = index;
      });
      
      // IMPORTANT: Reorder the cells in ALL rows to match the new column order
      updatedSpreadsheet.rows.forEach(row => {
        // Create a new cells object with the reordered columns
        const reorderedCells: Record<string, any> = {};
        
        // Add cells in the new column order
        updatedSpreadsheet.columns.forEach(column => {
          if (row.cells[column.key]) {
            reorderedCells[column.key] = row.cells[column.key];
          }
        });
        
        // Replace the row's cells with the reordered version
        row.cells = reorderedCells;
      });
      
      updatedSpreadsheet.metadata.updatedAt = new Date();
      updatedSpreadsheet.metadata.version++;
      
      setSpreadsheet(updatedSpreadsheet);
      // Defer onDataChange to avoid React render cycle errors
      setTimeout(() => onDataChange(updatedSpreadsheet), 0);
      
      console.log(`🔄 Column "${draggedColumnKey}" moved to position ${targetIndex} - cells reordered to match`);
    }
    
    try { (e as any)._cleanupDragMove?.(); } catch {}
    destroyColumnDragPreview(draggedColumnKey);
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [spreadsheet, onDataChange, destroyColumnDragPreview]);

  const handleColumnDragEnd = useCallback(() => {
    destroyColumnDragPreview();
    setDraggedColumn(null);
    setDragOverColumn(null);
  }, [destroyColumnDragPreview]);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* CSS for unified column movement */}
      <style jsx>{`
        .dragging-column {
          opacity: 0.7;
          transform: rotate(1deg);
          z-index: 1000;
          transition: all 0.2s ease-in-out;
        }
        .column-preview {
          transition: transform 0.15s ease-out;
        }
      `}</style>
      
      {/* Toolbar */}
      <div className="relative">
        <SpreadsheetToolbar
        onAddRow={handleAddRow}
        onDeleteRows={handleDeleteRows}
        onCopy={handleCopy}
        onPaste={handlePaste}
        selectedCount={selectedCells.size}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        readOnly={readOnly}
        hiddenFieldsButton={(() => {
          const hiddenCount = spreadsheet.columns.filter((c: any) => c.hidden).length;
          return (
            <div className="relative">
              <button
                type="button"
                className={`hidden-fields-trigger inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 ${hiddenCount === 0 ? 'bg-blue-500/10' : 'bg-white'}`}
                onClick={(e) => { e.stopPropagation(); setShowHiddenFieldsMenu(v => !v); }}
                title="Show/Hide fields"
              >
                <svg className="w-4 h-4 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/>
                </svg>
                <span className="whitespace-nowrap">{hiddenCount} hidden fields</span>
              </button>
              {showHiddenFieldsMenu && (
                <div className="hidden-fields-menu absolute left-0 mt-2 w-64 max-h-80 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg p-2 z-[1500]" onClick={(e) => e.stopPropagation()}>
                  <div className="px-2 py-1 text-xs text-gray-500">Toggle fields</div>
                  <div className="my-1 h-px bg-gray-100"></div>
                  {spreadsheet.columns.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm text-gray-800">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={!(col as any).hidden}
                        onChange={(e) => handleToggleColumnHidden(col.key, !e.target.checked)}
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
        />

      </div>

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto border-4 border-gray-400 rounded-lg" ref={gridRef}>
        <div className="relative">
          {(() => {
            // Build unified columns: select, rownum, then data columns
            const dataColumns = spreadsheet.columns.filter(column => !(column as any).hidden);
            const allColumns: Array<{ key: string; label: string; width: number; kind: 'select'|'rownum'|'data'|'addcol'; column?: SpreadsheetColumn }>
              = [
                { key: '__select', label: 'Select', width: 48, kind: 'select' as const },
                { key: '__rownum', label: 'Row #', width: 64, kind: 'rownum' as const },
                ...dataColumns.map(col => ({ key: col.key, label: col.label, width: col.width || 128, kind: 'data' as const, column: col })),
                { key: '__addcol', label: '', width: 40, kind: 'addcol' as const }
              ];

            const stickyCount = 3; // first 3 frozen
            
            // Create CSS Grid template columns
            const gridTemplateColumns = allColumns.map(c => `${c.width}px`).join(' ');
            
            // Calculate sticky positions
            const leftOffsets: number[] = [];
            for (let i = 0; i < allColumns.length; i++) {
              if (i === 0) leftOffsets[i] = 0;
              else leftOffsets[i] = (i < stickyCount ? (leftOffsets[i-1] + allColumns[i-1].width) : 0);
            }

            return (
              <div 
                className="w-max"
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridTemplateColumns,
                  gridTemplateRows: `repeat(${filteredRows.length + 1}, minmax(3rem, auto))`,
                  borderCollapse: 'collapse',
                  border: '1px solid #d1d5db'
                }}
              >
                {/* Headers Row */}
                {allColumns.map((c, idx) => (
                  <div
                    key={`header-${c.key}`}
                    className={`relative min-h-[3rem] py-2 overflow-visible border-r border-b border-gray-300 bg-gray-100 flex items-center justify-between px-2 ${
                      idx === 0 ? 'border-l border-gray-300' : ''
                    } ${c.kind === 'data' && dragOverColumn === c.key ? 'bg-blue-100 border-l-2 border-blue-400' : ''
                    } ${c.kind === 'data' && draggedColumn === c.key ? 'opacity-50' : ''}`}
                    style={{ 
                      gridColumn: idx + 1,
                      gridRow: 1,
                      ...(idx < stickyCount ? { position: 'sticky', left: leftOffsets[idx], zIndex: 1000 - idx } : {})
                    }}
                    ref={c.kind === 'data' ? (el) => { columnRefs.current[c.key] = el; } : undefined}
                  >
                    <div className="flex items-center space-x-2">
                      {c.kind === 'addcol' ? (
                        <>
                          <button
                            type="button"
                            className="w-6 h-6 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
                            title="Add column"
                            onClick={(e) => { e.stopPropagation(); setShowAddColumnEditor(v => !v); }}
                          >
                            +
                          </button>
                        </>
                      ) : null}
                      {c.kind === 'data' && (
                        <svg className="w-4 h-4 text-gray-400 cursor-move" fill="currentColor" viewBox="0 0 20 20" onMouseDown={(e) => handleCustomColumnDragStart(e, c.key)}>
                          <path d="M7 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 2zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 7 14zm6-8a2 2 0 1 1-.001-4.001A2 2 0 0 1 13 6zm0 2a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 8zm0 6a2 2 0 1 1 .001 4.001A2 2 0 0 1 13 14z"/>
                        </svg>
                      )}
                      <div className="flex flex-col leading-tight">
                        {c.kind === 'addcol' ? (
                          <span className="text-sm font-medium text-gray-400">&nbsp;</span>
                        ) : (
                          <span className="text-sm font-medium text-gray-700">{c.label}</span>
                        )}
                        {c.kind === 'data' && (
                          <span className="text-[10px] text-gray-400">{toUiTypeName(c.column?.type as any)}</span>
                        )}
                      </div>
                    </div>
                    {c.kind === 'data' && (
                      <div className="relative flex items-center gap-1">
                        {/* Column menu button */}
                        <button
                          type="button"
                          className="p-1 text-gray-500 hover:text-gray-700"
                          onClick={(e) => { e.stopPropagation(); setOpenColumnMenu((prev) => prev === c.key ? null : c.key); }}
                          title="Column options"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5.23 7.21a.75.75 0 0 1 1.06 0L10 10.92l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.23 8.27a.75.75 0 0 1 0-1.06z" />
                          </svg>
                        </button>
                        {openColumnMenu === c.key && (
                          <div className="col-menu absolute right-0 top-7 z-[1200] w-44 rounded-md border border-gray-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <button className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); setSortConfig({ key: c.key, direction: 'asc' }); setOpenColumnMenu(null); }}>Sort A → Z</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); setSortConfig({ key: c.key, direction: 'desc' }); setOpenColumnMenu(null); }}>Sort Z → A</button>
                            <div className="my-1 h-px bg-gray-100"></div>
                            <button className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenColumnMenu(null); setTimeout(() => { editorOpenedAtRef.current = Date.now(); setOpenColumnEditor(c.key); }, 0); }}>Edit Field</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); handleColumnHide(c.key); setOpenColumnMenu(null); }}>Hide column</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-black hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); handleColumnDelete(c.key); setOpenColumnMenu(null); }}>Delete column</button>
                          </div>
                        )}
                      </div>
                    )}
                    {openColumnEditor === c.key && c.kind === 'data' && (
                      <div className="col-editor absolute left-2 top-12 z-[1300] w-80 rounded-md border border-gray-200 bg-white shadow-lg p-3" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-2">
                          <label className="block text-xs text-gray-500 mb-1">Field name</label>
                          <input
                            defaultValue={c.column?.label}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-black"
                            onKeyDown={(e) => { if (e.key === 'Enter') { const name = (e.target as HTMLInputElement).value; const type = (document.getElementById(`col-type-${c.key}`) as HTMLSelectElement)?.value; applyColumnEdit(c.key, name, type || 'Single Line Text'); setOpenColumnEditor(null); } }}
                            id={`col-name-${c.key}`}
                          />
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs text-gray-500 mb-1">Field type</label>
                          <select id={`col-type-${c.key}`} defaultValue={toUiTypeName(c.column?.type as any)} className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-black bg-white">
                            <option>Single Line Text</option>
                            <option>Long Text</option>
                            <option>Attachment</option>
                            <option>Checkbox</option>
                            <option>Multiple select</option>
                            <option>Email</option>
                            <option>Number</option>
                            <option>Created Time</option>
                            <option>Last Modified Time</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800" onClick={() => setOpenColumnEditor(null)}>Cancel</button>
                          <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded" onClick={() => { const name = (document.getElementById(`col-name-${c.key}`) as HTMLInputElement)?.value || c.column?.label || ''; const type = (document.getElementById(`col-type-${c.key}`) as HTMLSelectElement)?.value || 'Single Line Text'; applyColumnEdit(c.key, name, type); setOpenColumnEditor(null); }}>Save</button>
                        </div>
                      </div>
                    )}
                    {/* Add-column editor moved to modal */}
                    {c.kind === 'data' && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize transition-all duration-150 border-l border-transparent hover:border-blue-400"
                        onMouseDown={(e) => handleColumnResizeStart(e, c.key)}
                        title="Drag to resize column"
                      >
                        <div className="absolute right-0.5 top-1/2 transform -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity">
                          <div className="w-0.5 h-0.5 bg-blue-400 rounded-full mb-0.5"></div>
                          <div className="w-0.5 h-0.5 bg-blue-400 rounded-full mb-0.5"></div>
                          <div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Data Rows */}
                {filteredRows.map((row, rowIndex) => {
                  return allColumns.map((c, colIndex) => {
                    if (c.kind === 'select') {
                      return (
                        <div 
                          key={`sel-${row.id}`} 
                          className={`w-12 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 flex items-center justify-center ${
                            colIndex === 0 ? 'border-l border-gray-300' : ''
                          }`}
                          style={{ 
                            gridColumn: colIndex + 1,
                            gridRow: rowIndex + 2,
                            ...(colIndex < stickyCount ? { 
                              position: 'sticky', 
                              left: leftOffsets[colIndex], 
                              zIndex: 1000 - colIndex,
                              backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
                            } : {})
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCells.has(row.id)}
                            onChange={(e) => handleRowSelect(row.id, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                        </div>
                      );
                    }
                    if (c.kind === 'rownum') {
                      return (
                        <div 
                          key={`num-${row.id}`} 
                          className={`w-16 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 flex items-center justify-center text-sm text-gray-500 font-mono ${
                            colIndex === 0 ? 'border-l border-gray-300' : ''
                          }`}
                          style={{ 
                            gridColumn: colIndex + 1,
                            gridRow: rowIndex + 2,
                            ...(colIndex < stickyCount ? { 
                              position: 'sticky', 
                              left: leftOffsets[colIndex], 
                              zIndex: 1000 - colIndex,
                              backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
                            } : {})
                          }}
                        >
                          {rowIndex + 1}
                        </div>
                      );
                    }
                    if (c.kind === 'addcol') {
                      return (
                        <div 
                          key={`addcol-${row.id}`} 
                          className={`w-10 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 ${
                            colIndex === 0 ? 'border-l border-gray-300' : ''
                          }`}
                          style={{ 
                            gridColumn: colIndex + 1,
                            gridRow: rowIndex + 2
                          }}
                        ></div>
                      );
                    }
                    const col = c.column!;
                    const cell = row.cells[col.key];
                    const cellId = `${row.id}:${col.key}`;
                    const centerCell = col.type === 'number' || col.type === 'boolean';
                    return (
                      <div
                        key={`${col.key}-${row.id}`}
                        className={`min-h-[3rem] py-2 border-r border-b border-gray-300 flex items-start ${centerCell ? 'justify-center' : ''} ${
                          rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } ${draggedColumn === col.key ? 'opacity-50' : ''} ${
                          colIndex === 0 ? 'border-l border-gray-300' : ''
                        }`}
                        style={{ 
                          gridColumn: colIndex + 1,
                          gridRow: rowIndex + 2,
                          ...(colIndex < stickyCount ? { 
                            position: 'sticky', 
                            left: leftOffsets[colIndex], 
                            zIndex: 1000 - colIndex,
                            backgroundColor: rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
                          } : {})
                        }}
                      >
                        <EditableCell
                          cell={cell}
                          column={col}
                          isEditing={editingCell === cellId}
                          onEdit={() => {
                            // Don't allow text editing for image cells - they should only show the modal
                            if (col.type === 'image' || col.key === 'imageURL') {
                              return;
                            }
                            setEditingCell(cellId);
                          }}
                          onSave={(value: any) => {
                            handleCellChange(row.id, col.key, value);
                            setEditingCell(null);
                          }}
                          onCancel={() => setEditingCell(null)}
                          readOnly={false}
                          productId={row.id}
                        />
                      </div>
                    );
                  });
                })}

                {/* Add-row last line */}
                {allColumns.map((c, colIndex) => {
                  if (c.kind === 'select') {
                    return (
                      <div 
                        key={`addrow-sel-${colIndex}`} 
                        className={`w-12 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 ${
                          colIndex === 0 ? 'border-l border-gray-300' : ''
                        }`}
                        style={{ 
                          gridColumn: colIndex + 1,
                          gridRow: filteredRows.length + 2,
                          ...(colIndex < stickyCount ? { 
                            position: 'sticky', 
                            left: leftOffsets[colIndex], 
                            zIndex: 1000 - colIndex
                          } : {})
                        }}
                      />
                    );
                  }
                  if (c.kind === 'rownum' && showAddRowAtEnd && filteredRows.length === spreadsheet.rows.length) {
                    return (
                      <div 
                        key={`addrow-num-${colIndex}`} 
                        className={`w-16 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 flex items-center justify-center ${
                          colIndex === 0 ? 'border-l border-gray-300' : ''
                        }`}
                        style={{ 
                          gridColumn: colIndex + 1,
                          gridRow: filteredRows.length + 2,
                          ...(colIndex < stickyCount ? { 
                            position: 'sticky', 
                            left: leftOffsets[colIndex], 
                            zIndex: 1000 - colIndex
                          } : {})
                        }}
                      >
                        <button
                          type="button"
                          className="w-6 h-6 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center"
                          title="Add row"
                          onClick={handleAddRow}
                        >
                          +
                        </button>
                      </div>
                    );
                  }
                  if (c.kind === 'data') {
                    return (
                      <div 
                        key={`addrow-data-${colIndex}`} 
                        className={`min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 ${
                          colIndex === 0 ? 'border-l border-gray-300' : ''
                        }`}
                        style={{ 
                          gridColumn: colIndex + 1,
                          gridRow: filteredRows.length + 2,
                          ...(colIndex < stickyCount ? { 
                            position: 'sticky', 
                            left: leftOffsets[colIndex], 
                            zIndex: 1000 - colIndex
                          } : {})
                        }}
                      />
                    );
                  }
                  if (c.kind === 'addcol') {
                    return (
                      <div 
                        key={`addrow-addcol-${colIndex}`} 
                        className={`w-10 min-h-[3rem] py-2 border-r border-b border-gray-300 bg-gray-50 ${
                          colIndex === 0 ? 'border-l border-gray-300' : ''
                        }`}
                        style={{ 
                          gridColumn: colIndex + 1,
                          gridRow: filteredRows.length + 2
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            );
          })()}
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddColumnEditor && (
        <div className="fixed inset-0 z-[1400] bg-black/40 flex items-center justify-center" onClick={() => setShowAddColumnEditor(false)}>
          <div className="addcol-editor bg-white rounded-lg shadow-2xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-semibold text-gray-900">Add Field</h3>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => setShowAddColumnEditor(false)}>✕</button>
            </div>
            <div className="mb-2">
              <label className="block text-xs text-gray-500 mb-1">Field name</label>
              <input id="new-col-name" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-black" defaultValue="" />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1">Field type</label>
              <select id="new-col-type" className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-black bg-white" defaultValue="Single Line Text">
                <option>Single Line Text</option>
                <option>Long Text</option>
                <option>Attachment</option>
                <option>Checkbox</option>
                <option>Multiple select</option>
                <option>Email</option>
                <option>Number</option>
                <option>Created Time</option>
                <option>Last Modified Time</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800" onClick={() => setShowAddColumnEditor(false)}>Cancel</button>
              <button className="px-3 py-1 text-sm bg-green-600 text-white rounded" onClick={handleConfirmAddColumn}>Add Field</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
        <div>
          {filteredRows.length} of {spreadsheet.rows.length} rows
          {selectedCells.size > 0 && ` • ${selectedCells.size} selected`}
        </div>
        <div>
          Last updated {new Date(spreadsheet.metadata.updatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}