// Helper function to handle image URLs properly on Railway
export function getRailwayImageUrl(imageData: any): string {
  // If no image data, return placeholder
  if (!imageData) {
    return '/placeholder-product.svg';
  }

  // Handle array of images
  if (Array.isArray(imageData)) {
    if (imageData.length === 0) {
      return '/placeholder-product.svg';
    }
    
    // Get the first image
    const firstImage = imageData[0];
    return getRailwayImageUrl(firstImage);
  }

  // Handle string URLs
  if (typeof imageData === 'string') {
    const url = imageData.trim();
    
    // If it's already a full URL, use it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If it's a local path, check if we're on Railway
    if (url.startsWith('/images/products/')) {
      // On Railway, we can't serve local files, so return placeholder
      return '/placeholder-product.svg';
    }
    
    // If it's just a filename, we can't serve it on Railway
    if (url.includes('.')) {
      return '/placeholder-product.svg';
    }
    
    return '/placeholder-product.svg';
  }

  // Handle object with URL property (Airtable format)
  if (typeof imageData === 'object' && imageData !== null) {
    if ('url' in imageData && typeof imageData.url === 'string') {
      return imageData.url;
    }
    
    if ('filename' in imageData && typeof imageData.filename === 'string') {
      // We can't serve local files on Railway, return placeholder
      return '/placeholder-product.svg';
    }
  }

  return '/placeholder-product.svg';
}

// Helper function to get all valid images for a product on Railway
export function getAllRailwayImages(imageData: any): string[] {
  if (!imageData) {
    return ['/placeholder-product.svg'];
  }

  const images: string[] = [];

  if (Array.isArray(imageData)) {
    imageData.forEach((img) => {
      const url = getRailwayImageUrl(img);
      if (url !== '/placeholder-product.svg') {
        images.push(url);
      }
    });
  } else {
    const url = getRailwayImageUrl(imageData);
    if (url !== '/placeholder-product.svg') {
      images.push(url);
    }
  }

  return images.length > 0 ? images : ['/placeholder-product.svg'];
}

// Check if we're running on Railway
export function isRailwayEnvironment(): boolean {
  return process.env.RAILWAY_ENVIRONMENT === 'production' || 
         process.env.RAILWAY_PROJECT_ID !== undefined ||
         process.env.NODE_ENV === 'production';
}
