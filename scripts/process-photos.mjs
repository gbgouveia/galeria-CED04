#!/usr/bin/env node
/**
 * Processa as fotografias do evento e gera:
 *   public/photos/       cópia byte a byte dos arquivos originais (download)
 *   public/medium/       versão WebP de até 1600 px (visualizador + reconhecimento facial)
 *   public/thumbnails/   miniatura WebP de 640 px de largura (galeria)
 *   src/data/manifest.json  manifesto com nomes, dimensões, tamanhos, hashes e duplicatas
 *
 * Os arquivos da pasta de origem NUNCA são alterados, movidos ou excluídos.
 * O script é incremental: só reprocessa fotos novas ou alteradas (comparando o SHA-256).
 *
 * Uso:
 *   npm run photos                         (usa a pasta padrão abaixo)
 *   npm run photos -- "D:\caminho\da\pasta"
 *   PHOTOS_SOURCE="D:\caminho" npm run photos
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const DEFAULT_SOURCE =
  'D:\\Gabriel Gouveia Fotografias\\2026\\Exportadas\\conciencia Negra Ced04- Redes Sociais';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(process.argv[2] || process.env.PHOTOS_SOURCE || DEFAULT_SOURCE);
const OUT = {
  photos: path.join(ROOT, 'public', 'photos'),
  medium: path.join(ROOT, 'public', 'medium'),
  thumbs: path.join(ROOT, 'public', 'thumbnails'),
};
const MANIFEST = path.join(ROOT, 'src', 'data', 'manifest.json');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ROOT_CATEGORY = 'Geral';

const THUMB_WIDTH = 640;
const MEDIUM_MAX = 1600;

function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function walk(dir, rel = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const abs = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await walk(abs, relPath)));
    else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) files.push({ abs, rel: relPath });
    else console.warn(`  ! ignorado (não é imagem): ${relPath}`);
  }
  return files;
}

/** Hash perceptual simples (dHash 9x8) para apontar fotos quase idênticas. */
async function dHash(buffer) {
  const { data } = await sharp(buffer)
    .rotate()
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

function hamming(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (x) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

async function loadPreviousManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST, 'utf8'));
  } catch {
    return { photos: [] };
  }
}

async function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Pasta de origem não encontrada: ${SOURCE}`);
    process.exit(1);
  }
  console.log(`Origem: ${SOURCE}`);
  await Promise.all(Object.values(OUT).map((dir) => mkdir(dir, { recursive: true })));
  await mkdir(path.dirname(MANIFEST), { recursive: true });

  const previous = await loadPreviousManifest();
  const previousBySha = new Map(previous.photos.map((p) => [p.sha256, p]));

  const files = (await walk(SOURCE)).sort((a, b) =>
    a.rel.localeCompare(b.rel, 'pt-BR', { numeric: true }),
  );
  console.log(`${files.length} imagens encontradas.`);

  const photos = [];
  const usedIds = new Set();
  const bySha = new Map();
  const exactDuplicates = [];
  let processed = 0;
  let reused = 0;

  for (const [index, file] of files.entries()) {
    const buffer = await readFile(file.abs);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const fileName = path.basename(file.rel);
    const folder = path.dirname(file.rel);
    const category = folder === '.' ? ROOT_CATEGORY : folder.split('/')[0];

    let id = slugify(path.parse(fileName).name) || `foto-${index + 1}`;
    while (usedIds.has(id)) id += '-b';
    usedIds.add(id);

    if (bySha.has(sha256)) exactDuplicates.push([bySha.get(sha256), id]);
    else bySha.set(sha256, id);

    const ext = path.extname(fileName).toLowerCase().replace('.jpeg', '.jpg');
    const out = {
      original: path.join(OUT.photos, `${id}${ext}`),
      medium: path.join(OUT.medium, `${id}.webp`),
      thumb: path.join(OUT.thumbs, `${id}.webp`),
    };

    const cached = previousBySha.get(sha256);
    const outputsExist = [out.original, out.medium, out.thumb].every((p) => existsSync(p));
    let meta;
    if (cached && cached.id === id && outputsExist) {
      meta = cached;
      reused++;
    } else {
      const img = sharp(buffer, { failOn: 'none' });
      const info = await img.metadata();
      // Dimensões já considerando a orientação EXIF
      const rotated = (info.orientation ?? 1) >= 5;
      const width = rotated ? info.height : info.width;
      const height = rotated ? info.width : info.height;

      await copyFile(file.abs, out.original);
      await sharp(buffer)
        .rotate()
        .resize({ width: MEDIUM_MAX, height: MEDIUM_MAX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(out.medium);
      await sharp(buffer)
        .rotate()
        .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
        .webp({ quality: 72 })
        .toFile(out.thumb);
      const lqipBuf = await sharp(buffer).rotate().resize({ width: 16 }).webp({ quality: 40 }).toBuffer();
      const { dominant } = await sharp(buffer).rotate().stats();

      meta = {
        width,
        height,
        lqip: `data:image/webp;base64,${lqipBuf.toString('base64')}`,
        color: `rgb(${dominant.r}, ${dominant.g}, ${dominant.b})`,
        dhash: await dHash(buffer),
      };
      processed++;
    }

    const sizeBytes = (await stat(file.abs)).size;
    photos.push({
      id,
      index: index + 1,
      fileName,
      sourcePath: file.rel,
      category,
      width: meta.width,
      height: meta.height,
      sizeBytes,
      sha256,
      dhash: meta.dhash,
      color: meta.color,
      lqip: meta.lqip,
      original: `photos/${id}${ext}`,
      medium: `medium/${id}.webp`,
      thumb: `thumbnails/${id}.webp`,
    });
    if (process.stdout.isTTY) process.stdout.write(`\r  ${index + 1}/${files.length} ${fileName.padEnd(60)}`);
    else if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${files.length}`);
  }
  if (process.stdout.isTTY) process.stdout.write('\n');

  // Remove apenas arquivos GERADOS que não correspondem mais a nenhuma foto da origem.
  const keep = new Set(photos.flatMap((p) => [p.original, p.medium, p.thumb]));
  for (const [key, dir] of Object.entries(OUT)) {
    const sub = { photos: 'photos', medium: 'medium', thumbs: 'thumbnails' }[key];
    for (const name of await readdir(dir)) {
      if (!keep.has(`${sub}/${name}`)) {
        await rm(path.join(dir, name));
        console.log(`  - removido arquivo gerado obsoleto: ${sub}/${name}`);
      }
    }
  }

  // Quase duplicatas (mesma cena, enquadramento quase idêntico). Apenas informativo.
  const nearDuplicates = [];
  for (let i = 0; i < photos.length; i++) {
    for (let j = i + 1; j < photos.length; j++) {
      if (photos[i].sha256 === photos[j].sha256) continue;
      const distance = hamming(photos[i].dhash, photos[j].dhash);
      if (distance <= 3) nearDuplicates.push([photos[i].id, photos[j].id, distance]);
    }
  }

  const categories = [...new Set(photos.map((p) => p.category))];
  const totalBytes = photos.reduce((sum, p) => sum + p.sizeBytes, 0);
  const manifest = {
    generatedAt: new Date().toISOString(),
    count: photos.length,
    totalBytes,
    categories,
    duplicates: { exact: exactDuplicates, near: nearDuplicates },
    photos,
  };
  await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nResumo`);
  console.log(`  Fotos no manifesto: ${photos.length}`);
  console.log(`  Processadas agora:  ${processed} | reaproveitadas: ${reused}`);
  console.log(`  Tamanho original:   ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Categorias:         ${categories.join(', ')}`);
  console.log(`  Duplicatas exatas:  ${exactDuplicates.length}`);
  for (const [a, b] of exactDuplicates) console.log(`    = ${a}  ${b}`);
  console.log(`  Quase duplicatas:   ${nearDuplicates.length} (somente informativo, nada foi removido)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
