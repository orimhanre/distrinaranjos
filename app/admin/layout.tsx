'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { checkAdminPermission } from '@/lib/adminPermissions';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        checkAdminPermission(firebaseUser.email).then(setHasPermission);
      } else {
        setHasPermission(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleSwitchToVirtualAdmin = async () => {
    try {
      // Sign out from current session
      await signOut(auth);
      // Redirect to virtual admin
      window.location.href = '/adminvirtual';
    } catch (error) {
      console.error('Error switching to virtual admin:', error);
      alert('Error al cambiar al admin virtual');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Menu */}
      {user && hasPermission ? (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Mobile menu button and title - Left side */}
              <div className="flex items-center space-x-3">
                <div className="md:hidden">
                  <button 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                    className="text-gray-600 hover:text-gray-900 focus:outline-none focus:text-gray-900"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                
                {/* Logo/Brand */}
                <div className="flex-shrink-0">
                  {/* Removed Admin Panel text */}
                </div>
              </div>
              
              {/* Navigation Links */}
              <div className="hidden md:block flex-1">
                <div className="flex items-baseline">
                  {/* Left-aligned form links */}
                  <div className="flex items-baseline space-x-2 -ml-4">
                    <Link 
                      href="/distri1" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/distri1' ? 'font-bold text-green-600 bg-gray-100 bg-opacity-10' : 'font-medium text-green-600 hover:text-green-700'}`}
                    >
                      Distri1
                    </Link>
                    <Link 
                      href="/naranjos2" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/naranjos2' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-blue-600 hover:text-blue-700'}`}
                    >
                      Naranjos2
                    </Link>
                  </div>
                  
                  {/* Center-aligned admin links */}
                  <div className="flex items-baseline space-x-2 ml-auto">
                    <Link 
                      href="/admin" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Pedidos
                    </Link>
                    <Link 
                      href="/admin/archivos-eliminados" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/archivos-eliminados' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Pedidos Eliminados
                    </Link>
                    <Link 
                      href="/admin/estadisticas" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/estadisticas' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Estadísticas
                    </Link>
                    <Link 
                      href="/admin/visitas" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/visitas' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Visitas
                    </Link>
                    <Link 
                      href="/admin/permisos" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/permisos' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Permisos
                    </Link>
                    <Link 
                      href="/admin/database" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/database' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Base de Datos
                    </Link>
                    <Link 
                      href="/admin/ajustes" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/ajustes' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Ajustes
                    </Link>
                  </div>
                </div>
              </div>

              {/* User info and logout - Right side */}
              <div className="flex items-center space-x-3">
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'block opacity-100' : 'hidden opacity-0'}`}>
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t border-gray-200">
              {/* Form links at the top */}
              <Link 
                href="/distri1" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/distri1' ? 'font-bold text-green-600 bg-gray-100 bg-opacity-10' : 'font-medium text-green-600 hover:text-green-700'}`}
              >
                Distri1
              </Link>
              <Link 
                href="/naranjos2" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/naranjos2' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-blue-600 hover:text-blue-700'}`}
              >
                Naranjos2
              </Link>
              
              {/* Separator */}
              <div className="border-t border-gray-200 my-2"></div>
              
              {/* Admin links */}
              <Link 
                href="/admin" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Pedidos
              </Link>
              <Link 
                href="/admin/archivos-eliminados" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/archivos-eliminados' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Pedidos Eliminados
              </Link>
              <Link 
                href="/admin/estadisticas" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/estadisticas' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Estadísticas
              </Link>
              <Link 
                href="/admin/visitas" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/visitas' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Visitas
              </Link>
              <Link 
                href="/admin/permisos" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/permisos' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Permisos
              </Link>
              <Link 
                href="/admin/database" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/database' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Base de Datos
              </Link>
              <Link 
                href="/admin/ajustes" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/admin/ajustes' ? 'font-bold text-blue-600 bg-gray-100 bg-opacity-10' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Ajustes
              </Link>
              
              {/* Mobile user info and logout */}
              <div className="border-t border-gray-200 pt-3 mt-3">
              </div>
            </div>
          </div>
        </nav>
      ) : (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-yellow-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-yellow-800 font-medium">
                {!user ? 'Por favor inicia sesión para acceder al panel de administración.' : 'No tienes permisos para acceder al panel de administración.'}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
} 