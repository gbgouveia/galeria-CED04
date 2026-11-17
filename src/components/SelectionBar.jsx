import { Download, X } from 'lucide-react';
import { formatBytes, plural, sumBytes } from '../services/photoService.js';

export function SelectionBar({ selection, selectedPhotos, onDownload, onClear }) {
  if (selection.count === 0) return null;
  return (
    <div className="selection-bar" role="region" aria-label="Fotos selecionadas">
      <div className="selection-bar__inner">
        <button type="button" className="icon-btn" onClick={onClear} aria-label="Limpar seleção">
          <X size={20} />
        </button>
        <p className="selection-bar__count" aria-live="polite">
          <strong>{plural(selection.count, 'selecionada', 'selecionadas')}</strong>
          <span className="muted small">{formatBytes(sumBytes(selectedPhotos))}</span>
        </p>
        <button type="button" className="btn btn--primary" onClick={onDownload}>
          <Download size={18} aria-hidden="true" /> Baixar ZIP
        </button>
      </div>
    </div>
  );
}
