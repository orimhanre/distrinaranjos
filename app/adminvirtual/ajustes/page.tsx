'use client';
import React, { useState, useEffect } from 'react';
import { virtualAuth, virtualGoogleProvider } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';
import { checkVirtualAdminPermission } from '@/lib/adminPermissions';
import { useRouter } from 'next/navigation';
import CategorySubcategoryManager from '@/components/CategorySubcategoryManager';

interface EnvVariable {
  key: string;
  value: string;
  description: string;
  category: 'resend' | 'cloudinary' | 'firebase' | 'airtable' | 'shipping' | 'payment' | 'security' | 'relations';
  subcategory?: 'wompi' | 'pse' | 'stripe' | 'bank';
  isSecret: boolean;
}

export default function VirtualAjustesPage() {
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
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<string>>(new Set()); // All subcategories closed by default
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});

  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    if (!virtualAuth) {
      console.error('Virtual auth not available');
      return;
    }
    
    const unsubscribe = onAuthStateChanged(virtualAuth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser?.email) {
        setPermissionLoading(true);
        checkVirtualAdminPermission(firebaseUser.email).then((permission) => {
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
      const response = await fetch('/api/admin/virtual-update-env', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const envVars = data.envVars;

        const variables: EnvVariable[] = [
          // Resend
          { key: 'VIRTUAL_RESEND_API_KEY', value: envVars.VIRTUAL_RESEND_API_KEY || '', description: 'API Key para envío de emails', category: 'resend', isSecret: true },
          { key: 'VIRTUAL_RESEND_FROM_EMAIL', value: envVars.VIRTUAL_RESEND_FROM_EMAIL || '', description: 'Email remitente (From)', category: 'resend', isSecret: false },
          { key: 'VIRTUAL_RESEND_TO_EMAIL', value: envVars.VIRTUAL_RESEND_TO_EMAIL || '', description: 'Email destinatario (To)', category: 'resend', isSecret: false },
          
          // Cloudinary
          { key: 'VIRTUAL_CLOUDINARY_CLOUD_NAME', value: envVars.VIRTUAL_CLOUDINARY_CLOUD_NAME || '', description: 'Nombre de la nube de Cloudinary', category: 'cloudinary', isSecret: false },
          { key: 'VIRTUAL_CLOUDINARY_API_KEY', value: envVars.VIRTUAL_CLOUDINARY_API_KEY || '', description: 'API Key de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'VIRTUAL_CLOUDINARY_API_SECRET', value: envVars.VIRTUAL_CLOUDINARY_API_SECRET || '', description: 'API Secret de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL', value: envVars.VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Cloudinary', category: 'cloudinary', isSecret: false },
          
          // Firebase
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || '', description: 'API Key de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN || '', description: 'Dominio de autenticación de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID || '', description: 'ID del proyecto de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET || '', description: 'Bucket de almacenamiento de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID || '', description: 'ID del remitente de mensajes de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID', value: envVars.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID || '', description: 'ID de la aplicación de Firebase', category: 'firebase', isSecret: false },
          { key: 'VIRTUAL_FIREBASE_ACCOUNT_EMAIL', value: envVars.VIRTUAL_FIREBASE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Firebase', category: 'firebase', isSecret: false },
          
          // Airtable
          { key: 'VIRTUAL_AIRTABLE_API_KEY', value: envVars.VIRTUAL_AIRTABLE_API_KEY || 'patfzZxPHONwkhZPN.da7c68ed49bff5a194b578eace74ce8a1431f583723b475412e04e0f321815f7', description: 'API Key (Personal Access Token) de Airtable', category: 'airtable', isSecret: true },
          { key: 'VIRTUAL_AIRTABLE_BASE_ID', value: envVars.VIRTUAL_AIRTABLE_BASE_ID || 'appyNH3iztQpMqHAY', description: 'ID de la base de datos de Airtable', category: 'airtable', isSecret: false },
          { key: 'VIRTUAL_AIRTABLE_ACCOUNT_EMAIL', value: envVars.VIRTUAL_AIRTABLE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Airtable', category: 'airtable', isSecret: false },
          
          // Shipping
          { key: 'VIRTUAL_SHIPPING_FREE_THRESHOLD', value: envVars.VIRTUAL_SHIPPING_FREE_THRESHOLD || '200000', description: 'Umbral para envío gratuito (en centavos)', category: 'shipping', isSecret: false },
          { key: 'VIRTUAL_SHIPPING_COST', value: envVars.VIRTUAL_SHIPPING_COST || '15000', description: 'Costo de envío (en centavos)', category: 'shipping', isSecret: false },
          { key: 'VIRTUAL_SHIPPING_ESTIMATED_DAYS', value: envVars.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '3', description: 'Días estimados de entrega', category: 'shipping', isSecret: false },
          
          // Wompi Payment Gateway
          { key: 'VIRTUAL_WOMPI_PUBLIC_KEY', value: envVars.VIRTUAL_WOMPI_PUBLIC_KEY || '', description: 'Clave pública de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          { key: 'VIRTUAL_WOMPI_PRIVATE_KEY', value: envVars.VIRTUAL_WOMPI_PRIVATE_KEY || '', description: 'Clave privada de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          { key: 'VIRTUAL_WOMPI_WEBHOOK_SECRET', value: envVars.VIRTUAL_WOMPI_WEBHOOK_SECRET || '', description: 'Secreto del webhook de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          
          // PSE Payment Gateway
          { key: 'VIRTUAL_PSE_MERCHANT_ID', value: envVars.VIRTUAL_PSE_MERCHANT_ID || '', description: 'ID del comerciante PSE', category: 'payment', subcategory: 'pse', isSecret: false },
          { key: 'VIRTUAL_PSE_API_KEY', value: envVars.VIRTUAL_PSE_API_KEY || '', description: 'Clave API de PSE', category: 'payment', subcategory: 'pse', isSecret: true },
          { key: 'VIRTUAL_PSE_WEBHOOK_SECRET', value: envVars.VIRTUAL_PSE_WEBHOOK_SECRET || '', description: 'Secreto del webhook de PSE', category: 'payment', subcategory: 'pse', isSecret: true },
          
          // Stripe Payment Gateway
          { key: 'VIRTUAL_STRIPE_PUBLISHABLE_KEY', value: envVars.VIRTUAL_STRIPE_PUBLISHABLE_KEY || '', description: 'Clave pública de Stripe', category: 'payment', subcategory: 'stripe', isSecret: false },
          { key: 'VIRTUAL_STRIPE_SECRET_KEY', value: envVars.VIRTUAL_STRIPE_SECRET_KEY || '', description: 'Clave secreta de Stripe', category: 'payment', subcategory: 'stripe', isSecret: true },
          { key: 'VIRTUAL_STRIPE_WEBHOOK_SECRET', value: envVars.VIRTUAL_STRIPE_WEBHOOK_SECRET || '', description: 'Secreto del webhook de Stripe', category: 'payment', subcategory: 'stripe', isSecret: true },
          
          // Bank Account Details
          { key: 'VIRTUAL_BANK_ACCOUNT_HOLDER', value: envVars.VIRTUAL_BANK_ACCOUNT_HOLDER || 'DISTRI NARANJOS SAS', description: 'Titular de la cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_ACCOUNT_NUMBER', value: envVars.VIRTUAL_BANK_ACCOUNT_NUMBER || '1234567890', description: 'Número de cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: true },
          { key: 'VIRTUAL_BANK_ACCOUNT_TYPE', value: envVars.VIRTUAL_BANK_ACCOUNT_TYPE || 'Cuenta Corriente', description: 'Tipo de cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_NAME', value: envVars.VIRTUAL_BANK_NAME || 'Bancolombia', description: 'Nombre del banco', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_PHONE', value: envVars.VIRTUAL_BANK_PHONE || '+57 311 388 7955', description: 'Teléfono de contacto bancario', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_EMAIL', value: envVars.VIRTUAL_BANK_EMAIL || 'info@distrinaranjos.com', description: 'Email de contacto bancario', category: 'payment', subcategory: 'bank', isSecret: false },
          
          // Security
          { key: 'VIRTUAL_JWT_SECRET', value: envVars.VIRTUAL_JWT_SECRET || '', description: 'Clave secreta para JWT', category: 'security', isSecret: true },
          { key: 'VIRTUAL_SESSION_SECRET', value: envVars.VIRTUAL_SESSION_SECRET || '', description: 'Clave secreta para sesiones', category: 'security', isSecret: true },
        ];

        setEnvVariables(variables);
        setIsLoading(false);
      } else {
        // Fallback to client-side environment variables
        const variables: EnvVariable[] = [
          // Resend
          { key: 'VIRTUAL_RESEND_API_KEY', value: process.env.VIRTUAL_RESEND_API_KEY || '', description: 'API Key para envío de emails', category: 'resend', isSecret: true },
          { key: 'VIRTUAL_RESEND_FROM_EMAIL', value: process.env.VIRTUAL_RESEND_FROM_EMAIL || '', description: 'Email remitente (From)', category: 'resend', isSecret: false },
          { key: 'VIRTUAL_RESEND_TO_EMAIL', value: process.env.VIRTUAL_RESEND_TO_EMAIL || '', description: 'Email destinatario (To)', category: 'resend', isSecret: false },
          
          // Cloudinary
          { key: 'VIRTUAL_CLOUDINARY_CLOUD_NAME', value: process.env.VIRTUAL_CLOUDINARY_CLOUD_NAME || '', description: 'Nombre de la nube de Cloudinary', category: 'cloudinary', isSecret: false },
          { key: 'VIRTUAL_CLOUDINARY_API_KEY', value: process.env.VIRTUAL_CLOUDINARY_API_KEY || '', description: 'API Key de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'VIRTUAL_CLOUDINARY_API_SECRET', value: process.env.VIRTUAL_CLOUDINARY_API_SECRET || '', description: 'API Secret de Cloudinary', category: 'cloudinary', isSecret: true },
          { key: 'VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL', value: process.env.VIRTUAL_CLOUDINARY_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Cloudinary', category: 'cloudinary', isSecret: false },
          
          // Firebase
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_API_KEY || '', description: 'API Key de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_AUTH_DOMAIN || '', description: 'Dominio de autenticación de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_PROJECT_ID || '', description: 'ID del proyecto de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_STORAGE_BUCKET || '', description: 'Bucket de almacenamiento de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_MESSAGING_SENDER_ID || '', description: 'ID del remitente de mensajes de Firebase', category: 'firebase', isSecret: false },
          { key: 'NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID', value: process.env.NEXT_PUBLIC_VIRTUAL_FIREBASE_APP_ID || '', description: 'ID de la aplicación de Firebase', category: 'firebase', isSecret: false },
          { key: 'VIRTUAL_FIREBASE_ACCOUNT_EMAIL', value: process.env.VIRTUAL_FIREBASE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Firebase', category: 'firebase', isSecret: false },
          
          // Airtable
          { key: 'VIRTUAL_AIRTABLE_API_KEY', value: process.env.VIRTUAL_AIRTABLE_API_KEY || 'patfzZxPHONwkhZPN.da7c68ed49bff5a194b578eace74ce8a1431f583723b475412e04e0f321815f7', description: 'API Key (Personal Access Token) de Airtable', category: 'airtable', isSecret: true },
          { key: 'VIRTUAL_AIRTABLE_BASE_ID', value: process.env.VIRTUAL_AIRTABLE_BASE_ID || 'appyNH3iztQpMqHAY', description: 'ID de la base de datos de Airtable', category: 'airtable', isSecret: false },
          { key: 'VIRTUAL_AIRTABLE_ACCOUNT_EMAIL', value: process.env.VIRTUAL_AIRTABLE_ACCOUNT_EMAIL || '', description: 'Email de la cuenta de Airtable', category: 'airtable', isSecret: false },
          
          // Shipping
          { key: 'VIRTUAL_SHIPPING_FREE_THRESHOLD', value: process.env.VIRTUAL_SHIPPING_FREE_THRESHOLD || '200000', description: 'Umbral para envío gratuito (en centavos)', category: 'shipping', isSecret: false },
          { key: 'VIRTUAL_SHIPPING_COST', value: process.env.VIRTUAL_SHIPPING_COST || '15000', description: 'Costo de envío (en centavos)', category: 'shipping', isSecret: false },
          { key: 'VIRTUAL_SHIPPING_ESTIMATED_DAYS', value: process.env.VIRTUAL_SHIPPING_ESTIMATED_DAYS || '3', description: 'Días estimados de entrega', category: 'shipping', isSecret: false },
          
          // Wompi Payment Gateway
          { key: 'VIRTUAL_WOMPI_PUBLIC_KEY', value: process.env.VIRTUAL_WOMPI_PUBLIC_KEY || '', description: 'Clave pública de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          { key: 'VIRTUAL_WOMPI_PRIVATE_KEY', value: process.env.VIRTUAL_WOMPI_PRIVATE_KEY || '', description: 'Clave privada de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          { key: 'VIRTUAL_WOMPI_WEBHOOK_SECRET', value: process.env.VIRTUAL_WOMPI_WEBHOOK_SECRET || '', description: 'Secreto del webhook de Wompi', category: 'payment', subcategory: 'wompi', isSecret: true },
          
          // PSE Payment Gateway
          { key: 'VIRTUAL_PSE_MERCHANT_ID', value: process.env.VIRTUAL_PSE_MERCHANT_ID || '', description: 'ID del comerciante PSE', category: 'payment', subcategory: 'pse', isSecret: false },
          { key: 'VIRTUAL_PSE_API_KEY', value: process.env.VIRTUAL_PSE_API_KEY || '', description: 'Clave API de PSE', category: 'payment', subcategory: 'pse', isSecret: true },
          { key: 'VIRTUAL_PSE_WEBHOOK_SECRET', value: process.env.VIRTUAL_PSE_WEBHOOK_SECRET || '', description: 'Secreto del webhook de PSE', category: 'payment', subcategory: 'pse', isSecret: true },
          
          // Stripe Payment Gateway
          { key: 'VIRTUAL_STRIPE_PUBLISHABLE_KEY', value: process.env.VIRTUAL_STRIPE_PUBLISHABLE_KEY || '', description: 'Clave pública de Stripe', category: 'payment', subcategory: 'stripe', isSecret: false },
          { key: 'VIRTUAL_STRIPE_SECRET_KEY', value: process.env.VIRTUAL_STRIPE_SECRET_KEY || '', description: 'Clave secreta de Stripe', category: 'payment', subcategory: 'stripe', isSecret: true },
          { key: 'VIRTUAL_STRIPE_WEBHOOK_SECRET', value: process.env.VIRTUAL_STRIPE_WEBHOOK_SECRET || '', description: 'Secreto del webhook de Stripe', category: 'payment', subcategory: 'stripe', isSecret: true },
          
          // Bank Account Details
          { key: 'VIRTUAL_BANK_ACCOUNT_HOLDER', value: process.env.VIRTUAL_BANK_ACCOUNT_HOLDER || 'DISTRI NARANJOS SAS', description: 'Titular de la cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_ACCOUNT_NUMBER', value: process.env.VIRTUAL_BANK_ACCOUNT_NUMBER || '1234567890', description: 'Número de cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: true },
          { key: 'VIRTUAL_BANK_ACCOUNT_TYPE', value: process.env.VIRTUAL_BANK_ACCOUNT_TYPE || 'Cuenta Corriente', description: 'Tipo de cuenta bancaria', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_NAME', value: process.env.VIRTUAL_BANK_NAME || 'Bancolombia', description: 'Nombre del banco', category: 'payment', subcategory: 'bank', isSecret: false },
          { key: 'VIRTUAL_BANK_PHONE', value: process.env.VIRTUAL_BANK_PHONE || '+57 311 388 7955', description: 'Teléfono de contacto bancario', category: 'payment', subcategory: 'bank', isSecret: false },
                  { key: 'VIRTUAL_BANK_EMAIL', value: process.env.VIRTUAL_BANK_EMAIL || 'info@distrinaranjos.com', description: 'Email de contacto bancario', category: 'payment', subcategory: 'bank', isSecret: false },
        
        // Security
        { key: 'VIRTUAL_JWT_SECRET', value: process.env.VIRTUAL_JWT_SECRET || '', description: 'Clave secreta para JWT', category: 'security', isSecret: true },
        { key: 'VIRTUAL_SESSION_SECRET', value: process.env.VIRTUAL_SESSION_SECRET || '', description: 'Clave secreta para sesiones', category: 'security', isSecret: true },
      ];

      setEnvVariables(variables);
    }
    
    setIsLoading(false);
  } catch (error) {
    console.error('Error loading environment variables:', error);
    setIsLoading(false);
  }
  };

  const handleEdit = (key: string, currentValue: string) => {
    setEditingKey(key);
    setEditValue(currentValue);
  };

  const handleSave = async (key: string) => {
    try {
      const response = await fetch('/api/admin/virtual-update-env', {
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

  const toggleSubcategory = (subcategory: string) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subcategory)) {
        newSet.delete(subcategory);
      } else {
        newSet.add(subcategory);
      }
      return newSet;
    });
  };

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

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      resend: '📧',
      cloudinary: '☁️',
      firebase: '🔥',
      airtable: '📊',
      shipping: '🚚',
      payment: '💳',
      security: '🔒',
      relations: '🔗'
    };
    return icons[category] || '⚙️';
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      resend: 'border-l-4 border-l-blue-500',
      cloudinary: 'border-l-4 border-l-green-500',
      firebase: 'border-l-4 border-l-orange-500',
      airtable: 'border-l-4 border-l-purple-500',
      shipping: 'border-l-4 border-l-yellow-500',
      payment: 'border-l-4 border-l-indigo-500',
      security: 'border-l-4 border-l-red-500',
      relations: 'border-l-4 border-l-teal-500'
    };
    return colors[category] || '';
  };

  const getCategoryIconBg = (category: string) => {
    const backgrounds: Record<string, string> = {
      resend: 'bg-blue-100',
      cloudinary: 'bg-green-100',
      firebase: 'bg-orange-100',
      airtable: 'bg-purple-100',
      shipping: 'bg-yellow-100',
      payment: 'bg-indigo-100',
      security: 'bg-red-100',
      relations: 'bg-teal-100'
    };
    return backgrounds[category] || 'bg-gray-100';
  };

  const getCategoryDescription = (category: string) => {
    const descriptions: Record<string, string> = {
      resend: 'Configuración para envío de emails',
      cloudinary: 'Configuración para almacenamiento de imágenes',
      firebase: 'Configuración de autenticación y base de datos',
      airtable: 'Configuración para sincronización con Airtable',
      shipping: 'Configuración de envíos y logística',
      payment: 'Configuración de métodos de pago',
      security: 'Configuración de seguridad y permisos',
      relations: 'Gestión de relaciones entre categorías y subcategorías'
    };
    return descriptions[category] || 'Configuración general';
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
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-black text-center">Inicio de Sesión de Administrador Virtual</h1>
        <button
          onClick={handleLogin}
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
          onClick={handleLogout}
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
                <p className="text-sm font-medium text-gray-900">Admin Tienda Virtual</p>
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
                    Ajustes Tienda Virtual
                  </h1>
                  <p className="text-xs md:text-sm text-blue-600">Gestiona las variables de entorno del sistema tienda virtual</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 lg:gap-8 auto-rows-start">
          {['resend', 'cloudinary', 'firebase', 'airtable', 'shipping', 'payment', 'security', 'relations'].map(category => {
            const categoryVariables = envVariables.filter(v => v.category === category);
            const activeVariables = categoryVariables.filter(v => v.value && v.value.trim() !== '');
            const inactiveVariables = categoryVariables.filter(v => !v.value || v.value.trim() === '');
            
            return (
              <div key={category} className={`bg-white rounded-xl md:rounded-2xl shadow-xl border border-gray-100 overflow-hidden ${getCategoryColor(category)} h-fit`}>
                {/* Category Header */}
                <div 
                  className="p-4 md:p-8 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection(category);
                  }}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center space-x-2 md:space-x-4">
                      <div className={`p-2 md:p-3 rounded-lg md:rounded-xl ${getCategoryIconBg(category)}`}>
                        <span className="text-lg md:text-2xl">{getCategoryIcon(category)}</span>
                      </div>
                      <div>
                        <h2 className="text-lg md:text-2xl font-bold text-gray-900">
                          {category === 'relations' ? 'Category-Subcategory Relations' : category.charAt(0).toUpperCase() + category.slice(1)}
                        </h2>
                        <p className="text-xs md:text-sm text-gray-600">{getCategoryDescription(category)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end space-x-4">
                      <div className="text-right">
                        {category === 'relations' ? (
                          <div className="text-xl md:text-3xl font-bold text-gray-900">🔗</div>
                        ) : (
                          <>
                            <div className="text-xl md:text-3xl font-bold text-gray-900">{activeVariables.length}</div>
                            <div className="text-xs text-gray-600 leading-tight whitespace-nowrap">de {categoryVariables.length} activas</div>
                          </>
                        )}
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
                
                {/* Content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  expandedSections.has(category) ? 
                    'max-h-[5000px] opacity-100 visible' : 
                    'max-h-0 opacity-0 invisible'
                }`}>
                  {category === 'relations' ? (
                    <div className="p-4 md:p-8">
                      <CategorySubcategoryManager />
                    </div>
                  ) : (
                    <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                      {category === 'payment' ? (
                        // Group payment variables by subcategory
                        (() => {
                          const subcategories = ['wompi', 'pse', 'stripe', 'bank'];
                          return subcategories.map(subcategory => {
                            const subcategoryVariables = categoryVariables.filter(v => v.subcategory === subcategory);
                            if (subcategoryVariables.length === 0) return null;
                            
                            const subcategoryIcons: Record<string, string> = {
                              wompi: '💳',
                              pse: '🏦',
                              stripe: '💳',
                              bank: '🏛️'
                            };
                            
                            const subcategoryNames: Record<string, string> = {
                              wompi: 'Wompi Gateway',
                              pse: 'PSE Gateway',
                              stripe: 'Stripe Gateway',
                              bank: 'Bank Account Details'
                            };
                            
                            const subcategoryColors: Record<string, string> = {
                              wompi: 'border-l-4 border-l-indigo-500',
                              pse: 'border-l-4 border-l-emerald-500',
                              stripe: 'border-l-4 border-l-purple-500',
                              bank: 'border-l-4 border-l-cyan-500'
                            };
                            
                            const subcategoryBgs: Record<string, string> = {
                              wompi: 'bg-indigo-50',
                              pse: 'bg-emerald-50',
                              stripe: 'bg-purple-50',
                              bank: 'bg-cyan-50'
                            };
                            
                                                         return (
                               <div key={subcategory} className={`rounded-lg md:rounded-xl border-2 ${subcategoryColors[subcategory]} ${subcategoryBgs[subcategory]}`}>
                                 {/* Subcategory Header */}
                                 <div 
                                   className="p-4 md:p-6 cursor-pointer hover:bg-opacity-80 transition-colors duration-200"
                                   onClick={() => toggleSubcategory(subcategory)}
                                 >
                                   <div className="flex items-center justify-between">
                                     <div className="flex items-center space-x-3">
                                       <span className="text-xl md:text-2xl">{subcategoryIcons[subcategory]}</span>
                                       <h3 className="text-lg md:text-xl font-bold text-gray-900">{subcategoryNames[subcategory]}</h3>
                                     </div>
                                     <div className={`transform transition-transform duration-300 ${expandedSubcategories.has(subcategory) ? 'rotate-180' : 'rotate-0'}`}>
                                       <span className="text-lg md:text-xl font-bold text-gray-700">▼</span>
                                     </div>
                                   </div>
                                 </div>
                                 
                                 {/* Subcategory Content */}
                                 <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                   expandedSubcategories.has(subcategory) ? 
                                     'max-h-[2000px] opacity-100' : 
                                     'max-h-0 opacity-0'
                                 }`}>
                                   <div className="p-4 md:p-6 pt-0 space-y-4 md:space-y-6">
                                  {subcategoryVariables.map(variable => {
                                    const isActive = variable.value && variable.value.trim() !== '';
                                    
                                    return (
                                      <div key={variable.key} className={`bg-white rounded-lg md:rounded-xl p-4 md:p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                                        isActive 
                                          ? 'border-green-200 hover:border-green-300' 
                                          : 'border-gray-200 hover:border-gray-300'
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
                                        
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                          {editingKey === variable.key ? (
                                            <div className="flex-1 space-y-3">
                                              <input
                                                type={variable.isSecret && !showSecrets ? 'password' : 'text'}
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-500"
                                                placeholder={`Ingresa el valor para ${variable.key}`}
                                              />
                                              <div className="flex space-x-2">
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
                                   </div>
                                 </div>
                               </div>
                             );
                          });
                        })()
                      ) : (
                        // Regular rendering for non-payment categories
                        categoryVariables.map(variable => {
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
                              
                              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                {editingKey === variable.key ? (
                                  <div className="flex-1 space-y-3">
                                    <input
                                      type={variable.isSecret && !showSecrets ? 'password' : 'text'}
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="w-full px-3 py-2 md:py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-gray-900 placeholder-gray-500"
                                      placeholder={`Ingresa el valor para ${variable.key}`}
                                    />
                                    <div className="flex space-x-2">
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
                        })
                      )}
                    </div>
                  )}
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