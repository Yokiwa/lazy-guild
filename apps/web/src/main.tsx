import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { initI18n } from './i18n';
import { pushClient } from './push/client';
import './styles.css';

await initI18n();
registerSW({ immediate: true });
void pushClient.onStartup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
