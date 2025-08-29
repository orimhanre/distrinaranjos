'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClientAuth } from '@/lib/useClientAuth';
import { virtualAuth, virtualGoogleProvider } from '@/lib/firebase';
import { signInWithPopup } from 'firebase/auth';
import FirebaseDebugger from '@/components/FirebaseDebugger';
import PersistenceTest from '@/components/PersistenceTest';

export default function ClientPortalLoginPage() {
  const { user, loading, error } = useClientAuth();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Handle redirect after render
  useEffect(() => {
    if (shouldRedirect) {
      router.push('/client-portal/dashboard');
    }
  }, [shouldRedirect, router]);

  useEffect(() => {
    if (user && !loading) {
      console.log('✅ Login page: User authenticated, setting redirect flag');
      // Set a flag to trigger redirect on next render
      setShouldRedirect(true);
    }
  }, [user, loading]);

  // Log authentication state changes
  useEffect(() => {
    console.log('🔍 Login page: Auth state changed:', { user: !!user, loading, error });
  }, [user, loading, error]);

  const handleGoogleSignIn = async () => {
    try {
      console.log('🔍 Login page: Starting Google sign in...');
      setSignInLoading(true);
      setSignInError(null);

      if (!virtualAuth || !virtualGoogleProvider) {
        throw new Error('Virtual Firebase not configured');
      }

      console.log('✅ Login page: Firebase auth and provider available');
      
      const result = await signInWithPopup(virtualAuth, virtualGoogleProvider);
      const user = result.user;
      
      console.log('✅ Login page: Google sign in successful:', {
        email: user.email,
        displayName: user.displayName,
        uid: user.uid
      });
      
              // Create client profile automatically
        if (user.email) {
          try {
            console.log('🔍 Login page: Creating client profile...');
            await fetch('/api/client-portal/create-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userEmail: user.email,
                userName: user.displayName,
                userPhotoURL: user.photoURL
              }),
            });
            console.log('✅ Login page: Client profile created successfully');
          } catch (profileError) {
            console.error('❌ Login page: Error creating profile:', profileError);
            // Continue anyway - profile creation is not critical for login
          }
        }
        
        // User will be automatically redirected to dashboard by useEffect
        console.log('✅ Login page: Sign in complete, waiting for redirect...');
          } catch (error: any) {
        console.error('❌ Login page: Sign in error:', error);
        
        // Handle specific Firebase auth errors
        if (error.code === 'auth/popup-closed-by-user') {
          // User closed the popup - this is normal behavior, no need to show error
          console.log('Login popup was closed by user');
          setSignInError(null);
        } else if (error.code === 'auth/popup-blocked') {
          console.error('Login popup was blocked by browser');
          setSignInError('El navegador bloqueó la ventana de inicio de sesión. Por favor, habilita las ventanas emergentes para este sitio.');
        } else if (error.code === 'auth/cancelled-popup-request') {
          console.log('Login popup request was cancelled');
          setSignInError(null);
        } else if (error.code === 'auth/network-request-failed') {
          setSignInError('Error de conexión. Por favor, verifica tu conexión a internet e intenta nuevamente.');
        } else {
          console.error('Error signing in with Google:', error);
          setSignInError('Error al iniciar sesión. Por favor, intenta nuevamente.');
        }
      } finally {
        setSignInLoading(false);
      }
  };

  // Show loading state while Firebase is initializing
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Inicializando autenticación...</p>
          {error && (
            <p className="text-red-600 text-sm mt-2">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  // Show error state if Firebase failed to initialize
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-red-800 mb-2">Error de Configuración</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Recargar Página
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (user && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 px-4 sm:px-6 lg:px-8">
      <FirebaseDebugger />
      <PersistenceTest />
      <div className="max-w-md w-full mx-auto space-y-6">
        {/* Title, Subtitle, and Login Button - Moved up for mobile */}
        <div className="text-center pt-8">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-full flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            Portal del Cliente
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Accede a tu historial de pedidos y descarga tus facturas
          </p>
        </div>
        
        <div className="space-y-4">
          <div>
            <button
              onClick={handleGoogleSignIn}
              disabled={signInLoading}
              className={`group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white transition-colors ${
                signInLoading 
                  ? 'bg-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
              }`}
            >
              {signInLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Iniciar sesión con Google
                </>
              )}
            </button>
          </div>

          {/* Error message */}
          {signInError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{signInError}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes cuenta? Se crea automáticamente al iniciar sesión
            </p>
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Información importante
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  • Puedes acceder a tu historial de pedidos
                </p>
                                            <p>
                              • Descarga tu Orden de Pedido en PDF
                            </p>
                            <p>
                              • Obtén Factura Electrónica para tus pedidos
                            </p>
                <p>
                  • Recibe notificaciones sobre el estado de tu pago
                </p>
                <p>
                  • Te informamos sobre el estado de envío de tu pedido
                </p>
                                            <p className="text-gray-600 text-sm mt-4">
                              Aunque no es obligatorio crear una cuenta para realizar pedidos, registrarte te brinda acceso a todas estas ventajas y te permite hacer un seguimiento completo de tus compras de manera organizada.
                            </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
