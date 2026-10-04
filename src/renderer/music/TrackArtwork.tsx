import { useState } from 'react';
export function TrackArtwork({ src, alternatives = [], title }: { src?: string; alternatives?: string[]; title: string }) {
  const [failed, setFailed] = useState<string[]>([]);
  const image = [src, ...alternatives].find(url => url && !failed.includes(url));
  return <span className="track-artwork"><img key={image ?? 'fallback'} src={image ?? './artwork/fallback.svg'} alt={image ? `Artwork for ${title}` : `Music illustration for ${title}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={event => event.currentTarget.classList.add('artwork-loaded')} onError={image ? () => setFailed(value => [...value, image]) : undefined} /></span>;
}
