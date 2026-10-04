import { useRef, type CSSProperties } from 'react';
import type { Workspace } from '../shared/model';
import { Icon } from './design/Icon';

type HomeProps = {
  workspaces: Workspace[];
  activeId?: string;
  enter: (id: string) => void;
  create: () => void;
  demo: () => void;
};

export function Home({ workspaces, activeId, enter, create, demo }: HomeProps) {
  const surface = useRef<HTMLElement>(null);
  const spaces = workspaces.filter(workspace => !workspace.archived).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  const recent = spaces.find(workspace => workspace.id === activeId) ?? spaces[0];

  return <section className="space-home living-home" ref={surface} aria-label="Home">
    <section className="home-hero" aria-label="Welcome to FocusSpace">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="status-star"><Icon name="spark" size={13} /></span>Room to think.</div>
        <h1>A little room<br />for <em>big ideas.</em></h1>
        <p>Your ideas. All in orbit.</p>
        <div className="hero-actions">
          <button className="enter-space" onClick={() => recent ? enter(recent.id) : create()}><span>{recent ? 'Enter your space' : 'Create your space'}</span><Icon name="arrow" size={18} /></button>
          {recent && <span className="resume-caption"><span style={{ background: recent.accent }} />{recent.name}</span>}
        </div>
      </div>
      <div className="field-playground" aria-hidden="true"><span className="orbit-label">Ideas, in motion.</span><span className="interaction-hint"><span className="hint-dot" />Move. Drag. Explore.</span></div>
      <div className="hero-baseline"><a className="scroll-cue" href="#your-spaces" aria-label="Explore your spaces"><span>Your spaces</span><span className="down-arrow" aria-hidden="true">↓</span></a><span className="local-caption"><span />Your flow. Saved.</span></div>
    </section>

    <section id="your-spaces" className="home-spaces" aria-label="Your spaces">
      <div className="home-section-heading"><div><span className="section-kicker">PICK UP THE THREAD</span><h2>Your spaces<span className="space-count">{spaces.length.toString().padStart(2, '0')}</span></h2></div><button className="round-control" title="Create workspace" aria-label="Create workspace" onClick={create}><Icon name="plus" size={20} /></button></div>
      <div className="space-portals">
        {spaces.map((workspace, index) => {
          const pages = workspace.cards.filter(card => card.kind === 'website').length;
          const notes = workspace.cards.filter(card => card.kind === 'note').length;
          const tasks = workspace.cards.filter(card => card.kind === 'task' && !card.done).length;
          return <button key={workspace.id} className="space-portal" aria-label={`Open ${workspace.name}`} onClick={() => enter(workspace.id)} style={{ '--space-accent': workspace.accent } as CSSProperties} onPointerMove={event => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || event.pointerType === 'touch') return;
            const rect = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.setProperty('--tilt-x', `${(event.clientY - rect.top - rect.height / 2) / rect.height * -9}deg`);
            event.currentTarget.style.setProperty('--tilt-y', `${(event.clientX - rect.left - rect.width / 2) / rect.width * 12}deg`);
          }} onPointerLeave={event => { event.currentTarget.style.setProperty('--tilt-x', '0deg'); event.currentTarget.style.setProperty('--tilt-y', '0deg'); }}>
            <span className="portal-topline"><span className="portal-number">{(index + 1).toString().padStart(2, '0')}</span><span className="portal-status">{workspace.id === recent?.id ? 'Last visited' : 'Yours to explore'}</span><Icon name="arrow" size={18} /></span>
            <span className="portal-figure" aria-hidden="true"><span className="mini-orbit" /><span className="mini-platform" /><span className="mini-page"><span /><span /><Icon name="page" size={28} /></span><span className="mini-note"><Icon name="note" size={24} /></span><span className="mini-task"><Icon name="task" size={23} /></span><span className="mini-star"><Icon name="spark" size={16} /></span></span>
            <span className="portal-caption"><strong>{workspace.name}</strong><span className="portal-stats"><span><Icon name="page" size={14} />{pages}</span><span><Icon name="note" size={14} />{notes}</span><span><Icon name="task" size={14} />{tasks}</span></span></span>
          </button>;
        })}
        <button className="space-portal new-space" onClick={create} aria-label="Add a new space"><span className="new-space-figure" aria-hidden="true"><Icon name="plus" size={30} /></span><strong>A fresh start</strong><span>What comes next?</span></button>
      </div>
    </section>
    <footer className="home-bottom"><span className="footer-brand"><Icon name="spark" size={18} />Less noise. More possibility.</span><a href="./index.html">Listening room</a>{workspaces.length ? <span>Come back to clarity.</span> : <button onClick={demo}>Try a sample space</button>}</footer>
  </section>;
}
