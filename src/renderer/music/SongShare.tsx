import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { makeSongCard, songCaption, type ShareSong } from './shareCard';
import { canShareCard, canShareLink, deliverCard, deliverLink, nativeSharing, saveCard } from './shareDelivery';
export function SongShare({ song }: { song: ShareSong }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <><button ref={trigger} className="song-share-toggle" onClick={() => setOpen(true)}>Share song ↗</button>{open && createPortal(<ShareDialog song={song} close={() => { setOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }} />, document.body)}</>;
}
function ShareDialog({ song: initialSong, close }: { song: ShareSong; close: () => void }) {
  const [song] = useState(initialSong);
  const dialog = useRef<HTMLDialogElement>(null), caption = useRef<HTMLTextAreaElement>(null);
  const [format, setFormat] = useState<'story' | 'square'>('story'), [card, setCard] = useState<File>(), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [artMissing, setArtMissing] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let cancelled = false, url = ''; setCard(undefined); setPreview(''); setMessage('');
    void makeSongCard(song, format).then(result => {
      if (cancelled) return; const file = new File([result.blob], `Tuniko-${format}.png`, { type: 'image/png' });
      url = URL.createObjectURL(file); setPreview(url); setCard(file); setArtMissing(!!song.artwork && !result.artworkIncluded);
    }).catch(() => { if (!cancelled) setMessage('Could not create the card. You can still copy the song.'); });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [song, format]);
  async function share(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError') && !/cancel/i.test(error instanceof Error ? error.message : String(error))) setMessage('Sharing could not open. Try saving the card or copying the song.'); }
    finally { setBusy(false); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setMessage(song.url ? 'Link and song copied.' : 'Song copied.'); } catch { caption.current?.focus(); caption.current?.select(); setMessage('Select and copy the text below.'); } }
  return <dialog ref={dialog} className="song-share-dialog" aria-labelledby="song-share-title" onCancel={close} onClose={close} style={{ '--song-color': song.color } as CSSProperties}>
    <header><div><span className="music-eyebrow">PASS THE FEELING ON</span><h2 id="song-share-title">Share this song</h2></div><button autoFocus aria-label="Close song sharing" onClick={close}>×</button></header>
    <div className="share-format" role="group" aria-label="Card format"><button aria-pressed={format === 'story'} onClick={() => setFormat('story')}>Story · 9:16</button><button aria-pressed={format === 'square'} onClick={() => setFormat('square')}>Post · 1:1</button></div>
    <div className={`share-card-preview share-${format}`} aria-busy={!card}>{preview ? <img src={preview} alt={`Share card: ${song.title}${song.artist ? ` by ${song.artist}` : ''}`} /> : <span>Making your card…</span>}</div>
    <p className="share-help">{format === 'story' ? 'Use the card in Instagram Stories. Add music there before posting.' : 'For posts, chats and anywhere you share a good song.'}{artMissing && ' Artwork unavailable; your card uses a record design.'}</p>
    <div className="share-actions">{card && canShareCard(card) && <button disabled={busy} onClick={() => void share(() => deliverCard(card))}>Share card…</button>}{!nativeSharing && <button disabled={!card || busy} onClick={() => { if (card) void share(async () => { if (await saveCard(card)) setMessage('Card saved. Upload it in your story or post.'); }); }}>Save card</button>}{song.url && canShareLink() && <button disabled={busy} onClick={() => void share(() => deliverLink(song.title, `${song.title} — ${song.artist}\nListening with Tuniko`, song.url!))}>Share link…</button>}<button disabled={busy} onClick={() => void copy(songCaption(song))}>{song.url ? 'Copy song & link' : 'Copy song'}</button></div>
    {!song.url && <p className="share-help">{song.provider ? 'No public listening link is available for this track.' : 'On-device songs have no public listening link.'}</p>}
    <textarea ref={caption} aria-label="Song sharing text" readOnly value={songCaption(song)} />
    <p role="status" className="share-status">{message}</p>
  </dialog>;
}
