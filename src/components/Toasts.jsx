import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const notify = useCallback(
    (message, { tone = 'info', duration = 4200 } = {}) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => notify, [notify]);

  // Os modais (<dialog>) ficam na "top layer" do navegador. Para o aviso aparecer acima deles,
  // o contêiner é um popover reaberto a cada aviso, ficando por último na top layer.
  const containerRef = useRef(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el?.showPopover) return;
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch {
      // navegador sem suporte a popover: o aviso aparece normalmente fora dos modais
    }
  }, [toasts]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div ref={containerRef} className="toasts" popover="manual" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.tone === 'error' ? <CircleAlert size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
            <span>{toast.message}</span>
            <button type="button" className="icon-btn icon-btn--sm" onClick={() => dismiss(toast.id)} aria-label="Fechar aviso">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
