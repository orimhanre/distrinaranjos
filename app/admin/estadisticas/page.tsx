"use client";
import { useEffect, useState } from "react";
import { auth, googleProvider, db } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { collection, getDocs, DocumentData, deleteDoc, doc, query, orderBy, limit } from "firebase/firestore";
import dynamic from "next/dynamic";
import { useRouter } from 'next/navigation';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";
import { usePathname } from "next/navigation";

const ChartJSCharts = dynamic(() => import("./ChartJSCharts"), { 
  ssr: false,
  loading: () => (
    <div className="border-2 border-gray-300 bg-gray-50 p-4 rounded" style={{ minHeight: '400px' }}>
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Cargando gráficos...</p>
        </div>
      </div>
    </div>
  )
});

import { checkAdminPermission } from "@/lib/adminPermissions";

const TIME_RANGES = [
  { key: "week", label: "Semanal" },
  { key: "month", label: "Mensual" },
  { key: "year", label: "Anual" },
  { key: "5years", label: "5 años" },
];

// Helper to get ISO week number and ISO year
function getISOWeekAndYear(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Set to nearest Thursday: current date + 4 - current day number (Monday=1, Sunday=7)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week: weekNum, year: d.getUTCFullYear() };
}

function getPeriodKey(date: Date | string | number, range: string) {
  const d = new Date(date);
  if (range === "week") {
    // ISO week string: YYYY-Www (Monday-Sunday)
    const { week, year } = getISOWeekAndYear(d);
    return `${year}-S${String(week).padStart(2, "0")}`;
  }
  if (range === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (range === "year") {
    return `${d.getFullYear()}`;
  }
  if (range === "5years") {
    return `${Math.floor(d.getFullYear() / 5) * 5}-${Math.floor(d.getFullYear() / 5) * 5 + 4}`;
  }
  return "";
}

export default function EstadisticasPage() {
  useFirebaseAuthPersistence();
  // All hooks must be declared before any return
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [x1, setX1] = useState("month"); // week, month, year
  const [includeDeleted1, setIncludeDeleted1] = useState(false);
  const [x2, setX2] = useState("ciudad"); // ciudad, departamento
  const [includeDeleted2, setIncludeDeleted2] = useState(false);
  const [yLabel2, setYLabel2] = useState("Ciudad / Pueblo"); // or "Departamento"
  const [geoPeriod, setGeoPeriod] = useState("month"); // week, month, year
  const [orders1, setOrders1] = useState<DocumentData[]>([]);
  const [orders2, setOrders2] = useState<DocumentData[]>([]);
  const [summaryPeriod, setSummaryPeriod] = useState(x1);
  const [comparePeriods, setComparePeriods] = useState<string[]>([]); // for chart 1
  const [compareGeo, setCompareGeo] = useState<string[]>([]); // for chart 2
  const [chartType1, setChartType1] = useState("bar"); // bar, line, area
  const [chartType2, setChartType2] = useState("bar");
  const [productModal, setProductModal] = useState<{ open: boolean; productos: Record<string, number> | null; ciudad: string | null }>({ open: false, productos: null, ciudad: null });
  // State for including deleted orders in summary
  const [includeDeletedSummary, setIncludeDeletedSummary] = useState(false);
  // Independent state for summary table orders
  const [summaryOrdersRaw, setSummaryOrdersRaw] = useState<DocumentData[]>([]);
  const router = useRouter();
  const [showDenied, setShowDenied] = useState(false);
  const [periodDropdownOpen, setPeriodDropdownOpen] = useState(false);
  const [geoDropdownOpen, setGeoDropdownOpen] = useState(false);
  const pathname = usePathname();
  const [showStatistics, setShowStatistics] = useState(false);
  const [statisticsLoading, setStatisticsLoading] = useState(false);

  // Detect mobile device and client-side rendering
  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => {
      const mobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    // Only fetch orders data when user is actually on this page and toggle is enabled
    // Check if we're on the statistics page specifically
    if (pathname !== '/admin/estadisticas' || !showStatistics) return;
    
    async function fetchOrders1() {
      setStatisticsLoading(true);
      try {
        let allOrders = [];
        // Fetch all orders without limit
        const ordersQuery = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const ordersSnap = await getDocs(ordersQuery);
        allOrders = ordersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (includeDeleted1) {
          // Fetch all deleted orders without limit
          const deletedQuery = query(collection(db, "deleted_orders"), orderBy("timestamp", "desc"));
          const deletedSnap = await getDocs(deletedQuery);
          allOrders = allOrders.concat(deletedSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, deleted: true })));
        }
        setOrders1(allOrders);
      } catch (error) {
        console.error('Error fetching orders1:', error);
        setOrders1([]);
      } finally {
        setStatisticsLoading(false);
      }
    }
    fetchOrders1();
  }, [includeDeleted1, pathname, showStatistics]);

  useEffect(() => {
    // Only fetch orders data when user is actually on this page and toggle is enabled
    // Check if we're on the statistics page specifically
    if (pathname !== '/admin/estadisticas' || !showStatistics) return;
    
    async function fetchOrders2() {
      setStatisticsLoading(true);
      try {
        let allOrders = [];
        // Fetch all orders without limit
        const ordersQuery = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const ordersSnap = await getDocs(ordersQuery);
        allOrders = ordersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (includeDeleted2) {
          // Fetch all deleted orders without limit
          const deletedQuery = query(collection(db, "deleted_orders"), orderBy("timestamp", "desc"));
          const deletedSnap = await getDocs(deletedQuery);
          allOrders = allOrders.concat(deletedSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, deleted: true })));
        }
        setOrders2(allOrders);
      } catch (error) {
        console.error('Error fetching orders2:', error);
        setOrders2([]);
      } finally {
        setStatisticsLoading(false);
      }
    }
    fetchOrders2();
  }, [includeDeleted2, pathname, showStatistics]);

  useEffect(() => {
    // Only fetch orders data when user is actually on this page and toggle is enabled
    // Check if we're on the statistics page specifically
    if (pathname !== '/admin/estadisticas' || !showStatistics) return;
    
    async function fetchSummaryOrders() {
      setStatisticsLoading(true);
      try {
        let allOrders = [];
        // Fetch all orders without limit
        const ordersQuery = query(collection(db, "orders"), orderBy("timestamp", "desc"));
        const ordersSnap = await getDocs(ordersQuery);
        allOrders = ordersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        if (includeDeletedSummary) {
          // Fetch all deleted orders without limit
          const deletedQuery = query(collection(db, "deleted_orders"), orderBy("timestamp", "desc"));
          const deletedSnap = await getDocs(deletedQuery);
          const deletedOrders = deletedSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, deleted: true }));
          allOrders = allOrders.concat(deletedOrders);
          
          // Debug: log deleted orders structure
          if (typeof window !== 'undefined' && deletedOrders.length > 0) {
            console.log('DELETED ORDERS DEBUG:', deletedOrders.map((order: any) => ({
              id: order.id,
              hasCartItems: Array.isArray(order.cartItems) && order.cartItems.length > 0,
              hasProductos: !!order.productos,
              hasOrderDetails: !!order.orderDetails,
              cartItemsLength: Array.isArray(order.cartItems) ? order.cartItems.length : 0
            })));
          }
        }
        setSummaryOrdersRaw(allOrders);
      } catch (error) {
        console.error('Error fetching summary orders:', error);
        setSummaryOrdersRaw([]);
      } finally {
        setStatisticsLoading(false);
      }
    }
    fetchSummaryOrders();
  }, [includeDeletedSummary, pathname, showStatistics]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.dropdown-container')) {
        setPeriodDropdownOpen(false);
        setGeoDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Chart 1 data: group by week/month/year
  const periodData = (() => {
    const totals: Record<string, number> = {};
    orders1.forEach(order => {
      const ts = order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000) : new Date();
      const period = getPeriodKey(ts, x1);
      let total = 0;
      if (typeof order.orderDetails === 'string') {
        const match = order.orderDetails.match(/Total: ([\d.]+)/);
        if (match) total = parseFloat(match[1].replace(/\./g, "").replace(/,/g, "."));
      }
      totals[period] = (totals[period] || 0) + total;
    });
    const result = Object.entries(totals).map(([periodo, total]) => ({ periodo, total }));
    console.log('PeriodData generated:', result);
    return result;
  })();

  // Chart 2 data: group by ciudad/pueblo or departamento AND period
  const geoData = (() => {
    const totals: Record<string, Record<string, number>> = {};
    orders2.forEach(order => {
      let key = "";
      if (yLabel2 === "Ciudad / Pueblo") key = order?.client?.city || "Sin ciudad";
      else key = order?.client?.department || "Sin departamento";
      const ts = order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000) : new Date();
      const period = getPeriodKey(ts, geoPeriod);
      let total = 0;
      if (typeof order.orderDetails === 'string') {
        const match = order.orderDetails.match(/Total: ([\d.]+)/);
        if (match) total = parseFloat(match[1].replace(/\./g, "").replace(/,/g, "."));
      }
      if (!totals[key]) totals[key] = {};
      totals[key][period] = (totals[key][period] || 0) + total;
    });
    // Flatten to array: [{ ciudad/dep, periodo, total }]
    return Object.entries(totals).flatMap(([loc, periods]) =>
      Object.entries(periods).map(([periodo, total]) => ({
        [yLabel2 === "Ciudad / Pueblo" ? "ciudad" : "departamento"]: loc,
        periodo,
        total
      }))
    );
  })();

  // State for summary period selection
  // const [summaryPeriod, setSummaryPeriod] = useState(x1); // Moved to top

  // Authentication checks (early returns after all hooks)
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
          className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors duration-200"
          title="Cerrar sesión"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  // Don't render charts until client-side is ready
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="flex justify-end items-center gap-4 mb-8">
          <span className="text-gray-800 font-medium">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
          >
            Cerrar sesión
          </button>
        </div>
        <h1 className="text-5xl font-extrabold mb-10 text-red-700 uppercase tracking-tight drop-shadow-lg">Estadísticas</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Inicializando gráficos...</p>
          </div>
        </div>
      </div>
    );
  }

  // Summary data aggregation
  const summaryData = (() => {
    const periods: Record<string, {
      total: number;
      departamentos: Record<string, { total: number }>;
      ciudades: Record<string, { total: number; productos: Record<string, number> }>;
    }> = {};
    summaryOrdersRaw.forEach(order => {
      const ts = order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000) : new Date();
      const period = getPeriodKey(ts, summaryPeriod);
      let total = 0;
      if (typeof order.orderDetails === 'string') {
        const match = order.orderDetails.match(/Total: ([\d.]+)/);
        if (match) total = parseFloat(match[1].replace(/\./g, "").replace(/,/g, "."));
      }
      if (!periods[period]) {
        periods[period] = {
          total: 0,
          departamentos: {},
          ciudades: {},
        };
      }
      periods[period].total += total;
      // Departamento
      const departamento = order?.client?.department || "Sin departamento";
      if (!periods[period].departamentos[departamento]) {
        periods[period].departamentos[departamento] = { total: 0 };
      }
      periods[period].departamentos[departamento].total += total;
      // Ciudad
      const ciudad = order?.client?.city || "Sin ciudad";
      if (!periods[period].ciudades[ciudad]) {
        periods[period].ciudades[ciudad] = { total: 0, productos: {} };
      }
      periods[period].ciudades[ciudad].total += total;
      // Product names and quantities
      let foundProduct = false;
      if (Array.isArray(order?.cartItems) && order.cartItems.length > 0) {
        order.cartItems.forEach((item: any) => {
          // Try product.productName, then product.name, then item.productName
          const name = item.product?.productName || item.product?.name || item.productName || '';
          if (name && item.quantity) {
            periods[period].ciudades[ciudad].productos[name] =
              (periods[period].ciudades[ciudad].productos[name] || 0) + item.quantity;
            foundProduct = true;
          }
        });
      }
      // Fallback: try to parse product names from orderDetails if cartItems is missing/empty
      if (!foundProduct && typeof order.orderDetails === 'string') {
        const lines = order.orderDetails.split('\n');
        for (const line of lines) {
          if (/Total/i.test(line)) break; // Stop at 'Total' line
          if (/Cliente/i.test(line) || /Total/i.test(line)) continue; // Skip summary lines
          let match = line.match(/^(\d+) x ([^\n]+)/); // 2 x ProductoA
          if (match) {
            const qty = parseInt(match[1], 10);
            const name = match[2].trim();
            if (name && qty) {
              periods[period].ciudades[ciudad].productos[name] =
                (periods[period].ciudades[ciudad].productos[name] || 0) + qty;
            }
            continue;
          }
          match = line.match(/^([^\n]+) x(\d+)$/); // ProductoA x2
          if (match) {
            const name = match[1].trim();
            const qty = parseInt(match[2], 10);
            if (name && qty) {
              periods[period].ciudades[ciudad].productos[name] =
                (periods[period].ciudades[ciudad].productos[name] || 0) + qty;
            }
            continue;
          }
          match = line.match(/^([^\n]+): (\d+)$/); // ProductoA: 2
          if (match) {
            const name = match[1].trim();
            const qty = parseInt(match[2], 10);
            if (name && qty) {
              periods[period].ciudades[ciudad].productos[name] =
                (periods[period].ciudades[ciudad].productos[name] || 0) + qty;
            }
            continue;
          }
        }
      }
    });
    return periods;
  })();

  // Reset statistics handler
  async function handleResetStatistics() {
    // Delete all docs in both collections
    const ordersSnap = await getDocs(collection(db, "orders"));
    const deletedSnap = await getDocs(collection(db, "deleted_orders"));
    await Promise.all([
      ...ordersSnap.docs.map(d => deleteDoc(doc(db, "orders", d.id))),
      ...deletedSnap.docs.map(d => deleteDoc(doc(db, "deleted_orders", d.id)))
    ]);
  }

  // Get all available periods for dropdowns
  const allPeriods = Array.from(new Set(periodData.map(d => d.periodo))).sort();

  // Compare selections for each chart
  // const [comparePeriods, setComparePeriods] = useState<string[]>([]); // for chart 1
  // const [compareGeo, setCompareGeo] = useState<string[]>([]); // for chart 2

  // Chart 1: available periods
  const availablePeriods = Array.from(new Set(periodData.map(d => d.periodo))).sort();
  // Chart 2: available geo keys and periods
  const geoKey = yLabel2 === "Ciudad / Pueblo" ? "ciudad" : "departamento";
  const availableGeo = Array.from(new Set(geoData.map(d => String(d[geoKey])))).sort();
  const availableGeoPeriods = Array.from(new Set(geoData.map(d => d.periodo))).sort();

  // Filtered data for comparison
  const filteredPeriodData = comparePeriods.length > 0 ? periodData.filter(d => comparePeriods.includes(d.periodo)) : periodData;
  const filteredGeoData = geoData.filter(d =>
    (compareGeo.length === 0 || compareGeo.includes(String(d[geoKey]))) &&
    d.periodo === getPeriodKey(new Date(), geoPeriod) // Only show for selected period
  );

  // Chart type state for each chart
  // const [chartType1, setChartType1] = useState("bar"); // bar, line, area
  // const [chartType2, setChartType2] = useState("bar");

  // Add state for modal
  // const [productModal, setProductModal] = useState<{ open: boolean; productos: Record<string, number> | null; ciudad: string | null }>({ open: false, productos: null, ciudad: null });

  // Use summaryOrdersRaw for the summary table
  const summaryOrders = summaryOrdersRaw.map(order => {
    const ts = order.timestamp?.seconds ? new Date(order.timestamp.seconds * 1000) : new Date();
    const period = getPeriodKey(ts, summaryPeriod);
    let total = 0;
    
    // Primary method: Parse from orderDetails string (most reliable)
    if (typeof order.orderDetails === 'string') {
      const match = order.orderDetails.match(/Total: ([\d.]+)/);
      if (match) {
        total = parseFloat(match[1].replace(/\./g, "").replace(/,/g, "."));
      }
    }
    // Fallback: Try cartItems calculation (but prices might not be available)
    else if (Array.isArray(order.cartItems) && order.cartItems.length > 0) {
      total = order.cartItems.reduce((sum, item) => {
        // Check if prices are available in the product object
        const price1 = item.product?.price1;
        const price2 = item.product?.price2;
        const selectedPrice = item.selectedPrice;
        
        if (price1 !== undefined && price2 !== undefined) {
          const price = selectedPrice === 'price1' ? price1 : price2;
          return sum + (price * item.quantity);
        }
        return sum; // Skip if prices not available
      }, 0);
    }
    
    const departamento = order?.client?.department || "Sin departamento";
    const ciudad = order?.client?.city || "Sin ciudad";
    let productos: Record<string, number> = {};
    
    // Enhanced product extraction for both regular and deleted orders
    // 1. Try cartItems array (most reliable for regular orders)
    if (Array.isArray(order.cartItems) && order.cartItems.length > 0) {
      order.cartItems.forEach((item: any) => {
        // Handle different product name fields that might exist
        const name = item.product?.productName || 
                    item.product?.name || 
                    item.productName || 
                    item.name || 
                    item.product?.product?.name || // Nested product structure
                    '';
        if (name && item.quantity) {
          productos[name] = (productos[name] || 0) + item.quantity;
        }
      });
    }
    // 2. Try productos as object (sometimes directly stored)
    else if (order.productos && typeof order.productos === 'object' && !Array.isArray(order.productos)) {
      productos = { ...order.productos };
    }
    // 3. Try productos as stringified JSON
    else if (order.productos && typeof order.productos === 'string') {
      try {
        // Check if the string looks like JSON before parsing
        const trimmed = order.productos.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const parsed = JSON.parse(order.productos);
          if (parsed && typeof parsed === 'object') {
            productos = { ...parsed };
          }
        }
      } catch (error) {
        // Silently ignore JSON parse errors
        console.warn('Failed to parse productos JSON:', error);
      }
    }
    // 4. Try parsing orderDetails string (fallback for deleted orders)
    else if (typeof order.orderDetails === 'string') {
      const lines = order.orderDetails.split('\n');
      for (const line of lines) {
        if (/Total/i.test(line)) break;
        if (/Cliente/i.test(line) || /Total/i.test(line)) continue;
        
        // Try different patterns for product extraction
        let match = line.match(/^(\d+) x ([^\n]+)/);
        if (match) {
          const qty = parseInt(match[1], 10);
          const name = match[2].trim();
          if (name && qty) productos[name] = (productos[name] || 0) + qty;
          continue;
        }
        
        match = line.match(/^([^\n]+) x(\d+)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10);
          if (name && qty) productos[name] = (productos[name] || 0) + qty;
          continue;
        }
        
        match = line.match(/^([^\n]+): (\d+)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10);
          if (name && qty) productos[name] = (productos[name] || 0) + qty;
          continue;
        }
        
        // Additional pattern for product names with dashes or special characters
        match = line.match(/^([^-]+) - (\d+)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10);
          if (name && qty) productos[name] = (productos[name] || 0) + qty;
          continue;
        }
      }
    }
    
    // 5. Additional fallback: try to extract from any remaining data structures
    if (Object.keys(productos).length === 0) {
      // Check if there's any product information in the order structure
      if (order.productos && Array.isArray(order.productos)) {
        order.productos.forEach((item: any) => {
          const name = item.name || item.productName || '';
          const qty = item.quantity || 1;
          if (name) productos[name] = (productos[name] || 0) + qty;
        });
      }
    }
    // Debug: log the order and extracted productos for troubleshooting
    if (typeof window !== 'undefined') {
      console.log('SUMMARY ORDER DEBUG:', { 
        orderId: order.id, 
        isDeleted: order.deleted || false,
        hasCartItems: Array.isArray(order.cartItems) && order.cartItems.length > 0,
        hasProductos: !!order.productos,
        hasOrderDetails: !!order.orderDetails,
        productos: productos,
        total: total 
      });
    }
    return { period, total, departamento, ciudad, productos };
  });

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
      <h1 className="text-4xl font-bold mb-8 text-gray-900">Estadísticas</h1>
      
      {/* Statistics Toggle */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-medium text-gray-700">Mostrar estadísticas:</span>
        <button
          onClick={() => setShowStatistics(!showStatistics)}
          disabled={statisticsLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${
            showStatistics ? 'bg-green-600' : 'bg-gray-200'
          } ${statisticsLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              showStatistics ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <span className="text-sm text-gray-600">
          {showStatistics ? 'Activado' : 'Desactivado'}
        </span>
        {statisticsLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
        )}
      </div>
      
      {!showStatistics ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-xl mb-2">Toggle desactivado</div>
          <div className="text-gray-400 text-sm">Activa el toggle para ver las estadísticas</div>
        </div>
      ) : (
        <>
          {/* Chart 1 controls */}
          <h2 className="text-2xl sm:text-3xl font-extrabold text-blue-700 mb-6 mt-6 tracking-tight drop-shadow">Gráfico de Total Precio</h2>
      <div className="mb-4 flex flex-col sm:flex-row sm:gap-4 gap-2 items-stretch sm:items-center flex-wrap">
        <label className="font-medium text-black w-full sm:w-auto">Total Precio por:</label>
        <select
          value={x1}
          onChange={e => { setX1(e.target.value); setComparePeriods([]); }}
          className="border rounded px-2 py-1 bg-blue-100 text-black w-full sm:w-auto"
        >
          <option value="week">Semana</option>
          <option value="month">Mes</option>
          <option value="year">Año</option>
        </select>
        <label className="flex items-center gap-2 text-black w-full sm:w-auto">
          <input
            type="checkbox"
            checked={includeDeleted1}
            onChange={e => setIncludeDeleted1(e.target.checked)}
            className="accent-red-600"
          />
          Incluir Pedidos Eliminados
        </label>
        <label className="font-medium text-black w-full sm:w-auto">Comparar períodos:</label>
        <div className="min-w-[200px] max-w-[350px]">
          <div className="relative dropdown-container">
            <button
              onClick={() => setPeriodDropdownOpen(!periodDropdownOpen)}
              className="w-full border rounded px-3 py-2 bg-pink-100 text-black text-left flex items-center justify-between hover:bg-pink-200 transition-colors"
            >
              <span className="text-sm">
                {comparePeriods.length > 0 
                  ? `${comparePeriods.length} seleccionado(s)` 
                  : "📅 Seleccionar períodos"}
              </span>
              <svg className={`w-4 h-4 transition-transform ${periodDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {periodDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 border rounded bg-white shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs text-gray-600 mb-2 font-medium">📅 Selecciona períodos para comparar:</div>
                  {availablePeriods.map((p) => (
                    <label key={p} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-pink-50 px-1 rounded">
                      <input
                        type="checkbox"
                        checked={comparePeriods.includes(p)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setComparePeriods([...comparePeriods, p]);
                          } else {
                            setComparePeriods(comparePeriods.filter(period => period !== p));
                          }
                        }}
                        className="accent-pink-600"
                      />
                      <span className="text-xs text-black">{p}</span>
                    </label>
                  ))}
                  {availablePeriods.length > 8 && (
                    <div className="text-xs text-gray-500 mt-2 text-center border-t pt-2">
                      📜 Desplázate para ver más opciones
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {comparePeriods.length > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              ✅ Seleccionados: {comparePeriods.join(', ')}
            </div>
          )}
        </div>
        <div className="flex-1 hidden sm:block" />
        <label className="font-medium text-black w-full sm:w-auto">Tipo de gráfico:</label>
        <select
          value={chartType1}
          onChange={e => setChartType1(e.target.value)}
          className="border rounded px-2 py-1 bg-yellow-100 text-black w-full sm:w-auto"
        >
          <option value="bar">Barra</option>
          <option value="line">Línea</option>
          <option value="area">Área</option>
        </select>
      </div>
      <ChartJSCharts chartData={filteredPeriodData} xKey="periodo" xLabel={x1 === "week" ? "Semana" : x1 === "month" ? "Mes" : "Año"} yLabel={`Total Precio por ${x1 === "week" ? "Semana" : x1 === "month" ? "Mes" : "Año"}`} 
        colorPalette={
          x1 === "week"
            ? ["#A7F3D0", "#6EE7B7", "#34D399", "#10B981", "#047857"] // greens
            : x1 === "month"
            ? ["#BFDBFE", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8"] // blues
            : ["#DDD6FE", "#A78BFA", "#8B5CF6", "#7C3AED", "#6D28D9"] // purples
        }
        chartType={chartType1}
      />
      <div className="block sm:hidden my-8">
        <hr className="border-t-4 border-dashed border-gray-400 shadow-md rounded-full" />
      </div>
      {/* Chart 2 controls */}
      <h2 className="text-2xl sm:text-3xl font-extrabold text-purple-700 mb-6 mt-10 tracking-tight drop-shadow">Gráfico por Ciudad/Departamento</h2>
      <div className="mb-4 flex flex-col sm:flex-row sm:gap-4 gap-2 items-stretch sm:items-center flex-wrap">
        <label className="font-medium text-black w-full sm:w-auto">Total Precio por:</label>
        <select
          value={yLabel2}
          onChange={e => { setYLabel2(e.target.value); setCompareGeo([]); }}
          className="border rounded px-2 py-1 bg-blue-100 text-black w-full sm:w-auto"
        >
          <option value="Ciudad / Pueblo">Ciudad / Pueblo</option>
          <option value="Departamento">Departamento</option>
        </select>
        {/* Período section - now before Incluir Pedidos Eliminados */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 w-full sm:w-auto">
          <label className="font-medium text-black w-full sm:w-auto">Período:</label>
          <select
            value={geoPeriod}
            onChange={e => setGeoPeriod(e.target.value)}
            className="border rounded px-2 py-1 bg-green-100 text-black w-full sm:w-auto sm:ml-2"
          >
            <option value="week">Semana</option>
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-black w-full sm:w-auto">
          <input
            type="checkbox"
            checked={includeDeleted2}
            onChange={e => setIncludeDeleted2(e.target.checked)}
            className="accent-red-600"
          />
          Incluir Pedidos Eliminados
        </label>
        <label className="font-medium text-black w-full sm:w-auto">Comparar:</label>
        <div className="min-w-[200px] max-w-[350px]">
          <div className="relative dropdown-container">
            <button
              onClick={() => setGeoDropdownOpen(!geoDropdownOpen)}
              className="w-full border rounded px-3 py-2 bg-purple-100 text-black text-left flex items-center justify-between hover:bg-purple-200 transition-colors"
            >
              <span className="text-sm">
                {compareGeo.length > 0 
                  ? `${compareGeo.length} seleccionado(s)` 
                  : "📍 Seleccionar ubicaciones"}
              </span>
              <svg className={`w-4 h-4 transition-transform ${geoDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {geoDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 border rounded bg-white shadow-lg max-h-60 overflow-y-auto">
                <div className="p-2">
                  <div className="text-xs text-gray-600 mb-2 font-medium">📍 Selecciona ubicaciones para comparar:</div>
                  {availableGeo.map((g) => (
                    <label key={g} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-purple-50 px-1 rounded">
                      <input
                        type="checkbox"
                        checked={compareGeo.includes(g)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setCompareGeo([...compareGeo, g]);
                          } else {
                            setCompareGeo(compareGeo.filter(geo => geo !== g));
                          }
                        }}
                        className="accent-purple-600"
                      />
                      <span className="text-xs text-black">{g}</span>
                    </label>
                  ))}
                  {availableGeo.length > 8 && (
                    <div className="text-xs text-gray-500 mt-2 text-center border-t pt-2">
                      📜 Desplázate para ver más opciones
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          {compareGeo.length > 0 && (
            <div className="text-xs text-gray-600 mt-1">
              ✅ Seleccionados: {compareGeo.join(', ')}
            </div>
          )}
        </div>
        <div className="flex-1 hidden sm:block" />
        <label className="font-medium text-black w-full sm:w-auto">Tipo de gráfico:</label>
        <select
          value={chartType2}
          onChange={e => setChartType2(e.target.value)}
          className="border rounded px-2 py-1 bg-yellow-100 text-black w-full sm:w-auto"
        >
          <option value="bar">Barra</option>
          <option value="line">Línea</option>
          <option value="area">Área</option>
        </select>
      </div>
      <ChartJSCharts chartData={filteredGeoData} xKey={geoKey} xLabel={yLabel2} yLabel={`Total Precio por ${yLabel2}`} colorPalette={["#DDD6FE", "#FDBA74", "#FDE2E4", "#FCA5A5", "#FEF9C3"]} chartType={chartType2} />
      <div className="block sm:hidden my-8">
        <hr className="border-t-4 border-dashed border-gray-400 shadow-md rounded-full" />
      </div>
          {/* Summary Sheet */}
          <div className="mt-16">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-green-700 mb-6 mt-10 tracking-tight drop-shadow">Resumen de Pedidos</h2>
            <div className="mb-4 flex flex-col sm:flex-row sm:gap-4 gap-2 items-stretch sm:items-center flex-wrap">
              <label className="font-medium text-black w-full sm:w-auto">Resumen por:</label>
              <select
                value={summaryPeriod}
                onChange={e => setSummaryPeriod(e.target.value)}
                className="border rounded px-2 py-1 bg-blue-100 text-black w-full sm:w-auto"
              >
                <option value="week">Semana</option>
                <option value="month">Mes</option>
                <option value="year">Año</option>
              </select>
              <label className="flex items-center gap-2 text-black w-full sm:w-auto">
                <input
                  type="checkbox"
                  checked={includeDeletedSummary}
                  onChange={e => setIncludeDeletedSummary(e.target.checked)}
                  className="accent-red-600"
                />
                Incluir Pedidos Eliminados
              </label>
            </div>
            <div className="overflow-x-auto bg-white rounded-b shadow p-4">
              <table className="min-w-full text-sm text-black">
                <thead>
                  <tr>
                    <th className="px-1 py-1 text-center align-middle font-bold text-black text-xs">Período</th>
                    <th className="px-1 py-1 text-center align-middle font-bold text-black text-xs">Total Precio</th>
                    <th className="px-1 py-1 text-center align-middle font-bold text-black text-xs">Dept.</th>
                    <th className="px-1 py-1 text-center align-middle font-bold text-black text-xs">Ciudad / Pueblo</th>
                    <th className="px-1 py-1 text-center align-middle font-bold text-black text-xs">Productos</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryOrders.map((order, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-1 py-1 text-center align-middle text-xs">{order.period}</td>
                      <td className="px-1 py-1 font-bold text-center align-middle text-xs">{order.total?.toLocaleString("de-DE") ?? "-"}</td>
                      <td className="px-1 py-1 text-center align-middle text-xs">{order.departamento}</td>
                      <td className="px-1 py-1 text-center align-middle text-xs">{order.ciudad}</td>
                      <td className="px-1 py-1 text-center align-middle text-xs">
                        {Object.keys(order.productos).length > 0 ? (
                          <button
                            className="text-blue-600 underline hover:text-blue-800 font-medium"
                            onClick={() => setProductModal({ open: true, productos: order.productos, ciudad: order.ciudad })}
                          >
                            Ver productos ({Object.keys(order.productos).length})
                          </button>
                        ) : (
                          <span className="text-red-500">No hay datos de productos</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Summary row for total */}
                  <tr className="bg-gray-100 font-bold">
                    <td className="px-1 py-1 text-center align-middle text-xs"></td>
                    <td className="px-1 py-1 text-red-700 font-bold text-xl text-center align-middle text-xs">
                      {summaryOrders.reduce((sum, order) => sum + (typeof order.total === 'number' ? order.total : 0), 0).toLocaleString('de-DE')}
                    </td>
                    <td className="px-1 py-1 text-center align-middle text-xs"></td>
                    <td className="px-1 py-1 text-center align-middle text-xs"></td>
                    <td className="px-1 py-1 text-center align-middle text-xs"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
    {productModal.open && (
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative">
          <button
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-xl font-bold"
            onClick={() => setProductModal({ open: false, productos: null, ciudad: null })}
            aria-label="Cerrar"
          >
            ×
          </button>
          <h3 className="text-lg font-bold mb-4">Productos {productModal.ciudad ? `- ${productModal.ciudad}` : ''}</h3>
          <div className="max-h-80 overflow-y-auto">
            {productModal.productos && Object.keys(productModal.productos as Record<string, number>).length > 0 ? (
              <ul className="list-disc pl-5 space-y-1 text-black">
                {Object.entries(productModal.productos as Record<string, number>).map(([name, qty]) => (
                  <li key={name}><span className="font-semibold">{qty}</span> x {name}</li>
                ))}
              </ul>
            ) : (
              <div className="text-black">No hay productos para mostrar.</div>
            )}
          </div>
        </div>
      </div>
    )}

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
        </>
      )}
    </div>
  );
} 