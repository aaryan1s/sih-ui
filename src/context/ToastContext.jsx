import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { ok: CheckCircle2, error: XCircle, info: Info };

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const push = useCallback((message, kind = 'info') => {
    const id = ++idRef.current;
    setToasts((current) => [...current, { id, message, kind }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  }, []);

  const value = useMemo(
    () => ({
      push,
      ok: (message) => push(message, 'ok'),
      error: (message) => push(message, 'error'),
      info: (message) => push(message, 'info'),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toaster-region" aria-live="polite" role="status">
        {toasts.map(({ id, message, kind }) => {
          const Icon = ICONS[kind] || Info;
          return (
            <div key={id} className={`toast toast-${kind}`}>
              <Icon size={15} aria-hidden="true" />
              <span>{message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
