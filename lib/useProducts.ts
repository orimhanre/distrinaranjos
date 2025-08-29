import useSWR from 'swr';
import { fetchProductsFromDatabase } from './databaseService';

export function useProducts() {
  return useSWR('products', fetchProductsFromDatabase, {
    revalidateOnFocus: false, // Optional: don't refetch on tab focus
    dedupingInterval: 60000,  // Optional: cache for 60 seconds
  });
} 