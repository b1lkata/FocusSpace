type IconName = 'spaces' | 'search' | 'settings' | 'arrow' | 'plus' | 'page' | 'note' | 'task' | 'orbit' | 'pause' | 'play' | 'reset' | 'spark' | 'music';
const paths: Record<IconName, string[]> = {
  music: ['M9 18V5l11-2v13', 'M9 15H6a3 3 0 1 0 3 3', 'M20 13h-3a3 3 0 1 0 3 3'],
  spaces: ['M12 3 3 8l9 5 9-5-9-5Z', 'm3 12 9 5 9-5', 'm3 16 9 5 9-5'],
  search: ['M20 20l-5-5', 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm9 3-1 3-3 1-2 3 2 2-1 3 3 2 2-1 3 2 3-1 1-3 3-1 1-3-2-2 1-3-3-2-2 1-3-2Z'],
  arrow: ['M5 19 19 5', 'M5 5h14v14'],
  plus: ['M12 5v14', 'M5 12h14'],
  page: ['M4 4h16v16H4Z', 'M4 9h16', 'M7 6.5h.01', 'M10 6.5h.01'],
  note: ['M6 3h12v18H6Z', 'M9 8h6', 'M9 12h6', 'M9 16h3'],
  task: ['M4 12a8 8 0 1 0 16 0 8 8 0 0 0-16 0Z', 'm8 12 3 3 5-6'],
  orbit: ['M12 3a9 9 0 1 0 9 9', 'M3 12h18', 'M12 3c-5 5-5 13 0 18 3-3 4-7 4-11', 'M18 2v5h5'],
  pause: ['M9 5v14', 'M15 5v14'],
  play: ['m8 5 11 7-11 7V5Z'],
  reset: ['M4 9a8 8 0 1 1 0 6', 'M4 3v6h6'],
  spark: ['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths[name].map((path, index) => <path key={index} d={path} />)}
  </svg>;
}
