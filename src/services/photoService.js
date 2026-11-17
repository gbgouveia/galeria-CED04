import manifest from '../data/manifest.json';
import captions from '../data/captions.json';
import { asset, EVENT } from '../config.js';

/**
 * Todas as fotografias do manifesto, com URLs já resolvidas para o caminho publicado.
 * Legendas opcionais ficam em src/data/captions.json ({ "id-da-foto": "Legenda" }).
 */
export const photos = manifest.photos.map((photo, position) => ({
  ...photo,
  position,
  number: photo.fileName.match(/(\d+)(?=\.[a-z]+$)/i)?.[1] ?? String(photo.index),
  caption: captions[photo.id] ?? '',
  urls: {
    original: asset(photo.original),
    medium: asset(photo.medium),
    thumb: asset(photo.thumb),
  },
}));

export const photoById = new Map(photos.map((photo) => [photo.id, photo]));
export const categories = manifest.categories;
export const totalBytes = manifest.totalBytes;
export const featuredPhoto = photoById.get(EVENT.featuredId) ?? photos[0];

export function sumBytes(list) {
  return list.reduce((sum, photo) => sum + photo.sizeBytes, 0);
}

export function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return `${mb.toLocaleString('pt-BR', { maximumFractionDigits: mb < 10 ? 1 : 0 })} MB`;
  return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`;
}

export function plural(count, one, many) {
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? one : many}`;
}

/** Busca tolerante: ignora acentos, maiúsculas e aceita só o número ("24" encontra "0024"). */
export function matchesQuery(photo, query) {
  const normalize = (text) =>
    text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const q = normalize(query);
  if (!q) return true;
  if (/^\d+$/.test(q)) return Number(photo.number) === Number(q) || photo.number.includes(q);
  return normalize(`${photo.fileName} ${photo.caption} ${photo.category}`).includes(q);
}
