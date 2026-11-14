import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/berkshire-swash';
import '../src/styles/index.css';
import { App } from './App';
import './gallery.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Gallery root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
