import { MoodDiscovery } from './MoodDiscovery';
import { HomeFeed } from './HomeFeed';
import { LikedSongs } from './likedSongs';
import { FeaturedAlbums } from './FeaturedAlbums';
import { useRef } from 'react';
import { AudioLibrary, type AudioControls } from './AudioLibrary';
import { FullCatalog } from './FullCatalog';
export function SongDiscovery({ query, setQuery, stopAmbient, ambientPlaying, onPlaybackChange, modernDesign = false }: { query: string; setQuery: (value: string) => void; stopAmbient: () => void; ambientPlaying: boolean; onPlaybackChange: (playing: boolean) => void; modernDesign?: boolean }) {
  const control = useRef<AudioControls>(null);
  return <section className="song-discovery" id="songs" aria-label="Find songs"><>{modernDesign && <HomeFeed play={(track,queue)=>control.current?.playAudius(track,queue)}/>}</><FeaturedAlbums play={(track, queue) => control.current?.playAudius(track, queue)} /><MoodDiscovery play={(track,queue)=>control.current?.playAudius(track,queue)} />{modernDesign && <h2 className="home-library-heading" id="home-library">Your library.</h2>}<AudioLibrary control={control} inactive={ambientPlaying} onPlay={stopAmbient} onPlaybackChange={onPlaybackChange} /><LikedSongs play={(track, queue) => control.current?.playAudius(track, queue)} /><FullCatalog query={query} setQuery={setQuery} stream={(track, queue) => control.current?.playAudius(track, queue)} /></section>;
}
