import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Download, FileArchive, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { Modal } from './Modal.jsx';
import { buildZip, saveBlob, splitIntoParts } from '../services/downloadService.js';
import { formatBytes, plural, sumBytes } from '../services/photoService.js';
import { EVENT } from '../config.js';

/**
 * Monta e baixa ZIPs das fotos originais com barra de progresso.
 * Coleções grandes são divididas em partes (limite de memória do navegador, principalmente no celular);
 * cada parte é baixada por um toque do visitante, evitando bloqueio de downloads múltiplos.
 */
export function DownloadManager({ job, onClose }) {
  const open = Boolean(job);
  const parts = useMemo(() => (job ? splitIntoParts(job.photos) : []), [job]);
  const [states, setStates] = useState({});
  const controller = useRef(null);
  const running = Object.values(states).some((s) => s.status === 'running');

  useEffect(() => {
    setStates({});
  }, [job]);

  const zipFileName = (index) => {
    const base = `${EVENT.zipName}-${job.slug}`;
    return parts.length > 1 ? `${base}-parte-${index + 1}-de-${parts.length}.zip` : `${base}.zip`;
  };

  const runPart = useCallback(
    async (index) => {
      const list = parts[index];
      controller.current = new AbortController();
      const update = (patch) => setStates((s) => ({ ...s, [index]: { ...s[index], ...patch } }));
      update({ status: 'running', phase: 'fetch', done: 0, total: list.length, bytes: 0, percent: 0, error: null });
      try {
        const { blob, failed, count } = await buildZip(list, {
          signal: controller.current.signal,
          onProgress: (progress) => update(progress),
        });
        saveBlob(blob, zipFileName(index));
        update({ status: 'done', failed, count });
      } catch (error) {
        if (error.name === 'AbortError') update({ status: 'cancelled' });
        else update({ status: 'error', error: error.message || 'Falha ao gerar o arquivo ZIP.' });
      } finally {
        controller.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, job],
  );

  // Uma parte só: começa automaticamente
  useEffect(() => {
    if (open && parts.length === 1) runPart(0);
    return () => controller.current?.abort();
  }, [open, parts, runPart]);

  const close = () => {
    controller.current?.abort();
    onClose();
  };

  return (
    <Modal id="download" open={open} onClose={close} labelledBy="download-title" className="modal--panel">
      {job && (
        <div className="panel">
          <header className="panel__head">
            <div>
              <p className="eyebrow">Download em ZIP</p>
              <h2 id="download-title" className="panel__title">{job.title}</h2>
              <p className="muted">
                {plural(job.photos.length, 'fotografia original', 'fotografias originais')} ·{' '}
                {formatBytes(sumBytes(job.photos))}
              </p>
            </div>
            <button type="button" className="icon-btn" onClick={close} aria-label="Fechar">
              <X size={20} />
            </button>
          </header>

          {parts.length > 1 && (
            <p className="note">
              Para não sobrecarregar a memória do seu aparelho, o arquivo foi dividido em{' '}
              {parts.length} partes. Baixe uma de cada vez.
            </p>
          )}

          <ol className="parts">
            {parts.map((list, index) => (
              <PartRow
                key={index}
                label={parts.length > 1 ? `Parte ${index + 1} de ${parts.length}` : 'Arquivo completo'}
                detail={`${plural(list.length, 'foto', 'fotos')} · ${formatBytes(sumBytes(list))}`}
                state={states[index]}
                disabled={running}
                onStart={() => runPart(index)}
                onCancel={() => controller.current?.abort()}
              />
            ))}
          </ol>

          <p className="muted small">
            Os arquivos mantêm os nomes originais. No iPhone, o ZIP fica no app Arquivos (pasta Downloads).
          </p>
        </div>
      )}
    </Modal>
  );
}

function PartRow({ label, detail, state, disabled, onStart, onCancel }) {
  const status = state?.status ?? 'idle';
  const fetchPct = state?.total ? (state.done / state.total) * 100 : 0;
  // 90% da barra para baixar os arquivos, 10% para montar o ZIP
  const pct = status === 'done' ? 100 : state?.phase === 'zip' ? 90 + (state.percent ?? 0) / 10 : fetchPct * 0.9;

  return (
    <li className={`part part--${status}`}>
      <div className="part__head">
        <FileArchive size={20} aria-hidden="true" className="part__icon" />
        <div className="part__text">
          <strong>{label}</strong>
          <span className="muted small">{detail}</span>
        </div>
        {status === 'running' ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
            Cancelar
          </button>
        ) : status === 'done' ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onStart} disabled={disabled}>
            <RotateCcw size={16} aria-hidden="true" /> Baixar de novo
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={onStart} disabled={disabled}>
            {status === 'error' || status === 'cancelled' ? <RotateCcw size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
            {status === 'error' || status === 'cancelled' ? 'Tentar de novo' : 'Baixar'}
          </button>
        )}
      </div>

      {status !== 'idle' && (
        <div className="progress" role="progressbar" aria-label={`Progresso: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
          <span className="progress__bar" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      )}

      <p className="part__status small" aria-live="polite">
        {status === 'running' && state.phase === 'fetch' && (
          <>
            <LoaderCircle size={14} className="spin" aria-hidden="true" /> Baixando {state.done} de {state.total} arquivos ·{' '}
            {formatBytes(state.bytes || 1)}
          </>
        )}
        {status === 'running' && state.phase === 'zip' && (
          <>
            <LoaderCircle size={14} className="spin" aria-hidden="true" /> Montando o arquivo ZIP… {Math.round(state.percent)}%
          </>
        )}
        {status === 'done' && (
          <span className="ok">
            <CircleCheck size={14} aria-hidden="true" /> Pronto: {plural(state.count, 'foto', 'fotos')} no ZIP.
          </span>
        )}
        {status === 'cancelled' && <span className="muted">Download cancelado.</span>}
        {status === 'error' && (
          <span className="err">
            <CircleAlert size={14} aria-hidden="true" /> {state.error}
          </span>
        )}
      </p>
      {status === 'done' && state.failed?.length > 0 && (
        <p className="err small">
          {plural(state.failed.length, 'foto não pôde ser baixada', 'fotos não puderam ser baixadas')} e ficaram de fora:{' '}
          {state.failed.map((f) => f.photo.fileName).join(', ')}. Tente baixar de novo.
        </p>
      )}
    </li>
  );
}
