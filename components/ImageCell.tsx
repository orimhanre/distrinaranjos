'use client';

import React, { useState, useRef } from 'react';
import { ImageData } from '@/types/spreadsheet';

interface ImageCellProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  readOnly: boolean;
}

interface ImageModalProps {
  images: string[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (index: number) => void;
  readOnly: boolean;
}

// Image Modal Component
function ImageModal({ images, initialIndex, onClose, onDelete, readOnly }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = () => {
    if (!readOnly) {
      onDelete(currentIndex);
      if (images.length === 1) {
        onClose();
      } else if (currentIndex === images.length - 1) {
        setCurrentIndex(currentIndex - 1);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Delete' && !readOnly) handleDelete();
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Main Image */}
      <div className="relative max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all z-10"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Delete Button */}
        {!readOnly && (
          <button
            onClick={handleDelete}
            className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-all z-10"
            title="Delete photo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-full transition-all z-10"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Current Image */}
        <img
          src={images[currentIndex]}
          alt={`Photo ${currentIndex + 1}`}
          className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
        />

        {/* Image Counter */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
          {currentIndex + 1} of {images.length}
        </div>
      </div>

      {/* Thumbnail Previews */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                index === currentIndex 
                  ? 'border-blue-400 scale-110' 
                  : 'border-transparent hover:border-gray-400'
              }`}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ImageCell({ images, onImagesChange, readOnly }: ImageCellProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (files: FileList) => {
    if (readOnly) return;
    
    setIsUploading(true);
    const newImages: string[] = [...images];
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          // For now, we'll use a simple approach - convert to data URL
          // In production, you'd want to upload to a proper storage service
          const dataUrl = await convertFileToDataUrl(file);
          newImages.push(dataUrl);
        }
      }
      
      onImagesChange(newImages);
    } catch (error) {
      console.error('Error uploading images:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const convertFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    if (readOnly) return;
    
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleImageClick = (index: number) => {
    setModalImageIndex(index);
    setShowModal(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-100');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-100');
  };

  const handleDrop = (e: React.DragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-100');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageUpload(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleImageUpload(e.target.files);
    }
  };

  const openFileDialog = () => {
    if (!readOnly && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <>
      <div className="w-full h-full p-1">
        <div
          className={`w-full h-full border-2 border-dashed border-gray-300 rounded-lg p-2 transition-colors ${
            readOnly ? 'cursor-default' : 'cursor-pointer hover:border-blue-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Content */}
          {images.length > 0 ? (
            <div className="flex flex-wrap gap-1 justify-center items-center h-full">
              {/* Photo Thumbnails */}
              {images.slice(0, 4).map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Photo ${index + 1}`}
                    className="w-8 h-8 object-cover rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-all"
                    onClick={() => handleImageClick(index)}
                    title="Click to view full screen"
                  />
                  {!readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(index);
                      }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-600"
                      title="Delete photo"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              
              {/* More photos indicator */}
              {images.length > 4 && (
                <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  +{images.length - 4}
                </div>
              )}

              {/* Attachment Icon for adding more */}
              {!readOnly && (
                <button
                  onClick={openFileDialog}
                  className="w-8 h-8 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded border border-blue-300 flex items-center justify-center transition-all"
                  title="Add more photos"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              {isUploading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              ) : (
                <>
                  <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xs">Add photos</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image Modal */}
      {showModal && (
        <ImageModal
          images={images}
          initialIndex={modalImageIndex}
          onClose={() => setShowModal(false)}
          onDelete={handleRemoveImage}
          readOnly={readOnly}
        />
      )}
    </>
  );
}
