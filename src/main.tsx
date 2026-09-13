import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {AuthGateway} from './components/AuthGateway.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGateway><App /></AuthGateway>
  </StrictMode>,
);
