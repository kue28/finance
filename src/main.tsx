import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import LockGate from './components/LockGate';
import './styles.css';

// Ask the browser to treat our IndexedDB data as persistent, so Android won't
// clear it when the phone is low on storage. Installed PWAs are usually granted this.
navigator.storage?.persist?.().catch(() => {});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LockGate>
      <App />
    </LockGate>
  </StrictMode>,
);
