#!/usr/bin/env node
/**
 * Copia os modelos de reconhecimento facial do pacote @vladmandic/face-api para public/models,
 * para que sejam servidos pelo próprio site (sem CDN externa). Executado no postinstall.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FROM = path.join(ROOT, 'node_modules', '@vladmandic', 'face-api', 'model');
const TO = path.join(ROOT, 'public', 'models');
const MODELS = ['ssd_mobilenetv1_model', 'face_landmark_68_model', 'face_recognition_model'];

await mkdir(TO, { recursive: true });
for (const model of MODELS) {
  for (const suffix of ['.bin', '-weights_manifest.json']) {
    await copyFile(path.join(FROM, model + suffix), path.join(TO, model + suffix));
  }
}
console.log(`Modelos faciais copiados para ${path.relative(ROOT, TO)}`);
