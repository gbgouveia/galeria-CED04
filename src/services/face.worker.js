import { describeFaces, describeUrl, loadModels } from './faceEngine.js';

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    let result;
    if (type === 'init') result = { backend: await loadModels(data.modelUrl) };
    else if (type === 'describePixels') result = { faces: await describeFaces(data.pixels, data.options) };
    else if (type === 'describeUrl') result = { faces: await describeUrl(data.url, data.options) };
    else throw new Error(`Mensagem desconhecida: ${type}`);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message ?? String(error) });
  }
};
