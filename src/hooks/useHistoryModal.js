import { useEffect, useRef } from 'react';

/**
 * Faz o botão "voltar" do celular fechar o modal aberto em vez de sair da página.
 * Cada modal empilha sua chave em history.state; modais aninhados funcionam.
 */
export function useHistoryModal(key, open, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const stack = window.history.state?.modals ?? [];
    window.history.pushState({ ...window.history.state, modals: [...stack, key] }, '');
    let poppedByBrowser = false;

    const onPop = (event) => {
      if (!(event.state?.modals ?? []).includes(key)) {
        poppedByBrowser = true;
        onCloseRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Fechado pela interface: remove a entrada que este modal criou
      if (!poppedByBrowser && window.history.state?.modals?.at(-1) === key) window.history.back();
    };
  }, [key, open]);
}
