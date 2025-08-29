'use client';
import React, { useEffect, useState } from 'react';
import { useClientAuth } from '@/lib/useClientAuth';
import { virtualAuth } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { virtualDb } from '@/lib/firebase';


interface Order {
  id: string;
  orderDate: any;
  total: number;
  status: string;
  orderNumber: string;
  pdfUrl?: string;
  adminMessage?: string;
  adminMessageDate?: any;
  adminMessageRead?: boolean;
  adminMessages?: Array<{
    message: string;
    date: any;
    isRead?: boolean;
    files?: Array<{
      url: string;
      name: string;
      type: 'image' | 'pdf';
      size: number;
    }>;
  }>;
}

export default function ClientPortalDashboardPage() {
  const { user } = useClientAuth();
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalSpent: 0,
    averageOrder: 0
  });

  useEffect(() => {
    if (user) {
      loadClientData();
    }
  }, [user]);

  // Add custom CSS animations for the message box
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes gentlePulse {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06);
        }
        50% {
          transform: scale(1.01);
          box-shadow: 0 8px 12px -1px rgba(59, 130, 246, 0.2), 0 4px 6px -1px rgba(59, 130, 246, 0.1);
        }
      }
      
      .message-box-animation {
        animation: gentlePulse 3s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const markMessageAsRead = async (orderId: string) => {
    try {
      if (!virtualDb || !user?.email) return;
      
      // Mark the admin message as read in the database
      const clientRef = doc(virtualDb, 'clients', user.email);
      const clientDoc = await getDoc(clientRef);
      
      if (clientDoc.exists()) {
        const clientData = clientDoc.data();
        const clientOrders = clientData.orders || [];
        
        // Find and mark the specific order's admin messages as read
        const updatedOrders = clientOrders.map((order: any) => {
          if (order.orderId === orderId || order.orderNumber === orderId) {
            if (order.adminMessages && order.adminMessages.length > 0) {
              // Mark all admin messages as read
              const updatedAdminMessages = order.adminMessages.map((msg: any) => ({
                ...msg,
                isRead: true
              }));
              return { ...order, adminMessages: updatedAdminMessages };
            } else if (order.adminMessage) {
              // For backward compatibility with old single message format
              return { ...order, adminMessageRead: true };
            }
          }
          return order;
        });
        
        // Update the client document
        await updateDoc(clientRef, {
          orders: updatedOrders,
          lastUpdated: new Date()
        });
        
        // Refresh the data to update the UI
        await loadClientData();
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const loadClientData = async () => {
    if (!user?.email) return;
    if (!virtualDb) {
      console.error('Virtual database not configured for client portal');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get orders from clients collection instead of virtualOrders
      console.log('🔍 Using collection: clients');
      console.log('🔍 Using database: virtual');
      console.log('🔍 Querying by document ID (email)');
      
      const clientProfileRef = doc(virtualDb, 'clients', user.email);
      const clientProfileDoc = await getDoc(clientProfileRef);
      
      if (clientProfileDoc.exists()) {
        const clientData = clientProfileDoc.data();
        const clientOrders = clientData.orders || [];
        
        console.log('✅ Found client profile with orders:', clientOrders.length);
        
        // Transform orders to match the Order interface
        const orders: Order[] = clientOrders.map((order: any) => ({
          id: order.orderId || order.orderNumber || 'N/A',
          orderDate: order.orderDate || new Date(),
          total: order.totalPrice || 0,
          status: order.status || 'pending',
          orderNumber: order.orderNumber || 'N/A',
          pdfUrl: order.pdfUrl || '',
          adminMessage: order.adminMessage || '',
          adminMessageDate: order.adminMessageDate || null,
          adminMessageRead: order.adminMessageRead || false,
          adminMessages: order.adminMessages || []
        }));

        // Sort orders by date (most recent first) - show all orders
        const sortedOrders = orders.sort((a, b) => {
          const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate);
          const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate);
          return dateB.getTime() - dateA.getTime();
        });
        
        setRecentOrders(sortedOrders);

        // Calculate stats from client orders
        const totalOrders = clientOrders.length;
        const totalSpent = clientOrders.reduce((sum: number, order: any) => {
          return sum + (order.totalPrice || 0);
        }, 0);
        
        setStats({
          totalOrders,
          totalSpent,
          averageOrder: totalOrders > 0 ? totalSpent / totalOrders : 0
        });
      } else {
        console.log('⚠️ No client profile found, setting empty data');
        setRecentOrders([]);
        setStats({
          totalOrders: 0,
          totalSpent: 0,
          averageOrder: 0
        });
      }

    } catch (error) {
      console.error('Error loading client data:', error);
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
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
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
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
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
      case 'pending':
        return 'Pendiente';
      case 'completed':
        return 'Completado';
      case 'processing':
        return 'Procesando';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 px-4 md:px-0">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
          {user?.photoURL && (
            <img
              src={user.photoURL}
              alt="Profile"
              className="w-16 h-16 md:w-20 md:h-20 rounded-full"
            />
          )}
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-gray-900">
              ¡Bienvenido, {user?.displayName || 'Cliente'}!
            </h1>
            <p className="text-sm md:text-base text-gray-600">
              Gestiona tu cuenta y accede a tus pedidos
            </p>
          </div>
        </div>
      </div>

      {/* Admin Messages Notification */}
      {recentOrders.some(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0)) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-6 mb-4 message-box-animation shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
              <h3 className="text-lg font-semibold text-blue-800">Mensajes de la Empresa</h3>
            </div>
            <span className={`text-sm font-medium px-3 py-1 rounded-full transition-all duration-300 ${
              (() => {
                const unreadCount = recentOrders.reduce((total, order) => {
                  let orderUnreadCount = 0;
                  
                  // Count unread messages from adminMessages array
                  if (order.adminMessages && order.adminMessages.length > 0) {
                    orderUnreadCount += order.adminMessages.filter((msg: any) => !msg.isRead).length;
                  }
                  
                  // Count legacy adminMessage if it exists and is unread
                  if (order.adminMessage && order.adminMessage.trim() !== '' && !order.adminMessageRead) {
                    // Check if this message is already in adminMessages to avoid double counting
                    const isDuplicate = order.adminMessages && order.adminMessages.some((msg: any) => 
                      msg.message.trim() === (order.adminMessage || '').trim()
                    );
                    if (!isDuplicate) {
                      orderUnreadCount += 1;
                    }
                  }
                  
                  return total + orderUnreadCount;
                }, 0);
                
                if (unreadCount > 0) {
                  return 'bg-red-100 text-red-800 border border-red-200';
                } else {
                  return 'bg-green-100 text-green-800 border border-green-200';
                }
              })()
            }`}>
              {(() => {
                const totalUnread = recentOrders.reduce((total, order) => {
                  let orderUnreadCount = 0;
                  
                  // Count unread messages from adminMessages array
                  if (order.adminMessages && order.adminMessages.length > 0) {
                    orderUnreadCount += order.adminMessages.filter((msg: any) => !msg.isRead).length;
                  }
                  
                  // Count legacy adminMessage if it exists and is unread
                  if (order.adminMessage && order.adminMessage.trim() !== '' && !order.adminMessageRead) {
                    // Check if this message is already in adminMessages to avoid double counting
                    const isDuplicate = order.adminMessages && order.adminMessages.some((msg: any) => 
                      msg.message.trim() === (order.adminMessage || '').trim()
                    );
                    if (!isDuplicate) {
                      orderUnreadCount += 1;
                    }
                  }
                  
                  return total + orderUnreadCount;
                }, 0);
                
                return `${totalUnread} nuevo${totalUnread !== 1 ? 's' : ''}`;
              })()}
            </span>
          </div>
          <p className="text-blue-700 mt-2 text-sm">
            Comunicaciones importantes de la empresa. Revisa tus pedidos para más detalles.
          </p>
          
          <div className="mt-4 space-y-3">
            {recentOrders
              .filter(order => order.adminMessage || (order.adminMessages && order.adminMessages.length > 0))
              .map((order, orderIndex) => {
                // Combine all messages for this order
                const allMessages: Array<{
                  message: string;
                  date: any;
                  isRead?: boolean;
                  files?: any[];
                  source: 'array' | 'legacy';
                }> = [];
                
                // Add messages from adminMessages array
                if (order.adminMessages && order.adminMessages.length > 0) {
                  order.adminMessages.forEach((msg: any) => {
                    allMessages.push({
                      ...msg,
                      source: 'array'
                    });
                  });
                }
                
                // Add legacy adminMessage if it exists and is different
                if (order.adminMessage && order.adminMessage.trim() !== '') {
                  const isDuplicate = allMessages.some(msg => 
                    msg.message.trim() === (order.adminMessage || '').trim()
                  );
                  
                  if (!isDuplicate) {
                    allMessages.push({
                      message: order.adminMessage,
                      date: order.adminMessageDate || new Date(),
                      isRead: order.adminMessageRead || false,
                      source: 'legacy'
                    });
                  }
                }
                
                // Sort messages by date (oldest first)
                allMessages.sort((a, b) => {
                  const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                  const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                  return dateA.getTime() - dateB.getTime();
                });
                
                // Check if this order has any unread messages
                const hasUnreadMessages = allMessages.some(msg => !msg.isRead);
                
                return (
                  <div key={orderIndex} className={`bg-white rounded-lg p-3 border transition-all duration-300 ${
                    hasUnreadMessages
                      ? 'border-blue-200 bg-blue-50/30' 
                      : 'border-gray-200 bg-gray-50/50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600">Pedido: {order.orderNumber}</span>
                        {hasUnreadMessages && (
                          <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                        )}
                        <span className="text-xs text-gray-500">
                          ({allMessages.length} mensaje{allMessages.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {allMessages.length > 0 
                          ? (() => {
                              const lastMessage = allMessages[allMessages.length - 1];
                              const date = lastMessage.date?.toDate ? lastMessage.date.toDate() : new Date(lastMessage.date);
                              return date.toLocaleDateString('es-CO');
                            })()
                          : 'Reciente'
                        }
                      </span>
                    </div>
                    
                    {/* Display all messages for this order */}
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {allMessages.map((message, msgIndex) => (
                        <div key={`${message.source}-${msgIndex}`} className={`p-2 rounded-md transition-all duration-200 ${
                          !message.isRead 
                            ? 'bg-blue-50 border-l-4 border-blue-400 shadow-sm' 
                            : 'bg-gray-50 border-l-2 border-gray-200'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              {(() => {
                                const date = message.date?.toDate ? message.date.toDate() : new Date(message.date);
                                return date.toLocaleString('es-CO', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              })()}
                            </span>
                            <div className="flex items-center space-x-2">
                              {!message.isRead && (
                                <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">
                                  Nuevo
                                </span>
                              )}
                              {message.source === 'legacy' && (
                                <span className="text-xs text-gray-400">
                                  (Legacy)
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-gray-800 text-sm leading-relaxed">
                            {message.message}
                          </p>
                          
                          {/* Files for this specific message */}
                          {message.files && message.files.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1">
                                  <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                  </svg>
                                  <span className="text-xs text-gray-600">Archivos adjuntos ({message.files.length})</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {message.files.map((file: any, fileIndex: number) => (
                                    <a
                                      key={fileIndex}
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={() => markMessageAsRead(order.orderNumber)}
                                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors duration-200"
                                    >
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                      </svg>
                                      {file.name}
                                      {file.size && (
                                        <span className="ml-1 text-xs text-gray-500">
                                          ({(file.size / 1024).toFixed(1)}KB)
                                        </span>
                                      )}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {/* Mark as read button */}
                    {hasUnreadMessages && (
                      <div className="mt-3 pt-2 border-t border-gray-100">
                        <button
                          onClick={() => markMessageAsRead(order.orderNumber)}
                          className="inline-flex items-center text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200 hover:bg-blue-50 px-2 py-1 rounded"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Marcar todos como leídos
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-sm md:text-base font-medium text-gray-500">Total de Pedidos</p>
              <p className="text-lg md:text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-green-100 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
            <div className="ml-3 md:ml-4">
              <p className="text-sm md:text-base font-medium text-gray-500">Total Gastado</p>
              <p className="text-lg md:text-2xl font-semibold text-gray-900">
                {formatCurrency(stats.totalSpent)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      {recentOrders.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pedidos Recientes</h2>
          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        Pedido #{order.orderNumber}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(order.orderDate)}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(order.total)}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                  {order.pdfUrl && (
                    <a
                      href={order.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-md transition-colors duration-200"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      Ver PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
          {stats.totalOrders > recentOrders.length && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-500">
                Mostrando {recentOrders.length} de {stats.totalOrders} pedidos
              </p>
            </div>
          )}
          <div className="mt-4 text-center">
            <a
              href="/client-portal/orders"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              Ver Todos los Pedidos
              <svg className="ml-2 -mr-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}