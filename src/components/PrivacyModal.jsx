import { X } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { EVENT } from '../config.js';

export function PrivacyModal({ open, onClose }) {
  return (
    <Modal id="privacy" open={open} onClose={onClose} labelledBy="privacy-title" className="modal--panel">
      <article className="panel prose">
        <header className="panel__head">
          <div>
            <p className="eyebrow">LGPD</p>
            <h2 id="privacy-title" className="panel__title">
              Privacidade
            </h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={22} />
          </button>
        </header>

        <h3>Fotografias</h3>
        <p>
          As fotografias do {EVENT.title} do {EVENT.school} foram feitas por {EVENT.photographer} e estão disponíveis
          nesta galeria para visualização e download pela comunidade escolar. A galeria não identifica nomes de
          participantes. Use as imagens de forma respeitosa, especialmente as de estudantes menores de idade.
        </p>
        <p>
          Se você aparece em alguma foto e deseja que ela seja retirada, fale com a coordenação do {EVENT.school} ou com o
          fotógrafo informando o número da foto.
        </p>

        <h3>Reconhecimento facial</h3>
        <ul>
          <li>Funciona somente se você pedir e der seu consentimento.</li>
          <li>Todo o processamento acontece no seu aparelho, dentro do navegador.</li>
          <li>Sua selfie não é enviada para nenhum servidor e não é salva. Ela é descartada ao fechar a busca.</li>
          <li>
            Para acelerar novas buscas, dados numéricos dos rostos das fotos do evento (não da sua selfie) ficam guardados
            neste navegador por até 7 dias. Você pode apagá-los a qualquer momento no botão “Apagar selfie e dados”.
          </li>
          <li>Não existe banco de identidades nem associação de rostos a nomes.</li>
          <li>
            O reconhecimento é aproximado: pode mostrar fotos de pessoas parecidas e deixar de mostrar fotos em que você
            aparece. Não é uma forma de identificação.
          </li>
          <li>Menores de 18 anos devem usar o recurso com autorização do responsável.</li>
        </ul>

        <h3>Curtidas e dados do navegador</h3>
        <p>
          As curtidas ficam salvas apenas neste navegador (armazenamento local). Elas não são enviadas a ninguém e não
          representam uma contagem total entre visitantes.
        </p>
        <p>
          Este site não usa cookies de rastreamento, ferramentas de análise ou publicidade. As fontes e os modelos de
          reconhecimento facial são servidos pelo próprio site.
        </p>
      </article>
    </Modal>
  );
}
