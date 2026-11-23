import {FeedbackHost} from './components/FeedbackHost';
import {PWAUpdate} from './components/PWAUpdate';
import {StrictMode,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './workspaceRefinement.css';
import {AuthGateway} from './components/AuthGateway.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary';

const PlatformAdmin=lazy(()=>import('./components/PlatformAdmin'));
const platform=location.pathname==='/platform'||location.pathname.startsWith('/platform/');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary><AuthGateway>{platform?<Suspense fallback={<p role="status">Platform yönetimi yükleniyor…</p>}><PlatformAdmin/></Suspense>:<App />}</AuthGateway></AppErrorBoundary><FeedbackHost/><PWAUpdate/>
  </StrictMode>,
);
