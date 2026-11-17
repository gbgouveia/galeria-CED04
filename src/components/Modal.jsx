import { useEffect, useRef } from 'react';
import { useHistoryModal } from '../hooks/useHistoryModal.js';

/**
 * Modal baseado no <dialog> nativo: foco preso no conteúdo, Esc fecha, fundo inerte.
 * O conteúdo só é montado enquanto aberto.
 */
export function Modal({ id, open, onClose, labelledBy, className = '', children, dismissable = true }) {
  const ref = useRef(null);
  useHistoryModal(id, open, onClose);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(event) => {
        if (dismissable && event.target === ref.current) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}
