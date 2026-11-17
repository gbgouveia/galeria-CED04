import { useDeferredValue, useMemo, useState } from 'react';
import { matchesQuery, photos } from '../services/photoService.js';

/** Filtros da galeria: busca por nome/número, categoria e visão (todas, curtidas, selecionadas). */
export function useGallery({ liked, selected }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [view, setView] = useState('all');
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(
    () =>
      photos.filter((photo) => {
        if (category !== 'all' && photo.category !== category) return false;
        if (view === 'liked' && !liked.has(photo.id)) return false;
        if (view === 'selected' && !selected.has(photo.id)) return false;
        return matchesQuery(photo, deferredQuery);
      }),
    [category, view, liked, selected, deferredQuery],
  );

  const reset = () => {
    setQuery('');
    setCategory('all');
    setView('all');
  };

  return { query, setQuery, category, setCategory, view, setView, filtered, reset };
}
