'use client';

import React, { useState } from 'react';

interface AddToCartButtonProps {
  onAddToCart: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function AddToCartButton({ 
  onAddToCart, 
  disabled = false, 
  loading = false, 
  className = '',
  children 
}: AddToCartButtonProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    if (disabled || loading) return;
    
    setIsAnimating(true);
    onAddToCart();
    
    // Reset animation state after a short delay
    setTimeout(() => setIsAnimating(false), 300);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        relative px-4 py-2 rounded-lg font-medium transition-all duration-200
        ${disabled 
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
          : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-lg transform hover:scale-105'
        }
        ${loading ? 'opacity-75 cursor-wait' : ''}
        ${isAnimating ? 'animate-pulse' : ''}
        ${className}
      `}
      aria-label={loading ? 'Adding to cart...' : 'Add to cart'}
    >
      {loading ? (
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Adding...</span>
        </div>
      ) : (
        children || (
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m6-5v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
            </svg>
            <span>Add to Cart</span>
          </div>
        )
      )}
    </button>
  );
}
