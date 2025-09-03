'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SpreadsheetCell, SpreadsheetColumn } from '@/types/spreadsheet';
import EnhancedImageCell from './EnhancedImageCell';

interface EditableCellProps {
  cell: SpreadsheetCell;
  column: SpreadsheetColumn;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: any) => void;
  onCancel: () => void;
  readOnly: boolean;
  productId?: string;
}

// Helper function to format price values in European format (100.000,00)
const formatPrice = (value: any): string => {
  if (!value) return '';
  
  let numValue: number;
  
  if (typeof value === 'string') {
    // If it's already formatted as European style (100.000,00), extract the number
    if (value.includes('.') && value.includes(',')) {
      // Remove dots and replace comma with dot for parsing
      numValue = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    } else {
      // Regular string parsing
      numValue = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.'));
    }
  } else {
    numValue = Number(value);
  }
  
  if (isNaN(numValue)) {
    return String(value);
  }
  
  // Format to European style: 100.000,00
  return numValue.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

export default function EditableCell({
  cell,
  column,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  readOnly,
  productId
}: EditableCellProps) {
  const [editValue, setEditValue] = useState<any>(cell.value);
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);



  // Reset edit value when cell changes
  useEffect(() => {
    setEditValue(cell.value);
  }, [cell.value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Validate input based on column type and validation rules
  const validateInput = (value: any): boolean => {
    if (column.validation?.required && (!value || value === '')) {
      return false;
    }

    switch (column.type) {
      case 'number':
        if (isNaN(Number(value))) return false;
        if (column.validation?.min !== undefined && Number(value) < column.validation.min) return false;
        if (column.validation?.max !== undefined && Number(value) > column.validation.max) return false;
        break;
      
      case 'boolean':
        return typeof value === 'boolean';
      
      case 'date':
        const date = new Date(value);
        return !isNaN(date.getTime());
      
      case 'select':
        if (column.validation?.options && !column.validation.options.includes(value)) {
          return false;
        }
        break;
    }

    return true;
  };

  const handleSave = () => {
    if (validateInput(editValue)) {
      if (column.key === 'price') {
        handlePriceSave();
      } else {
        onSave(editValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        handleSave();
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case 'Tab':
        e.preventDefault();
        handleSave();
        break;
    }
  };

  const handleChange = (value: any) => {
    setEditValue(value);
    setIsValid(validateInput(value));
  };

  // Handle price formatting when saving
  const handlePriceSave = () => {
    if (column.key === 'price' && editValue) {
      // Convert European format back to number for storage
      let cleanValue: string;
      
      if (typeof editValue === 'string') {
        cleanValue = editValue.replace(/[^\d.,]/g, '').replace(',', '.');
      } else if (typeof editValue === 'number') {
        // If it's already a number, use it directly
        onSave(editValue);
        return;
      } else {
        // Fallback: convert to string first
        cleanValue = String(editValue).replace(/[^\d.,]/g, '').replace(',', '.');
      }
      
      const numValue = parseFloat(cleanValue);
      if (!isNaN(numValue)) {
        onSave(numValue);
        return;
      }
    }
    onSave(editValue);
  };

  // Render different cell types
  const renderCellContent = () => {
    if (isEditing) {
      return renderEditInput();
    }

    switch (column.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-center h-full">
            <input
              type="checkbox"
              checked={Boolean(cell.value)}
              onChange={(e) => {
                e.stopPropagation();
                onSave(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4"
            />
          </div>
        );
      
      case 'image':
        return (
          <EnhancedImageCell
            images={Array.isArray(cell.value) ? cell.value.map((imageData: any) => {
              if (typeof imageData === 'string') {
                // If it's a string URL, extract filename from the URL
                const filename = imageData.split('/').pop() || 'image';
                return {
                  url: imageData,
                  size: undefined,
                  mimeType: undefined,
                  filename: filename,
                  publicId: undefined
                };
              } else {
                // If it's an object, use the existing fields
                return {
                  url: imageData.url,
                  size: imageData.size,
                  mimeType: imageData.mimeType,
                  filename: imageData.filename,
                  publicId: imageData.publicId
                };
              }
            }) : []}
            onImagesChange={(transformedImages) => {
              
              // Ensure transformedImages is valid
              if (!Array.isArray(transformedImages) || transformedImages.length === 0) {
                console.warn('⚠️ EnhancedImageCell: Invalid transformedImages:', transformedImages);
                return;
              }
              
              // Convert back to the original format that the parent expects
              const originalFormatImages = transformedImages.map((transformedImage: any) => {
                // Validate transformedImage
                if (!transformedImage || !transformedImage.url) {
                  console.warn('⚠️ EnhancedImageCell: Invalid transformedImage:', transformedImage);
                  return null;
                }
                
                // Find the original image data
                const originalImage = Array.isArray(cell.value) ? cell.value.find((img: any) => 
                  (typeof img === 'string' && img === transformedImage.url) ||
                  (typeof img === 'object' && img.url === transformedImage.url)
                ) : null;
                
                if (originalImage && typeof originalImage === 'string') {
                  // If original was a string, convert to object format for consistency
                  // This allows new images to be added properly
                  return {
                    url: transformedImage.url,
                    size: transformedImage.size,
                    mimeType: transformedImage.mimeType,
                    filename: transformedImage.filename,
                    publicId: transformedImage.publicId
                  };
                } else if (originalImage && typeof originalImage === 'object' && originalImage !== null) {
                  // If original was an object, preserve all fields including filename changes
                  const result = {
                    ...(originalImage as Record<string, any>),
                    filename: transformedImage.filename
                  };
                  return result;
                } else {
                  // Fallback: return the transformed image as-is
                  return transformedImage;
                }
              }).filter(Boolean); // Remove any null entries
              
              console.log('🔍 EditableCell: Saving images:', originalFormatImages);
              onSave(originalFormatImages);
            }}
            readOnly={readOnly}
            productId={productId}
            fieldName={column.key}
          />
        );
      
      case 'select':
        return (
          <div className="px-2 py-1 text-sm text-black break-words leading-relaxed w-full">
            {cell.value || ''}
          </div>
        );
      
      case 'multipleSelect':
        return (
          <div className="px-2 py-1 text-sm text-black break-words leading-relaxed w-full">
            {Array.isArray(cell.value) ? cell.value.join(', ') : cell.value || ''}
          </div>
        );
      
      case 'date':
        return (
          <div className="px-2 py-1 text-sm text-black break-words leading-relaxed w-full">
            {cell.value && (typeof cell.value === 'string' || typeof cell.value === 'number') ? 
              new Date(cell.value).toLocaleDateString() : ''}
          </div>
        );
      
      case 'phone':
        return (
          <div className="px-2 py-1 text-sm text-black break-words leading-relaxed w-full">
            {cell.value || ''}
          </div>
        );
      
      case 'email':
        return (
          <div className="px-2 py-1 text-sm text-black break-words leading-relaxed w-full">
            {cell.value || ''}
          </div>
        );
      
      case 'number':
        // Special formatting for price fields
        if (column.key === 'price' && cell.value) {
          const formattedPrice = formatPrice(cell.value);
          return (
            <div className="px-2 py-1 text-sm truncate text-black flex items-center justify-center">
              <span>{formattedPrice}</span>
            </div>
          );
        }
        
        // Regular number fields
        return (
          <div className="px-2 py-1 text-sm truncate text-black flex items-center justify-center">
            <span>{String(cell.value || '')}</span>
          </div>
        );
      
      case 'createdTime':
      case 'lastModifiedTime':
        return (
          <div className="px-2 py-1 text-sm text-gray-500 break-words leading-relaxed w-full">
            {cell.value && (typeof cell.value === 'string' || typeof cell.value === 'number') ? 
              new Date(cell.value).toLocaleString() : ''}
          </div>
        );
      
      default:
        return (
          <div className="px-2 py-1 text-sm text-black flex items-start justify-between w-full">
            <span className="break-words leading-relaxed flex-1">{String(cell.value || '')}</span>
            {!readOnly && (
              <svg className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.25 2.25 0 113.182 3.182L8.25 18.463 4.5 19.5l1.037-3.75L16.862 3.487z" />
              </svg>
            )}
          </div>
        );
    }
  };

  const renderEditInput = () => {
    switch (column.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-center h-full">
            <input
              type="checkbox"
              checked={Boolean(editValue)}
              onChange={(e) => {
                e.stopPropagation();
                handleChange(e.target.checked);
                onSave(e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4"
            />
          </div>
        );
      
      case 'select':
        return (
          <select
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full px-2 py-1 text-sm border-none outline-none bg-transparent text-black"
          >
            <option value="">Select...</option>
            {column.validation?.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case 'multipleSelect':
        return (
          <input
            ref={inputRef}
            type="text"
            value={Array.isArray(editValue) ? editValue.join(', ') : editValue || ''}
            onChange={(e) => handleChange(e.target.value.split(',').map(s => s.trim()).filter(s => s))}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="Enter values separated by commas"
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
      
      case 'date':
        return (
          <input
            ref={inputRef}
            type="date"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
      
      case 'phone':
        return (
          <input
            ref={inputRef}
            type="tel"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="Enter phone number"
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
      
      case 'email':
        return (
          <input
            ref={inputRef}
            type="email"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder="Enter email address"
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
      
      case 'number':
        // Special handling for price fields
        if (column.key === 'price') {
          return (
            <input
              ref={inputRef}
              type="text"
              value={editValue || ''}
              onChange={(e) => {
                // Allow only numbers, dots, and commas
                const value = e.target.value.replace(/[^\d.,]/g, '');
                handleChange(value);
              }}
              onKeyDown={handleKeyDown}
              onBlur={handlePriceSave}
              placeholder="0,00"
              className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
                isValid ? 'bg-blue-50' : 'bg-red-50'
              }`}
            />
          );
        }
        
        return (
          <input
            ref={inputRef}
            type="number"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            min={column.validation?.min}
            max={column.validation?.max}
            step="any"
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
      
      case 'createdTime':
      case 'lastModifiedTime':
        return (
          <div className="px-2 py-1 text-sm text-gray-500">
            {editValue ? new Date(editValue).toLocaleString() : 'Auto-generated'}
          </div>
        );
      
      default:
        return (
          <input
            ref={inputRef}
            type="text"
            value={editValue || ''}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className={`w-full h-full px-2 py-1 text-sm border-none outline-none text-black ${
              isValid ? 'bg-blue-50' : 'bg-red-50'
            }`}
          />
        );
    }
  };

  const isCenteredType = column.type === 'number' || column.type === 'boolean';
  return (
    <div
      className={`h-10 flex items-center ${isCenteredType ? 'justify-center' : ''} cursor-pointer hover:bg-gray-100 border-0 hover:border-blue-300 group relative ${
        isEditing ? 'bg-blue-50 border-blue-400' : ''
      } ${!isValid ? 'bg-red-50 border-red-400' : ''}`}
      onClick={() => !readOnly && !isEditing && onEdit()}
      title={readOnly ? 'Read only' : 'Click to edit'}
    >
      {/* Ensure cell background is transparent to show row background */}
      <div className="absolute inset-0 bg-transparent"></div>
      <div className={`relative z-10 w-full h-full flex items-center ${isCenteredType ? 'justify-center' : ''}`}>
        {renderCellContent()}
      </div>
    </div>
  );
}
