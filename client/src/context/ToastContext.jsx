import { useCallback, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import { ToastContext } from "./contexts";

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const show = useCallback((message, type = "info") => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  }, []);

  const value = useMemo(
    () => ({
      toast: show,
      toastError: (message) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex max-w-sm animate-pop items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          >
            {toast.type === "error" ? (
              <FiAlertCircle className="shrink-0 text-red-400 dark:text-red-600" />
            ) : (
              <FiCheckCircle className="shrink-0 text-emerald-400 dark:text-emerald-600" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
