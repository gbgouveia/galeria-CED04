import { ScanFace, ShieldCheck } from 'lucide-react';
import { Spiral } from './Spiral.jsx';
import { EVENT } from '../config.js';

export function Header({ onFindMe, onPrivacy }) {
  return (
    <header className="header">
      <div className="header__inner wrap">
        <a className="brand" href="#inicio" aria-label={`${EVENT.title}, ${EVENT.school}: voltar ao início`}>
          <Spiral className="brand__mark" turns={3} strokeWidth={4} />
          <span className="brand__text">
            <strong>{EVENT.school}</strong>
            <span>Consciência Negra</span>
          </span>
        </a>
        <nav className="header__nav" aria-label="Principal">
          <a href="#galeria" className="header__link">
            Galeria
          </a>
          <button type="button" className="btn btn--ghost btn--sm header__find" onClick={onFindMe} aria-label="Encontrar minhas fotos">
            <ScanFace size={18} aria-hidden="true" />
            <span aria-hidden="true">Encontrar minhas fotos</span>
          </button>
          <button type="button" className="icon-btn" onClick={onPrivacy} aria-label="Privacidade">
            <ShieldCheck size={20} />
          </button>
        </nav>
      </div>
    </header>
  );
}
