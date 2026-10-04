import type { BrowserState } from '../shared/bridge';

export function WebsiteCardPreview({ website, close }: { website: BrowserState; close: () => void }) {
  return <section className="website-card-preview">
    <div className="preview-website-toolbar"><button onClick={close}>← Room</button><span className="badge">WEBSITE CARD PREVIEW</span></div>
    <div className="preview-website-content"><span className="preview-link-mark" aria-hidden="true">↗</span><h2>{website.title}</h2><p className="preview-website-url">{website.url}</p>
      <p>The desktop app displays the interactive website here.<br />In this browser preview, open it in a separate tab.</p>
      <a className="preview-open-site" href={website.url} target="_blank" rel="noopener noreferrer">Open site in new tab ↗</a>
      <p className="preview-website-hint">Try the room, notes, tasks, and local demo assistant.<br />External page summaries need the desktop app.</p>
    </div>
  </section>;
}
