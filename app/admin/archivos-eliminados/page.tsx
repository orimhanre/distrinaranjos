"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
  setDoc,
  query,
  orderBy,
  limit,
  DocumentData,
} from "firebase/firestore";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { useRouter } from 'next/navigation';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";
import { checkAdminPermission } from "@/lib/adminPermissions";
import { usePathname } from "next/navigation";

// Define Order interface for type safety
interface Order {
  id: string;
  deletedAt: Timestamp;
  userName: string;
  status?: string;
  client: {
    name: string;
    surname?: string;
    phone?: string;
    city?: string;
    department?: string;
    identification?: string;
    address?: string;
  };
  orderDetails: string;
  fileUrl?: string;
  fileName?: string;
  originalId?: string; // Added for fallback mechanism
  retentionDate?: Timestamp; // Added for retention information
  totalAmount?: number; // Total price stored in Firestore
  cartItems?: any[]; // Cart items for total calculation
}


export default function DeletedFilesPage() {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletedOrders, setDeletedOrders] = useState<Order[]>([]);
  const [deletedOrdersLoading, setDeletedOrdersLoading] = useState(true);
  const [deletedOrdersError, setDeletedOrdersError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    {
      id: "deletedAt",
      desc: true
    }
  ]);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [recoverModalOpen, setRecoverModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [itemToRecover, setItemToRecover] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDenied, setShowDenied] = useState(false);
  const [showDeletedMessages, setShowDeletedMessages] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderProducts, setSelectedOrderProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);


  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  const renderInPortal = (node: React.ReactNode) => {
    if (!isPortalReady || typeof window === 'undefined') return null;
    return createPortal(node, document.body);
  };

  const fetchDeletedOrders = async () => {
    // Only fetch deleted orders data when user is actually on this page
    // Check if we're on the deleted files page specifically
    if (pathname !== '/admin/archivos-eliminados') return;
    
    // Check cache to prevent repeated reads
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && deletedOrders.length > 0) {
      console.log('Using cached deleted orders data');
      return;
    }
    
    setDeletedOrdersLoading(true);
    setDeletedOrdersError(null);
    try {
      // Fetch all deleted orders without limit, sorted by deletion time (newest first)
      const deletedQuery = query(collection(db, "deleted_orders"), orderBy("deletedAt", "desc"));
      const querySnapshot = await getDocs(deletedQuery);
      const docs: Order[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Order));
      
      setDeletedOrders(docs);
      setLastFetchTime(now);
    } catch (err: any) {
      setDeletedOrdersError("No se pudo cargar las órdenes eliminadas: " + err.message);
    }
    setDeletedOrdersLoading(false);
  };

  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      setPermissionLoading(true);
      checkAdminPermission(user.email).then((result) => {
        setHasPermission(result);
        setPermissionLoading(false);
      });
    } else {
      setHasPermission(false);
      setPermissionLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasPermission) return;
    
    // Only fetch when toggle is enabled
    if (showDeletedMessages) {
      fetchDeletedOrders();
    } else {
      // Clear data and cache when toggle is disabled to save memory
      setDeletedOrders([]);
      setDeletedOrdersLoading(false);
      setDeletedOrdersError(null);
      setLastFetchTime(0);
    }
  }, [user, hasPermission, showDeletedMessages]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Search functionality
  const searchInOrder = useCallback((order: Order, searchTerm: string): boolean => {
    if (!searchTerm || searchTerm.length < 1) return true;
    const searchLower = searchTerm.toLowerCase();
    const searchableFields = [
      order.userName || '',
      order.client?.name || '',
      order.client?.surname || '',
      order.client?.phone || '',
      order.client?.city || '',
      order.client?.department || '',
      order.orderDetails || '',
      order.fileUrl || '',
      formatDate(order.deletedAt)
    ];
    return searchableFields.some(field =>
      field.toLowerCase().includes(searchLower)
    );
  }, []);

  const filteredOrders = useMemo(() => {
    return deletedOrders.filter(order => {
      if (!searchInOrder(order, debouncedSearchTerm)) return false;
      return true;
    });
  }, [deletedOrders, debouncedSearchTerm, searchInOrder]);

  const formatDate = (timestamp: Timestamp | null) => {
    if (timestamp && typeof timestamp === "object" && timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${day}.${month}.${year} ${hours}:${minutes}`;
    }
    return "";
  };

  const getDaysUntilDeletion = (retentionDate: Timestamp | null) => {
    if (!retentionDate || !retentionDate.seconds) return 0;
    const retention = new Date(retentionDate.seconds * 1000);
    const now = new Date();
    const diffTime = retention.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const parseOrderDetails = (orderDetails: string) => {
    const result: { total?: string; tipo?: string; type?: string; comentario?: string; client?: string; brand?: string; color?: string } = {};
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
    
    const comentarioMatch = orderDetails.match(/comment: (.*)$/i) ||
                           orderDetails.match(/Comentario: (.*)$/) ||
                           orderDetails.match(/comentario: (.*)$/i);
    
    const brandMatch = orderDetails.match(/brand: ([^|]+)/i) ||
                      orderDetails.match(/Marca: ([^|]+)/) ||
                      orderDetails.match(/marca: ([^|]+)/i);
    
    const colorMatch = orderDetails.match(/color: ([^|]+)/i) ||
                      orderDetails.match(/Color: ([^|]+)/) ||
                      orderDetails.match(/color: ([^|]+)/i);
    
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
    if (comentarioMatch) result.comentario = comentarioMatch[1].trim();
    if (brandMatch) result.brand = brandMatch[1].trim();
    if (colorMatch) result.color = colorMatch[1].trim();
    return result;
  };

  const loadOrderProducts = async (order: DocumentData) => {
    setProductsLoading(true);
    try {
      // Use the existing getProductosArray function to get products from order data
      const products = getProductosArray(order);
      setSelectedOrderProducts(products);
    } catch (error) {
      console.error('Error loading products:', error);
      setSelectedOrderProducts([{
        name: 'Error al cargar productos',
        quantity: 1,
        price: 0,
        brand: '',
        selectedColor: ''
      }]);
    } finally {
      setProductsLoading(false);
    }
  };

  const getProductosArray = (order: DocumentData) => {
    
    // If you have cartItems, use that. Otherwise, create a fallback array
    if (order.cartItems && Array.isArray(order.cartItems)) {
      return order.cartItems.map((item: any) => ({
        name: item.product?.name || 'Producto sin nombre',
        quantity: item.quantity || 1,
        price: item.product?.price1 || item.product?.price || 0,
        price2: item.product?.price2 || 0,
        brand: item.product?.brand || '',
        selectedColor: item.selectedColor || '',
        selectedPrice: item.selectedPrice || 'price1',
        imageURL: item.product?.imageURL || []
      }));
    }
    
    // Calculate total amount using the same logic as virtual admin
    let totalAmount = order.totalAmount || 0;
    
    // If no totalAmount, try to calculate from cartItems
    if (!totalAmount && order.cartItems && Array.isArray(order.cartItems)) {
      totalAmount = order.cartItems.reduce((sum: number, item: any) => {
        const price = item.product?.price1 || item.product?.price || 0;
        const quantity = item.quantity || 1;
        return sum + (price * quantity);
      }, 0);
    }
    
    // If still no total, try parsing from orderDetails
    if (!totalAmount && order.orderDetails) {
      const totalRaw = parseOrderDetails(order.orderDetails).total || "";
      const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
      if (!isNaN(numeric)) {
        totalAmount = numeric;
      }
    }
    
    // Try to extract product information from orderDetails
    if (order.orderDetails) {
      const parsedDetails = parseOrderDetails(order.orderDetails);
      const client = parsedDetails.client || order.userName || 'Cliente';
      const tipo = parsedDetails.type || parsedDetails.tipo || '';
      const comentario = parsedDetails.comentario || '';
      
      // Check if we have actual product information in other fields
      if (order.productos && Object.keys(order.productos).length > 0) {
        // Use actual product information from productos field
        return Object.entries(order.productos).map(([productName, quantity]) => ({
          name: productName,
          quantity: quantity as number,
          price: totalAmount / Object.values(order.productos).reduce((sum: number, qty: any) => sum + qty, 0), // Distribute total amount
          price2: 0,
          brand: order.brand || order.productBrand || 'Sin especificar',
          selectedColor: order.selectedColor || '',
          selectedPrice: 'price1',
          imageURL: []
        }));
      }
      
      // Create a more meaningful product name
      let productName = `${client} - Pedido`;
      if (tipo) {
        productName += ` (${tipo})`;
      }
      if (comentario) {
        productName += ` - ${comentario}`;
      }
      
      return [{
        name: productName,
        quantity: 1,
        price: totalAmount,
        brand: parsedDetails.brand || order.brand || order.productBrand || order.product?.brand || 'Sin especificar',
        selectedColor: parsedDetails.color || order.selectedColor || ''
      }];
    }
    
    // Try to parse orderDetails if available
    if (order.orderDetails) {
      console.log('Parsing orderDetails:', order.orderDetails);
      const parsedDetails = parseOrderDetails(order.orderDetails);
      console.log('Parsed details:', parsedDetails);
      
      // If we have a brand from orderDetails, create a product with that info
      if (parsedDetails.brand) {
        return [{
          name: parsedDetails.brand,
          quantity: 1,
          price: totalAmount,
          brand: parsedDetails.brand,
          selectedColor: parsedDetails.color || '',
          selectedPrice: parsedDetails.type === 'Precio 2' ? 'price2' : 'price1',
          price2: parsedDetails.type === 'Precio 2' ? totalAmount : 0
        }];
      }
    }
    
    // Fallback: create a single item from fileName
    console.log('Using fallback - fileName:', order.fileName);
    const productName = order.fileName || 'Producto sin nombre';
    return [{
      name: productName,
      quantity: 1,
      price: totalAmount,
      brand: '',
      selectedColor: ''
    }];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-cyan-100 text-cyan-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'shipped': return 'En Camino';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return 'Pendiente';
    }
  };

  const confirmRecover = async () => {
    if (!itemToRecover || isProcessing) return;
    setIsProcessing(true);
    setDeleteError(null);

    try {
      // Check if the order is still in the main orders collection
      const mainOrderRef = doc(db, "orders", itemToRecover);
      const mainOrderSnap = await getDoc(mainOrderRef);
      
      if (mainOrderSnap.exists()) {
        throw new Error(`Esta orden no está eliminada. Se encuentra en la lista principal de órdenes.`);
      }
      
      // Try to find the order directly
      const orderRef = doc(db, "deleted_orders", itemToRecover);
      const orderSnap = await getDoc(orderRef);
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as Order;
        const { id, deletedAt, ...dataToRecover } = orderData as any;

        // Add to orders collection
        const newOrderRef = doc(collection(db, "orders"));
        await setDoc(newOrderRef, {
          ...dataToRecover,
          timestamp: serverTimestamp(),
        });
        
        // Delete from deleted_orders
        await deleteDoc(orderRef);
      } else {
        // Search through all deleted orders for legacy orders (deleted before the fix)
        const deletedOrdersQuery = await getDocs(collection(db, "deleted_orders"));
        
        let foundOrder = null;
        let foundOrderId = null;
        
        deletedOrdersQuery.forEach((doc) => {
          const data = doc.data();
          
          // Check multiple conditions for legacy orders
          const matchesOriginalId = data.originalId === itemToRecover;
          const matchesDocId = doc.id === itemToRecover;
          
          if (matchesOriginalId || matchesDocId) {
            foundOrder = data;
            foundOrderId = doc.id;
          }
        });
        
        if (foundOrder && foundOrderId) {
          const { id, deletedAt, originalId, ...dataToRecover } = foundOrder as any;
          
          // Add to orders collection
          const newOrderRef = doc(collection(db, "orders"));
          await setDoc(newOrderRef, {
            ...dataToRecover,
            timestamp: serverTimestamp(),
          });
          
          // Delete from deleted_orders
          await deleteDoc(doc(db, "deleted_orders", foundOrderId));
        } else {
          throw new Error("Orden no encontrada en la base de datos. Esta orden puede haber sido eliminada antes de la actualización del sistema o nunca fue creada.");
        }
      }

      setDeletedOrders((prev) => prev.filter((order) => order.id !== itemToRecover));
      setSuccessMessage("Orden recuperada exitosamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setDeleteError(`No se pudo recuperar la orden: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setItemToRecover(null);
      setRecoverModalOpen(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!itemToDelete || isProcessing) return;
    setIsProcessing(true);
    setDeleteError(null);

    try {
      await deleteDoc(doc(db, "deleted_orders", itemToDelete));
      setDeletedOrders((prev) => prev.filter((order) => order.id !== itemToDelete));
      setSuccessMessage("Orden eliminada permanentemente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setDeleteError(`No se pudo eliminar la orden permanentemente: ${err.message} (Código: ${err.code})`);
      console.error("Error al eliminar permanentemente:", err.code, err.message);
      await fetchDeletedOrders();
    } finally {
      setIsProcessing(false);
      setItemToDelete(null);
      setDeleteModalOpen(false);
    }
  };

  const confirmBulkPermanentDelete = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setDeleteError(null);

    const idsToDelete = Object.entries(selectedRows).filter(([_, v]) => v).map(([id]) => id);

    try {
      await Promise.all(idsToDelete.map((id) => deleteDoc(doc(db, "deleted_orders", id))));
      setDeletedOrders((prev) => prev.filter((order) => !idsToDelete.includes(order.id)));
      setSelectedRows({});
      setSuccessMessage(`${idsToDelete.length} órdenes eliminadas permanentemente`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setDeleteError(`No se pudieron eliminar las órdenes seleccionadas: ${err.message} (Código: ${err.code})`);
      console.error("Error al eliminar múltiples órdenes:", err.code, err.message);
      await fetchDeletedOrders();
    } finally {
      setIsProcessing(false);
      setBulkDeleteModalOpen(false);
    }
  };

  const handleRecover = async (id: string) => {
    setItemToRecover(id);
    setRecoverModalOpen(true);
  };

  const handlePermanentDelete = async (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleBulkPermanentDelete = async () => {
    setBulkDeleteModalOpen(true);
  };

  const handleBulkRecover = async () => {
    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
    if (selectedIds.length === 0) return;

    setIsProcessing(true);
    setSuccessMessage(null);
    setDeleteError(null);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        try {
          // Find the order in deleted_orders
          const deletedOrderRef = doc(db, "deleted_orders", id);
          const deletedOrderDoc = await getDoc(deletedOrderRef);

          if (!deletedOrderDoc.exists()) {
            // Try to find by originalId for legacy orders
            const deletedOrdersSnapshot = await getDocs(collection(db, "deleted_orders"));
            let foundOrder = null;
            let foundOrderId = null;

            for (const docSnapshot of deletedOrdersSnapshot.docs) {
              const data = docSnapshot.data();
              if (docSnapshot.id === id || data.originalId === id) {
                foundOrder = data;
                foundOrderId = docSnapshot.id;
                break;
              }
            }

            if (foundOrder && foundOrderId) {
              // Restore to main orders collection
              await setDoc(doc(db, "orders", foundOrderId), {
                ...foundOrder,
                deletedAt: null
              });
              
              // Remove from deleted_orders
              await deleteDoc(doc(db, "deleted_orders", foundOrderId));
              successCount++;
            } else {
              errorCount++;
            }
          } else {
            // Restore to main orders collection
            await setDoc(doc(db, "orders", id), {
              ...deletedOrderDoc.data(),
              deletedAt: null
            });
            
            // Remove from deleted_orders
            await deleteDoc(deletedOrderRef);
            successCount++;
          }
        } catch (error) {
          console.error(`Error recovering order ${id}:`, error);
          errorCount++;
        }
      }

      if (successCount > 0) {
        setSuccessMessage(`Se recuperaron ${successCount} pedido${successCount !== 1 ? 's' : ''} exitosamente.`);
        if (errorCount > 0) {
          setDeleteError(`${errorCount} pedido${errorCount !== 1 ? 's' : ''} no se pudo recuperar.`);
        }
        setSelectedRows({});
        await fetchDeletedOrders();
      } else {
        setDeleteError(`No se pudo recuperar ningún pedido.`);
      }
    } catch (error) {
      setDeleteError(`Error al recuperar pedidos: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };



  const handleSelect = (id: string) => {
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allSelected = deletedOrders.length > 0 && deletedOrders.every((order) => selectedRows[order.id]);
  const anySelected = Object.values(selectedRows).some(Boolean);
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows({});
    } else {
      const newSelected: Record<string, boolean> = {};
      deletedOrders.forEach((order) => {
        newSelected[order.id] = true;
      });
      setSelectedRows(newSelected);
    }
  };

  const columns = useMemo<ColumnDef<Order, any>[]>(() => [
    {
      id: "select",
      header: () => <span></span>,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={!!selectedRows[row.original.id]}
          onChange={() => handleSelect(row.original.id)}
          className="accent-blue-600"
          disabled={isProcessing}
        />
      ),
      size: 32,
      enableSorting: false,
    },
    {
      accessorKey: "deletedAt",
      header: "Fecha de Eliminación",
      cell: ({ getValue }) => <span className="text-black">{formatDate(getValue())}</span>,
    },
    {
      accessorKey: "userName",
      header: "Empresa",
      cell: ({ getValue }) => <span className="text-black">{getValue() || ""}</span>,
    },
    {
      id: "nombreCompleto",
      header: "Nombre Completo",
      cell: ({ row }) => {
        const client = row.original.client;
        if (client && client.name) {
          const fullName = `${client.name}${client.surname ? " " + client.surname : ""}`;
          return <span className="text-black">{fullName}</span>;
        }
        return <span className="text-black">{row.original.userName || ""}</span>;
      },
    },
    {
      id: "celular",
      header: "Celular",
      cell: ({ row }) => <span className="text-black">{row.original.client?.phone || ""}</span>,
    },
    {
      id: "ciudad",
      header: "Ciudad / Pueblo",
      cell: ({ row }) => <span className="text-black">{row.original.client?.city || ""}</span>,
    },
    {
      id: "departamento",
      header: "Departamento",
      cell: ({ row }) => <span className="text-black">{row.original.client?.department || ""}</span>,
    },
    {
      id: "total",
      header: "Total Precio",
      cell: ({ row }) => {
        const order = row.original;
        
        // Calculate total from cartItems if available (same as main admin page)
        if (order.cartItems && Array.isArray(order.cartItems)) {
          const total = order.cartItems.reduce((sum: number, item: any) => {
            const price = item.product?.price1 || item.product?.price || 0;
            const quantity = item.quantity || 1;
            return sum + (price * quantity);
          }, 0);
          if (total > 0) {
            return <span className="text-black">{formatCurrency(total)}</span>;
          }
        }
        
        // Try to get total from orderDetails if cartItems calculation failed
        if (order.orderDetails) {
          const totalRaw = parseOrderDetails(order.orderDetails).total || "";
          const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
          if (!isNaN(numeric) && numeric > 0) {
            return <span className="text-black">{formatCurrency(numeric)}</span>;
          }
        }
        
        // Fallback to totalAmount field (stored in Firestore)
        return <span className="text-black">{formatCurrency(order.totalAmount || 0)}</span>;
      },
    },
    {
      accessorKey: "fileUrl",
      header: "Archivo",
      cell: ({ getValue }) =>
        getValue() ? (
          <a href={getValue()} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
            PDF
          </a>
        ) : (
          ""
        ),
    },
    {
      id: "tipo",
      header: "Tipo",
      cell: ({ row }) => {
        const tipo = parseOrderDetails(row.original.orderDetails).tipo || "";
        if (tipo.includes("Precio 1")) {
          return <span className="text-green-600 font-bold">Precio 1</span>;
        }
        if (tipo.includes("Precio 2")) {
          return <span className="text-blue-600 font-bold">Precio 2</span>;
        }
        return <span>{tipo}</span>;
      },
    },
  ], [selectedRows, isProcessing]);

  const table = useReactTable({
    data: filteredOrders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
  });

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
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

  if (showDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
        <div className="bg-white border border-red-300 rounded-xl shadow-lg p-8 flex flex-col items-center">
          <h1 className="text-2xl font-bold mb-4 text-black">Acceso denegado</h1>
          <p className="mb-2 text-black">Por favor, inicia sesión con una cuenta autorizada para continuar.</p>
          <button
            onClick={handleLogout}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 font-semibold mt-4"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  if (permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-black">Cargando permisos...</p>
        </div>
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
    <div>
      
      {/* User Info and Navigation */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Admin</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
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
      
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4 mb-4 md:mb-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-lg md:text-3xl font-bold text-gray-900">Pedidos Eliminados</h1>
          <p className="text-gray-600">Pedidos eliminados (se borrarán automáticamente en 30 días)</p>
        </div>
      </div>
      
      {/* Deleted Messages Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium text-gray-700">Mostrar mensajes eliminados:</span>
        <button
          onClick={() => setShowDeletedMessages(!showDeletedMessages)}
          disabled={deletedOrdersLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
            showDeletedMessages ? 'bg-purple-600' : 'bg-gray-200'
          } ${deletedOrdersLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              showDeletedMessages ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
          {deletedOrdersLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
            </div>
          )}
        </button>
        <span className={`text-sm font-medium ${showDeletedMessages ? 'text-purple-600' : 'text-gray-600'}`}>
          {showDeletedMessages ? 'Activado' : 'Desactivado'}
        </span>
        {deletedOrdersLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
        )}
      </div>
      
      {/* Summary Box */}
      {showDeletedMessages && (
        <div className="mb-4 md:mb-6 w-full max-w-2xl bg-purple-50 border border-purple-200 rounded-xl shadow flex flex-col gap-2 p-3 md:p-4 text-purple-900 items-start ml-0">
          <div className="text-base md:text-lg font-bold flex items-center gap-2">
            <span className="text-xl md:text-2xl">🗑️</span> Mensajes Eliminados
          </div>
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 md:gap-6 text-sm md:text-base font-semibold">
            <span>Total eliminados: <span className="font-bold text-purple-700">{deletedOrders.length}</span></span>
            <span>Último eliminado: <span className="font-bold text-purple-700">
              {deletedOrders.length > 0 
                ? formatDate(deletedOrders[0].deletedAt)
                : 'N/A'
              }
            </span></span>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-xl shadow-lg p-2 md:p-6 overflow-x-auto border border-gray-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <h2 className="text-base md:text-xl font-semibold text-gray-900">
            <span className="w-auto ml-4">Lista de Pedidos Eliminados</span>
          </h2>
          {anySelected && (
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3">
              <span className="text-gray-600 font-medium text-sm">{selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}</span>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
                    if (selectedIds.length === 1) {
                      setItemToRecover(selectedIds[0]);
                      setRecoverModalOpen(true);
                    } else {
                      handleBulkRecover();
                    }
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 font-medium transition-colors disabled:opacity-50"
                  title="Recuperar pedido seleccionado"
                  disabled={isProcessing}
                >
                  Recuperar
                </button>
                <button
                  onClick={() => {
                    const selectedIds = Object.keys(selectedRows).filter(id => selectedRows[id]);
                    if (selectedIds.length === 1) {
                      setItemToDelete(selectedIds[0]);
                      setDeleteModalOpen(true);
                    } else {
                      setBulkDeleteModalOpen(true);
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium transition-colors disabled:opacity-50"
                  title="Eliminar pedido seleccionado permanentemente"
                  disabled={isProcessing}
                >
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-blue-700">Procesando...</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-700">{successMessage}</span>
          </div>
        )}

        {deleteError && (
          <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-700">{deleteError}</span>
          </div>
        )}

        {recoverModalOpen && renderInPortal(
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[99999] p-4">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-sm flex flex-col items-center">
              <h3 className="text-base sm:text-lg font-bold mb-2 text-green-600 text-center">Recuperar Orden</h3>
              <p className="text-gray-700 mb-4 text-center text-sm sm:text-base">¿Está seguro de que desea recuperar esta orden?</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={confirmRecover}
                  className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-green-700 font-semibold disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Procesando..." : "Recuperar"}
                </button>
                <button
                  onClick={() => setRecoverModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-3 sm:px-4 py-2 rounded hover:bg-gray-400 font-semibold text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteModalOpen && renderInPortal(
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[99999] p-4">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-sm flex flex-col items-center">
              <h3 className="text-base sm:text-lg font-bold mb-2 text-red-600 text-center">Eliminar Permanentemente</h3>
              <p className="text-gray-700 mb-4 text-center text-sm sm:text-base">Esta acción no se puede deshacer. ¿Está seguro?</p>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={confirmPermanentDelete}
                  className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-red-700 font-semibold disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Procesando..." : "Eliminar Permanentemente"}
                </button>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-3 sm:px-4 py-2 rounded hover:bg-gray-400 font-semibold text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {bulkDeleteModalOpen && renderInPortal(
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-[99999] p-4">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-sm flex flex-col items-center">
              <h3 className="text-base sm:text-lg font-bold mb-2 text-red-600 text-center">Eliminar Pedidos Seleccionados Permanentemente</h3>
              <p className="text-gray-700 mb-4 text-center text-sm sm:text-base">
                Esta acción no se puede deshacer. ¿Está seguro de que desea eliminar {selectedCount} pedidos permanentemente?
              </p>
              <div className="flex flex-col sm:flex-row gap-2 w-full">
                <button
                  onClick={confirmBulkPermanentDelete}
                  className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-red-700 font-semibold disabled:opacity-50 text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  {isProcessing ? "Procesando..." : "Eliminar Todos Permanentemente"}
                </button>
                <button
                  onClick={() => setBulkDeleteModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-3 sm:px-4 py-2 rounded hover:bg-gray-400 font-semibold text-sm sm:text-base w-full sm:w-auto"
                  disabled={isProcessing}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}



        {deletedOrdersLoading ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando pedidos eliminados...</p>
          </div>
        ) : deletedOrdersError ? (
          <div className="text-red-600 p-6">{deletedOrdersError}</div>
        ) : !showDeletedMessages ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-2">Toggle desactivado</div>
            <div className="text-gray-400 text-sm">Activa el toggle para ver los pedidos eliminados</div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-2">
              {searchTerm
                ? 'No se encontraron pedidos eliminados que coincidan con tu búsqueda'
                : 'No se encontraron pedidos eliminados'}
            </div>
            {searchTerm && (
              <div className="text-gray-400 text-sm">
                Intenta ajustar tus términos de búsqueda
              </div>
            )}
          </div>
        ) : (
          <div className="w-full relative bg-white rounded-lg shadow-sm border border-gray-200" style={{ minWidth: '100%', width: '100%' }}>
            {/* Desktop View */}
            <div className="hidden md:block">
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Lista de Pedidos Eliminados</h3>
                    <div className="relative w-64">
                      <input
                        type="text"
                        placeholder="Buscar órdenes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 w-full text-sm shadow-sm transition-all duration-200 placeholder-gray-600"
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
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-12 px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={handleSelectAll}
                            className="accent-blue-600"
                            disabled={isProcessing}
                            title="Seleccionar todo"
                          />
                        </th>
                        <th className="w-12 px-1 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          #
                        </th>
                        <th className="w-48 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Pedido
                        </th>
                        <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Empresa
                        </th>
                        <th className="w-40 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Cliente
                        </th>
                        <th className="w-24 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Total
                        </th>
                        <th className="w-20 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Estado
                        </th>
                        <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Fecha Eliminación
                        </th>
                        <th className="w-32 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredOrders.map((order, index) => (
                        <tr key={`${order.id}-${index}`} className="hover:bg-gray-50 border-b border-gray-300">
                          <td className="w-12 px-1 py-4 whitespace-nowrap border border-gray-300">
                            <input
                              type="checkbox"
                              checked={!!selectedRows[order.id]}
                              onChange={() => handleSelect(order.id)}
                              className="accent-blue-600"
                              disabled={isProcessing}
                            />
                          </td>
                          <td className="w-12 px-1 py-4 whitespace-nowrap text-sm text-gray-500 font-medium border border-gray-300">
                            {index + 1}
                          </td>
                          <td className="w-48 px-2 py-4 border border-gray-300">
                            <div className="text-sm font-medium text-gray-900 max-w-xs">
                              {order.fileUrl && order.fileName ? (
                                <a 
                                  href={order.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-600 hover:text-blue-800 underline cursor-pointer break-words"
                                  title={order.fileName}
                                >
                                  {order.fileName.length > 30 
                                    ? order.fileName.substring(0, 30) + '...' 
                                    : order.fileName
                                  }
                                </a>
                              ) : (
                                `#${order.id}`
                              )}
                            </div>
                          </td>
                          <td className="w-32 px-2 py-4 whitespace-nowrap border border-gray-300">
                            <div className="text-sm font-medium text-gray-900">
                              {order.userName || 'N/A'}
                            </div>
                          </td>
                          <td className="w-40 px-2 py-4 whitespace-nowrap border border-gray-300">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">
                                {order.client?.name ? 
                                  `${order.client.name}${order.client.surname ? ' ' + order.client.surname : ''}` :
                                  'N/A'
                                }
                              </div>
                              <div className="text-purple-600 text-xs opacity-50">{order.client?.phone || 'N/A'}</div>
                            </div>
                          </td>
                          <td className="w-24 px-2 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                            {(() => {
                              // Calculate total from cartItems if available (same as main admin page)
                              if (order.cartItems && Array.isArray(order.cartItems)) {
                                const total = order.cartItems.reduce((sum: number, item: any) => {
                                  const price = item.product?.price1 || item.product?.price || 0;
                                  const quantity = item.quantity || 1;
                                  return sum + (price * quantity);
                                }, 0);
                                if (total > 0) {
                                  return formatCurrency(total);
                                }
                              }
                              
                              // Try to get total from orderDetails if cartItems calculation failed
                              if (order.orderDetails) {
                                const totalRaw = parseOrderDetails(order.orderDetails).total || "";
                                const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
                                if (!isNaN(numeric) && numeric > 0) {
                                  return formatCurrency(numeric);
                                }
                              }
                              
                              // Fallback to totalAmount field (stored in Firestore)
                              return formatCurrency(order.totalAmount || 0);
                            })()}
                          </td>
                          <td className="w-20 px-2 py-4 whitespace-nowrap border border-gray-300">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(order.status || 'pending')}`}>
                              {getStatusText(order.status || 'pending')}
                            </span>
                          </td>
                          <td className="w-32 px-2 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                            {formatDate(order.deletedAt)}
                          </td>
                          <td className="w-32 px-2 py-4 whitespace-nowrap text-sm font-medium border border-gray-300">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={async () => {
                                  setSelectedOrder(order);
                                  await loadOrderProducts(order);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors duration-200"
                                title="Ver detalles"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleRecover(order.id)}
                                className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors duration-200"
                                title="Recuperar pedido"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handlePermanentDelete(order.id)}
                                className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors duration-200"
                                title="Eliminar permanentemente"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && renderInPortal(
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-[99999] flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <div 
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl max-h-[85vh] overflow-y-auto z-[100000]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Pedido Eliminado</h3>
                      <p className="text-sm text-gray-500">Detalles completos del pedido eliminado</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors duration-200"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Client Information */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Información del Cliente</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {/* First Column */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Empresa:</span>
                        <span className="text-sm text-gray-900 font-medium">{selectedOrder.userName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Nombre Completo:</span>
                        <span className="text-sm text-gray-900 font-medium">
                          {selectedOrder.client?.name ? 
                            `${selectedOrder.client.name}${selectedOrder.client.surname ? ' ' + selectedOrder.client.surname : ''}` : 
                            selectedOrder.userName || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Cédula:</span>
                        <span className="text-sm text-gray-900 font-medium">{selectedOrder.client?.identification || 'N/A'}</span>
                      </div>
                    </div>
                    
                    {/* Second Column */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Teléfono:</span>
                        <span className="text-sm text-gray-900 font-medium">{selectedOrder.client?.phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Ciudad:</span>
                        <span className="text-sm text-gray-900 font-medium">{selectedOrder.client?.city || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-600 w-24">Departamento:</span>
                        <span className="text-sm text-gray-900 font-medium">{selectedOrder.client?.department || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Productos ({productsLoading ? '...' : selectedOrderProducts.length})</h4>
                  </div>
                  <div className="space-y-3">
                    {productsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                        <span className="ml-3 text-gray-600">Cargando productos...</span>
                      </div>
                    ) : selectedOrderProducts.map((product, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-orange-200 shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h5 className="font-semibold text-gray-900 text-sm">{product.name}</h5>
                                                      {product.brand && (
                            <p className="text-xs text-gray-500 mt-1">Marca: {product.brand}</p>
                          )}
                          {product.selectedColor && (
                            <p className="text-xs text-gray-500 mt-1">Color: {product.selectedColor}</p>
                          )}

                          </div>
                          <div className="text-right">
                            <p className="font-bold text-gray-900 text-sm">
                              {formatCurrency(product.selectedPrice === 'price2' ? product.price2 : product.price)}
                            </p>
                            <p className="text-xs text-gray-500">Cantidad: {product.quantity}</p>
                          </div>
                        </div>
                        <div className="border-t border-gray-100 pt-2">
                          <p className="text-xs text-gray-600">
                            Subtotal: {formatCurrency((product.selectedPrice === 'price2' ? product.price2 : product.price) * product.quantity)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Information */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Información del Pedido</h4>
                  </div>
                  <div className="space-y-3">
                    {(() => {
                      const parsedDetails = parseOrderDetails(selectedOrder.orderDetails || '');
                      return (
                        <>
                          {parsedDetails.type && (
                            <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                              <div className="flex justify-between items-center">
                                <p className="font-semibold text-gray-900 text-sm">Tipo</p>
                                <p className="font-bold text-gray-900 text-sm">{parsedDetails.type}</p>
                              </div>
                            </div>
                          )}
                          {parsedDetails.comentario && (
                            <div className="bg-white rounded-lg p-4 border border-green-200 shadow-sm">
                              <div className="flex justify-between items-start">
                                <p className="font-semibold text-gray-900 text-sm">Comentario</p>
                                <p className="text-sm text-gray-700 text-right max-w-xs">{parsedDetails.comentario}</p>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Order Status */}
                <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Estado del Pedido</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Estado</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status || 'pending')}`}>
                        {getStatusText(selectedOrder.status || 'pending')}
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-purple-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Fecha de Eliminación</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(selectedOrder.deletedAt)}</p>
                    </div>
                  </div>
                </div>

                {/* File Attachment */}
                {selectedOrder.fileUrl && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl p-6 border border-yellow-100">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900">Archivo Adjunto</h4>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-yellow-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm font-medium text-gray-900">{selectedOrder.fileName || 'Archivo PDF'}</span>
                        </div>
                        <a
                          href={selectedOrder.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Ver archivo
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Retention Information */}
                <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-xl p-6 border border-red-100">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900">Información de Retención</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-red-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Fecha de Retención</p>
                      <p className="text-sm font-semibold text-gray-900">{formatDate(selectedOrder.retentionDate || null)}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-red-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">Días Restantes</p>
                      <p className={`text-sm font-semibold ${
                        getDaysUntilDeletion(selectedOrder.retentionDate || null) <= 3 ? 'text-red-600' :
                        getDaysUntilDeletion(selectedOrder.retentionDate || null) <= 7 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {getDaysUntilDeletion(selectedOrder.retentionDate || null)} días
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Account Section - Only visible on mobile */}
      <div className="block md:hidden mt-8">
        <div className="bg-white border-t border-gray-200 py-4">
          <div className="flex items-center justify-end gap-3">
            <span className="text-gray-800 font-medium truncate">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
              title="Cerrar sesión"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}