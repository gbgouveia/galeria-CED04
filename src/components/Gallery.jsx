import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckCheck, Download, Heart, Images, Search, SquareCheck, X } from 'lucide-react';
import { PhotoCard } from './PhotoCard.jsx';
import { categories, formatBytes, photos, plural, totalBytes } from '../services/photoService.js';

const PAGE = 24;

function layoutFor(width) {
  const columns = width < 560 ? 2 : width < 900 ? 3 : width < 1320 ? 4 : 5;
  const gap = columns === 2 ? 8 : 14;
  return { columns, gap, columnWidth: (width - gap * (columns - 1)) / columns };
}

export function Gallery({ gallery, favorites, selection, selectMode, setSelectMode, onOpen, onDownloadAll }) {
  const { query, setQuery, category, setCategory, view, setView, filtered, reset } = gallery;
  const gridRef = useRef(null);
  const sentinelRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(PAGE);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    setWidth(grid.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  // Carregamento progressivo: renderiza blocos de fotos conforme a rolagem se aproxima do fim
  useEffect(() => setVisible(PAGE), [query, category, view]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible((v) => Math.min(v + PAGE, filtered.length)),
      { rootMargin: '1200px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filtered.length, visible]);

  const { columns, gap, columnWidth } = layoutFor(width || 360);
  const shown = filtered.slice(0, visible);
  const filtering = query || category !== 'all' || view !== 'all';

  return (
    <section id="galeria" className="gallery" aria-labelledby="galeria-title">
      <header className="gallery__head wrap">
        <div className="gallery__intro">
          <p className="eyebrow">A exposição</p>
          <h2 id="galeria-title" className="section-title">Galeria</h2>
          <p className="muted">
            {plural(photos.length, 'fotografia', 'fotografias')} em resolução original. Toque em uma foto para ampliar.
          </p>
        </div>
        <button type="button" className="download-all" onClick={onDownloadAll}>
          <Download size={22} aria-hidden="true" />
          <span>
            <strong>Baixar todas as fotografias</strong>
            <small>
              ZIP · {plural(photos.length, 'arquivo', 'arquivos')} · {formatBytes(totalBytes)}
            </small>
          </span>
        </button>
      </header>

      <div className="toolbar" role="search">
        <div className="toolbar__inner wrap">
          <label className="search">
            <Search size={18} aria-hidden="true" />
            <span className="visually-hidden">Buscar por nome ou número do arquivo</span>
            <input
              type="search"
              inputMode="search"
              placeholder="Buscar nº ou nome do arquivo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              enterKeyHint="search"
            />
            {query && (
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setQuery('')} aria-label="Limpar busca">
                <X size={16} />
              </button>
            )}
          </label>

          <div className="segmented" role="group" aria-label="Filtrar fotografias">
            <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>
              <Images size={16} aria-hidden="true" /> Todas
            </button>
            <button type="button" aria-pressed={view === 'liked'} onClick={() => setView('liked')}>
              <Heart size={16} aria-hidden="true" /> Curtidas <span className="count">{favorites.total}</span>
            </button>
            {selection.count > 0 && (
              <button type="button" aria-pressed={view === 'selected'} onClick={() => setView('selected')}>
                <CheckCheck size={16} aria-hidden="true" /> Selecionadas <span className="count">{selection.count}</span>
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <label className="select">
              <span className="visually-hidden">Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className={`btn btn--sm ${selectMode ? 'btn--primary' : 'btn--ghost'} toolbar__select`}
            aria-pressed={selectMode}
            onClick={() => setSelectMode(!selectMode)}
          >
            <SquareCheck size={16} aria-hidden="true" /> {selectMode ? 'Concluir seleção' : 'Selecionar'}
          </button>
        </div>
      </div>

      <div className="wrap">
        {selectMode && (
          <div className="select-hint">
            <span>Toque nas fotos para selecionar.</span>
            {filtered.length > 0 && (
              <button type="button" className="link-btn" onClick={() => selection.selectMany(filtered.map((p) => p.id))}>
                Selecionar {filtering ? 'as exibidas' : 'todas'} ({filtered.length})
              </button>
            )}
          </div>
        )}

        <p className="visually-hidden" aria-live="polite">
          {filtering ? `${plural(filtered.length, 'foto encontrada', 'fotos encontradas')}` : ''}
        </p>

        {filtered.length === 0 ? (
          <div className="empty">
            {view === 'liked' && !query ? (
              <>
                <Heart size={28} aria-hidden="true" />
                <p>Você ainda não curtiu nenhuma foto.</p>
                <p className="muted small">Toque no coração de uma foto para guardá-la aqui. As curtidas ficam salvas neste navegador.</p>
              </>
            ) : (
              <>
                <Search size={28} aria-hidden="true" />
                <p>Nenhuma foto encontrada{query ? ` para “${query}”` : ''}.</p>
                <p className="muted small">Tente só o número da foto, por exemplo “24”.</p>
              </>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Ver todas as fotos
            </button>
          </div>
        ) : null}

        <div
          ref={gridRef}
          className="masonry"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, columnGap: `${gap}px` }}
        >
          {width > 0 &&
            shown.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                columnWidth={columnWidth}
                gap={gap}
                liked={favorites.liked.has(photo.id)}
                selected={selection.selected.has(photo.id)}
                selectMode={selectMode}
                onOpen={(id) => onOpen(id, filtered)}
                onToggleLike={favorites.toggleLike}
                onToggleSelect={selection.toggle}
              />
            ))}
        </div>
        {visible < filtered.length && (
          <div ref={sentinelRef} className="loading-more" aria-hidden="true">
            Carregando mais fotos…
          </div>
        )}
      </div>
    </section>
  );
}
