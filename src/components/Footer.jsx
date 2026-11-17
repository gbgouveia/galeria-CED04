import { Spiral } from './Spiral.jsx';
import { EVENT } from '../config.js';

export function Footer({ onPrivacy }) {
  return (
    <footer className="footer">
      <div className="footer__inner wrap">
        <Spiral className="footer__mark" turns={3} strokeWidth={3} />
        <div>
          <p className="footer__event">
            {EVENT.title} · {EVENT.school} · {EVENT.dateLabel}
          </p>
          <p className="muted small">
            Fotografias: <strong>{EVENT.photographer}</strong>. Uso pessoal e educativo; para outros usos, fale com o
            fotógrafo.
          </p>
          <p className="muted small">
            As curtidas são salvas só neste navegador e não somam curtidas de outros visitantes.{' '}
            <button type="button" className="link-btn" onClick={onPrivacy}>
              Privacidade
            </button>
          </p>
        </div>
      </div>
    </footer>
  );
}
