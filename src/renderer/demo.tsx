import { createRoot } from 'react-dom/client';
import './styles.css';
import { MusicApp } from './music/MusicApp';
// The public demo has no desktop bridge or previous-workspace entry point.
createRoot(document.getElementById('root')!).render(<MusicApp />);
