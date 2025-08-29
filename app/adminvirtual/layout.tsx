'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { virtualAuth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';

export default function AdminVirtualLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();
  
  useEffect(() => {
    if (!virtualAuth) {
      return;
    }
    const unsubscribe = onAuthStateChanged(virtualAuth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        const hasPermission = await checkVirtualAdminPermission(firebaseUser.email);
        setHasPermission(hasPermission);
      } else {
        setHasPermission(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (!virtualAuth) {
      return;
    }
    await signOut(virtualAuth);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Virtual Menu */}
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
                  <span className="text-lg font-semibold text-purple-600">Admin Tienda Virtual</span>
                </div>
              </div>
              
              {/* Navigation Links */}
              <div className="hidden md:block flex-1">
                <div className="flex items-baseline justify-center">
                  <div className="flex items-baseline space-x-2">
                    <Link 
                      href="/adminvirtual" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Pedidos Virtuales
                    </Link>
                    <Link 
                      href="/adminvirtual/pedidos-eliminados" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/pedidos-eliminados' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Pedidos Eliminados
                    </Link>
                    <Link 
                      href="/adminvirtual/permisos" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/permisos' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Permisos
                    </Link>
                    <Link 
                      href="/adminvirtual/database" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/database' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Base de Datos
                    </Link>
                    <Link 
                      href="/adminvirtual/ajustes" 
                      className={`px-4 py-2 rounded-lg text-sm transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/ajustes' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
                    >
                      Ajustes
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right side - empty for now */}
              <div className="flex items-center space-x-3">
              </div>
            </div>
          </div>

          {/* Mobile menu */}
          <div className={`md:hidden transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'block opacity-100' : 'hidden opacity-0'}`}>
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50 border-t border-gray-200">
              <Link 
                href="/adminvirtual" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Pedidos Virtuales
              </Link>
              <Link 
                href="/adminvirtual/pedidos-eliminados" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/pedidos-eliminados' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Pedidos Eliminados
              </Link>
              <Link 
                href="/adminvirtual/permisos" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/permisos' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Permisos
              </Link>
              <Link 
                href="/adminvirtual/database" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/database' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Base de Datos
              </Link>
              <Link 
                href="/adminvirtual/ajustes" 
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base transition-all duration-200 border border-transparent hover:border-gray-200 cursor-pointer hover:bg-gray-100 ${pathname === '/adminvirtual/ajustes' ? 'font-bold text-purple-600 bg-purple-50' : 'font-medium text-gray-700 hover:text-gray-900'}`}
              >
                Ajustes
              </Link>
              {/* Mobile user info and logout */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  Cerrar sesión
                </button>
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
                {!user ? 'Por favor inicia sesión para acceder al panel de administración virtual.' : 'No tienes permisos para acceder al panel de administración virtual.'}
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