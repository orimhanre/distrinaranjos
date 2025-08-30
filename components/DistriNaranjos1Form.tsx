'use client';

import { useState, useEffect, useRef } from 'react';
import { Product, CartItem, Client } from '@/types';
import ClientForm from './ClientForm';
import ProductCatalog from './ProductCatalog';
import OrderSummary from './OrderSummary';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import Link from 'next/link';
import { fetchWebPhotos } from '@/lib/databaseService';
import FlyingAnimation from './FlyingAnimation';

type Step = 'products' | 'client' | 'summary';

export default function Distri1Form() {
  const [isMounted, setIsMounted] = useState(false);
  const [currentStep, setCurrentStep] = useState<Step>('products');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const [client, setClient] = useState<Client>({
    companyName: '',
    identification: '',
    name: '',
    surname: '',
    phone: '',
    address: '',
    city: '',
    department: '',
    comentario: ''
  });
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const selectedPriceType = 'price1';
  const cartModalContentRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState<string>('pedido.pdf');
  const [showOrderSuccessModal, setShowOrderSuccessModal] = useState(false);
  const [webPhotos, setWebPhotos] = useState<Record<string, string>>({});
  
  // Flying animation states
  const [showFlyingAnimation, setShowFlyingAnimation] = useState(false);
  const [flyingImageUrl, setFlyingImageUrl] = useState('');
  const [flyingStartPosition, setFlyingStartPosition] = useState({ x: 0, y: 0 });
  const [flyingTargetPosition, setFlyingTargetPosition] = useState({ x: 0, y: 0 });

  // Only set isMounted and load localStorage on client after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      const savedStep = localStorage.getItem('distri1_step');
      const savedCart = localStorage.getItem('distri1_cart');
      const savedClient = localStorage.getItem('distri1_client');
      if (savedStep) {
        setCurrentStep(JSON.parse(savedStep));
      }
      if (savedCart) {
        setCartItems(JSON.parse(savedCart));
      }
      if (savedClient) {
        setClient(JSON.parse(savedClient));
      }
    }
  }, [isMounted]);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('distri1_step', JSON.stringify(currentStep));
    }
  }, [currentStep, isMounted]);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('distri1_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, isMounted]);

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      localStorage.setItem('distri1_client', JSON.stringify(client));
    }
  }, [client, isMounted]);

  useEffect(() => {
    if (currentStep === 'summary') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  useEffect(() => {
    const loadWebPhotos = async () => {
      try {
        const photos = await fetchWebPhotos('regular'); // Use regular environment for distri1
        setWebPhotos(photos);
      } catch (error) {
        // Silently handle WebPhotos loading error
      }
    };
    loadWebPhotos();
  }, []);

  const addToCart = (product: Product, quantity: number, selectedColor: string, buttonElement?: HTMLElement) => {
    // Start flying animation from the clicked button
    if (buttonElement) {
      const rect = buttonElement.getBoundingClientRect();
      setFlyingStartPosition({
        x: rect.left + rect.width / 2 - 40, // Center the 80px (w-20) image on button
        y: rect.top + rect.height / 2 - 40
      });
    }
    
    // Calculate target position (aim at "Ver Carrito" button)
    const cartButton = document.querySelector('[data-ver-carrito-button]') as HTMLElement;
    let targetPosition = { x: window.innerWidth - 120, y: window.innerHeight - 120 }; // fallback
    
    if (cartButton) {
      const rect = cartButton.getBoundingClientRect();
      targetPosition = {
        x: rect.left + rect.width / 2 - 40, // Center the 80px image on button
        y: rect.top + rect.height / 2 - 40
      };
    }
    
    setFlyingTargetPosition(targetPosition);
    
    // Get product image
    const productImage = Array.isArray(product.imageURL) && product.imageURL.length > 0 
      ? product.imageURL[0] 
      : '/placeholder-product.svg';
    
    setFlyingImageUrl(productImage);
    setShowFlyingAnimation(true);
    
    // Add to cart after a brief delay to let animation start
    setTimeout(() => {
      setCartItems(prev => {
        const existingItem = prev.find(item => 
          item.product.id === product.id && item.selectedColor === selectedColor
        );
        if (existingItem) {
          return prev.map(item =>
            item.product.id === product.id && item.selectedColor === selectedColor
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        }
        return [...prev, {
          id: Date.now().toString(),
          product,
          quantity,
          selectedColor,
          selectedPrice: selectedPriceType
        }];
      });
    }, 100);
  };

  const updateCartItemQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prev => prev.filter(item => item.id !== itemId));
    } else {
      // Limit quantity to maximum of 30
      const limitedQuantity = Math.min(30, quantity);
      setCartItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, quantity: limitedQuantity } : item
      ));
    }
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleClientSubmit = (clientData: Client) => {
    setClient(clientData);
    setCurrentStep('summary');
  };

  const handleGeneratePDF = async (comentario: string) => {
    if (!client || cartItems.length === 0) return;
    setLoading(true);
    try {
      // Create clean copies of objects to avoid circular references
      const cleanClient = {
        name: client.name,
        surname: client.surname,
        companyName: client.companyName,
        identification: client.identification,
        phone: client.phone,
        address: client.address,
        city: client.city,
        department: client.department
      };
      
      const cleanCartItems = cartItems.map(item => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          price1: item.product.price1,
          price2: item.product.price2,
          imageURL: item.product.imageURL,
          category: item.product.category,
          brand: item.product.brand,
          colors: item.product.colors,
          type: item.product.type,
          capacity: item.product.capacity,
          materials: item.product.materials,
          dimensions: item.product.dimensions,
          SKN: (item.product as any).SKN,
          quantity: item.product.quantity
        },
        quantity: item.quantity,
        selectedColor: item.selectedColor,
        selectedPrice: item.selectedPrice
      }));
      
      // Generate invoice number first
      let invoiceNumber = '';
      try {
        const invoiceResponse = await fetch('/api/generate-invoice-number', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ useVirtualDb: false })
        });
        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json();
          invoiceNumber = invoiceData.invoiceNumber;
        } else {
          // Invoice number generation failed, using fallback
          invoiceNumber = `PED-${Date.now()}`;
        }
      } catch (error) {
        // Invoice number generation failed, using fallback
        invoiceNumber = `PED-${Date.now()}`;
      }
      
      // Generating PDF for order
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          client: cleanClient, 
          cartItems: cleanCartItems, 
          selectedPriceType, 
          comentario,
          invoiceNumber,
          useVirtualDb: false  // DistriNaranjos1 uses regular Cloudinary
        }),
      });
      if (response.ok) {
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'pedido.pdf';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
          if (filenameMatch) filename = filenameMatch[1];
        }
        const cloudinaryURL = response.headers.get('X-Cloudinary-URL');
        
        // Get the PDF buffer from the response
        const pdfBuffer = await response.arrayBuffer();
        // Convert ArrayBuffer to base64 string for browser compatibility
        const uint8Array = new Uint8Array(pdfBuffer);
        // Use a more efficient method to convert to base64 - process in chunks to avoid stack overflow
        let binaryString = '';
        const chunkSize = 8192; // Process in 8KB chunks
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        const pdfBase64 = btoa(binaryString);
        
        // Send order to Firestore and trigger email notification
        try {
          const pdfGeneratedAt = new Date().toISOString();
          const sendOrderResponse = await fetch('/api/send-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              client: cleanClient, 
              cartItems: cleanCartItems, 
              selectedPriceType, 
              comentario, 
              fileUrl: cloudinaryURL,
              fileName: filename,
              pdfBuffer: pdfBase64,
              useVirtualDb: false,
              invoiceNumber,
              pdfGeneratedAt
            }),
          });
          
          if (sendOrderResponse.ok) {
            // Order sent successfully
          } else {
            // Error sending order to Firestore
          }
        } catch (sendOrderError) {
          // Error sending order
        }
        
        if (cloudinaryURL) {
          setPdfUrl(cloudinaryURL);
          setPdfFilename(filename);
          setShowOrderSuccessModal(true);
        } else {
          toast.success('✅ ¡Pedido procesado exitosamente! El PDF se ha generado pero no se pudo subir a la nube.');
        }
        // Clear localStorage after successful order
        localStorage.removeItem('distri1_step');
        localStorage.removeItem('distri1_cart');
        localStorage.removeItem('distri1_client');
        // Reset form state (handled in Salir button)
              } else {
          // PDF generation failed
        }
      } catch (error) {
        // Error generating PDF
    } finally {
      setLoading(false);
    }
  };

  const goToClient = () => {
    if (cartItems.length > 0) {
      setCurrentStep('client');
    }
  };

  const goBackToProducts = () => {
    setCurrentStep('products');
  };

  const goBackToClient = () => {
    setCurrentStep('client');
  };

  const goToStep = (step: Step) => {
    // Only allow navigation if conditions are met
    if (step === 'products') {
      setCurrentStep('products');
    } else if (step === 'client' && cartItems.length > 0) {
      setCurrentStep('client');
    } else if (step === 'summary' && cartItems.length > 0 && client.name) {
      setCurrentStep('summary');
    }
  };

  const formatPrice = (price: number) => {
    return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const totalPrice = cartItems.reduce((total, item) => {
    // Distri1 always uses price1
    const price = item.product.price1 ?? 0;
    return total + (price * item.quantity);
  }, 0);

  const totalItems = cartItems.reduce((total, item) => total + item.quantity, 0);

  // Don't render anything until the component is mounted on client
  if (!isMounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 bg-white shadow-sm border-b z-40 distri-header" style={{ top: '10px' }}>
        <style jsx>{`
          @media (max-width: 768px) {
            .distri-header {
              top: 25px !important;
            }
          }
        `}</style>
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex flex-col items-center space-y-2">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              </Link>
            </div>
            {/* Step Indicator */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => goToStep('products')}
                className={`flex items-center transition-colors ${
                  currentStep === 'products' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                } ${cartItems.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                disabled={cartItems.length === 0}
                aria-label="Ir a la sección de productos"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  currentStep === 'products' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>
                  1
                </div>
                <span className="ml-1 text-xs font-medium">Productos</span>
              </button>
              <div className="w-6 h-0.5 bg-gray-300"></div>
              <button
                onClick={() => goToStep('client')}
                className={`flex items-center transition-colors ${
                  currentStep === 'client' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                } ${cartItems.length > 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                disabled={cartItems.length === 0}
                aria-label="Ir a la sección de cliente"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  currentStep === 'client' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>
                  2
                </div>
                <span className="ml-1 text-xs font-medium">Cliente</span>
              </button>
              <div className="w-6 h-0.5 bg-gray-300"></div>
              <button
                onClick={() => goToStep('summary')}
                className={`flex items-center transition-colors ${
                  currentStep === 'summary' ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
                } ${cartItems.length > 0 && client.name ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                disabled={cartItems.length === 0 || !client.name}
                aria-label="Ir a la sección de resumen"
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                  currentStep === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                }`}>
                  3
                </div>
                <span className="ml-1 text-xs font-medium">Resumen</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 pb-32">
        {currentStep === 'products' && (
          <div className="space-y-6">

            
            <div className="w-full">
              <ProductCatalog
                onAddToCart={addToCart}
                selectedPriceType={selectedPriceType}
                environment="regular"
              />
            </div>
          </div>
        )}

        {currentStep === 'client' && (
          <div className="max-w-2xl mx-auto">
            <div className="mb-6">
              <button
                onClick={goBackToProducts}
                className="text-blue-600 hover:text-blue-800 font-medium"
                aria-label="Volver a la sección de productos"
              >
                ← Volver a Productos
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <ClientForm 
                onSubmit={handleClientSubmit}
                initialClient={client}
                storageKeyPrefix="distri1"
              />
            </div>
          </div>
        )}

        {currentStep === 'summary' && (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button
                onClick={goBackToClient}
                className="text-blue-600 hover:text-blue-800 font-medium"
                aria-label="Volver a la sección de cliente"
              >
                ← Volver al Cliente
              </button>
            </div>
            <OrderSummary
              cartItems={cartItems}
              client={client}
              selectedPriceType={selectedPriceType}
              onGeneratePDF={handleGeneratePDF}
              loading={loading}
              totalColor="text-green-600"
            />
          </div>
        )}
      </div>

      {/* Flying Animation */}
      <FlyingAnimation 
        isVisible={showFlyingAnimation}
        imageUrl={flyingImageUrl}
        startPosition={flyingStartPosition}
        targetPosition={flyingTargetPosition}
        onComplete={() => {
          setShowFlyingAnimation(false);
          setFlyingImageUrl('');
        }}
      />

      {/* Floating Cart Summary - Always visible except on summary page */}
      {currentStep !== 'summary' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <div className="max-w-7xl mx-auto px-4 py-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 flex justify-center">
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-1">Total Precio</div>
                  <div className="text-2xl font-bold text-green-600">${formatPrice(totalPrice)}</div>
                </div>
              </div>
              <div className="flex items-center mr-2 mb-1">
                <div className="relative">
                  <button
                    data-ver-carrito-button
                    onClick={() => setShowCartModal(true)}
                    className="relative bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700 transition-all duration-200 font-medium flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105 flex-shrink-0"
                    aria-label="Ver carrito"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
                    </svg>
                    <span>Ver Carrito</span>
                  </button>
                  {cartItems.length > 0 && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
                      {cartItems.reduce((total, item) => total + item.quantity, 0)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cart Modal */}
      {showCartModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCartModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900">Carrito</h3>
              <div className="flex items-center gap-2">
                {cartItems.length > 0 && (
                  <button
                    onClick={() => {
                      try {
                        localStorage.setItem('distri1_saved_cart', JSON.stringify(cartItems));
                        toast.success('Carrito guardado correctamente.');
                      } catch (e) {
                        toast.error('Error al guardar el carrito.');
                      }
                    }}
                    className="bg-green-100 hover:bg-green-200 text-black px-3 py-1 rounded-full text-xs font-medium"
                    aria-label="Guardar Carrito"
                  >
                    Guardar Carrito
                  </button>
                )}
                <button
                  onClick={() => {
                    try {
                      const saved = localStorage.getItem('distri1_saved_cart');
                      if (saved) {
                        setCartItems(JSON.parse(saved));
                        toast.success('Carrito cargado correctamente.');
                        setTimeout(() => {
                          if (cartModalContentRef.current) {
                            cartModalContentRef.current.scrollTop = 0;
                          }
                        }, 100);
                      } else {
                        toast.error('No hay carrito guardado.');
                      }
                    } catch (e) {
                      toast.error('Error al cargar el carrito.');
                    }
                  }}
                  className="bg-yellow-100 hover:bg-yellow-200 text-black px-3 py-1 rounded-full text-xs font-medium"
                  aria-label="Cargar Carrito Guardado"
                >
                  Cargar Carrito
                </button>
                <button
                  onClick={() => setShowCartModal(false)}
                  className="text-gray-400 hover:text-gray-600 ml-2"
                  aria-label="Cerrar carrito"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-scroll p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db #f3f4f6' }} ref={cartModalContentRef}>
              {cartItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 text-lg mb-2">Carrito Vacío</div>
                  <div className="text-gray-400 text-sm">Agregue productos para continuar</div>
                </div>
              ) : (
                <div className="space-y-4 pb-4">
                  {cartItems
                    .sort((a, b) => {
                      // First sort by brand alphabetically
                      const brandComparison = a.product.brand.localeCompare(b.product.brand);
                      if (brandComparison !== 0) {
                        return brandComparison;
                      }
                      // Then sort by name alphabetically within the same brand
                      return a.product.name.localeCompare(b.product.name);
                    })
                                        .map((item) => {
                      // Distri1 always uses price1
                      const price = item.product.price1 ?? 0;
                    
                    const getImageUrl = () => {
                      // Helper function to validate URLs
                      const isValidLocalUrl = (url: any): boolean => {
                        if (!url || typeof url !== 'string') return false;
                        const cleanUrl = url.trim();
                        if (cleanUrl === '') return false;
                        
                        // Accept local paths starting with /
                        if (cleanUrl.startsWith('/')) return true;
                        
                        // Accept Cloudinary URLs (for regular environment)
                        if (cleanUrl.includes('res.cloudinary.com')) return true;
                        
                        // Accept Airtable URLs (for both virtual and regular environments)
                        if (cleanUrl.includes('dl.airtable.com')) return true;
                        
                        // Reject other external URLs
                        if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
                          // External URL detected in cart, skipping
                          return false;
                        }
                        
                        return false;
                      };

                      if (item.product.imageURL && Array.isArray(item.product.imageURL) && item.product.imageURL.length > 0) {
                        const firstImage = item.product.imageURL[0];
                        if (typeof firstImage === 'string' && isValidLocalUrl(firstImage)) {
                          return firstImage;
                        }
                        if (typeof firstImage === 'object' && firstImage && 'url' in firstImage) {
                          const url = (firstImage as any).url;
                          if (isValidLocalUrl(url)) {
                            return url;
                          }
                        }
                      }
                      return '/placeholder-product.svg';
                    };

                    return (
                      <div key={item.id} className="border border-gray-200 rounded-lg p-2 sm:p-4 hover:shadow-md transition-shadow relative">
                        {/* Remove Button - Top Right */}
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors z-10"
                          aria-label="Eliminar producto"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        
                        <div className="flex items-center gap-2 sm:gap-4">
                          {/* Product Image */}
                          <div className="flex-shrink-0">
                              <div className="w-20 h-20 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <img
                                  src={getImageUrl()}
                                  alt={item.product.name}
                                  className="w-full h-full object-cover rounded-lg"
                                  onError={(e) => {
                                    // Failed to load cart image, using placeholder
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    // Show placeholder icon and text
                                    const parent = target.parentElement;
                                    if (parent) {
                                      parent.innerHTML = `
                                        <div class="flex flex-col items-center justify-center text-gray-400">
                                          <svg class="w-8 h-8 mb-1" fill="currentColor" viewBox="0 0 20 20">
                                            <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                                          </svg>
                                          <span class="text-xs text-center">Sin Imagen</span>
                                        </div>
                                      `;
                                    }
                                  }}
                                />
                              </div>
                            </div>

                          {/* Product Info & Controls */}
                          <div className="flex-1 min-w-0 w-full">
                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-0">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-semibold text-gray-900 truncate max-w-full" title={item.product.name}>
                                  {item.product.name}
                                </h3>
                                <p className="text-xs text-gray-600 mb-0.5 truncate max-w-full">
                                  {item.product.brand}
                                  {item.product.type && (
                                    <span className="text-gray-500"> ({item.product.type})</span>
                                  )}
                                </p>
                                {/* Color Display */}
                                {item.selectedColor && (
                                  <div className="mb-0.5">
                                    <div className="flex items-center">
                                      <span className="text-sm text-gray-600 w-20">Color:</span>
                                      <span className="text-xs text-gray-900 font-medium">{item.selectedColor}</span>
                                    </div>
                                  </div>
                                )}
                                {/* Quantity Display */}
                                <div className="flex items-center mb-0.5">
                                  <span className="text-sm text-gray-600 w-20">Cantidad:</span>
                                  <span className="text-sm font-medium text-black">{item.quantity}</span>
                                </div>
                                {/* Price */}
                                <div className="flex items-center mb-0.5">
                                  <span className="text-sm text-gray-600 w-20">Precio:</span>
                                  <span className="text-xs text-green-600 font-normal opacity-80">${formatPrice(price)}</span>
                                </div>
                                {/* SubTotal */}
                                <div className="flex items-center mb-0.5">
                                  <span className="text-sm text-gray-600 w-20">SubTotal:</span>
                                  <span className="font-bold text-base sm:text-lg text-green-600">${formatPrice(price * item.quantity)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                </div>
              )}
            </div>
            {/* Cart Modal Navigation Bar */}
            {cartItems.length > 0 && (
              <div className="p-4 border-t bg-gray-50 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowCartModal(false);
                    goToClient();
                  }}
                  className="w-full bg-teal-600 text-white py-3 px-4 rounded-lg hover:bg-teal-700 transition-colors font-medium"
                  aria-label="Continuar al cliente"
                >
                  Continuar al Cliente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Success Modal */}
      {showOrderSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center max-w-sm w-full border-4 border-green-600 relative">
            <svg className="w-16 h-16 text-green-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <h2 className="text-2xl font-bold text-green-700 mb-2 text-center">¡Pedido enviado con éxito!</h2>
            <p className="text-gray-700 text-center mb-4">Gracias por tu pedido.</p>
            <a
              href={pdfUrl || '#'}
              download={pdfFilename}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-base shadow-sm border border-green-700 text-center mb-2"
              aria-label="Descargar Pedido en PDF"
            >
              ¡Descargar Pedido en PDF!
            </a>
            <button
              onClick={() => {
                setShowOrderSuccessModal(false);
                setCurrentStep('products');
                setCartItems([]);
                setClient({
                  companyName: '',
                  identification: '',
                  name: '',
                  surname: '',
                  phone: '',
                  address: '',
                  city: '',
                  department: '',
                  comentario: ''
                });
              }}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors text-base shadow-sm border border-red-700 text-center"
              aria-label="Salir"
            >
              ¡Salir!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}