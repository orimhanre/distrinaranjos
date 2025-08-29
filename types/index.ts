export interface Product {
  id: string;
  name: string;
  brand: string;
  imageURL?: string[];

  type: string;
  colors: string[];
  price: number;
  price1?: number; // Optional for virtual environment
  price2?: number; // Optional for virtual environment
  isProductStarred?: boolean;
  quantity?: number;
  stock?: number; // Stock field for virtual products
  lastUpdated?: string;
  materials?: string;
  dimensions?: string;
  category?: string | string[];
  subCategory?: string | string[];
  detail?: string;
  capacity?: string;
  SKN?: string;
  
  // Additional fields for virtual products
  description?: string;
  isActive?: boolean;
  webPhotoUrl?: string;
  airtableId?: string;
  SKU?: string;
  commercialName?: string;
  distriPrice?: number;
  isProductStarredAirtable?: boolean;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedPrice: 'price1' | 'price2' | 'price';
  selectedColor: string;
  originalPrice?: number;
  isPromotional?: boolean;
}

export interface Client {
  companyName?: string;
  identification?: string;
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  department?: string;
  postalCode?: string;
  comentario?: string;
}

export interface ClientInfo {
  name?: string;
  surname?: string;
  phone?: string;
  company?: string;
  city?: string;
  department?: string;
  address?: string;
  identification?: string;
}

export interface OrderData {
  client: Client;
  cartItems: CartItem[];
  selectedPriceType: 'price1' | 'price2' | 'price';
  comentario: string;
} 