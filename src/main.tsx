import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initializeBackgroundSync, cleanupBackgroundSync } from './lib/backgroundSync';

// Inicializar sistema de caché en background
initializeBackgroundSync();

// Cleanup al cerrar la aplicación
window.addEventListener('beforeunload', () => {
  cleanupBackgroundSync();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
