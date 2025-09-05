'use client';

import { useState } from 'react';
import { CartItem, Client } from '@/types';

interface OrderSummaryProps {
  cartItems: CartItem[];
  client: Client;
  selectedPriceType: 'price1' | 'price2' | 'price';
  onGeneratePDF: (comentario: string) => void;
  loading?: boolean;
  totalColor?: string;
  environment?: 'regular' | 'virtual';
}

export default function OrderSummary({ 
  cartItems, 
  client, 
  selectedPriceType, 
  onGeneratePDF, 
  loading = false,
  totalColor = 'text-green-600'
}: OrderSummaryProps) {
  const [comentario, setComentario] = useState(client.comentario || '');

  // Format price with thousand separators using dots and no decimals
  const formatPrice = (price: number) => {
    return Math.round(price).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const total = (cartItems || []).reduce((sum, item) => {
    // For virtual environment, always use price field
    const price = item.selectedPrice === 'price' ? (item.product.price || 0) : 
                  (item.selectedPrice === 'price1' ? (item.product.price1 || 0) : (item.product.price2 || 0));
    return sum + (price * item.quantity);
  }, 0);

  const getPriceColor = () => {
    // For virtual environment, use neutral color since there's only one price
    if (selectedPriceType === 'price') return 'text-gray-600';
    return selectedPriceType === 'price1' ? 'text-green-600' : 'text-blue-600';
  };

  const handleGeneratePDF = () => {
    onGeneratePDF(comentario);
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto">
      <h2 className="text-3xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
        <span className="text-blue-500 text-2xl">📋</span> Resumen del Pedido
      </h2>
      
      {/* Client Information */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-green-500 text-lg">👤</span> Información del Cliente
        </h3>
        <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 border border-green-200 shadow-sm">
          <div className="space-y-2">
            {/* Empresa - on its own line */}
            {client.companyName && (
              <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-green-100 shadow-sm">
                <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xs">🏢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-medium">Empresa / Tienda</div>
                  <div className="text-sm font-semibold text-red-700">{client.companyName}</div>
                </div>
              </div>
            )}
            
            {/* Nombre and Apellido - on the same line */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {client.name && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-100 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-xs">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">Nombre(s)</div>
                    <div className="text-sm font-semibold text-gray-900">{client.name}</div>
                  </div>
                </div>
              )}
              
              {client.surname && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-purple-100 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-xs">👤</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">Apellido(s)</div>
                    <div className="text-sm font-semibold text-gray-900">{client.surname}</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Cédula and Teléfono - on the same line (under name/surname) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {client.identification && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-blue-100 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-xs">🆔</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">Cédula</div>
                    <div className="text-sm font-semibold text-gray-900">{client.identification}</div>
                  </div>
                </div>
              )}
              
              {client.phone && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-green-100 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-green-600 text-xs">📞</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">Teléfono</div>
                    <div className="text-sm font-semibold text-green-700">{client.phone}</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Address fields */}
            <div className="space-y-2">
              {client.address && (
                <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-orange-100 shadow-sm">
                  <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 text-xs">📍</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 font-medium">Calle / Carretera</div>
                    <div className="text-sm font-semibold text-orange-700">{client.address}</div>
                  </div>
                </div>
              )}
              
              {/* Ciudad and Departamento - on the same line */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {client.city && (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-indigo-100 shadow-sm">
                    <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-indigo-600 text-xs">🏘️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 font-medium">Ciudad / Pueblo</div>
                      <div className="text-sm font-semibold text-gray-900">{client.city}</div>
                    </div>
                  </div>
                )}
                
                {client.department && (
                  <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-amber-100 shadow-sm">
                    <div className="flex-shrink-0 w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="text-amber-600 text-xs">🏛️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 font-medium">Departamento</div>
                      <div className="text-sm font-semibold text-amber-700">{client.department}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-yellow-500 text-lg">💬</span> Información Adicional
        </h3>
        <div>
          <label htmlFor="comentario" className="block text-sm font-medium text-gray-700 mb-1">
            Comentarios/Observaciones
          </label>
          <textarea
            id="comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none text-black bg-gray-50 shadow-sm"
            placeholder="Ingrese comentarios adicionales u observaciones"
          />
        </div>
      </div>

      {/* Order Items */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="text-blue-400 text-lg">📦</span> Artículos del Pedido
        </h3>
        <div className="space-y-4">
          {(cartItems || []).map((item, index) => {
            // For virtual environment, always use price field
            const price = item.selectedPrice === 'price' ? (item.product.price || 0) : 
                          (item.selectedPrice === 'price1' ? (item.product.price1 || 0) : (item.product.price2 || 0));
            const priceColor = item.selectedPrice === 'price' ? 'text-gray-600' : 
                              (item.selectedPrice === 'price1' ? 'text-green-600' : 'text-blue-600');
            // Ensure we use local photos only
            const getImageUrl = () => {
              // Helper function to validate URLs (same as ProductCatalog)
              const isValidLocalUrl = (url: any): boolean => {
                if (!url || typeof url !== 'string') return false;
                const cleanUrl = url.trim();
                if (cleanUrl === '') return false;
                
                // Accept local paths starting with /
                if (cleanUrl.startsWith('/')) return true;
                
                // Accept local API endpoints for regular environment
                if (cleanUrl.includes('/api/images/regular/')) return true;
                
                // Accept local API endpoints for virtual environment
                if (cleanUrl.includes('/api/images/virtual/')) return true;
                
                // Accept Cloudinary URLs (for regular environment)
                if (cleanUrl.includes('res.cloudinary.com')) return true;
                
                // Accept Airtable URLs (for both virtual and regular environments)
                if (cleanUrl.includes('dl.airtable.com')) return true;
                
                // Reject other external URLs
                if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
                  return false;
                }
                
                return false;
              };

              // Handle imageURL property
              const imageData = (item.product as any).imageURL;
              
              if (imageData) {
                let imageUrl = '';
                
                if (Array.isArray(imageData)) {
                  imageUrl = imageData[0] || '';
                } else {
                  imageUrl = String(imageData || '');
                }
                
                // Handle different URL formats
                if (imageUrl && typeof imageUrl === 'string' && isValidLocalUrl(imageUrl)) {
                  // If it's already a valid local URL, use it as is
                  return imageUrl;
                }
              }
              
              return '/placeholder-product.svg';
            };
            return (
              <div key={index} className="flex items-center gap-4 bg-gray-50 border border-gray-200 rounded-xl p-4 shadow-sm">
                <img
                  src={getImageUrl()}
                  alt={item.product.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 object-cover rounded-lg border border-gray-200 bg-white"
                  onError={e => { e.currentTarget.src = '/placeholder-product.svg'; }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm truncate" title={item.product.name}>{item.product.name}</h4>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-600 truncate flex-1">{item.product.brand}{item.product.type && (<span className="text-gray-500"> ({item.product.type})</span>)}</p>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">Cantidad: <span className="text-gray-900 font-medium">{item.quantity}</span></span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    {item.selectedColor && (
                      <p className="text-xs text-gray-500 flex-1">Color: {item.selectedColor}</p>
                    )}
                    <span className={`text-xs font-semibold ${priceColor} flex-shrink-0`}>Precio: ${formatPrice(price)}</span>
                  </div>
                  <div className="text-right mt-1">
                    <span className={`text-sm font-bold ${priceColor}`}>SubTotal: ${formatPrice(price * item.quantity)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Price Type and Total */}
      <div className="mb-8">
        <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-green-50 rounded-xl px-6 py-4 shadow-inner">
          <span className={`flex items-center gap-2 text-xl font-bold ${totalColor}`}>
            <span className={`text-lg ${totalColor.replace('text-', 'text-').replace('-600', '-500')}`}>💰</span> TOTAL:
          </span>
          <span className={`text-2xl font-extrabold ${getPriceColor()}`}>${formatPrice(total)}</span>
        </div>
      </div>

      {/* Send Order Button */}
      <button
        onClick={handleGeneratePDF}
        disabled={loading || (cartItems || []).length === 0}
        className={`w-full py-4 px-4 rounded-xl text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-colors
          ${loading || (cartItems || []).length === 0
            ? 'bg-gray-400 cursor-not-allowed'
            : selectedPriceType === 'price'
            ? 'bg-gray-600 hover:bg-gray-700'
            : selectedPriceType === 'price1'
            ? 'bg-green-600 hover:bg-green-700'
            : 'bg-blue-600 hover:bg-blue-700'
          }`}
      >
        <span className="text-white text-xl">📤</span>
        {loading ? 'Enviando Pedido...' : 'Enviar Pedido a DistriNaranjos'}
      </button>

      {(cartItems || []).length === 0 && (
        <p className="text-center text-gray-500 text-sm mt-2">
          Agregue productos al carrito para generar un pedido
        </p>
      )}
    </div>
  );
} 