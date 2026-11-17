# Galeria — Dia da Consciência Negra · CED 04

Galeria fotográfica online do evento **Dia da Consciência Negra do CED 04** (5 de novembro de 2026).
Fotografias: **Gabriel Gouveia Fotografias**.

Endereço publicado: **https://gbgouveia.github.io/galeria-CED04/**

O visitante pode ver todas as fotografias, curtir, baixar uma a uma, baixar várias ou todas em ZIP
e encontrar as fotos em que provavelmente aparece usando uma selfie (reconhecimento facial feito no
próprio aparelho).

## Funcionalidades

| Recurso | Como funciona |
| --- | --- |
| Galeria masonry | Miniaturas WebP de 640 px, carregamento progressivo (blocos de 24 conforme a rolagem), placeholder borrado enquanto carrega |
| Visualizador | Tela cheia, setas, teclado (← → + − Esc), deslizar no celular, arrastar para baixo fecha, botão “voltar” do celular fecha, zoom por botões, duplo toque, pinça e roda do mouse (com zoom carrega o original) |
| Busca | Por número (“24” encontra 0024) ou nome do arquivo, sem diferenciar acentos/maiúsculas |
| Categorias | Geradas a partir das subpastas da origem. Hoje todas as fotos estão numa pasta só, então o filtro fica oculto |
| Curtidas | Coração em cada foto, filtro “Curtidas”, salvas no `localStorage` |
| Download individual | Arquivo original, byte a byte, com o nome original |
| Seleção múltipla | Botão “Selecionar” ou o ✓ de cada foto; barra inferior com quantidade, tamanho e “Baixar ZIP” |
| Baixar todas | ZIP com todos os originais, barra de progresso, contagem de arquivos, 4 downloads paralelos com novas tentativas, cancelamento e aviso de falhas |
| Encontre suas fotos | Consentimento, selfie (câmera ou galeria), indexação local com progresso, resultados aparecendo durante a análise, ajuste de sensibilidade, download individual ou em ZIP dos resultados, botão “Apagar selfie e dados” |
| Privacidade | Modal com as regras de uso, reconhecimento facial e curtidas (LGPD) |

### Limitações conhecidas

- **Curtidas não são globais.** O GitHub Pages não tem servidor, então cada navegador guarda só as
  próprias curtidas (0 ou 1 por foto). Para uma contagem entre visitantes seria preciso um serviço
  externo, por exemplo Supabase ou Firebase.
- **ZIP em celulares.** O ZIP é montado na memória do navegador. Para não travar, coleções acima de
  150 MB no celular (600 MB no computador) são divididas em partes, e cada parte é baixada com um
  toque. No iPhone, o ZIP vai para o app Arquivos.
- **Reconhecimento facial é aproximado.** Pode trazer pessoas parecidas e deixar fotos de fora,
  principalmente rostos pequenos, de perfil ou cobertos. A interface avisa isso.
- **Primeira busca facial é demorada.** O navegador precisa analisar todas as fotos uma vez: cerca de
  1 a 3 s por foto, dependendo do aparelho. O índice fica salvo por 7 dias e as buscas seguintes
  levam segundos.

## Reconhecimento facial e privacidade

- Biblioteca: [`@vladmandic/face-api`](https://github.com/vladmandic/face-api) (versão mantida do
  face-api.js, TensorFlow.js + WebGL). Modelos usados: SSD MobileNet v1, 68 landmarks e reconhecimento
  facial (descritor de 128 posições). São cerca de 12 MB, servidos pelo próprio site (`public/models`).
- O processamento roda em um **Web Worker** para não travar a interface. Se o navegador não suportar,
  roda na thread principal, dando uma pausa entre as fotos.
- **A selfie nunca sai do aparelho**: é lida localmente, vira um descritor numérico em memória e é
  descartada ao fechar a busca ou ao tocar em “Apagar selfie e dados”. Não é salva em lugar nenhum.
- **Nenhum descritor biométrico é publicado.** O site publica só as imagens. Os descritores dos rostos
  das fotos do evento são calculados no navegador do visitante e guardados temporariamente no
  IndexedDB dele (`ced04-indice-facial`), com validade de 7 dias. O visitante pode apagá-los.
- Não há nomes, cadastro, banco de identidades nem envio de dados. A comparação usa distância
  euclidiana entre descritores; o limiar padrão é 0,50, ajustável de 0,38 (rigoroso) a 0,62 (flexível).
- O site não usa analytics, cookies de rastreamento nem CDN externa. As fontes também são locais.
- `index.html` tem `noindex, noimageindex` para a galeria (com fotos de estudantes) não aparecer em
  buscadores. Remova a tag se quiser que ela seja indexada.

## Estrutura

```
scripts/
  process-photos.mjs   gera originais, médias, miniaturas e o manifesto a partir da pasta de origem
  copy-models.mjs      copia os modelos faciais para public/models (roda no postinstall)
src/
  config.js            textos do evento, foto de destaque e nome dos ZIPs
  data/manifest.json   manifesto gerado (nomes, dimensões, tamanhos, SHA-256, duplicatas)
  data/captions.json   legendas opcionais: { "id-da-foto": "Legenda" }
  components/          Header, Hero, FindMeSection, Gallery, PhotoCard, PhotoViewer,
                       FaceSearch, DownloadManager, SelectionBar, PrivacyModal, Footer, Modal, Toasts
  services/            photoService, downloadService, faceRecognition, faceEngine,
                       face.worker, faceIndexStore (IndexedDB), storage
  hooks/               useFavorites, useSelection, useGallery, useHistoryModal
  styles/              global.css, gallery.css, components.css, responsive.css
public/
  photos/              originais (cópia exata, usados nos downloads)
  medium/              WebP de até 1600 px (visualizador e reconhecimento facial)
  thumbnails/          WebP de 640 px (galeria)
  models/              modelos faciais (gerados no npm install, fora do git)
tests/
  unit/                testes de unidade (divisão do ZIP em partes)
  e2e.mjs              teste ponta a ponta no Chromium (Playwright)
  serve-dist.mjs       servidor estático que imita o GitHub Pages
.github/workflows/deploy.yml   build, testes e publicação automática
```

Tecnologias: React 18, Vite 6, JavaScript, CSS puro, Lucide, JSZip, @vladmandic/face-api, IndexedDB e
sharp (somente no processamento das fotos).

## Como usar

Requisitos: Node 20 ou superior.

```bash
npm install        # instala dependências e copia os modelos faciais
npm run dev        # servidor de desenvolvimento
npm run build      # gera dist/ para produção
npm test           # testes de unidade
```

### Atualizar as fotografias

A pasta de origem padrão está em `scripts/process-photos.mjs`:
`D:\Gabriel Gouveia Fotografias\2026\Exportadas\conciencia Negra Ced04- Redes Sociais`.

```bash
npm run photos                              # usa a pasta padrão
npm run photos -- "D:\outra\pasta"          # ou informe outra pasta
```

O script:

- **nunca altera, move ou apaga os arquivos da origem**;
- é incremental: só processa fotos novas ou alteradas (compara o SHA-256);
- usa subpastas como categorias;
- aponta duplicatas exatas (mesmo SHA-256) e quase duplicatas (hash perceptual) no terminal e no
  manifesto, sem excluir nada;
- remove de `public/` apenas os arquivos gerados de fotos que saíram da origem.

Depois, faça commit e push: o GitHub Actions publica sozinho.

Para trocar a foto de destaque ou os textos, edite `src/config.js` (`featuredId` é o `id` da foto no
manifesto, por exemplo `05112026-conciencia-negra-ced04-0024`).

### Teste ponta a ponta

```bash
npm run build
node tests/serve-dist.mjs                   # em outro terminal
SELFIE="caminho/selfie.jpg" EXPECT="0044,0045" npm run test:e2e
```

O teste verifica: todas as URLs publicadas (HTTP 200), carregamento de todas as miniaturas, busca,
curtidas (inclusive após recarregar), visualizador (setas, teclado, zoom, Esc), download individual
(nome e tamanho iguais ao original), ZIP de selecionadas, ZIP completo, reconhecimento facial (resultados
esperados, sem requisições externas, segunda busca usando o índice salvo, limiar, ZIP dos resultados,
exclusão dos dados), console sem erros e layout no celular (sem rolagem horizontal, alvos de toque de
40 px ou mais, deslizar e botão voltar). Sem `SELFIE`, a etapa facial é pulada.

> No Windows, `vite preview` não encontra os arquivos quando o caminho do projeto tem acentos (por
> exemplo “Área de Trabalho”). Use `node tests/serve-dist.mjs`, que serve `dist/` como o GitHub Pages.

## Publicação no GitHub Pages

1. O repositório é `https://github.com/gbgouveia/galeria-CED04`.
2. No GitHub, abra **Settings → Pages** e, em **Build and deployment → Source**, escolha
   **GitHub Actions** (só na primeira vez).
3. Cada push na branch `main` roda `.github/workflows/deploy.yml`: instala, testa, gera o build com o
   caminho `/galeria-CED04/` e publica. O andamento aparece na aba **Actions**.
4. O site fica em `https://gbgouveia.github.io/galeria-CED04/`.

O caminho de publicação vem do nome do repositório. Para publicar em outro caminho, defina
`BASE_PATH` no build (por exemplo `BASE_PATH=/ npm run build` para domínio próprio).

Tamanho atual publicado: cerca de 190 MB (151 originais de 128 MB, mais médias, miniaturas e modelos).
O GitHub Pages aceita sites de até 1 GB.
