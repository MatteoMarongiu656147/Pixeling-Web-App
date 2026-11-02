/**
 * Initializes the React application in the browser.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import AppRouter from './src/app/router.tsx';
import './index.css';

let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => {};

// Function to update the service worker when a new version of the app is available.
// on confirm in the browser, it calls the updateServiceWorker function.
updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (window.confirm('A new version of Pixeling is available. Update now?')) {
      void updateServiceWorker(true);
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
