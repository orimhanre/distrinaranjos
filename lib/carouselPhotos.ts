// Dynamic carousel photo loader
import { fetchWebPhotos } from './databaseService';

export interface CarouselPhoto {
  id: string;
  url: string;
  title: string;
  description: string;
  keywords: string[];
}

export async function getCarouselPhotos(): Promise<CarouselPhoto[]> {
  try {
    const webPhotos = await fetchWebPhotos();
    
    // Map the photos to carousel format
    const carouselPhotos: CarouselPhoto[] = [
      {
        id: 'uso-diario',
        url: webPhotos['producto_popular1'] || '/images/webphotos/modelo_massnu.png',
        title: 'Uso Diario',
        description: 'Perfecto para el día a día. Nuestros morrales están diseñados para acompañarte en todas tus actividades cotidianas, desde ir al trabajo hasta hacer compras. Con múltiples compartimentos y materiales resistentes, son la elección ideal para mantener todo organizado.',
        keywords: ['Trabajo', 'Estudio', 'Compras']
      },
      {
        id: 'profesional-negocios',
        url: webPhotos['producto_nuevo1'] || '/images/webphotos/modelo_reno.png',
        title: 'Profesional y Negocios',
        description: 'Elegancia y funcionalidad para el entorno profesional. Nuestros morrales ejecutivos combinan estilo sofisticado con máxima practicidad. Perfectos para reuniones de trabajo, presentaciones y el día a día en la oficina, manteniendo todo organizado y accesible.',
        keywords: ['Oficina', 'Reuniones', 'Presentaciones']
      },
      {
        id: 'viajes-aventura',
        url: webPhotos['producto_promocion1'] || '/images/webphotos/modelo_najos.png',
        title: 'Viajes y Aventura',
        description: 'Ideal para tus aventuras y viajes. Nuestros morrales resistentes están preparados para acompañarte en senderismo, excursiones y viajes largos. Con materiales impermeables y diseño ergonómico, garantizan comodidad y durabilidad en cualquier terreno.',
        keywords: ['Senderismo', 'Viajes', 'Deportes']
      }
    ];
    
    return carouselPhotos;
  } catch (error) {
    console.error('Error loading carousel photos:', error);
    
    // Fallback to static photos
    return [
      {
        id: 'uso-diario',
        url: '/images/webphotos/modelo_massnu.png',
        title: 'Uso Diario',
        description: 'Perfecto para el día a día. Nuestros morrales están diseñados para acompañarte en todas tus actividades cotidianas, desde ir al trabajo hasta hacer compras. Con múltiples compartimentos y materiales resistentes, son la elección ideal para mantener todo organizado.',
        keywords: ['Trabajo', 'Estudio', 'Compras']
      },
      {
        id: 'profesional-negocios',
        url: '/images/webphotos/modelo_reno.png',
        title: 'Profesional y Negocios',
        description: 'Elegancia y funcionalidad para el entorno profesional. Nuestros morrales ejecutivos combinan estilo sofisticado con máxima practicidad. Perfectos para reuniones de trabajo, presentaciones y el día a día en la oficina, manteniendo todo organizado y accesible.',
        keywords: ['Oficina', 'Reuniones', 'Presentaciones']
      },
      {
        id: 'viajes-aventura',
        url: '/images/webphotos/modelo_najos.png',
        title: 'Viajes y Aventura',
        description: 'Ideal para tus aventuras y viajes. Nuestros morrales resistentes están preparados para acompañarte en senderismo, excursiones y viajes largos. Con materiales impermeables y diseño ergonómico, garantizan comodidad y durabilidad en cualquier terreno.',
        keywords: ['Senderismo', 'Viajes', 'Deportes']
      }
    ];
  }
} 