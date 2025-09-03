'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SpreadsheetColumn } from '@/types/spreadsheet';
import { createPortal } from 'react-dom';

interface SpreadsheetHeaderProps {
  columns: SpreadsheetColumn[];
  onSort: (columnKey: string) => void;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  readOnly: boolean;
  onColumnResize?: (columnKey: string, newWidth: number) => void;
  onColumnTypeChange?: (columnKey: string, newType: string, newLabel: string) => void;
  onColumnLabelChange?: (columnKey: string, newLabel: string) => void;
  onColumnDuplicate?: (columnKey: string) => void;
  onColumnHide?: (columnKey: string) => void;
  onColumnDelete?: (columnKey: string) => void;
  onColumnDragStart?: (e: React.DragEvent, columnKey: string) => void;
  onColumnDragOver?: (e: React.DragEvent, columnKey: string) => void;
  onColumnDrop?: (e: React.DragEvent, columnKey: string) => void;
  onColumnDragEnd?: () => void;
}

export default function SpreadsheetHeader({
  columns,
  onSort,
  sortConfig,
  readOnly,
  onColumnResize,
  onColumnTypeChange,
  onColumnLabelChange,
  onColumnDuplicate,
  onColumnHide,
  onColumnDelete,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDrop,
  onColumnDragEnd
}: SpreadsheetHeaderProps) {
  const [showColumnMenu, setShowColumnMenu] = useState<string | null>(null);
  const [showEditFieldModal, setShowEditFieldModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [resizing, setResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [editFieldType, setEditFieldType] = useState<string | null>(null);
  const [editFieldLabel, setEditFieldLabel] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ left: number; top: number } | null>(null);
  
  // Refs for column elements
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Calculate dropdown position when menu opens
  const calculateDropdownPosition = (columnKey: string) => {
    const columnElement = columnRefs.current[columnKey];
    if (columnElement) {
      const rect = columnElement.getBoundingClientRect();
      const dropdownWidth = 192; // min-w-48 = 12rem = 192px
      const dropdownHeight = 200; // Approximate height
      
      // Calculate initial position
      let left = rect.left;
      let top = rect.bottom + 8;
      
      // Ensure dropdown doesn't go off the right edge
      if (left + dropdownWidth > window.innerWidth) {
        left = Math.max(0, window.innerWidth - dropdownWidth - 8);
      }
      
      // Ensure dropdown doesn't go off the bottom edge
      if (top + dropdownHeight > window.innerHeight) {
        top = rect.top - dropdownHeight - 8;
      }
      
      // Ensure dropdown doesn't go off the left edge
      if (left < 0) {
        left = 8;
      }
      
      // Ensure dropdown doesn't go off the top edge
      if (top < 0) {
        top = 8;
      }
      
      setDropdownPosition({ left, top });
    }
  };

  // Handle opening column menu
  const handleOpenColumnMenu = (columnKey: string) => {
    if (showColumnMenu === columnKey) {
      setShowColumnMenu(null);
      setDropdownPosition(null);
    } else {
      setShowColumnMenu(columnKey);
      // Use setTimeout to ensure DOM is updated before calculating position
      setTimeout(() => calculateDropdownPosition(columnKey), 0);
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig?.key !== columnKey) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    if (sortConfig.direction === 'asc') {
      return (
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }

    return (
      <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Handle column resizing
  const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault();
    const column = columns.find(col => col.key === columnKey);
    if (column && onColumnResize) {
      setResizing(columnKey);
      setStartX(e.clientX);
      setStartWidth(column.width || 128); // Default width if not set
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (resizing && onColumnResize) {
      const deltaX = e.clientX - startX;
      const newWidth = Math.max(80, startWidth + deltaX); // Minimum width of 80px
      onColumnResize(resizing, newWidth);
    }
  };

  const handleMouseUp = () => {
    setResizing(null);
  };

  // Cleanup dropdown position when menu closes
  useEffect(() => {
    if (!showColumnMenu) {
      setDropdownPosition(null);
    }
  }, [showColumnMenu]);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (resizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizing, startX, startWidth]);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColumnMenu && !(event.target as Element).closest('[data-column]')) {
        setShowColumnMenu(null);
        setDropdownPosition(null);
      }
    };

    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColumnMenu]);

  // Handle window resize to recalculate dropdown position
  useEffect(() => {
    const handleResize = () => {
      if (showColumnMenu && dropdownPosition) {
        const columnKey = showColumnMenu;
        setTimeout(() => calculateDropdownPosition(columnKey), 0);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showColumnMenu, dropdownPosition]);

  const getColumnTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        );
      case 'number':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'boolean':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'image':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'select':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        );
      case 'date':
        return (
          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Resize indicator line */}
      {resizing && (
        <div 
          className="fixed top-0 bottom-0 w-0.5 bg-blue-500 z-50 pointer-events-none"
          style={{ 
            left: `${startX + startWidth}px`,
            transform: 'translateX(-50%)'
          }}
        />
      )}
      <div className="flex">
        {/* Row selector header */}
        <div className="w-12 flex items-center justify-center border-r border-gray-200 bg-gray-200 flex-shrink-0">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            title="Select all rows"
          />
        </div>

        {/* Row number header */}
        <div className="w-16 flex items-center justify-center border-r border-gray-200 bg-gray-200 text-sm text-gray-500 font-mono flex-shrink-0">
          <span className="min-w-[2rem] text-center">#</span>
        </div>

        {/* Column headers */}
        {columns
          .filter(column => !(column as any).hidden) // Filter out hidden columns
          .map((column, index) => (
          <div
            key={column.key}
            data-column={column.key}
            className="border-r border-gray-300 bg-gray-200 relative flex-shrink-0 group cursor-move"
            style={{ 
              width: `${column.width || 128}px`, 
              minWidth: '80px',
              maxWidth: `${column.width || 128}px`
            }}
            ref={(el) => { columnRefs.current[column.key] = el; }}
            draggable={!readOnly}
            onDragStart={(e) => onColumnDragStart?.(e, column.key)}
            onDragOver={(e) => onColumnDragOver?.(e, column.key)}
            onDrop={(e) => onColumnDrop?.(e, column.key)}
            onDragEnd={onColumnDragEnd}
          >
            <div className="flex items-center justify-between p-2 h-10">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                {/* Drag handle indicator */}
                {!readOnly && (
                  <div className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-move">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>
                )}
                
                {/* Column type icon */}
                {getColumnTypeIcon(column.type)}
                
                {/* Column label - clickable to show menu */}
                <button
                  onClick={() => handleOpenColumnMenu(column.key)}
                  className="text-sm font-medium text-black truncate hover:text-blue-600 focus:outline-none focus:text-blue-600 flex items-center space-x-1"
                  title={`Click to edit ${column.label}`}
                >
                  <span>{column.label}</span>
                  <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Required indicator */}
                {column.required && (
                  <span className="text-red-500 text-xs">*</span>
                )}
              </div>

              {/* Sort button */}
              {column.sortable && (
                <button
                  onClick={() => onSort(column.key)}
                  className="ml-2 p-1 hover:bg-gray-300 rounded transition-colors"
                  title={`Sort by ${column.label}`}
                >
                  {getSortIcon(column.key)}
                </button>
              )}

              {/* Column menu button */}
              {!readOnly && (
                <button
                  onClick={() => handleOpenColumnMenu(column.key)}
                  className="ml-1 p-1 hover:bg-gray-300 rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Column options"
                >
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 hover:w-1.5 transition-all duration-150 group border-l border-gray-300"
              onMouseDown={(e) => handleMouseDown(e, column.key)}
              title="Drag to resize column"
            >
              {/* Resize indicator dots */}
              <div className="absolute right-0.5 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-0.5 h-0.5 bg-blue-400 rounded-full mb-0.5"></div>
                <div className="w-0.5 h-0.5 bg-blue-400 rounded-full mb-0.5"></div>
                <div className="w-0.5 h-0.5 bg-blue-400 rounded-full"></div>
              </div>
            </div>

            {/* Column menu dropdown */}
            {showColumnMenu === column.key && dropdownPosition && createPortal(
              <div className="fixed bg-white border border-gray-200 rounded-lg shadow-2xl py-1 min-w-48" style={{
                left: dropdownPosition.left,
                top: dropdownPosition.top,
                position: 'fixed',
                zIndex: 2147483647,
                isolation: 'isolate',
                willChange: 'transform',
                transform: 'translateZ(0)'
              }}>
                <button 
                  onClick={() => {
                    setShowColumnMenu(null);
                    setShowEditFieldModal(column.key);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h5.586a1 1 0 00.293.707V19a2 2 0 00-2 2z" />
                  </svg>
                  <span>Edit Field</span>
                </button>
                
                <button 
                  onClick={() => {
                    setShowColumnMenu(null);
                    if (onColumnDuplicate) {
                      onColumnDuplicate(column.key);
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Duplicate Field</span>
                </button>
                
                <button 
                  onClick={() => {
                    setShowColumnMenu(null);
                    if (onColumnHide) {
                      onColumnHide(column.key);
                    }
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-black hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                  <span>Hide Field</span>
                </button>
                
                <hr className="my-1" />
                
                <button 
                  onClick={() => {
                    setShowColumnMenu(null);
                    setShowDeleteConfirm(column.key);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete Field</span>
                </button>
              </div>,
              document.body
            )}
          </div>
        ))}
      </div>

      {/* Edit Field Modal */}
      {showEditFieldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Field: {columns.find(col => col.key === showEditFieldModal)?.label}
              </h3>
              <button
                onClick={() => setShowEditFieldModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Field Type Selection */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Field Type
                </label>
                <select
                  value={columns.find(col => col.key === showEditFieldModal)?.type || 'text'}
                  onChange={(e) => {
                    if (onColumnTypeChange) {
                      onColumnTypeChange(showEditFieldModal, e.target.value, columns.find(col => col.key === showEditFieldModal)?.label || '');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="text">Single line text</option>
                  <option value="longText">Long text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Checkbox</option>
                  <option value="select">Single select</option>
                  <option value="multipleSelect">Multiple select</option>
                  <option value="date">Date</option>
                  <option value="phone">Phone number</option>
                  <option value="email">Email</option>
                  <option value="image">Attachment</option>
                  <option value="createdTime">Created time</option>
                  <option value="lastModifiedTime">Last modified time</option>
                </select>
              </div>

              {/* Field Label */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Field Label
                </label>
                <input
                  type="text"
                  value={columns.find(col => col.key === showEditFieldModal)?.label || ''}
                  onChange={(e) => {
                    if (onColumnLabelChange) {
                      onColumnLabelChange(showEditFieldModal, e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  placeholder="Enter field label"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowEditFieldModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowEditFieldModal(null)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Delete Field
              </h3>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to delete the field "{columns.find(col => col.key === showDeleteConfirm)?.label}"? 
                This action cannot be undone and will remove all data in this column.
              </p>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (onColumnDelete) {
                      onColumnDelete(showDeleteConfirm);
                    }
                    setShowDeleteConfirm(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete Field
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
