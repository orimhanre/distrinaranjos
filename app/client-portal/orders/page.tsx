'use client';
import React, { useEffect, useState } from 'react';
import { useClientAuth } from '@/lib/useClientAuth';
import { virtualAuth } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { virtualDb } from '@/lib/firebase';

interface Order {
  orderId: string;
  uniqueKey?: string;
  orderNumber: string;
  orderDate: any; // Can be Date object or string
  status: string;
  paymentStatus?: string;
  totalPrice: number;
  items: any[];
  pdfUrl?: string;
  comentario?: string;
  client: any;
  trackingNumber?: string;
  courier?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  shippingAddress?: string;
  // Additional fields from enhanced order summary
  subtotal?: number;
  shippingCost?: number;
  paymentMethod?: string;
  orderDetails?: string;
  fileName?: string;
  createdAt?: any;
  lastUpdated?: any;
  environment?: string;
  source?: string;
  labels?: string[];
  // Admin message fields
  adminMessage?: string;
  adminMessageDate?: any;
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
  // Bank info parsed from comentario
  bankInfo?: string;
}

export default function ClientPortalOrdersPage() {
  // Add CSS animation keyframes
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      @keyframes pulse {
        0%, 100% {
          box-shadow: 0 4px 6px -1px rgba(34, 197, 94, 0.1), 0 2px 4px -1px rgba(34, 197, 94, 0.06);
          border-color: rgb(34, 197, 94);
          background-color: rgb(240, 253, 244);
        }
        50% {
          box-shadow: 0 20px 25px -5px rgba(34, 197, 94, 0.3), 0 10px 10px -5px rgba(34, 197, 94, 0.2);
          border-color: rgb(22, 163, 74);
          background-color: rgb(220, 252, 231);
        }
      }
      
      @keyframes messageGlow {
        0%, 100% {
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
        }
        50% {
          box-shadow: 0 3px 6px -1px rgba(59, 130, 246, 0.15), 0 2px 4px -1px rgba(59, 130, 246, 0.1);
        }
      }
      
      @keyframes messageBreath {
        0%, 100% {
          transform: scale(1);
          background-color: rgb(255, 255, 255);
          border-color: rgb(229, 231, 235);
        }
        50% {
          transform: scale(1.015);
          background-color: rgb(241, 245, 249);
          border-color: rgb(59, 130, 246);
        }
      }
      
      @keyframes notificationPulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.7;
          transform: scale(1.1);
        }
      }
      
      @keyframes statusDotGlow {
        0%, 100% {
          background-color: rgb(156, 163, 175);
        }
        50% {
          background-color: rgb(59, 130, 246);
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const { user } = useClientAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dbInitialized, setDbInitialized] = useState(false);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});


  useEffect(() => {
    console.log('🔍 useEffect triggered:', { user: !!user, virtualDb: !!virtualDb });
    if (user && virtualDb) {
      console.log('✅ User and virtualDb available, fetching orders');
      setDbInitialized(true);
      fetchOrders();
    } else if (user && !virtualDb) {
      console.log('⚠️ User available but virtualDb not initialized');
      setDbInitialized(false);
    } else if (!user) {
      console.log('⚠️ No user available');
      setDbInitialized(false);
    }
  }, [user, virtualDb]);

  // Function to fetch product details from Firestore
  const fetchProductDetails = async (productIds: string[]) => {
    if (!virtualDb || productIds.length === 0) return {};
    
    const details: Record<string, any> = {};
    
    try {
      for (const productId of productIds) {
        if (!productDetails[productId]) {
          const productRef = doc(virtualDb, 'virtualProducts', productId);
          const productDoc = await getDoc(productRef);
          
          if (productDoc.exists()) {
            details[productId] = productDoc.data();
          }
        }
      }
      return details;
    } catch (error) {
      console.error('Error fetching product details:', error);
      return {};
    }
  };

    const fetchOrders = async () => {
    if (!user?.email) {
      console.log('❌ No user email available');
      return;
    }
    
    if (!virtualDb) {
      console.log('❌ Virtual database not initialized');
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Fetching orders for user:', user.email);
      console.log('🔍 Virtual database available:', !!virtualDb);
      
      // Get orders ONLY from clients collection orders array
      const clientProfileRef = doc(virtualDb, 'clients', user.email);
      console.log('🔍 Client profile reference created');
      const clientProfileDoc = await getDoc(clientProfileRef);
      
      if (clientProfileDoc.exists()) {
        const clientData = clientProfileDoc.data();
        console.log('✅ Client profile found, orders count:', clientData.orders?.length || 0);
        const clientOrders = clientData.orders || [];
        
        // Transform client orders to match the Order interface
        const activeOrders: Order[] = clientOrders.map((order: any) => {
          // Parse payment info from comentario and orderDetails
          const comentario = order.comentario || '';
          const orderDetails = order.orderDetails || '';
          const parsedPayment = parsePaymentInfo(comentario, orderDetails);
          
          // Use parsed payment method if available, otherwise fallback to direct field
          const finalPaymentMethod = parsedPayment.paymentMethod || order.paymentMethod || 'No especificado';
          
          return {
            orderId: order.orderId || order.orderNumber || `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            uniqueKey: `${order.orderId || order.orderNumber || 'unknown'}-${order.orderDate?.toDate?.() || order.orderDate || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            orderNumber: order.invoiceNumber || order.orderNumber || 'N/A',
            orderDate: order.orderDate?.toDate ? order.orderDate.toDate() : 
                      order.orderDate ? new Date(order.orderDate) : new Date(),
            status: order.status || 'pending',
            paymentStatus: order.paymentStatus || 'pending',
            totalPrice: order.totalAmount || order.totalPrice || 0,
            items: order.items || [],
            pdfUrl: order.fileUrl || order.pdfUrl || '',
            comentario: comentario,
            client: {
              name: order.client?.name || clientData.firstName || clientData.nombre || '',
              surname: order.client?.surname || clientData.lastName || clientData.apellido || '',
              email: user.email,
              phone: order.client?.phone || clientData.phone || clientData.celular || '',
              address: order.client?.address || clientData.address || clientData.direccion || '',
              city: order.client?.city || clientData.ciudad || clientData.city || '',
              department: order.client?.department || clientData.departamento || clientData.department || '',
              postalCode: order.client?.postalCode || clientData.codigoPostal || clientData.postalCode || ''
            },
            trackingNumber: order.trackingNumber || '',
            courier: order.courier || '',
            isDeleted: order.isDeleted || false,
            shippingAddress: order.shippingAddress || '',
            // Include additional fields from enhanced order summary
            subtotal: order.subtotal || 0,
            shippingCost: order.shippingCost || 0,
            paymentMethod: finalPaymentMethod,
            orderDetails: orderDetails,
            fileName: order.fileName || '',
            createdAt: order.createdAt || order.orderDate,
            lastUpdated: order.lastUpdated || order.orderDate,
            environment: order.environment || 'virtual',
            source: order.source || 'web',
            labels: order.labels || [],
            // Add bank info for potential future use
            bankInfo: parsedPayment.bankInfo,

          };
        });
        
        // Sort orders by date (newest first) to ensure new orders appear at the top
        const sortedOrders = activeOrders.sort((a, b) => {
          const dateA = a.orderDate instanceof Date ? a.orderDate : new Date(a.orderDate);
          const dateB = b.orderDate instanceof Date ? b.orderDate : new Date(b.orderDate);
          return dateB.getTime() - dateA.getTime(); // Newest first
        });
        
        // Collect all unique product IDs from all orders
        const allProductIds = new Set<string>();
        sortedOrders.forEach(order => {
          order.items.forEach((item: any) => {
            const productId = item.productId || item.product?.id || item.id;
            if (productId) {
              allProductIds.add(productId);
            }
          });
        });
        
        // Fetch product details for all products
        if (allProductIds.size > 0) {
          const newProductDetails = await fetchProductDetails(Array.from(allProductIds));
          setProductDetails(prev => ({ ...prev, ...newProductDetails }));
        }
        
        setOrders(sortedOrders);
      } else {
        setOrders([]);
      }

    } catch (error) {
      console.error('❌ Error fetching orders:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        userEmail: user?.email,
        virtualDbAvailable: !!virtualDb
      });
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    try {
      let date;
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        date = new Date(timestamp);
      }
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      
      return {
        date: date.toLocaleDateString('es-CO', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        time: date.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    } catch (error) {
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'Nuevo';
      case 'confirmed':
        return 'Confirmado';
      case 'shipped':
        return 'En Camino';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getShippingStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'bg-gray-100 text-gray-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getShippingStatusText = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'Pendiente de Envío';
      case 'confirmed':
        return 'Preparando Envío';
      case 'shipped':
        return 'En Tránsito';
      case 'delivered':
        return 'Entregado';
      case 'cancelled':
        return 'Envío Cancelado';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusText = (paymentStatus: string) => {
    switch (paymentStatus?.toLowerCase()) {
      case 'paid':
        return 'Pagado';
      case 'pending':
        return 'Pago Pendiente';
      case 'failed':
        return 'Pago Fallido';
      default:
        return 'No especificado';
    }
  };

  // Enhanced payment parsing from comentario and orderDetails (like admin pages)
  const parsePaymentInfo = (comentario: string, orderDetails: string) => {
    let paymentMethod = '';
    let bankInfo = '';
    
    // Check both comentario and orderDetails for payment method
    const sources = [comentario, orderDetails].filter(Boolean);
    
    for (const source of sources) {
      if (!paymentMethod) {
        const paymentMethodMatch = source.match(/Método de pago: ([^|]+)/i);
        if (paymentMethodMatch) {
          const method = paymentMethodMatch[1].trim();
          switch (method.toLowerCase()) {
            case 'wompi':
              paymentMethod = 'Wompi';
              break;
            case 'pse':
              paymentMethod = 'PSE';
              break;
            case 'bank_transfer':
              paymentMethod = 'Transferencia Bancaria';
              break;
            case 'bancolombia':
              paymentMethod = 'Transferencia Bancaria - Bancolombia';
              break;
            case 'nequi':
              paymentMethod = 'Transferencia Bancaria - Nequi';
              break;
            case 'a_la_mano':
              paymentMethod = 'Transferencia Bancaria - A la Mano';
              break;
            case 'credit_card':
              paymentMethod = 'Tarjeta de Crédito';
              break;
            case 'stripe':
              paymentMethod = 'Tarjeta de Crédito';
              break;
            default:
              paymentMethod = method;
          }
        }
      }
      
      // Extract bank info
      if (!bankInfo) {
        const bankMatch = source.match(/Banco: ([^|]+)/i);
        if (bankMatch) {
          const bank = bankMatch[1].trim().toLowerCase();
          switch (bank) {
            case 'bancolombia':
              bankInfo = 'Bancolombia';
              break;
            case 'nequi':
              bankInfo = 'Nequi';
              break;
            case 'a_la_mano':
            case 'alamano':
              bankInfo = 'A La Mano';
              break;
            case 'daviplata':
              bankInfo = 'DaviPlata';
              break;
            default:
              bankInfo = bankMatch[1].trim();
          }
        }
      }
    }
    
    // If we found bank info and it's a bank transfer, prioritize showing just the bank name
    if (bankInfo && (paymentMethod.toLowerCase().includes('transferencia') || !paymentMethod)) {
      const bankLower = bankInfo.toLowerCase();
      if (bankLower.includes('bancolombia')) {
        paymentMethod = 'Bancolombia';
      } else if (bankLower.includes('nequi')) {
        paymentMethod = 'Nequi';
      } else if (bankLower.includes('a la mano') || bankLower.includes('alamano')) {
        paymentMethod = 'A la Mano';
      } else if (bankLower.includes('daviplata')) {
        paymentMethod = 'Daviplata';
      } else if (bankLower.includes('banco de bogota') || bankLower.includes('bogota')) {
        paymentMethod = 'Banco de Bogotá';
      } else if (bankLower.includes('banco popular') || bankLower.includes('popular')) {
        paymentMethod = 'Banco Popular';
      } else if (bankLower.includes('bbva')) {
        paymentMethod = 'BBVA';
      } else if (bankLower.includes('davivienda')) {
        paymentMethod = 'Davivienda';
      } else {
        // For other banks, show "Transferencia - [Bank]"
        paymentMethod = `Transferencia - ${bankInfo}`;
      }
    }
    
    return { paymentMethod, bankInfo };
  };

  const getPaymentMethodText = (paymentMethod: string) => {
    switch (paymentMethod?.toLowerCase()) {

      case 'wompi':
        return 'Wompi';
      case 'stripe':
        return 'Tarjeta de Crédito';
      case 'pse':
        return 'PSE';
      case 'transferencia bancaria':
        return 'Transferencia Bancaria';
      case 'tarjeta de crédito':
        return 'Tarjeta de Crédito';

      default:
        return paymentMethod || 'No especificado';
    }
  };

  const getPaymentMethodColor = (paymentMethod: string) => {
    switch (paymentMethod?.toLowerCase()) {
      case 'transferencia bancaria':
        return 'bg-blue-100 text-blue-800';
      case 'wompi':
        return 'bg-purple-100 text-purple-800';
      case 'stripe':
        return 'bg-green-100 text-green-800';
      case 'pse':
        return 'bg-blue-100 text-blue-800';
      case 'tarjeta de crédito':
        return 'bg-green-100 text-green-800';

      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter orders based on search
  const filteredOrders = orders.filter(order => {
    // Apply search filter
    const matchesSearch = 
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.client?.companyName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (!dbInitialized) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando base de datos...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Unified Orders Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Header Section */}
        <div className="p-3 sm:p-4 border-b border-gray-200">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mis Pedidos</h1>
            <p className="text-gray-600">Gestiona y revisa el estado de tus pedidos</p>
          </div>

          


          
          {/* Admin Messages Chat Box Section */}
          {orders.some(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0)) && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mr-3 shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  Mensajes de la Empresa
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                    {orders.filter(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0)).length} mensaje{orders.filter(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0)).length !== 1 ? 's' : ''}
                  </span>
                </h3>
                <p className="text-sm text-gray-600 ml-11">Comunicaciones importantes sobre tus pedidos</p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 rounded-xl p-6 border border-blue-200 shadow-sm">
                <div className="space-y-4">
                  {orders
                    .filter(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0))
                    .map((order, index) => {
                      // Get all admin messages for this order
                      const allMessages: Array<{
                        message: string;
                        date: any;
                        orderNumber: string;
                        status: string;
                        paymentStatus?: string;
                        files?: Array<{
                          url: string;
                          name: string;
                          type: 'image' | 'pdf';
                          size: number;
                        }>;
                      }> = [];
                      
                      // Add messages from new array format
                      if (order.adminMessages && order.adminMessages.length > 0) {
                        order.adminMessages.forEach(msg => {
                          allMessages.push({
                            message: msg.message,
                            date: msg.date,
                            orderNumber: order.orderNumber,
                            status: order.status,
                            paymentStatus: order.paymentStatus,
                            files: msg.files
                          });
                        });
                      }
                      
                      // Add old single message format for backward compatibility
                      if (order.adminMessage && !order.adminMessages?.length) {
                        allMessages.push({
                          message: order.adminMessage,
                          date: order.adminMessageDate,
                          orderNumber: order.orderNumber,
                          status: order.status,
                          paymentStatus: order.paymentStatus,
                          files: undefined
                        });
                      }
                      
                      return allMessages.map((msg, msgIndex) => (
                        <div 
                          key={`admin-msg-${order.uniqueKey || order.orderId}-${index}-${msgIndex}`} 
                          className="flex items-start space-x-3"
                          style={{
                            animationDelay: `${(index * 150) + (msgIndex * 50)}ms`,
                            animation: 'fadeInUp 0.6s ease-out forwards'
                          }}
                        >
                          {/* Company Avatar */}
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* Message Bubble */}
                          <div className="flex-1 min-w-0">
                            <div 
                              className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-500 ease-in-out cursor-pointer group"
                              style={{
                                animationDelay: `${(index * 200) + (msgIndex * 100)}ms`,
                                animation: 'fadeInUp 0.8s ease-out forwards, messageBreath 8s cubic-bezier(0.4, 0, 0.2, 1) infinite, messageGlow 6s ease-in-out infinite'
                              }}
                            >
                              {/* Message Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors duration-200">
                                    Pedido #{msg.orderNumber}
                                  </span>
                                  <span className="text-xs text-gray-500 group-hover:text-gray-700 transition-colors duration-200">
                                    {(() => {
                                      const formattedDate = formatDate(msg.date);
                                      return typeof formattedDate === 'string' ? formattedDate : formattedDate.date;
                                    })()}
                                  </span>
                                </div>
                                {/* Animated notification dot */}
                                <div 
                                  className="w-2 h-2 bg-blue-500 rounded-full transition-colors duration-200"
                                  style={{
                                    animation: 'notificationPulse 2s ease-in-out infinite'
                                  }}
                                ></div>
                              </div>
                              
                              {/* Message Content */}
                              <p className="text-sm text-gray-900 mb-2 group-hover:text-gray-800 transition-colors duration-200">
                                {msg.message}
                              </p>

                              {/* Files Display */}
                              {msg.files && Array.isArray(msg.files) && msg.files.length > 0 && (
                                <div className="mb-3 pt-2 border-t border-gray-100 max-w-2xl">
                                  <div className="flex items-center mb-3">
                                    <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700">Archivos adjuntos</span>
                                    <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                                      {msg.files.length} {msg.files.length === 1 ? 'archivo' : 'archivos'}
                                    </span>
                                  </div>
                                  <div className="space-y-3">
                                    {msg.files.map((file: any, fileIndex: number) => (
                                      <div 
                                        key={fileIndex} 
                                        className="group relative bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-300 ease-out transform hover:-translate-y-1"
                                      >

                                        
                                        <div className="flex items-start space-x-4">
                                        {file.type === 'image' ? (
                                          <div className="flex-shrink-0">
                                            <img 
                                              src={file.url} 
                                              alt={file.name}
                                              className="w-12 h-12 object-cover rounded-md border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-200"
                                              onClick={() => {
                                                const newWindow = window.open(file.url, '_blank');
                                                if (newWindow) {
                                                  newWindow.focus();
                                                }
                                              }}
                                              style={{ cursor: 'pointer' }}
                                              title={`Haz clic para ver ${file.name} en nueva pestaña`}
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex-shrink-0">
                                            <svg className="w-12 h-12 text-red-500 bg-red-50 rounded-md p-2 hover:bg-red-100 hover:text-red-600 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            {/* PDF Label below the icon */}
                                            <div className="mt-1 text-center">
                                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 border border-red-200">
                                                PDF
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-medium text-gray-700 truncate">
                                            {file.name}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {(file.size / 1024 / 1024).toFixed(1)}MB
                                          </div>
                                        </div>
                                        <div className="flex space-x-3">

                                          {/* Download Button */}
                                          <button
                                          onClick={() => {
                                            const link = document.createElement('a');
                                            link.href = file.url;
                                            link.download = file.name;
                                            link.target = '_blank';
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                          }}
                                          className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-sm font-semibold rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-200/50 transform hover:scale-105 border-0 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 min-w-[120px]"
                                          title={`Descargar ${file.name}`}
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span>Descargar</span>
                                        </button>
                                        </div>
                                      </div>
                                      
                                      {/* Hover Effect Overlay */}
                                      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/5 to-indigo-400/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                    </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              {/* Order Status Info */}
                              <div className="flex items-center space-x-3 text-xs text-gray-600 pt-2 border-t border-gray-100 group-hover:border-gray-200 transition-colors duration-200">
                                <span className="flex items-center">
                                  <span 
                                    className="w-2 h-2 bg-gray-400 rounded-full mr-1 transition-colors duration-200"
                                    style={{
                                      animation: 'statusDotGlow 3s ease-in-out infinite',
                                      animationDelay: '0.5s'
                                    }}
                                  ></span>
                                  Estado: <span className={`ml-1 ${getStatusColor(msg.status)}`}>{getStatusText(msg.status)}</span>
                                </span>
                                {msg.paymentStatus && (
                                  <span className="flex items-center">
                                    <span 
                                      className="w-2 h-2 bg-gray-400 rounded-full mr-1 transition-colors duration-200"
                                      style={{
                                        animation: 'statusDotGlow 3s ease-in-out infinite',
                                        animationDelay: '1.5s'
                                      }}
                                    ></span>
                                    Pago: <span className={`ml-1 ${getPaymentStatusColor(msg.paymentStatus)}`}>{getPaymentStatusText(msg.paymentStatus)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ));
                    })}
                </div>
              </div>
            </div>
          )}




        </div>

        {/* Search Section */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <div className="flex-1">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Buscar pedidos
              </label>
              <input
                type="text"
                id="search"
                placeholder="Buscar por número de pedido, nombre o empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900"
              />
            </div>
            <div className="text-right">
              <span className="text-sm text-gray-500">Total de pedidos: </span>
              <span className="text-lg font-bold text-blue-600">{filteredOrders.length}</span>
            </div>
          </div>
        </div>
        
        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="px-4 sm:px-6 py-8 sm:py-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {orders.length === 0 ? 'No hay pedidos' : 'No se encontraron pedidos'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {orders.length === 0 
                ? 'Realiza tu primer pedido para verlo aquí.'
                : 'Intenta ajustar los filtros de búsqueda.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 border-b-2 border-gray-300">
                  <tr>
                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-12 border-r border-gray-200">
                      #
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-40 border-r border-gray-200">
                      Pedido No
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-44 border-r border-gray-200">
                      Fecha
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-28 border-r border-gray-200">
                      Total
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-32 border-r border-gray-200">
                      Estado de Envío
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-36 border-r border-gray-200">
                      Método de Pago
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-40 border-r border-gray-200">
                      Número de Seguimiento
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-44 border-r border-gray-200">
                      Dirección de Envío
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-56 border-r border-gray-200">
                      Productos
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-24">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order, index) => (
                    <tr key={`table-${order.uniqueKey || order.orderId}-${index}`} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-2 py-4 whitespace-nowrap text-sm font-bold text-gray-500 text-center border-r border-gray-200">
                        {index + 1}.
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                        <div className="flex flex-col items-start space-y-1">
                          <span className="font-medium text-sm">#{order.orderNumber}</span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 border-r border-gray-200">
                        {(() => {
                          const dateInfo = formatDate(order.orderDate);
                          if (dateInfo === 'N/A') {
                            return <span>N/A</span>;
                          }
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{dateInfo.date}</span>
                              <span className="text-xs text-gray-400">{dateInfo.time}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-4 border-r border-gray-200">
                        <div className="text-center">
                          <div className="font-medium text-gray-900 mb-1 text-sm">
                            {formatCurrency(order.totalPrice)}
                          </div>
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getPaymentStatusColor(order.paymentStatus || 'pending')}`}>
                              {getPaymentStatusText(order.paymentStatus || 'pending')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-4 border-r border-gray-200">
                        <div className="text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getShippingStatusColor(order.status)}`}>
                            {getShippingStatusText(order.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 border-r border-gray-200">
                        <div className="text-center">
                                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${getPaymentMethodColor(order.paymentMethod || '')}`}>
                                {getPaymentMethodText(order.paymentMethod || '')}
                              </span>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 border-r border-gray-200">
                        {order.trackingNumber ? (
                          <div className="space-y-1">
                            <div className="font-medium text-green-600 text-sm">{order.trackingNumber}</div>
                            {order.courier && (
                              <div className="text-xs text-gray-500">{order.courier}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No disponible</span>
                        )}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 border-r border-gray-200">
                        <div className="max-w-xs">
                          {order.shippingAddress ? (
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{order.shippingAddress}</p>
                            </div>
                          ) : order.client?.address && order.client?.city ? (
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{order.client.address}</p>
                              <p className="text-xs text-gray-600">{order.client.city}, {order.client.department}</p>
                              {order.client.postalCode && (
                                <p className="text-xs text-gray-500">{order.client.postalCode}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">No especificada</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-500 border-r border-gray-200">
                        <div className="max-w-xs">
                          {order.items && order.items.length > 0 ? (
                            <div>
                              <p className="font-medium mb-2 underline text-sm">{order.items.length} producto(s)</p>
                              <p className="text-xs text-gray-600">
                                {order.items.map((item: any, index: number) => {
                                  // Handle different possible item structures
                                  const productName = item.productName || item.product?.name || item.name || 'Producto sin nombre';
                                  const quantity = item.quantity || 1;
                                  const brand = item.brand || item.product?.brand || '';
                                  const color = item.color || item.selectedColor || '';
                                  
                                  let displayText = productName;
                                  if (quantity > 1) displayText += ` (${quantity})`;
                                  if (brand) displayText += ` - ${brand}`;
                                  if (color) displayText += ` - ${color}`;
                                  
                                  return (
                                    <span key={`item-${order.uniqueKey || order.orderId}-${index}`}>
                                      {displayText}
                                      {index < order.items.length - 1 ? ', ' : ''}
                                    </span>
                                  );
                                })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">N/A</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.pdfUrl && (
                          <a
                            href={order.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                          >
                            Ver Pedido
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden">
              <div className="space-y-4">
                {filteredOrders.map((order, index) => (
                  <div key={`mobile-${order.uniqueKey || order.orderId}-${index}`} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    {/* Header with Order Number, Date, and Price */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Pedido #{order.orderNumber}
                          </h3>
                        </div>
                        <div className="text-xs text-gray-500">
                          {(() => {
                            const dateInfo = formatDate(order.orderDate);
                            if (dateInfo === 'N/A') {
                              return 'N/A';
                            }
                            return (
                              <div className="flex items-center space-x-1.5">
                                <span>{dateInfo.date}</span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-400">{dateInfo.time}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(order.totalPrice)}
                        </p>
                      </div>
                    </div>
                    {/* Compact Badges and Summaries */}
                    <div className="space-y-2 mb-2">
                      {/* Bank/Method - Payment Status row */}
                      <div className="text-[11px] text-gray-700">
                        <span className="font-medium">
                          {(() => {
                            const parsed = parsePaymentInfo(order.comentario || '', order.orderDetails || '');
                            const bankInfo = parsed.bankInfo;
                            const methodText = getPaymentMethodText(order.paymentMethod || '');
                            const bankOrMethod = bankInfo || methodText;
                            return (
                              <>
                                {bankOrMethod} {"-"} {" "}
                                <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getPaymentStatusColor(order.paymentStatus || 'pending')}`}>
                                  {getPaymentStatusText(order.paymentStatus || 'pending')}
                                </span>
                              </>
                            );
                          })()}
                        </span>
                      </div>

                      {/* Payment Method capsule (avoid repeating bank) */}
                      {(() => {
                        const parsed = parsePaymentInfo(order.comentario || '', order.orderDetails || '');
                        const bankInfo = (parsed.bankInfo || '').toLowerCase();
                        const methodTextRaw = getPaymentMethodText(order.paymentMethod || '');
                        const methodText = methodTextRaw || '';
                        const methodLower = methodText.toLowerCase();
                        const isDuplicate = bankInfo && (methodLower.includes(bankInfo) || bankInfo.includes(methodLower));
                        const showCapsule = methodText && methodText !== 'No especificado' && !isDuplicate;
                        return showCapsule ? (
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getPaymentMethodColor(order.paymentMethod || '')}`}>
                              {methodText}
                            </span>
                          </div>
                        ) : null;
                      })()}

                      {/* Products summary - each product on its own line with price */}
                      <div className="text-xs text-gray-700 space-y-0.5">
                        {order.items && order.items.length > 0 ? (
                          <>
                            {order.items.map((item: any, i: number) => {
                              const name = item.productName || item.product?.name || item.name || 'Producto';
                              const qty = item.quantity || 1;
                              
                              // Get price from item, or from fetched product details
                              const productId = item.productId || item.product?.id || item.id;
                              const fetchedProduct = productId ? productDetails[productId] : null;
                              const price = item.price || item.unitPrice || item.product?.price || fetchedProduct?.price || 0;
                              const totalPrice = price * qty;
                              
                              return (
                                <div key={i} className="block truncate">
                                  {i + 1}. {name}{qty > 1 ? ` (x${qty})` : ''} ({formatCurrency(totalPrice)})
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </div>

                      {/* Financial quick line */}
                      <div className="text-[11px] text-gray-600">
                        Sub: <span className="font-medium text-gray-900">{formatCurrency(order.subtotal || 0)}</span>
                        <span className="mx-1 text-gray-400">•</span>
                        Env: <span className="font-medium text-gray-900">{formatCurrency(order.shippingCost || 0)}</span>
                        <span className="mx-1 text-gray-400">•</span>
                        Tot: <span className="font-bold text-gray-900">{formatCurrency(order.totalPrice || 0)}</span>
                      </div>

                      {/* Address line */}
                      <div className="text-[11px] text-gray-600 truncate">
                        {order.shippingAddress ? (
                          <span>📍 {order.shippingAddress}</span>
                        ) : order.client?.address && order.client?.city ? (
                          <span>📍 {order.client.address}, {order.client.city}{order.client.department ? `, ${order.client.department}` : ''}</span>
                        ) : (
                          <span className="text-gray-400">Dirección no especificada</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Shipping Status */}
                    <div className="mb-2">
                      <div className="text-[11px] text-gray-600 mb-1">
                        Estado de Envío: <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getShippingStatusColor(order.status)}`}>
                          {getShippingStatusText(order.status)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Tracking Info (compact) */}
                    {order.trackingNumber && (
                      <div className="mb-2 px-2 py-1 rounded-md bg-green-100 border border-green-200">
                        <p className="text-[11px] text-green-800">
                          🚚 <span className="font-semibold">{order.trackingNumber}</span>{order.courier ? ` • ${order.courier}` : ''}
                        </p>
                      </div>
                    )}
                    
                    {/* PDF Link */}
                    {order.pdfUrl && (
                      <div className="text-center">
                        <a
                          href={order.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          Ver PDF
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Spacer to separate from footer */}
      <div className="h-20"></div>
    </div>
  );
}

