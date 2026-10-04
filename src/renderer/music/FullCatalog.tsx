import { AudiusCatalog } from './AudiusCatalog';
import type { AudiusTrack } from './audius';
export function FullCatalog({ query, setQuery, stream }: { query: string; setQuery: (value: string) => void; stream: (track: AudiusTrack, queue: AudiusTrack[]) => void }) {
  return <section id="catalog" aria-label="Music discovery"><AudiusCatalog query={query} setQuery={setQuery} play={stream} /></section>;
}
