export const EVENT = {
  title: 'Dia da Consciência Negra',
  school: 'CED 04',
  subtitle: 'Uma celebração de identidade, cultura, história e resistência.',
  dateISO: '2026-11-05',
  dateLabel: '5 de novembro de 2026',
  photographer: 'Gabriel Gouveia Fotografias',
  /** Foto de destaque da página inicial (id do manifesto). Se não existir, usa a primeira. */
  featuredId: '05112026-conciencia-negra-ced04-0024',
  zipName: 'CED04-Consciencia-Negra',
};

/** Resolve um caminho de public/ respeitando o base do Vite (GitHub Pages). */
export function asset(path) {
  return `${import.meta.env.BASE_URL}${path}`;
}

/** URL absoluta de um arquivo de public/ (necessária dentro do Web Worker). */
export function absoluteAsset(path) {
  return new URL(asset(path), window.location.href).href;
}
