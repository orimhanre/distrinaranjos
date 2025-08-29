'use client';
import React, { useEffect, useState } from 'react';
import { useClientAuth } from '@/lib/useClientAuth';
import { virtualAuth } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, deleteField, setDoc } from 'firebase/firestore';
import { virtualDb } from '@/lib/firebase';
import { useToast } from '@/lib/toastContext';
import { addOrderToUserProfile, getUserOrders, updateOrderStatus, type UserOrder, type OrderItem } from '@/lib/userOrderService';

interface UserProfile {
  // Personal Information
  nombre: string;
  apellido: string;
  cedula: string;
  
  // Contact Information
  correo: string;
  celular: string;
  
  // Address Information
  direccion: string;
  ciudad: string;
  departamento: string;
  codigoPostal: string;
  
  // Account Information
  createdAt: any;
  lastLogin: any;
  lastUpdated?: any;
  isActive: boolean;
  
  // Orders History
  orders?: UserOrder[];
}

// Colombian departments for the dropdown
const colombianDepartments = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá',
  'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare',
  'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo',
  'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada'
];

export default function ClientPortalProfilePage() {
  const { user } = useClientAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    celular: '',
    cedula: '',
    direccion: '',
    ciudad: '',
    departamento: '',
    codigoPostal: ''
  });

  const cleanupLeftoverData = async () => {
    // This function was causing data loss - removed to prevent automatic profile resets
    // The cleanup logic was incorrectly comparing timestamps and clearing user data
    // The original logic was:
    // 1. Comparing profile creation time with user authentication time
    // 2. Clearing personal data if profile was "older" than auth time
    // 3. Deleting and recreating profiles if they were older than 1 hour
    // This caused client data to be reset every 10 minutes due to Firebase Auth token refreshes
    return;
  };

  useEffect(() => {
    if (user?.email) {
                // Check for pending profile data from checkout before loading profile
          const pendingProfileData = sessionStorage.getItem('pendingProfileData');
          if (pendingProfileData) {
            try {
              const pendingData = JSON.parse(pendingProfileData);
              
              // Check if the pending data is recent (within last 30 minutes)
              const isRecent = (Date.now() - pendingData.timestamp) < 30 * 60 * 1000;
              
              if (isRecent) {
                // Auto-save the pending profile data
                const savePendingData = async () => {
                  try {
                    const response = await fetch('/api/client-portal/create-profile', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        userEmail: user.email,
                        userName: user.displayName,
                        userPhotoURL: user.photoURL,
                        profileData: {
                          firstName: pendingData.firstName,
                          lastName: pendingData.lastName,
                          email: pendingData.email,
                          phone: pendingData.phone,
                          cedula: pendingData.cedula,
                          address: pendingData.address,
                          city: pendingData.city,
                          department: pendingData.department,
                          postalCode: pendingData.postalCode,
                          lastUpdated: new Date()
                        }
                      }),
                    });

                    if (response.ok) {
                      const result = await response.json();
                      
                      // Clear the pending data
                      sessionStorage.removeItem('pendingProfileData');
                      
                      // Show success message
                      showToast('✅ Tu información ha sido guardada automáticamente en tu perfil', 'success');
                      
                      // Load the profile after saving
                      loadProfile();
                    } else {
                      loadProfile(); // Load profile anyway
                    }
                  } catch (error) {
                    loadProfile(); // Load profile anyway
                  }
                };
                
                savePendingData();
                return; // Exit early since we're handling the pending data
              } else {
                sessionStorage.removeItem('pendingProfileData');
              }
            } catch (parseError) {
              sessionStorage.removeItem('pendingProfileData');
            }
          }
      
      // Load profile without cleanup to prevent data loss
      // Only reload when email changes, not when user object changes
      void loadProfile();
    }
  }, [user?.email]); // Only depend on email, not entire user object

  const loadProfile = async () => {
    if (!user?.email) return;
    if (!virtualDb) {
      console.error('Virtual database not available');
      return;
    }

    try {
      setLoading(true);
      
      console.log('🔍 Profile: Loading profile for email:', user.email);
      
      // Try to get existing profile
      const profileDoc = await getDoc(doc(virtualDb, 'clients', user.email));
      
      if (profileDoc.exists()) {
        const data = profileDoc.data();
        
        // Use existing profile data without any cleanup or recreation
        // Previously, this function would delete and recreate profiles if they were older than 1 hour
        // This caused data loss every 10 minutes due to Firebase Auth token refreshes
        // Now we simply load and use the existing data without any destructive operations
        const cleanData = {
          correo: user.email,
          nombre: data.nombre || data.firstName || user.displayName?.split(' ')[0] || '',
          apellido: data.apellido || data.lastName || user.displayName?.split(' ').slice(1).join(' ') || '',
          celular: data.celular || data.phone || '',
          cedula: data.cedula || '',
          direccion: data.direccion || data.address || '',
          ciudad: data.ciudad || data.city || '',
          departamento: data.departamento || data.department || '',
          codigoPostal: data.codigoPostal || data.postalCode || '',
          createdAt: data.createdAt || new Date(),
          lastLogin: data.lastLogin || new Date(),
          isActive: data.isActive !== false,
          orders: data.orders || []
        };
        
        setProfile(cleanData);
        setFormData({
          nombre: cleanData.nombre,
          apellido: cleanData.apellido,
          celular: cleanData.celular,
          cedula: cleanData.cedula,
          direccion: cleanData.direccion,
          ciudad: cleanData.ciudad,
          departamento: cleanData.departamento,
          codigoPostal: cleanData.codigoPostal
        });
      } else {
        // Create new profile with basic info
        const now = new Date();
        const newProfile = {
          correo: user.email,
          nombre: user.displayName?.split(' ')[0] || '',
          apellido: user.displayName?.split(' ').slice(1).join(' ') || '',
          celular: '',
          cedula: '',
          direccion: '',
          ciudad: '',
          departamento: '',
          codigoPostal: '',
          createdAt: now,
          lastLogin: now,
          isActive: true,
          orders: []
        };
        
        setProfile(newProfile);
        setFormData({
          nombre: newProfile.nombre,
          apellido: newProfile.apellido,
          celular: newProfile.celular,
          cedula: newProfile.cedula,
          direccion: newProfile.direccion,
          ciudad: newProfile.ciudad,
          departamento: newProfile.departamento,
          codigoPostal: newProfile.codigoPostal
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.email || !virtualDb) return;
    
    try {
      setSaving(true);
      
      const updatedProfile: UserProfile = {
        ...profile!,
        ...formData,
        lastUpdated: new Date()
      };
      
      console.log('🔍 Profile: Saving profile data:', updatedProfile);
      console.log('🔍 Profile: Form data being saved:', formData);
      
      // Save to both the main profile document and ensure data persistence
      const profileRef = doc(virtualDb, 'clients', user.email);
      await setDoc(profileRef, updatedProfile, { merge: true });
      
      console.log('🔍 Profile: Profile saved successfully to document:', profileRef.path);
      console.log('🔍 Profile: Document ID:', user.email);
      console.log('🔍 Profile: Collection: clients');
      
      // Verify the data was actually saved by reading it back
      const verificationDoc = await getDoc(profileRef);
      if (verificationDoc.exists()) {
        console.log('✅ Profile verification successful - data persisted:', verificationDoc.data());
      } else {
        console.error('❌ Profile verification failed - document does not exist after save');
      }
      
      setProfile(updatedProfile);
      setEditing(false);
      setShowSuccessMessage(true);
      
      setTimeout(() => setShowSuccessMessage(false), 5000);
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: profile?.nombre || '',
      apellido: profile?.apellido || '',
      celular: profile?.celular || '',
      cedula: profile?.cedula || '',
      direccion: profile?.direccion || '',
      ciudad: profile?.ciudad || '',
      departamento: profile?.departamento || '',
      codigoPostal: profile?.codigoPostal || ''
    });
    setEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🗑️ Delete button clicked, showing confirmation modal');
    setShowDeleteConfirm(true);
  };

  const handleDeleteAccount = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user?.email || !user?.uid) {
      console.error('User information not available');
      return;
    }

    if (deleting) {
      console.log('⚠️ Delete already in progress, ignoring click');
      return;
    }

    try {
      console.log('🗑️ Starting account deletion process...');
      
      // Update states atomically to prevent race conditions
      setDeleting(true);
      setShowDeleteConfirm(false);
      
      // Small delay to ensure state updates are processed
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('🗑️ Calling delete account API for:', user.email);

      const response = await fetch('/api/client-portal/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Account deleted successfully');
        
        // Sign out from Firebase and redirect to login page
        try {
          if (virtualAuth) {
            await virtualAuth.signOut();
            console.log('✅ User signed out from Virtual Firebase after account deletion');
          }

          // Clear any local storage or session data
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            sessionStorage.clear();
            localStorage.removeItem('firebase:authUser:');
            localStorage.removeItem('firebase:authUser:virtual:');

            // Force redirect to login page
            window.location.replace('/client-portal/login');
          }
        } catch (signOutError) {
          console.error('❌ Error signing out user:', signOutError);
          // Even if sign out fails, redirect to login page
          if (typeof window !== 'undefined') {
            localStorage.removeItem('user');
            sessionStorage.clear();
            localStorage.removeItem('firebase:authUser:');
            localStorage.removeItem('firebase:authUser:virtual:');
            window.location.replace('/client-portal/login');
          }
        }
      } else {
        console.error('❌ Failed to delete account:', result.error);
        // Reset states on failure
        setDeleting(false);
        setShowDeleteConfirm(true);
      }
    } catch (error) {
      console.error('❌ Error during account deletion:', error);
      // Reset states on error
      setDeleting(false);
      setShowDeleteConfirm(true);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    
    try {
      let dateObj: Date;
      
      // Handle Firestore Timestamp objects
      if (date && typeof date === 'object' && date.toDate) {
        dateObj = date.toDate();
      } else if (date && typeof date === 'object' && date.seconds) {
        // Handle Firestore Timestamp with seconds property
        dateObj = new Date(date.seconds * 1000);
      } else {
        // Handle regular Date objects or date strings
        dateObj = new Date(date);
      }
      
      // Check if the date is valid
      if (isNaN(dateObj.getTime())) {
        console.log('⚠️ Invalid date detected:', date);
        return 'N/A';
      }
      
      return dateObj.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.log('⚠️ Error formatting date:', error, 'Date value:', date);
      return 'N/A';
    }
  };

  const isProfileComplete = profile && 
    profile.nombre && 
    profile.apellido && 
    profile.celular && 
    profile.cedula && 
    profile.direccion && 
    profile.ciudad && 
    profile.departamento;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No se pudo cargar el perfil</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Mi Perfil</h1>
                <p className="text-sm sm:text-base text-gray-600">
                  {isProfileComplete 
                    ? 'Tu perfil está completo y listo para usar en el checkout'
                    : 'Completa tu perfil para agilizar el proceso de checkout'
                  }
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
              {!editing && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isProfileComplete ? 'Editar Perfil' : 'Completar Perfil'}
                  </button>


                </>
              )}
              {editing && (
                <div className="flex space-x-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              )}
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Eliminando...
                  </>
                ) : (
                  'Eliminar Cuenta'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800">
                  ¡Perfil actualizado exitosamente!
                </h3>
                <p className="text-sm text-green-700">
                  Tu información ha sido guardada y está lista para usar.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
          <div className="mb-2 sm:mb-4">
            <div className="flex items-center space-x-2 mb-1">
              <div className="w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-base sm:text-xl font-semibold text-gray-900">
                Información del Perfil
              </h2>
            </div>
          </div>

          {editing ? (
            <div className="space-y-2 sm:space-y-3">
              {/* Personal Information */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 sm:p-3 border border-blue-100">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Información Personal
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div>
                    <label htmlFor="nombre" className="block text-xs sm:text-sm font-medium text-blue-900 mb-0.5">
                      Nombre <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="nombre"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-colors hover:border-blue-300"
                      placeholder="Tu nombre"
                    />
                  </div>

                  <div>
                    <label htmlFor="apellido" className="block text-xs sm:text-sm font-medium text-blue-900 mb-0.5">
                      Apellidos <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="apellido"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-colors hover:border-blue-300"
                      placeholder="Tus apellidos"
                    />
                  </div>



                  <div>
                    <label htmlFor="cedula" className="block text-xs sm:text-sm font-medium text-blue-900 mb-0.5">
                      Cédula <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="cedula"
                      value={formData.cedula}
                      onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-blue-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-colors hover:border-blue-300"
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2 sm:p-3 border border-green-100">
                <h3 className="text-xs sm:text-sm font-semibold text-green-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Información de Dirección
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div>
                    <label htmlFor="direccion" className="block text-xs sm:text-sm font-medium text-green-900 mb-0.5">
                      Dirección <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="direccion"
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-colors hover:border-green-300"
                      placeholder="Calle 123 #45-67"
                    />
                  </div>

                  <div>
                    <label htmlFor="ciudad" className="block text-xs sm:text-sm font-medium text-green-900 mb-0.5">
                      Ciudad <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-colors hover:border-green-300"
                      placeholder="Bogotá"
                    />
                  </div>

                  <div>
                    <label htmlFor="departamento" className="block text-xs sm:text-sm font-medium text-green-900 mb-0.5">
                      Departamento <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="departamento"
                      value={formData.departamento}
                      onChange={(e) => setFormData({ ...formData, departamento: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-colors hover:border-green-300"
                    >
                      <option value="">Selecciona un departamento</option>
                      {colombianDepartments.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="codigoPostal" className="block text-xs sm:text-sm font-medium text-green-900 mb-0.5">
                      Código Postal
                    </label>
                    <input
                      type="text"
                      id="codigoPostal"
                      value={formData.codigoPostal}
                      onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-green-200 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900 bg-white transition-colors hover:border-green-300"
                      placeholder="110111"
                    />
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2 sm:p-3 border border-purple-100">
                <h3 className="text-xs sm:text-sm font-semibold text-purple-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Información de Contacto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div>
                    <label htmlFor="celular" className="block text-xs sm:text-sm font-medium text-purple-900 mb-0.5">
                      Teléfono <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      id="celular"
                      value={formData.celular}
                      onChange={(e) => setFormData({ ...formData, celular: e.target.value })}
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-purple-200 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white transition-colors hover:border-purple-300"
                      placeholder="+57 300 123 4567"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-xs sm:text-sm font-medium text-purple-900 mb-0.5">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={profile.correo}
                      disabled
                      className="w-full px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-purple-200 rounded-md bg-purple-50 text-purple-700 cursor-not-allowed font-medium"
                    />
                    <p className="text-xs text-purple-600 mt-0.5 flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      El email no se puede cambiar
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {/* Personal Information Display */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-2 sm:p-3 border border-blue-100">
                <h3 className="text-xs sm:text-sm font-semibold text-blue-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Información Personal
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium mb-0.5">Nombre(s) y Apellido(s)</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.nombre} {profile.apellido}</div>
                  </div>

                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-blue-200">
                    <div className="text-xs text-blue-600 font-medium mb-0.5">Cédula</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.cedula || 'No especificado'}</div>
                  </div>
                </div>
              </div>

              {/* Address Information Display */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2 sm:p-3 border border-green-100">
                <h3 className="text-xs sm:text-sm font-semibold text-green-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Información de Dirección
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-green-200">
                    <div className="text-xs text-green-600 font-medium mb-0.5">Dirección</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.direccion || 'No especificado'}</div>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-green-200">
                    <div className="text-xs text-green-600 font-medium mb-0.5">Ciudad</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.ciudad || 'No especificado'}</div>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-green-200">
                    <div className="text-xs text-green-600 font-medium mb-0.5">Departamento</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.departamento || 'No especificado'}</div>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-green-200">
                    <div className="text-xs text-green-600 font-medium mb-0.5">Código Postal</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.codigoPostal || 'No especificado'}</div>
                  </div>
                </div>
              </div>

              {/* Contact Information Display */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-2 sm:p-3 border border-purple-100">
                <h3 className="text-xs sm:text-sm font-semibold text-purple-900 mb-1.5 sm:mb-2 flex items-center">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Información de Contacto
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 sm:gap-2">
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">Teléfono</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.celular || 'No especificado'}</div>
                  </div>
                  <div className="bg-white rounded-md p-1.5 sm:p-2 border border-purple-200">
                    <div className="text-xs text-purple-600 font-medium mb-0.5">Email</div>
                    <div className="text-xs sm:text-sm font-semibold text-gray-900">{profile.correo}</div>
                  </div>
                </div>
              </div>

              {/* Google Account Footer Note */}
              <div className="bg-gray-50 rounded-md p-2 sm:p-3 border border-gray-200">
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600">
                  <svg className="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span><strong>Cuenta de Google:</strong> Tu cuenta está vinculada a Google. Para cambiar la contraseña, visita tu cuenta de Google.</span>
                </div>
              </div>
            </div>
          )}

          {/* Privacy and Security Information */}
          <div className="mt-6 p-4 sm:p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0">
              <div className="flex-shrink-0 mx-auto sm:mx-0">
                <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="sm:ml-3 text-center sm:text-left">
                <h3 className="text-base sm:text-lg font-medium text-blue-900 mb-2">Seguridad y Privacidad de Datos</h3>
                <div className="space-y-3 text-xs sm:text-sm text-blue-800">
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-2 sm:space-y-0">
                    <svg className="h-4 w-4 text-blue-600 mx-auto sm:mx-0 sm:mt-0.5 sm:mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-center sm:text-left"><strong>Almacenamiento Seguro en Google Cloud:</strong> Todos tus datos personales, pedidos e información de perfil se almacenan de forma segura en la infraestructura de Google Cloud (Firestore), utilizando los mismos estándares de seguridad que Google utiliza para proteger sus propios servicios.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-2 sm:space-y-0">
                    <svg className="h-4 w-4 text-blue-600 mx-auto sm:mx-0 sm:mt-0.5 sm:mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-center sm:text-left"><strong>Encriptación de Datos:</strong> Toda la información se transmite y almacena de forma encriptada. Google Cloud implementa encriptación AES-256 tanto en tránsito como en reposo, garantizando la máxima protección de tu información personal.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-2 sm:space-y-0">
                    <svg className="h-4 w-4 text-blue-600 mx-auto sm:mx-0 sm:mt-0.5 sm:mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-center sm:text-left"><strong>Consolidación de Datos:</strong> Tu perfil, historial de pedidos y toda la información relacionada se mantiene consolidada en una sola ubicación segura, eliminando la fragmentación de datos y mejorando la protección de tu privacidad.</span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start space-y-2 sm:space-y-0">
                    <svg className="h-4 w-4 text-blue-600 mx-auto sm:mx-0 sm:mt-0.5 sm:mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-center sm:text-left"><strong>Cumplimiento de Estándares:</strong> Google Cloud cumple con los más altos estándares internacionales de seguridad, incluyendo ISO 27001, SOC 2, y GDPR, asegurando que tu información esté protegida según las mejores prácticas de la industria.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-black mb-3">Información de la Cuenta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="font-medium text-black mb-1 sm:mb-0">Cuenta creada:</span>
              <span className="sm:ml-2 text-gray-600">{formatDate(profile.createdAt)}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="font-medium text-black mb-1 sm:mb-0">Último acceso:</span>
              <span className="sm:ml-2 text-gray-600">{formatDate(profile.lastLogin)}</span>
            </div>
          </div>
        </div>

        {/* Google Account Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 text-center sm:text-left">
            <svg className="w-6 h-6 text-blue-600 mx-auto sm:mx-0" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Cuenta de Google
              </h3>
              <p className="text-sm text-blue-700">
                Tu cuenta está vinculada a Google. Para cambiar la contraseña, 
                visita tu cuenta de Google.
              </p>
            </div>
          </div>
        </div>

        {/* Delete Account Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 text-center sm:text-left">
                ¿Estás seguro de que quieres eliminar tu cuenta?
              </h3>
              <p className="text-sm text-gray-600 mb-4 sm:mb-6 text-center sm:text-left">
                Esta acción eliminará permanentemente tu perfil, historial de pedidos y toda la información asociada. 
                Esta acción no se puede deshacer.
              </p>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full sm:flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="w-full sm:flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {deleting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Eliminando...
                    </>
                  ) : (
                    'Eliminar Cuenta'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
