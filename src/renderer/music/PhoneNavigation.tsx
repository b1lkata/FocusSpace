import { useRef, useState } from 'react';
import { Icon } from '../design/Icon';
export function PhoneNavigation() {
  const [active, setActive] = useState('Home');
  const positions = useRef<Record<string, number>>({});
  return <nav className="phone-navigation" aria-label="Phone navigation">{(['Home', 'Search', 'Library'] as const).map(item => <button key={item} aria-current={active === item ? 'page' : undefined} onClick={() => {
    const pane = document.querySelector<HTMLElement>('.music-app');
    if (pane && item !== active) positions.current[active] = pane.scrollTop;
    setActive(item);
    if (pane && item !== 'Search' && positions.current[item] != null) { pane.scrollTo({ top: positions.current[item], behavior: 'instant' }); return; }
    if (item === 'Search') { const input = document.querySelector<HTMLInputElement>('#catalog-search-form input'); input?.focus({ preventScroll: true }); }
    else document.querySelector(item === 'Home' ? '.music-header' : document.body.classList.contains('tuniko-music-first') ? '#home-library' : '.playlist-library')?.scrollIntoView({ block: 'start' });
  }}><Icon name={item === 'Home' ? 'spark' : item === 'Search' ? 'search' : 'spaces'} size={21} /><span>{item}</span></button>)}</nav>;
}
