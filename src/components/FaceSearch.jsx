import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CircleAlert,
  Download,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ScanFace,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Modal } from './Modal.jsx';
import {
  DEFAULT_THRESHOLD,
  THRESHOLD_RANGE,
  analyzeSelfie,
  bestDistance,
  clearFaceData,
  indexPhotos,
  initFaceEngine,
  isFaceSearchSupported,
} from '../services/faceRecognition.js';
import { photos, plural } from '../services/photoService.js';

const SELFIE_ERRORS = {
  'not-image': 'Esse arquivo não é uma imagem. Escolha uma foto (JPG, PNG ou HEIC convertida).',
  unreadable: 'Não conseguimos abrir essa imagem neste navegador. Tente tirar a selfie pela câmera ou usar outra foto.',
  'no-face': 'Não encontramos um rosto nessa imagem. Use uma selfie de frente, bem iluminada, sem óculos escuros.',
};

/** Rótulo amigável para o limiar de distância (menor = mais rigoroso). */
function strictnessLabel(threshold) {
  if (threshold <= 0.44) return 'Rigoroso: menos resultados, mais certeiros';
  if (threshold <= 0.53) return 'Equilibrado';
  return 'Flexível: mais resultados, mais engano';
}

/**
 * "Encontre suas fotos": consentimento, selfie, indexação local das fotos e resultados.
 * Etapas: intro -> pick -> analyzing -> search
 */
export function FaceSearch({ open, onClose, onOpenPhoto, onDownloadZip, onDownloadPhoto, onShowPrivacy }) {
  const [step, setStep] = useState('intro');
  const [consent, setConsent] = useState(false);
  const [engine, setEngine] = useState({ status: 'idle' });
  const [selfie, setSelfie] = useState(null);
  const [selfieError, setSelfieError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: photos.length, finished: false });
  const [index, setIndex] = useState(() => new Map());
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [failedCount, setFailedCount] = useState(0);
  const abortRef = useRef(null);
  const cameraInput = useRef(null);
  const fileInput = useRef(null);

  const supported = isFaceSearchSupported();

  const startEngine = useCallback(() => {
    setEngine({ status: 'loading' });
    initFaceEngine()
      .then((info) => setEngine({ status: 'ready', ...info }))
      .catch((error) => setEngine({ status: 'error', message: error.message }));
  }, []);

  // Libera a selfie da memória ao trocar ou ao desmontar
  useEffect(() => () => selfie?.previewUrl && URL.revokeObjectURL(selfie.previewUrl), [selfie]);

  const forgetSelfie = useCallback(() => {
    abortRef.current?.abort();
    setSelfie(null);
    setSelfieError('');
    if (cameraInput.current) cameraInput.current.value = '';
    if (fileInput.current) fileInput.current.value = '';
  }, []);

  const handleClose = () => {
    // Ao fechar, a selfie e o descritor são descartados. O índice das fotos do evento continua
    // no aparelho para acelerar uma nova busca (pode ser apagado no botão "Apagar dados").
    forgetSelfie();
    setStep(consent ? 'pick' : 'intro');
    onClose();
  };

  const acceptConsent = () => {
    setStep('pick');
    startEngine();
  };

  const runIndex = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setFailedCount(0);
    indexPhotos(photos, {
      signal: controller.signal,
      onEntry: (photo, faces) => setIndex((current) => new Map(current).set(photo.id, faces)),
      onProgress: (done, total, finished) => setProgress({ done, total, finished }),
    })
      .then(({ failed, aborted }) => {
        if (aborted) return;
        setFailedCount(failed.length);
        setProgress((p) => ({ ...p, done: p.total, finished: true }));
      })
      .catch((error) => setEngine({ status: 'error', message: error.message }));
  }, []);

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelfieError('');
    setStep('analyzing');
    try {
      const result = await analyzeSelfie(file);
      setSelfie(result);
      setStep('search');
      runIndex();
    } catch (error) {
      setSelfieError(SELFIE_ERRORS[error.code] ?? `Não foi possível analisar a selfie (${error.message}).`);
      setStep('pick');
    } finally {
      event.target.value = '';
    }
  };

  const deleteEverything = async () => {
    forgetSelfie();
    await clearFaceData();
    setIndex(new Map());
    setProgress({ done: 0, total: photos.length, finished: false });
    setEngine({ status: 'idle' });
    setConsent(false);
    setStep('intro');
  };

  const results = useMemo(() => {
    if (!selfie) return [];
    const matches = [];
    for (const photo of photos) {
      const faces = index.get(photo.id);
      if (!faces?.length) continue;
      const d = bestDistance(faces, selfie.descriptor);
      if (d <= threshold) matches.push({ photo, distance: d });
    }
    return matches.sort((a, b) => a.distance - b.distance);
  }, [index, selfie, threshold]);

  const resultPhotos = results.map((r) => r.photo);
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal id="face" open={open} onClose={handleClose} labelledBy="face-title" className="modal--sheet">
      <div className="face">
        <header className="panel__head">
          <div>
            <p className="eyebrow">
              <ScanFace size={14} aria-hidden="true" /> Reconhecimento facial no seu aparelho
            </p>
            <h2 id="face-title" className="panel__title">Encontre suas fotos</h2>
          </div>
          <button type="button" className="icon-btn" onClick={handleClose} aria-label="Fechar">
            <X size={22} />
          </button>
        </header>

        {!supported && (
          <div className="alert alert--error">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              Seu navegador não oferece os recursos necessários (WebGL e leitura de imagens). Atualize o navegador ou tente
              pelo Chrome, Safari ou Firefox mais recentes. Você ainda pode procurar suas fotos pela galeria.
            </p>
          </div>
        )}

        {supported && step === 'intro' && (
          <div className="face__intro">
            <ol className="steps">
              <li>
                <strong>Envie uma selfie.</strong> Tire na hora ou escolha uma foto de rosto, de frente e bem iluminada.
              </li>
              <li>
                <strong>Comparação no seu aparelho.</strong> O navegador analisa os rostos das fotos do evento e procura os
                parecidos com o seu. A primeira busca leva alguns minutos; as próximas são rápidas.
              </li>
              <li>
                <strong>Veja e baixe.</strong> Baixe as fotos encontradas uma a uma ou todas em ZIP.
              </li>
            </ol>

            <div className="privacy-box">
              <ShieldCheck size={20} aria-hidden="true" />
              <ul>
                <li>Sua selfie não é enviada para nenhum servidor e não é salva.</li>
                <li>Não pedimos nome nem identificamos ninguém: só comparamos semelhança entre rostos.</li>
                <li>
                  Para agilizar, os dados numéricos dos rostos das fotos do evento ficam guardados por até 7 dias só neste
                  navegador. Você pode apagá-los quando quiser.
                </li>
                <li>Os resultados são sugestões e podem conter erros.</li>
              </ul>
              <button type="button" className="link-btn" onClick={onShowPrivacy}>
                Ler a política de privacidade
              </button>
            </div>

            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>
                Concordo que minha selfie seja processada <strong>apenas neste aparelho</strong> para encontrar fotos
                parecidas. Se eu for menor de 18 anos, tenho autorização do meu responsável.
              </span>
            </label>

            <button type="button" className="btn btn--primary btn--block" disabled={!consent} onClick={acceptConsent}>
              Continuar
            </button>
          </div>
        )}

        {supported && (step === 'pick' || step === 'analyzing') && (
          <div className="face__pick">
            <EngineStatus engine={engine} onRetry={startEngine} />

            {selfieError && (
              <div className="alert alert--error" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <p>{selfieError}</p>
              </div>
            )}

            {step === 'analyzing' ? (
              <div className="analyzing" role="status">
                <LoaderCircle size={32} className="spin" aria-hidden="true" />
                <p>Procurando seu rosto na selfie…</p>
              </div>
            ) : (
              <>
                <p className="muted">Use uma foto só sua, de frente, sem óculos escuros, boné ou filtro.</p>
                <div className="pick-actions">
                  <button type="button" className="pick" onClick={() => cameraInput.current?.click()}>
                    <Camera size={28} aria-hidden="true" />
                    <span>Tirar selfie</span>
                  </button>
                  <button type="button" className="pick" onClick={() => fileInput.current?.click()}>
                    <ImagePlus size={28} aria-hidden="true" />
                    <span>Escolher foto</span>
                  </button>
                </div>
                <input ref={cameraInput} type="file" accept="image/*" capture="user" hidden onChange={onFile} />
                <input ref={fileInput} type="file" accept="image/*" hidden onChange={onFile} />
              </>
            )}
          </div>
        )}

        {supported && step === 'search' && selfie && (
          <div className="face__search">
            <div className="face__ref">
              {selfie.previewUrl && <img src={selfie.previewUrl} alt="Recorte do rosto da sua selfie" />}
              <div className="face__ref-text">
                <p>
                  <strong>Rosto de referência</strong>
                  {selfie.facesFound > 1 && (
                    <span className="muted small"> · {selfie.facesFound} rostos na selfie; usamos o maior.</span>
                  )}
                </p>
                <div className="face__ref-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => { forgetSelfie(); setStep('pick'); }}>
                    <RefreshCw size={16} aria-hidden="true" /> Outra selfie
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={deleteEverything}>
                    <Trash2 size={16} aria-hidden="true" /> Apagar selfie e dados
                  </button>
                </div>
              </div>
            </div>

            {!progress.finished && (
              <div className="indexing" role="status">
                <div className="indexing__row">
                  <LoaderCircle size={16} className="spin" aria-hidden="true" />
                  <span>
                    Analisando fotos do evento: {progress.done} de {progress.total}
                  </span>
                  <span className="muted">{pct}%</span>
                </div>
                <div className="progress" aria-hidden="true">
                  <span className="progress__bar" style={{ transform: `scaleX(${pct / 100})` }} />
                </div>
                <p className="muted small">
                  Pode continuar olhando os resultados enquanto isso. Deixe esta tela aberta até terminar.
                </p>
              </div>
            )}

            <div className="threshold">
              <label htmlFor="threshold">
                <SlidersHorizontal size={16} aria-hidden="true" /> Sensibilidade da busca
              </label>
              <input
                id="threshold"
                type="range"
                min={THRESHOLD_RANGE.min}
                max={THRESHOLD_RANGE.max}
                step={THRESHOLD_RANGE.step}
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
                aria-valuetext={strictnessLabel(threshold)}
              />
              <div className="threshold__scale muted small" aria-hidden="true">
                <span>Rigoroso</span>
                <span>{strictnessLabel(threshold).split(':')[0]}</span>
                <span>Flexível</span>
              </div>
            </div>

            <div className="results-head">
              <p aria-live="polite">
                <strong>{plural(results.length, 'foto encontrada', 'fotos encontradas')}</strong>
                {!progress.finished && <span className="muted"> até agora</span>}
              </p>
              {results.length > 0 && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => onDownloadZip(resultPhotos)}>
                  <Download size={16} aria-hidden="true" /> Baixar resultados (ZIP)
                </button>
              )}
            </div>

            {results.length > 0 ? (
              <ul className="results">
                {results.map(({ photo, distance }) => (
                  <li key={photo.id} className="result">
                    <button type="button" className="result__open" onClick={() => onOpenPhoto(photo.id, resultPhotos)} aria-label={`Abrir foto ${photo.number}`}>
                      <img src={photo.urls.thumb} alt="" loading="lazy" width={photo.width} height={photo.height} style={{ backgroundColor: photo.color }} />
                    </button>
                    <div className="result__meta">
                      <span className="small">
                        Foto {photo.number} ·{' '}
                        <span className="muted">{distance <= 0.42 ? 'muito parecida' : 'parecida'}</span>
                      </span>
                      <button type="button" className="icon-btn icon-btn--sm" onClick={() => onDownloadPhoto(photo)} aria-label={`Baixar foto ${photo.number}`}>
                        <Download size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              progress.finished && (
                <div className="empty">
                  <ScanFace size={28} aria-hidden="true" />
                  <p>Não encontramos fotos parecidas com a sua selfie.</p>
                  <p className="muted small">
                    Tente deixar a busca mais flexível acima, usar outra selfie de frente e com boa luz, ou procure pela
                    galeria completa. Você pode estar em fotos de grupo com o rosto pequeno ou de perfil.
                  </p>
                </div>
              )
            )}

            {progress.finished && failedCount > 0 && (
              <p className="err small">
                {plural(failedCount, 'foto não pôde ser analisada', 'fotos não puderam ser analisadas')} (falha de conexão).{' '}
                <button type="button" className="link-btn" onClick={runIndex}>Tentar de novo</button>
              </p>
            )}

            <p className="disclaimer small muted">
              Resultados são sugestões geradas por comparação automática de rostos e podem incluir pessoas parecidas ou
              deixar fotos de fora. Nenhuma identidade é confirmada.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function EngineStatus({ engine, onRetry }) {
  if (engine.status === 'loading') {
    return (
      <p className="engine muted small" role="status">
        <LoaderCircle size={14} className="spin" aria-hidden="true" /> Preparando o reconhecimento facial (cerca de 12 MB, só na
        primeira vez)…
      </p>
    );
  }
  if (engine.status === 'error') {
    return (
      <div className="alert alert--error" role="alert">
        <CircleAlert size={18} aria-hidden="true" />
        <p>
          Não foi possível carregar o reconhecimento facial. Verifique sua conexão.{' '}
          <button type="button" className="link-btn" onClick={onRetry}>
            Tentar de novo
          </button>
        </p>
      </div>
    );
  }
  return null;
}
