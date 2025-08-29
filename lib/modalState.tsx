'use client';
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalStateContextType {
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ModalStateContext = createContext<ModalStateContextType | undefined>(undefined);

export function ModalStateProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <ModalStateContext.Provider value={{ isModalOpen, openModal, closeModal }}>
      {children}
    </ModalStateContext.Provider>
  );
}

export function useModalState() {
  const context = useContext(ModalStateContext);
  if (context === undefined) {
    throw new Error('useModalState must be used within a ModalStateProvider');
  }
  return context;
} 