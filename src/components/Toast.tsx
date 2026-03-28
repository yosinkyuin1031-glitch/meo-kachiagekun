"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "error") => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm" role="alert" aria-live="assertive">
        {toasts.map((toast) => (
          <ToastMessage key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastMessage({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const styles: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: "M5 13l4 4L19 7" },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", icon: "M6 18L18 6M6 6l12 12" },
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  };

  const s = styles[toast.type];

  return (
    <div
      className={`${s.bg} ${s.border} border rounded-xl p-4 shadow-lg animate-[slideIn_0.3s_ease-out] flex items-start gap-3`}
      role="alert"
    >
      <svg className={`w-5 h-5 ${s.text} flex-shrink-0 mt-0.5`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
      </svg>
      <p className={`text-sm ${s.text} flex-1`}>{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className={`${s.text} opacity-60 hover:opacity-100 transition-opacity flex-shrink-0`}
        aria-label="通知を閉じる"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
