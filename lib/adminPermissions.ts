import { db, virtualDb } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

// Cache for admin permissions to reduce Firestore reads
const adminPermissionCache = new Map<string, { hasPermission: boolean; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache

export async function checkAdminPermission(email: string): Promise<boolean> {
  try {
    if (!email) return false;
    
    const emailKey = email.toLowerCase();
    const now = Date.now();
    
    // Check cache first
    const cached = adminPermissionCache.get(emailKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.hasPermission;
    }
    
    // If not in cache or expired, fetch from Firestore
    const adminQuery = query(
      collection(db, 'admin_permissions'), 
      where('email', '==', emailKey)
    );
    const adminDocs = await getDocs(adminQuery);
    const hasPermission = !adminDocs.empty;
    
    // Cache the result
    adminPermissionCache.set(emailKey, { hasPermission, timestamp: now });
    
    return hasPermission;
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

export async function getAllAdminEmails(): Promise<string[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'admin_permissions'));
    return querySnapshot.docs.map(doc => doc.data().email);
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return [];
  }
}

// Function to clear cache (useful for testing or when permissions change)
export function clearAdminPermissionCache(): void {
  adminPermissionCache.clear();
}

// Virtual admin permissions (for admin virtual page)
export async function checkVirtualAdminPermission(email: string): Promise<boolean> {
  try {
    if (!email) return false;
    
    const emailKey = email.toLowerCase();
    const now = Date.now();
    
    // Check cache first (use different cache key for virtual permissions)
    const cacheKey = `virtual_${emailKey}`;
    const cached = adminPermissionCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.hasPermission;
    }
    
    // First, try to check if the user has admin permissions in the main database
    // This allows users who are already admins in the main system to access virtual admin
    try {
      const mainAdminQuery = query(
        collection(db, 'admin_permissions'), 
        where('email', '==', emailKey)
      );
      const mainAdminDocs = await getDocs(mainAdminQuery);
      const hasMainPermission = !mainAdminDocs.empty;
      
      if (hasMainPermission) {
        // Cache the result
        adminPermissionCache.set(cacheKey, { hasPermission: true, timestamp: now });
        return true;
      }
    } catch (mainError) {
      console.error('Error checking main admin permissions:', mainError);
    }
    
    // If not in main database, try virtual database
    if (!virtualDb) {
      console.error('Virtual database not available');
      return false;
    }
    
    try {
      const virtualAdminQuery = query(
        collection(virtualDb, 'virtualAdminPermissions'), 
        where('email', '==', emailKey)
      );
      const virtualAdminDocs = await getDocs(virtualAdminQuery);
      const hasPermission = !virtualAdminDocs.empty;
      
      // Cache the result
      adminPermissionCache.set(cacheKey, { hasPermission, timestamp: now });
      
      return hasPermission;
    } catch (virtualError) {
      console.error('Error accessing virtual database:', virtualError);
      return false;
    }
  } catch (error) {
    console.error('Error checking virtual admin permission:', error);
    return false;
  }
} 