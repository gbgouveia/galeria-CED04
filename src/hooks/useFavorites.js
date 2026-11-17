import { useCallback, useEffect, useMemo, useState } from 'react';
import { readJSON, writeJSON } from '../services/storage.js';
import { photoById } from '../services/photoService.js';

const KEY = 'ced04:curtidas:v1';

/**
 * Curtidas salvas apenas neste navegador (localStorage).
 * Não existe contagem global: o GitHub Pages não tem servidor para somar curtidas de visitantes.
 * Um Set garante que a mesma foto não seja curtida duas vezes no mesmo navegador.
 */
export function useFavorites() {
  const [liked, setLiked] = useState(() => new Set(readJSON(KEY, []).filter((id) => photoById.has(id))));

  useEffect(() => {
    // Mantém abas abertas sincronizadas
    const onStorage = (event) => {
      if (event.key === KEY) setLiked(new Set(readJSON(KEY, [])));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleLike = useCallback((id) => {
    setLiked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeJSON(KEY, [...next]);
      return next;
    });
  }, []);

  const isLiked = useCallback((id) => liked.has(id), [liked]);
  const likeCount = useCallback((id) => (liked.has(id) ? 1 : 0), [liked]);

  return useMemo(
    () => ({ liked, isLiked, likeCount, toggleLike, total: liked.size }),
    [liked, isLiked, likeCount, toggleLike],
  );
}
