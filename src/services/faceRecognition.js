/**
 * API de reconhecimento facial usada pela interface.
 *
 * Privacidade:
 * - A selfie é lida localmente, vira um descritor numérico em memória e nunca é enviada nem salva.
 * - Os descritores das fotos do evento são calculados no aparelho do visitante e guardados
 *   temporariamente no IndexedDB (faceIndexStore.js) para não reprocessar a cada visita.
 * - Não há nomes, cadastro ou identificação civil: só comparação de similaridade.
 */
import { absoluteAsset } from '../config.js';
import { clearIndex, loadIndex, saveEntry } from './faceIndexStore.js';

/** Distância euclidiana máxima padrão (face-api recomenda 0,6; usamos algo mais rigoroso). */
export const DEFAULT_THRESHOLD = 0.5;
export const THRESHOLD_RANGE = { min: 0.38, max: 0.62, step: 0.01 };

let client = null;
let readyPromise = null;
/** Índice da sessão atual em memória: id da foto -> rostos detectados. */
const sessionIndex = new Map();

function createWorkerClient() {
  const worker = new Worker(new URL('./face.worker.js', import.meta.url), { type: 'module' });
  let seq = 0;
  const pending = new Map();
  worker.onmessage = ({ data }) => {
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.ok) request.resolve(data.result);
    else request.reject(new Error(data.error));
  };
  worker.onerror = (event) => {
    event.preventDefault?.();
    for (const request of pending.values()) request.reject(new Error(event.message || 'Falha no Web Worker'));
    pending.clear();
  };
  const call = (message, transfer = []) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id }, transfer);
    });
  return {
    mode: 'worker',
    init: (modelUrl) => call({ type: 'init', modelUrl }),
    // ImageData (buffer transferido) em vez de ImageBitmap: bitmaps vindos de <canvas> podem
    // travar ao serem transferidos para o Worker em alguns navegadores/GPUs.
    describePixels: (pixels, options) => call({ type: 'describePixels', pixels, options }, [pixels.data.buffer]),
    describeUrl: (url, options) => call({ type: 'describeUrl', url, options }),
    terminate: () => worker.terminate(),
  };
}

async function createMainThreadClient() {
  const engine = await import('./faceEngine.js');
  const breathe = () => new Promise((resolve) => setTimeout(resolve, 16));
  return {
    mode: 'main',
    init: async (modelUrl) => ({ backend: await engine.loadModels(modelUrl) }),
    describePixels: async (pixels, options) => ({ faces: await engine.describeFaces(pixels, options) }),
    describeUrl: async (url, options) => {
      await breathe(); // devolve o controle à interface entre uma foto e outra
      return { faces: await engine.describeUrl(url, options) };
    },
    terminate() {},
  };
}

export function isFaceSearchSupported() {
  return typeof window !== 'undefined' && 'createImageBitmap' in window && 'WebGLRenderingContext' in window;
}

/** Carrega os modelos (uma vez por sessão). Tenta Web Worker e, se falhar, a thread principal. */
export function initFaceEngine() {
  readyPromise ??= (async () => {
    const modelUrl = absoluteAsset('models');
    const canUseWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
    if (canUseWorker) {
      try {
        client = createWorkerClient();
        const { backend } = await client.init(modelUrl);
        return { mode: 'worker', backend };
      } catch (error) {
        console.warn('Reconhecimento facial no Worker indisponível, usando a thread principal.', error);
        client?.terminate();
      }
    }
    client = await createMainThreadClient();
    const { backend } = await client.init(modelUrl);
    return { mode: 'main', backend };
  })();
  readyPromise.catch(() => {
    readyPromise = null;
    client = null;
  });
  return readyPromise;
}

function loadSelfieBitmap(file) {
  return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
}

/**
 * Lê a selfie, encontra o maior rosto e devolve seu descritor e um recorte para pré-visualização.
 * O recorte é um object URL em memória; chame URL.revokeObjectURL ao descartar.
 */
export async function analyzeSelfie(file) {
  if (!file.type.startsWith('image/')) throw new SelfieError('not-image');
  await initFaceEngine();
  const source = await loadSelfieBitmap(file).catch(() => {
    throw new SelfieError('unreadable');
  });

  const scale = Math.min(1, 1280 / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close();

  const pixels = () => canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  let faces = (await client.describePixels(pixels(), { minConfidence: 0.5 })).faces;
  if (!faces.length) faces = (await client.describePixels(pixels(), { minConfidence: 0.3 })).faces;
  if (!faces.length) throw new SelfieError('no-face');

  const area = (face) => face.box[2] * face.box[3];
  const main = faces.reduce((best, face) => (area(face) > area(best) ? face : best));

  const [x, y, w, h] = main.box;
  const pad = 0.35;
  const sx = Math.max(0, (x - w * pad) * canvas.width);
  const sy = Math.max(0, (y - h * pad) * canvas.height);
  const sw = Math.min(canvas.width - sx, w * (1 + pad * 2) * canvas.width);
  const sh = Math.min(canvas.height - sy, h * (1 + pad * 2) * canvas.height);
  const crop = document.createElement('canvas');
  crop.width = 240;
  crop.height = Math.round((240 * sh) / sw);
  crop.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
  const previewBlob = await new Promise((resolve) => crop.toBlob(resolve, 'image/jpeg', 0.85));
  canvas.width = canvas.height = 0; // libera a memória da imagem

  return {
    descriptor: main.descriptor,
    facesFound: faces.length,
    previewUrl: previewBlob ? URL.createObjectURL(previewBlob) : '',
  };
}

export class SelfieError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function distance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Menor distância entre o rosto de referência e os rostos de uma foto. */
export function bestDistance(faces, reference) {
  let best = Infinity;
  for (const face of faces) best = Math.min(best, distance(face.descriptor, reference));
  return best;
}

/**
 * Garante que todas as fotos estejam indexadas, reaproveitando a sessão e o IndexedDB.
 * Chama onEntry(photo, faces) para cada foto (inclusive as já indexadas) e onProgress(done, total).
 * Processa uma foto por vez para não sobrecarregar celulares.
 */
export async function indexPhotos(photos, { onEntry, onProgress, signal }) {
  await initFaceEngine();
  if (sessionIndex.size < photos.length) {
    const stored = await loadIndex(photos);
    for (const [id, faces] of stored) if (!sessionIndex.has(id)) sessionIndex.set(id, faces);
  }

  let done = 0;
  const failed = [];
  const pendingPhotos = [];
  for (const photo of photos) {
    const faces = sessionIndex.get(photo.id);
    if (faces) {
      done++;
      onEntry(photo, faces);
    } else pendingPhotos.push(photo);
  }
  onProgress(done, photos.length, pendingPhotos.length === 0);

  for (const photo of pendingPhotos) {
    if (signal?.aborted) return { failed, aborted: true };
    try {
      const { faces } = await client.describeUrl(photo.urls.medium, { minConfidence: 0.4 });
      sessionIndex.set(photo.id, faces);
      saveEntry(photo, faces);
      if (!signal?.aborted) onEntry(photo, faces);
    } catch (error) {
      failed.push({ photo, error: error.message });
    }
    done++;
    if (!signal?.aborted) onProgress(done, photos.length, false);
  }
  return { failed, aborted: Boolean(signal?.aborted) };
}

/** Apaga o índice facial da memória e do IndexedDB e encerra o Worker. */
export async function clearFaceData() {
  sessionIndex.clear();
  await clearIndex();
  client?.terminate();
  client = null;
  readyPromise = null;
}
