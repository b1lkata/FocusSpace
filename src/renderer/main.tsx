import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import './styles.css';
import { isWebPreview, isMobileBuild, isPublicDemo } from './runtime';
import { MusicApp } from './music/MusicApp';
const LegacyApp=lazy(()=>import('./App').then(module=>({default:module.App})));
async function start() {
  if (isWebPreview && !window.focusspace) {
    const { browserPreviewBridge } = await import('../preview/browserIO');
    window.focusspace = browserPreviewBridge();
  }
  if (isMobileBuild) document.documentElement.classList.add('ios-app');
  createRoot(document.getElementById('root')!).render(!isPublicDemo && new URLSearchParams(location.search).get('legacy') === '1' ? <Suspense fallback={<p role="status">Opening your spaces...</p>}><LegacyApp /></Suspense> : <MusicApp />);
}
void start();
