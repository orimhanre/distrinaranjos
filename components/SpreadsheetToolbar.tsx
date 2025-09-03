'use client';

import React from 'react';

interface SpreadsheetToolbarProps {
  onAddRow: () => void;
  onDeleteRows: () => void;
  onCopy: () => void;
  onPaste: () => void;
  selectedCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  readOnly: boolean;
  hiddenFieldsButton?: React.ReactNode;
}

export default function SpreadsheetToolbar({
  onAddRow,
  onDeleteRows,
  onCopy,
  onPaste,
  selectedCount,
  searchQuery,
  onSearchChange,
  readOnly,
  hiddenFieldsButton
}: SpreadsheetToolbarProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200">
      {/* Left side - Actions */}
      <div className="flex items-center space-x-2">
        {/* Delete Rows Button */}
        <button
          onClick={onDeleteRows}
          disabled={selectedCount === 0 || readOnly}
          className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span>Delete ({selectedCount})</span>
        </button>
        
        {/* Divider removed */}
      </div>

      {/* Right side - Hidden fields + Search */}
      <div className="flex items-center space-x-3">
        {hiddenFieldsButton}
        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* (Export and Settings removed) */}
      </div>
    </div>
  );
}
