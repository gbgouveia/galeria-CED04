import { useCallback, useMemo, useState } from 'react';
import { Header } from './components/Header.jsx';
import { Hero } from './components/Hero.jsx';
import { Gallery } from './components/Gallery.jsx';
import { FindMeSection } from './components/FindMeSection.jsx';
import { PhotoViewer } from './components/PhotoViewer.jsx';
import { FaceSearch } from './components/FaceSearch.jsx';
import { DownloadManager } from './components/DownloadManager.jsx';
import { PrivacyModal } from './components/PrivacyModal.jsx';
import { SelectionBar } from './components/SelectionBar.jsx';
import { Footer } from './components/Footer.jsx';
import { useToast } from './components/Toasts.jsx';
import { useFavorites } from './hooks/useFavorites.js';
import { useSelection } from './hooks/useSelection.js';
import { useGallery } from './hooks/useGallery.js';
import { photos } from './services/photoService.js';
import { downloadPhoto } from './services/downloadService.js';

export default function App() {
  const favorites = useFavorites();
  const selection = useSelection();
  const gallery = useGallery({ liked: favorites.liked, selected: selection.selected });
  const notify = useToast();

  const [selectMode, setSelectMode] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [faceOpen, setFaceOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [zipJob, setZipJob] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const openViewer = useCallback((id, list) => {
    const index = list.findIndex((p) => p.id === id);
    if (index >= 0) setViewer({ list, index });
  }, []);

  const handleDownloadPhoto = useCallback(
    async (photo) => {
      setDownloadingId(photo.id);
      try {
        await downloadPhoto(photo);
        notify(`Download iniciado: ${photo.fileName}`);
      } catch {
        notify('Não foi possível baixar a foto. Verifique sua conexão e tente novamente.', { tone: 'error' });
      } finally {
        setDownloadingId(null);
      }
    },
    [notify],
  );

  const selectedPhotos = useMemo(() => photos.filter((p) => selection.selected.has(p.id)), [selection.selected]);

  return (
    <>
      <a className="skip-link" href="#galeria">
        Pular para a galeria
      </a>
      <Header onFindMe={() => setFaceOpen(true)} onPrivacy={() => setPrivacyOpen(true)} />
      <main>
        <Hero onFindMe={() => setFaceOpen(true)} />
        <FindMeSection onStart={() => setFaceOpen(true)} />
        <Gallery
          gallery={gallery}
          favorites={favorites}
          selection={selection}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          onOpen={openViewer}
          onDownloadAll={() => setZipJob({ photos, title: 'Todas as fotografias', slug: 'todas' })}
        />
      </main>
      <Footer onPrivacy={() => setPrivacyOpen(true)} />

      <SelectionBar
        selection={selection}
        selectedPhotos={selectedPhotos}
        onClear={() => {
          selection.clear();
          setSelectMode(false);
          if (gallery.view === 'selected') gallery.setView('all');
        }}
        onDownload={() => setZipJob({ photos: selectedPhotos, title: 'Fotos selecionadas', slug: 'selecionadas' })}
      />

      <FaceSearch
        open={faceOpen}
        onClose={() => setFaceOpen(false)}
        onOpenPhoto={openViewer}
        onDownloadPhoto={handleDownloadPhoto}
        onDownloadZip={(list) => setZipJob({ photos: list, title: 'Minhas fotos encontradas', slug: 'minhas-fotos' })}
        onShowPrivacy={() => setPrivacyOpen(true)}
      />
      <PhotoViewer
        state={viewer}
        onClose={() => setViewer(null)}
        onIndex={(index) => setViewer((v) => ({ ...v, index }))}
        favorites={favorites}
        selection={selection}
        onDownload={handleDownloadPhoto}
        downloading={downloadingId}
      />
      <DownloadManager job={zipJob} onClose={() => setZipJob(null)} />
      <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );
}
