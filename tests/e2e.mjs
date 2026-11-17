/**
 * Teste ponta a ponta no navegador real (Chromium via Playwright).
 *
 * Uso:
 *   npm run build && npm run preview         (em outro terminal)
 *   SELFIE="caminho/selfie.jpg" EXPECT="0044,0045" node tests/e2e.mjs [url]
 *
 * Cobre: carregamento de todas as imagens, navegação, curtidas, download individual,
 * ZIP de selecionadas, ZIP completo, reconhecimento facial e layout no celular.
 */
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const URL_BASE = process.argv[2] || 'http://localhost:4173/galeria-CED04/';
const manifest = JSON.parse(await readFile(new URL('../src/data/manifest.json', import.meta.url), 'utf8'));
const SHOTS = process.env.SHOTS || '.';
const results = [];
let failures = 0;

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push(`✔ ${name} (${((Date.now() - started) / 1000).toFixed(1)}s)${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures++;
    results.push(`✘ ${name}: ${error.message.split('\n')[0]}`);
  }
  console.log(results.at(-1));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function zipEntries(download) {
  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  const files = Object.values(zip.files).filter((f) => !f.dir);
  const sizes = await Promise.all(files.map(async (f) => (await f.async('uint8array')).length));
  return files.map((f, i) => ({ name: f.name, size: sizes[i] }));
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });

// ---------------- Computador ----------------
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await desktop.newPage();
const consoleErrors = [];
page.on('console', (msg) => msg.type() === 'error' && consoleErrors.push(msg.text()));
page.on('pageerror', (err) => consoleErrors.push(err.message));

await step('Página inicial carrega com título, subtítulo e contagem', async () => {
  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  const h1 = await page.locator('h1').innerText();
  assert(/consci[eê]ncia/i.test(h1), `h1 inesperado: ${h1}`);
  const facts = await page.locator('.hero__facts').innerText();
  assert(facts.includes(String(manifest.count)), 'contagem total ausente');
  await page.locator('.hero__media img').evaluate((img) => img.decode());
  await page.screenshot({ path: `${SHOTS}/desktop-hero.png` });
  return `h1="${h1.replace(/\n/g, ' ')}"`;
});

await step('Todos os arquivos publicados respondem (originais, médias, miniaturas, modelos)', async () => {
  const urls = manifest.photos.flatMap((p) => [p.original, p.medium, p.thumb]);
  urls.push(
    'models/ssd_mobilenetv1_model-weights_manifest.json',
    'models/face_landmark_68_model-weights_manifest.json',
    'models/face_recognition_model-weights_manifest.json',
  );
  const bad = [];
  for (let i = 0; i < urls.length; i += 20) {
    const batch = urls.slice(i, i + 20);
    const statuses = await Promise.all(batch.map((u) => page.request.head(URL_BASE + u).then((r) => r.status())));
    statuses.forEach((s, j) => s !== 200 && bad.push(`${batch[j]}=${s}`));
  }
  assert(!bad.length, `falharam: ${bad.slice(0, 5).join(', ')}`);
  return `${urls.length} URLs com HTTP 200`;
});

await step('Galeria renderiza e carrega TODAS as miniaturas (rolagem progressiva)', async () => {
  await page.locator('#galeria').scrollIntoViewIfNeeded();
  for (let i = 0; i < 60; i++) {
    const count = await page.locator('.masonry .card').count();
    if (count >= manifest.count) break;
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(250);
  }
  const cards = await page.locator('.masonry .card').count();
  assert(cards === manifest.count, `${cards} cartões, esperado ${manifest.count}`);
  // força carregar as lazy e verifica decodificação
  const broken = await page.$$eval('.masonry img', async (imgs) => {
    await Promise.all(imgs.map((img) => { img.loading = 'eager'; return img.decode().catch(() => null); }));
    return imgs.filter((img) => !img.naturalWidth).map((img) => img.src);
  });
  assert(!broken.length, `${broken.length} miniaturas quebradas`);
  await page.locator('#galeria').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/desktop-gallery.png` });
  return `${cards} fotos visíveis, 0 quebradas`;
});

await step('Busca por número do arquivo', async () => {
  const target = manifest.photos[5];
  const number = target.fileName.match(/(\d+)\.\w+$/)[1];
  await page.fill('.search input', String(Number(number)));
  await page.waitForTimeout(300);
  const count = await page.locator('.masonry .card').count();
  assert(count >= 1, 'nenhum resultado');
  const label = await page.locator('.masonry .card .card__number').first().innerText();
  assert(label === number, `primeiro resultado ${label}, esperado ${number}`);
  await page.fill('.search input', 'arquivo-que-nao-existe');
  await page.waitForTimeout(300);
  assert(await page.locator('.empty').isVisible(), 'estado vazio não exibido');
  await page.fill('.search input', '');
  return `"${Number(number)}" encontrou ${count}`;
});

await step('Curtir, persistir após recarregar, filtro Curtidas e descurtir', async () => {
  const first = page.locator('.masonry .card').first();
  await first.hover();
  await first.locator('.chip-btn').first().click();
  assert((await first.locator('.chip-btn').first().getAttribute('aria-pressed')) === 'true', 'não marcou');
  await page.reload({ waitUntil: 'networkidle' });
  const again = page.locator('.masonry .card').first();
  assert((await again.locator('.chip-btn').first().getAttribute('aria-pressed')) === 'true', 'não persistiu');
  const stored = await page.evaluate(() => localStorage.getItem('ced04:curtidas:v1'));
  await page.getByRole('button', { name: /Curtidas/ }).click();
  const liked = await page.locator('.masonry .card').count();
  assert(liked === 1, `filtro mostrou ${liked}`);
  await again.hover();
  await again.locator('.chip-btn').first().click(); // descurtir
  await page.waitForTimeout(200);
  assert(await page.locator('.empty').isVisible(), 'após descurtir deveria ficar vazio');
  await page.getByRole('button', { name: /Todas/ }).first().click();
  return `localStorage=${stored}`;
});

await step('Visualizador: abrir, próxima/anterior (setas e teclado), zoom e fechar', async () => {
  await page.locator('.masonry .card__open').first().click();
  const title = page.locator('#viewer-title');
  await title.waitFor();
  const t1 = await title.innerText();
  await page.getByRole('button', { name: 'Próxima foto' }).click();
  const t2 = await title.innerText();
  assert(t1 !== t2, 'seta não navegou');
  await page.keyboard.press('ArrowRight');
  const t3 = await title.innerText();
  assert(t3 !== t2, 'teclado não navegou');
  await page.keyboard.press('ArrowLeft');
  assert((await title.innerText()) === t2, 'voltar não funcionou');
  await page.getByRole('button', { name: 'Aumentar zoom' }).click();
  await page.waitForTimeout(400);
  const transform = await page.locator('.viewer__img').evaluate((img) => img.style.transform);
  assert(/scale\(1\.5\)/.test(transform), `zoom não aplicado: ${transform}`);
  const src = await page.locator('.viewer__img').getAttribute('src');
  assert(src.includes('/photos/'), 'com zoom deveria carregar o original');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/desktop-viewer.png` });
  return `${t1} → ${t2} → ${t3}`;
});

await step('Download individual em resolução original com nome original', async () => {
  const name = (await page.locator('.viewer__file').innerText()).trim();
  const photo = manifest.photos.find((p) => p.fileName === name);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.getByRole('button', { name: 'Baixar original' }).click(),
  ]);
  const size = (await readFile(await download.path())).length;
  assert(download.suggestedFilename() === photo.fileName, `nome ${download.suggestedFilename()}`);
  assert(size === photo.sizeBytes, `tamanho ${size} ≠ ${photo.sizeBytes}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert(!(await page.locator('dialog.modal--viewer[open]').count()), 'Esc não fechou o visualizador');
  return `${photo.fileName} (${size} bytes, idêntico ao original)`;
});

await step('Seleção múltipla + ZIP das selecionadas', async () => {
  await page.getByRole('button', { name: 'Selecionar', exact: true }).click();
  const cards = page.locator('.masonry .card__open');
  for (const i of [0, 2, 4]) await cards.nth(i).click();
  const count = await page.locator('.selection-bar__count strong').innerText();
  assert(/^3 /.test(count), `barra mostra "${count}"`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.getByRole('button', { name: 'Baixar ZIP' }).click(),
  ]);
  const entries = await zipEntries(download);
  const expected = [0, 2, 4].map((i) => manifest.photos[i]);
  assert(entries.length === 3, `${entries.length} arquivos no ZIP`);
  for (const p of expected) {
    const e = entries.find((x) => x.name === p.fileName);
    assert(e && e.size === p.sizeBytes, `faltou/diferente: ${p.fileName}`);
  }
  await page.locator('dialog[open]').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Limpar seleção' }).click();
  return `${download.suggestedFilename()} com 3 originais íntegros`;
});

await step('BAIXAR TODAS AS FOTOGRAFIAS gera ZIP completo com progresso', async () => {
  await page.locator('.download-all').click();
  await page.locator('.progress').first().waitFor({ timeout: 10000 });
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 })]);
  const status = await page.locator('.part__status').innerText();
  const entries = await zipEntries(download);
  assert(entries.length === manifest.count, `${entries.length} de ${manifest.count} no ZIP`);
  const mismatched = manifest.photos.filter((p) => entries.find((e) => e.name === p.fileName)?.size !== p.sizeBytes);
  assert(!mismatched.length, `${mismatched.length} arquivos divergentes`);
  await page.locator('dialog[open]').getByRole('button', { name: 'Fechar', exact: true }).click();
  return `${download.suggestedFilename()}: ${entries.length} originais, status "${status.trim()}"`;
});

if (process.env.SELFIE) {
  await step('Reconhecimento facial: consentimento, selfie, indexação local e resultados', async () => {
    const external = [];
    page.on('request', (req) => {
      const u = req.url();
      if (!u.startsWith(new URL(URL_BASE).origin) && !/^(blob|data):/.test(u)) external.push(u);
    });
    await page.getByRole('button', { name: 'Encontrar minhas fotos' }).first().click();
    const go = page.getByRole('button', { name: 'Continuar' });
    assert(await go.isDisabled(), 'Continuar deveria exigir consentimento');
    await page.locator('.consent input').check();
    await go.click();
    await page.locator('.face__pick input[type=file]:not([capture])').setInputFiles(process.env.SELFIE);
    await page.locator('.face__ref img').waitFor({ timeout: 180000 });
    const started = Date.now();
    await page.locator('.indexing').waitFor({ state: 'detached', timeout: 900000 });
    const indexSeconds = (Date.now() - started) / 1000;
    const found = await page.locator('.result .small').allInnerTexts();
    const numbers = found.map((t) => t.match(/Foto (\d+)/)[1]);
    const expect = (process.env.EXPECT || '').split(',').filter(Boolean);
    const missing = expect.filter((n) => !numbers.includes(n));
    await page.screenshot({ path: `${SHOTS}/desktop-face.png` });
    assert(numbers.length > 0, 'nenhum resultado');
    assert(!missing.length, `não encontrou ${missing.join(', ')} (achou ${numbers.join(', ')})`);
    assert(!external.length, `requisições externas: ${external.join(', ')}`);

    // Segunda busca usa o índice salvo (IndexedDB) e deve ser quase instantânea
    await page.getByRole('button', { name: 'Outra selfie' }).click();
    await page.locator('.face__pick input[type=file]:not([capture])').setInputFiles(process.env.SELFIE);
    const t2 = Date.now();
    await page.locator('.face__ref img').waitFor({ timeout: 60000 });
    await page.locator('.indexing').waitFor({ state: 'detached', timeout: 60000 });
    const cachedSeconds = (Date.now() - t2) / 1000;

    // Limiar mais rigoroso reduz ou mantém resultados
    await page.locator('#threshold').fill('0.38');
    const strict = await page.locator('.result').count();
    assert(strict <= numbers.length, 'limiar rigoroso aumentou resultados');

    // ZIP somente dos resultados
    await page.locator('#threshold').fill('0.5');
    const [zip] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.getByRole('button', { name: 'Baixar resultados (ZIP)' }).click(),
    ]);
    const entries = await zipEntries(zip);
    assert(entries.length === numbers.length, `ZIP com ${entries.length}, resultados ${numbers.length}`);
    await page.locator('dialog[open] .panel').getByRole('button', { name: 'Fechar', exact: true }).click();

    // Apagar dados
    await page.getByRole('button', { name: 'Apagar selfie e dados' }).click();
    await page.getByRole('button', { name: 'Continuar' }).waitFor();
    const stored = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('ced04-indice-facial');
          req.onsuccess = () => {
            const tx = req.result.transaction('fotos', 'readonly').objectStore('fotos').count();
            tx.onsuccess = () => resolve(tx.result);
          };
        }),
    );
    assert(stored === 0, `IndexedDB ainda tem ${stored} registros`);
    await page.keyboard.press('Escape');
    return `achou [${numbers.join(', ')}]; 1ª indexação ${indexSeconds.toFixed(0)}s, 2ª busca ${cachedSeconds.toFixed(1)}s; rigoroso=${strict}; ZIP ok; dados apagados; 0 requisições externas`;
  });
}

await step('Sem erros no console', async () => {
  const relevant = consoleErrors.filter((e) => !/favicon/i.test(e));
  assert(!relevant.length, relevant.slice(0, 3).join(' | '));
});

// ---------------- Celular ----------------
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
const phone = await mobile.newPage();

await step('Celular (390px): sem rolagem horizontal, alvos de toque ≥ 40px', async () => {
  await phone.goto(URL_BASE, { waitUntil: 'networkidle' });
  await phone.locator('.hero__media img').evaluate((img) => img.decode());
  await phone.screenshot({ path: `${SHOTS}/mobile-hero.png` });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflow <= 0, `rolagem horizontal de ${overflow}px`);
  const small = await phone.$$eval('button, a, input, select', (els) =>
    els
      .filter((el) => el.offsetParent && !el.closest('dialog') && !el.classList.contains('link-btn') && !el.classList.contains('skip-link'))
      .map((el) => ({ el: el.className || el.tagName, ...el.getBoundingClientRect().toJSON() }))
      .filter((r) => r.width < 40 || r.height < 40)
      .map((r) => `${r.el} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  assert(!small.length, `alvos pequenos: ${[...new Set(small)].slice(0, 5).join('; ')}`);
  await phone.locator('#galeria').scrollIntoViewIfNeeded();
  await phone.waitForTimeout(800);
  await phone.screenshot({ path: `${SHOTS}/mobile-gallery.png` });
});

await step('Celular: abrir foto, deslizar para a próxima e voltar com o botão do sistema', async () => {
  await phone.locator('.masonry .card__open').first().tap();
  const title = phone.locator('#viewer-title');
  await title.waitFor();
  const t1 = await title.innerText();
  const box = await phone.locator('.viewer__stage').boundingBox();
  const y = box.y + box.height / 2;
  const cdp = await mobile.newCDPSession(phone);
  const touch = (type, x) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', box.x + box.width * 0.8);
  for (let i = 1; i <= 8; i++) await touch('touchMove', box.x + box.width * (0.8 - i * 0.07));
  await touch('touchEnd');
  // Fecha o ciclo de toque do CDP; sem isso o próximo tap() do Playwright é ignorado
  await touch('touchStart', 2);
  await touch('touchEnd');
  await phone.waitForTimeout(400);
  const t2 = await title.innerText();
  assert(t1 !== t2, `deslizar não trocou a foto (${t1})`);
  await phone.waitForTimeout(400);
  await phone.screenshot({ path: `${SHOTS}/mobile-viewer.png` });
  await phone.goBack();
  await phone.waitForTimeout(400);
  assert(!(await phone.locator('dialog.modal--viewer[open]').count()), 'voltar não fechou o visualizador');
  assert(phone.url().startsWith(URL_BASE), 'voltar saiu da página');
  return `${t1} → ${t2}`;
});

await step('Celular: tela de reconhecimento facial', async () => {
  await phone.getByRole('button', { name: 'Encontrar minhas fotos' }).first().tap();
  await phone.locator('.consent').waitFor();
  await phone.screenshot({ path: `${SHOTS}/mobile-face.png` });
  await phone.goBack();
});

await browser.close();
console.log(`\n${results.length - failures}/${results.length} verificações passaram.`);
process.exit(failures ? 1 : 0);
