/**
 * Índice facial TEMPORÁRIO guardado no IndexedDB do próprio visitante.
 * Guarda apenas descritores numéricos dos rostos das fotos do evento (nunca a selfie),
 * para não reprocessar tudo a cada visita. Expira em 7 dias e pode ser apagado pelo visitante.
 * Nada disso é publicado no site nem enviado a servidores.
 */
const DB_NAME = 'ced04-indice-facial';
const STORE = 'fotos';
const VERSION = 1;
export const INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Mude quando trocar modelo/parâmetros para invalidar índices antigos. */
const ENGINE_VERSION = 'ssd-0.5-1280-v1';

let dbPromise = null;

function openDb() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponível'));
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const result = fn(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Lê o índice válido (mesmo arquivo, mesma versão do motor, dentro do prazo). */
export async function loadIndex(photos) {
  try {
    const db = await openDb();
    const entries = await tx(db, 'readonly', (store) => store.getAll());
    const valid = new Map();
    const now = Date.now();
    const sha = new Map(photos.map((p) => [p.id, p.sha256]));
    for (const entry of entries ?? []) {
      if (entry.engine === ENGINE_VERSION && sha.get(entry.id) === entry.sha && now - entry.at < INDEX_TTL_MS) {
        valid.set(entry.id, entry.faces);
      }
    }
    return valid;
  } catch {
    return new Map();
  }
}

export async function saveEntry(photo, faces) {
  try {
    const db = await openDb();
    await tx(db, 'readwrite', (store) =>
      store.put({ id: photo.id, sha: photo.sha256, engine: ENGINE_VERSION, at: Date.now(), faces }),
    );
  } catch {
    // Sem IndexedDB o índice fica só na memória desta sessão
  }
}

export async function clearIndex() {
  try {
    const db = await openDb();
    await tx(db, 'readwrite', (store) => store.clear());
  } catch {
    // nada a apagar
  }
}
