'use client';

import React, { useState, useEffect, useRef } from 'react';

interface FlyingAnimationProps {
  isVisible: boolean;
  imageUrl: string;
  startPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  onComplete: () => void;
}

export default function FlyingAnimation({ 
  isVisible, 
  imageUrl, 
  startPosition,
  targetPosition,
  onComplete 
}: FlyingAnimationProps) {
  const [animationState, setAnimationState] = useState<'idle' | 'flying' | 'complete'>('idle');
  const [animationProgress, setAnimationProgress] = useState(0);
  const animationRef = useRef<number | null>(null);
  const isAnimatingRef = useRef(false);
  const hasCompletedRef = useRef(false);
  const lastVisibilityChange = useRef(0);
  const animationId = useRef(Math.random().toString(36).substr(2, 9));
  
  useEffect(() => {
    const now = performance.now();
    
    // Remove debounce to allow immediate animation triggers
    lastVisibilityChange.current = now;
    
    // Prevent multiple simultaneous animations with extra checks
    if (isVisible && !isAnimatingRef.current) {
      // Reset completion flag immediately when starting new animation
      hasCompletedRef.current = false;
      console.log(`🚀 Starting flying animation [${animationId.current}]`);
      isAnimatingRef.current = true;
      setAnimationState('flying');
      setAnimationProgress(0);
      
      const startTime = performance.now();
      const duration = 1400; // Much faster for instant response
      let lastFrameTime = startTime;
      
      const animate = (currentTime: number) => {
        // Remove frame rate limiting for instant response
        lastFrameTime = currentTime;
        const elapsed = currentTime - startTime;
        let progress = Math.min(elapsed / duration, 1);
        
        // Apply ultra-smooth easing to the progress itself
        progress = easeInOutCubic(progress);
        
        setAnimationProgress(progress);
        
        if (progress < 1 && isAnimatingRef.current) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          console.log(`✅ Flying animation completed [${animationId.current}]`);
          setAnimationState('complete');
          isAnimatingRef.current = false;
          
          // Call onComplete and reset flags immediately
          console.log(`🏁 Calling onComplete [${animationId.current}]`);
          onComplete();
          // Reset flags immediately to allow future animations
          hasCompletedRef.current = false;
          // Generate new ID for next potential animation
          animationId.current = Math.random().toString(36).substr(2, 9);
          console.log(`🔄 Reset animation flags immediately, new ID: [${animationId.current}]`);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    // Reset when becoming invisible
    if (!isVisible) {
      if (isAnimatingRef.current) {
        console.log(`🛑 Animation cancelled - component became invisible [${animationId.current}]`);
        isAnimatingRef.current = false;
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        setAnimationState('idle');
        setAnimationProgress(0);
      }
      // Always reset completion flag when invisible
      hasCompletedRef.current = false;
    }
    
    // Minimal logging for performance
    // console.log(`🔍 FlyingAnimation visibility: ${isVisible}, animating: ${isAnimatingRef.current}, completed: ${hasCompletedRef.current} [${animationId.current}]`);
    
    // Cleanup function
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      isAnimatingRef.current = false;
    };
  }, [isVisible]); // Remove onComplete from dependencies to prevent re-runs
  
  if (!isVisible) return null;
  
  // Ultra-smooth easing functions for buttery motion
  const easeInOutCubic = (t: number) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };
  
  const easeOutCubicBezier = (t: number) => {
    // Ultra-smooth cubic-bezier (0.25, 0.46, 0.45, 0.94) - smooth acceleration and deceleration
    return 1 - Math.pow(1 - t, 3);
  };
  
  const easeInOutQuart = (t: number) => {
    return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t;
  };
  
  const easeOutExpo = (t: number) => {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  };
  
  // Calculate ultra-smooth curved path with physics-inspired motion
  const getCurvedPosition = (progress: number) => {
    const startX = 0;
    const startY = 0;
    const endX = targetPosition.x - startPosition.x;
    const endY = targetPosition.y - startPosition.y;
    
    // Use ultra-smooth easing for both axes with slight variation
    const easedProgressX = easeOutCubicBezier(progress);
    const easedProgressY = easeOutCubicBezier(progress * 1.05); // Slight Y offset for natural feel
    
    // Calculate distance for adaptive arc height
    const distance = Math.sqrt(endX * endX + endY * endY);
    const arcHeightFactor = Math.min(distance / 350, 1.8); // Slightly higher arc
    
    // Create ultra-smooth Bezier curve with optimized control points
    const controlPoint1X = endX * 0.3; // Slightly later control point
    const controlPoint1Y = endY * 0.2 - (140 * arcHeightFactor); // Higher initial arc
    const controlPoint2X = endX * 0.8; // Later second control point  
    const controlPoint2Y = endY * 0.8 - (40 * arcHeightFactor); // Gentler descent
    
    // Ultra-smooth Cubic Bezier curve calculation with interpolation
    const t = progress;
    const t2 = t * t;
    const t3 = t2 * t;
    const invT = 1 - t;
    const invT2 = invT * invT;
    const invT3 = invT2 * invT;
    
    // Apply smoothing to the Bezier calculation itself
    const smoothT = easeInOutCubic(t);
    const smoothT2 = smoothT * smoothT;
    const smoothT3 = smoothT2 * smoothT;
    const smoothInvT = 1 - smoothT;
    const smoothInvT2 = smoothInvT * smoothInvT;
    const smoothInvT3 = smoothInvT2 * smoothInvT;
    
    const x = smoothInvT3 * startX + 
              3 * smoothInvT2 * smoothT * controlPoint1X + 
              3 * smoothInvT * smoothT2 * controlPoint2X + 
              smoothT3 * endX;
              
    const y = smoothInvT3 * startY + 
              3 * smoothInvT2 * smoothT * controlPoint1Y + 
              3 * smoothInvT * smoothT2 * controlPoint2Y + 
              smoothT3 * endY;
    
    return { x, y };
  };
  
  const currentPosition = getCurvedPosition(animationProgress);
  
  // Ultra-smooth scaling with dramatic size reduction from big to small
  const getTransformations = (progress: number) => {
    // Use ultra-smooth easing for scaling with natural physics feel
    const scalingProgress = easeOutCubicBezier(progress);
    
    // Dramatic scaling: 1.8x → 0.12x with ultra-smooth transition
    const startScale = 2; // Start 80% bigger
    const endScale = 0.15;   // End even smaller for more dramatic effect
    const scale = startScale - (scalingProgress * (startScale - endScale));
    
    // Ultra-smooth rotation with natural deceleration
    const rotationProgress = easeInOutCubic(progress);
    const rotation = Math.sin(rotationProgress * Math.PI * 2.5) * 18 * (1 - rotationProgress) * (1 - rotationProgress);
    
    // Ultra-smooth opacity transition with multiple stages
    let opacity;
    if (progress < 0.75) {
      // Gradual fade with smooth curve
      const fadeProgress = easeOutCubicBezier(progress / 0.75);
      opacity = 0.95 - (fadeProgress * 0.08); // Very gradual fade
    } else {
      // Final fade out with smooth acceleration
      const finalFadeProgress = (progress - 0.75) / 0.25;
      const smoothFade = easeInOutCubic(finalFadeProgress);
      opacity = 0.87 * (1 - smoothFade);
    }
    
    return { scale, rotation, opacity };
  };
  
  const transformations = getTransformations(animationProgress);
  
  return (
    <div 
      className="fixed z-[9999999] pointer-events-none"
      style={{
        left: startPosition.x,
        top: startPosition.y,
        transform: animationState === 'flying' 
          ? `translate(${currentPosition.x}px, ${currentPosition.y}px) scale(${transformations.scale}) rotate(${transformations.rotation}deg)` 
          : animationState === 'complete'
            ? `translate(${currentPosition.x}px, ${currentPosition.y}px) scale(0.1) rotate(0deg)`
            : 'translate(0, 0) scale(1) rotate(0deg)',
        opacity: animationState === 'flying' 
          ? transformations.opacity 
          : animationState === 'complete' 
            ? 0 
            : 1,
        transition: animationState === 'flying' 
          ? 'none' // Disable CSS transition for custom animation
          : animationState === 'complete'
            ? 'opacity 0.2s ease-out, transform 0.2s ease-out'
            : 'all 0.3s ease',
        filter: animationState === 'flying' 
          ? `blur(${easeInOutCubic(animationProgress) * 0.3}px) brightness(${1.1 - easeOutCubicBezier(animationProgress) * 0.08})` 
          : 'none',
        willChange: 'transform, opacity, filter' // Optimize for animations
      }}
    >
      <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-2xl">
        {/* Enhanced glow effect that scales with size */}
        {animationState === 'flying' && (
          <div 
            className="absolute inset-0 rounded-full bg-blue-400"
            style={{
              opacity: Math.sin(easeInOutCubic(animationProgress) * Math.PI) * 0.35 * (1 - easeOutCubicBezier(animationProgress) * 0.6),
              transform: `scale(${1.1 + (1 - easeOutCubicBezier(animationProgress)) * 0.25})`,
              transition: 'all 16ms ease-out' // Ultra-smooth micro-transitions
            }}
          />
        )}
        
        {/* Main product image */}
        <img 
          src={imageUrl} 
          alt="Product" 
          className="relative z-10 w-full h-full object-cover"
          style={{
            transform: animationState === 'flying' 
              ? `scale(${1 + Math.sin(easeInOutCubic(animationProgress) * Math.PI * 4) * 0.06 * (1 - easeOutCubicBezier(animationProgress))})` 
              : 'scale(1)',
            transition: animationState === 'flying' ? 'all 16ms ease-out' : 'all 0.2s ease'
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder-product.svg';
          }}
        />
        
        {/* Enhanced trailing effect with size-responsive opacity */}
        {animationState === 'flying' && animationProgress > 0.03 && (
          <div 
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 blur-md"
            style={{
              transform: `scale(${0.9 + (1 - easeOutCubicBezier(animationProgress)) * 0.35})`,
              opacity: Math.sin(easeInOutCubic(animationProgress) * Math.PI) * 0.45 * (1 - easeOutCubicBezier(animationProgress) * 0.8),
              transition: 'all 16ms ease-out'
            }}
          />
        )}
        
        {/* Outer ring effect for dramatic size change */}
        {animationState === 'flying' && animationProgress < 0.35 && (
          <div 
            className="absolute inset-0 rounded-full border-2 border-blue-300"
            style={{
              transform: `scale(${1.15 + (1 - easeOutCubicBezier(animationProgress)) * 0.5})`,
              opacity: (1 - easeInOutCubic(animationProgress)) * 0.5,
              transition: 'all 16ms ease-out'
            }}
          />
        )}
      </div>
    </div>
  );
} 