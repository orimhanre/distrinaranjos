'use client';
import React, { useState, useEffect } from 'react';
import { auth, googleProvider } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup } from 'firebase/auth';
import { checkAdminPermission } from '@/lib/adminPermissions';
import { useFirebaseAuthPersistence } from "@/lib/useFirebaseAuth";

interface EnvVariable {
  key: string;
  value: string;
  description: string;
  category: 'resend' | 'cloudinary' | 'firebase' | 'airtable' | 'google';
  isSecret: boolean;
}

export default function AjustesPage() {
  useFirebaseAuthPersistence();
  const [user, setUser] = useState<User | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [envVariables, setEnvVariables] = useState<EnvVariable[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showSecrets, setShowSecrets] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [permissionLoading, setPermissionLoading] = useState<boolean>(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set()); // All sections closed by default
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        setPermissionLoading(true);
        checkAdminPermission(firebaseUser.email).then((permission) => {
          setHasPermission(permission);
          setPermissionLoading(false);
        });
      } else {
        setHasPermission(false);
        setPermissionLoading(false);
      }
    });
    return () => unsubscribe();
  }, [isClient]);

  useEffect(() => {
    if (hasPermission && isClient) {
      loadEnvVariables();
    } else if (hasPermission === false && isClient) {
      // If permission check is complete and user has no permission, stop loading
      setIsLoading(false);
    }
  }, [hasPermission, isClient]);

  const loadEnvVariables = async () => {
    try {
      const response = await fetch('/api/admin/update-env', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const envVars = data.envVars;

        const variables: EnvVariable[] = [
          // Resend
          { key: 'RESEND_API_KEY', value: envVars.RESEND_API_KEY || '', description: 'API Key para envío de emails', category: 'resend', isSecret: true },
          { key: 'RESEND_FROM_EMAIL', value: envVars.RESEND_FROM_EMAIL || '', description: 'Email remitente (From)', category: 'resend', isSecret: false },
          { key: 'RESEND_TO_EMAIL', value: envVars.RESEND_TO_EMAIL || 'orhanimre@gmail.com', description: 'Email destinatario (To)', category: 'resend', isSecret: false },
          
          // Cloudinary
          { key: 'CLOUDINARY_CLOUD_NAME', value: envVars.CLOUDINARY_CLOUD_NAME || '', description: 'Nombre de la nube de Cloudinary', category: 'cloudinary', isSecret: false },
          { key: 'CLOUDINARY_API_KEY', value: envVars.CLOUDINARY_API_KEY || '', description: 'API Key de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'CLOUDINARY_API_SECRET', value: envVars.CLOUDINARY_API_SECRET || '', description: 'API Secret de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'CLOUDINARY_ACCOUNT_EMAIL', value: envVars.CLOUDINARY_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Cloudinary', category: 'cloudinary', isSecret: false },
          
          // Firebase
          { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: envVars.NEXT_PUBLIC_FIREBASE_API_KEY || '', description: 'API Key de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '', description: 'Dominio de autenticación de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '', description: 'ID del proyecto de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', value: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '', description: 'Bucket de almacenamiento de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '', description: 'ID del remitente de mensajes de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_APP_ID', value: envVars.NEXT_PUBLIC_FIREBASE_APP_ID || '', description: 'ID de la aplicación de Firebase', category: 'firebase', isSecret: false },
          { key: 'FIREBASE_ACCOUNT_EMAIL', value: envVars.FIREBASE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Firebase', category: 'firebase', isSecret: false },
          
          // Airtable
          { key: 'NEXT_PUBLIC_AIRTABLE_API_KEY', value: envVars.NEXT_PUBLIC_AIRTABLE_API_KEY || '', description: 'API Key (Personal Access Token) de Airtable', category: 'airtable', isSecret: true },
          { key: 'NEXT_PUBLIC_AIRTABLE_BASE_ID', value: envVars.NEXT_PUBLIC_AIRTABLE_BASE_ID || '', description: 'ID de la base de datos de Airtable', category: 'airtable', isSecret: false },
          { key: 'AIRTABLE_ACCOUNT_EMAIL', value: envVars.AIRTABLE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Airtable', category: 'airtable', isSecret: false },
        ];

        setEnvVariables(variables);
        setIsLoading(false);
      } else {
        // Fallback to client-side environment variables
        const variables: EnvVariable[] = [
          // Resend
          { key: 'RESEND_API_KEY', value: process.env.RESEND_API_KEY || '', description: 'API Key para envío de emails', category: 'resend', isSecret: true },
          { key: 'RESEND_FROM_EMAIL', value: process.env.RESEND_FROM_EMAIL || '', description: 'Email remitente (From)', category: 'resend', isSecret: false },
          { key: 'RESEND_TO_EMAIL', value: process.env.RESEND_TO_EMAIL || 'orhanimre@gmail.com', description: 'Email destinatario (To)', category: 'resend', isSecret: false },
          
          // Cloudinary
          { key: 'CLOUDINARY_CLOUD_NAME', value: process.env.CLOUDINARY_CLOUD_NAME || '', description: 'Nombre de la nube de Cloudinary', category: 'cloudinary', isSecret: false },
          { key: 'CLOUDINARY_API_KEY', value: process.env.CLOUDINARY_API_KEY || '', description: 'API Key de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'CLOUDINARY_API_SECRET', value: process.env.CLOUDINARY_API_SECRET || '', description: 'API Secret de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'CLOUDINARY_ACCOUNT_EMAIL', value: process.env.CLOUDINARY_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Cloudinary', category: 'cloudinary', isSecret: false },
          
          // Firebase
          { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '', description: 'API Key de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '', description: 'Dominio de autenticación de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '', description: 'ID del proyecto de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '', description: 'Bucket de almacenamiento de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '', description: 'ID del remitente de mensajes de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_FIREBASE_APP_ID', value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '', description: 'ID de la aplicación de Firebase', category: 'firebase', isSecret: false },
          { key: 'FIREBASE_ACCOUNT_EMAIL', value: process.env.FIREBASE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Firebase', category: 'firebase', isSecret: false },
          
          // Airtable
          { key: 'NEXT_PUBLIC_AIRTABLE_API_KEY', value: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || '', description: 'API Key (Personal Access Token) de Airtable', category: 'airtable', isSecret: true },
          { key: 'NEXT_PUBLIC_AIRTABLE_BASE_ID', value: process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || '', description: 'ID de la base de datos de Airtable', category: 'airtable', isSecret: false },
          { key: 'AIRTABLE_ACCOUNT_EMAIL', value: process.env.AIRTABLE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Airtable', category: 'airtable', isSecret: false },
          
          // Google Maps
          { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', value: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '', description: 'API Key de Google Maps para mostrar ubicación en contacto', category: 'google', isSecret: true },
        ];

        setEnvVariables(variables);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading environment variables:', error);
      // Fallback to client-side environment variables
      const variables: EnvVariable[] = [
        // Resend
        { key: 'RESEND_API_KEY', value: process.env.RESEND_API_KEY || '', description: 'API Key para envío de emails', category: 'resend', isSecret: true },
        { key: 'RESEND_FROM_EMAIL', value: process.env.RESEND_FROM_EMAIL || '', description: 'Email remitente (From)', category: 'resend', isSecret: false },
        { key: 'RESEND_TO_EMAIL', value: process.env.RESEND_TO_EMAIL || 'orhanimre@gmail.com', description: 'Email destinatario (To)', category: 'resend', isSecret: false },
        
        // Cloudinary
        { key: 'CLOUDINARY_CLOUD_NAME', value: process.env.CLOUDINARY_CLOUD_NAME || '', description: 'Nombre de la nube de Cloudinary', category: 'cloudinary', isSecret: false },
        { key: 'CLOUDINARY_API_KEY', value: process.env.CLOUDINARY_API_KEY || '', description: 'API Key de Cloudinary', category: 'cloudinary', isSecret: true },
        { key: 'CLOUDINARY_API_SECRET', value: process.env.CLOUDINARY_API_SECRET || '', description: 'API Secret de Cloudinary', category: 'cloudinary', isSecret: true },
        { key: 'CLOUDINARY_ACCOUNT_EMAIL', value: process.env.CLOUDINARY_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Cloudinary', category: 'cloudinary', isSecret: false },
        
        // Firebase
        { key: 'NEXT_PUBLIC_FIREBASE_API_KEY', value: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '', description: 'API Key de Firebase', category: 'firebase', isSecret: false },
        { key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', value: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '', description: 'Dominio de autenticación de Firebase', category: 'firebase', isSecret: false },
        { key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', value: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '', description: 'ID del proyecto de Firebase', category: 'firebase', isSecret: false },
        { key: 'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', value: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '', description: 'Bucket de almacenamiento de Firebase', category: 'firebase', isSecret: false },
        { key: 'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', value: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '', description: 'ID del remitente de mensajes de Firebase', category: 'firebase', isSecret: false },
        { key: 'NEXT_PUBLIC_FIREBASE_APP_ID', value: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '', description: 'ID de la aplicación de Firebase', category: 'firebase', isSecret: false },
        { key: 'FIREBASE_ACCOUNT_EMAIL', value: process.env.FIREBASE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Firebase', category: 'firebase', isSecret: false },
        
        // Airtable
        { key: 'NEXT_PUBLIC_AIRTABLE_API_KEY', value: process.env.NEXT_PUBLIC_AIRTABLE_API_KEY || '', description: 'API Key (Personal Access Token) de Airtable', category: 'airtable', isSecret: true },
        { key: 'NEXT_PUBLIC_AIRTABLE_BASE_ID', value: process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || '', description: 'ID de la base de datos de Airtable', category: 'airtable', isSecret: false },
        { key: 'AIRTABLE_ACCOUNT_EMAIL', value: process.env.AIRTABLE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Airtable', category: 'airtable', isSecret: false },
        
        // Google Maps
        { key: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', value: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '', description: 'API Key de Google Maps para mostrar ubicación en contacto', category: 'google', isSecret: true },
      ];

      setEnvVariables(variables);
    }
    
    setIsLoading(false);
  };

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = async (key: string) => {
    try {
      const response = await fetch('/api/admin/update-env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({ key, value: editValue })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setEditingKey(null);
        setEditValue('');
        
        // Update the local state immediately with the new value
        setEnvVariables(prev => prev.map(v => 
          v.key === key ? { ...v, value: editValue } : v
        ));
        
        // Update last modified timestamp for the category
        const category = envVariables.find(v => v.key === key)?.category;
        if (category) {
          const now = new Date().toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          });
          setLastUpdated(prev => ({ ...prev, [category]: now }));
        }
        
        // Also reload from server to ensure consistency (with small delay for file write)
        setTimeout(async () => {
          await loadEnvVariables();
        }, 500);
      } else {
        setMessage({ type: 'error', text: data.error || 'Error al actualizar la variable' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error de conexión al actualizar la variable' });
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  const toggleSection = (category: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };



  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'resend': return '📧';
      case 'cloudinary': return '☁️';
      case 'firebase': return '🔥';
      case 'airtable': return '📊';
      default: return '⚙️';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'resend': return 'bg-blue-50 border-blue-200';
      case 'cloudinary': return 'bg-green-50 border-green-200';
      case 'firebase': return 'bg-orange-50 border-orange-200';
      case 'airtable': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getCategoryIconBg = (category: string) => {
    switch (category) {
      case 'resend': return 'bg-gradient-to-r from-blue-500 to-blue-600';
      case 'cloudinary': return 'bg-gradient-to-r from-green-500 to-emerald-600';
      case 'firebase': return 'bg-gradient-to-r from-orange-500 to-red-500';
      case 'airtable': return 'bg-gradient-to-r from-purple-500 to-indigo-600';
      default: return 'bg-gradient-to-r from-gray-500 to-gray-600';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'resend': return 'Configuración para envío de emails';
      case 'cloudinary': return 'Configuración para almacenamiento de archivos';
      case 'firebase': return 'Configuración para autenticación y base de datos';
      case 'airtable': return 'Configuración para gestión de productos';
      default: return 'Configuración general';
    }
  };

  const maskSecretValue = (value: string) => {
    if (!value) return '';
    return '*'.repeat(Math.min(value.length, 8));
  };

  // Authentication checks (early returns after all hooks)
  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-black text-center">Inicio de Sesión de Administrador</h1>
        <button
          onClick={() => signInWithPopup(auth, googleProvider)}
          className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-semibold text-sm md:text-base"
        >
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  if (isLoading || permissionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isLoading ? "Cargando ajustes..." : "Verificando permisos..."}
          </p>
        </div>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-black text-center">Acceso denegado</h1>
        <p className="mb-4 text-black text-center">Tu cuenta no está autorizada para ver esta página.</p>
        <button
          onClick={() => auth.signOut()}
          className="bg-red-600 text-white px-4 py-3 rounded hover:bg-red-700 font-semibold text-sm md:text-base"
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div>
      
      <div className="max-w-7xl mx-auto">
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
                onClick={() => auth.signOut()}
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
        
        {/* Header - Excel Style */}
        <div className="mb-4 md:mb-8">
          <div className="bg-gray-50 border-b-2 border-gray-300 px-3 py-3 md:px-6 md:py-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-2 md:space-x-3">
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                  <span className="text-base md:text-lg">⚙️</span>
                </div>
                <div>
                  <h1 className="text-lg md:text-2xl font-semibold text-blue-700 uppercase tracking-wide">
                    Ajustes
                  </h1>
                  <p className="text-xs md:text-sm text-blue-600">Gestiona las variables de entorno de tu aplicación</p>
                </div>
              </div>
              
              {/* Controls */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <label className="flex items-center space-x-2 md:space-x-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={showSecrets}
                      onChange={(e) => setShowSecrets(e.target.checked)}
                      className="sr-only"
                    />
                    <div className={`w-8 h-4 md:w-10 md:h-5 rounded-full transition-colors duration-200 ${
                      showSecrets ? 'bg-blue-500' : 'bg-gray-300'
                    }`}>
                      <div className={`w-3 h-3 md:w-4 md:h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                        showSecrets ? 'translate-x-4 md:translate-x-5' : 'translate-x-0'
                      }`}></div>
                    </div>
                  </div>
                  <span className="text-xs md:text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">
                    Mostrar valores secretos
                  </span>
                </label>
                
                <div className="text-xs text-gray-500">
                  {envVariables.filter(v => v.value && v.value.trim() !== '').length} de {envVariables.length} variables configuradas
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 md:mb-8 p-4 md:p-6 rounded-xl md:rounded-2xl shadow-lg border-2 ${
            message.type === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 text-green-800' 
              : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 text-red-800'
          }`}>
            <div className="flex items-center space-x-2 md:space-x-3">
              <span className="text-lg md:text-2xl">{message.type === 'success' ? '✅' : '❌'}</span>
              <span className="font-semibold text-sm md:text-base">{message.text}</span>
            </div>
          </div>
        )}

        {/* Environment Variables */}
        <div className="grid gap-4 md:gap-8">
          {['resend', 'cloudinary', 'firebase', 'airtable'].map(category => {
            const categoryVariables = envVariables.filter(v => v.category === category);
            const activeVariables = categoryVariables.filter(v => v.value && v.value.trim() !== '');
            const inactiveVariables = categoryVariables.filter(v => !v.value || v.value.trim() === '');
            
            return (
              <div key={category} className={`bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${getCategoryColor(category)}`}>
                {/* Category Header */}
                <div 
                  className="p-4 md:p-8 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                  onClick={() => toggleSection(category)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-2 md:space-x-4">
                      <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${getCategoryIconBg(category)}`}>
                        <span className="text-lg md:text-2xl">{getCategoryIcon(category)}</span>
                      </div>
                      <div>
                        <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </h2>
                        <p className="text-xs md:text-sm text-gray-600">{getCategoryDescription(category)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end space-x-4">
                      <div className="text-right">
                        <div className="text-xl md:text-3xl font-bold text-gray-900">{activeVariables.length}</div>
                        <div className="text-xs text-gray-600 leading-tight whitespace-nowrap">de {categoryVariables.length} activas</div>
                        {lastUpdated[category] && (
                          <div className="text-xs text-gray-500 mt-1">
                            Última actualización: {lastUpdated[category]}
                          </div>
                        )}
                      </div>
                      <div className={`transform transition-transform duration-300 ${expandedSections.has(category) ? 'rotate-180' : 'rotate-0'}`}>
                        <span className="text-xl md:text-3xl font-bold text-gray-700">▼</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Variables */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  expandedSections.has(category) ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className="p-4 md:p-8 space-y-4 md:space-y-6">
                    {categoryVariables.map(variable => {
                      const isActive = variable.value && variable.value.trim() !== '';
                      
                      return (
                        <div key={variable.key} className={`bg-gradient-to-r rounded-lg md:rounded-xl p-4 md:p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                          isActive 
                            ? 'from-green-50 to-emerald-50 border-green-200 hover:border-green-300' 
                            : 'from-gray-50 to-gray-100 border-gray-200 hover:border-gray-300'
                        }`}>
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between mb-3 md:mb-4 gap-3">
                            <div className="flex-1">
                              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                                <h3 className="text-sm md:text-lg font-bold text-gray-900 break-all">{variable.key}</h3>
                                <div className="flex flex-wrap gap-2">
                                  {isActive ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                                      <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                      Activa
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                                      <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                                      Inactiva
                                    </span>
                                  )}
                                  {variable.isSecret && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                                      🔒 Secreto
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{variable.description}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                            <div className="flex-1 w-full">
                              {editingKey === variable.key ? (
                                <input
                                  type={variable.isSecret && !showSecrets ? "password" : "text"}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-3 py-2 md:px-4 md:py-3 border-2 border-blue-300 rounded-lg md:rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 text-gray-900 font-medium transition-all duration-200 text-sm md:text-base"
                                  placeholder="Ingresa el nuevo valor..."
                                />
                              ) : (
                                <div className={`px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl border-2 transition-all duration-200 ${
                                  isActive 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-gray-50 border-gray-200'
                                }`}>
                                  <span className={`font-mono text-xs md:text-sm break-all ${
                                    isActive ? 'text-green-900' : 'text-gray-700'
                                  }`}>
                                    {variable.isSecret && !showSecrets 
                                      ? maskSecretValue(variable.value)
                                      : variable.value || 'No configurado'
                                    }
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {editingKey === variable.key ? (
                              <div className="flex space-x-2 md:space-x-3 w-full sm:w-auto">
                                <button
                                  onClick={() => handleSave(variable.key)}
                                  className="flex-1 sm:flex-none px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg md:rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 text-xs md:text-sm"
                                >
                                  💾 Guardar
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="flex-1 sm:flex-none px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg md:rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 text-xs md:text-sm"
                                >
                                  ❌ Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleEdit(variable.key, variable.value)}
                                className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg md:rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 text-xs md:text-sm"
                              >
                                ✏️ Editar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Cloudinary Configuration Information */}
                    {category === 'cloudinary' && (
                      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-800 mb-3">Configuración Adicional de Cloudinary</h4>
                        <div className="space-y-2 text-xs text-blue-700">
                          <div className="flex items-start space-x-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span><strong>Modo de Firma:</strong> Configurado en modo "unsigned" para cargas más fáciles</span>
                          </div>
                          <div className="flex items-start space-x-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span><strong>Configuración de Seguridad:</strong> "Permitir entrega de archivos PDF y ZIP" está habilitado</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Important Notice */}
        <div className="mt-4 md:mt-8 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl md:rounded-2xl p-4 md:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-start space-y-3 md:space-y-0 md:space-x-4">
            <div className="bg-yellow-100 p-2 md:p-3 rounded-lg md:rounded-xl">
              <span className="text-lg md:text-2xl">⚠️</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-bold text-yellow-800 mb-3 md:mb-4">Información Importante</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm text-yellow-700">
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Los cambios se aplicarán después de reiniciar la aplicación</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Las variables secretas están enmascaradas por seguridad</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Asegúrate de tener respaldos antes de hacer cambios</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="text-yellow-600 mt-1">•</span>
                  <span>Algunas variables requieren reinicio del servidor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Account Section - Only visible on mobile */}
      <div className="block md:hidden mt-8">
        <div className="bg-white border-t border-gray-200 py-4">
          <div className="flex items-center justify-end gap-3">
            <span className="text-gray-800 font-medium break-all">{user?.email}</span>
            <button
              onClick={() => auth.signOut()}
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