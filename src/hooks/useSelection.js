import { useCallback, useMemo, useState } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState(() => new Set());

  const toggle = useCallback((id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectMany = useCallback((ids) => {
    setSelected((current) => new Set([...current, ...ids]));
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const isSelected = useCallback((id) => selected.has(id), [selected]);

  return useMemo(
    () => ({ selected, isSelected, toggle, selectMany, clear, count: selected.size }),
    [selected, isSelected, toggle, selectMany, clear],
  );
}
