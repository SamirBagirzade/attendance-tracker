"use client";

import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";
type Toast = { id: number; message: string; type: ToastType };
type ToastContextValue = { showToast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
const STYLES = {
  success: "bg-emerald-50 border-emerald-200 text-emerald-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};
const ICON_STYLES = {
  success: "text-emerald-500",
  error: "text-red-500",
  info: "text-blue-500",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const Icon = ICONS[toast.type];
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${STYLES[toast.type]}`}>
      <Icon className={`mt-0.5 shrink-0 ${ICON_STYLES[toast.type]}`} size={16} />
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button className="shrink-0 opacity-60 hover:opacity-100" onClick={() => onDismiss(toast.id)} type="button">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId.current;
    setToasts((t) => [...t.slice(-4), { id, message, type }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" style={{ maxWidth: 360 }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
}
