import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, Heart, LoaderCircle, X, ZoomIn, ZoomOut } from 'lucide-react';
import { Modal } from './Modal.jsx';

const MAX_SCALE = 4;
const ZOOM_STEP = 2.5;

/**
 * Visualizador em tela cheia: setas, teclado, deslizar no celular, zoom (botões, duplo toque,
 * pinça e roda do mouse) e arrastar para mover a foto ampliada. Com zoom, carrega o original.
 */
export function PhotoViewer({ state, onClose, onIndex, favorites, selection, onDownload, downloading }) {
  const open = Boolean(state);
  return (
    <Modal id="viewer" open={open} onClose={onClose} labelledBy="viewer-title" className="modal--viewer">
      {state && (
        <ViewerContent
          list={state.list}
          index={state.index}
          onClose={onClose}
          onIndex={onIndex}
          favorites={favorites}
          selection={selection}
          onDownload={onDownload}
          downloading={downloading}
        />
      )}
    </Modal>
  );
}

function ViewerContent({ list, index, onClose, onIndex, favorites, selection, onDownload, downloading }) {
  const photo = list[index];
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [hiRes, setHiRes] = useState(false);
  const [swipe, setSwipe] = useState(0);
  const stageRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(0);

  const hasPrev = index > 0;
  const hasNext = index < list.length - 1;
  const go = useCallback(
    (delta) => {
      const next = index + delta;
      if (next >= 0 && next < list.length) onIndex(next);
    },
    [index, list.length, onIndex],
  );

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setLoaded(false);
    setHiRes(false);
    setSwipe(0);
    // Pré-carrega as vizinhas para a navegação ficar instantânea
    for (const neighbor of [list[index - 1], list[index + 1]]) {
      if (neighbor) new Image().src = neighbor.urls.medium;
    }
  }, [index, list]);

  useEffect(() => {
    if (scale > 1) setHiRes(true);
  }, [scale]);

  const clampOffset = useCallback((next, s) => {
    const stage = stageRef.current;
    if (!stage) return next;
    const maxX = (stage.clientWidth * (s - 1)) / 2;
    const maxY = (stage.clientHeight * (s - 1)) / 2;
    return { x: Math.max(-maxX, Math.min(maxX, next.x)), y: Math.max(-maxY, Math.min(maxY, next.y)) };
  }, []);

  const zoomTo = useCallback(
    (s) => {
      const next = Math.max(1, Math.min(MAX_SCALE, s));
      setScale(next);
      setOffset((o) => (next === 1 ? { x: 0, y: 0 } : clampOffset(o, next)));
    },
    [clampOffset],
  );

  useEffect(() => {
    const onKey = (event) => {
      if (event.target.closest?.('input, select, textarea')) return;
      if (event.key === 'ArrowRight') go(1);
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === '+' || event.key === '=') zoomTo(scale * 1.5);
      else if (event.key === '-') zoomTo(scale / 1.5);
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, zoomTo, scale]);

  const onPointerDown = (event) => {
    if (event.target.closest('button')) return; // setas de navegação recebem o clique normalmente
    stageRef.current.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      gesture.current = { type: 'pinch', startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), startScale: scale };
    } else if (pts.length === 1) {
      gesture.current = { type: scale > 1 ? 'pan' : 'swipe', startX: event.clientX, startY: event.clientY, startOffset: offset, moved: false };
    }
  };

  const onPointerMove = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.type === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomTo((g.startScale * dist) / g.startDist);
      return;
    }
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
    if (g.type === 'pan') setOffset(clampOffset({ x: g.startOffset.x + dx, y: g.startOffset.y + dy }, scale));
    else if (g.type === 'swipe' && Math.abs(dx) > Math.abs(dy)) setSwipe(dx);
  };

  const onPointerUp = (event) => {
    if (!pointers.current.has(event.pointerId)) return;
    const g = gesture.current;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) {
      // Saiu de pinça para um dedo: continua como arrasto
      const [rest] = pointers.current.values();
      gesture.current = { type: scale > 1 ? 'pan' : 'swipe', startX: rest.x, startY: rest.y, startOffset: offset, moved: true };
      return;
    }
    gesture.current = null;
    setSwipe(0);
    if (!g || g.type === 'pinch') return;
    const dx = event.clientX - g.startX;
    const dy = event.clientY - g.startY;
    if (g.type === 'swipe' && g.moved) {
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
      else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) onClose();
      return;
    }
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap.current < 300) {
        zoomTo(scale > 1 ? 1 : ZOOM_STEP);
        lastTap.current = 0;
      } else lastTap.current = now;
    }
  };

  const onWheel = (event) => {
    if (!event.ctrlKey && Math.abs(event.deltaY) < 1) return;
    zoomTo(scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
  };

  const liked = favorites.liked.has(photo.id);
  const selected = selection.selected.has(photo.id);

  return (
    <div className="viewer">
      <header className="viewer__bar">
        <div className="viewer__title">
          <h2 id="viewer-title">Foto {photo.number}</h2>
          <span className="muted small" aria-live="polite">
            {index + 1} de {list.length}
          </span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar visualizador">
          <X size={22} />
        </button>
      </header>

      <div
        ref={stageRef}
        className={`viewer__stage${scale > 1 ? ' is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {!loaded && <LoaderCircle className="viewer__spinner spin" size={28} aria-label="Carregando foto" />}
        <img
          key={photo.id}
          className={`viewer__img${loaded ? ' is-loaded' : ''}`}
          src={hiRes ? photo.urls.original : photo.urls.medium}
          alt={photo.caption || `Fotografia ${photo.number} do Dia da Consciência Negra no CED 04`}
          style={{
            backgroundImage: `url(${photo.lqip})`,
            transform: `translate3d(${offset.x + swipe}px, ${offset.y}px, 0) scale(${scale})`,
            transition: gesture.current ? 'none' : undefined,
          }}
          draggable={false}
          onLoad={() => setLoaded(true)}
        />
        {hasPrev && (
          <button type="button" className="viewer__nav viewer__nav--prev" onClick={() => go(-1)} aria-label="Foto anterior">
            <ChevronLeft size={28} />
          </button>
        )}
        {hasNext && (
          <button type="button" className="viewer__nav viewer__nav--next" onClick={() => go(1)} aria-label="Próxima foto">
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      <footer className="viewer__foot">
        {photo.caption && <p className="viewer__caption">{photo.caption}</p>}
        <div className="viewer__actions">
          <button
            type="button"
            className={`tool${liked ? ' is-liked' : ''}`}
            onClick={() => favorites.toggleLike(photo.id)}
            aria-pressed={liked}
          >
            <Heart size={20} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
            <span>{liked ? 'Curtida' : 'Curtir'}</span>
            <span className="tool__count" aria-label={`${liked ? 1 : 0} curtida neste navegador`}>{liked ? 1 : 0}</span>
          </button>
          <button type="button" className={`tool${selected ? ' is-on' : ''}`} onClick={() => selection.toggle(photo.id)} aria-pressed={selected}>
            <Check size={20} aria-hidden="true" />
            <span>{selected ? 'Selecionada' : 'Selecionar'}</span>
          </button>
          <div className="tool-group" role="group" aria-label="Zoom">
            <button type="button" className="tool tool--icon" onClick={() => zoomTo(scale / 1.5)} disabled={scale <= 1} aria-label="Diminuir zoom">
              <ZoomOut size={20} />
            </button>
            <button type="button" className="tool tool--icon" onClick={() => zoomTo(scale * 1.5)} disabled={scale >= MAX_SCALE} aria-label="Aumentar zoom">
              <ZoomIn size={20} />
            </button>
          </div>
          <button type="button" className="tool tool--primary" onClick={() => onDownload(photo)} disabled={downloading === photo.id}>
            {downloading === photo.id ? <LoaderCircle size={20} className="spin" aria-hidden="true" /> : <Download size={20} aria-hidden="true" />}
            <span>Baixar original</span>
          </button>
        </div>
        <p className="viewer__file muted small">{photo.fileName}</p>
      </footer>
    </div>
  );
}
