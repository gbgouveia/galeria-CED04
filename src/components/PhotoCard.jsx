import { memo, useState } from 'react';
import { Check, Heart } from 'lucide-react';

const ROW_UNIT = 4;

/** Cartão da galeria. A altura em linhas do grid vem da proporção real da foto (masonry). */
export const PhotoCard = memo(function PhotoCard({
  photo,
  columnWidth,
  gap,
  liked,
  selected,
  selectMode,
  onOpen,
  onToggleLike,
  onToggleSelect,
}) {
  const [loaded, setLoaded] = useState(false);
  const height = columnWidth ? (columnWidth * photo.height) / photo.width : 0;
  const span = columnWidth ? Math.ceil((height + gap) / ROW_UNIT) : undefined;
  const label = `Foto ${photo.number}`;

  return (
    <figure
      className={`card${selected ? ' is-selected' : ''}${loaded ? ' is-loaded' : ''}`}
      style={{ gridRowEnd: span ? `span ${span}` : undefined, '--gap': `${gap}px` }}
    >
      <button
        type="button"
        className="card__open"
        onClick={() => (selectMode ? onToggleSelect(photo.id) : onOpen(photo.id))}
        aria-label={selectMode ? `${selected ? 'Desmarcar' : 'Selecionar'} ${label}` : `Abrir ${label} em tela cheia`}
        aria-pressed={selectMode ? selected : undefined}
        style={{
          aspectRatio: `${photo.width} / ${photo.height}`,
          backgroundColor: photo.color,
          backgroundImage: `url(${photo.lqip})`,
        }}
      >
        <img
          src={photo.urls.thumb}
          alt=""
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      </button>

      <figcaption className="card__meta">
        <span className="card__number">{photo.number}</span>
      </figcaption>

      <div className="card__actions">
        <button
          type="button"
          className={`chip-btn${liked ? ' is-liked' : ''}`}
          onClick={() => onToggleLike(photo.id)}
          aria-pressed={liked}
          aria-label={`${liked ? 'Descurtir' : 'Curtir'} ${label}`}
        >
          <Heart size={18} aria-hidden="true" fill={liked ? 'currentColor' : 'none'} />
          <span className="chip-btn__count">{liked ? 1 : 0}</span>
        </button>
        <button
          type="button"
          className={`chip-btn chip-btn--check${selected ? ' is-on' : ''}`}
          onClick={() => onToggleSelect(photo.id)}
          aria-pressed={selected}
          aria-label={`${selected ? 'Desmarcar' : 'Selecionar'} ${label}`}
        >
          <Check size={18} aria-hidden="true" strokeWidth={2.5} />
        </button>
      </div>
    </figure>
  );
});
