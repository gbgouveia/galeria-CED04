/**
 * Núcleo do reconhecimento facial (face-api.js, versão mantida @vladmandic/face-api).
 * Roda dentro de um Web Worker; se o navegador não suportar, roda na thread principal.
 * Tudo acontece no aparelho do visitante: nenhuma imagem ou descritor sai do navegador.
 */
import * as faceapi from '@vladmandic/face-api';

const IN_WORKER = typeof document === 'undefined';

if (IN_WORKER) {
  // A face-api espera um ambiente com DOM; no Worker usamos OffscreenCanvas.
  class Unsupported {}
  faceapi.env.setEnv({
    Canvas: OffscreenCanvas,
    CanvasRenderingContext2D: OffscreenCanvasRenderingContext2D,
    Image: Unsupported,
    ImageData,
    Video: Unsupported,
    createCanvasElement: () => new OffscreenCanvas(1, 1),
    createImageElement: () => {
      throw new Error('Elemento <img> indisponível no Worker');
    },
    fetch: (...args) => fetch(...args),
    readFile: () => {
      throw new Error('readFile indisponível no navegador');
    },
  });
}

const MAX_SIDE = 1280;
let loading = null;

export function loadModels(modelUrl) {
  loading ??= (async () => {
    let backend = 'webgl';
    try {
      if (!(await faceapi.tf.setBackend('webgl'))) throw new Error('WebGL indisponível');
    } catch {
      backend = 'cpu';
      await faceapi.tf.setBackend('cpu');
    }
    await faceapi.tf.ready();
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(modelUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl),
    ]);
    return backend;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

function toImageData(bitmap) {
  if (bitmap instanceof ImageData) return { data: bitmap, scale: 1 };
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = IN_WORKER ? new OffscreenCanvas(width, height) : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { data: ctx.getImageData(0, 0, width, height), scale };
}

/**
 * Detecta rostos (em ImageBitmap ou ImageData) e devolve caixas (em coordenadas relativas 0..1) e descritores de 128 posições.
 * `minConfidence` mais baixo para fotos do evento (rostos menores em fotos de grupo).
 */
export async function describeFaces(source, { minConfidence = 0.5 } = {}) {
  const { data } = toImageData(source);
  const tensor = faceapi.tf.browser.fromPixels(data);
  try {
    const results = await faceapi
      .detectAllFaces(tensor, new faceapi.SsdMobilenetv1Options({ minConfidence, maxResults: 40 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    return results.map(({ detection, descriptor }) => {
      const { x, y, width, height } = detection.box;
      return {
        box: [x / data.width, y / data.height, width / data.width, height / data.height],
        score: detection.score,
        descriptor,
      };
    });
  } finally {
    tensor.dispose();
  }
}

export async function describeUrl(url, options) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  try {
    return await describeFaces(bitmap, options);
  } finally {
    bitmap.close();
  }
}
