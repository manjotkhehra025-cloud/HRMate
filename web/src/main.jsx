import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './lib/store.jsx';
import './styles/index.css';

const boot = document.getElementById('boot');

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>
);

// fade out the boot splash once React has painted
requestAnimationFrame(() => {
  setTimeout(() => {
    if (boot) {
      boot.style.opacity = '0';
      setTimeout(() => boot.remove(), 320);
    }
  }, 220);
});
