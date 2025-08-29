"use client";
import { useEffect, useState } from "react";
import { virtualAuth, virtualGoogleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { checkVirtualAdminPermission } from "@/lib/adminPermissions";
import { useRouter } from 'next/navigation';

export default function VirtualPermisosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [admins, setAdmins] = useState<Array<{id: string, email: string, addedAt: string}>>([]);
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showDenied, setShowDenied] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const router = useRouter();

  // Simple UI toggle - no Firebase persistence needed
  const toggleShowAdmins = () => {
    setShowAdmins(!showAdmins);
  };

  useEffect(() => {
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      return;
    }
    const unsubscribe = onAuthStateChanged(virtualAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.email) {
      setPermissionLoading(true);
      checkVirtualAdminPermission(user.email).then((result) => {
        setHasPermission(result);
        setPermissionLoading(false);
      });
    } else {
      setHasPermission(false);
      setPermissionLoading(false);
    }
  }, [user]);



  const fetchAdmins = async () => {
    if (!showAdmins) return;
    
    setAdminsLoading(true);
    try {
      const response = await fetch('/api/admin/virtual-permissions');
      const data = await response.json();
      if (data.success) {
        setAdmins(data.admins);
      }
    } catch (error) {
      console.error('Error fetching admins:', error);
    } finally {
      setAdminsLoading(false);
    }
  };

  useEffect(() => {
    // Always allow authentication, only control data fetching
    if (hasPermission && showAdmins) {
      fetchAdmins();
    } else if (!showAdmins) {
      // Clear data when toggle is disabled, but keep authentication
      setAdmins([]);
      setAdminsLoading(false);
    }
  }, [hasPermission, showAdmins]);

  const handleLogin = async () => {
    if (!virtualAuth || !virtualGoogleProvider) {
      console.error('Virtual auth not available');
      return;
    }
    await signInWithPopup(virtualAuth, virtualGoogleProvider);
  };

  const handleLogout = async () => {
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      return;
    }
    await signOut(virtualAuth);
  };

  const addAdmin = async () => {
    if (!newEmail.trim()) return;
    
    console.log('=== ADDING VIRTUAL ADMIN ===');
    console.log('Email to add:', newEmail.trim());
    
    try {
      console.log('Making POST request to /api/admin/virtual-permissions');
      const response = await fetch('/api/admin/virtual-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.success) {
        console.log('Admin added successfully');
        setMessage({ type: 'success', text: 'Admin agregado exitosamente' });
        setNewEmail("");
        fetchAdmins();
      } else {
        console.log('Error adding admin:', data.error);
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Exception in addAdmin:', error);
      setMessage({ type: 'error', text: 'Error al agregar admin' });
    }
  };

  const removeAdmin = async (email: string) => {
    try {
      console.log('Removing admin with email:', email); // Debug log
      const response = await fetch('/api/admin/virtual-permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      console.log('Delete response:', data); // Debug log
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Admin removido exitosamente' });
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      console.error('Error in removeAdmin:', error); // Debug log
      setMessage({ type: 'error', text: 'Error al remover admin' });
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4 text-black">Inicio de Sesión de Administrador Virtual</h1>
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
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* User Info and Navigation */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Admin Virtual</p>
                <p className="text-xs text-gray-500 break-words">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center">
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

        <div className="mb-4 sm:mb-6">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">Gestión de Permisos de Administrador Virtual</h1>
        </div>
        
        {/* Admins Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Mostrar administradores:</span>
              <button
                onClick={toggleShowAdmins}
                disabled={adminsLoading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showAdmins ? 'bg-blue-600' : 'bg-gray-200'
                } ${adminsLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showAdmins ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-600">
                {showAdmins ? 'Activado' : 'Desactivado'}
              </span>
            </div>
            {adminsLoading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">Cargando...</span>
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 sm:p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex-1 text-sm sm:text-base">{message.text}</span>
              <button 
                onClick={() => setMessage(null)}
                className="text-lg font-bold hover:opacity-70 transition-opacity flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {showAdmins && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-base md:text-lg font-bold mb-3 sm:mb-4 text-black">Agregar Nuevo Administrador Virtual</h2>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email del nuevo administrador virtual"
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base text-black"
              />
              <button
                onClick={addAdmin}
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 font-semibold text-sm sm:text-base w-full sm:w-auto"
              >
                Agregar
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-3 sm:mb-4 text-black">Administradores Virtuales Actuales</h3>
          {!showAdmins ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg mb-2">Toggle desactivado</div>
              <div className="text-gray-400 text-sm">Activa el toggle para ver los administradores</div>
            </div>
          ) : adminsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <div className="text-gray-500">Cargando administradores...</div>
            </div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 text-lg mb-2">No se encontraron administradores</div>
              <div className="text-gray-400 text-sm">Los administradores aparecerán aquí</div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {admins.map((admin) => (
                <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm sm:text-base break-words">{admin.email}</div>
                    <span className="text-xs text-gray-600">Agregado: {
                      (() => {
                        if (!admin.addedAt) return 'Fecha no disponible';
                        try {
                          const date = new Date(admin.addedAt);
                          return isNaN(date.getTime()) ? 'Fecha no disponible' : date.toLocaleString('es-CO', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } catch (error) {
                          return 'Fecha no disponible';
                        }
                      })()
                    }</span>
                  </div>
                  <button
                    onClick={() => removeAdmin(admin.email)}
                    className="bg-red-600 text-white px-3 sm:px-4 py-2 rounded hover:bg-red-700 font-semibold text-xs sm:text-sm w-full sm:w-auto"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 