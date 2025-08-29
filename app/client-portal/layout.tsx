'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useClientAuth } from '@/lib/useClientAuth';
import { virtualAuth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function ClientPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useClientAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    try {
      if (virtualAuth) {
        await signOut(virtualAuth);
      }
      router.push('/client-portal/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Don't show loading state for now - let the pages handle their own loading
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end h-20 sm:h-28 py-4 sm:py-0">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                Portal del Cliente
              </h1>
            </div>
            
            {user && (
              <div className="flex items-end space-x-3 sm:space-x-4 md:space-x-5">
                <div className="flex items-end space-x-3 sm:space-x-4 md:space-x-5">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full"
                    />
                  )}
                  <div className="text-xs sm:text-sm min-w-0 text-right">
                    <p className="text-gray-900 font-medium truncate">
                      {user.displayName || user.email}
                    </p>
                    <p className="text-gray-500 truncate text-xs">{user.email}</p>
                  </div>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="text-red-500 hover:text-red-700 p-2 sm:p-2.5 md:p-3 rounded-md hover:bg-red-50 transition-colors flex-shrink-0"
                  title="Cerrar Sesión"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation - Only show if user is authenticated */}
      {user && (
        <nav className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center sm:justify-start space-x-4 sm:space-x-8 py-3">
              <a
                href="/client-portal/dashboard"
                className={`py-2 px-2 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/client-portal/dashboard'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </a>
              <a
                href="/client-portal/orders"
                className={`py-2 px-2 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/client-portal/orders'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Mis Pedidos
              </a>
              <a
                href="/client-portal/profile"
                className={`py-2 px-2 border-b-2 text-sm font-medium transition-colors ${
                  pathname === '/client-portal/profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Perfil
              </a>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-0 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
