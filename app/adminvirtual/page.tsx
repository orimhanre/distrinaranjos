'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { virtualDb } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, User, signInWithPopup, signInWithRedirect, signOut, getRedirectResult } from 'firebase/auth';
import { virtualAuth, virtualGoogleProvider } from '@/lib/firebase';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';
import { getInvoiceNumber, formatInvoiceNumber } from '@/lib/invoiceNumberClient';

interface VirtualOrder {
id: string;
invoiceNumber: string;
customerName: string;
customerEmail: string;
customerPhone: string;
client?: {
name?: string;
surname?: string;
companyName?: string;
email?: string;
phone?: string;
address?: string;
city?: string;
department?: string;
cedula?: string;
postalCode?: string;
};
items: Array<{
productId: string;
productName: string;
quantity: number;
price: number;
selectedColor?: string;
brand?: string;
}>;
totalAmount: number;
status: 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
paymentStatus: 'pending' | 'paid' | 'failed';
shippingAddress: string;
trackingNumber?: string;
courier?: string;
orderDate: any;
notes?: string;
isStarred?: boolean;
isArchived?: boolean;
deletedAt?: string;
fileUrl?: string;
adminMessages?: Array<{
message: string;
date: any;
files?: Array<{
  url: string;
  name: string;
  type: 'image' | 'pdf';
  size: number;
}>;
}>;
adminMessage?: string; // Keep for backward compatibility
adminMessageDate?: any; // Keep for backward compatibility
}

export default function AdminVirtualPage() {
const [user, setUser] = useState<User | null>(null);
const [hasPermission, setHasPermission] = useState<boolean>(false);
const [orders, setOrders] = useState<VirtualOrder[]>([]);
const [loading, setLoading] = useState<boolean>(true);
const [permissionLoading, setPermissionLoading] = useState<boolean>(true);
const [selectedOrder, setSelectedOrder] = useState<VirtualOrder | null>(null);
const [filterStatus, setFilterStatus] = useState<string>('all');
const [showArchived, setShowArchived] = useState<boolean>(false);
const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
const [orderToDelete, setOrderToDelete] = useState<VirtualOrder | null>(null);
const [searchTerm, setSearchTerm] = useState("");
const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

// Tracking modal states
const [trackingModalOpen, setTrackingModalOpen] = useState<boolean>(false);
const [editingOrder, setEditingOrder] = useState<VirtualOrder | null>(null);
const [trackingNumber, setTrackingNumber] = useState<string>('');
const [courier, setCourier] = useState<string>('');
const [isEditing, setIsEditing] = useState<boolean>(false);

// Payment status modal states
const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState<boolean>(false);
const [paymentOrder, setPaymentOrder] = useState<VirtualOrder | null>(null);
const [newPaymentStatus, setNewPaymentStatus] = useState<'pending' | 'paid' | 'failed'>('pending');

// Modern confirmation modal states
const [confirmModalOpen, setConfirmModalOpen] = useState<boolean>(false);
const [confirmAction, setConfirmAction] = useState<(() => Promise<void>) | null>(null);
const [confirmTitle, setConfirmTitle] = useState<string>('');
const [confirmMessage, setConfirmMessage] = useState<string>('');
const [confirmButtonText, setConfirmButtonText] = useState<string>('');
const [confirmButtonColor, setConfirmButtonColor] = useState<string>('');

// Success/Error notification states
const [notificationOpen, setNotificationOpen] = useState<boolean>(false);
const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
const [notificationMessage, setNotificationMessage] = useState<string>('');

// Function to extract bank name from comentario field (similar to pedidos-eliminados)
const extractBankName = (comentario: string): string | null => {
  if (!comentario || comentario.trim() === '') return null;
  
  // Look for "Banco: " pattern
  if (comentario.includes('Banco:')) {
    const components = comentario.split('|');
    for (const component of components) {
      const trimmed = component.trim();
      if (trimmed.includes('Banco:')) {
        const bankPart = trimmed.replace('Banco:', '').trim();
        if (bankPart !== '') {
          return formatBankName(bankPart);
        }
      }
    }
  }
  
  return null;
};

// Helper function to format bank names in a user-friendly way
const formatBankName = (bankName: string): string => {
  const lowercased = bankName.toLowerCase();
  
  switch (lowercased) {
    case 'nequi':
      return 'Nequi';
    case 'a la mano':
    case 'alamano':
      return 'A La Mano';
    case 'bancolombia':
    case 'banco colombia':
      return 'Bancolombia';
    case 'daviplata':
    case 'davi plata':
      return 'DaviPlata';
    case 'banco de bogota':
    case 'bancodebogota':
      return 'Banco de Bogotá';
    case 'banco popular':
    case 'bancopopular':
      return 'Banco Popular';
    case 'banco av villas':
    case 'banco avvillas':
    case 'av villas':
      return 'Banco AV Villas';
    case 'banco caja social':
    case 'bancocajasocial':
    case 'caja social':
      return 'Banco Caja Social';
    case 'banco occidente':
    case 'bancooccidente':
      return 'Banco de Occidente';
    case 'banco agrario':
    case 'bancoagrario':
      return 'Banco Agrario';
    case 'banco bbva':
    case 'bbva':
      return 'BBVA';
    case 'banco santander':
    case 'santander':
      return 'Banco Santander';
    case 'scotiabank':
    case 'scotia bank':
      return 'Scotiabank';
    case 'banco itau':
    case 'itau':
      return 'Banco Itaú';
    case 'banco falabella':
    case 'falabella':
      return 'Banco Falabella';
    case 'banco pichincha':
    case 'pichincha':
      return 'Banco Pichincha';
    default:
      // For unknown banks, capitalize the first letter of each word
      return bankName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
  }
};

// Login loading state
const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

// Migration state
const [migrationLoading, setMigrationLoading] = useState<boolean>(false);
const [migrationResult, setMigrationResult] = useState<string | null>(null);

// Refresh loading state
const [refreshLoading, setRefreshLoading] = useState<boolean>(false);

// Messaging state
const [selectedOrderForMessage, setSelectedOrderForMessage] = useState<VirtualOrder | null>(null);
const [adminMessageText, setAdminMessageText] = useState<string>('');
const [isSendingMessage, setIsSendingMessage] = useState<boolean>(false);
const [messageModalOpen, setMessageModalOpen] = useState<boolean>(false);
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);

// Ref to track if orders have been fetched
const ordersFetchedRef = useRef<boolean>(false);

useEffect(() => {
if (!virtualAuth) {
  return;
}

// Handle redirect result for mobile devices
const handleRedirectResult = async () => {
  try {
    if (virtualAuth) {
      const result = await getRedirectResult(virtualAuth);
    }
  } catch (error) {
    // Silent error handling
  }
};

// Check for redirect result
handleRedirectResult();

const unsubscribe = onAuthStateChanged(virtualAuth, async (firebaseUser) => {
  setUser(firebaseUser);
  if (firebaseUser?.email) {
    setPermissionLoading(true);
    const hasPermission = await checkVirtualAdminPermission(firebaseUser.email);
    setHasPermission(hasPermission);
    setPermissionLoading(false);
  } else {
    setHasPermission(false);
    setPermissionLoading(false);
  }
  setLoading(false);
});

return () => unsubscribe();
}, []);

// Debounce search term to prevent excessive re-renders
useEffect(() => {
const timer = setTimeout(() => {
  setDebouncedSearchTerm(searchTerm);
}, 300);

return () => clearTimeout(timer);
}, [searchTerm]);

useEffect(() => {
if (hasPermission && !ordersFetchedRef.current) {
  // Fetch real orders from Firestore only once when permissions are granted
  ordersFetchedRef.current = true;
  console.log('🔄 Fetching orders for the first time...');
  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/admin/orders?virtual=true');
      
      if (response.ok) {
        const data = await response.json();
        
        if (!data.orders || data.orders.length === 0) {
          setOrders([]);
          return;
        }
        
        // Transform Firestore orders to VirtualOrder format
        console.log('🔍 Raw orders from API:', data.orders.length);
        console.log('🔍 Raw orders data:', data.orders);
        
        const transformedOrders: VirtualOrder[] = data.orders.map((order: any) => {
          try {
            let invoiceNumber = 'N/A';
            try {
              invoiceNumber = getInvoiceNumber(order);
            } catch (error) {
              invoiceNumber = 'N/A';
            }
            
            const transformedOrder = {
              id: order.id,
              invoiceNumber: invoiceNumber,
              customerName: `${order.client?.name || ''} ${order.client?.surname || ''}`.trim() || order.client?.companyName || 'Cliente Web',
              customerEmail: order.client?.email || order.email || (() => {
                // Try to extract email from orderDetails if it exists
                if (order.orderDetails && typeof order.orderDetails === 'string') {
                  const emailMatch = order.orderDetails.match(/email[:\s]+([^\s|]+)/i);
                  if (emailMatch) return emailMatch[1];
                }
                return 'N/A';
              })(),
              customerPhone: order.client?.phone || 'N/A',
              client: order.client || {}, // Preserve the full client object
              
              // Try new flattened structure first, then fallback to old nested structure
              items: (order.items || order.cartItems || []).map((item: any) => ({
                productId: item.productId || item.product?.id || item.id,
                productName: item.productName || item.product?.name || 'Producto',
                quantity: item.quantity || 1,
                price: item.unitPrice || item.product?.price || 0,
                selectedColor: item.color || item.selectedColor || '',
                brand: item.brand || item.product?.brand || ''
              })),
              
              totalAmount: order.totalAmount || (order.cartItems?.reduce((sum: number, item: any) => {
                const price = item.product?.price || 0;
                const quantity = item.quantity || 1;
                return sum + (price * quantity);
              }, 0) || 0),
              
              status: order.status || 'new',
              paymentStatus: order.paymentStatus || 'pending',
              shippingAddress: `${order.client?.address || ''}, ${order.client?.city || ''}, ${order.client?.department || ''}`,
              orderDate: order.orderDate || order.createdAt || order.timestamp || null,
              notes: order.comentario || order.orderDetails || '',
              isStarred: order.isStarred || order.metadata?.isStarred || false,
              isArchived: order.isArchived || order.metadata?.isArchived || false,
              fileUrl: order.fileUrl || '',
              // Add tracking information fields
              trackingNumber: order.trackingNumber || '',
              courier: order.courier || '',
              adminMessage: order.adminMessage || '',
              adminMessageDate: order.adminMessageDate || null
            };
            
            console.log('✅ Transformed order:', transformedOrder.id, transformedOrder.customerEmail, transformedOrder.invoiceNumber);
            return transformedOrder;
          } catch (error) {
            console.error('❌ Error transforming order:', order.id, error);
            // Return a basic order object to prevent the entire list from failing
            return {
              id: order.id,
              invoiceNumber: 'N/A',
              customerName: 'Error processing order',
              customerEmail: 'N/A',
              customerPhone: 'N/A',
              client: order.client, // Preserve the full client object
              items: [],
              totalAmount: 0,
              status: 'new',
              paymentStatus: 'pending',
              shippingAddress: '',
              orderDate: null,
              notes: '',
              isStarred: false,
              isArchived: false,
              fileUrl: '',
              // Add tracking information fields
              trackingNumber: order.trackingNumber || '',
              courier: order.courier || '',
              adminMessage: '',
              adminMessageDate: null
            };
          }
        });
        
        console.log('🔍 Transformed orders count:', transformedOrders.length);
        
        // Check for duplicate orders
        const orderIds = transformedOrders.map(order => order.id);
        const uniqueIds = new Set(orderIds);
        
        console.log('🔍 Unique order IDs count:', uniqueIds.size);
        console.log('🔍 All order IDs:', orderIds);
        
        // Remove duplicates by keeping only the first occurrence of each order ID
        const uniqueOrders = transformedOrders.filter((order, index, self) =>
          index === self.findIndex(o => o.id === order.id)
        );
        
        console.log('🔍 After ID deduplication count:', uniqueOrders.length);

        // Remove the problematic email-based deduplication that was removing valid orders
        // Customers can have multiple orders, so we shouldn't deduplicate by email
        const finalUniqueOrders = uniqueOrders;

        console.log('📊 Final orders count:', finalUniqueOrders.length);
        console.log('📊 Final orders:', finalUniqueOrders.map(o => ({ id: o.id, email: o.customerEmail, invoice: o.invoiceNumber })));
        setOrders(finalUniqueOrders);
      } else {
        setOrders([]);
      }
    } catch (error) {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  fetchOrders();
}
}, [hasPermission]);

// Add real-time listener for order updates (like iOS app)
useEffect(() => {
  if (hasPermission && virtualDb) {
    console.log('🔍 Starting real-time listener for order updates...');
    
    // Listen to the virtualOrders collection for real-time updates
    const unsubscribe = onSnapshot(
      collection(virtualDb, 'virtualOrders'),
      (snapshot) => {
        console.log('🔄 Real-time update received from web app listener');
        console.log('📊 Total documents in snapshot:', snapshot.docs.length);
        console.log('📊 Snapshot changes:', snapshot.docChanges().length);
        
        // Process each document change
        snapshot.docChanges().forEach((change) => {
          console.log('📝 Document change:', change.type, '-', change.doc.id);
          console.log('📝 Change details:', {
            type: change.type,
            docId: change.doc.id,
            oldIndex: change.oldIndex,
            newIndex: change.newIndex
          });
          
          if (change.type === 'modified') {
            const data = change.doc.data();
            console.log('🔄 Document modified:', change.doc.id);
            console.log('🔄 Document data keys:', Object.keys(data));
            
            if (data.orders && Array.isArray(data.orders)) {
              console.log('📋 Orders in modified document:', data.orders.length);
              
              // Update the specific orders in our local state
              data.orders.forEach((orderData: any, index: number) => {
                const orderId = orderData.orderId;
                if (orderId) {
                  console.log(`🔍 Processing order ${index} update for:`, orderId);
                  console.log('🔍 Order data keys:', Object.keys(orderData));
                  console.log('🔍 Current isStarred value:', orderData.isStarred);
                  console.log('🔍 Current metadata.isStarred value:', orderData.metadata?.isStarred);
                  
                  // Transform the order data
                  try {
                    let invoiceNumber = 'N/A';
                    try {
                      invoiceNumber = getInvoiceNumber(orderData);
                    } catch (error) {
                      invoiceNumber = 'N/A';
                    }
                    
                    const transformedOrder = {
                      id: orderId,
                      invoiceNumber: invoiceNumber,
                      customerName: `${orderData.client?.name || ''} ${orderData.client?.surname || ''}`.trim() || orderData.client?.companyName || 'Cliente Web',
                      customerEmail: orderData.client?.email || orderData.email || 'N/A',
                      customerPhone: orderData.client?.phone || 'N/A',
                      client: orderData.client || {},
                      items: (orderData.items || orderData.cartItems || []).map((item: any) => ({
                        productId: item.productId || item.product?.id || item.id,
                        productName: item.productName || item.product?.name || 'Producto',
                        quantity: item.quantity || 1,
                        price: item.unitPrice || item.product?.price || 0,
                        selectedColor: item.color || item.selectedColor || '',
                        brand: item.brand || item.product?.brand || ''
                      })),
                      totalAmount: orderData.totalAmount || 0,
                      status: orderData.status || 'new',
                      paymentStatus: orderData.paymentStatus || 'pending',
                      shippingAddress: `${orderData.client?.address || ''}, ${orderData.client?.city || ''}, ${orderData.client?.department || ''}`,
                      orderDate: orderData.orderDate || orderData.createdAt || orderData.timestamp || null,
                      notes: orderData.comentario || orderData.orderDetails || '',
                      isStarred: orderData.isStarred || orderData.metadata?.isStarred || false,
                      isArchived: orderData.isArchived || orderData.metadata?.isArchived || false,
                      fileUrl: orderData.fileUrl || '',
                      trackingNumber: orderData.trackingNumber || '',
                      courier: orderData.courier || '',
                      adminMessage: orderData.adminMessage || '',
                      adminMessageDate: orderData.adminMessageDate || null
                    };
                    
                    console.log('🔍 Transformed order isStarred:', transformedOrder.isStarred);
                    
                    // Update the order in local state
                    setOrders(prevOrders => {
                      const existingIndex = prevOrders.findIndex(o => o.id === orderId);
                      console.log('🔍 Existing order index:', existingIndex);
                      console.log('🔍 Current orders count:', prevOrders.length);
                      
                      if (existingIndex >= 0) {
                        console.log('✅ Updating existing order in web app:', orderId);
                        console.log('✅ Old star status:', prevOrders[existingIndex].isStarred);
                        console.log('✅ New star status:', transformedOrder.isStarred);
                        const updatedOrders = [...prevOrders];
                        updatedOrders[existingIndex] = transformedOrder;
                        return updatedOrders;
                      } else {
                        console.log('⚠️ Order not found in local state, skipping:', orderId);
                        return prevOrders; // Don't add new orders, just return existing ones
                      }
                    });
                  } catch (error) {
                    console.error('❌ Error processing real-time order update:', error);
                  }
                }
              });
            } else {
              console.log('⚠️ No orders array found in modified document');
            }
          }
        });
      },
      (error) => {
        console.error('❌ Real-time listener error:', error);
      }
    );
    
    // Cleanup function
    return () => {
      console.log('🛑 Stopping real-time listener');
      unsubscribe();
    };
  }
}, [hasPermission, virtualDb]);

// Helper function to sync order updates to clients collection
const syncOrderToClientsCollection = async (orderId: string, updates: any) => {
console.log('🔍 syncOrderToClientsCollection: Starting sync for orderId:', orderId, 'with updates:', updates);
console.log('🔍 syncOrderToClientsCollection: virtualDb available:', !!virtualDb);
console.log('🔍 syncOrderToClientsCollection: orders array length:', orders.length);

try {
  if (!virtualDb) {
    console.log('❌ syncOrderToClientsCollection: virtualDb not available');
    return false;
  }
  
  if (!orderId || typeof orderId !== 'string') {
    console.log('❌ syncOrderToClientsCollection: invalid orderId:', orderId);
    return false;
  }
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    console.log('❌ syncOrderToClientsCollection: order not found in local state:', orderId);
    console.log('🔍 syncOrderToClientsCollection: available order IDs:', orders.map(o => o.id));
    return false;
  }
  
  console.log('🔍 syncOrderToClientsCollection: found order in local state:', order);
  console.log('🔍 syncOrderToClientsCollection: order structure:', {
    id: order.id,
    clientEmail: order.client?.email,
    customerEmail: order.customerEmail,
    hasClient: !!order.client,
    clientKeys: order.client ? Object.keys(order.client) : []
  });
  
  // Find the client email from the order
  const clientEmail = order.client?.email || order.customerEmail;
  if (!clientEmail || typeof clientEmail !== 'string') {
    console.log('❌ syncOrderToClientsCollection: no valid client email found for order:', orderId);
    return false;
  }
  
  console.log('🔍 syncOrderToClientsCollection: client email:', clientEmail);
  
  try {
    // Update the client profile in the clients collection (not virtualOrders!)
    const clientProfileRef = doc(virtualDb, 'clients', clientEmail);
    const clientProfileDoc = await getDoc(clientProfileRef);
    
    if (clientProfileDoc.exists()) {
      const clientData = clientProfileDoc.data();
      const clientOrders = clientData.orders || [];
      
      console.log('🔍 syncOrderToClientsCollection: client profile found, orders count:', clientOrders.length);
      console.log('🔍 syncOrderToClientsCollection: client orders:', clientOrders);
      console.log('🔍 syncOrderToClientsCollection: looking for order with ID:', orderId);
      
      // Process updates to handle undefined values for Firestore compatibility
      const processedUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          // Convert undefined to null for Firestore compatibility
          processedUpdates[key] = null;
        } else {
          processedUpdates[key] = value;
        }
      }
      
      console.log('🔍 syncOrderToClientsCollection: processed updates:', processedUpdates);
      
      // Find and update the specific order in the client's orders array
      // The orderId format is "clientEmail_orderIdentifier", so we need to extract the order identifier
      const orderIdParts = orderId.split('_');
      const orderIdentifier = orderIdParts.slice(1).join('_');
      
      console.log('🔍 syncOrderToClientsCollection: orderId parts:', orderIdParts);
      console.log('🔍 syncOrderToClientsCollection: order identifier:', orderIdentifier);
      
      const updatedClientOrders = clientOrders.map((clientOrder: any) => {
        try {
          // Try multiple matching strategies for better order identification
          const matchesOrderId = clientOrder.orderId === orderIdentifier ||
                               clientOrder.orderId === orderId;
          const matchesInvoiceNumber = clientOrder.invoiceNumber === orderIdentifier ||
                                     clientOrder.invoiceNumber === orderId;
          const matchesOrderNumber = clientOrder.invoiceNumber === orderIdentifier ||
                                   clientOrder.invoiceNumber === orderId;
          
          // Also check if the order has the same items or total amount as a fallback
          const matchesByContent = clientOrder.totalPrice === order.totalAmount &&
                                 clientOrder.items?.length === order.items?.length;
          
          const isMatch = matchesOrderId || matchesInvoiceNumber || matchesOrderNumber || matchesByContent;
          
          if (isMatch) {
            console.log('🔍 syncOrderToClientsCollection: found matching order:', clientOrder);
            console.log('🔍 syncOrderToClientsCollection: applying updates:', processedUpdates);
            const updatedOrder = { ...clientOrder, ...processedUpdates };
            console.log('🔍 syncOrderToClientsCollection: updated order:', updatedOrder);
            return updatedOrder;
          }
          return clientOrder;
        } catch (orderProcessError) {
          console.error('❌ syncOrderToClientsCollection: Error processing individual order:', orderProcessError);
          return clientOrder; // Return unchanged order if processing fails
        }
      });
      
      console.log('🔍 syncOrderToClientsCollection: updated client orders:', updatedClientOrders);
      
      try {
        // Update the client profile in clients collection
        await updateDoc(clientProfileRef, {
          orders: updatedClientOrders,
          lastUpdated: new Date()
        });
        
        console.log('✅ syncOrderToClientsCollection: Order synced to clients collection successfully:', orderId);
        return true;
      } catch (updateError) {
        console.error('❌ syncOrderToClientsCollection: Error updating client profile:', updateError);
        return false;
      }
    } else {
      console.log('❌ syncOrderToClientsCollection: client profile not found for email:', clientEmail);
      return false;
    }
  } catch (firestoreError) {
    console.error('❌ syncOrderToClientsCollection: Firestore operation failed:', firestoreError);
    return false;
  }
} catch (error) {
  console.error('❌ syncOrderToClientsCollection: Error syncing order to clients collection:', error);
  return false;
}
};

// Helper function to sync order updates to client profile (for other operations)
const syncOrderToClientProfile = async (orderId: string, updates: any) => {
console.log('🔍 syncOrderToClientProfile: Starting sync for orderId:', orderId, 'with updates:', updates);
console.log('🔍 syncOrderToClientProfile: virtualDb available:', !!virtualDb);
console.log('🔍 syncOrderToClientProfile: orders array length:', orders.length);

try {
  if (!virtualDb) {
    console.log('❌ syncOrderToClientProfile: virtualDb not available');
    return false;
  }
  
  if (!orderId || typeof orderId !== 'string') {
    console.log('❌ syncOrderToClientProfile: invalid orderId:', orderId);
    return false;
  }
  
  const order = orders.find(o => o.id === orderId);
  if (!order) {
    console.log('❌ syncOrderToClientProfile: order not found in local state:', orderId);
    console.log('🔍 syncOrderToClientProfile: available order IDs:', orders.map(o => o.id));
    return false;
  }
  
  console.log('🔍 syncOrderToClientProfile: found order in local state:', order);
  console.log('🔍 syncOrderToClientProfile: order structure:', {
    id: order.id,
    clientEmail: order.client?.email,
    customerEmail: order.customerEmail,
    hasClient: !!order.client,
    clientKeys: order.client ? Object.keys(order.client) : []
  });
  
  // Find the client email from the order
  const clientEmail = order.client?.email || order.customerEmail;
  if (!clientEmail || typeof clientEmail !== 'string') {
    console.log('❌ syncOrderToClientProfile: no valid client email found for order:', orderId);
    return false;
  }
  
  console.log('🔍 syncOrderToClientProfile: client email:', clientEmail);
  
  try {
    // Update the client profile in the virtualOrders collection
    const clientProfileRef = doc(virtualDb, 'virtualOrders', clientEmail);
    const clientProfileDoc = await getDoc(clientProfileRef);
    
    if (clientProfileDoc.exists()) {
      const clientData = clientProfileDoc.data();
      const clientOrders = clientData.orders || [];
      
      console.log('🔍 syncOrderToClientProfile: client profile found, orders count:', clientOrders.length);
      console.log('🔍 syncOrderToClientProfile: client orders:', clientOrders);
      console.log('🔍 syncOrderToClientProfile: looking for order with ID:', orderId);
      
      // Process updates to handle undefined values for Firestore compatibility
      const processedUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          // Convert undefined to null for Firestore compatibility
          processedUpdates[key] = null;
        } else {
          processedUpdates[key] = value;
        }
      }
      
      console.log('🔍 syncOrderToClientProfile: processed updates:', processedUpdates);
      
      // Find and update the specific order in the client's orders array
      // The orderId format is "clientEmail_orderIdentifier", so we need to extract the order identifier
      const orderIdParts = orderId.split('_');
      const orderIdentifier = orderIdParts.slice(1).join('_');
      
      console.log('🔍 syncOrderToClientProfile: orderId parts:', orderIdParts);
      console.log('🔍 syncOrderToClientProfile: order identifier:', orderIdentifier);
      
      const updatedClientOrders = clientOrders.map((clientOrder: any) => {
        try {
          // Try multiple matching strategies for better order identification
          const matchesOrderId = clientOrder.orderId === orderIdentifier ||
                               clientOrder.orderId === orderId;
          const matchesInvoiceNumber = clientOrder.invoiceNumber === orderIdentifier ||
                                     clientOrder.invoiceNumber === orderId;
          const matchesOrderNumber = clientOrder.invoiceNumber === orderIdentifier ||
                                   clientOrder.invoiceNumber === orderId;
          
          // Also check if the order has the same items or total amount as a fallback
          const matchesByContent = clientOrder.totalPrice === order.totalAmount &&
                                 clientOrder.items?.length === order.items?.length;
          
          const isMatch = matchesOrderId || matchesInvoiceNumber || matchesOrderNumber || matchesByContent;
          
          if (isMatch) {
            console.log('🔍 syncOrderToClientProfile: found matching order:', clientOrder);
            console.log('🔍 syncOrderToClientProfile: applying updates:', processedUpdates);
            const updatedOrder = { ...clientOrder, ...processedUpdates };
            console.log('🔍 syncOrderToClientProfile: updated order:', updatedOrder);
            return updatedOrder;
          }
          return clientOrder;
        } catch (orderProcessError) {
          console.error('❌ syncOrderToClientProfile: Error processing individual order:', orderProcessError);
          return clientOrder; // Return unchanged order if processing fails
        }
      });
      
      console.log('🔍 syncOrderToClientProfile: updated client orders:', updatedClientOrders);
      
      try {
        // Update the client profile
        await updateDoc(clientProfileRef, {
          orders: updatedClientOrders,
          lastUpdated: new Date()
        });
        
        console.log('✅ syncOrderToClientProfile: Order synced to client profile successfully:', orderId);
        return true;
      } catch (updateError) {
        console.error('❌ syncOrderToClientProfile: Error updating client profile:', updateError);
        return false;
      }
    } else {
      console.log('❌ syncOrderToClientProfile: client profile not found for email:', clientEmail);
      return false;
    }
  } catch (firestoreError) {
    console.error('❌ syncOrderToClientProfile: Firestore operation failed:', firestoreError);
    return false;
  }
} catch (error) {
  console.error('❌ syncOrderToClientProfile: Error syncing order to client profile:', error);
  return false;
}
};

// Function to refresh orders from server
const refreshOrders = async () => {
try {
  setRefreshLoading(true);
  console.log('🔄 Refreshing orders from server...');
  const response = await fetch('/api/admin/orders?virtual=true');
  
  if (response.ok) {
    const data = await response.json();
    
    if (!data.orders || data.orders.length === 0) {
      setOrders([]);
      return;
    }
    
    // Transform Firestore orders to VirtualOrder format (same logic as fetchOrders)
    const transformedOrders: VirtualOrder[] = data.orders.map((order: any) => {
      try {
        let invoiceNumber = 'N/A';
        try {
          invoiceNumber = getInvoiceNumber(order);
        } catch (error) {
          invoiceNumber = 'N/A';
        }
        
        const transformedOrder = {
          id: order.id,
          invoiceNumber: invoiceNumber,
          customerName: `${order.client?.name || ''} ${order.client?.surname || ''}`.trim() || order.client?.companyName || 'Cliente Web',
          customerEmail: order.client?.email || order.email || (() => {
            if (order.orderDetails && typeof order.orderDetails === 'string') {
              const emailMatch = order.orderDetails.match(/email[:\s]+([^\s|]+)/i);
              if (emailMatch) return emailMatch[1];
            }
            return 'N/A';
          })(),
          customerPhone: order.client?.phone || 'N/A',
          client: order.client || {},
          items: (order.items || order.cartItems || []).map((item: any) => ({
            productId: item.productId || item.product?.id || item.id,
            productName: item.productName || item.product?.name || 'Producto',
            quantity: item.quantity || 1,
            price: item.unitPrice || item.product?.price || 0,
            selectedColor: item.color || item.selectedColor || '',
            brand: item.brand || item.product?.brand || ''
          })),
          totalAmount: order.totalAmount || (order.cartItems?.reduce((sum: number, item: any) => {
            const price = item.product?.price || 0;
            const quantity = item.quantity || 1;
            return sum + (price * quantity);
          }, 0) || 0),
          status: order.status || 'new',
          paymentStatus: order.paymentStatus || 'pending',
          shippingAddress: `${order.client?.address || ''}, ${order.client?.city || ''}, ${order.client?.department || ''}`,
          orderDate: order.orderDate || order.createdAt || order.timestamp || null,
          notes: order.orderDetails || '',
          isStarred: order.isStarred || order.metadata?.isStarred || false,
          isArchived: order.isArchived || order.metadata?.isArchived || false,
          fileUrl: order.fileUrl || '',
          trackingNumber: order.trackingNumber || '',
          courier: order.courier || '',
          adminMessage: order.adminMessage || '',
          adminMessageDate: order.adminMessageDate || null
        };
        
        return transformedOrder;
      } catch (error) {
        console.error('❌ Error transforming order:', order.id, error);
        return {
          id: order.id,
          invoiceNumber: 'N/A',
          customerName: 'Error processing order',
          customerEmail: 'N/A',
          customerPhone: 'N/A',
          client: order.client,
          items: [],
          totalAmount: 0,
          status: 'new',
          paymentStatus: 'pending',
          shippingAddress: '',
          orderDate: null,
          notes: '',
          isStarred: false,
          isArchived: false,
          fileUrl: '',
          trackingNumber: order.trackingNumber || '',
          courier: order.courier || '',
          adminMessage: '',
          adminMessageDate: null
        };
      }
    });
    
    // Remove duplicates by keeping only the first occurrence of each order ID
    const uniqueOrders = transformedOrders.filter((order, index, self) =>
      index === self.findIndex(o => o.id === order.id)
    );
    
    setOrders(uniqueOrders);
    console.log('✅ Orders refreshed from server:', uniqueOrders.length);
    showNotification('success', 'Lista de pedidos actualizada correctamente');
  } else {
    console.error('❌ Failed to refresh orders from server');
    showNotification('error', 'Error al actualizar la lista de pedidos');
  }
} catch (error) {
  console.error('❌ Error refreshing orders:', error);
  showNotification('error', 'Error al actualizar la lista de pedidos');
} finally {
  setRefreshLoading(false);
}
};

const updateOrderStatus = async (orderId: string, newStatus: VirtualOrder['status']) => {
try {
  console.log('🔄 Updating order status:', { orderId, newStatus });
  
  // Prepare updates
  const updates: any = {
    status: newStatus
  };
  
  // Update in Firestore
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates
    })
  });

  if (response.ok) {
    console.log('✅ Order status updated successfully in Firestore');
    
    // Update local state
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    
    // Sync to client profile
    await syncOrderToClientProfile(orderId, {
      status: newStatus
    });
    
    console.log('✅ Local state updated and synced to client profile');
  } else {
    console.error('❌ Failed to update order status in Firestore');
    showNotification('error', 'Error al actualizar el estado del pedido');
  }
} catch (error) {
  console.error('❌ Error updating order status:', error);
  showNotification('error', 'Error al actualizar el estado del pedido');
}
};

const updateTrackingInfo = async (orderId: string, trackingNumber: string, courier: string) => {
try {
  // Prepare updates - only update tracking info, not shipping status
  const updates: any = {
    trackingNumber,
    courier
  };
  
  // Update in Firestore
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates
    })
  });

  if (response.ok) {
    // Update local state - only tracking info, preserve current status
    setOrders(prev => prev.map(order =>
      order.id === orderId ? {
        ...order,
        trackingNumber,
        courier
        // Note: status is not changed automatically
      } : order
    ));
    
    // Sync to client profile - only tracking info
    await syncOrderToClientProfile(orderId, {
      trackingNumber,
      courier
      // Note: status is not changed automatically
    });
    
    showNotification('success', '¡Excelente! El número de seguimiento ha sido actualizado. El cliente podrá ver esta información en su portal.');
  } else {
    showNotification('error', 'No se pudo actualizar el número de seguimiento. Por favor, verifica tu conexión e intenta de nuevo.');
  }
} catch (error) {
  showNotification('error', 'Algo salió mal al actualizar el seguimiento. Por favor, intenta de nuevo o contacta al soporte si el problema persiste.');
}
};

const clearTrackingInfo = async (orderId: string) => {
try {
  // Add a timeout fallback to ensure modal closes
  const timeoutId = setTimeout(() => {
    closeConfirmModal();
  }, 10000); // 10 second timeout
  
  // Update in Firestore
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates: {
        trackingNumber: 'DELETE_FIELD',
        courier: 'DELETE_FIELD'
      }
    })
  });

  // Clear the timeout since we got a response
  clearTimeout(timeoutId);

  if (response.ok) {
    // Update local state
    setOrders(prev => prev.map(order =>
      order.id === orderId ? {
        ...order,
        trackingNumber: undefined,
        courier: undefined
      } : order
    ));
    
    // Sync to client profile - use null instead of undefined for Firestore compatibility
    await syncOrderToClientProfile(orderId, {
      trackingNumber: null,
      courier: null
    });
    
    showNotification('success', '¡Perfecto! El número de seguimiento ha sido eliminado. El cliente ya no verá esta información en su portal.');
    closeConfirmModal(); // Close the confirmation modal after successful deletion
  } else {
    const errorData = await response.json();
    showNotification('error', 'Ups, algo salió mal al eliminar el número de seguimiento. Por favor, intenta de nuevo o contacta al soporte si el problema persiste.');
    closeConfirmModal(); // Close modal even on error
  }
} catch (error) {
  showNotification('error', 'Oops, hubo un problema inesperado. Por favor, recarga la página e intenta de nuevo.');
  closeConfirmModal(); // Close modal even on error
}
};

const openPaymentStatusModal = (order: VirtualOrder) => {
setPaymentOrder(order);
setNewPaymentStatus(order.paymentStatus);
setPaymentStatusModalOpen(true);
};

const closePaymentStatusModal = () => {
setPaymentStatusModalOpen(false);
setPaymentOrder(null);
setNewPaymentStatus('pending');
};

// Modern confirmation modal helpers
const showConfirmModal = (
title: string,
message: string,
action: () => Promise<void>,
buttonText: string = 'Confirmar',
buttonColor: string = 'bg-blue-600 hover:bg-blue-700'
) => {
setConfirmTitle(title);
setConfirmMessage(message);
setConfirmAction(() => action);
setConfirmButtonText(buttonText);
setConfirmButtonColor(buttonColor);
setConfirmModalOpen(true);
};

const closeConfirmModal = () => {
setConfirmModalOpen(false);
setConfirmAction(null);
setConfirmTitle('');
setConfirmMessage('');
setConfirmButtonText('');
setConfirmButtonColor('');
};

// Notification helpers
const showNotification = (type: 'success' | 'error', message: string) => {
setNotificationType(type);
setNotificationMessage(message);
setNotificationOpen(true);
setTimeout(() => setNotificationOpen(false), 5000);
};

const updatePaymentStatus = async () => {
if (!paymentOrder) return;

try {
  console.log('🔄 Updating payment status:', { orderId: paymentOrder.id, newStatus: newPaymentStatus });
  
  // Prepare updates
  const updates: any = {
    paymentStatus: newPaymentStatus
  };
  
  // Update in Firestore
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: paymentOrder.id,
      updates
    })
  });

  if (response.ok) {
    console.log('✅ Payment status updated successfully in Firestore');
    
    // Update local state
    setOrders(prev => prev.map(order =>
      order.id === paymentOrder.id ? { ...order, paymentStatus: newPaymentStatus } : order
    ));
    
    // Sync to client profile
    await syncOrderToClientProfile(paymentOrder.id, {
      paymentStatus: newPaymentStatus
    });
    
    console.log('✅ Local state updated and synced to client profile');
    closePaymentStatusModal();
  } else {
    console.error('❌ Failed to update payment status in Firestore');
    showNotification('error', 'No se pudo actualizar el estado de pago. Por favor, verifica tu conexión e intenta de nuevo.');
  }
} catch (error) {
  console.error('❌ Error updating payment status:', error);
  showNotification('error', 'Error inesperado al actualizar el estado de pago. Por favor, intenta de nuevo.');
}
};

// Simple payment status update function for dropdowns
const updatePaymentStatusDirect = async (orderId: string, newPaymentStatus: 'pending' | 'paid' | 'failed') => {
try {
  console.log('🔄 Updating payment status directly:', { orderId, newPaymentStatus });
  
  // Prepare updates
  const updates: any = {
    paymentStatus: newPaymentStatus
  };
  
  // Update in Firestore
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates
    })
  });

  if (response.ok) {
    console.log('✅ Payment status updated successfully in Firestore');
    
    // Sync to client profile
    await syncOrderToClientProfile(orderId, {
      paymentStatus: newPaymentStatus
    });
    
    console.log('✅ Synced to client profile');
  } else {
    console.error('❌ Failed to update payment status in Firestore');
    showNotification('error', 'No se pudo actualizar el estado de pago. Por favor, verifica tu conexión e intenta de nuevo.');
  }
} catch (error) {
  console.error('❌ Error updating payment status:', error);
  showNotification('error', 'Error inesperado al actualizar el estado de pago. Por favor, intenta de nuevo.');
}
};

const openTrackingModal = (order: VirtualOrder, edit: boolean = false) => {
setEditingOrder(order);
setIsEditing(edit);
if (edit) {
  setTrackingNumber(order.trackingNumber || '');
  setCourier(order.courier || '');
} else {
  setTrackingNumber('');
  setCourier('');
}
setTrackingModalOpen(true);
};

const closeTrackingModal = () => {
setTrackingModalOpen(false);
setEditingOrder(null);
setTrackingNumber('');
setCourier('');
setIsEditing(false);
};

const openMessageModal = (order: VirtualOrder) => {
setSelectedOrderForMessage(order);
setAdminMessageText('');
setMessageModalOpen(true);
};

const closeMessageModal = () => {
setMessageModalOpen(false);
setSelectedOrderForMessage(null);
setAdminMessageText('');
setSelectedFiles([]);
};

const handleTrackingSubmit = async () => {
if (!editingOrder || !trackingNumber.trim()) return;

try {
  await updateTrackingInfo(editingOrder.id, trackingNumber.trim(), courier.trim());
  closeTrackingModal();
} catch (error) {
  // Silent error handling
}
};

const handleStar = async (orderId: string) => {
try {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  const newStarredState = !order.isStarred;
  
  // Update in Firestore - update both direct and nested metadata structure for compatibility
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates: {
        'isStarred': newStarredState,
        'metadata.isStarred': newStarredState
      }
    })
  });

  if (response.ok) {
    // Update local state
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, isStarred: newStarredState } : order
    ));
    
    // Sync to client profile
    await syncOrderToClientProfile(orderId, { isStarred: newStarredState });
  } else {
    showNotification('error', 'Error al actualizar el pedido');
  }
} catch (error) {
  showNotification('error', 'Error al actualizar el pedido');
}
};

const handleArchive = async (orderId: string) => {
try {
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  
  const newArchivedState = !order.isArchived;
  
  // Update in Firestore - update both direct and nested metadata structure for compatibility
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      updates: {
        'isArchived': newArchivedState,
        'metadata.isArchived': newArchivedState
      }
    })
  });

  if (response.ok) {
    // Update local state
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, isArchived: newArchivedState } : order
    ));
    
    // Sync to client profile
    await syncOrderToClientProfile(orderId, { isArchived: newArchivedState });
  } else {
    showNotification('error', 'Error al actualizar el pedido');
  }
} catch (error) {
  showNotification('error', 'Error al actualizar el pedido');
}
};

const handleSendAdminMessage = async () => {
if (!selectedOrderForMessage || !adminMessageText.trim()) return;

try {
  setIsSendingMessage(true);
  setUploadingFiles(true);
  
  // Upload files first if any
  let uploadedFiles: Array<{ url: string; name: string; type: 'image' | 'pdf'; size: number }> = [];
  
  if (selectedFiles.length > 0) {
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('files', file);
      });
      formData.append('orderId', selectedOrderForMessage.id);
      
      const uploadResponse = await fetch('/api/admin/upload-files?virtual=true', {
        method: 'POST',
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadResult = await uploadResponse.json();
        uploadedFiles = uploadResult.files;
        console.log('✅ Files uploaded successfully:', uploadedFiles);
      } else {
        console.error('❌ File upload failed');
        showNotification('error', 'Error al subir archivos');
        return;
      }
    } catch (uploadError) {
      console.error('❌ File upload error:', uploadError);
      showNotification('error', 'Error al subir archivos');
      return;
    }
  }
  
  // Get existing admin messages or initialize empty array
  const existingMessages = selectedOrderForMessage.adminMessages || [];
  if (selectedOrderForMessage.adminMessage && !existingMessages.length) {
    // Migrate old single message to new array format
    existingMessages.push({
      message: selectedOrderForMessage.adminMessage,
      date: selectedOrderForMessage.adminMessageDate || new Date()
    });
  }
  
  // Add new message to the array with files
  const newMessage = {
    message: adminMessageText.trim(),
    date: new Date(),
    files: uploadedFiles.length > 0 ? uploadedFiles : undefined
  };
  
  const requestBody = {
    orderId: selectedOrderForMessage.id,
    updates: {
      adminMessages: [...existingMessages, newMessage],
      // Keep old fields for backward compatibility
      adminMessage: adminMessageText.trim(),
      adminMessageDate: new Date()
    }
  };
  
  console.log('🔍 Debug: Sending message with files:', requestBody);
  
  const response = await fetch('/api/admin/update-order?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  console.log('🔍 Debug: Response status:', response.status);
  console.log('🔍 Debug: Response ok:', response.ok);

  if (response.ok) {
    console.log('✅ Message sent successfully');
    
    // Update local state
    setOrders(prev => prev.map(o =>
      o.id === selectedOrderForMessage.id
        ? {
            ...o,
            adminMessages: [...existingMessages, newMessage],
            adminMessage: adminMessageText.trim(),
            adminMessageDate: new Date()
          }
        : o
    ));

    // Sync to client profile
    try {
      console.log('🔍 Debug: Syncing to client profile...');
      await syncOrderToClientProfile(selectedOrderForMessage.id, {
        adminMessages: [...existingMessages, newMessage],
        adminMessage: adminMessageText.trim(),
        adminMessageDate: new Date()
      });
      console.log('✅ Synced to client profile successfully');
    } catch (syncError) {
      console.error('❌ Error syncing to client profile:', syncError);
      // Don't fail the whole operation if sync fails
    }

    // Clear form and files
    setAdminMessageText('');
    setSelectedFiles([]);
    setSelectedOrderForMessage(null);
    
    showNotification('success', 'Mensaje y archivos enviados correctamente al cliente');
  } else {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ API Error Details:', {
      status: response.status,
      statusText: response.statusText,
      errorData: errorData,
      orderId: selectedOrderForMessage.id,
      requestBody: requestBody
    });
    showNotification('error', `Error al enviar el mensaje: ${response.status} - ${errorData.error || 'Error desconocido'}`);
  }
} catch (error) {
  console.error('❌ Error sending admin message:', error);
  showNotification('error', 'Error al enviar el mensaje');
} finally {
  setIsSendingMessage(false);
  setUploadingFiles(false);
}
};

// File handling functions
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
const files = Array.from(event.target.files || []);
const validFiles = files.filter(file => {
  const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
  const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
  return isValidType && isValidSize;
});

if (validFiles.length !== files.length) {
  showNotification('error', 'Algunos archivos no son válidos. Solo se permiten imágenes y PDFs hasta 10MB.');
}

setSelectedFiles(prev => [...prev, ...validFiles]);
};

const removeFile = (index: number) => {
setSelectedFiles(prev => prev.filter((_, i) => i !== index));
};

const clearFiles = () => {
setSelectedFiles([]);
};

const handleDelete = (order: VirtualOrder) => {
setOrderToDelete(order);
setDeleteModalOpen(true);
};

const confirmDelete = async () => {
if (!orderToDelete) return;

try {
  console.log('🔍 confirmDelete: orderToDelete.id:', orderToDelete.id);
  console.log('🔍 confirmDelete: orderToDelete structure:', orderToDelete);
  console.log('🔍 confirmDelete: orderToDelete.client?.email:', orderToDelete.client?.email);
  console.log('🔍 confirmDelete: orderToDelete.customerEmail:', orderToDelete.customerEmail);
  
  // Use local order data directly instead of fetching from API
  console.log('🔍 confirmDelete: Using local order data for deletion');
  
  // Move to deleted orders collection with local order data
  const response = await fetch('/api/admin/move-to-deleted?virtual=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: orderToDelete.id, order: orderToDelete })
  });

  if (response.ok) {
    // Refresh orders from server instead of just updating local state
    await refreshOrders();
    
    // Mark order as deleted in clients collection (but don't fail if this doesn't work)
    let syncSuccess = false;
    try {
      const clientEmail = orderToDelete.client?.email || orderToDelete.customerEmail;
      const orderNumber = orderToDelete.invoiceNumber;
      
      if (clientEmail && orderNumber) {
        const response = await fetch('/api/admin/mark-order-deleted', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientEmail, orderNumber })
        });
        
        if (response.ok) {
          syncSuccess = true;
        }
      }
    } catch (syncError) {
      // Don't fail the delete operation if sync fails
    }
    
    setDeleteModalOpen(false);
    setOrderToDelete(null);
    
    if (syncSuccess) {
      showNotification('success', 'Pedido eliminado correctamente');
    } else {
      showNotification('success', 'Pedido eliminado correctamente (sincronización parcial)');
    }
  } else {
    const errorData = await response.json().catch(() => ({}));
    console.error('❌ confirmDelete: move-to-deleted API error:', errorData);
    showNotification('error', `Error al eliminar el pedido: ${errorData.error || 'Error desconocido'}`);
  }
} catch (error) {
  console.error('❌ confirmDelete: General error:', error);
  showNotification('error', 'Error al eliminar el pedido');
}
};



// Migration function to move orders from clients to virtualOrders collection
const handleMigration = async () => {
showConfirmModal(
  '⚠️ Confirmar Migración',
  'This will migrate existing orders from clients collection to virtualOrders collection. This action cannot be undone. Continue?',
  async () => {
    try {
      setMigrationLoading(true);
      setMigrationResult(null);

      const response = await fetch('/api/admin/migrate-to-virtual-orders', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setMigrationResult(`✅ Migration completed successfully!\n\nMigrated: ${result.summary.migrated} orders\nMigrated: ${result.summary.deletedOrdersMigrated} deletedOrders\nSkipped: ${result.summary.errors}\nTotal: ${result.summary.total}`);
        
        // Refresh orders after migration
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const errorData = await response.json();
        setMigrationResult(`❌ Migration failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      setMigrationResult(`❌ Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setMigrationLoading(false);
    }
    closeConfirmModal();
  },
  'Continuar',
  'bg-yellow-600 hover:bg-yellow-700'
);
};

// Sync missing orders from clients to virtualOrders collection
const handleSyncMissingOrders = async () => {
showConfirmModal(
  '🔄 Sincronizar Pedidos Faltantes',
  'Esto sincronizará los pedidos que faltan desde la colección "clients" hacia "virtualOrders". ¿Continuar?',
  async () => {
    try {
      setMigrationLoading(true);
      setMigrationResult(null);

      const response = await fetch('/api/admin/sync-missing-orders', {
        method: 'POST'
      });

      if (response.ok) {
        const result = await response.json();
        setMigrationResult(`✅ Sincronización completada exitosamente!\n\nMigrados: ${result.migratedCount} pedidos\nOmitidos: ${result.skippedCount} clientes\nPedidos eliminados omitidos: ${result.deletedOrdersSkipped || 0}\nErrores: ${result.errorCount}`);
        
        // Refresh orders after sync
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        const errorData = await response.json();
        setMigrationResult(`❌ Sincronización falló: ${errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      setMigrationResult(`❌ Sincronización falló: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setMigrationLoading(false);
    }
    closeConfirmModal();
  },
  'Sincronizar',
  'bg-blue-600 hover:bg-blue-700'
);
};



// Login/Logout handlers (identical to main admin page)
const handleLogin = async () => {
if (isLoggingIn) return; // Prevent multiple clicks

try {
  setIsLoggingIn(true);
  
  if (!virtualAuth || !virtualGoogleProvider) {
    showNotification('error', 'Error: Virtual Firebase not configured');
    return;
  }
  
  // Check if we're on mobile and add mobile-specific handling
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  

  
  if (isMobile) {
    // On mobile, try popup first, but fallback to redirect if it fails
    try {
      // Force a small delay to ensure the button click is fully processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Additional mobile-specific configuration
      if (virtualGoogleProvider) {
        virtualGoogleProvider.setCustomParameters({
          prompt: 'select_account',
          display: 'popup'
        });
      }
      
      await signInWithPopup(virtualAuth, virtualGoogleProvider);
    } catch (popupError) {
      // Fallback to redirect method for mobile
      try {
        await signInWithRedirect(virtualAuth, virtualGoogleProvider);
      } catch (redirectError) {
        throw redirectError;
      }
    }
  } else {
    // Desktop: use popup method
    await signInWithPopup(virtualAuth, virtualGoogleProvider);
  }
} catch (error) {
  // Provide more specific error messages for mobile users
  if (error instanceof Error) {
    if (error.message.includes('popup')) {
      showNotification('error', 'Error: No se pudo abrir la ventana de Google. En dispositivos móviles, asegúrate de que no haya bloqueadores de popups activos.');
    } else if (error.message.includes('cancelled')) {
      showNotification('error', 'Inicio de sesión cancelado por el usuario.');
    } else if (error.message.includes('network')) {
      showNotification('error', 'Error de conexión. Verifica tu conexión a internet e intenta de nuevo.');
    } else if (error.message.includes('redirect')) {
      showNotification('error', 'Error con el método de redirección. Intenta de nuevo.');
    } else {
      showNotification('error', 'Error al iniciar sesión con Google: ' + error.message);
    }
  } else {
    showNotification('error', 'Error al iniciar sesión con Google: Error desconocido');
  }
} finally {
  setIsLoggingIn(false);
}
};

const handleLogout = async () => {
if (!virtualAuth) {
  return;
}
await signOut(virtualAuth);
};

const handleSwitchToMainAdmin = async () => {
try {
  // Sign out from current session
  if (virtualAuth) {
    await signOut(virtualAuth);
  }
  // Redirect to main admin
  window.location.href = '/admin';
} catch (error) {
  showNotification('error', 'Error al cambiar al admin principal');
}
};

const formatCurrency = (amount: number) => {
return new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP'
}).format(amount);
};

const formatDate = (dateInput: any) => {
let date: Date;

// Debug logging
        // Handle different date input types
    if (dateInput?.toDate) {
      // Firestore Timestamp
      date = dateInput.toDate();
    } else if (dateInput instanceof Date) {
      // Already a Date object
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // ISO string or other string format
      date = new Date(dateInput);
    } else if (dateInput?.seconds) {
      // Firestore Timestamp with seconds
      date = new Date(dateInput.seconds * 1000);
    } else {
      // Fallback to current date if no valid date found
      date = new Date();
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      date = new Date();
    }
    
    const dateOnly = date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    const timeOnly = date.toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return { dateOnly, timeOnly };
};

const getStatusColor = (status: string) => {
switch (status) {
  case 'new': return 'bg-green-100 text-green-800';
  case 'confirmed': return 'bg-blue-100 text-blue-800';
  case 'shipped': return 'bg-purple-100 text-purple-800';
  case 'delivered': return 'bg-cyan-100 text-cyan-800';
  case 'cancelled': return 'bg-red-100 text-red-800';
  default: return 'bg-gray-100 text-gray-800';
}
};

const parseOrderDetails = (orderDetails: string) => {
const result: { total?: string; tipo?: string; type?: string; paymentMethod?: string; client?: string } = {};
if (!orderDetails) return result;

// Try multiple patterns for total - case insensitive and different formats
const totalMatch = orderDetails.match(/total: ([\d,]+)/i) ||
                  orderDetails.match(/Total: ([\d,]+)/) ||
                  orderDetails.match(/total: ([\d.]+)/i) ||
                  orderDetails.match(/Total: ([\d.]+)/);

const clientMatch = orderDetails.match(/client: ([^|]+)/i) ||
                   orderDetails.match(/Cliente: ([^|]+)/) ||
                   orderDetails.match(/cliente: ([^|]+)/i);

const tipoMatch = orderDetails.match(/type: ([^|]+)/i) ||
                 orderDetails.match(/Tipo: ([^|]+)/) ||
                 orderDetails.match(/tipo: ([^|]+)/i);

const paymentMethodMatch = orderDetails.match(/Método de pago: ([^|]+)/i);

if (totalMatch) result.total = totalMatch[1];
if (clientMatch) result.client = clientMatch[1].trim();
if (tipoMatch) {
  const tipoValue = tipoMatch[1].trim();
  // Handle both old format ("Precio 1", "Precio 2") and new format ("1", "2")
  if (tipoValue === "1" || tipoValue === "Precio 1") {
    result.tipo = "Precio 1";
    result.type = "Precio 1";
  } else if (tipoValue === "2" || tipoValue === "Precio 2") {
    result.tipo = "Precio 2";
    result.type = "Precio 2";
  } else {
    result.tipo = tipoValue;
    result.type = tipoValue;
  }
}
if (paymentMethodMatch) {
  const method = paymentMethodMatch[1].trim();
  // Map payment method codes to readable names
  switch (method) {
    case 'wompi':
      result.paymentMethod = 'Wompi';
      break;
    case 'pse':
      result.paymentMethod = 'Transferencia Bancaria';
      break;
    case 'bank_transfer':
      // Try to extract bank provider from order details
      const bankProviderMatch = orderDetails.match(/Banco: ([^|]+)/i);
      if (bankProviderMatch) {
        const bankProvider = bankProviderMatch[1].trim();
        switch (bankProvider) {
          case 'bancolombia':
            result.paymentMethod = 'Transferencia Bancaria - Bancolombia';
            break;
          case 'nequi':
            result.paymentMethod = 'Transferencia Bancaria - Nequi';
            break;
          case 'a_la_mano':
            result.paymentMethod = 'Transferencia Bancaria - A la Mano';
            break;
          default:
            result.paymentMethod = `Transferencia Bancaria - ${bankProvider}`;
            break;
        }
      } else {
        result.paymentMethod = 'Transferencia Bancaria';
      }
      break;
    case 'credit_card':
      result.paymentMethod = 'Tarjeta de Crédito';
      break;
    case 'stripe':
      result.paymentMethod = 'Tarjeta de Crédito';
      break;
    default:
      result.paymentMethod = method;
  }
}
return result;
};

const getProductosArray = (order: VirtualOrder) => {
// Virtual admin orders already have items array, so we can use that directly
if (order.items && Array.isArray(order.items)) {
  return order.items.map((item) => ({
    name: item.productName || 'Producto sin nombre',
    quantity: item.quantity || 1,
    price: item.price || 0,
    brand: item.brand || '',
    selectedColor: item.selectedColor || ''
  }));
}

// Fallback: create a single item from order data
return [{
  name: order.customerName || 'Producto sin nombre',
  quantity: 1,
  price: order.totalAmount,
  brand: '',
  selectedColor: ''
}];
};

// Memoized search function for better performance
const searchInOrder = useCallback((order: VirtualOrder, searchTerm: string): boolean => {
if (!searchTerm || searchTerm.length < 1) return true;

const searchLower = searchTerm.toLowerCase();

// Search in all relevant fields
const searchableFields = [
  order.customerName || '',
  order.customerEmail || '',
  order.customerPhone || '',
  order.shippingAddress || '',
  order.invoiceNumber || '',
  order.notes || '',
  order.items.map(item => item.productName).join(' '),
  order.items.map(item => item.productId).join(' '),
  order.status || '',
  order.paymentStatus || '',
  formatCurrency(order.totalAmount),
  (() => {
    const fd = formatDate(order.orderDate);
    return `${fd.dateOnly} ${fd.timeOnly}`;
  })()
];

return searchableFields.some(field =>
  field.toLowerCase().includes(searchLower)
);
}, []);

// Filter orders based on search term and other filters
const filteredOrders = useMemo(() => {
const filtered = orders.filter(order => {
  // Filter by archived status
  if (showArchived && !order.isArchived) return false;
  if (!showArchived && order.isArchived) return false;

  // Filter by status
  if (filterStatus !== 'all' && order.status !== filterStatus) return false;

  // Filter by search term
  if (!searchInOrder(order, debouncedSearchTerm)) return false;

  return true;
});

// Return filtered orders without deduplication - each order should be unique by its ID
return filtered;
}, [orders, showArchived, filterStatus, debouncedSearchTerm, searchInOrder]);

// Helper to get grouping key (Google account email) and display name
const getOrderEmail = (order: VirtualOrder): string => {
  const email = (order.customerEmail && order.customerEmail.trim() !== '')
    ? order.customerEmail
    : (order.client?.email || 'Sin email');
  return email;
};

const getCustomerDisplayNameForOrder = (order: VirtualOrder): string => {
  if (order.client?.name && order.client?.surname) {
    return `${order.client.name} ${order.client.surname}`;
  }
  if (order.client?.companyName && order.client.companyName.trim() !== '') {
    return order.client.companyName;
  }
  if (order.customerName && order.customerName.trim() !== '') {
    return order.customerName;
  }
  return getOrderEmail(order);
};

const toggleGroupExpansion = (email: string) => {
  setExpandedGroups(prev => {
    const newSet = new Set(prev);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    return newSet;
  });
};

// Show loading while authentication and permissions are being checked
if (loading || permissionLoading) {
return (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading admin panel...</p>
    </div>
  </div>
);
}

if (!user) {
return (
  <div className="min-h-screen flex flex-col justify-start bg-gray-100 px-4 pt-20">
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 max-w-sm w-full mx-auto">
      <h1 className="text-xl md:text-2xl font-bold mb-6 text-center text-gray-900">Inicio de Sesión de Administrador</h1>
      

      
      {/* Configuration Status */}
      {(!virtualAuth || !virtualGoogleProvider) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            ⚠️ Configuración de Firebase Virtual no disponible.
            {!virtualAuth && ' Auth no disponible.'}
            {!virtualGoogleProvider && ' Google Provider no disponible.'}
          </p>
        </div>
      )}
      
      <button
        onClick={handleLogin}
        disabled={!virtualAuth || !virtualGoogleProvider || isLoggingIn}
        className={`w-full px-4 py-3 md:py-4 rounded-lg font-semibold text-sm md:text-base transition-colors duration-200 flex items-center justify-center space-x-2 ${
          !virtualAuth || !virtualGoogleProvider
            ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
            : isLoggingIn
            ? 'bg-blue-500 text-white cursor-wait'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {isLoggingIn ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Iniciando sesión...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>
              {!virtualAuth || !virtualGoogleProvider
                ? 'Configuración no disponible'
                : 'Iniciar sesión con Google'
              }
            </span>
          </>
        )}
      </button>
      
      {/* Mobile-specific instructions */}
      {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            📱 <strong>Dispositivo móvil detectado:</strong> El sistema intentará primero el método de popup. Si falla, automáticamente usará el método de redirección. Asegúrate de que no haya bloqueadores de popups activos en tu navegador.
          </p>
        </div>
      )}
    </div>
  </div>
);
}

if (!hasPermission) {
return (
  <div className="min-h-screen flex flex-col justify-start bg-gray-100 px-4 pt-20">
    <div className="bg-white rounded-lg shadow-lg p-6 md:p-8 max-w-sm w-full mx-auto text-center">
      <h1 className="text-xl md:text-2xl font-bold mb-4 text-gray-900">Acceso denegado</h1>
      <p className="mb-6 text-gray-600">Tu cuenta no está autorizada para ver esta página.</p>
      {!virtualDb && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            ⚠️ Base de datos virtual no disponible. Verifica la configuración de Firebase Virtual.
          </p>
        </div>
      )}
      <button
        onClick={handleLogout}
        className="w-full bg-red-600 text-white px-4 py-3 md:py-4 rounded-lg hover:bg-red-700 font-semibold text-sm md:text-base transition-colors duration-200"
      >
        Cerrar sesión
      </button>
    </div>
  </div>
);
}

return (
<div className="space-y-6">
  {/* User Info and Navigation */}
  <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4">
    <div className="flex justify-between items-center">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">Admin Virtual</p>
          <p className="text-xs text-gray-500">{user.email}</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={handleLogout}
          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
          title="Cerrar sesión"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  </div>



  {/* Unified Table Structure */}
  <div className="bg-white rounded-xl shadow-lg p-2 md:p-6 overflow-x-auto border border-gray-200">
    <h2 className="text-base md:text-xl font-semibold mb-4 text-gray-900 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
      <span className="w-auto ml-4">Administración de Pedidos Virtuales</span>
      <div className="flex flex-row gap-2 md:gap-4 items-center w-auto md:w-auto md:ml-auto">
        <button
          onClick={handleSyncMissingOrders}
          disabled={migrationLoading}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-200 flex items-center gap-1 ${
            migrationLoading
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {migrationLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
              <span>Sincronizando...</span>
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Sincronizar Pedidos</span>
            </>
          )}
        </button>
        

      </div>
    </h2>
    


    {/* Statistics Section */}
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4">
      <div className="px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Resumen de Pedidos</h3>
      </div>
    <div className="overflow-x-auto">
      <table className="w-auto" style={{ borderSpacing: '0', borderCollapse: 'collapse', tableLayout: 'auto' }}>
        <thead className="bg-gray-50">
          <tr>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              Estado
            </th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              Cantidad
            </th>
            <th className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              Porcentaje
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          <tr>
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Nuevo</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.filter(o => o.status === 'new').length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'new').length / orders.length) * 100) : 0}%
            </td>
          </tr>
          <tr>
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Confirmados</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.filter(o => o.status === 'confirmed').length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'confirmed').length / orders.length) * 100) : 0}%
            </td>
          </tr>
          <tr>
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">En Camino</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.filter(o => o.status === 'shipped').length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'shipped').length / orders.length) * 100) : 0}%
            </td>
          </tr>
          <tr>
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Entregados</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.filter(o => o.status === 'delivered').length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'delivered').length / orders.length) * 100) : 0}%
            </td>
          </tr>
          <tr>
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Cancelados</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.filter(o => o.status === 'cancelled').length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {orders.length > 0 ? Math.round((orders.filter(o => o.status === 'cancelled').length / orders.length) * 100) : 0}%
            </td>
          </tr>
          <tr className="bg-gray-100">
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Total Pedidos</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              {orders.length}
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-500 text-center" style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              100%
            </td>
          </tr>
          <tr className="bg-gray-100">
            <td className="py-2 whitespace-nowrap text-center" style={{ paddingLeft: '2px', paddingRight: '70px' }}>
              <div className="flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-xs font-medium text-gray-900">Total Ventas</span>
              </div>
            </td>
            <td className="py-2 whitespace-nowrap text-xs text-gray-900 font-semibold text-center" colSpan={2} style={{ paddingLeft: '2px', paddingRight: '2px' }}>
              {formatCurrency(orders.reduce((sum, order) => sum + order.totalAmount, 0))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div className="bg-white shadow-sm rounded-lg border border-gray-200">
    <div className="px-4 md:px-6 py-4 border-b border-gray-200">
      <div className="mb-4">
        {/* Mobile Header Layout */}
        <div className="md:hidden mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Lista de Pedidos</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">Total de pedidos:</span>
              <span className="text-2xl font-bold text-blue-600">{filteredOrders.length}</span>
            </div>
          </div>
        </div>
        
        {/* Desktop Header Layout */}
        <div className="hidden md:flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Lista de Pedidos</h3>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <span className="text-sm text-gray-500">Total de pedidos: </span>
              <span className="text-xl font-bold text-blue-600">{filteredOrders.length}</span>
            </div>
          </div>
        </div>
        
        {/* Desktop Filter Layout */}
        <div className="hidden md:flex items-center space-x-3">

          
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
              showArchived
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
          </button>
          
          {/* Unarchive All Button - Only show when viewing archived orders */}
          {showArchived && orders.filter(o => o.isArchived).length > 0 && (
            <button
              onClick={async () => {
                const archivedOrders = orders.filter(o => o.isArchived);
                for (const order of archivedOrders) {
                  try {
                    const response = await fetch('/api/admin/update-order?virtual=true', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        orderId: order.id,
                        updates: {
                          'isArchived': false,
                          'metadata.isArchived': false
                        }
                      })
                    });
                    if (response.ok) {
                      setOrders(prev => prev.map(o =>
                        o.id === order.id ? { ...o, isArchived: false } : o
                      ));
                      // Sync to client profile
                      await syncOrderToClientProfile(order.id, { isArchived: false });
                    }
                  } catch (error) {
                    // Silent error handling
                  }
                }
                setShowArchived(false);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg border border-green-600 font-medium transition-colors hover:bg-green-700"
            >
              Desarchivar Todos
            </button>
          )}
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer hover:shadow-md transition-all duration-200 ${
              filterStatus === 'new' ? 'text-orange-600 bg-orange-50' :
              filterStatus === 'confirmed' ? 'text-blue-600 bg-blue-50' :
              filterStatus === 'shipped' ? 'text-purple-600 bg-purple-50' :
              filterStatus === 'delivered' ? 'text-green-600 bg-green-50' :
              filterStatus === 'cancelled' ? 'text-red-600 bg-red-50' :
              'text-gray-600'
            }`}
          >
            <option value="all">Todos los Estados</option>
            <option value="new">Nuevo</option>
            <option value="confirmed">Confirmado</option>
            <option value="shipped">En Camino</option>
            <option value="delivered">Entregado</option>
            <option value="cancelled">Cancelado</option>
          </select>


          
          <div className="relative w-64">
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 w-full text-sm shadow-sm transition-all duration-200 placeholder-gray-600"
            />
            <svg
              className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Mobile Filter Layout */}
        <div className="md:hidden space-y-3">
          {/* Row 1: Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={refreshOrders}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg border border-blue-600 font-medium transition-colors text-sm hover:bg-blue-700 flex items-center justify-center gap-2 flex-1"
              title="Actualizar lista de pedidos"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar Lista
            </button>
            
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`px-4 py-3 rounded-lg border font-medium transition-colors text-sm flex-1 ${
                showArchived
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {showArchived ? 'Ocultar Archivados' : 'Ver Archivados'}
            </button>
          </div>
          
          {/* Row 3: Status Filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm cursor-pointer hover:shadow-md transition-all duration-200 appearance-none ${
                filterStatus === 'new' ? 'text-orange-600 bg-orange-50' :
                filterStatus === 'confirmed' ? 'text-blue-600 bg-blue-50' :
                filterStatus === 'shipped' ? 'text-purple-600 bg-purple-50' :
                filterStatus === 'delivered' ? 'text-green-600 bg-green-50' :
                filterStatus === 'cancelled' ? 'text-red-600 bg-red-50' :
                'text-gray-600'
              }`}
              title="Click para filtrar por estado de envío"
            >
              <option value="all">Todos los Estados</option>
              <option value="new">Nuevo</option>
              <option value="confirmed">Confirmado</option>
              <option value="shipped">En Camino</option>
              <option value="delivered">Entregado</option>
              <option value="cancelled">Cancelado</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {/* Row 4: Unarchive All Button (if needed) */}
          {showArchived && orders.filter(o => o.isArchived).length > 0 && (
            <button
              onClick={async () => {
                const archivedOrders = orders.filter(o => o.isArchived);
                for (const order of archivedOrders) {
                  try {
                    const response = await fetch('/api/admin/update-order?virtual=true', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        orderId: order.id,
                          updates: { isArchived: false }
                      })
                    });
                    if (response.ok) {
                      setOrders(prev => prev.map(o =>
                        o.id === order.id ? { ...o, isArchived: false } : o
                      ));
                    }
                  } catch (error) {
                    // Silent error handling
                  }
                }
                setShowArchived(false);
              }}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg border border-green-600 font-medium transition-colors hover:bg-green-700 text-sm"
            >
              Desarchivar Todos
            </button>
          )}
          
          {/* Row 5: Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar órdenes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 text-sm shadow-sm transition-all duration-200 placeholder-gray-600"
            />
            <svg
              className="absolute left-3 top-3 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
    
    {loading ? (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Cargando pedidos...</p>
      </div>
    ) : filteredOrders.length === 0 ? (
      <div className="p-6 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          {showArchived ? 'No hay pedidos archivados' : 'No hay pedidos'}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {showArchived
            ? 'No se encontraron pedidos archivados. Puedes volver a la vista normal haciendo clic en "Ocultar Archivados".'
            : 'No se encontraron pedidos con los filtros aplicados.'
          }
        </p>
      </div>
    ) : (
      <div className="overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-300 adminvirtual-table">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-12 px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    #
                  </th>
                  <th className="w-48 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Pedido
                  </th>
                  <th className="w-40 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Cliente
                  </th>
                  <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Total
                  </th>
                  <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Método de Pago
                  </th>
                  <th className="w-40 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Número de Seguimiento
                  </th>
                  <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Fecha
                  </th>
                  <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {(() => {
                  const groups = {} as Record<string, VirtualOrder[]>;
                  for (const o of filteredOrders) {
                    const key = getOrderEmail(o);
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(o);
                  }
                  const sortedEmails = Object.keys(groups).sort();
                  const globalIndexById = new Map<string, number>();
                  filteredOrders.forEach((o, idx) => globalIndexById.set(o.id, idx));
                  const rows: React.ReactNode[] = [];
                  for (const email of sortedEmails) {
                    const ordersInGroup = groups[email].sort((a, b) => (globalIndexById.get(a.id)! - globalIndexById.get(b.id)!));
                    const displayName = getCustomerDisplayNameForOrder(ordersInGroup[0]);
                    const isExpanded = expandedGroups.has(email);
                    rows.push(
                      <tr key={`group-${email}`} className="bg-white cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleGroupExpansion(email)}>
                        <td colSpan={8} className="px-4 py-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-600">{sortedEmails.indexOf(email) + 1}</span>
                              </div>
                              <div>
                                <h3 className="text-sm font-medium text-gray-900">{displayName}</h3>
                                <p className="text-xs text-gray-500">{email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">{ordersInGroup.length} pedidos</span>
                              <svg 
                                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                    if (isExpanded) {
                      ordersInGroup.forEach((order) => {
                        const index = globalIndexById.get(order.id)!;
                        rows.push(
                  <tr key={`${order.id}-${index}`} className="hover:bg-gray-50 border-b border-gray-300">
                    <td className="w-12 px-1 py-4 whitespace-nowrap text-sm text-gray-500 font-medium border border-gray-300">
                      {index + 1}
                    </td>
                    <td className="w-48 px-2 py-4 whitespace-nowrap border border-gray-300">
                      <div className="text-sm font-medium text-gray-900">{formatInvoiceNumber(order.invoiceNumber)}</div>
                      <div className="text-sm text-gray-500">{order.items.length} productos</div>
                    </td>
                    <td className="w-40 px-2 py-4 whitespace-nowrap border border-gray-300">
                      <div className="text-sm font-medium text-gray-900">{order.customerName}</div>
                      <div className="text-sm text-gray-500">{order.customerEmail}</div>
                    </td>
                    <td className="w-24 px-2 py-4 whitespace-nowrap border border-gray-300">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</div>
                      <div className="text-sm text-gray-500">
                        <select
                          value={order.paymentStatus}
                                                      onChange={(e) => {
                          const newPaymentStatus = e.target.value as 'pending' | 'paid' | 'failed';
                          // Update local state immediately for instant feedback
                          setOrders(prev => prev.map(o =>
                            o.id === order.id ? { ...o, paymentStatus: newPaymentStatus } : o
                          ));
                          // Also update in database and sync to client portal
                          updatePaymentStatusDirect(order.id, newPaymentStatus);
                        }}
                          className={`text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer hover:shadow-md transition-colors duration-200 ${
                            order.paymentStatus === 'paid' ? 'text-green-800 border-green-300' :
                            order.paymentStatus === 'pending' ? 'text-yellow-800 border-yellow-300' :
                            'text-red-800 border-red-300'
                          }`}
                        >
                          <option value="pending">Pago Pendiente</option>
                          <option value="paid">Pagado</option>
                          <option value="failed">Pago Fallido</option>
                        </select>
                      </div>
                    </td>
                    <td className="w-32 px-2 py-4 whitespace-nowrap border border-gray-300">
                      <div className="text-sm font-medium text-gray-900">
                        {(() => {
                          // Extract payment method from order details
                          const orderDetails = order.notes || '';
                          const paymentMethodMatch = orderDetails.match(/Método de pago: ([^|]+)/i);
                          if (paymentMethodMatch) {
                            const method = paymentMethodMatch[1].trim();
                            // Map payment method codes to readable names
                            switch (method) {
                              case 'wompi':
                                return 'Wompi';
                              case 'pse':
                                return 'Transferencia Bancaria';
                              case 'bank_transfer':
                                // Try to extract bank provider from order details
                                const bankProviderMatch = orderDetails.match(/Banco: ([^|]+)/i);
                                if (bankProviderMatch) {
                                  const bankProvider = bankProviderMatch[1].trim();
                                  switch (bankProvider) {
                                    case 'bancolombia':
                                      return 'Transferencia Bancaria - Bancolombia';
                                    case 'nequi':
                                      return 'Transferencia Bancaria - Nequi';
                                    case 'a_la_mano':
                                      return 'Transferencia Bancaria - A la Mano';
                                    default:
                                      return `Transferencia Bancaria - ${bankProvider}`;
                                  }
                                }
                                return 'Transferencia Bancaria';
                              case 'credit_card':
                                return 'Tarjeta de Crédito';
                              case 'stripe':
                                return 'Tarjeta de Crédito';
                              default:
                                return method;
                            }
                          }
                          return 'No especificado';
                        })()}
                      </div>
                    </td>
                    <td className="w-40 px-2 py-4 whitespace-nowrap border border-gray-300">
                      <div className="text-sm font-medium text-gray-900">
                        {order.trackingNumber ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-green-600 font-semibold">{order.trackingNumber}</span>
                              <button
                                onClick={() => openTrackingModal(order, true)}
                                className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors duration-200"
                                title="Editar número de seguimiento"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => {
                                  showConfirmModal(
                                    '🗑️ Eliminar Número de Seguimiento',
                                    '¿Eliminar el número de seguimiento?\n\nEsta acción no se puede deshacer, pero puedes agregar uno nuevo en cualquier momento.',
                                    () => clearTrackingInfo(order.id),
                                    'Eliminar',
                                    'bg-red-600 hover:bg-red-700'
                                  );
                                }}
                                className="text-red-600 hover:text-red-800 text-xs bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors duration-200"
                                title="Eliminar número de seguimiento"
                              >
                                🗑️
                              </button>
                            </div>
                            {order.courier && (
                              <div className="text-xs text-gray-500">{order.courier}</div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openTrackingModal(order, false)}
                            className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors duration-200"
                            title="Agregar número de seguimiento"
                          >
                            📦 Agregar Seguimiento
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="w-28 px-2 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                      {(() => {
                        const formattedDate = formatDate(order.orderDate);
                        return (
                          <>
                            <div className="text-sm font-medium text-gray-900">{formattedDate.dateOnly}</div>
                            <div className="text-sm text-gray-500">{formattedDate.timeOnly}</div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="w-32 px-2 py-4 whitespace-nowrap text-sm font-medium border border-gray-300">
                      <div className="flex flex-col gap-2">
                        <select
                          value={order.status}
                                                      onChange={(e) => {
                          const newStatus = e.target.value as VirtualOrder['status'];
                          // Update local state immediately for instant feedback
                          setOrders(prev => prev.map(o =>
                            o.id === order.id ? { ...o, status: newStatus } : o
                          ));
                          // Also update in database and sync to client portal
                          updateOrderStatus(order.id, newStatus);
                        }}
                          className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium min-w-[100px]"
                          style={{
                            color: order.status === 'new' ? '#ea580c' :
                                   order.status === 'confirmed' ? '#1d4ed8' :
                                   order.status === 'shipped' ? '#7c3aed' :
                                   order.status === 'delivered' ? '#15803d' :
                                   order.status === 'cancelled' ? '#dc2626' : '#374151',
                            fontWeight: '600',
                            backgroundColor: order.status === 'new' ? '#fed7aa' :
                                           order.status === 'confirmed' ? '#dbeafe' :
                                           order.status === 'shipped' ? '#f3e8ff' :
                                           order.status === 'delivered' ? '#dcfce7' :
                                           order.status === 'cancelled' ? '#fee2e2' : '#f9fafb'
                          }}
                        >
                          <option value="new">Nuevo</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="shipped">En Camino</option>
                          <option value="delivered">Entregado</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium bg-indigo-50 hover:bg-indigo-100 p-1 rounded transition-colors duration-200"
                            title="Ver detalles"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleStar(order.id)}
                            className={`${order.isStarred ? 'text-amber-600 bg-amber-50' : 'text-gray-500 bg-gray-50'} hover:text-amber-700 hover:bg-amber-100 p-1 rounded transition-colors duration-200`}
                            title={order.isStarred ? 'Quitar de favoritos' : 'Marcar como favorito'}
                          >
                            <svg className="w-4 h-4" fill={order.isStarred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleArchive(order.id)}
                            className={`${order.isArchived ? 'text-cyan-600 bg-cyan-50' : 'text-gray-500 bg-gray-50'} hover:text-cyan-700 hover:bg-cyan-100 p-1 rounded transition-colors duration-200`}
                            title={order.isArchived ? 'Desarchivar' : 'Archivar'}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => openMessageModal(order)}
                            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1 rounded transition-colors duration-200"
                            title="Enviar mensaje al cliente"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => handleDelete(order)}
                            className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1 rounded transition-colors duration-200"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                      );
                      });
                    }
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Compact View */}
        <div className="md:hidden">
          <div className="space-y-3">
            {(() => {
              const groups = {} as Record<string, VirtualOrder[]>;
              for (const o of filteredOrders) {
                const key = getOrderEmail(o);
                if (!groups[key]) groups[key] = [];
                groups[key].push(o);
              }
              const sortedEmails = Object.keys(groups).sort();
              const globalIndexById = new Map<string, number>();
              filteredOrders.forEach((o, idx) => globalIndexById.set(o.id, idx));
              const cards: React.ReactNode[] = [];
              for (const email of sortedEmails) {
                const ordersInGroup = groups[email].sort((a, b) => (globalIndexById.get(a.id)! - globalIndexById.get(b.id)!));
                const displayName = getCustomerDisplayNameForOrder(ordersInGroup[0]);
                const isExpanded = expandedGroups.has(email);
                cards.push(
                  <div key={`m-group-${email}`} className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors shadow-sm" onClick={() => toggleGroupExpansion(email)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">{sortedEmails.indexOf(email) + 1}</span>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{displayName}</h3>
                          <p className="text-xs text-gray-500">{email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">{ordersInGroup.length} pedidos</span>
                        <svg 
                          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
                if (isExpanded) {
                  ordersInGroup.forEach((order) => {
                  const index = globalIndexById.get(order.id)!;
                  cards.push(
              <div key={`${order.id}-${index}`} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                {/* Compact Header Row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        #{formatInvoiceNumber(order.invoiceNumber)}
                      </h3>
                    </div>
                    <div className="space-y-1 mb-2">
                      <p className="text-xs text-gray-600">{order.customerName}</p>
                      <p className="text-xs text-gray-500">{order.customerEmail}</p>
                      {order.customerPhone && (
                        <p className="text-xs text-gray-500">📞 {order.customerPhone}</p>
                      )}
                    </div>
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span className="whitespace-nowrap">📅 {(() => {
                          const formattedDate = formatDate(order.orderDate);
                          return formattedDate.dateOnly;
                        })()}</span>
                        <span className="text-gray-400">•</span>
                        <span className="whitespace-nowrap">📦 {order.items.length} productos</span>
                      </div>
                      {/* Address Section - Compact */}
                      {(order.client?.address || order.client?.city || order.client?.department) && (
                        <div className="flex items-center space-x-2 text-xs text-gray-600 bg-blue-50 rounded px-2 py-1 border border-blue-100">
                          <span className="text-blue-600 flex-shrink-0">📍</span>
                          <span className="text-gray-600 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                            {[order.client?.address, order.client?.city, order.client?.department].filter(Boolean).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </p>
                    <div className="flex flex-col space-y-2 mt-1">
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => {
                          const newPaymentStatus = e.target.value as 'pending' | 'paid' | 'failed';
                          // Update local state immediately for instant feedback
                          setOrders(prev => prev.map(o =>
                            o.id === order.id ? { ...o, paymentStatus: newPaymentStatus } : o
                          ));
                          // Also update in database and sync to client portal
                          updatePaymentStatusDirect(order.id, newPaymentStatus);
                        }}
                        className={`text-xs border border-gray-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer hover:shadow-md transition-colors duration-200 ${
                          order.paymentStatus === 'paid' ? 'text-green-800 border-green-300' :
                          order.paymentStatus === 'pending' ? 'text-yellow-800 border-yellow-300' :
                          'text-red-800 border-red-300'
                        }`}
                      >
                        <option value="pending">Pago Pendiente</option>
                        <option value="paid">Pagado</option>
                        <option value="failed">Pago Fallido</option>
                      </select>
                      
                      {/* Shipping Status Selector - Below Payment Status */}
                      <select
                        value={order.status}
                        onChange={(e) => {
                          const newStatus = e.target.value as VirtualOrder['status'];
                          // Update local state immediately for instant feedback
                          setOrders(prev => prev.map(o =>
                            o.id === order.id ? { ...o, status: newStatus } : o
                          ));
                          // Also update in database and sync to client portal
                          updateOrderStatus(order.id, newStatus);
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer hover:shadow-md transition-all duration-200"
                        style={{
                          color: order.status === 'new' ? '#ea580c' :
                                 order.status === 'confirmed' ? '#1d4ed8' :
                                 order.status === 'shipped' ? '#7c3aed' :
                                 order.status === 'delivered' ? '#15803d' :
                                 order.status === 'cancelled' ? '#dc2626' : '#374151',
                          fontWeight: '600',
                          backgroundColor: order.status === 'new' ? '#fed7aa' :
                                         order.status === 'confirmed' ? '#dbeafe' :
                                         order.status === 'shipped' ? '#f3e8ff' :
                                         order.status === 'delivered' ? '#dcfce7' :
                                         order.status === 'cancelled' ? '#fee2e2' : '#f9fafb'
                        }}
                      >
                        <option value="new">Nuevo</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="shipped">En Camino</option>
                        <option value="delivered">Entregado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                {/* Shipping Information Cell */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 mb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="text-xs font-medium text-gray-700 mb-1">Información de Envío</h4>
                      <div className="space-y-1">
                        {/* Courier Name */}
                        {order.courier && (
                          <div className="flex items-center space-x-2">
                            <span className="text-blue-600">🚚</span>
                            <span className="text-sm text-blue-600 font-medium">{order.courier}</span>
                          </div>
                        )}
                        
                        {/* Tracking Number */}
                        {order.trackingNumber ? (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-green-600">📦</span>
                              <span className="text-sm text-green-600 font-medium">{order.trackingNumber}</span>
                            </div>
                            <button
                              onClick={() => openTrackingModal(order, true)}
                              className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors duration-200"
                              title="Editar seguimiento"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Sin número de seguimiento</span>
                            <button
                              onClick={() => openTrackingModal(order, false)}
                              className="text-blue-600 hover:text-blue-800 text-xs bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded transition-colors duration-200"
                              title="Agregar seguimiento"
                            >
                              📦 Agregar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Compact Actions Row */}
                <div className="flex items-center justify-center pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg transition-colors duration-200"
                      title="Ver detalles"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleStar(order.id)}
                      className={`${order.isStarred ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'} p-2 rounded-lg transition-colors duration-200`}
                      title={order.isStarred ? 'Quitar de favoritos' : 'Marcar como favorito'}
                    >
                      <svg className="w-4 h-4" fill={order.isStarred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleArchive(order.id)}
                      className={`${order.isArchived ? 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100' : 'text-gray-500 bg-gray-50 hover:bg-gray-100'} p-2 rounded-lg transition-colors duration-200`}
                      title={order.isArchived ? 'Desarchivar' : 'Archivar'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => openMessageModal(order)}
                      className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-lg transition-colors duration-200"
                      title="Enviar mensaje al cliente"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => handleDelete(order)}
                      className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-2 rounded-lg transition-colors duration-200"
                      title="Eliminar"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
                  );
                  });
                }
              }
              return cards;
            })()}
          </div>
        </div>
      </div>
    )}
  </div>

  {/* Order Details Modal */}
  {selectedOrder && createPortal(
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setSelectedOrder(null);
        }
      }}
    >
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] md:max-h-[70vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 md:px-4 py-2 md:py-3 rounded-t-xl z-10 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 md:space-x-3">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 md:w-4 md:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-gray-900">Pedido {formatInvoiceNumber(selectedOrder.invoiceNumber)}</h3>
                <p className="text-xs text-gray-500">Detalles completos del pedido</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedOrder(null)}
              className="w-5 h-5 md:w-6 md:h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-2.5 h-2.5 md:w-3 md:h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 md:p-4 space-y-3 md:space-y-4">
          {/* Client Information */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 md:p-3 border border-blue-100">
            <div className="flex items-center space-x-2 mb-2 md:mb-3">
              <div className="w-4 h-4 md:w-5 md:h-5 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-2 h-2 md:w-2.5 md:h-2.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h4 className="text-xs md:text-sm font-semibold text-gray-900">Información del Cliente</h4>
            </div>
            
            {/* Personal Information */}
            <div className="mb-2 md:mb-3">
              <h5 className="text-xs font-medium text-blue-700 mb-1 md:mb-2 uppercase tracking-wide">Datos Personales</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Nombre</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.name || selectedOrder.customerName || 'N/A'}</span>
                </div>
                
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Apellido</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.surname || 'N/A'}</span>
                </div>
                
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Email</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.customerEmail || 'N/A'}</span>
                </div>
                
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Teléfono</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.phone || selectedOrder.customerPhone || 'N/A'}</span>
                </div>
                
                {selectedOrder.client?.cedula && (
                  <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">Cédula</span>
                    </div>
                    <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client.cedula}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Address Information */}
            <div>
              <h5 className="text-xs font-medium text-blue-700 mb-1 md:mb-2 uppercase tracking-wide">Dirección de Envío</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Dirección</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.address || selectedOrder.shippingAddress || 'N/A'}</span>
                </div>
                
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Ciudad</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.city || 'N/A'}</span>
                </div>
                
                <div className="bg-white rounded-md p-1.5 md:p-2 border border-blue-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600">Departamento</span>
                  </div>
                  <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.department || 'N/A'}</span>
                </div>
                
                {selectedOrder.client?.postalCode && (
                  <div className="bg-white rounded-md p-2 border border-blue-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">Código Postal</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{selectedOrder.client.postalCode}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Order Details Section */}
          <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg p-3 border border-purple-100">
            <div className="flex items-center space-x-2 mb-3">
              <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Detalles del Pedido</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="bg-white rounded-md p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Número del Orden de Pedido</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatInvoiceNumber(selectedOrder.invoiceNumber)}</span>
              </div>
              
              <div className="bg-white rounded-md p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Estado del Pedido</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedOrder.status === 'new' ? 'bg-orange-100 text-orange-800' :
                  selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  selectedOrder.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                  selectedOrder.status === 'delivered' ? 'bg-green-100 text-green-800' :
                  selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedOrder.status === 'new' ? 'Nuevo' :
                   selectedOrder.status === 'confirmed' ? 'Confirmado' :
                   selectedOrder.status === 'shipped' ? 'En Camino' :
                   selectedOrder.status === 'delivered' ? 'Entregado' :
                   selectedOrder.status === 'cancelled' ? 'Cancelado' : 'Desconocido'}
                </span>
              </div>
              
              <div className="bg-white rounded-md p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Estado de Pago</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                  selectedOrder.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  selectedOrder.paymentStatus === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedOrder.paymentStatus === 'paid' ? 'Pagado' :
                   selectedOrder.paymentStatus === 'pending' ? 'Pago Pendiente' :
                   selectedOrder.paymentStatus === 'failed' ? 'Pago Fallido' : 'Desconocido'}
                </span>
              </div>
              
              <div className="bg-white rounded-md p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Total</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(selectedOrder.totalAmount)}</span>
              </div>
              
              <div className="bg-white rounded-md p-2 border border-purple-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Fecha del Pedido</span>
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {(() => {
                    const fd = formatDate(selectedOrder.orderDate);
                    return `${fd.dateOnly} ${fd.timeOnly}`;
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Products */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 border border-orange-100">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-5 h-5 bg-orange-100 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Productos ({getProductosArray(selectedOrder).length})</h4>
            </div>
            <div className="space-y-2">
              {getProductosArray(selectedOrder).map((product, index) => (
                <div key={index} className="bg-white rounded-lg p-2.5 border border-orange-200 shadow-sm">
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex-1">
                      <h5 className="font-semibold text-gray-900 text-sm">{product.name}</h5>
                      {product.brand && (
                        <p className="text-xs text-gray-500 mt-0.5">Marca: {product.brand}</p>
                      )}
                      {product.selectedColor && (
                        <p className="text-xs text-gray-500 mt-0.5">Color: {product.selectedColor}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">{formatCurrency(product.price)}</p>
                      <p className="text-xs text-gray-500">Cantidad: {product.quantity}</p>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-1.5">
                    <p className="text-xs text-gray-600">
                      Subtotal: {formatCurrency(product.price * product.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Information */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-sm font-semibold text-gray-900">Información del Pedido</h4>
            </div>
            <div className="space-y-2">
              {(() => {
                const parsedDetails = parseOrderDetails(selectedOrder.notes || '');
                return (
                  <>
                    {parsedDetails.type && (
                      <div className="bg-white rounded-lg p-2.5 border border-green-200 shadow-sm">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-gray-900 text-sm">Tipo</p>
                          <p className="font-bold text-gray-900 text-sm">{parsedDetails.type}</p>
                        </div>
                      </div>
                    )}
                    {/* Display payment method - always show this section */}
                    <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-900 text-xs md:text-sm">Método de Pago</p>
                        <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                          {parsedDetails.paymentMethod || 'No especificado'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Display bank information if available */}
                    {(() => {
                      const bankName = extractBankName(selectedOrder.notes || '');
                      if (bankName) {
                        return (
                          <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-gray-900 text-xs md:text-sm">Banco</p>
                              <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                                {bankName}
                              </p>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Display tracking number */}
                    <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-900 text-xs md:text-sm">Número de Seguimiento</p>
                        <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                          {selectedOrder.trackingNumber || 'No especificado'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Display courier name */}
                    <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-gray-900 text-xs md:text-sm">Empresa de Envío</p>
                        <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                          {selectedOrder.courier || 'No especificado'}
                        </p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>



          {/* PDF Link */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 md:p-4 border border-green-100">
            <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
              <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 md:w-4 md:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-sm md:text-lg font-semibold text-gray-900">Documento PDF</h4>
            </div>
            <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 md:space-x-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 md:w-5 md:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-900">Orden de Pedido PDF</p>
                  </div>
                </div>
                {selectedOrder.fileUrl ? (
                  <a
                    href={selectedOrder.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors duration-200"
                  >
                    <svg className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar PDF
                  </a>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 bg-gray-300 text-gray-600 text-xs md:text-sm font-medium rounded-lg cursor-not-allowed">
                    <svg className="w-3 h-3 md:w-4 md:h-4 mr-1.5 md:mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                    </svg>
                    No disponible
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  , document.body)}

  {/* Tracking Modal */}
  {trackingModalOpen && editingOrder && createPortal(
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={() => closeTrackingModal()}
    >
      <div
        className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
            {isEditing ? (
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            ) : (
              <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">
            {isEditing ? '✏️ Editar Seguimiento' : '📦 Agregar Seguimiento'}
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="trackingNumber" className="block text-sm font-bold text-black mb-2" style={{color: 'black !important'}}>
                Número de Seguimiento *
              </label>
              <input
                type="text"
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-700 text-black"
                placeholder="Ingresa el número de seguimiento"
                required
              />
            </div>
            <div>
              <label htmlFor="courier" className="block text-sm font-bold text-black mb-2" style={{color: 'black !important'}}>
                Empresa de Envío *
              </label>
              <input
                type="text"
                id="courier"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-700 text-black"
                placeholder="Ej: Servientrega, Interrapidisimo, Coordinadora, TCC, Deprisa, FedEx, DHL, 4-72..."
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-center space-x-3 mt-6">
            <button
              onClick={handleTrackingSubmit}
              disabled={!trackingNumber.trim() || !courier.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? 'Actualizar' : 'Agregar'}
            </button>
            <button
              onClick={closeTrackingModal}
              className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)}

  {/* Message Modal */}
  {messageModalOpen && selectedOrderForMessage && createPortal(
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={() => closeMessageModal()}
    >
      <div
        className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-medium text-gray-900 text-center mb-6">
            💬 Enviar Mensaje al Cliente
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Pedido #{selectedOrderForMessage.invoiceNumber}
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Cliente: {selectedOrderForMessage.customerName}
              </p>
            </div>
            <div>
              <label htmlFor="adminMessage" className="block text-sm font-bold text-black mb-2">
                Mensaje para el Cliente *
              </label>
              <textarea
                id="adminMessage"
                value={adminMessageText}
                onChange={(e) => setAdminMessageText(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-700 text-black"
                required
              />
              <div className="mt-1 text-xs text-gray-500 text-right">
                {adminMessageText.length}/500 caracteres
              </div>
            </div>

            {/* File Upload Section */}
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Archivos Adjuntos (Opcional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="fileUpload"
                  disabled={uploadingFiles}
                />
                <label
                  htmlFor="fileUpload"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm text-gray-600">
                    {uploadingFiles ? 'Subiendo archivos...' : 'Haz clic para seleccionar archivos'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Imágenes (JPG, PNG, GIF) y PDFs hasta 10MB
                  </span>
                </label>
              </div>

              {/* Selected Files Preview */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Archivos seleccionados ({selectedFiles.length})
                    </span>
                    <button
                      onClick={clearFiles}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Limpiar todo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                        <div className="flex items-center space-x-2">
                          {file.type.startsWith('image/') ? (
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          )}
                          <span className="text-sm text-gray-700 truncate max-w-48">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024 / 1024).toFixed(1)}MB)
                          </span>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Previous Messages Preview */}
            {((selectedOrderForMessage.adminMessages && selectedOrderForMessage.adminMessages.length > 0) || selectedOrderForMessage.adminMessage) && (
              <div className="p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Mensajes Anteriores:</h4>
                {selectedOrderForMessage.adminMessages?.map((msg, index) => (
                  <div key={index} className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                    <p className="text-sm text-gray-700 mb-1">{msg.message}</p>
                    <p className="text-xs text-gray-500">
                      Enviado: {formatDate(msg.date).dateOnly}
                    </p>
                  </div>
                ))}
                {selectedOrderForMessage.adminMessage && !selectedOrderForMessage.adminMessages?.length && (
                  <div className="mb-2 pb-2 border-b border-gray-200 last:border-b-0">
                    <p className="text-sm text-gray-700 mb-1">{selectedOrderForMessage.adminMessage}</p>
                    <p className="text-xs text-gray-500">
                      Enviado: {selectedOrderForMessage.adminMessageDate ?
                        formatDate(selectedOrderForMessage.adminMessageDate).dateOnly : 'N/A'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-center space-x-3 mt-6">
            <button
              onClick={handleSendAdminMessage}
              disabled={!adminMessageText.trim() || isSendingMessage}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSendingMessage ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Enviando...</span>
                </span>
              ) : (
                'Enviar Mensaje'
              )}
            </button>
            <button
              onClick={closeMessageModal}
              className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)}

  {/* Payment Status Modal */}
  {paymentStatusModalOpen && paymentOrder && createPortal(
    <div
      className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={() => closePaymentStatusModal()}
    >
      <div
        className="relative bg-white rounded-xl shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mt-4 text-center">
            💳 Cambiar Estado de Pago
          </h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Pedido #{paymentOrder.invoiceNumber}
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Cliente: {paymentOrder.customerName}
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Estado Actual
              </label>
              <div className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                paymentOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                paymentOrder.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {paymentOrder.paymentStatus === 'paid' ? 'Pagado' :
                 paymentOrder.paymentStatus === 'pending' ? 'Pago Pendiente' : 'Pago Fallido'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-black mb-2">
                Nuevo Estado
              </label>
              <select
                value={newPaymentStatus}
                onChange={(e) => setNewPaymentStatus(e.target.value as 'pending' | 'paid' | 'failed')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              >
                <option value="pending">Pago Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="failed">Pago Fallido</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-center space-x-3 mt-6">
            <button
              onClick={updatePaymentStatus}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              Actualizar Estado
            </button>
            <button
              onClick={closePaymentStatusModal}
              className="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)}

  {/* Delete Confirmation Modal */}
  {deleteModalOpen && orderToDelete && createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={() => {
        setDeleteModalOpen(false);
        setOrderToDelete(null);
      }}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[75vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Confirmar Eliminación</h3>
                <p className="text-xs text-gray-500">Eliminar pedido permanentemente</p>
              </div>
            </div>
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setOrderToDelete(null);
              }}
              className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>

          {/* Order Information */}
          <div className="text-center space-y-2">
            <h4 className="text-lg font-semibold text-gray-900">
              ¿Eliminar este pedido?
            </h4>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                Cliente: <span className="text-blue-600">{orderToDelete.customerName}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Pedido #{orderToDelete.invoiceNumber}
              </p>
              <p className="text-sm font-medium text-gray-700 mt-2">
                Total: {formatCurrency(orderToDelete.totalAmount)}
              </p>
            </div>
            <p className="text-sm text-red-600 font-medium">
              ⚠️ Esta acción no se puede deshacer
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={confirmDelete}
              className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
            >
              <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar Pedido
            </button>
            <button
              onClick={() => {
                setDeleteModalOpen(false);
                setOrderToDelete(null);
              }}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors duration-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)}

  {/* Modern Confirmation Modal */}
  {confirmModalOpen && createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
      onClick={closeConfirmModal}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[75vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 rounded-t-xl z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{confirmTitle}</h3>
              </div>
            </div>
            <button
              onClick={closeConfirmModal}
              className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
              title="Cerrar modal"
            >
              <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-700 whitespace-pre-line">{confirmMessage}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={async () => {
                if (confirmAction) {
                  try {
                    await confirmAction();
                    // The action should handle closing the modal itself
                  } catch (error) {
                    console.error('Error in confirmation action:', error);
                    // If there's an error, close the modal anyway
                    closeConfirmModal();
                  }
                }
              }}
              className={`flex-1 px-4 py-3 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${confirmButtonColor}`}
            >
              {confirmButtonText}
            </button>
            <button
              onClick={closeConfirmModal}
              className="flex-1 px-4 py-3 bg-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors duration-200"
            >
              Cancelar
            </button>
          </div>
          

        </div>
      </div>
    </div>
  , document.body)}

  {/* Success/Error Notification */}
  {notificationOpen && createPortal(
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`rounded-lg shadow-lg p-4 ${
        notificationType === 'success'
          ? 'bg-green-50 border border-green-200 text-green-800'
          : 'bg-red-50 border border-red-200 text-red-800'
      }`}>
        <div className="flex items-start space-x-3">
          <div className={`flex-shrink-0 w-5 h-5 ${
            notificationType === 'success' ? 'text-green-400' : 'text-red-400'
          }`}>
            {notificationType === 'success' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{notificationMessage}</p>
          </div>
          <button
            onClick={() => setNotificationOpen(false)}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  , document.body)}
  </div>
</div>
);
} 
