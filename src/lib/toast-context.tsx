'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import Toast, { ToastProps } from '@/components/ui/toast';

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: 'success' | 'error' | 'info', message: string, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const generateId = () => Date.now().toString();

  const showToast = (type: 'success' | 'error' | 'info', message: string, duration = 3000) => {
    const id = generateId();
    const newToast: ToastItem = { id, type, message, duration };
    
    setToasts(prev => [...prev, newToast]);
  };

  const showSuccess = (message: string, duration = 3000) => {
    showToast('success', message, duration);
  };

  const showError = (message: string, duration = 5000) => { // エラーは少し長めに表示
    showToast('error', message, duration);
  };

  const showInfo = (message: string, duration = 3000) => {
    showToast('info', message, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const contextValue: ToastContextType = {
    showToast,
    showSuccess,
    showError,
    showInfo,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast表示エリア */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((toast, index) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            index={index}
            onClose={removeToast}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}