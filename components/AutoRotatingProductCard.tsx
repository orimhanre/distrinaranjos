'use client';

import React from 'react';
import ProductCard from './ProductCard';

interface AutoRotatingProductCardProps {
  product: any;
  className?: string;
  [key: string]: any;
}

export default function AutoRotatingProductCard({ product, className, ...props }: AutoRotatingProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  
  // Get all images for this product
  const productImages = React.useMemo(() => {
    const images = [];
    
    // Add main imageURL(s)
    if (product.imageURL) {
      if (Array.isArray(product.imageURL)) {
        images.push(...product.imageURL);
      } else {
        images.push(product.imageURL);
      }
    }
    
    // Add fallback image if available
    if (product.image && !images.includes(product.image)) {
      images.push(product.image);
    }
    
    // Filter out empty/null images and remove duplicates
    const filteredImages = [...new Set(images.filter(img => {
      if (!img) return false;
      if (typeof img === 'string') {
        return img.trim() !== '';
      }
      // Handle other data types (arrays, objects, etc.)
      return true;
    }))];
    
    // Debug logging
    console.log('AutoRotatingProductCard - Product:', product.name);
    console.log('AutoRotatingProductCard - Original imageURL:', product.imageURL);
    console.log('AutoRotatingProductCard - Original image:', product.image);
    console.log('AutoRotatingProductCard - Filtered images:', filteredImages);
    console.log('AutoRotatingProductCard - Images count:', filteredImages.length);
    
    return filteredImages;
  }, [product]);

  // Auto-rotate images every 3 seconds
  React.useEffect(() => {
    console.log('AutoRotatingProductCard - Setting up rotation for:', product.name);
    console.log('AutoRotatingProductCard - Images count:', productImages.length);
    
    if (productImages.length <= 1) {
      console.log('AutoRotatingProductCard - Skipping rotation (only 1 or 0 images)');
      return;
    }
    
    console.log('AutoRotatingProductCard - Starting rotation interval');
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => {
        const next = (prev + 1) % productImages.length;
        console.log('AutoRotatingProductCard - Rotating to image index:', next);
        return next;
      });
    }, 3000);
    
    return () => {
      console.log('AutoRotatingProductCard - Cleaning up rotation interval');
      clearInterval(interval);
    };
  }, [productImages.length, product.name]);

  // Create a modified product object with the current rotating image
  // Preserve the original imageURL array for ProductModal while showing current image for ProductCard
  const modifiedProduct = React.useMemo(() => {
    const currentImage = productImages[currentImageIndex] || product.imageURL || product.image;
    console.log('AutoRotatingProductCard - Current image index:', currentImageIndex);
    console.log('AutoRotatingProductCard - Current image:', currentImage);
    
    return {
      ...product,
      // Keep original imageURL array for ProductModal thumbnails
      imageURL: product.imageURL,
      // Set current rotating image for ProductCard display
      currentDisplayImage: currentImage,
      image: currentImage
    };
  }, [product, productImages, currentImageIndex]);

  return (
    <div className="relative">
      {/* Container with custom CSS for badge positioning */}
      <div className="carousel-product-wrapper">
        <ProductCard 
          product={modifiedProduct}
          className={className}
          {...props}
        />
      </div>
      
      {/* Small indicator dots if multiple images - positioned at bottom left */}
      {productImages.length > 1 && (
        <div className="absolute bottom-1 left-1 flex space-x-1 z-20">
          {productImages.map((_, index) => (
            <div
              key={index}
              className={`w-1 h-1 rounded-full transition-all duration-200 ${
                index === currentImageIndex ? 'bg-blue-600' : 'bg-white/60 border border-gray-300'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Global styles for carousel product cards */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .carousel-product-wrapper .absolute.top-3.right-3 {
            top: 0px !important;
            right: 0px !important;
          }
        `
      }} />
    </div>
  );
} 