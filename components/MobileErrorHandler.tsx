'use client';

import { useMobileErrorHandler } from '@/lib/useMobileErrorHandler';
import { ReactNode } from 'react';

interface MobileErrorHandlerProps {
  children: ReactNode;
}

export default function MobileErrorHandler({ children }: MobileErrorHandlerProps) {
  useMobileErrorHandler();
  
  return <>{children}</>;
}
