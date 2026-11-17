import { createRoot } from 'react-dom/client';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/manrope';
import './styles/global.css';
import './styles/gallery.css';
import './styles/components.css';
import './styles/responsive.css';
import App from './App.jsx';
import { ToastProvider } from './components/Toasts.jsx';

createRoot(document.getElementById('root')).render(
  <ToastProvider>
    <App />
  </ToastProvider>,
);
