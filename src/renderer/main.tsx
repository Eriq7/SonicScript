import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

console.log('[SonicScript] main.tsx executing, hash:', window.location.hash);

// Set body class based on hash
const hash = window.location.hash.replace('#', '');
document.body.classList.remove('floating', 'settings');
document.body.classList.add(hash === 'floating' ? 'floating' : 'settings');

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="color:red;padding:20px;font-family:monospace">FATAL: #root element not found</div>';
} else {
  console.log('[SonicScript] Mounting React...');
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    console.log('[SonicScript] React.render() called successfully');
  } catch (err) {
    console.error('[SonicScript] ReactDOM.createRoot failed:', err);
    rootEl.innerHTML = `<div style="color:red;padding:20px;font-family:monospace">Mount error: ${err}</div>`;
  }
}
