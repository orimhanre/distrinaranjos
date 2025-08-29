"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import app, { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import {
  DocumentData,
  Timestamp,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
  setDoc,
} from "firebase/firestore";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
  ColumnDef,
} from "@tanstack/react-table";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { fetchCollection, deleteFromCollection, addToCollection } from "@/lib/firestoreUtils";
import ReactDOM from "react-dom";
import { usePopper } from 'react-popper';

import { checkAdminPermission } from "@/lib/adminPermissions";
import { MdDelete, MdArchive, MdUnarchive } from "react-icons/md";
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";
import { usePathname } from "next/navigation";

// DropdownPortal component for robust dropdown rendering
function DropdownPortal({ children }: { children: React.ReactNode }) {
  if (typeof window === "undefined") return null;
  const el = document.getElementById("dropdown-portal-root") || (() => {
    const div = document.createElement("div");
    div.id = "dropdown-portal-root";
    document.body.appendChild(div);
    return div;
  })();
  return ReactDOM.createPortal(children, el);
}

// Utility: stop event propagation for dropdown input/button
function stopDropdownPropagation(e: React.MouseEvent) { e.stopPropagation(); }

export default function AdminPage() {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [orders, setOrders] = useState<DocumentData[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [starredRows, setStarredRows] = useState<Record<string, boolean>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Debug: Log when filterStatus changes
  useEffect(() => {
    console.log('filterStatus changed to:', filterStatus);
  }, [filterStatus]);
  const [labelModalOpen, setLabelModalOpen] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DocumentData | null>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Add state for label deletion confirmation modal:
  const [labelToDelete, setLabelToDelete] = useState<{ orderId: string, label: string } | null>(null);
  // Add state for label filter dropdown:
  const DEFAULT_LABELS = [
    { name: 'Nuevo Pedido', color: 'text-gray-600' },
    { name: 'Pagado', color: 'text-green-600' },
    { name: 'Pago pendiente', color: 'text-yellow-600' },
    { name: 'Importante', color: 'text-red-600' },
    { name: 'Enviado', color: 'text-blue-600' },
  ];
  const [customLabels, setCustomLabels] = useState<{ name: string, color: string }[]>([]);
  // Separate dropdown state for row and header
  const [rowLabelDropdownOpen, setRowLabelDropdownOpen] = useState<string | null>(null);
  const [headerLabelDropdownOpen, setHeaderLabelDropdownOpen] = useState(false);
  const allLabels = [
    ...DEFAULT_LABELS.map(l => l.name),
    ...customLabels.map(l => l.name)
  ].filter((v, i, a) => a.indexOf(v) === i);
  const labelFilterRef = useRef<HTMLDivElement>(null);
  // Add state for dropdown position
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const filterBtnRef = useRef<HTMLDivElement>(null);
  // Add a ref for the placeholder icon and dropdown
  const placeholderDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Add a ref for each row label dropdown
  const rowDropdownRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Add state for row dropdown position
  // const [rowDropdownPos, setRowDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const [mobileDropdownPosition, setMobileDropdownPosition] = useState<{ x: number; y: number; rowId: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    // Set isMobile based on window width
    function handleResize() {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getLabelColor = (label: string) => {
    const found = DEFAULT_LABELS.find(l => l.name === label) || customLabels.find(l => l.name === label);
    return found ? found.color : 'text-gray-600';
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      
      // If user is signed in, check permissions
      if (firebaseUser?.email) {
        setPermissionLoading(true);
        checkAdminPermission(firebaseUser.email).then((hasPermission) => {
          setHasPermission(hasPermission);
          setPermissionLoading(false);
        });
      } else {
        setHasPermission(false);
        setPermissionLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    console.log('🔍 Orders useEffect triggered:', { user: !!user, hasPermission, pathname });
    if (!user || !hasPermission) {
      console.log('❌ Not fetching orders - user or permission missing:', { user: !!user, hasPermission });
      return;
    }
    
    // Only fetch orders data when user is actually on this page
    // Check if we're on the main admin page specifically
    if (pathname === '/admin') {
      setOrdersLoading(true);
      setOrdersError(null);
      
      console.log('🔍 Fetching orders from API...');
      fetch('/api/admin/orders')
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log('📊 API response:', data);
          console.log('📊 Number of orders received:', data.orders?.length || 0);
          console.log('📊 Orders data:', data.orders);
          
          if (!data.orders || data.orders.length === 0) {
            console.log('⚠️ No orders found in API response');
            setOrders([]);
            setOrdersLoading(false);
            return;
          }
          
          const docs = data.orders.map((order: any) => ({ 
            id: order.id, 
            status: order.status || 'new', // Use existing status or default
            ...order 
          }));
          console.log('✅ Loaded orders:', docs.map((doc: any) => ({ id: doc.id, status: doc.status, hasStatus: !!doc.status })));
          setOrders(docs);
          setOrdersLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching orders:", err);
          if (err.code === 'resource-exhausted' || err.message?.includes('quota')) {
            setOrdersError("Firestore quota exceeded. Please upgrade your plan or try again later.");
            console.warn('Firestore quota exceeded - admin panel disabled');
          } else {
            setOrdersError("Failed to load orders. Please check your connection and try again.");
          }
          setOrdersLoading(false);
        });
    }
  }, [user, hasPermission, pathname]);

  useEffect(() => {
    if (!user || !hasPermission) return;

    if (typeof window !== "undefined" && "serviceWorker" in navigator && process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      try {
        const messaging = getMessaging(app);

        // Request permission and get token
        getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY })
          .then((currentToken) => {
            if (currentToken) {
              // Send this token to your backend to save for admin notifications
              if (user?.email) {
                fetch('/api/save-admin-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: user.email, token: currentToken })
                })
                  .then(res => res.json())
                  .then(data => {
                    if (!data.success) {
                      console.error('Failed to save admin FCM token:', data.error);
                    }
                  })
                  .catch(err => {
                    console.error('Error saving admin FCM token:', err);
                  });
              }
              console.log("Admin FCM Token:", currentToken);
            } else {
              console.log("No registration token available. Request permission to generate one.");
            }
          })
          .catch((err) => {
            console.log("An error occurred while retrieving token. ", err);
          });

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
          // Show a toast, alert, or custom UI
          alert(`Nuevo pedido recibido: ${payload.notification?.title || ""}\n${payload.notification?.body || ""}`);
          // Optionally, refresh the order list here
        });
      } catch (error) {
        console.log("Firebase messaging setup error:", error);
      }
    }
  }, [user]);



  // Debounce search term to prevent excessive re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (labelFilterRef.current && !labelFilterRef.current.contains(event.target as Node)) {
        setHeaderLabelDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update dropdown position when opening
  useEffect(() => {
    if (headerLabelDropdownOpen && filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect();
      setDropdownPos({ left: rect.left, top: rect.bottom });
    }
  }, [headerLabelDropdownOpen]);

  // Update effect to close row label dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rowLabelDropdownOpen) {
        const ref = rowDropdownRefs.current[rowLabelDropdownOpen];
        if (ref && !ref.contains(event.target as Node)) {
          setRowLabelDropdownOpen(null);
        }
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [rowLabelDropdownOpen]);

  // Add effect to update row dropdown position on scroll/resize when open
  useEffect(() => {
    if (!rowLabelDropdownOpen) return;
    let rafId: number | null = null;
    const updatePosition = () => {
      const ref = rowDropdownRefs.current[rowLabelDropdownOpen] || placeholderDropdownRefs.current[rowLabelDropdownOpen];
      if (!ref) {
        setRowLabelDropdownOpen(null);
        return;
      }
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        if (document.body && !document.body.contains(ref)) {
          setRowLabelDropdownOpen(null);
          return;
        }
      }
      if (ref) {
        const rect = ref.getBoundingClientRect();
        // setRowDropdownPos({ left: rect.left, top: rect.bottom }); // This line is removed
      }
    };
    // Use requestAnimationFrame to update position after render
    rafId = window.requestAnimationFrame(updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    // Also update position if the ref changes (e.g., table rerender)
    const interval = setInterval(updatePosition, 200);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      clearInterval(interval);
    };
  }, [rowLabelDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rowLabelDropdownOpen && mobileDropdownPosition) {
        // Check if click is outside dropdown
        const dropdown = document.querySelector('[data-mobile-dropdown="true"]');
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setRowLabelDropdownOpen(null);
          setMobileDropdownPosition(null);
        }
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [rowLabelDropdownOpen, mobileDropdownPosition]);

  // Helper to render any value (including objects/arrays, timestamps, and URLs)
  const renderValue = (value: any) => {
    if (value && typeof value === "object" && value.seconds && value.nanoseconds) {
      try {
        const date = new Date(value.seconds * 1000);
        return <span>{date.toLocaleString()}</span>;
      } catch {
        return <span>{JSON.stringify(value)}</span>;
      }
    }
    if (typeof value === "string" && value.startsWith("http")) {
      return (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
          {value.length > 40 ? value.slice(0, 40) + "..." : value}
        </a>
      );
    }
    if (Array.isArray(value)) {
      return (
        <ul className="list-disc pl-4">
          {value.map((v, i) => (
            <li key={i}>{renderValue(v)}</li>
          ))}
        </ul>
      );
    }
    if (typeof value === "object" && value !== null) {
      return <pre className="whitespace-pre-wrap break-all bg-gray-100 rounded p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>;
    }
    return <span className="break-all">{String(value)}</span>;
  };

  // Helper to get full name
  const getFullName = (order: DocumentData) => {
    return (order.name || "") + (order.surname ? " " + order.surname : "");
  };

  // Helper to get product list as separate lines
  const getProductList = (order: DocumentData) => {
    if (order.cartItems && Array.isArray(order.cartItems)) {
      return order.cartItems.map((item: any) => `${item.product?.brand || ''} - ${item.product?.name || ''}`).join("\n");
    }
    return "(Not available)";
  };

  // Helper to extract client info from orderDetails
  const getClientInfo = (order: DocumentData) => {
    const orderDetails = order.orderDetails || "";
    const clienteMatch = orderDetails.match(/Cliente: ([^|]+)/);
    return {
      empresa: clienteMatch ? clienteMatch[1].trim() : order.userName || "",
      nombre: "", // Will be extracted from client data if available
      celular: "", // Will be extracted from client data if available
      ciudad: "", // Will be extracted from client data if available
      departamento: "" // Will be extracted from client data if available
    };
  };

  // Helper to format date with time
  const formatDate = (timestamp: any) => {
    try {
      // Firestore Timestamp
      if (timestamp && typeof timestamp === "object" && typeof timestamp.seconds === 'number') {
        const date = new Date(timestamp.seconds * 1000);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
      }
      // JS Date instance
      if (timestamp instanceof Date) {
        const date = timestamp as Date;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${day}.${month}.${year} ${hours}:${minutes}`;
      }
      // ISO string or other date string
      if (typeof timestamp === 'string') {
        const parsed = new Date(timestamp);
        if (!isNaN(parsed.getTime())) {
          const day = String(parsed.getDate()).padStart(2, '0');
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const year = parsed.getFullYear();
          const hours = String(parsed.getHours()).padStart(2, '0');
          const minutes = String(parsed.getMinutes()).padStart(2, '0');
          return `${day}.${month}.${year} ${hours}:${minutes}`;
        }
      }
      // Milliseconds epoch
      if (typeof timestamp === 'number') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          return `${day}.${month}.${year} ${hours}:${minutes}`;
        }
      }
    } catch (e) {
      // ignore
    }
    return "";
  };

  // Helper to parse orderDetails
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

  // Helper to get product list from orderDetails or fileName (as placeholder)
  const getProductos = (order: DocumentData) => {
    // If you have cartItems, use that. Otherwise, parse from orderDetails or fileName.
    if (order.cartItems && Array.isArray(order.cartItems)) {
      return order.cartItems.map((item: any) => `${item.product?.brand || ''} - ${item.product?.name || ''} x${item.quantity}`).join(", ");
    }
    // Try to parse from orderDetails (if possible)
    if (order.orderDetails) {
      // Example: extract product info if present (customize as needed)
      // For now, just return orderDetails as a fallback
      return order.orderDetails;
    }
    // Fallback to fileName
    return order.fileName || "";
  };

  const getProductosArray = (order: DocumentData) => {
    // If you have cartItems, use that. Otherwise, create a fallback array
    if (order.cartItems && Array.isArray(order.cartItems)) {
      return order.cartItems.map((item: any) => {
        const name = item.product?.name || item.productName || 'Producto sin nombre';
        let price = 0;
        if (typeof item.product?.price1 === 'number' || typeof item.product?.price2 === 'number') {
          price = item.selectedPrice === 'price2'
            ? (item.product?.price2 ?? item.product?.price1 ?? 0)
            : (item.product?.price1 ?? item.product?.price2 ?? 0);
        } else if (typeof item.product?.price === 'number') {
          price = item.product.price;
        } else if (typeof item.unitPrice === 'number') {
          price = item.unitPrice;
        }
        return {
          name,
          quantity: item.quantity || 1,
          price,
          brand: item.product?.brand || item.brand || '',
          selectedColor: item.selectedColor || item.color || ''
        };
      });
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
          price: totalAmount,
          brand: order.brand || order.productBrand || 'Sin especificar',
          selectedColor: order.selectedColor || ''
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
    
    // Fallback: create a single item from fileName
    const productName = order.fileName || 'Producto sin nombre';
    return [{
      name: productName,
      quantity: 1,
      price: totalAmount,
      brand: '',
      selectedColor: ''
    }];
  };

  // Delete order from Firestore
  const handleDelete = async (id: string) => {
    setItemToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteError(null);
    if (itemToDelete) {
      let orderToDelete = orders.find(order => order.id === itemToDelete);
      if (!orderToDelete) {
        const docSnap = await getDoc(doc(db, "orders", itemToDelete));
        if (docSnap.exists()) {
          orderToDelete = { id: itemToDelete, ...docSnap.data() };
        }
      }
      if (orderToDelete) {
        try {
          // Add to deleted_orders with deletedAt timestamp, preserving original ID
          await setDoc(doc(db, "deleted_orders", itemToDelete), { 
            ...orderToDelete, 
            // Ensure top-level status is present for deleted list UI
            status: (orderToDelete as any).status || (orderToDelete as any).orders?.[0]?.status || 'new',
            deletedAt: serverTimestamp(),
            retentionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          });
          await deleteFromCollection("orders", itemToDelete);
          // Call the API route to delete from orders
          const res = await fetch('/api/delete-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: itemToDelete })
          });
          const data = await res.json();
          if (!data.success) {
            setDeleteError(data.error || 'Failed to delete order from server.');
            console.error('API delete error:', data.error);
            return;
          }
          setOrders((prev) => prev.filter((order) => order.id !== itemToDelete));
        } catch (err: any) {
          setDeleteError("Failed to delete order. Please check your permissions or network.");
          console.error("Delete error:", err);
        }
      } else {
        setDeleteError("Order to delete not found.");
        console.warn("Order to delete not found:", itemToDelete);
      }
      setItemToDelete(null);
    }
    setDeleteModalOpen(false);
  };

  // Toggle star
  const handleStar = async (id: string) => {
    try {
      const order = orders.find(o => o.id === id);
      const newStarredStatus = !order?.isStarred;
      
      // Update in Firestore
      await updateDoc(doc(db, "orders", id), { isStarred: newStarredStatus });
      
      // Update local state
      setOrders(prev => prev.map(o => 
        o.id === id ? { ...o, isStarred: newStarredStatus } : o
      ));
      setStarredRows((prev) => ({ ...prev, [id]: newStarredStatus }));
    } catch (error) {
      console.error("Error updating star status:", error);
    }
  };

  // Toggle row selection
  const handleSelect = (id: string) => {
    setSelectedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Bulk select all
  const allSelected = orders.length > 0 && orders.every(order => selectedRows[order.id]);
  const anySelected = Object.values(selectedRows).some(Boolean);
  const selectedCount = Object.values(selectedRows).filter(Boolean).length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRows({});
    } else {
      const newSelected: Record<string, boolean> = {};
      orders.forEach(order => { newSelected[order.id] = true; });
      setSelectedRows(newSelected);
    }
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    setBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    setDeleteError(null);
    const idsToDelete = Object.entries(selectedRows).filter(([_, v]) => v).map(([id]) => id);
    const ordersToDelete = orders.filter(order => idsToDelete.includes(order.id));
    try {
      await Promise.all(ordersToDelete.map(order =>
        setDoc(doc(db, "deleted_orders", order.id), { 
          ...order, 
          status: (order as any).status || (order as any).orders?.[0]?.status || 'new',
          deletedAt: serverTimestamp(),
          retentionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        })
      ));
      // Call the API route for each delete
      for (const id of idsToDelete) {
        await deleteFromCollection("orders", id);
      }
      setOrders(prev => prev.filter(order => !idsToDelete.includes(order.id)));
      setSelectedRows({});
      setBulkDeleteModalOpen(false);
    } catch (err: any) {
      setDeleteError("Failed to delete selected orders. Please check your permissions or network.");
      console.error("Bulk delete error:", err);
    }
  };

  // Archive selected
  const handleBulkArchive = async () => {
    const idsToArchive = Object.entries(selectedRows).filter(([_, v]) => v).map(([id]) => id);
    await Promise.all(idsToArchive.map(id => updateDoc(doc(db, "orders", id), { archived: true })));
    setOrders(prev => prev.map(order => idsToArchive.includes(order.id) ? { ...order, archived: true } : order));
    setSelectedRows({});
  };

  // Unarchive selected
  const handleBulkUnarchive = async () => {
    const idsToUnarchive = Object.entries(selectedRows).filter(([_, v]) => v).map(([id]) => id);
    await Promise.all(idsToUnarchive.map(id => updateDoc(doc(db, "orders", id), { archived: false })));
    setOrders(prev => prev.map(order => idsToUnarchive.includes(order.id) ? { ...order, archived: false } : order));
    setSelectedRows({});
  };

  // Archive individual order
  const handleArchiveOrder = async (orderId: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const newArchivedStatus = !order?.archived;
      await updateDoc(doc(db, "orders", orderId), { archived: newArchivedStatus });
      
      // Update local state
      const updatedOrders = orders.map(o => 
        o.id === orderId ? { ...o, archived: newArchivedStatus } : o
      );
      setOrders(updatedOrders);
    } catch (error) {
      console.error("Error archiving order:", error);
    }
  };

  // Update individual order status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      
      // Update local state
      const updatedOrders = orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      );
      setOrders(updatedOrders);
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  // Label selected
  // For single-label per order, replace label instead of adding
  const handleBulkLabel = async (label: string) => {
    if (!label) return;
    const idsToLabel = Object.entries(selectedRows).filter(([_, v]) => v).map(([id]) => id);
    try {
      await Promise.all(idsToLabel.map(id => updateDoc(doc(db, "orders", id), { labels: [label] })));
      setOrders(prev => prev.map(o => idsToLabel.includes(o.id) ? { ...o, labels: [label] } : o));
      setLabelInput("");
      setLabelModalOpen(false);
      setSelectedRows({});
    } catch (err) {
      console.error("Error applying labels:", err);
      // You might want to show an error message to the user here
    }
  };

  // Handle individual row label change
  const handleRowLabelChange = async (orderId: string, label: string) => {
    if (!label) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { labels: [label] });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, labels: [label] } : o));
      setRowLabelDropdownOpen(null);
    } catch (err) {
      console.error("Error applying label to order:", err);
    }
  };

  // Remove label from a row
  const handleRemoveLabel = async (id: string, label: string) => {
    const order = orders.find(o => o.id === id);
    const prevLabels = Array.isArray(order?.labels) ? order.labels : [];
    const newLabels = prevLabels.filter((l: string) => l !== label);
    await updateDoc(doc(db, "orders", id), { labels: newLabels });
    setOrders(prev => prev.map(o => o.id === id ? { ...o, labels: newLabels } : o));
  };

  // Navigate to deleted files page
  const handleViewDeletedFiles = () => {
    window.open('/admin/archivos-eliminados', '_blank');
  };

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<DocumentData, any>[]>(() => [
    {
      id: "select",
      header: () => <span></span>,
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={!!selectedRows[row.original.id]}
          onChange={() => handleSelect(row.original.id)}
          className="accent-blue-600"
        />
      ),
      size: 80,
      enableSorting: false,
    },





    {
      id: "labels",
      header: () => (
        <div ref={labelFilterRef} className="relative w-full flex justify-center items-center">
          <div
            ref={filterBtnRef}
            role="button"
            tabIndex={0}
            className={`flex items-center gap-1 rounded px-2 py-1 shadow-sm min-w-[80px] h-[44px] focus:outline-none cursor-pointer justify-center items-center ${labelFilter ? 'bg-white border border-gray-300' : ''}`}
            onClick={() => {
              setRowLabelDropdownOpen(null);
              setHeaderLabelDropdownOpen(open => {
                const next = !open;
                if (next && filterBtnRef.current) {
                  const rect = filterBtnRef.current.getBoundingClientRect();
                  setDropdownPos({ left: rect.left, top: rect.bottom });
                }
                return next;
              });
            }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setHeaderLabelDropdownOpen(open => !open); setRowLabelDropdownOpen(null); } }}
          >
            {labelFilter ? (
              <>
                <span className={`text-xs font-medium min-w-[40px] h-[28px] flex items-center ${getLabelColor(labelFilter).split(' ').filter(cls => cls.startsWith('text-')).join(' ')}`}>{labelFilter}</span>
                <button
                  type="button"
                  className="ml-2 text-gray-400 text-base select-none focus:outline-none"
                  onClick={e => { e.stopPropagation(); setHeaderLabelDropdownOpen(false); }}
                  tabIndex={-1}
                  aria-label="Expandir filtro de etiquetas"
                >
                  {headerLabelDropdownOpen ? '▲' : '▼'}
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400 select-none flex items-center h-[44px]">
                Filtrar por etiqueta...
                <span className="ml-2 text-gray-400 text-base select-none">
                  {headerLabelDropdownOpen ? '▲' : '▼'}
                </span>
              </span>
            )}
          </div>
          {headerLabelDropdownOpen && dropdownPos && (
            <DropdownPortal>
              <div
                className="fixed min-w-max w-auto bg-white border border-gray-200 rounded-xl shadow-lg z-[1000] flex flex-col p-2"
                style={{
                  minWidth: 180,
                  left: dropdownPos.left,
                  top: dropdownPos.top + 4, // small offset below button
                }}
              >
                <button
                  type="button"
                  className={`px-3 py-2 text-left text-sm font-bold text-black transition-all duration-150 ${!labelFilter ? 'ring-2 ring-blue-400' : ''} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10`}
                  style={{ minHeight: '32px' }}
                  onMouseDown={e => { e.preventDefault(); setLabelFilter(""); setHeaderLabelDropdownOpen(false); }}
                >
                  Todos
                </button>
                {allLabels.length === 0 ? (
                  <span className="px-3 py-2 text-gray-400 text-xs">No hay etiquetas</span>
                ) : (
                  allLabels.map(label => (
                    <button
                      key={label}
                      type="button"
                      className={`px-3 py-2 text-left text-sm font-normal transition-all duration-150 ${labelFilter === label ? 'font-bold ring-2 ring-blue-400' : ''} ${getLabelColor(label).split(' ').filter(cls => cls.startsWith('text-')).join(' ')} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10`}
                      style={{ minHeight: '32px' }}
                      onMouseDown={e => { e.preventDefault(); setLabelFilter(label); setHeaderLabelDropdownOpen(false); }}
                    >
                      {label}
                    </button>
                  ))
                )}
              </div>
            </DropdownPortal>
          )}
        </div>
      ),
      cell: ({ row }) => {
        // Popper refs and state for this row
        const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
        const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
        const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
          placement: 'top-start',
          modifiers: [
            { name: 'offset', options: { offset: [0, 4] } },
            { name: 'preventOverflow', options: { boundary: 'clippingParents' } },
          ],
        });
        // When dropdown opens, update popper position
        useEffect(() => { if (rowLabelDropdownOpen === row.original.id && update) update(); }, [rowLabelDropdownOpen, update, row.original.id]);

        return (
          <div className="flex items-center justify-center h-12">
            {/* Label tags: Always show */}
            {Array.isArray(row.original.labels) && row.original.labels.filter(l => l && l.trim()).length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.original.labels.filter(label => label && label.trim()).map((label: string) => (
                  <div key={label} className="relative group">
                    <div
                      ref={el => {
                        if (row.original.id) rowDropdownRefs.current[row.original.id] = el;
                        setReferenceElement(el);
                      }}
                      className={`inline-flex items-center ${getLabelColor(label)} text-xs font-medium cursor-pointer truncate whitespace-nowrap overflow-hidden`}
                      onClick={e => {
                        setRowLabelDropdownOpen(prev => prev === row.original.id ? null : row.original.id);
                        setHeaderLabelDropdownOpen(false);
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      title="Cambiar etiqueta"
                      style={{ display: 'inline-flex' }}
                    >
                      {label}
                    </div>
                    {/* Dropdown for changing label */}
                    {!isMobile && rowLabelDropdownOpen === row.original.id && (
                      <DropdownPortal>
                        <div
                          ref={setPopperElement}
                          style={{ ...styles.popper, zIndex: 2000 }}
                          {...attributes.popper}
                          className="min-w-max w-auto bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col p-2"
                          onMouseDown={e => e.stopPropagation()}
                        >
                          {allLabels.map(lab => (
                            <div key={lab} className="flex items-center group">
                              <button
                                className={`px-3 py-2 text-left text-sm font-normal transition-all duration-150 ${label === lab ? 'font-bold ring-2 ring-blue-400' : ''} ${getLabelColor(lab).split(' ').filter(cls => cls.startsWith('text-')).join(' ')} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10`}
                                style={{ minWidth: '120px' }}
                                onClick={e => { e.preventDefault(); handleRowLabelChange(row.original.id, lab); }}
                              >
                                {lab}
                              </button>
                              {/* Show delete button only for custom labels */}
                              {customLabels.some(l => l.name === lab) && (
                                <button
                                  className="ml-1 text-red-500 hover:text-red-700 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar etiqueta global"
                                  onClick={e => { e.stopPropagation(); handleDeleteGlobalLabel(lab); }}
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                          <div className="flex items-center mt-2">
                            <input
                              type="text"
                              className="border border-gray-300 rounded px-2 py-1 text-xs mr-2"
                              placeholder="Nueva etiqueta"
                              value={labelInput}
                              onChange={e => setLabelInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') { handleRowLabelChange(row.original.id, labelInput); } }}
                              onMouseDown={stopDropdownPropagation}
                            />
                            <button
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold"
                              onClick={() => { handleRowLabelChange(row.original.id, labelInput); }}
                              onMouseDown={stopDropdownPropagation}
                              onClickCapture={stopDropdownPropagation}
                            >Agregar</button>
                          </div>
                        </div>
                      </DropdownPortal>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Show label placeholder icon if there are no labels */}
            {(!Array.isArray(row.original.labels) || row.original.labels.filter(l => l && l.trim()).length === 0) && (
              <div
                className="relative flex items-center justify-center h-full min-h-[32px]"
                ref={el => { if (row.original.id) placeholderDropdownRefs.current[row.original.id] = el; setReferenceElement(el); }}
              >
                <div
                  className="text-gray-400 text-lg font-bold px-1 cursor-pointer"
                  title="Agregar etiqueta"
                  style={{ fontSize: '1rem', padding: 0, display: 'inline-flex' }}
                  onClick={e => {
                    setRowLabelDropdownOpen(prev => prev === row.original.id ? null : row.original.id);
                    setHeaderLabelDropdownOpen(false);
                  }}
                >
                  🏷️
                </div>
                {/* Dropdown for adding label */}
                {!isMobile && rowLabelDropdownOpen === row.original.id && (
                  <DropdownPortal>
                    <div
                      ref={setPopperElement}
                      style={{ ...styles.popper, zIndex: 2000 }}
                      {...attributes.popper}
                      className="min-w-max w-auto bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col p-2"
                      onMouseDown={e => e.stopPropagation()}
                    >
                      {allLabels.map(lab => (
                        <div key={lab} className="flex items-center group">
                          <button
                            className={`px-3 py-2 text-left text-sm font-normal transition-all duration-150 ${getLabelColor(lab).split(' ').filter(cls => cls.startsWith('text-')).join(' ')} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10`}
                            style={{ minWidth: '120px' }}
                            onClick={e => { e.preventDefault(); handleRowLabelChange(row.original.id, lab); }}
                          >
                            {lab}
                          </button>
                          {/* Show delete button only for custom labels */}
                          {customLabels.some(l => l.name === lab) && (
                            <button
                              className="ml-1 text-red-500 hover:text-red-700 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Eliminar etiqueta global"
                              onClick={e => { e.stopPropagation(); handleDeleteGlobalLabel(lab); }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex items-center mt-2">
                        <input
                          type="text"
                          className="border border-gray-300 rounded px-2 py-1 text-xs mr-2"
                          placeholder="Nueva etiqueta"
                          value={labelInput}
                          onChange={e => setLabelInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { handleRowLabelChange(row.original.id, labelInput); } }}
                          onMouseDown={stopDropdownPropagation}
                        />
                        <button
                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold"
                          onClick={() => { handleRowLabelChange(row.original.id, labelInput); }}
                          onMouseDown={stopDropdownPropagation}
                          onClickCapture={stopDropdownPropagation}
                        >Agregar</button>
                      </div>
                    </div>
                  </DropdownPortal>
                )}
              </div>
            )}
          </div>
        );
      },
      size: 150,
      enableSorting: false,
    },
    
    {
      accessorKey: "timestamp",
      header: "Fecha",
      cell: ({ getValue }) => <span className="text-black">{formatDate(getValue())}</span>,
      size: 160,
      enableSorting: true,
    },
    {
      accessorKey: "userName",
      header: "Empresa",
      cell: ({ getValue }) => <span className="text-black">{getValue() || ""}</span>,
      size: 140,
      enableSorting: true,
    },
    {
      id: "nombreCompleto",
      header: "Nombre Completo",
      cell: ({ row }) => {
        // Get client name and surname from client data
        const client = row.original.client;
        if (client && client.name) {
          const fullName = `${client.name}${client.surname ? ' ' + client.surname : ''}`;
          return <span className="text-black">{fullName}</span>;
        }
        // Fallback to userName if client data not available
        return <span className="text-black">{row.original.userName || ""}</span>;
      },
      size: 140,
      enableSorting: true,
    },
    {
      id: "celular",
      header: "Celular",
      cell: ({ row }) => <span className="text-black">{row.original.client?.phone || ""}</span>,
      size: 140,
      enableSorting: true,
    },
    {
      id: "ciudad",
      header: "Ciudad / Pueblo",
      cell: ({ row }) => <span className="text-black">{row.original.client?.city || ""}</span>,
      size: 160,
      enableSorting: true,
    },
    {
      id: "departamento",
      header: "Departamento",
      cell: ({ row }) => <span className="text-black">{row.original.client?.department || ""}</span>,
      size: 140,
      enableSorting: true,
    },
    {
      id: "total",
      header: "Total Precio",
      cell: ({ row }) => {
        const totalRaw = parseOrderDetails(row.original.orderDetails).total || "";
        const tipo = parseOrderDetails(row.original.orderDetails).type || "";
        // Remove any non-digit characters (in case it's already formatted)
        const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
        
        // Get price type indicator
        let priceIndicator = null;
        if (tipo.includes("Precio 1")) {
          priceIndicator = (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 mr-2">
              P1
            </span>
          );
        } else if (tipo.includes("Precio 2")) {
          priceIndicator = (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mr-2">
              P2
            </span>
          );
        }
        
        return (
          <div className="flex items-center">
            {priceIndicator}
            <span className="text-black">
              {isNaN(numeric) ? "" : `$${numeric.toLocaleString("de-DE")}`}
            </span>
          </div>
        );
      },
      size: 120,
      enableSorting: true,
    },
    {
      id: "archivo",
      header: "Archivo",
      cell: ({ row }) => {
        const fileUrl = row.original.fileUrl;
        const fileName = row.original.fileName;
        const tipo = parseOrderDetails(row.original.orderDetails).type || "";
        
        if (fileUrl && fileName) {
          // Get price type indicator
          let priceIndicator = null;
          if (tipo.includes("Precio 1")) {
            priceIndicator = (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 mr-2">
                1
              </span>
            );
          } else if (tipo.includes("Precio 2")) {
            priceIndicator = (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mr-2">
                2
              </span>
            );
          }
          
          return (
            <div className="flex items-center">
              {priceIndicator}
              <a 
                href={fileUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:text-blue-800 underline truncate max-w-[120px] md:max-w-[240px] block whitespace-normal md:whitespace-nowrap"
                title="Click to open PDF"
              >
                {fileName}
              </a>
            </div>
          );
        }
        return <span className="text-gray-400">No PDF</span>;
      },
      size: 200,
      enableSorting: true,
    },
    {
      id: "tipo",
      header: "Tipo",
      cell: ({ row }) => {
        const tipo = parseOrderDetails(row.original.orderDetails).type || "";
        if (tipo.includes("Precio 1")) {
          return <span className="text-green-600 font-bold">Precio 1</span>;
        }
        if (tipo.includes("Precio 2")) {
          return <span className="text-blue-600 font-bold">Precio 2</span>;
        }
        return <span>{tipo}</span>;
      },
      enableSorting: true,
      size: 100,
    },

  ], [selectedRows, orders, labelFilter, headerLabelDropdownOpen, rowLabelDropdownOpen]);

  // Memoized search function for better performance
  const searchInOrder = useCallback((order: DocumentData, searchTerm: string): boolean => {
    if (!searchTerm || searchTerm.length < 1) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search in all relevant fields
    const searchableFields = [
      order.userName || '',
      order.id || '',
      order.orderDetails || '',
      order.fileName || '',
      order.client?.name || '',
      order.client?.surname || '',
      order.client?.phone || '',
      order.client?.city || '',
      order.client?.department || '',
      order.client?.companyName || '',
    ];
    
    return searchableFields.some(field => 
      field.toLowerCase().includes(searchLower)
    );
  }, []);

  // Memoized filtered orders for better performance
  const filteredOrders = useMemo(() => {
    console.log('Filtering orders:', {
      totalOrders: orders.length,
      filterStatus,
      showArchived,
      ordersWithStatus: orders.filter(o => o.status).length,
      statuses: orders.map(o => o.status || 'no-status'),
      uniqueStatuses: [...new Set(orders.map(o => o.status || 'no-status'))]
    });
    
    return orders.filter(order => {
      // When showArchived is true, show only archived orders
      // When showArchived is false, show only non-archived orders
      if (showArchived && !order.archived) return false;
      if (!showArchived && order.archived) return false;
      
      // Filter by status - treat pending as new since we removed pending status
      const orderStatus = order.status === 'pending' ? 'new' : (order.status || 'new');
      if (filterStatus !== 'all' && orderStatus !== filterStatus) {
        console.log('❌ Filtered out order:', order.id, 'status:', orderStatus, 'filterStatus:', filterStatus);
        return false;
      } else if (filterStatus !== 'all') {
        console.log('✅ Keeping order:', order.id, 'status:', orderStatus, 'filterStatus:', filterStatus);
      }
      
      if (labelFilter && (!Array.isArray(order.labels) || !order.labels.includes(labelFilter))) return false;
      if (!searchInOrder(order, searchTerm)) return false;
      return true;
    });
  }, [orders, showArchived, filterStatus, labelFilter, debouncedSearchTerm, searchInOrder]);

  console.log('🔍 Table data:', { 
    filteredOrdersLength: filteredOrders.length, 
    filteredOrdersIds: filteredOrders.map(o => o.id),
    filterStatus 
  });

  const table = useReactTable({
    data: filteredOrders,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
    // Performance optimizations
    enableSorting: true,
    enableMultiSort: false,
  });

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
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

  // Handler to delete a label from the global list
  function handleDeleteGlobalLabel(label: string) {
    setCustomLabels(prev => prev.filter(l => l.name !== label));
  }

  // Format currency function
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Helper functions for table display
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'shipped': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-cyan-100 text-cyan-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusColor = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Nuevo';
      case 'pending': return 'Nuevo'; // Treat pending as new since we removed pending status
      case 'confirmed': return 'Confirmado';
      case 'shipped': return 'En Camino';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const getPaymentStatusText = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid': return 'Pagado';
      case 'pending': return 'Pago Pendiente';
      case 'failed': return 'Pago Fallido';
      default: return paymentStatus;
    }
  };

  return (
    <div className="-mt-2">
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
      

      {/* Removed "Administración de Pedidos" text */}
      <div className="bg-white rounded-xl shadow-lg p-2 md:p-6 overflow-x-auto border border-gray-200">
        <h2 className="text-base md:text-xl font-semibold mb-4 text-gray-900 flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
          <span className="w-auto ml-4">Administración de Pedidos</span>
          <div className="flex flex-row gap-2 md:gap-4 items-center w-auto md:w-auto md:ml-auto">
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
                    {formatCurrency(orders.reduce((sum, order) => {
                      // Calculate total from orderDetails if totalAmount is not available
                      let orderTotal = order.totalAmount || 0;
                      if (!orderTotal && order.orderDetails) {
                        const totalRaw = parseOrderDetails(order.orderDetails).total || "";
                        const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
                        if (!isNaN(numeric)) {
                          orderTotal = numeric;
                        }
                      }
                      return sum + orderTotal;
                    }, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>



        {anySelected && (
          <div className="flex items-center gap-4 mb-4 p-2 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={handleSelectAll}
              className="accent-blue-600 mr-2"
              title="Seleccionar todo"
            />
            <span className="font-medium text-gray-700">{selectedCount} seleccionados</span>
            <button
              onClick={handleBulkDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium transition-colors"
              title="Eliminar seleccionados"
            >
              Eliminar
            </button>
            {!showArchived && (
              <button
                onClick={handleBulkArchive}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 font-medium transition-colors"
                title="Archivar seleccionados"
              >
                Archivar
              </button>
            )}
            {showArchived && (
              <button
                onClick={handleBulkUnarchive}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium transition-colors"
                title="Desarchivar seleccionados"
              >
                Desarchivar
              </button>
            )}
          </div>
        )}
        {/* Label Modal */}
        {labelModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 text-red-600">Agregar Etiqueta</h3>
              <div className="flex flex-wrap gap-2 mb-4 w-full">
                {DEFAULT_LABELS.map(l => (
                  <button
                    key={l.name}
                    onClick={() => handleBulkLabel(l.name)}
                    className={`px-3 py-1 rounded-full font-semibold text-xs ${l.color} border border-gray-200 hover:scale-105 transition-transform`}
                  >
                    {l.name}
                  </button>
                ))}
                {customLabels.map(l => (
                  <button
                    key={l.name}
                    onClick={() => handleBulkLabel(l.name)}
                    className={`px-3 py-1 rounded-full font-semibold text-xs ${l.color} border border-gray-200 hover:scale-105 transition-transform`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
              <input
                ref={labelInputRef}
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 mb-4 w-full bg-white text-black placeholder-gray-400 focus:border-red-600 focus:ring-2 focus:ring-red-400"
                placeholder="Nueva etiqueta personalizada"
                onKeyDown={e => { if (e.key === 'Enter') handleBulkLabel(labelInput); }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (labelInput.trim()) {
                      setCustomLabels(prev => prev.some(l => l.name === labelInput.trim()) ? prev : [...prev, { name: labelInput.trim(), color: 'bg-gray-200 text-gray-800' }]);
                      handleBulkLabel(labelInput.trim());
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700 font-semibold"
                >
                  Agregar
                </button>
                <button
                  onClick={() => setLabelModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400 font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 text-red-600">Eliminar Submisión</h3>
              <p className="text-gray-700 mb-4">¿Estás seguro de que quieres eliminar esta submisión?</p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDelete}
                  className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 font-semibold"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400 font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {bulkDeleteModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 text-red-600">Eliminar Seleccionados</h3>
              <p className="text-gray-700 mb-4">¿Estás seguro de que quieres eliminar {selectedCount} submisiones seleccionadas?</p>
              <div className="flex gap-2">
                <button
                  onClick={confirmBulkDelete}
                  className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 font-semibold"
                >
                  Eliminar Todos
                </button>
                <button
                  onClick={() => setBulkDeleteModalOpen(false)}
                  className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400 font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {labelToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] flex flex-col items-center">
              <h3 className="text-lg font-bold mb-2 text-red-600">Eliminar Etiqueta</h3>
              <p className="text-gray-700 mb-4">¿Estás seguro de que quieres eliminar la etiqueta "{labelToDelete.label}"?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handleRemoveLabel(labelToDelete.orderId, labelToDelete.label);
                    setLabelToDelete(null);
                  }}
                  className="bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700 font-semibold"
                >
                  Eliminar
                </button>
                <button
                  onClick={() => setLabelToDelete(null)}
                  className="bg-gray-300 text-gray-800 px-4 py-1 rounded hover:bg-gray-400 font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header Controls - Always Visible */}
        <div className="w-full relative bg-white rounded-lg shadow-sm border border-gray-200 mb-4" style={{ minWidth: '100%', width: '100%' }}>
          {/* Mobile Header with Controls */}
          <div className="block md:hidden">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex flex-col space-y-3">
                  <h3 className="text-lg font-medium text-gray-900">Lista de Pedidos</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`px-3 py-2 rounded-lg border font-medium transition-colors text-sm ${
                        showArchived 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
                    </button>
                    
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className={`px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                        filterStatus === 'new' ? 'text-orange-600 bg-orange-50' :
                        filterStatus === 'confirmed' ? 'text-blue-600 bg-blue-50' :
                        filterStatus === 'shipped' ? 'text-purple-600 bg-purple-50' :
                        filterStatus === 'delivered' ? 'text-green-600 bg-green-50' :
                        filterStatus === 'cancelled' ? 'text-red-600 bg-red-50' :
                        'text-gray-600'
                      }`}
                    >
                      <option value="all">Todos los estados</option>
                      <option value="new">Nuevo</option>
                      <option value="confirmed">Confirmado</option>
                      <option value="shipped">En Camino</option>
                      <option value="delivered">Entregado</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                    
                    <div className="relative flex-1 min-w-0">
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
              </div>
            </div>
          </div>
          
          {/* Desktop Header with Controls */}
          <div className="hidden md:block">
            <div className="bg-white shadow-sm rounded-lg border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Lista de Pedidos</h3>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowArchived(!showArchived)}
                      className={`px-4 py-2 rounded-lg border font-medium transition-colors ${
                        showArchived 
                          ? 'bg-blue-600 text-white border-blue-600' 
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {showArchived ? 'Ocultar Archivados' : 'Mostrar Archivados'}
                    </button>
                    
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className={`px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        filterStatus === 'new' ? 'text-orange-600 bg-orange-50' :
                        filterStatus === 'confirmed' ? 'text-blue-600 bg-blue-50' :
                        filterStatus === 'shipped' ? 'text-purple-600 bg-purple-50' :
                        filterStatus === 'delivered' ? 'text-green-600 bg-green-50' :
                        filterStatus === 'cancelled' ? 'text-red-600 bg-red-50' :
                        'text-gray-600'
                      }`}
                    >
                      <option value="all">Todos los estados</option>
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
              </div>
            </div>
          </div>
        </div>

        {ordersLoading ? (
          <div>Cargando submisiones...</div>
        ) : ordersError ? (
          <div className="text-red-600">{ordersError}</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500 text-lg mb-2">
              {labelFilter
                ? `No hay órdenes con la etiqueta "${labelFilter}".`
                : searchTerm
                  ? 'No se encontraron órdenes que coincidan con tu búsqueda'
                  : 'No se encontraron submisiones'}
            </div>
            {labelFilter && (
              <button
                className="mt-4 px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold hover:bg-blue-200 transition"
                onClick={() => setLabelFilter("")}
              >
                Quitar filtro
              </button>
            )}
            {searchTerm && !labelFilter && (
              <div className="text-gray-400 text-sm">
                Intenta ajustar tus términos de búsqueda
              </div>
            )}
          </div>
        ) : (
          <div className="w-full relative bg-white rounded-lg shadow-sm border border-gray-200" style={{ minWidth: '100%', width: '100%' }}>
            
            {/* Mobile View */}
            <div className="block md:hidden">
              <div className="p-4 space-y-4">
                {filteredOrders.length > 0 ? (
                  table.getRowModel().rows.map((row, idx) => (
                  <div key={row.id} className={`border border-gray-200 rounded-lg p-4 ${row.original.archived ? "opacity-50" : ""} ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!selectedRows[row.original.id]}
                          onChange={() => handleSelect(row.original.id)}
                          className="accent-blue-600"
                        />
                        <span className="text-xs text-gray-500">{formatDate(row.original.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-1 relative">
                        {Array.isArray(row.original.labels) && row.original.labels.filter(l => l && l.trim()).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.original.labels.filter(label => label && label.trim()).map((label: string) => (
                              <div key={label} className="relative">
                                <button
                                  className={`text-xs px-2 py-1 rounded-full ${getLabelColor(label)} bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400`}
                                  style={{ border: 'none', background: 'inherit' }}
                                  onClick={e => {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMobileDropdownPosition({
                                      x: rect.left,
                                      y: rect.bottom + window.scrollY,
                                      rowId: row.original.id
                                    });
                                    setRowLabelDropdownOpen(prev => prev === row.original.id ? null : row.original.id);
                                    setHeaderLabelDropdownOpen(false);
                                  }}
                                  type="button"
                                  tabIndex={0}
                                  aria-label="Cambiar etiqueta"
                                >
                                  {label}
                                </button>
                                {/* Mobile dropdown for existing label */}
                                {rowLabelDropdownOpen === row.original.id && mobileDropdownPosition?.rowId === row.original.id && (
                                  <DropdownPortal>
                                    <div
                                      data-mobile-dropdown="true"
                                      className="fixed min-w-max w-auto bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col p-2 z-[2000]"
                                      style={{
                                        left: Math.max(10, Math.min(mobileDropdownPosition!.x, window.innerWidth - 200)),
                                        top: mobileDropdownPosition!.y + 4,
                                        minWidth: '160px'
                                      }}
                                      onTouchStart={e => e.stopPropagation()}
                                      onClick={e => e.stopPropagation()}
                                    >
                                      {allLabels.map(lab => (
                                        <div key={lab} className="flex items-center group">
                                          <button
                                            className={`px-3 py-2 text-left text-sm font-normal transition-all duration-150 ${label === lab ? 'font-bold ring-2 ring-blue-400' : ''} ${getLabelColor(lab).split(' ').filter(cls => cls.startsWith('text-')).join(' ')} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10 flex-1`}
                                            onClick={e => { 
                                              e.preventDefault(); 
                                              e.stopPropagation();
                                              handleRowLabelChange(row.original.id, lab); 
                                            }}
                                          >
                                            {lab}
                                          </button>
                                          {customLabels.some(l => l.name === lab) && (
                                            <button
                                              className="ml-1 text-red-500 hover:text-red-700 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                              title="Eliminar etiqueta global"
                                              onClick={e => { 
                                                e.stopPropagation(); 
                                                handleDeleteGlobalLabel(lab); 
                                              }}
                                            >
                                              ×
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      <div className="flex items-center mt-2 gap-2">
                                        <input
                                          type="text"
                                          className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                                          placeholder="Nueva etiqueta"
                                          value={labelInput}
                                          onChange={e => setLabelInput(e.target.value)}
                                          onKeyDown={e => { 
                                            if (e.key === 'Enter') { 
                                              e.preventDefault();
                                              handleRowLabelChange(row.original.id, labelInput); 
                                            } 
                                          }}
                                          onClick={e => e.stopPropagation()}
                                        />
                                        <button
                                          className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                                          onClick={e => { 
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleRowLabelChange(row.original.id, labelInput); 
                                          }}
                                        >
                                          Agregar
                                        </button>
                                      </div>
                                    </div>
                                  </DropdownPortal>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Show add label button when no labels exist
                          <div className="relative">
                            <button
                              className="text-gray-400 text-lg font-bold px-1 cursor-pointer"
                              title="Agregar etiqueta"
                              onClick={e => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setMobileDropdownPosition({
                                  x: rect.left,
                                  y: rect.bottom + window.scrollY,
                                  rowId: row.original.id
                                });
                                setRowLabelDropdownOpen(prev => prev === row.original.id ? null : row.original.id);
                                setHeaderLabelDropdownOpen(false);
                              }}
                            >
                              🏷️
                            </button>
                            {/* Mobile dropdown for adding new label */}
                            {rowLabelDropdownOpen === row.original.id && mobileDropdownPosition?.rowId === row.original.id && (
                              <DropdownPortal>
                                <div
                                  data-mobile-dropdown="true"
                                  className="fixed min-w-max w-auto bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col p-2 z-[2000]"
                                  style={{
                                    left: Math.max(10, Math.min(mobileDropdownPosition!.x, window.innerWidth - 200)),
                                    top: mobileDropdownPosition!.y + 4,
                                    minWidth: '160px'
                                  }}
                                  onTouchStart={e => e.stopPropagation()}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {allLabels.map(lab => (
                                    <div key={lab} className="flex items-center group">
                                      <button
                                        className={`px-3 py-2 text-left text-sm font-normal transition-all duration-150 ${getLabelColor(lab).split(' ').filter(cls => cls.startsWith('text-')).join(' ')} truncate whitespace-nowrap overflow-hidden hover:bg-gray-400 hover:bg-opacity-10 flex-1`}
                                        onClick={e => { 
                                          e.preventDefault(); 
                                          e.stopPropagation();
                                          handleRowLabelChange(row.original.id, lab); 
                                        }}
                                      >
                                        {lab}
                                      </button>
                                      {customLabels.some(l => l.name === lab) && (
                                        <button
                                          className="ml-1 text-red-500 hover:text-red-700 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                          title="Eliminar etiqueta global"
                                          onClick={e => { 
                                            e.stopPropagation(); 
                                            handleDeleteGlobalLabel(lab); 
                                          }}
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <div className="flex items-center mt-2 gap-2">
                                    <input
                                      type="text"
                                      className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                                      placeholder="Nueva etiqueta"
                                      value={labelInput}
                                      onChange={e => setLabelInput(e.target.value)}
                                      onKeyDown={e => { 
                                        if (e.key === 'Enter') { 
                                          e.preventDefault();
                                          handleRowLabelChange(row.original.id, labelInput); 
                                        } 
                                      }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <button
                                      className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap"
                                      onClick={e => { 
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleRowLabelChange(row.original.id, labelInput); 
                                      }}
                                    >
                                      Agregar
                                    </button>
                                  </div>
                                </div>
                              </DropdownPortal>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Add data-row-id for positioning reference */}
                    <div data-row-id={row.original.id} className="space-y-2">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Empresa: </span>
                        <span className="text-sm text-gray-900">{row.original.userName || ""}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Cliente: </span>
                        <span className="text-sm text-gray-900">
                          {row.original.client?.name ? 
                            `${row.original.client.name}${row.original.client.surname ? ' ' + row.original.client.surname : ''}` : 
                            row.original.userName || ""}
                        </span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Teléfono: </span>
                        <span className="text-sm text-gray-900">{row.original.client?.phone || ""}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Ciudad: </span>
                        <span className="text-sm text-gray-900">{row.original.client?.city || ""}</span>
                      </div>
                      
                      <div>
                        <span className="text-sm font-medium text-gray-700">Total: </span>
                        <span className="text-sm font-bold text-gray-900">
                          {(() => {
                            const totalRaw = parseOrderDetails(row.original.orderDetails).total || "";
                            const numeric = Number(totalRaw.replace(/[^\d]/g, ""));
                            return isNaN(numeric) ? "" : `$${numeric.toLocaleString("de-DE")}`;
                          })()}
                        </span>
                      </div>
                      
                      {row.original.fileUrl && row.original.fileName && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Archivo: </span>
                          <a 
                            href={row.original.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            {row.original.fileName}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                          {parseOrderDetails(row.original.orderDetails).tipo || ""}
                        </span>
                        {selectedRows[row.original.id] && (
                          <button
                            onClick={() => handleDelete(row.original.id)}
                            className="text-red-600 hover:text-red-700 p-1"
                            title="Eliminar"
                          >
                            <MdDelete className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-lg mb-2">
                    {showArchived ? 'No hay pedidos archivados' : 'No se encontraron submisiones'}
                  </div>
                  {showArchived && (
                    <div className="text-gray-400 text-sm">
                      No se encontraron pedidos archivados. Puedes volver a la vista normal haciendo clic en "Ocultar Archivados".
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>
            
            {/* Desktop View */}
            <div className="hidden md:block">
              <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
                
                {ordersLoading ? (
                  <div className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
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
                          <th className="w-28 px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                            Fecha
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
                                  order.fileName || `#${order.id}`
                                )}
                              </div>
                            </td>
                            <td className="w-32 px-2 py-4 whitespace-nowrap border border-gray-300">
                              <div className="text-sm font-medium text-gray-900">
                                {order.userName || 'N/A'}
                              </div>
                            </td>
                            <td className="w-40 px-2 py-4 whitespace-nowrap border border-gray-300">
                              <div className="text-sm font-medium text-gray-900">
                                <div className="flex flex-col">
                                  <span>{order.client?.name ? 
                                    `${order.client.name}${order.client.surname ? ' ' + order.client.surname : ''}` : 
                                    'N/A'}</span>
                                  <span className="text-purple-600 text-xs opacity-50">{order.client?.phone || ""}</span>
                                </div>
                              </div>
                            </td>
                            <td className="w-24 px-2 py-4 whitespace-nowrap border border-gray-300">
                              <div className="text-sm font-medium text-gray-900">
                                <div className="flex items-center">
                                  {/* Price type indicator */}
                                  {(() => {
                                    const tipo = parseOrderDetails(order.orderDetails).type || "";
                                    if (tipo.includes("Precio 1")) {
                                      return (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 mr-2">
                                          P1
                                        </span>
                                      );
                                    } else if (tipo.includes("Precio 2")) {
                                      return (
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 mr-2">
                                          P2
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                  <span>
                                    {(() => {
                                      // Calculate total from cartItems if available
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
                                      
                                      // Fallback to totalAmount field
                                      return formatCurrency(order.totalAmount || 0);
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="w-28 px-2 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300">
                              {formatDate(order.timestamp)}
                            </td>
                            <td className="w-32 px-2 py-4 whitespace-nowrap text-sm font-medium border border-gray-300">
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
                                  onClick={() => handleArchiveOrder(order.id)}
                                  className={`${order.archived ? 'text-cyan-600 bg-cyan-50' : 'text-gray-500 bg-gray-50'} hover:text-cyan-700 hover:bg-cyan-100 p-1 rounded transition-colors duration-200`}
                                  title={order.archived ? 'Desarchivar' : 'Archivar'}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </button>
                                
                                <button
                                  onClick={() => handleDelete(order.id)}
                                  className="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 p-1 rounded transition-colors duration-200"
                                  title="Eliminar"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                                
                                <select
                                  value={order.status === 'pending' ? 'new' : (order.status || 'new')}
                                  onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
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
                                  title={`Cambiar estado (actual: ${getStatusText(order.status === 'pending' ? 'new' : (order.status || 'new'))})`}
                                >
                                  <option value="new" style={{color: '#ea580c', fontWeight: '500', backgroundColor: '#fed7aa'}}>Nuevo</option>
                                  <option value="confirmed" style={{color: '#1d4ed8', fontWeight: '500', backgroundColor: '#dbeafe'}}>Confirmado</option>
                                  <option value="shipped" style={{color: '#7c3aed', fontWeight: '500', backgroundColor: '#f3e8ff'}}>En Camino</option>
                                  <option value="delivered" style={{color: '#15803d', fontWeight: '500', backgroundColor: '#dcfce7'}}>Entregado</option>
                                  <option value="cancelled" style={{color: '#dc2626', fontWeight: '500', backgroundColor: '#fee2e2'}}>Cancelado</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedOrder(null)}
        >
          <div 
            className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Pedido</h3>
                    <p className="text-sm text-gray-500">Detalles completos del pedido</p>
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
                  <h4 className="text-lg font-semibold text-gray-900">Productos ({getProductosArray(selectedOrder).length})</h4>
                </div>
                <div className="space-y-3">
                  {getProductosArray(selectedOrder).map((product, index) => (
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
                          <p className="font-bold text-gray-900 text-sm">{formatCurrency(product.price)}</p>
                          <p className="text-xs text-gray-500">Cantidad: {product.quantity}</p>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-2">
                        <p className="text-xs text-gray-600">
                          Subtotal: {formatCurrency(product.price * product.quantity)}
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
                    <p className="text-xs font-medium text-gray-600 mb-1">Fecha</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(selectedOrder.timestamp)}</p>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </div>
      )}

      {/* Mobile Account Section - Only visible on mobile */}
      <div className="block md:hidden mt-8">
        <div className="bg-white border-t border-gray-200 py-4">
          <div className="flex items-center justify-end gap-3">
            <span className="text-gray-800 font-medium truncate">{user.email}</span>
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