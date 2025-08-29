"use client";
import { useEffect, useState } from "react";

// Global flag to prevent multiple PDF opens
let globalPdfOpened = false;

export default function CatalogoPage() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchCatalogo = async () => {
      try {
        // Fetch webphotos from virtual database to get the catalogo PDF
        const response = await fetch('/api/webphotos');
        const data = await response.json();
        
        console.log('Webphotos API response:', data);
        console.log('Available webphotos:', data.webPhotos ? Object.keys(data.webPhotos) : 'None');
        
        if (data.success && data.webPhotos && data.webPhotos.catalogo) {
          console.log('Catalogo PDF found:', data.webPhotos.catalogo);
          console.log('Full PDF URL will be:', window.location.origin + data.webPhotos.catalogo);
          setPdfUrl(data.webPhotos.catalogo);
        } else {
          console.error('Catalogo PDF not found in webphotos');
          setError('Catálogo no encontrado en la base de datos');
        }
      } catch (err) {
        console.error('Error fetching catalogo:', err);
        setError('Error al cargar el catálogo');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalogo();
  }, []);

  // Open PDF on mobile when component mounts
  useEffect(() => {
    if (isMobile && pdfUrl && !globalPdfOpened) {
      const newWindow = window.open(pdfUrl, '_blank');
      if (newWindow) {
        newWindow.focus();
        globalPdfOpened = true;
      }
    }
  }, [isMobile, pdfUrl]); // Only run when these values change

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <span className="text-gray-500 text-lg">Cargando catálogo...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error al cargar el catálogo</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }

  if (pdfUrl) {
    // On mobile, show message instead of opening PDF again
    if (isMobile) {
      return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-500 text-2xl">📱</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">PDF Abierto en Nueva Pestaña</h2>
            <p className="text-gray-600 mb-4">El catálogo se ha abierto en una nueva pestaña para mejor visualización en móvil.</p>
            <button 
              onClick={() => window.open(pdfUrl, '_blank')} 
              className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Abrir PDF Nuevamente
            </button>
          </div>
        </div>
      );
    }

    // Desktop: use current working object tag setup
    return (
      <div className="min-h-screen bg-white">
        {/* PDF Viewer - Mobile Optimized */}
        <div 
          className="w-full relative flex items-center justify-center"
          style={{
            height: '100dvh',
            minHeight: '100dvh',
            overflow: 'auto',
          }}
        >
          {/* Mobile-friendly PDF viewer */}
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-full"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              minHeight: '100dvh',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          >
            {/* Fallback for browsers that don't support PDF objects */}
            <iframe
              src={pdfUrl}
              title="Catálogo PDF"
              className="w-full h-full border-none"
              style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                minHeight: '100dvh',
              }}
            />
          </object>
        </div>
      </div>
    );
  }
  return null;
} 