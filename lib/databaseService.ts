import { Product } from '../types';

// Client-side database service that uses API endpoints
export async function fetchProductsFromDatabase(environment: 'regular' | 'virtual' = 'virtual'): Promise<Product[]> {
  try {
    // Use virtual endpoints for main page, regular endpoints for distri1/naranjos2
    const endpoint = environment === 'virtual' ? '/api/database/virtual-products' : '/api/database/products';
    
    // Use relative URL for client-side compatibility (works on mobile and desktop)
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.success) {
  
      return data.products;
    } else {
      throw new Error(data.error || 'Failed to fetch products');
    }
  } catch (error) {
    throw error;
  }
}

export async function fetchProducts(): Promise<Product[]> {
  return fetchProductsFromDatabase();
}

export async function fetchWebPhotos(environment: 'regular' | 'virtual' = 'virtual'): Promise<Record<string, string>> {
  try {
  
    
    // Use the correct endpoint for webphotos based on environment
    const endpoint = environment === 'virtual' ? '/api/database/virtual-webphotos' : '/api/database/webphotos';
    
    // Add timeout and retry logic
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.error('❌ DatabaseService - Response not ok:', response.status, response.statusText);
      return {};
    }
    
    const data = await response.json();
    
    if (data.success && data.webPhotos) {

      return data.webPhotos;
    } else {
      console.warn('⚠️ DatabaseService - WebPhotos not available or invalid response');
      return {};
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('❌ DatabaseService - WebPhotos fetch timeout');
    } else {
      console.error('❌ DatabaseService - Error fetching webphotos:', error);
    }
    return {};
  }
}

// Additional utility functions for the website
export async function searchProducts(query: string): Promise<Product[]> {
  try {
    const response = await fetch(`/api/database/products?search=${encodeURIComponent(query)}`);
    const data = await response.json();
    
    if (data.success) {
      return data.products;
    } else {
      throw new Error(data.error || 'Failed to search products');
    }
  } catch (error) {
    return [];
  }
}

export async function getProductsByBrand(brand: string): Promise<Product[]> {
  try {
    const allProducts = await fetchProductsFromDatabase();
    return allProducts.filter(product => 
      product.brand.toLowerCase() === brand.toLowerCase()
    );
  } catch (error) {
    return [];
  }
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  try {
    const allProducts = await fetchProductsFromDatabase();
    return allProducts.filter(product => {
      if (Array.isArray(product.category)) {
        return product.category.some(cat => cat.toLowerCase() === category.toLowerCase());
      }
      return product.category?.toLowerCase() === category.toLowerCase();
    });
  } catch (error) {
    return [];
  }
}

export async function getProductsByType(type: string): Promise<Product[]> {
  try {
    const allProducts = await fetchProductsFromDatabase();
    return allProducts.filter(product => 
      product.type.toLowerCase() === type.toLowerCase()
    );
  } catch (error) {
    return [];
  }
}

export async function getUniqueBrands(environment: 'regular' | 'virtual' = 'virtual'): Promise<string[]> {
  try {
    const endpoint = environment === 'virtual' ? '/api/database/virtual-metadata' : '/api/database/metadata';
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.success) {
      return data.metadata.brands;
    } else {
      throw new Error(data.error || 'Failed to get brands');
    }
  } catch (error) {
    return [];
  }
}

export async function getUniqueCategories(environment: 'regular' | 'virtual' = 'virtual'): Promise<string[]> {
  try {
    const endpoint = environment === 'virtual' ? '/api/database/virtual-metadata' : '/api/database/metadata';
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.success) {
      return data.metadata.categories;
    } else {
      throw new Error(data.error || 'Failed to get categories');
    }
  } catch (error) {
    return [];
  }
}

export async function getUniqueTypes(environment: 'regular' | 'virtual' = 'virtual'): Promise<string[]> {
  try {
    const endpoint = environment === 'virtual' ? '/api/database/virtual-metadata' : '/api/database/metadata';
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data.success) {
      return data.metadata.types;
    } else {
      throw new Error(data.error || 'Failed to get types');
    }
  } catch (error) {
    return [];
  }
} 