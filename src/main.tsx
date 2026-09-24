import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startAutosave } from './store/persist';
import './styles/base.css';
import './styles/home.css';
import './styles/wizard.css';
import './styles/board.css';

startAutosave();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
