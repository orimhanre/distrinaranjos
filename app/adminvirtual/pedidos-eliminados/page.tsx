'use client';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { virtualAuth, virtualGoogleProvider } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';
import { getInvoiceNumber, formatInvoiceNumber } from '@/lib/invoiceNumberClient';

interface DeletedOrder {
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
  cartItems?: Array<{
    productId?: string;
    id?: string;
    productName?: string;
    name?: string;
    quantity: number;
    price?: number;
    unitPrice?: number;
    selectedColor?: string;
    color?: string;
    brand?: string;
  }>;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  shippingAddress: string;
  trackingNumber?: string;
  courier?: string;
  orderDate: any;
  timestamp?: any;
  notes?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  deletedAt?: string;
  fileUrl?: string;
  adminMessage?: string;
  adminMessageDate?: any;
  retentionDate?: string;
  comentario?: string;
  orderDetails?: string;
  fileName?: string;
  // New orders array structure
  orders?: Array<{
    orderId: string;
    invoiceNumber: string;
    status: string;
    paymentStatus: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      price: number;
      selectedColor?: string;
      brand?: string;
    }>;
    totalAmount: number;
    subtotal: number;
    shippingCost: number;
    orderDetails: string;
    comentario: string;
    fileName: string;
    fileUrl: string;
    trackingNumber: string;
    courier: string;
    orderDate: any;
    lastUpdated: any;
    paymentMethod: string;
    adminMessage: string;
    adminMessageDate: any;
  }>;
}

export default function DeletedOrdersPage() {
  const [user, setUser] = useState<User | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [deletedOrders, setDeletedOrders] = useState<DeletedOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [permissionLoading, setPermissionLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<DeletedOrder | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<DeletedOrder | null>(null);
  const [showDeletedMessages, setShowDeletedMessages] = useState(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [isCleaningUp, setIsCleaningUp] = useState<boolean>(false);

  // Function to extract bank name from comentario field (similar to AdminVirtualApp)
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



  // Group orders by customer email (similar to iOS AdminVirtualApp)
  const groupedOrders = React.useMemo(() => {
    const grouped: { [key: string]: DeletedOrder[] } = {};
    
    for (const order of deletedOrders) {
      let key: string;
      if (order.customerEmail && order.customerEmail.trim() !== '') {
        key = order.customerEmail;
      } else if (order.client?.email && order.client.email.trim() !== '') {
        key = order.client.email;
      } else {
        key = 'Sin email';
      }
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(order);
    }
    
    return grouped;
  }, [deletedOrders]);

  // Get sorted customer emails
  const sortedCustomerEmails = React.useMemo(() => {
    return Object.keys(groupedOrders).sort();
  }, [groupedOrders]);

  // Get customer display name
  const getCustomerDisplayName = (email: string): string => {
    const customerOrders = groupedOrders[email];
    if (customerOrders && customerOrders.length > 0) {
      const firstOrder = customerOrders[0];
      
      // Try to get name from client data first
      if (firstOrder.client?.name && firstOrder.client?.surname) {
        return `${firstOrder.client.name} ${firstOrder.client.surname}`;
      }
      
      // Try company name
      if (firstOrder.client?.companyName && firstOrder.client.companyName.trim() !== '') {
        return firstOrder.client.companyName;
      }
      
      // Try customer name
      if (firstOrder.customerName && firstOrder.customerName.trim() !== '') {
        return firstOrder.customerName;
      }
      
      // Fallback to email
      return email;
    }
    return email;
  };

  // Filter orders based on search term
  const filteredDeletedOrders = deletedOrders.filter(order => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in invoice number
    if (order.invoiceNumber?.toLowerCase().includes(searchLower)) return true;
    
    // Search in customer name
    if (order.customerName?.toLowerCase().includes(searchLower)) return true;
    if (order.client?.name?.toLowerCase().includes(searchLower)) return true;
    if (order.client?.surname?.toLowerCase().includes(searchLower)) return true;
    
    // Search in customer email
    if (order.customerEmail?.toLowerCase().includes(searchLower)) return true;
    
    // Search in product names
    if (order.items?.some((item: any) => 
      item.name?.toLowerCase().includes(searchLower) ||
      item.productName?.toLowerCase().includes(searchLower)
    )) return true;
    
    // Search in status
    if (order.status?.toLowerCase().includes(searchLower)) return true;
    
    return false;
  });

  // Simple UI toggle - no Firebase persistence needed
  const toggleShowDeletedMessages = () => {
    setShowDeletedMessages(!showDeletedMessages);
  };

  const handleOrderSelect = (order: DeletedOrder) => {
    setSelectedOrder(order);
  };

  const toggleCustomerExpansion = (customerEmail: string) => {
    setExpandedCustomers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(customerEmail)) {
        newSet.delete(customerEmail);
      } else {
        newSet.add(customerEmail);
      }
      return newSet;
    });
  };

  useEffect(() => {
    if (!virtualAuth) {
      return;
    }
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



  useEffect(() => {
    // Always allow authentication, only control data fetching
    if (hasPermission && showDeletedMessages) {
      const fetchDeletedOrders = async () => {
        try {
          // Add a small delay to ensure Firestore has indexed the deleted order
          await new Promise(resolve => setTimeout(resolve, 1000));
          const response = await fetch('/api/admin/deleted-orders?virtual=true');
          if (response.ok) {
            const data = await response.json();
            console.log('🔍 Raw deleted orders data:', data.deletedOrders);
            console.log('🔍 Raw deleted orders count:', data.deletedOrders?.length || 0);
            
            // Transform the data structure for virtual admin orders
            // Handle multiple orders per customer document
            const allTransformedOrders: DeletedOrder[] = [];
            
            data.deletedOrders.forEach((order: any) => {
                // Debug: Log the raw order data to see the structure
                console.log('🔍 Processing order:', order.id, 'email sources:', {
                    clientEmail: order.clientEmail,
                    clientEmail2: order.client?.email,
                    orderEmail: order.email,
                    userAuthEmail: order.userAuth?.email,
                    orderDetails: order.orderDetails,
                    comentario: order.comentario,
                    ordersCount: order.orders?.length || 0
                });

                // Process each order in the orders array
                if (order.orders && Array.isArray(order.orders)) {
                    order.orders.forEach((individualOrder: any, orderIndex: number) => {
                        console.log(`🔍 Processing individual order ${orderIndex}:`, individualOrder.invoiceNumber);
                        
                        const transformedOrder: DeletedOrder = {
                          id: `${order.id}_${individualOrder.orderId || individualOrder.invoiceNumber || orderIndex}`,
                          invoiceNumber: individualOrder.invoiceNumber || 'N/A',
                          customerName: (() => {
                    // Try multiple sources for customer name
                    if (order.client?.name && order.client?.surname) {
                      return `${order.client.name} ${order.client.surname}`;
                    }
                    if (order.client?.companyName && order.client.companyName.trim() !== '') {
                      return order.client.companyName;
                    }
                    if (order.customerName && order.customerName.trim() !== '') {
                      return order.customerName;
                    }
                    if (order.name && order.name.trim() !== '') {
                      return order.name;
                    }
                    if (order.userAuth?.displayName && order.userAuth.displayName.trim() !== '') {
                      return order.userAuth.displayName;
                    }
                    if (order.userAuth?.userName && order.userAuth.userName.trim() !== '') {
                      return order.userAuth.userName;
                    }
                    return 'Cliente Web';
                  })(),
                  customerEmail: (() => {
                    // Try multiple sources for email, matching iOS app logic
                    if (order.clientEmail && order.clientEmail.trim() !== '') {
                      return order.clientEmail;
                    }
                    if (order.client?.email && order.client.email.trim() !== '') {
                      return order.client.email;
                    }
                    if (order.email && order.email.trim() !== '') {
                      return order.email;
                    }
                    if (order.userAuth?.email && order.userAuth.email.trim() !== '') {
                      return order.userAuth.email;
                    }
                    // Try to extract email from orderDetails if it exists
                    if (order.orderDetails && typeof order.orderDetails === 'string') {
                      const emailMatch = order.orderDetails.match(/email[:\s]+([^\s|]+)/i);
                      if (emailMatch) return emailMatch[1];
                    }
                    // Try to extract email from comentario if it exists
                    if (order.comentario && typeof order.comentario === 'string') {
                      const emailMatch = order.comentario.match(/email[:\s]+([^\s|]+)/i);
                      if (emailMatch) return emailMatch[1];
                    }
                    return 'N/A';
                  })(),
                  customerPhone: order.client?.phone || 'N/A',
                  client: {
                    name: order.client?.name || '',
                    surname: order.client?.surname || '',
                    companyName: order.client?.companyName || '',
                    email: order.client?.email || '',
                    phone: order.client?.phone || '',
                    address: order.client?.address || '',
                    city: order.client?.city || '',
                    department: order.client?.department || '',
                    cedula: order.client?.cedula || '',
                    postalCode: order.client?.postalCode || ''
                  },
                  items: (() => {
                    // Match iOS app logic: try top-level items first, then cartItems, then nested orders
                    
                    // First try to get from top-level items
                    if (order.items && Array.isArray(order.items)) {
                      return order.items.map((item: any) => ({
                        productId: item.productId || 'unknown',
                        productName: item.productName || 'Producto',
                        quantity: item.quantity || 1,
                        price: item.price || 0,
                        selectedColor: item.selectedColor || '',
                        brand: item.brand || ''
                      }));
                    }
                    
                    // Then try cartItems structure
                    if (order.cartItems && Array.isArray(order.cartItems)) {
                      return order.cartItems.map((item: any) => ({
                        productId: item.id || item.productId || 'unknown',
                        productName: item.product?.name || item.productName || 'Producto',
                        quantity: item.quantity || 1,
                        price: item.product?.price || item.price || 0,
                        selectedColor: item.selectedColor || item.color || '',
                        brand: item.product?.brand || item.brand || ''
                      }));
                    }
                    
                    // Finally try nested orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      if (firstOrder.items && Array.isArray(firstOrder.items)) {
                        return firstOrder.items.map((item: any) => ({
                          productId: item.productId || 'unknown',
                          productName: item.productName || 'Producto',
                          quantity: item.quantity || 1,
                          price: item.price || item.unitPrice || 0,
                          selectedColor: item.selectedColor || item.color || '',
                          brand: item.brand || ''
                        }));
                      }
                    }
                    
                    return [];
                  })(),
                  cartItems: order.cartItems || [],
                  totalAmount: (() => {
                    // Match iOS app logic: try top-level first, then nested orders
                    
                    // First try top-level totalAmount or subtotal
                    if (order.totalAmount || order.total || order.subtotal) {
                      return order.totalAmount || order.total || order.subtotal || 0;
                    }
                    
                    // Then try nested orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.totalAmount || firstOrder.subtotal || 0;
                    }
                    
                    return 0;
                  })(),
                  status: individualOrder.status || 'pending',
                  paymentStatus: individualOrder.paymentStatus || 'pending',
                  paymentMethod: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      // Try to extract payment method from comentario first
                      if (firstOrder.comentario && typeof firstOrder.comentario === 'string') {
                        const paymentMethodMatch = firstOrder.comentario.match(/Método de pago: ([^|]+)/i);
                        if (paymentMethodMatch) {
                          const method = paymentMethodMatch[1].trim();
                          // Map payment method codes to readable names
                          if (method === 'wompi') {
                            return 'Wompi';
                          } else if (method === 'bank_transfer') {
                            return 'Transferencia Bancaria';
                          } else if (method === 'bancolombia') {
                            return 'Transferencia Bancaria - Bancolombia';
                          } else if (method === 'nequi') {
                            return 'Transferencia Bancaria - Nequi';
                          } else if (method === 'a_la_mano') {
                            return 'Transferencia Bancaria - A la Mano';
                          } else if (method.startsWith('bank_')) {
                            const bankProvider = method.replace('bank_', '').replace(/_/g, ' ').toUpperCase();
                            return `Transferencia Bancaria - ${bankProvider}`;
                          } else if (method.includes('transfer')) {
                            return 'Transferencia Bancaria';
                          } else if (method === 'credit_card') {
                            return 'Tarjeta de Crédito';
                          } else if (method === 'card') {
                            return 'Tarjeta de Crédito';
                          } else {
                            return method;
                          }
                        }
                      }
                      return firstOrder.paymentMethod || '';
                    }
                    
                    // Fallback to old structure
                    if (order.comentario && typeof order.comentario === 'string') {
                      const paymentMethodMatch = order.comentario.match(/Método de pago: ([^|]+)/i);
                      if (paymentMethodMatch) {
                        const method = paymentMethodMatch[1].trim();
                        // Map payment method codes to readable names
                        if (method === 'wompi') {
                          return 'Wompi';
                        } else if (method === 'bank_transfer') {
                          return 'Transferencia Bancaria';
                        } else if (method === 'bancolombia') {
                          return 'Transferencia Bancaria - Bancolombia';
                        } else if (method === 'nequi') {
                          return 'Transferencia Bancaria - Nequi';
                        } else if (method === 'a_la_mano') {
                          return 'Transferencia Bancaria - A la Mano';
                        } else if (method.startsWith('bank_')) {
                          const bankProvider = method.replace('bank_', '').replace(/_/g, ' ').toUpperCase();
                          return `Transferencia Bancaria - ${bankProvider}`;
                        } else if (method.includes('transfer')) {
                          return 'Transferencia Bancaria';
                        } else if (method === 'credit_card') {
                          return 'Tarjeta de Crédito';
                        } else if (method === 'card') {
                          return 'Tarjeta de Crédito';
                        } else {
                          return method;
                        }
                      }
                    }
                    return order.paymentMethod || '';
                  })(),
                  shippingAddress: order.shippingAddress || '',
                  trackingNumber: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.trackingNumber || '';
                    }
                    
                    // Fallback to old structure
                    return order.trackingNumber || '';
                  })(),
                  courier: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.courier || '';
                    }
                    
                    // Fallback to old structure
                    return order.courier || '';
                  })(),
                  orderDate: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.orderDate || new Date();
                    }
                    
                    // Fallback to old structure
                    return order.orderDate || order.timestamp || new Date();
                  })(),
                  notes: (() => {
                    // Use the new orders array structure (prioritize nested orders comentario like AdminVirtualApp)
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.comentario || firstOrder.orderDetails || '';
                    }
                    
                    // Fallback to old structure
                    return order.comentario || order.orderDetails || '';
                  })(),
                  isStarred: false,
                  isArchived: false,
                  deletedAt: (() => {
                    // Use the new orders array structure first, then fallback to top-level
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      if (firstOrder.deletedAt) {
                        if (typeof firstOrder.deletedAt === 'string') {
                          return firstOrder.deletedAt;
                        }
                        if (firstOrder.deletedAt.toDate && typeof firstOrder.deletedAt.toDate === 'function') {
                          return firstOrder.deletedAt.toDate().toISOString();
                        }
                        if (firstOrder.deletedAt instanceof Date) {
                          return firstOrder.deletedAt.toISOString();
                        }
                      }
                    }
                    
                    // Fallback to top-level deletedAt
                    if (order.deletedAt) {
                      if (typeof order.deletedAt === 'string') {
                        return order.deletedAt;
                      }
                      if (order.deletedAt.toDate && typeof order.deletedAt.toDate === 'function') {
                        return order.deletedAt.toDate().toISOString();
                      }
                      if (order.deletedAt instanceof Date) {
                        return order.deletedAt.toISOString();
                      }
                    }
                    return '';
                  })(),
                  fileUrl: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.fileUrl || '';
                    }
                    
                    // Fallback to old structure
                    return order.fileUrl || '';
                  })(),
                  adminMessage: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.adminMessage || '';
                    }
                    
                    // Fallback to old structure
                    return order.adminMessage || '';
                  })(),
                  adminMessageDate: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.adminMessageDate || null;
                    }
                    
                    // Fallback to old structure
                    return order.adminMessageDate || null;
                  })(),
                  retentionDate: (() => {
                    // Use the new orders array structure first, then fallback to top-level
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      if (firstOrder.retentionDate) {
                        if (typeof firstOrder.retentionDate === 'string') {
                          return firstOrder.retentionDate;
                        }
                        if (firstOrder.retentionDate.toDate && typeof firstOrder.retentionDate.toDate === 'function') {
                          return firstOrder.retentionDate.toDate().toISOString();
                        }
                        if (firstOrder.retentionDate instanceof Date) {
                          return firstOrder.retentionDate.toISOString();
                        }
                      }
                    }
                    
                    // Fallback to top-level retentionDate
                    if (order.retentionDate) {
                      if (typeof order.retentionDate === 'string') {
                        return order.retentionDate;
                      }
                      if (order.retentionDate.toDate && typeof order.retentionDate.toDate === 'function') {
                        return order.retentionDate.toDate().toISOString();
                      }
                      if (order.retentionDate instanceof Date) {
                        return order.retentionDate.toISOString();
                      }
                    }
                    
                    // If no retention date is set, calculate it from deletedAt (30 days from deletion)
                    const deletedAtValue = (() => {
                      // Try to get deletedAt from nested orders first
                      if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                        const firstOrder = order.orders[0];
                        if (firstOrder.deletedAt) {
                          if (typeof firstOrder.deletedAt === 'string') {
                            return new Date(firstOrder.deletedAt);
                          }
                          if (firstOrder.deletedAt.toDate && typeof firstOrder.deletedAt.toDate === 'function') {
                            return firstOrder.deletedAt.toDate();
                          }
                          if (firstOrder.deletedAt instanceof Date) {
                            return firstOrder.deletedAt;
                          }
                        }
                      }
                      
                      // Fallback to top-level deletedAt
                      if (order.deletedAt) {
                        if (typeof order.deletedAt === 'string') {
                          return new Date(order.deletedAt);
                        }
                        if (order.deletedAt.toDate && typeof order.deletedAt.toDate === 'function') {
                          return order.deletedAt.toDate();
                        }
                        if (order.deletedAt instanceof Date) {
                          return order.deletedAt;
                        }
                      }
                      return null;
                    })();
                    
                    if (deletedAtValue && !isNaN(deletedAtValue.getTime())) {
                      const retentionDate = new Date(deletedAtValue.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
                      return retentionDate.toISOString();
                    }
                    
                    return '';
                  })(),
                  comentario: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.comentario || '';
                    }
                    
                    // Fallback to old structure
                    return order.comentario || '';
                  })(),
                  orderDetails: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.orderDetails || '';
                    }
                    
                    // Fallback to old structure
                    return order.orderDetails || '';
                  })(),
                  fileName: (() => {
                    // Use the new orders array structure
                    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
                      const firstOrder = order.orders[0];
                      return firstOrder.fileName || '';
                    }
                    
                    // Fallback to old structure
                    return order.fileName || '';
                  })()
                };
                
                // Add the transformed order to the array
                allTransformedOrders.push(transformedOrder);
              });
            }
          });
            
            console.log('🔍 Transformed orders count:', allTransformedOrders.length);
            console.log('🔍 Transformed orders:', allTransformedOrders.map(o => ({
              id: o.id,
              email: o.customerEmail,
              name: o.customerName,
              itemsCount: o.items?.length || 0
            })));
            
            // Check for duplicate orders
            const orderIds = allTransformedOrders.map(order => order.id);
            const uniqueIds = new Set(orderIds);
            if (orderIds.length !== uniqueIds.size) {
              console.warn('Duplicate deleted orders detected:', orderIds.filter((id, index) => orderIds.indexOf(id) !== index));
            }
            
            // Remove duplicates by keeping only the first occurrence of each order ID
            const uniqueOrders = allTransformedOrders.filter((order, index, self) => 
              index === self.findIndex(o => o.id === order.id)
            );

            // Keep all orders - don't deduplicate by email since we want to see all deleted orders
            const finalUniqueOrders = uniqueOrders;

            console.log('🔍 Final unique orders count:', finalUniqueOrders.length);
            console.log('🔍 Final unique orders:', finalUniqueOrders.map(o => ({
              id: o.id,
              email: o.customerEmail,
              name: o.customerName
            })));

            
            setDeletedOrders(finalUniqueOrders);
          } else {
            console.error('Failed to fetch deleted orders');
            setDeletedOrders([]);
          }
        } catch (error) {
          console.error('Error fetching deleted orders:', error);
          setDeletedOrders([]);
        } finally {
          setLoading(false);
        }
      };

      fetchDeletedOrders();
    }
  }, [hasPermission]);

  // Login/Logout handlers (identical to main admin page)
  const handleLogin = async () => {
    try {
      if (!virtualAuth || !virtualGoogleProvider) {
        return;
      }
      
      const result = await signInWithPopup(virtualAuth, virtualGoogleProvider);
    } catch (error) {
      alert('Error al iniciar sesión con Google: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    }
  };

  const handleLogout = async () => {
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      return;
    }
    await signOut(virtualAuth);
  };

  const handleDelete = (order: DeletedOrder) => {
    setOrderToDelete(order);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    
    try {
              const response = await fetch('/api/admin/permanently-delete-order?virtual=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderToDelete.id
        }),
      });

      if (response.ok) {
        // Remove from local state
        setDeletedOrders(prev => prev.filter(order => order.id !== orderToDelete.id));
        setDeleteModalOpen(false);
        setOrderToDelete(null);
      } else {
        const error = await response.json();
        alert('Error al eliminar permanentemente: ' + (error.error || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error permanently deleting order:', error);
      alert('Error al eliminar permanentemente: ' + error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return { dateOnly: 'N/A', timeOnly: 'N/A' };
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { dateOnly: 'N/A', timeOnly: 'N/A' };
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

  const getDaysUntilDeletion = (retentionDate: string, deletedAt?: string) => {
    let retention: Date;
    
    if (retentionDate) {
      retention = new Date(retentionDate);
      if (!isNaN(retention.getTime())) {
        const now = new Date();
        const diffTime = retention.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const result = Math.max(0, diffDays);
        return result;
      }
    }
    
    // If retention date is not available, calculate from deletedAt
    if (deletedAt) {
      const deleted = new Date(deletedAt);
      if (!isNaN(deleted.getTime())) {
        const retentionDate = new Date(deleted.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        const now = new Date();
        const diffTime = retentionDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const result = Math.max(0, diffDays);
        return result;
      }
    }
    
    return 0;
  };

  const formatOrderNumber = (orderId: string) => {
    // Create a more user-friendly order number
    // Take the last 6 characters of the order ID and format it
    const shortId = orderId.slice(-6).toUpperCase();
    return `#${shortId}`;
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

  const getProductosArray = (order: DeletedOrder) => {
    // Use the new orders array structure
    if (order.orders && Array.isArray(order.orders) && order.orders.length > 0) {
      const firstOrder = order.orders[0];
      if (firstOrder.items && Array.isArray(firstOrder.items) && firstOrder.items.length > 0) {
        return firstOrder.items.map((item) => ({
          name: item.productName || 'Producto sin nombre',
          quantity: item.quantity || 1,
          price: item.price || 0,
          brand: item.brand || '',
          color: item.selectedColor || ''
        }));
      }
    }
    
    // Fallback to old structure if orders array not available
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      return order.items.map((item) => ({
        name: item.productName || 'Producto sin nombre',
        quantity: item.quantity || 1,
        price: item.price || 0,
        brand: item.brand || '',
        color: item.selectedColor || ''
      }));
    }
    
    // Also check for cartItems field
    if (order.cartItems && Array.isArray(order.cartItems) && order.cartItems.length > 0) {
      return order.cartItems.map((item) => ({
        name: item.productName || item.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        price: item.price || item.unitPrice || 0,
        brand: item.brand || '',
        color: item.selectedColor || item.color || ''
      }));
    }
    
    return [];
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Inicio de Sesión de Administrador</h1>
        <button
          onClick={handleLogin}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 font-semibold"
        >
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <h1 className="text-2xl font-bold mb-4 text-black">Acceso denegado</h1>
        <p className="mb-4 text-black">Tu cuenta no está autorizada para ver esta página.</p>
        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
        >
          Cerrar sesión
        </button>
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 md:mb-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Pedidos Eliminados</h1>
          <p className="text-sm md:text-base text-gray-600">Pedidos eliminados (se borrarán automáticamente en 30 días)</p>
        </div>
      </div>
      
      {/* Deleted Messages Toggle */}
      <div className="flex items-center gap-2 mb-3 md:mb-4">
        <span className="text-xs md:text-sm font-medium text-gray-700">Mostrar mensajes eliminados:</span>
        <button
          onClick={toggleShowDeletedMessages}
          disabled={loading}
          className={`relative inline-flex h-5 md:h-6 w-9 md:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            showDeletedMessages ? 'bg-purple-600' : 'bg-gray-200'
          } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-3 md:h-4 w-3 md:w-4 transform rounded-full bg-white transition-transform ${
              showDeletedMessages ? 'translate-x-4 md:translate-x-6' : 'translate-x-1'
            }`}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-2.5 md:h-3 w-2.5 md:w-3 border-b-2 border-white"></div>
            </div>
          )}
        </button>
        <span className={`text-xs md:text-sm font-medium ${showDeletedMessages ? 'text-purple-600' : 'text-gray-600'}`}>
          {showDeletedMessages ? 'Activado' : 'Desactivado'}
        </span>
        {loading && (
          <div className="animate-spin rounded-full h-3 md:h-4 w-3 md:w-4 border-b-2 border-purple-600"></div>
        )}
      </div>
      
      {/* Summary Box */}
      {showDeletedMessages && (
        <div className="mb-3 md:mb-4 w-full max-w-2xl bg-purple-50 border border-purple-200 rounded-lg md:rounded-xl shadow flex flex-col gap-1.5 md:gap-2 p-2 md:p-4 text-purple-900 items-start ml-0">
          <div className="text-sm md:text-lg font-bold flex items-center gap-1.5 md:gap-2">
            <span className="text-lg md:text-2xl">🗑️</span> Mensajes Eliminados
          </div>
          <div className="flex flex-col gap-1.5 md:gap-2 text-xs md:text-sm font-semibold">
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
              <span>Total eliminados: <span className="font-bold text-purple-700">{deletedOrders.length}</span></span>
              {searchTerm && (
                <span>Resultados: <span className="font-bold text-purple-700">{filteredDeletedOrders.length}</span></span>
              )}
            </div>
            <span className="text-xs md:text-sm">Último eliminado: <span className="font-bold text-purple-700">
              {deletedOrders.length > 0 
                ? (() => {
                    const deletedAt = deletedOrders[0].deletedAt;
                    if (!deletedAt || deletedAt === null) return 'N/A';
                    const fd = formatDate(deletedAt);
                    return `${fd.dateOnly} ${fd.timeOnly}`;
                  })()
                : 'N/A'
              }
            </span></span>
          </div>
        </div>
      )}
      


      {/* Deleted Orders Table */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <div className="flex flex-col gap-3">
            <h3 className="text-base md:text-lg font-medium text-gray-900">Lista de Pedidos Eliminados</h3>
            
            {/* Search Input - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Buscar pedidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 pl-9 md:pl-10 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-right sm:text-left"
                />
                <div className="absolute inset-y-0 left-0 pl-2.5 md:pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Clear Search Button - Mobile Optimized */}
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="w-full sm:w-auto px-3 py-2 text-xs md:text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          </div>
        </div>
        
        {!showDeletedMessages ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-2">Toggle desactivado</div>
            <div className="text-gray-400 text-sm">Activa el toggle para ver los pedidos eliminados</div>
          </div>
        ) : loading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando pedidos eliminados...</p>
          </div>
        ) : filteredDeletedOrders.length === 0 ? (
          <div className="p-6 text-center">
            {searchTerm ? (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No se encontraron resultados</h3>
                <p className="mt-1 text-xs md:text-sm text-gray-500">No hay pedidos que coincidan con "{searchTerm}"</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-3 w-full sm:w-auto px-3 md:px-4 py-2 text-xs md:text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  Limpiar búsqueda
                </button>
              </>
            ) : (
              <>
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No hay pedidos eliminados</h3>
                <p className="mt-1 text-sm text-gray-500">No se encontraron pedidos eliminados.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Grouped Orders Display (similar to iOS AdminVirtualApp) */}
            <div className="space-y-4">
              {sortedCustomerEmails.map((customerEmail, index) => {
                const customerOrders = groupedOrders[customerEmail];
                const isExpanded = expandedCustomers.has(customerEmail);
                const customerDisplayName = getCustomerDisplayName(customerEmail);
                
                return (
                  <div key={customerEmail} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    {/* Customer Header */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleCustomerExpansion(customerEmail)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{customerDisplayName}</h3>
                            <p className="text-xs text-gray-500">{customerEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500">{customerOrders?.length || 0} pedidos</span>
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
                    
                    {/* Orders for this customer */}
                    {isExpanded && customerOrders && (
                      <div className="border-t border-gray-100">
                        {customerOrders.map((order, orderIndex) => {
                          const daysRemaining = getDaysUntilDeletion(order.retentionDate || '', order.deletedAt || '');
                          return (
                            <div key={`${order.id}-${orderIndex}`} className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3">
                                    <div className="text-sm font-medium text-gray-900">
                                      {formatInvoiceNumber(order.invoiceNumber)}
                                    </div>
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      order.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                      order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                                      order.status === 'delivered' ? 'bg-cyan-100 text-cyan-800' :
                                      order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {order.status === 'new' ? 'Nuevo' :
                                       order.status === 'confirmed' ? 'Confirmado' :
                                       order.status === 'shipped' ? 'En Camino' :
                                       order.status === 'delivered' ? 'Entregado' :
                                       order.status === 'cancelled' ? 'Cancelado' :
                                       order.status || 'Desconocido'}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-sm text-gray-500">
                                    {order.items.length} productos • {formatCurrency(order.totalAmount)}
                                  </div>
                                  <div className="mt-1 text-xs text-gray-400">
                                    Eliminado: {(() => {
                                      if (!order.deletedAt || order.deletedAt === '' || order.deletedAt === null) {
                                        return 'N/A';
                                      }
                                      const formattedDate = formatDate(order.deletedAt);
                                      return `${formattedDate.dateOnly} ${formattedDate.timeOnly}`;
                                    })()}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    daysRemaining <= 0 ? 'bg-red-100 text-red-800' :
                                    daysRemaining <= 7 ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-green-100 text-green-800'
                                  }`}>
                                    {daysRemaining <= 0 ? 'Expirado' : `${daysRemaining} días`}
                                  </span>
                                  <button
                                    onClick={() => setSelectedOrder(order)}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                  >
                                    Ver detalles
                                  </button>
                                  <button
                                    onClick={() => handleDelete(order)}
                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors"
                                    title="Eliminar permanentemente"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>



          </>
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
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 md:w-4 md:w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm md:text-base font-bold text-gray-900">Pedido Eliminado {formatInvoiceNumber(selectedOrder.invoiceNumber)}</h3>
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
                      <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.name || 'N/A'}</span>
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
                      <span className="text-xs md:text-sm font-semibold text-gray-900">{selectedOrder.client?.phone || 'N/A'}</span>
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
                  <h5 className="text-xs font-medium text-blue-700 mb-2 uppercase tracking-wide">Dirección de Envío</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-white rounded-md p-2 border border-blue-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Dirección</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{selectedOrder.client?.address || 'N/A'}</span>
                    </div>
                    
                    <div className="bg-white rounded-md p-2 border border-blue-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Ciudad</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{selectedOrder.client?.city || 'N/A'}</span>
                    </div>
                    
                    <div className="bg-white rounded-md p-2 border border-blue-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-600">Departamento</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{selectedOrder.client?.department || 'N/A'}</span>
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
                      <span className="text-xs font-medium text-gray-600">Estado</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                      selectedOrder.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                      selectedOrder.status === 'delivered' ? 'bg-cyan-100 text-cyan-800' :
                      selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {selectedOrder.status === 'new' ? 'Nuevo' :
                       selectedOrder.status === 'confirmed' ? 'Confirmado' :
                       selectedOrder.status === 'shipped' ? 'En Camino' :
                       selectedOrder.status === 'delivered' ? 'Entregado' :
                       selectedOrder.status === 'cancelled' ? 'Cancelado' :
                       selectedOrder.status || 'Desconocido'}
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
                      <span className="text-xs font-medium text-gray-600">Fecha de Eliminación</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      {(() => {
                        if (!selectedOrder.deletedAt || selectedOrder.deletedAt === null) return 'N/A';
                        const formattedDate = formatDate(selectedOrder.deletedAt);
                        return `${formattedDate.dateOnly} ${formattedDate.timeOnly}`;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Products */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3 md:p-4 border border-orange-100">
                <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h4 className="text-sm md:text-lg font-semibold text-gray-900">Productos ({getProductosArray(selectedOrder).length})</h4>
                </div>
                <div className="space-y-2 md:space-y-3">
                  {getProductosArray(selectedOrder).map((product, index) => (
                    <div key={index} className="bg-white rounded-lg p-2 md:p-4 border border-orange-200 shadow-sm">
                      <div className="flex justify-between items-start mb-1 md:mb-2">
                        <div className="flex-1">
                          <h5 className="font-semibold text-gray-900 text-xs md:text-sm">{product.name}</h5>
                          {product.brand && (
                            <p className="text-xs text-gray-500 mt-0.5 md:mt-1">Marca: {product.brand}</p>
                          )}
                          {product.color && (
                            <p className="text-xs text-gray-500 mt-0.5 md:mt-1">Color: {product.color}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-xs md:text-sm">{formatCurrency(product.price)}</p>
                          <p className="text-xs text-gray-500">Cantidad: {product.quantity}</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-1 md:pt-2">
                        <p className="text-xs text-gray-600">
                          Subtotal: {formatCurrency(product.price * product.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Information */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 md:p-4 border border-green-100">
                <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-sm md:text-lg font-semibold text-gray-900">Información del Pedido</h4>
                </div>
                <div className="space-y-2 md:space-y-3">
                  {(() => {
                    // Get comentario from nested orders array first, then fallback to notes (same as transformation)
                    const comentario = selectedOrder.orders?.[0]?.comentario || selectedOrder.orders?.[0]?.orderDetails || selectedOrder.notes || '';
                    const parsedDetails = parseOrderDetails(comentario);
                    return (
                      <>
                        {/* Display payment method - always show this section */}
                        <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                          <div className="flex justify-between items-start">
                            <p className="font-semibold text-gray-900 text-xs md:text-sm">Método de Pago</p>
                            <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                              {parsedDetails.paymentMethod || 'No especificado'}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  
                  {/* Display bank information - always show this section */}
                  {(() => {
                    // Get comentario from nested orders array first, then fallback to notes (same as transformation)
                    const comentario = selectedOrder.orders?.[0]?.comentario || selectedOrder.orders?.[0]?.orderDetails || selectedOrder.notes || '';
                    const bankName = extractBankName(comentario);
                    return (
                      <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                        <div className="flex justify-between items-start">
                          <p className="font-semibold text-gray-900 text-xs md:text-sm">Banco</p>
                          <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                            {bankName || 'No especificado'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Display tracking number */}
                  <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-900 text-xs md:text-sm">Número de Seguimiento</p>
                      <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                        {selectedOrder.orders?.[0]?.trackingNumber || selectedOrder.trackingNumber || 'No especificado'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Display courier name */}
                  <div className="bg-white rounded-lg p-2 md:p-4 border border-green-200 shadow-sm">
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-900 text-xs md:text-sm">Empresa de Envío</p>
                      <p className="text-xs md:text-sm text-gray-700 text-right max-w-xs">
                        {selectedOrder.orders?.[0]?.courier || selectedOrder.courier || 'No especificado'}
                      </p>
                    </div>
                  </div>
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

              {/* Deletion Information */}
              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-lg p-3 md:p-4 border border-red-100">
                <div className="flex items-center space-x-2 md:space-x-3 mb-2 md:mb-3">
                  <div className="w-6 h-6 md:w-8 md:h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 md:w-4 md:h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-sm md:text-lg font-semibold text-gray-900">Información de Eliminación</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                  <div className="bg-white rounded-lg p-2 md:p-3 border border-red-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Fecha de Eliminación</p>
                    <p className="text-xs md:text-sm font-semibold text-gray-900">
                      {(() => {
                        const fd = formatDate(selectedOrder.deletedAt || '');
                        return `${fd.dateOnly} ${fd.timeOnly}`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-2 md:p-3 border border-red-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Fecha de Retención</p>
                    <p className="text-xs md:text-sm font-semibold text-gray-900">
                      {(() => {
                        const fd = formatDate(selectedOrder.retentionDate || '');
                        return `${fd.dateOnly} ${fd.timeOnly}`;
                      })()}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-2 md:p-3 border border-red-200">
                    <p className="text-xs font-medium text-gray-600 mb-1">Días Restantes</p>
                    <p className={`text-xs md:text-sm font-bold ${
                                          getDaysUntilDeletion(selectedOrder.retentionDate || '', selectedOrder.deletedAt || '') <= 3 ? 'text-red-600' :
                    getDaysUntilDeletion(selectedOrder.retentionDate || '', selectedOrder.deletedAt || '') <= 7 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {getDaysUntilDeletion(selectedOrder.retentionDate || '', selectedOrder.deletedAt || '')} días
                    </p>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
        , document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && orderToDelete && createPortal(
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteModalOpen(false);
              setOrderToDelete(null);
            }
          }}
        >
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Eliminar Permanentemente</h3>
                  <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
                </div>
              </div>
              
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  ¿Estás seguro de que quieres eliminar permanentemente el pedido <strong>{formatInvoiceNumber(orderToDelete.invoiceNumber)}</strong>?
                </p>
                <p className="text-sm text-red-700 mt-2">
                  Cliente: <strong>{orderToDelete.customerName}</strong><br/>
                  Total: <strong>{formatCurrency(orderToDelete.totalAmount)}</strong>
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setOrderToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Eliminar Permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
        , document.body
      )}
    </div>
  );
} 