import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { virtualDb } from './firebase';

export interface OrderItem {
  productId: string;
  productName: string;
  color?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface UserOrder {
  orderId: string;
  orderDate: any;
  orderNumber: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  tax?: number;
  shipping?: number;
  totalPrice: number;
  pdfUrl?: string;
  comentario?: string;
}

/**
 * Adds a new order to the virtualOrders collection in the virtual database
 * @param userEmail - The user's email address
 * @param orderData - The order data to add
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export const addOrderToUserProfile = async (
  userEmail: string, 
  orderData: UserOrder
): Promise<boolean> => {
  if (!virtualDb) {
    console.error('Virtual database not available');
    return false;
  }

  try {
    // NOTE: Orders are now created directly by the send-order API in virtualOrders collection
    // This function is kept for backward compatibility but no longer creates duplicate orders
    console.log('Order creation handled by send-order API - no duplicate creation needed');
    return true;
  } catch (error) {
    console.error('Error in addOrderToUserProfile:', error);
    return false;
  }
};

/**
 * Gets all orders for a user from the clients collection
 * @param userEmail - The user's email address
 * @returns Promise<UserOrder[]> - Array of user orders
 */
export const getUserOrders = async (userEmail: string): Promise<UserOrder[]> => {
  if (!virtualDb) {
    console.error('Virtual database not available');
    return [];
  }

  try {
    // Query clients collection by document ID (email)
    const clientProfileRef = doc(virtualDb, 'clients', userEmail);
    const clientProfileDoc = await getDoc(clientProfileRef);
    
    if (!clientProfileDoc.exists()) {
      console.log('No client profile found for:', userEmail);
      return [];
    }
    
    const clientData = clientProfileDoc.data();
    const clientOrders = clientData.orders || [];
    
    console.log('Found orders in clients collection:', clientOrders.length);
    
    // Transform client orders to UserOrder format
    const orders: UserOrder[] = clientOrders.map((order: any) => ({
      orderId: order.orderId || order.orderNumber || 'N/A',
      orderDate: order.orderDate || new Date(),
      orderNumber: order.orderNumber || 'N/A',
      status: order.status || 'pending',
      items: order.items?.map((item: any) => ({
        productId: item.productId || 'unknown',
        productName: item.productName || 'Producto',
        color: item.selectedColor || item.color || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || item.price || 0,
        totalPrice: item.totalPrice || 0
      })) || [],
      subtotal: order.totalPrice || 0,
      totalPrice: order.totalPrice || 0,
      pdfUrl: order.pdfUrl || '',
      comentario: order.comentario || ''
    }));
    
    return orders;
  } catch (error) {
    console.error('Error getting user orders from clients collection:', error);
    return [];
  }
};

/**
 * Updates the status of a specific order in the clients collection
 * @param userEmail - The user's email address
 * @param orderId - The order ID to update
 * @param newStatus - The new status
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export const updateOrderStatus = async (
  userEmail: string,
  orderId: string,
  newStatus: string
): Promise<boolean> => {
  if (!virtualDb) {
    console.error('Virtual database not available');
    return false;
  }

  try {
    // Get client profile from clients collection
    const clientProfileRef = doc(virtualDb, 'clients', userEmail);
    const clientProfileDoc = await getDoc(clientProfileRef);
    
    if (!clientProfileDoc.exists()) {
      console.error('Client profile not found');
      return false;
    }
    
    const clientData = clientProfileDoc.data();
    const clientOrders = clientData.orders || [];
    
    // Find the order to update
    const orderIndex = clientOrders.findIndex((order: any) => 
      order.orderId === orderId || order.orderNumber === orderId
    );
    
    if (orderIndex === -1) {
      console.error('Order not found in client profile');
      return false;
    }
    
    // Update the order status
    clientOrders[orderIndex].status = newStatus;
    clientOrders[orderIndex].lastUpdated = new Date();
    
    // Update the client profile
    await updateDoc(clientProfileRef, {
      orders: clientOrders,
      lastUpdated: new Date()
    });
    
    console.log('Order status updated successfully in clients collection');
    return true;
  } catch (error) {
    console.error('Error updating order status in clients collection:', error);
    return false;
  }
};
