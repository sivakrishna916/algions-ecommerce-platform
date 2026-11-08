import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);
let id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const dismiss = useCallback((tid) => setToasts((t) => t.filter((x) => x.id !== tid)), []);
  const push = useCallback((message, type = 'success') => {
    id += 1;
    const tid = id;
    setToasts((t) => [...t, { id: tid, message, type }]);
    setTimeout(() => dismiss(tid), 4500);
  }, [dismiss]);
  const api = useMemo(() => ({ success: (m) => push(m, 'success'), error: (m) => push(m, 'error'), info: (m) => push(m, 'info') }), [push]);

  const styles = { success: 'bg-emerald-600', error: 'bg-rose-600', info: 'bg-slate-800' };
  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live so screen readers announce feedback */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lift ${styles[t.type]}`}>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-white/80 hover:text-white">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
