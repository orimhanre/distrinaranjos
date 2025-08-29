"use client";
import { useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";
import { checkAdminPermission } from "@/lib/adminPermissions";
import { useRouter } from 'next/navigation';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";


export default function PermisosPage() {
  useFirebaseAuthPersistence();
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

  const fetchAdmins = async () => {
    if (!showAdmins) return;
    
    setAdminsLoading(true);
    try {
      const response = await fetch('/api/admin-permissions');
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
    if (hasPermission && showAdmins) {
      fetchAdmins();
    } else if (!showAdmins) {
      // Clear data when toggle is disabled
      setAdmins([]);
      setAdminsLoading(false);
    }
  }, [hasPermission, showAdmins]);

  const handleLogin = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const addAdmin = async () => {
    if (!newEmail.trim()) return;
    
    try {
      const response = await fetch('/api/admin-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Admin agregado exitosamente' });
        setNewEmail("");
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al agregar admin' });
    }
  };

  const removeAdmin = async (email: string) => {
    try {
      const response = await fetch('/api/admin-permissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Admin removido exitosamente' });
        fetchAdmins();
      } else {
        setMessage({ type: 'error', text: data.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al remover admin' });
    }
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
      
      <div className="max-w-4xl mx-auto">
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
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 md:gap-4 mb-4 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <h1 className="text-lg md:text-3xl font-bold text-gray-900">Gestión de Permisos de Administrador</h1>
          </div>
        </div>
        
        {/* Admins Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Mostrar administradores:</span>
          <button
            onClick={() => setShowAdmins(!showAdmins)}
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
          {adminsLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          )}
        </div>

        {message && (
          <div className={`mb-4 p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
            <button 
              onClick={() => setMessage(null)}
              className="float-right font-bold"
            >
              ×
            </button>
          </div>
        )}

        {showAdmins && (
          <div className="bg-white rounded-xl shadow-lg p-2 sm:p-4 md:p-6 mb-4 md:mb-6">
            <h2 className="text-base md:text-lg font-bold mb-4 text-black">Agregar Nuevo Administrador</h2>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email del nuevo administrador"
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

        <div className="bg-white rounded-xl shadow-lg p-2 sm:p-4 md:p-6">
          <h3 className="text-sm md:text-md font-semibold mb-2 text-black">Administradores Actuales</h3>
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
            <div className="space-y-2 sm:space-y-3">
              {admins.map((admin) => (
                <div key={admin.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border border-gray-200 rounded-lg gap-2 sm:gap-0">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900 text-sm sm:text-base break-words">{admin.email}</div>
                    <span className="text-xs text-black">Agregado: {
                      admin.addedAt
                        ? (typeof admin.addedAt === 'string'
                            ? (isNaN(new Date(admin.addedAt).getTime()) ? '-' : new Date(admin.addedAt).toLocaleString())
                            : ((admin.addedAt as any).seconds
                                ? new Date((admin.addedAt as any).seconds * 1000).toLocaleString()
                                : '-'))
                        : '-'
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