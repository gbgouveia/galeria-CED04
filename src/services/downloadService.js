const CONCURRENCY = 4;
const RETRIES = 2;

/**
 * Tamanho máximo de cada ZIP gerado no navegador. O ZIP é montado em memória, então em
 * celulares (memória limitada) a galeria é dividida em partes menores para não travar a aba.
 */
export function zipPartLimit() {
  const memory = navigator.deviceMemory ?? 4;
  const mobile = window.matchMedia?.('(pointer: coarse)').matches;
  if (mobile || memory <= 4) return 150 * 1024 * 1024;
  return 600 * 1024 * 1024;
}

/** Divide as fotos em partes que respeitam o limite de bytes, mantendo a ordem. */
export function splitIntoParts(list, limit = zipPartLimit()) {
  const parts = [];
  let current = [];
  let bytes = 0;
  for (const photo of list) {
    if (current.length && bytes + photo.sizeBytes > limit) {
      parts.push(current);
      current = [];
      bytes = 0;
    }
    current.push(photo);
    bytes += photo.sizeBytes;
  }
  if (current.length) parts.push(current);
  return parts;
}

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Safari precisa que a URL continue válida por alguns segundos
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function fetchWithRetry(url, signal) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
    try {
      const response = await fetch(url, { signal, cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.blob();
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** Baixa uma foto na resolução original, com o nome original do arquivo. */
export async function downloadPhoto(photo) {
  const blob = await fetchWithRetry(photo.urls.original);
  saveBlob(blob, photo.fileName);
}

/**
 * Gera um ZIP com as fotos originais (sem recompressão: JPEG já é comprimido).
 * Busca os arquivos em lotes paralelos e reporta progresso. Fotos que falharem
 * após as tentativas ficam de fora e são devolvidas em `failed`.
 *
 * onProgress({ phase: 'fetch' | 'zip', done, total, bytes, percent })
 */
export async function buildZip(list, { onProgress, signal } = {}) {
  // Carregado sob demanda: só quem baixa ZIP paga o custo da biblioteca
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set();
  const failed = [];
  let done = 0;
  let bytes = 0;
  let cursor = 0;

  const uniqueName = (name) => {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    let n = 2;
    while (usedNames.has(`${name.slice(0, dot)} (${n})${name.slice(dot)}`)) n++;
    const unique = `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
    usedNames.add(unique);
    return unique;
  };

  onProgress?.({ phase: 'fetch', done, total: list.length, bytes });

  const worker = async () => {
    while (cursor < list.length) {
      const photo = list[cursor++];
      try {
        const blob = await fetchWithRetry(photo.urls.original, signal);
        zip.file(uniqueName(photo.fileName), blob, { binary: true });
        bytes += blob.size;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        failed.push({ photo, error: error.message });
      }
      done++;
      onProgress?.({ phase: 'fetch', done, total: list.length, bytes });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker));

  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  if (failed.length === list.length) {
    throw new Error('Nenhuma fotografia pôde ser baixada. Verifique sua conexão e tente novamente.');
  }

  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'STORE', streamFiles: true },
    (meta) => onProgress?.({ phase: 'zip', done, total: list.length, bytes, percent: meta.percent }),
  );
  // Sem recompressão a montagem é rápida; o cancelamento é verificado ao final.
  if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError');
  return { blob, failed, count: list.length - failed.length };
}
