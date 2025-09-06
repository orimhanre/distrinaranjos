'use client';
import React, { useState, useEffect } from 'react';
import { useCart } from '@/lib/cartContext';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { useClientAuth } from '@/lib/useClientAuth';
import { useToast } from '@/lib/toastContext';
import { addOrderToUserProfile, type UserOrder, type OrderItem } from '@/lib/userOrderService';

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cedula: string;
  address: string;
  city: string;
  department: string;
  postalCode: string;
  saveForFuture?: boolean;
  savedAt?: number;
}

interface PaymentInfo {
  method: string;
  cardNumber?: string;
  cardName?: string;
  cardExpiry?: string;
  cardCvv?: string;
}

const colombianDepartments = [
  'Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bolívar', 'Boyacá',
  'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó',
  'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira',
  'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío',
  'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima',
  'Valle del Cauca', 'Vaupés', 'Vichada'
];

export default function CheckoutPage() {
  const router = useRouter();
  
  // Helper function to process image URLs (same logic as cart page)
  const getProcessedImageUrl = (rawUrl: string): string => {
    if (!rawUrl || rawUrl === '/placeholder-product.svg') {
      return '/placeholder-product.svg';
    }
    
    // If it's already an API endpoint, return as is
    if (rawUrl.startsWith('/api/images/')) {
      return rawUrl;
    }
    
    // If it's already a valid URL (Cloudinary, Airtable, etc.), return as is
    if (rawUrl.includes('res.cloudinary.com') || rawUrl.includes('dl.airtable.com')) {
      return rawUrl;
    }
    
    // Extract filename from URL
    const filename = rawUrl.split('/').pop() || rawUrl;
    
    // Use the correct API endpoint structure: /api/images/products/filename
    return `/api/images/products/${filename}`;
  };
  const cartContext = useCart();
  const { user, loading: authLoading } = useClientAuth();
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [shippingInfo, setShippingInfo] = useLocalStorage<ShippingInfo>('checkout-shipping-info', {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    cedula: '',
    address: '',
    city: '',
    department: '',
    postalCode: ''
  });





  // Safely destructure cart context with fallbacks
  const cartItems = cartContext?.cartItems || [];
  const getTotalPrice = cartContext?.getTotalPrice || (() => 0);
  const getTotalItems = cartContext?.getTotalItems || (() => 0);
  const clearCart = cartContext?.clearCart || (() => {});

  // Add loading state for cart context
  const [isCartLoading, setIsCartLoading] = useState(true);

  useEffect(() => {
    if (cartContext) {
      setIsCartLoading(false);
    }
  }, [cartContext]);


  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>({
    method: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingConfig, setShippingConfig] = useState({
    freeShippingThreshold: 100000,
    shippingCost: 15000,
    estimatedDays: 3
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  // Function to get the correct price for an item
  // The price in cart items is already correct (discounted if promotional)
  const getItemPrice = (item: any) => {
    return item.price;
  };



  // Fetch shipping configuration
  React.useEffect(() => {
    const fetchShippingConfig = async () => {
      try {
        const response = await fetch('/api/shipping-config', {
          cache: 'no-store'
        });
        if (response.ok) {
          const config = await response.json();
          setShippingConfig(config);
        }
              } catch (error) {
          // Error fetching shipping config
        }
    };

    fetchShippingConfig();
  }, []);

  // Auto-fill Google account data when user is available
  useEffect(() => {
    if (user && !shippingInfo.firstName && !shippingInfo.lastName && !shippingInfo.email) {
      const newShippingInfo = {
        ...shippingInfo,
        firstName: user.displayName?.split(' ')[0] || '',
        lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
        email: user.email || ''
      };
      setShippingInfo(newShippingInfo);
    }
  }, [user, shippingInfo, setShippingInfo]);

  // Load saved profile data when user logs in
  useEffect(() => {
    const loadSavedProfileData = async () => {
      if (user?.email) {
        try {
          // Check for pending profile data from before login
          const pendingProfileData = sessionStorage.getItem('pendingProfileData');
          if (pendingProfileData) {
            try {
              const pendingData = JSON.parse(pendingProfileData);
              
              // Check if the pending data is recent (within last 30 minutes)
              const isRecent = (Date.now() - pendingData.timestamp) < 30 * 60 * 1000;
              
              if (isRecent) {
                // Auto-save the pending profile data
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
                  
                  // Update the shipping info with the saved data
                  setShippingInfo(prev => ({
                    ...prev,
                    firstName: pendingData.firstName,
                    lastName: pendingData.lastName,
                    email: pendingData.email,
                    phone: pendingData.phone,
                    cedula: pendingData.cedula,
                    address: pendingData.address,
                    city: pendingData.city,
                    department: pendingData.department,
                    postalCode: pendingData.postalCode,
                    saveForFuture: true,
                    savedAt: Date.now()
                  }));
                  
                  // Show success message
                  showToast('✅ Tu información de envío ha sido guardada automáticamente en tu perfil', 'success');
                  
                  return; // Exit early since we just saved the data
                }
              } else {
                sessionStorage.removeItem('pendingProfileData');
              }
            } catch (parseError) {
              sessionStorage.removeItem('pendingProfileData');
            }
          }
          
          // Try to load profile data directly from client-side Firebase first
          if (typeof window !== 'undefined') {
            try {
              const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');
              const { virtualDb } = await import('@/lib/firebase');
              
              if (virtualDb) {
                // Try to get profile by document ID (email)
                const profileDoc = await getDoc(doc(virtualDb, 'clients', user.email));
                
                if (profileDoc.exists()) {
                  const profileData = profileDoc.data();
                  
                  // Update shipping info with saved profile data
                  setShippingInfo(prev => {
                    const updatedInfo = {
                      ...prev,
                      firstName: profileData.nombre || profileData.firstName || prev.firstName,
                      lastName: profileData.apellido || profileData.lastName || prev.lastName,
                      email: profileData.correo || profileData.email || prev.email,
                      phone: profileData.celular || profileData.phone || prev.phone,
                      cedula: profileData.cedula || prev.cedula,
                      address: profileData.direccion || profileData.address || prev.address,
                      city: profileData.ciudad || profileData.city || prev.city,
                      department: profileData.departamento || profileData.department || prev.department,
                      postalCode: profileData.codigoPostal || profileData.postalCode || prev.postalCode,
                      saveForFuture: true
                    };
                    return updatedInfo;
                  });
                  return; // Exit early if we found the profile
                } else {
                  // Try to find profile by email field
                  const querySnapshot = await getDocs(query(collection(virtualDb, 'clients'), where('email', '==', user.email)));
                  
                  if (!querySnapshot.empty) {
                    const profileData = querySnapshot.docs[0].data();
                    
                    // Update shipping info with saved profile data
                    setShippingInfo(prev => {
                      const updatedInfo = {
                        ...prev,
                        firstName: profileData.nombre || profileData.firstName || prev.firstName,
                        lastName: profileData.apellido || profileData.lastName || prev.lastName,
                        email: profileData.correo || profileData.email || prev.email,
                        phone: profileData.celular || profileData.phone || prev.phone,
                        cedula: profileData.cedula || prev.cedula,
                        address: profileData.direccion || profileData.address || prev.address,
                        city: profileData.ciudad || profileData.city || prev.city,
                        department: profileData.departamento || profileData.department || prev.department,
                        postalCode: profileData.codigoPostal || profileData.postalCode || prev.postalCode,
                        saveForFuture: true
                      };
                      return updatedInfo;
                    });
                    return; // Exit early if we found the profile
                  }
                }
              }
            } catch (clientError) {
              // Fallback to API if client-side Firebase fails
            }
          }
          
          // Fallback to API if client-side Firebase fails
          const response = await fetch(`/api/client-portal/profile?email=${user.email}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.profile) {
              // Update shipping info with saved profile data
              setShippingInfo(prev => {
                const updatedInfo = {
                  ...prev,
                  firstName: data.profile.nombre || data.profile.firstName || prev.firstName,
                  lastName: data.profile.apellido || data.profile.lastName || prev.lastName,
                  email: data.profile.correo || data.profile.email || prev.email,
                  phone: data.profile.celular || data.profile.phone || prev.phone,
                  cedula: data.profile.cedula || prev.cedula,
                  address: data.profile.direccion || data.profile.address || prev.address,
                  city: data.profile.ciudad || data.profile.city || prev.city,
                  department: data.profile.departamento || data.profile.department || prev.department,
                  postalCode: data.profile.codigoPostal || data.profile.postalCode || prev.postalCode,
                  saveForFuture: true
                };
                return updatedInfo;
              });
            }
          }
        } catch (error) {
          // Handle error silently
        }
      }
    };

    // Add a small delay to ensure user object is fully loaded
    if (user?.email && !authLoading) {
      const timer = setTimeout(() => {
        loadSavedProfileData();
      }, 1000); // Increased delay to ensure everything is loaded
      return () => clearTimeout(timer);
    }
  }, [user?.email, user, authLoading]);

    // Handle saving shipping data to virtual database
  const handleSaveShippingData = async () => {
    // For non-logged-in users, check if they want to save for future
    if (!user?.email) {
      if (!shippingInfo.saveForFuture) return;
      
      // Store the form data in sessionStorage before redirecting to login
      sessionStorage.setItem('pendingProfileData', JSON.stringify({
        firstName: shippingInfo.firstName,
        lastName: shippingInfo.lastName,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        cedula: shippingInfo.cedula,
        address: shippingInfo.address,
        city: shippingInfo.city,
        department: shippingInfo.department,
        postalCode: shippingInfo.postalCode,
        saveForFuture: true,
        timestamp: Date.now()
      }));
      
      // If user is not logged in, redirect to login
      const returnUrl = encodeURIComponent(window.location.href);
      window.location.href = `/client-portal/login?returnUrl=${returnUrl}`;
      return;
    }

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
            firstName: shippingInfo.firstName,
            lastName: shippingInfo.lastName,
            email: shippingInfo.email,
            phone: shippingInfo.phone,
            cedula: shippingInfo.cedula,
            address: shippingInfo.address,
            city: shippingInfo.city,
            department: shippingInfo.department,
            postalCode: shippingInfo.postalCode,
            lastUpdated: new Date()
          }
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setShippingInfo(prev => ({
          ...prev,
          savedAt: Date.now()
        }));
        
        // Show success message
        showToast('✅ Información guardada exitosamente en tu perfil', 'success');
      } else {
        const errorText = await response.text();
        showToast('❌ Error al guardar la información. Por favor intenta de nuevo.', 'error');
      }
    } catch (error) {
      showToast('❌ Error al guardar la información. Por favor intenta de nuevo.', 'error');
    }
  };

  



  // Calculate shipping costs
  const subtotal = getTotalPrice();
  const needsShipping = subtotal < shippingConfig.freeShippingThreshold;
  const shippingCost = needsShipping ? shippingConfig.shippingCost : 0;
  const total = subtotal + shippingCost;

  const handleShippingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Custom validation with Spanish messages
    const form = e.target as HTMLFormElement;
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach((input) => {
      const element = input as HTMLInputElement | HTMLSelectElement;
      if (!element.value.trim()) {
        isValid = false;
        element.setCustomValidity('Este campo es obligatorio');
        element.reportValidity();
      } else {
        // Special validation for email field
        if (element.type === 'email') {
          const email = element.value;
          if (!email.includes('@') || !email.includes('.com')) {
            isValid = false;
            element.setCustomValidity('El email debe contener @ y .com');
            element.reportValidity();
          } else {
            element.setCustomValidity('');
          }
        } else {
          element.setCustomValidity('');
        }
      }
    });
    
    if (isValid) {
      setCurrentStep(2);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Custom validation with Spanish messages
    if (!paymentInfo.method) {
      alert('Por favor selecciona un método de pago');
      return;
    }
    
    setCurrentStep(3);
  };

  const handleOrderConfirmation = async () => {
    setIsProcessing(true);
    
    try {
      // TEMPORARY FIX: Force virtual environment for now (since it was working before)
      // TODO: Fix environment detection logic properly
      const useVirtualDb = true;
      // This is the virtual environment checkout page - no need for environment detection
      // Calculate total amount with shipping
      const totalAmount = total;
      
      // Create order first to get order ID
      const orderData = {
        client: {
          companyName: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          name: shippingInfo.firstName,
          surname: shippingInfo.lastName,
          email: shippingInfo.email,
          identification: shippingInfo.cedula,
          phone: shippingInfo.phone,
          address: shippingInfo.address,
          city: shippingInfo.city,
          department: shippingInfo.department,
          postalCode: shippingInfo.postalCode,
          // Include user authentication info if logged in
          userAuth: user ? {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          } : null
        },
        cartItems: cartItems && cartItems.map(item => ({
          id: item.id,
          product: {
            id: item.id,
            name: item.name,
            brand: item.brand || '',
            price: item.price || 0,
            // Remove price1 and price2 for virtual environment - only use 'price' field
            category: Array.isArray(item.category) ? item.category.join(', ') : (item.category || ''),
            imageURL: Array.isArray(item.image) ? item.image : [item.image],
            colors: [],
            isProductStarred: false,
            lastUpdated: new Date().toISOString()
          },
          quantity: item.quantity,
          selectedColor: item.color || '',
          selectedPrice: 'price', // Virtual database uses 'price' field
          originalPrice: item.originalPrice, // Pass original price for promotional items
          isPromotional: item.isPromotional // Pass promotional flag
        })),
        selectedPriceType: 'price', // Virtual database uses 'price' field
        comentario: `Método de pago: ${paymentInfo.method}`,
        paymentStatus: 'pending',
        shippingCost: shippingCost, // Add shipping cost
        subtotal: subtotal, // Add subtotal
        total: total // Add total with shipping
      };

      // Step 1: Generate invoice number first (this will be used consistently throughout the process)
      let invoiceNumber = '';
      try {
        const invoiceResponse = await fetch('/api/generate-invoice-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useVirtualDb })
        });
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          invoiceNumber = invoiceData.invoiceNumber;
          console.log('🔢 Generated invoice number for checkout:', invoiceNumber);
        } else {
          console.warn('⚠️ Could not generate invoice number, using fallback');
          invoiceNumber = `PED-${Date.now()}`;
        }
      } catch (error) {
        console.warn('⚠️ Error generating invoice number, using fallback:', error);
        invoiceNumber = `PED-${Date.now()}`;
      }
      
      // For virtual orders, skip PDF generation during "Confirmar Pedido"
      // PDF will be generated during "Confirmar Transferencia"
      let cloudinaryURL = null;
      let filename = 'pedido.pdf';
      let pdfBase64 = null;

      if (useVirtualDb) {
        // Skip PDF generation for virtual orders - will be generated after bank transfer confirmation
        console.log('📧 Virtual order - skipping PDF generation (will be generated after bank transfer confirmation)');
      } else {
        // Only generate PDF for non-virtual orders (Distri1/Naranjos2)
        const pdfResponse = await fetch('/api/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client: orderData.client,
            cartItems: orderData.cartItems,
            selectedPriceType: orderData.selectedPriceType,
            comentario: orderData.comentario,
            invoiceNumber,
            useVirtualDb: useVirtualDb, // Use appropriate environment settings
            shippingCost: shippingCost,
            subtotal: subtotal,
            total: total
          })
        });

        if (pdfResponse.ok) {
          const contentDisposition = pdfResponse.headers.get('Content-Disposition');
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch) filename = filenameMatch[1];
          }
          cloudinaryURL = pdfResponse.headers.get('X-Cloudinary-URL');
          
          // Get the PDF buffer and convert to base64
          const pdfBuffer = await pdfResponse.arrayBuffer();
          const uint8Array = new Uint8Array(pdfBuffer);
          let binaryString = '';
          const chunkSize = 8192;
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
          }
          pdfBase64 = btoa(binaryString);
        }
      }
      
      // Step 2: Send order to API with pre-generated PDF and invoice number
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/send-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...orderData,
          fileUrl: cloudinaryURL,
          fileName: filename,
          pdfBuffer: pdfBase64,
          useVirtualDb: useVirtualDb,
          invoiceNumber: invoiceNumber // Pass the generated invoice number
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);



      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Error al enviar el pedido: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Save order to user profile if logged in
        if (user?.email) {
          try {
            const userOrder: UserOrder = {
              orderId: result.orderId,
              orderDate: new Date(),
              orderNumber: result.invoiceNumber || result.orderId,
              status: 'pending',
              items: cartItems.map(item => ({
                productId: item.id,
                productName: item.name,
                color: item.color || undefined,
                quantity: item.quantity,
                unitPrice: item.price || 0,
                totalPrice: (item.price || 0) * item.quantity
              })),
              subtotal: subtotal,
              tax: 0, // You can calculate tax if needed
              shipping: shippingCost,
              totalPrice: total,
              pdfUrl: result.pdfUrl || cloudinaryURL,
              comentario: `Método de pago: ${paymentInfo.method}`
            };
            
            await addOrderToUserProfile(user.email, userOrder);
            console.log('Order saved to user profile successfully');
          } catch (error) {
            console.error('Error saving order to user profile:', error);
            // Don't fail the order if profile saving fails
          }
        }
        
        // Clear saved shipping info after successful order
        try {
          localStorage.removeItem('checkout-shipping-info');
        } catch (error) {
          // Error clearing shipping info from localStorage
        }
        
        // Process payment based on method
        if (paymentInfo.method === 'bank_transfer') {
          // For bank transfer, redirect to bank selection page
          sessionStorage.setItem('paymentMethod', 'bank_transfer');
          sessionStorage.setItem('orderId', result.orderId);
          if (result.invoiceNumber) {
            sessionStorage.setItem('invoiceNumber', result.invoiceNumber);
          }
          // Store client email for order updates
          sessionStorage.setItem('clientEmail', shippingInfo.email);
          // Store total amount for bank transfer pages
          sessionStorage.setItem('totalAmount', total.toString());
          // Store client email for order updates
          sessionStorage.setItem('clientEmail', shippingInfo.email);
          // Store PDF URL - prefer API result, fallback to checkout-generated URL
          const finalPdfUrl = result.pdfUrl || cloudinaryURL;
          if (finalPdfUrl) {
            sessionStorage.setItem('pdfUrl', finalPdfUrl);
          }
          // Clear cart after setting session data and redirect
          clearCart();
          setTimeout(() => {
            router.push('/bank-transfer-selection');
          }, 100);
          return;
        } else {
          const paymentResponse = await fetch('/api/process-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              amount: totalAmount,
              currency: 'COP',
              orderId: result.orderId,
              customerEmail: shippingInfo.email,
              customerName: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
              description: `Pedido #${result.orderId}`,
              paymentMethod: paymentInfo.method
            })
          });

          if (paymentResponse.ok) {
            const paymentResult = await paymentResponse.json();
            
            if (paymentResult.success && paymentResult.paymentUrl) {
              // Redirect to payment gateway
              window.location.href = paymentResult.paymentUrl;
              return;
            } else if (paymentResult.success) {
              // Payment processed successfully (e.g., cash on delivery)
              sessionStorage.setItem('paymentMethod', paymentInfo.method);
              sessionStorage.setItem('orderId', result.orderId);
              if (result.invoiceNumber) {
                sessionStorage.setItem('invoiceNumber', result.invoiceNumber);
              }
              // Store PDF URL - prefer API result, fallback to checkout-generated URL
              const finalPdfUrl = result.pdfUrl || cloudinaryURL;
              if (finalPdfUrl) {
                sessionStorage.setItem('pdfUrl', finalPdfUrl);
              }
              // Clear cart after setting session data and redirect
              clearCart();
              setTimeout(() => {
                router.push('/order-confirmation');
              }, 100);
              return;
            } else {
              // Provide more specific error messages for different payment methods
              let errorMessage = paymentResult.error || 'Error al procesar el pago';
              
              if (paymentInfo.method === 'wompi') {
                errorMessage = 'Wompi no está configurado actualmente. Por favor selecciona otro método de pago o contacta soporte.';
              } else if (paymentInfo.method === 'pse') {
                errorMessage = 'PSE no está configurado actualmente. Por favor selecciona otro método de pago o contacta soporte.';
              } else if (paymentInfo.method === 'stripe') {
                errorMessage = 'Pago con tarjeta no está configurado actualmente. Por favor selecciona otro método de pago o contacta soporte.';
              }
              
              throw new Error(errorMessage);
            }
          } else {
            throw new Error('Error al procesar el pago');
          }
        }
      } else {
        throw new Error(result.error || 'Error al procesar el pedido');
      }
    } catch (error) {

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          alert('Tiempo de espera agotado. Por favor intenta de nuevo.');
        } else {
          alert(`Error al procesar el pedido: ${error.message}`);
        }
      } else {
        alert('Error al procesar el pedido. Por favor intenta de nuevo.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Redirect to cart if no items (but not during order processing or after successful order)
  React.useEffect(() => {
    if (cartItems && cartItems.length === 0 && !isProcessing) {
      // Don't redirect if we just processed an order successfully
      const orderJustCompleted = sessionStorage.getItem('orderId');
      if (!orderJustCompleted) {
        router.push('/cart');
      }
    }
  }, [cartItems, router, isProcessing]);

  // Show loading state while cart context is initializing
  if (isCartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando carrito...</p>
        </div>
      </div>
    );
  }

  if (!cartItems || cartItems.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 pt-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        {/* Enhanced Header */}
        <div className="mb-4 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-2">Finalizar Compra</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">Completa tu información de forma segura para procesar tu pedido</p>
        </div>

        {/* Enhanced Progress Steps */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 mx-auto max-w-2xl">
            <div className="flex items-center justify-between relative">
              {/* Step 1: Envío */}
              <div 
                className={`flex flex-col items-center relative z-10 transition-all duration-300 cursor-pointer hover:scale-110 ${currentStep >= 1 ? 'scale-105' : ''}`}
                onClick={() => setCurrentStep(1)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  currentStep >= 1 
                    ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md' 
                    : 'border-gray-300 bg-white text-gray-400 hover:border-orange-300 hover:bg-orange-50'
                }`}>
                  {currentStep > 1 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  )}
                </div>
                <span className={`mt-1 font-medium text-xs transition-colors duration-300 ${
                  currentStep >= 1 ? 'text-orange-600' : 'text-gray-500 hover:text-orange-400'
                }`}>Envío</span>
              </div>

              {/* Progress Line 1-2 */}
              <div className="flex-1 mx-2 relative">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500 ease-out ${
                    currentStep >= 2 ? 'w-full' : 'w-0'
                  }`}></div>
                </div>
              </div>

              {/* Step 2: Pago */}
              <div 
                className={`flex flex-col items-center relative z-10 transition-all duration-300 cursor-pointer hover:scale-110 ${currentStep >= 2 ? 'scale-105' : ''}`}
                onClick={() => {
                  // Only allow navigation to step 2 if shipping info is filled
                  if (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department) {
                    setCurrentStep(2);
                  }
                }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  currentStep >= 2 
                    ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md' 
                    : (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department)
                      ? 'border-gray-300 bg-white text-gray-400 hover:border-orange-300 hover:bg-orange-50'
                      : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}>
                  {currentStep > 2 ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  )}
                </div>
                <span className={`mt-1 font-medium text-xs transition-colors duration-300 ${
                  currentStep >= 2 ? 'text-orange-600' : 
                  (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department)
                    ? 'text-gray-500 hover:text-orange-400'
                    : 'text-gray-400'
                }`}>Pago</span>
              </div>

              {/* Progress Line 2-3 */}
              <div className="flex-1 mx-2 relative">
                <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500 ease-out ${
                    currentStep >= 3 ? 'w-full' : 'w-0'
                  }`}></div>
                </div>
              </div>

              {/* Step 3: Confirmación */}
              <div 
                className={`flex flex-col items-center relative z-10 transition-all duration-300 cursor-pointer hover:scale-110 ${currentStep >= 3 ? 'scale-105' : ''}`}
                onClick={() => {
                  // Only allow navigation to step 3 if both shipping and payment are completed
                  if (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department && paymentInfo.method) {
                    setCurrentStep(3);
                  }
                }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  currentStep >= 3 
                    ? 'border-orange-500 bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-md' 
                    : (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department && paymentInfo.method)
                      ? 'border-gray-300 bg-white text-gray-400 hover:border-orange-300 hover:bg-orange-50'
                      : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className={`mt-1 font-medium text-xs transition-colors duration-300 ${
                  currentStep >= 3 ? 'text-orange-600' : 
                  (shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email && shippingInfo.phone && shippingInfo.cedula && shippingInfo.address && shippingInfo.city && shippingInfo.department && paymentInfo.method)
                    ? 'text-gray-500 hover:text-orange-400'
                    : 'text-gray-400'
                }`}>Confirmación</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            {/* Step 1: Shipping Information */}
            {currentStep === 1 && (
              <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4 hover:shadow-lg transition-shadow duration-300">
                                  {/* Authentication Banner */}
                  {user ? (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {user.photoURL && (
                            <img
                              src={user.photoURL}
                              alt="Profile"
                              className="w-8 h-8 rounded-full"
                            />
                          )}
                          <div>
                            <p className="text-sm font-medium text-blue-900">
                              ¡Hola, {user.displayName || 'Cliente'}!
                            </p>
                            <p className="text-xs text-blue-700">
                              {shippingInfo.firstName && shippingInfo.lastName && shippingInfo.email ? 'Tus datos de Google han sido llenados automáticamente' : 'Llenando datos de Google...'}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  ) : (
                  <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-3 sm:space-y-0">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-sm font-semibold text-blue-900">
                            ¿Tienes una cuenta? ¡Inicia sesión con Google para más beneficios!
                          </p>
                        </div>
                        <div className="space-y-1.5 text-xs text-blue-700">
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Datos de envío automáticos</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Descarga tu Orden de Pedido en PDF</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Descarga tu Factura Electrónica</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Compra rápida con datos guardados</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-3 h-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span>Noticias de productos nuevos/descuentos</span>
                          </div>
                          <div className="mt-2 text-xs text-blue-600 font-medium">
                            💡 Inicia sesión con tu cuenta de Google para acceder a estos beneficios
                          </div>
                        </div>
                      </div>
                      <a
                        href="/client-portal/login"
                        className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-md hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-105 shadow-md text-center"
                      >
                        Iniciar Sesión con Google
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Información de Envío</h2>
                      <p className="text-gray-600 mt-0 text-xs">Proporciona los datos para la entrega de tu pedido</p>
                    </div>
                  </div>
                </div>



                <form onSubmit={handleShippingSubmit} className="space-y-2" noValidate>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 text-orange-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Datos Personales
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          title="Por favor ingresa tu nombre"
                          value={shippingInfo.firstName}
                          onChange={(e) => setShippingInfo({...shippingInfo, firstName: e.target.value})}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="Nombre"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Apellido <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          title="Por favor ingresa tu apellido"
                          value={shippingInfo.lastName}
                          onChange={(e) => setShippingInfo({...shippingInfo, lastName: e.target.value})}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="Apellido"
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Cédula <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          title="Por favor ingresa tu número de cédula"
                          value={shippingInfo.cedula}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setShippingInfo({...shippingInfo, cedula: value});
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="1234567890"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-2">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 text-blue-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Información de Contacto
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Teléfono <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          inputMode="numeric"
                          title="Por favor ingresa tu número de teléfono"
                          value={shippingInfo.phone}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '');
                            setShippingInfo({...shippingInfo, phone: value});
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="3001234567"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                          title="Por favor ingresa un email válido con @ y .com"
                          value={shippingInfo.email}
                          onChange={(e) => setShippingInfo(prev => ({...prev, email: e.target.value}))}
                          onBlur={(e) => {
                            const email = e.target.value;
                            if (email && (!email.includes('@') || !email.includes('.com'))) {
                              e.target.setCustomValidity('El email debe contener @ y .com');
                            } else {
                              e.target.setCustomValidity('');
                            }
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="ejemplo@correo.com"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-lg p-2">
                    <h3 className="text-sm font-semibold text-gray-900 mb-1.5 flex items-center">
                      <svg className="w-3 h-3 text-green-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Dirección de Entrega
                    </h3>

                    <div className="space-y-2">
                      <div className="space-y-0.5">
                        <label className="block text-xs font-medium text-gray-900">
                          Dirección <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          title="Por favor ingresa tu dirección"
                          value={shippingInfo.address}
                          onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                          placeholder="Calle 123 # 45-67, Barrio"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-0.5">
                          <label className="block text-xs font-medium text-gray-900">
                            Ciudad <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            title="Por favor ingresa tu ciudad"
                            value={shippingInfo.city}
                            onChange={(e) => setShippingInfo({...shippingInfo, city: e.target.value})}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                            placeholder="Bogotá"
                          />
                        </div>
                        <div className="space-y-0.5">
                          <label className="block text-xs font-medium text-gray-900">
                            Departamento <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              required
                              title="Por favor selecciona tu departamento"
                              value={shippingInfo.department}
                              onChange={(e) => setShippingInfo({...shippingInfo, department: e.target.value})}
                              className="w-full px-2 py-1.5 pr-8 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black transition-all duration-200 hover:border-gray-400 text-sm appearance-none"
                            >
                              <option value="">Seleccionar departamento</option>
                              {colombianDepartments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <div className="space-y-0.5">
                          <label className="block text-xs font-medium text-gray-900">
                            Código Postal
                            <span className="text-gray-500 text-xs ml-1">(Opcional)</span>
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            title="Por favor ingresa tu código postal (opcional)"
                            value={shippingInfo.postalCode}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              setShippingInfo({...shippingInfo, postalCode: value});
                            }}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white shadow-sm text-black placeholder-gray-400 transition-all duration-200 hover:border-gray-400 text-sm"
                            placeholder="110111"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Data Consent and Save Section */}
                  <div className="bg-gray-50 rounded-lg p-3 mt-3">
                    <div className="flex items-start space-x-3">
                      {!user ? (
                        // For non-logged-in users: show checkbox and login prompt
                        <>
                          <input
                            type="checkbox"
                            id="saveShippingData"
                            checked={shippingInfo.saveForFuture || false}
                            onChange={(e) => {
                              setShippingInfo({...shippingInfo, saveForFuture: e.target.checked});
                            }}
                            className="mt-1 h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <label htmlFor="saveShippingData" className="text-sm font-medium text-gray-900 cursor-pointer">
                              Guardar esta información de envío para futuras compras
                            </label>
                            <p className="text-xs text-gray-600 mt-1">
                              Al marcar esta casilla, serás redirigido a iniciar sesión con Google para guardar tu información 
                              de envío de forma segura para futuras compras. También recibirás notificaciones sobre el estado 
                              de tu pago y envío. Puedes cambiar o eliminar esta información en cualquier momento desde tu 
                              perfil de cliente.
                            </p>
                            <div className="mt-2 flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleSaveShippingData()}
                                disabled={!shippingInfo.saveForFuture}
                                className={`px-4 py-2 text-xs font-medium rounded-md transition-colors ${
                                  shippingInfo.saveForFuture
                                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                              >
                                Guardar Ahora
                              </button>
                              {shippingInfo.savedAt && (
                                <span className="text-xs text-green-600">
                                  ✓ Guardado el {new Date(shippingInfo.savedAt).toLocaleDateString('es-CO')}
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        // For logged-in users: show save profile button
                        <>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <label className="text-sm font-medium text-gray-900">
                                Guardar información en tu perfil
                              </label>
                            </div>
                            <p className="text-xs text-gray-600 mb-2">
                              Guarda esta información de envío en tu perfil para futuras compras. 
                              Tus datos se guardarán de forma segura en tu cuenta de Google.
                            </p>
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                onClick={() => handleSaveShippingData()}
                                className="px-4 py-2 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                              >
                                Guardar en Perfil
                              </button>
                              {shippingInfo.savedAt && (
                                <span className="text-xs text-green-600">
                                  ✓ Guardado el {new Date(shippingInfo.savedAt).toLocaleDateString('es-CO')}
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Privacy and Security Section - Below Save Shipping Info */}
                  <div className="mb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-blue-900 mb-3">🔒 Seguridad y Privacidad de Datos</h3>
                          <div className="space-y-2 text-xs text-blue-800">
                            <div className="flex items-start">
                              <svg className="h-3 w-3 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span><strong>Almacenamiento Seguro:</strong> Tus datos se almacenan en Google Cloud con encriptación AES-256</span>
                            </div>
                            <div className="flex items-start">
                              <svg className="h-3 w-3 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span><strong>Protección Total:</strong> Cumplimos con estándares ISO 27001, SOC 2 y GDPR</span>
                            </div>
                            <div className="flex items-start">
                              <svg className="h-3 w-3 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span><strong>Uso Exclusivo:</strong> Solo para procesar tu pedido y envío</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-4 focus:ring-orange-300 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      <span>Continuar al Pago</span>
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 2: Payment Information */}
            {currentStep === 2 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Método de Pago</h2>
                
                {/* Payment method availability notice */}
                <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    <strong>Nota:</strong> Solo Transferencia Bancaria está disponible. Wompi, PSE y Tarjeta de Crédito están en configuración.
                  </p>
                </div>
                
                <form onSubmit={handlePaymentSubmit} className="space-y-3" noValidate>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="wompi"
                        checked={paymentInfo.method === 'wompi'}
                        onChange={(e) => setPaymentInfo({...paymentInfo, method: e.target.value})}
                        className="mr-3"
                        disabled
                      />
                      <div className="flex items-center space-x-2">
                        <div className="text-xl">💳</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Wompi</div>
                          <div className="text-xs text-gray-500">Pago digital seguro y rápido</div>
                          <div className="text-xs text-red-500">No disponible</div>
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="pse"
                        checked={paymentInfo.method === 'pse'}
                        onChange={(e) => setPaymentInfo({...paymentInfo, method: e.target.value})}
                        className="mr-3"
                        disabled
                      />
                      <div className="flex items-center space-x-2">
                        <div className="text-xl">🏦</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">PSE (Pagos Seguros en Línea)</div>
                          <div className="text-xs text-gray-500">Transferencia bancaria en línea</div>
                          <div className="text-xs text-red-500">No disponible</div>
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="bank_transfer"
                        checked={paymentInfo.method === 'bank_transfer'}
                        onChange={(e) => setPaymentInfo({...paymentInfo, method: e.target.value})}
                        className="mr-3"
                      />
                      <div className="flex items-center space-x-2">
                        <div className="text-xl">🏦</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Transferencia Bancaria</div>
                          <div className="text-xs text-gray-500">Bancolombia, Nequi, A la Mano</div>
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center p-3 border border-gray-200 rounded-lg cursor-not-allowed opacity-50">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="credit_card"
                        checked={paymentInfo.method === 'credit_card'}
                        onChange={(e) => setPaymentInfo({...paymentInfo, method: e.target.value})}
                        className="mr-3"
                        disabled
                      />
                      <div className="flex items-center space-x-2">
                        <div className="text-xl">💳</div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">Tarjeta de Crédito</div>
                          <div className="text-xs text-gray-500">Visa, Mastercard, American Express</div>
                          <div className="text-xs text-red-500">No disponible</div>
                        </div>
                      </div>
                    </label>


                  </div>

                  {paymentInfo.method === 'credit_card' && (
                    <div className="border-t pt-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Número de Tarjeta</label>
                        <input
                          type="text"
                          required
                          title="Por favor ingresa el número de tu tarjeta"
                          placeholder="1234 5678 9012 3456"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre en la Tarjeta</label>
                          <input
                            type="text"
                            required
                            title="Por favor ingresa el nombre en la tarjeta"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Vencimiento</label>
                          <input
                            type="text"
                            required
                            title="Por favor ingresa la fecha de vencimiento"
                            placeholder="MM/AA"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">CVV</label>
                          <input
                            type="text"
                            required
                            title="Por favor ingresa el código CVV"
                            placeholder="123"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    >
                      Volver
                    </button>
                    <button
                      type="submit"
                      disabled={!paymentInfo.method}
                      className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Revisar Pedido
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Step 3: Order Confirmation */}
            {currentStep === 3 && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                {/* Header with pastel color */}
                <div className="bg-green-100 px-6 py-4">
                  <div className="flex items-center text-green-800">
                    <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h2 className="text-xl font-bold">Confirmar Pedido</h2>
                  </div>
                  <p className="text-green-700 text-sm mt-1">Revisa los detalles antes de confirmar</p>
                </div>
                
                <div className="p-4 space-y-4">
                  {/* Shipping Information Summary */}
                  <div className="border-l-4 border-blue-500 bg-blue-50 rounded-r-lg">
                    <div className="p-3">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="text-base font-semibold text-blue-900">Información de Envío</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center">
                          <svg className="w-3 h-3 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium text-gray-900">{shippingInfo.firstName} {shippingInfo.lastName}</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-3 h-3 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-gray-700">{shippingInfo.email}</span>
                        </div>
                        <div className="flex items-center">
                          <svg className="w-3 h-3 text-gray-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          <span className="text-gray-700">{shippingInfo.phone}</span>
                        </div>
                        <div className="flex items-start">
                          <svg className="w-3 h-3 text-gray-500 mr-1 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <div className="text-gray-700">
                            <div>{shippingInfo.address}</div>
                            <div>{shippingInfo.city}, {shippingInfo.department}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Summary */}
                  <div className="border-l-4 border-purple-500 bg-purple-50 rounded-r-lg">
                    <div className="p-3">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <h3 className="text-base font-semibold text-purple-900">Método de Pago</h3>
                      </div>
                      <div className="flex items-center text-xs">
                        {paymentInfo.method === 'wompi' && (
                          <>
                            <span className="text-2xl mr-3">💳</span>
                            <div>
                              <div className="font-medium text-purple-900">Wompi</div>
                              <div className="text-purple-700">Pago digital seguro</div>
                            </div>
                          </>
                        )}
                        {paymentInfo.method === 'pse' && (
                          <>
                            <span className="text-2xl mr-3">🏦</span>
                            <div>
                              <div className="font-medium text-purple-900">PSE (Pagos Seguros en Línea)</div>
                              <div className="text-purple-700">Transferencia bancaria en línea</div>
                            </div>
                          </>
                        )}
                        {paymentInfo.method === 'bank_transfer' && (
                          <>
                            <span className="text-2xl mr-3">🏦</span>
                            <div>
                              <div className="font-medium text-purple-900">Transferencia Bancaria</div>
                              <div className="text-purple-700">Bancolombia, Nequi, A la Mano</div>
                            </div>
                          </>
                        )}
                        {paymentInfo.method === 'credit_card' && (
                          <>
                            <span className="text-2xl mr-3">💳</span>
                            <div>
                              <div className="font-medium text-purple-900">Tarjeta de Crédito</div>
                              <div className="text-purple-700">Visa, Mastercard, American Express</div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-l-4 border-orange-500 bg-orange-50 rounded-r-lg">
                    <div className="p-3">
                      <div className="flex items-center mb-2">
                        <svg className="w-4 h-4 text-orange-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        <h3 className="text-base font-semibold text-orange-900">Productos ({cartItems.length})</h3>
                      </div>
                      <div className="space-y-3">
                        {cartItems.map((item) => (
                          <div key={item.id} className="bg-white rounded-lg border border-orange-200 shadow-sm overflow-hidden">
                            {/* Mobile-friendly product layout */}
                            <div className="p-3">
                              <div className="flex items-start space-x-3">
                                <div className="relative flex-shrink-0">
                                  <img
                                    src={getProcessedImageUrl(item.image || '/placeholder-product.svg')}
                                    alt={item.name}
                                    className="w-16 h-16 object-cover rounded-lg"
                                  />
                                  <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                    {item.quantity}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 text-sm mb-2 leading-tight">{item.name}</h4>
                                  
                                  {/* Mobile-optimized product details */}
                                  <div className="grid grid-cols-1 gap-1 text-xs text-gray-600">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Cantidad:</span>
                                      <span className="text-gray-900">{item.quantity}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium">Precio unitario:</span>
                                      <div className="flex items-center space-x-1">
                                        {getItemPrice(item) !== item.price && (
                                          <span className="text-gray-400 line-through text-xs">{formatCurrency(item.price)}</span>
                                        )}
                                        <span className="text-gray-900 font-semibold">{formatCurrency(getItemPrice(item))}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                                      <span className="font-semibold text-orange-700">Total:</span>
                                      <div className="flex items-center space-x-1">
                                        {getItemPrice(item) !== item.price && (
                                          <span className="text-gray-400 line-through text-xs">{formatCurrency(item.price * item.quantity)}</span>
                                        )}
                                        <span className="font-bold text-orange-700 text-sm">{formatCurrency(getItemPrice(item) * item.quantity)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Action Buttons */}
                  <div className="border-t border-gray-200 pt-3 mt-4">
                    <div className="flex flex-col sm:flex-row gap-3 justify-between">
                      <button
                        onClick={() => setCurrentStep(2)}
                        className="flex items-center justify-center px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 transform hover:scale-105"
                      >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Volver
                      </button>
                      <button
                        onClick={handleOrderConfirmation}
                        disabled={isProcessing}
                        className="flex items-center justify-center px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 shadow-lg hover:shadow-xl"
                      >
                      {isProcessing ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Procesando...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Confirmar Pedido
                        </>
                      )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Enhanced Order Summary Sidebar */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-white rounded-xl lg:rounded-2xl shadow-md lg:shadow-xl border border-gray-100 p-4 lg:p-6 lg:sticky lg:top-24 overflow-hidden">
              {/* Header with pastel color */}
              <div className="bg-orange-100 -mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-4 lg:px-6 pt-4 lg:pt-6 pb-3 lg:pb-4 mb-4 lg:mb-6">
                <div className="flex items-center text-orange-800">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6 mr-2 lg:mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h2 className="text-lg lg:text-xl font-bold">Resumen del Pedido</h2>
                </div>
              </div>
              
              <div className="space-y-2 sm:space-y-3 lg:space-y-4 mb-3 sm:mb-4 lg:mb-6">
                {/* Subtotal */}
                <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 lg:p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Subtotal</div>
                      <div className="text-xs text-gray-600">{getTotalItems()} {getTotalItems() === 1 ? 'producto' : 'productos'}</div>
                    </div>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">{formatCurrency(subtotal)}</div>
                  </div>
                </div>

                {/* Shipping */}
                <div className="bg-blue-50 rounded-lg p-2.5 sm:p-3 lg:p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Envío</div>
                      {!needsShipping && (
                        <div className="text-xs text-green-600">¡Envío gratis!</div>
                      )}
                    </div>
                    <div className={`text-sm sm:text-base lg:text-lg font-bold ${needsShipping ? 'text-gray-900' : 'text-green-600'}`}>
                      {needsShipping ? formatCurrency(shippingCost) : 'Gratis'}
                    </div>
                  </div>
                  {needsShipping && (
                    <div className="mt-1.5 sm:mt-2 text-xs text-gray-600">
                      Envío gratis en compras superiores a {formatCurrency(shippingConfig.freeShippingThreshold)}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-2.5 sm:p-3 lg:p-4 border-2 border-orange-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">Total</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600">{formatCurrency(total)}</div>
                      <div className="text-xs text-gray-600">Incluye todos los impuestos</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security badges */}
              <div className="border-t border-gray-200 pt-2.5 sm:pt-3 lg:pt-4 mb-2.5 sm:mb-3 lg:mb-4">
                <div className="flex items-center justify-center space-x-2 sm:space-x-3 lg:space-x-4 text-xs text-gray-500 mb-2 lg:mb-3">
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-green-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Pago seguro
                  </div>
                  <div className="flex items-center">
                    <svg className="w-4 h-4 text-blue-500 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Datos protegidos
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center px-2 py-1">
                Al confirmar, aceptas nuestros{' '}
                <a href="/terminos-condiciones" className="text-orange-600 hover:text-orange-700 hover:underline font-medium">
                  términos y condiciones
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
} 