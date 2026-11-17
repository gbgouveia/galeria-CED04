import { Camera, ScanFace, ShieldCheck, Smartphone } from 'lucide-react';
import { Spiral } from './Spiral.jsx';

/** Seção da página que apresenta o recurso e abre o fluxo de busca facial. */
export function FindMeSection({ onStart }) {
  return (
    <section id="encontre" className="findme" aria-labelledby="findme-title">
      <div className="findme__inner wrap">
        <Spiral className="findme__spiral" turns={6} strokeWidth={0.4} />
        <div className="findme__text">
          <p className="eyebrow">Reconhecimento facial</p>
          <h2 id="findme-title" className="section-title">
            Encontre suas fotos
          </h2>
          <p className="findme__lead">
            Envie uma selfie e veja em quais fotografias do evento você provavelmente aparece. Tudo é feito no seu
            aparelho: sua selfie não sai do navegador.
          </p>
          <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
            <ScanFace size={20} aria-hidden="true" /> Começar
          </button>
        </div>
        <ul className="findme__points">
          <li>
            <Camera size={20} aria-hidden="true" />
            <span>Tire uma selfie na hora ou escolha uma foto do celular.</span>
          </li>
          <li>
            <ShieldCheck size={20} aria-hidden="true" />
            <span>Sem cadastro, sem nomes e sem envio de imagens.</span>
          </li>
          <li>
            <Smartphone size={20} aria-hidden="true" />
            <span>A primeira busca leva alguns minutos. As seguintes são rápidas.</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
