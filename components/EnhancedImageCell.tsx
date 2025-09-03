'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ImageData {
  url: string;
  publicId?: string;
  size?: number;
  mimeType?: string;
  filename?: string;
}

interface EnhancedImageCellProps {
  images: ImageData[];
  onImagesChange: (images: ImageData[]) => void;
  readOnly?: boolean;
  productId?: string;
  fieldName?: string;
}

interface ImageModalProps {
  images: ImageData[];
  initialIndex: number;
  onClose: () => void;
  onDelete: (index: number) => void;
  onNameChange: (index: number, newFilename: string) => void;
}

// Enhanced Beautiful Image Modal Component
function ImageModal({ images, initialIndex, onClose, onDelete, onNameChange }: ImageModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  // Removed file-size estimation per user request

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowLeft') handlePrevious();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Delete') handleDelete();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [currentIndex]);

  // No file-size fetching/estimation

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 200);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDelete = () => {
    onDelete(currentIndex);
    if (images.length === 1) {
      handleClose();
    } else if (currentIndex === images.length - 1) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  const handleSaveName = () => {
    if (editingName.trim()) {
      // Call the callback to update the parent component
      onNameChange(currentIndex, editingName.trim());
      setIsEditingName(false);
    } else {
      setIsEditingName(false);
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <div 
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Main Modal */}
      <div className="relative h-full flex items-center justify-center p-8">
        <div className="relative max-w-6xl w-full max-h-full h-full flex">
          {/* Main Content Area - White background like Airtable */}
          <div className="flex-1 bg-white rounded-lg shadow-2xl relative overflow-hidden">
            {/* Close button - top right of white content area */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-30 w-8 h-8 bg-white/90 text-black rounded-full shadow-lg border border-gray-200 hover:bg-gray-100 transition"
              aria-label="Close"
            >
              <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main Image Container */}
            <div className="flex-1 flex items-center justify-center relative p-8">
              {/* Navigation Arrows - outside the photo */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={handlePrevious}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 group z-20"
                  >
                    <div className="w-12 h-12 bg-black/60 hover:bg-black/70 text-white rounded-full transition-all duration-300 hover:scale-110 border border-black/50 shadow-lg flex items-center justify-center">
                      <svg className="w-7 h-7 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </div>
                  </button>

                  <button
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 group z-20"
                  >
                    <div className="w-12 h-12 bg-black/60 hover:bg-black/70 text-white rounded-full transition-all duration-300 hover:scale-110 border border-black/50 shadow-lg flex items-center justify-center">
                      <svg className="w-7 h-7 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                </>
              )}

              {/* Main Image */}
              <div className="relative max-w-full max-h-full">
                <div className={`transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                  <img
                    src={images[currentIndex]?.url}
                    alt={`Photo ${currentIndex + 1}`}
                    className="max-w-full max-h-[70vh] object-contain"
                    onLoad={handleImageLoad}
                    style={{ maxHeight: 'calc(100vh - 300px)' }}
                  />
                </div>
                
                {/* Loading indicator */}
                {!isLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-400"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Bar - Photo name and Download button */}
            <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-4 flex items-center justify-between">
              {/* Editable Photo name on the left */}
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    className="text-sm text-gray-800 font-medium bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 font-medium">
                      {images[currentIndex]?.filename || images[currentIndex]?.url.split('/').pop() || `Photo ${currentIndex + 1}`}
                    </span>
                    {/* Only show edit button if the image has a filename field (object-based) */}
                    {images[currentIndex]?.filename !== undefined ? (
                      <button
                        onClick={() => {
                          setEditingName(images[currentIndex]?.filename || images[currentIndex]?.url.split('/').pop() || `Photo ${currentIndex + 1}`);
                          setIsEditingName(true);
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-200 rounded"
                        title="Edit name"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.862 3.487a2.25 2.25 0 113.182 3.182L8.25 18.463 4.5 19.5l1.037-3.75L16.862 3.487z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 ml-2" title="Filename editing not available for this image type">
                        (read-only)
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              {/* Download button on the right */}
              <button
                onClick={() => {
                  const imageUrl = images[currentIndex]?.url;
                  if (!imageUrl) return;
                  
                  // Simple and reliable download method
                  const link = document.createElement('a');
                  link.href = imageUrl;
                  link.target = '_blank';
                  link.download = `image-${currentIndex + 1}.jpg`;
                  
                  // For mobile devices, try to force download
                  link.setAttribute('download', '');
                  link.setAttribute('target', '_blank');
                  
                  // Trigger download
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                Descargar
              </button>
            </div>

            {/* Photo Previews and Delete Button */}
            <div className="absolute bottom-20 left-0 right-0 p-4">
              <div className="relative">
                {/* Centered thumbnail previews (only if multiple images) */}
                {images.length > 1 && (
                  <div className="flex gap-3 justify-center">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setCurrentIndex(index);
                          setIsLoaded(false);
                        }}
                        className={`group relative transition-all duration-200 ${
                          index === currentIndex ? 'ring-2 ring-blue-500' : 'ring-1 ring-gray-300'
                        } rounded-lg overflow-hidden hover:scale-105`}
                      >
                        <img
                          src={image.url}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-16 h-16 object-cover"
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200"></div>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Delete button - fixed at right */}
                <button
                  onClick={handleDelete}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition flex items-center justify-center hover:scale-110"
                  aria-label="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function EnhancedImageCell({ 
  images, 
  onImagesChange, 
  readOnly = false, 
  productId, 
  fieldName 
}: EnhancedImageCellProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedImages = Array.isArray(images) ? images : [];

  const handleImageClick = (index: number) => {
    setModalImageIndex(index);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  const handleImageDelete = (index: number) => {
    const newImages = normalizedImages.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  const handleImageNameChange = (index: number, newFilename: string) => {
    const newImages = [...normalizedImages];
    const currentImage = newImages[index];
    
    // Safety check - ensure we have the essential URL
    if (!currentImage || !currentImage.url) {
      console.error('Cannot update filename: missing image or URL', currentImage);
      return;
    }
    
    // Ensure we preserve all essential image data
    newImages[index] = {
      url: currentImage.url, // This is critical - must preserve the URL
      publicId: currentImage.publicId || undefined,
      size: currentImage.size || undefined,
      mimeType: currentImage.mimeType || undefined,
      filename: newFilename // Update only the filename
    };
    
    console.log('🔍 EnhancedImageCell - Updating image filename:', { 
      index, 
      oldFilename: currentImage.filename, 
      newFilename,
      preservedUrl: newImages[index].url,
      allImages: newImages
    });
    
    onImagesChange(newImages);
  };

  const handleImageUpload = async (files: FileList) => {
    if (!productId || !fieldName) return;

    const formData = new FormData();
    formData.append('productId', productId);
    formData.append('fieldName', fieldName);
    
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/admin/upload-product-images', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const uploaded = Array.isArray(result.files) ? result.files.map((f: any) => ({ 
          url: f.url, 
          publicId: f.publicId,
          size: f.size,
          mimeType: f.mimeType,
          filename: f.filename || f.originalName || f.url.split('/').pop()
        })) : [];
        const newImages = [...normalizedImages, ...uploaded];
        onImagesChange(newImages);
      } else {
        console.error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 min-h-[40px] p-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => e.target.files && handleImageUpload(e.target.files)}
        className="hidden"
      />

      {/* Existing images */}
      {normalizedImages.map((image, index) => (
        <div key={index} className="relative group">
          <img
            src={image.url}
            alt={`Product ${index + 1}`}
            className="w-10 h-10 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-all duration-200 shadow-sm hover:shadow-lg hover:scale-105"
            onClick={(e) => { e.stopPropagation(); handleImageClick(index); }}
            title={image.filename || image.url.split('/').pop() || `Photo ${index + 1}`}
          />
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-all duration-200 flex items-center justify-center pointer-events-none">
            <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </div>
        </div>
      ))}

      {/* Attachment button */}
      <button
        onClick={(e) => { e.stopPropagation(); openFileDialog(); }}
        className="group flex items-center justify-center w-8 h-8 text-gray-500 hover:text-blue-600 transition-all duration-200 hover:scale-110"
        title="Add image"
      >
        <svg className="w-6 h-6 transition-transform group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <ImageModal
          images={normalizedImages}
          initialIndex={modalImageIndex}
          onClose={handleModalClose}
          onDelete={handleImageDelete}
          onNameChange={handleImageNameChange}
        />
      )}
    </div>
  );
}
