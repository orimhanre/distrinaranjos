'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  price1?: number;
  price2?: number;
  originalPrice?: number;
  isPromotional?: boolean;
  quantity: number;
  image: string;
  category: string | string[];
  subCategory?: string | string[];
  brand: string;
  type?: string;
  color?: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  testCartPersistence: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') {
      console.log('Skipping localStorage load - not on client side');
      return;
    }

    try {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(parsedCart);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    }
  }, []);



  const addToCart = (newItem: CartItem) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === newItem.id);
      let newCartItems;
      
      if (existingItem) {
        // Update quantity if item already exists
        newCartItems = prevItems.map(item =>
          item.id === newItem.id
            ? { ...item, quantity: item.quantity + newItem.quantity }
            : item
        );
      } else {
        // Add new item
        newCartItems = [...prevItems, newItem];
      }
      
      // Immediately save to localStorage
      try {
        localStorage.setItem('cart', JSON.stringify(newCartItems));
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
      
      return newCartItems;
    });
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(prevItems => {
      const newCartItems = prevItems.filter(item => item.id !== itemId);
      // Immediately save to localStorage
      try {
        localStorage.setItem('cart', JSON.stringify(newCartItems));
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
      return newCartItems;
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCartItems(prevItems => {
      const newCartItems = prevItems.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      );
      // Immediately save to localStorage
      try {
        localStorage.setItem('cart', JSON.stringify(newCartItems));
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
      return newCartItems;
    });
  };

  const clearCart = () => {
    console.log('=== CLEARING CART ===');
    console.log('Cart items before clearing:', cartItems);
    setCartItems([]);
    localStorage.removeItem('cart');
    console.log('Cart cleared');
  };

  const getTotalItems = () => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => {
      // The price in the cart item is already the correct price (discounted if promotional)
      // No need to apply discount again since it was already applied when adding to cart
      return total + (item.price * item.quantity);
    }, 0);
  };

  // Debug function to test cart persistence
  const testCartPersistence = () => {
    console.log('=== TESTING CART PERSISTENCE ===');
    console.log('Current cart items:', cartItems);
    console.log('localStorage cart:', localStorage.getItem('cart'));
    console.log('Total items:', getTotalItems());
    console.log('Total price:', getTotalPrice());
    
    // Test localStorage directly
    try {
      const testItem = { id: 'test', name: 'Test Item', price: 100, quantity: 1, image: '', category: '', brand: '' };
      localStorage.setItem('test-cart', JSON.stringify([testItem]));
      const retrieved = localStorage.getItem('test-cart');
      console.log('localStorage test - saved:', JSON.stringify([testItem]));
      console.log('localStorage test - retrieved:', retrieved);
      localStorage.removeItem('test-cart');
    } catch (error) {
      console.error('localStorage test failed:', error);
    }
  };

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
    testCartPersistence,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
} 