import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {AuthGateway} from './components/AuthGateway.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><AuthGateway><App /></AuthGateway></AppErrorBoundary>
  </StrictMode>,
);

if(import.meta.env.PROD&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>void navigator.serviceWorker.register('/service-worker.js'));
}
