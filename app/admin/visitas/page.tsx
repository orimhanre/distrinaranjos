"use client";

import { collection, getDocs, deleteDoc, doc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import React, { useEffect, useState } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { checkAdminPermission } from '@/lib/adminPermissions';
import { useRouter } from 'next/navigation';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";
import { usePathname } from 'next/navigation';

export default function AdminVisitasPage() {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [visits, setVisits] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(25);
  const [showDenied, setShowDenied] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [previousCounts, setPreviousCounts] = useState({ week: 0, month: 0, year: 0 });
  const [hasReset, setHasReset] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState<boolean | undefined>(undefined);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [visitsLoading, setVisitsLoading] = useState(false);
  
  // Load reset state from localStorage on component mount
  useEffect(() => {
    const savedCounts = localStorage.getItem('visitantes_previous_counts');
    const resetState = localStorage.getItem('visitantes_has_reset');
    
    if (savedCounts && resetState === 'true') {
      setPreviousCounts(JSON.parse(savedCounts));
      setHasReset(true);
    }
  }, []);
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
    
    // Fetch tracking state when user has permission
    if (pathname === '/admin/visitas') {
      fetchTrackingState();
    }
    
    // Only fetch visits data when user is actually on this page and toggle is enabled
    // Check if we're on the visits page specifically
    if (pathname === '/admin/visitas' && trackingEnabled) {
      async function fetchVisits() {
        setVisitsLoading(true);
        try {
          const snap = await getDocs(collection(db, 'visits'));
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // @ts-ignore
          data.sort((a, b) => ((b.timestamp && b.timestamp.seconds) ? b.timestamp.seconds : 0) - ((a.timestamp && a.timestamp.seconds) ? a.timestamp.seconds : 0));
          setVisits(data);
          
          // If we have new visits and we were in reset state, clear the reset state
          if (data.length > 0 && hasReset) {
            setHasReset(false);
            setPreviousCounts({ week: 0, month: 0, year: 0 });
            localStorage.removeItem('visitantes_previous_counts');
            localStorage.removeItem('visitantes_has_reset');
          }
        } catch (error) {
          console.error('Error fetching visits:', error);
          setVisits([]);
        } finally {
          setVisitsLoading(false);
        }
      }
      fetchVisits();
    } else if (!trackingEnabled) {
      // Clear data when toggle is disabled
      setVisits([]);
      setVisitsLoading(false);
    }
  }, [user, hasPermission, hasReset, pathname, trackingEnabled]);

  // Fetch tracking state when user has permission
  useEffect(() => {
    if (hasPermission) {
      fetchTrackingState();
    }
  }, [hasPermission]);

  // Add global error handler for unhandled promise rejections
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      // Prevent the default browser behavior
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  // Fetch tracking state
  const fetchTrackingState = async () => {
    try {
      const response = await fetch('/api/tracking-toggle');
      if (response.ok) {
        const data = await response.json();
        setTrackingEnabled(data.enabled);
      } else {
        console.error('Failed to fetch tracking state:', response.status);
        // Don't change the state on error - keep current state
        // This prevents the toggle from switching unexpectedly
      }
    } catch (error: any) {
      console.error('Error fetching tracking state:', error);
      // Don't change the state on error - keep current state
      // This prevents the toggle from switching unexpectedly
    }
  };

  // Toggle tracking state
  const handleTrackingToggle = async () => {
    if (trackingLoading) return; // Prevent multiple clicks
    
    setTrackingLoading(true);
    try {
      const newState = !trackingEnabled;
      const response = await fetch('/api/tracking-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState })
      });
      
      if (response.ok) {
        const data = await response.json();
        setTrackingEnabled(data.enabled);
      } else {
        const errorText = await response.text();
        console.error('Failed to update tracking state:', response.status, errorText);
        // Show user-friendly error
        alert('Error al actualizar el estado de seguimiento. Por favor, inténtalo de nuevo.');
      }
    } catch (error: any) {
      console.error('Error updating tracking state:', error);
      // Show user-friendly error
      alert('Error de conexión. Por favor, verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setTrackingLoading(false);
    }
  };

  async function handleResetVisitantes() {
    setResetting(true);
    try {
      // Store current counts before reset
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      const currentWeekCount = visits.filter(v => {
        const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
        return ts && ts >= startOfWeek;
      }).length;
      const currentMonthCount = visits.filter(v => {
        const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
        return ts && ts >= startOfMonth;
      }).length;
      const currentYearCount = visits.filter(v => {
        const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
        return ts && ts >= startOfYear;
      }).length;
      
      // Store the counts before deleting records
      const countsToSave = { week: currentWeekCount, month: currentMonthCount, year: currentYearCount };
      setPreviousCounts(countsToSave);
      setHasReset(true);
      
      // Save to localStorage to persist across page refreshes
      localStorage.setItem('visitantes_previous_counts', JSON.stringify(countsToSave));
      localStorage.setItem('visitantes_has_reset', 'true');
      
      // Delete all visit records
      const snap = await getDocs(collection(db, 'visits'));
      await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'visits', d.id))));
      
      // Refresh visits list to show empty state
      const newSnap = await getDocs(collection(db, 'visits'));
      const data = newSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      data.sort((a, b) => ((b.timestamp && b.timestamp.seconds) ? b.timestamp.seconds : 0) - ((a.timestamp && a.timestamp.seconds) ? a.timestamp.seconds : 0));
      setVisits(data);
    } catch (err: any) {
      alert('Error al resetear visitantes: ' + (err?.message || String(err)));
    } finally {
      setResetting(false);
      setShowConfirmReset(false);
    }
  }

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

  const visibleVisits = visits.slice(0, visibleCount);
  const hasMore = visibleCount < visits.length;

  // Calculate summary counts
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  // Use previous counts if reset was performed, otherwise calculate from current visits
  const weekCount = hasReset ? previousCounts.week : visits.filter(v => {
    const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
    return ts && ts >= startOfWeek;
  }).length;
  const monthCount = hasReset ? previousCounts.month : visits.filter(v => {
    const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
    return ts && ts >= startOfMonth;
  }).length;
  const yearCount = hasReset ? previousCounts.year : visits.filter(v => {
    const ts = v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000) : null;
    return ts && ts >= startOfYear;
  }).length;

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

      {/* Move reset button to top right above the list */}
      {showConfirmReset && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 max-w-sm w-full flex flex-col items-center">
            <h2 className="text-lg sm:text-xl font-bold mb-4 text-red-700 text-center">¿Eliminar todos los registros?</h2>
            <p className="mb-4 text-gray-700 text-center text-sm sm:text-base">Esta acción eliminará <b>todos</b> los registros de visitantes. ¿Estás seguro?</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full">
              <button
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 px-4 rounded text-sm sm:text-base w-full sm:w-auto"
                onClick={() => setShowConfirmReset(false)}
                disabled={resetting}
              >
                Cancelar
              </button>
              <button
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
                onClick={handleResetVisitantes}
                disabled={resetting}
              >
                {resetting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4 mb-4 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
          <h1 className="text-2xl md:text-4xl font-extrabold text-blue-700 tracking-tight drop-shadow">Registros de Visitantes</h1>
        </div>
      </div>
      {loading ? (
        <div className="text-center text-gray-500 text-lg">Cargando registros...</div>
      ) : (
        <>
          {/* Summary Box */}
          <div className="mb-4 md:mb-6 w-full max-w-2xl bg-blue-50 border border-blue-200 rounded-xl shadow flex flex-col gap-2 p-3 md:p-4 text-blue-900 items-start ml-0">
            <div className="text-base md:text-lg font-bold flex items-center gap-2">
              <span className="text-xl md:text-2xl">👥</span> Visitantes
            </div>
            <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 md:gap-6 text-sm md:text-base font-semibold">
              <span>Esta semana: <span className="font-bold text-blue-700">{weekCount}</span></span>
              <span>Este mes: <span className="font-bold text-green-700">{monthCount}</span></span>
              <span>Este año: <span className="font-bold text-orange-600">{yearCount}</span></span>
            </div>
            {/* Tracking Status */}
            <div className="flex items-center gap-2 mt-2 text-sm">
              <span className="font-medium">Estado del seguimiento:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                trackingEnabled 
                  ? 'bg-green-100 text-green-800 border border-green-200' 
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}>
                {trackingEnabled ? '🟢 Activado' : '🔴 Desactivado'}
              </span>
            </div>
          </div>
          {/* Tracking toggle and reset buttons */}
          {hasPermission && trackingEnabled !== undefined && (
            <div className="flex justify-between items-center mb-2">
              {/* Tracking Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Seguimiento de visitas:</span>
                <button
                  onClick={handleTrackingToggle}
                  disabled={trackingLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    trackingEnabled ? 'bg-blue-600' : 'bg-gray-200'
                  } ${trackingLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      trackingEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                  {trackingLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    </div>
                  )}
                </button>
                <span className={`text-sm font-medium ${trackingEnabled ? 'text-green-600' : 'text-red-600'}`}>
                  {trackingEnabled ? 'Activado' : 'Desactivado'}
                </span>
                {trackingLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
              
              {/* Reset button */}
              {trackingEnabled && (
                <button
                  className="flex items-center gap-1 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-red-600 hover:to-yellow-400 text-white font-bold py-1 px-3 rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed animate-pulse text-sm"
                  onClick={() => setShowConfirmReset(true)}
                  disabled={resetting}
                  style={{ boxShadow: '0 2px 8px 0 rgba(255, 87, 34, 0.12)' }}
                  title="Eliminar todos los visitantes"
                >
                  <span className="text-sm">🗑️</span>
                  {resetting ? 'Eliminando...' : 'Eliminar Registros'}
                </button>
              )}
            </div>
          )}
          <div className="overflow-x-auto bg-white rounded shadow p-2 sm:p-4">
            {!trackingEnabled ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">Seguimiento desactivado</div>
                <div className="text-gray-400 text-sm">Activa el seguimiento para ver los datos de visitas</div>
              </div>
            ) : visitsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
                <div className="text-gray-500">Cargando datos de visitas...</div>
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500 text-lg mb-2">No hay datos de visitas</div>
                <div className="text-gray-400 text-sm">Los datos aparecerán cuando haya visitas registradas</div>
              </div>
            ) : (
              <table className="min-w-full text-xs sm:text-sm text-black">
                <thead>
                  <tr>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">#</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Fecha</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Dispositivo</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">OS</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Navegador</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Idioma</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Pantalla</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">IP</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">Ciudad</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">País</th>
                    <th className="px-1 sm:px-2 py-2 text-center font-bold">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleVisits.map((v, idx) => (
                    <tr key={v.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle font-bold text-blue-700">{idx + 1}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.timestamp?.seconds ? new Date(v.timestamp.seconds * 1000).toLocaleString() : '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.deviceType || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.os || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.browser || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.language || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.screen ? `${v.screen.width}x${v.screen.height}` : '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.ip || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.geo?.city || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle break-words">{v.geo?.country_name || v.geo?.country || '-'}</td>
                      <td className="px-1 sm:px-2 py-2 text-center align-middle max-w-xs truncate" title={v.userAgent}>
                        <div className="flex items-center justify-center gap-1">
                          <span>
                            {v.userAgent
                              ? v.userAgent.length > 30
                                ? v.userAgent.slice(0, 30) + '...'
                                : v.userAgent
                              : '-'}
                          </span>
                          {v.userAgent && (
                            <CopyUserAgentButton userAgent={v.userAgent} />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {trackingEnabled && hasMore && (
            <div className="flex justify-center mt-4 md:mt-6">
              <button
                className="px-4 md:px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow hover:bg-blue-700 transition text-sm md:text-base w-full sm:w-auto"
                onClick={() => setVisibleCount(visibleCount + 25)}
              >
                Cargar más
              </button>
            </div>
          )}
        </>
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
    </div>
  );
}

// Copy button component for User Agent
function CopyUserAgentButton({ userAgent }: { userAgent: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(userAgent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-1 px-1 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-xs text-gray-700 border border-gray-300 focus:outline-none"
      title="Copiar User Agent completo"
      type="button"
      style={{ minWidth: 22 }}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
} 