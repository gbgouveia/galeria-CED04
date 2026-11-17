import { ArrowDown, ScanFace } from 'lucide-react';
import { Spiral } from './Spiral.jsx';
import { EVENT } from '../config.js';
import { featuredPhoto, photos } from '../services/photoService.js';

export function Hero({ onFindMe }) {
  const photo = featuredPhoto;
  return (
    <section id="inicio" className="hero" aria-labelledby="hero-title">
      <figure className="hero__media" style={{ backgroundColor: photo.color }}>
        <img
          src={photo.urls.medium}
          alt={`Fotografia de destaque do evento: foto ${photo.number}`}
          width={photo.width}
          height={photo.height}
          fetchPriority="high"
          decoding="async"
          style={{ backgroundImage: `url(${photo.lqip})` }}
        />
        <figcaption className="hero__credit">
          Foto {photo.number} · {EVENT.photographer}
        </figcaption>
      </figure>

      <div className="hero__content">
        <Spiral className="hero__spiral" turns={5} strokeWidth={0.5} />
        <p className="eyebrow">
          {EVENT.school} · {EVENT.dateLabel}
        </p>
        <h1 id="hero-title" className="hero__title">
          Dia da <em>Consciência</em> Negra
        </h1>
        <p className="hero__subtitle">
          {EVENT.school} — {EVENT.subtitle}
        </p>

        <dl className="hero__facts">
          <div>
            <dt>Fotografias</dt>
            <dd>{photos.length.toLocaleString('pt-BR')}</dd>
          </div>
          <div>
            <dt>Evento</dt>
            <dd>{EVENT.school}</dd>
          </div>
          <div>
            <dt>Fotografia</dt>
            <dd>{EVENT.photographer}</dd>
          </div>
        </dl>

        <div className="hero__actions">
          <a className="btn btn--primary btn--lg" href="#galeria">
            Explorar galeria <ArrowDown size={18} aria-hidden="true" />
          </a>
          <button type="button" className="btn btn--outline btn--lg" onClick={onFindMe}>
            <ScanFace size={18} aria-hidden="true" /> Encontrar minhas fotos
          </button>
        </div>
      </div>
    </section>
  );
}
