import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createCard, createWorkspace, defaultCamera, demoWorkspace, now, record, stateSchema, uid, type AppState, type Card, type Position, type Workspace } from '../shared/model';
import type { AIResult, BrowserState } from '../shared/bridge';
import { call } from './api';
import { fitCamera, nextCardPosition } from '../shared/spatial';
import { applyOrganization, undoOrganization, addTaskDrafts } from '../shared/productivity';
import { useModalAccessibility } from './useModalAccessibility';
import markUrl from '../../build/icon.svg';
import { isWebPreview } from './runtime';
import { WebsiteCardPreview } from '../preview/WebsiteCardPreview';
import { Home } from './Home';
import './spatial.css';
import { FocusField } from './design/FocusField';
import { Icon } from './design/Icon';
const Scene = lazy(() => import('./Scene').then(module => ({ default: module.Scene })));

type PaletteAction = { title: string; searchText?: string; action: () => unknown };
type AIKind = 'summary' | 'briefing' | 'compare' | 'organize' | 'tasks';
type Prepared = { kind: AIKind; content: string; sourceIds: string[]; sourceUrl?: string; workspaceId: string };
export function App() {
  const surface = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<AppState>();
  const current = useRef<AppState | undefined>(undefined);
  const saveQueue = useRef(Promise.resolve());
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [persistence, setPersistence] = useState<'saving' | 'saved' | 'error'>('saved');
  const [search, setSearch] = useState('');
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [browser, setBrowser] = useState<BrowserState>();
  const [address, setAddress] = useState('');
  const [focused, setFocused] = useState(false);
  const [panel, setPanel] = useState(false);
  const [home, setHome] = useState(true);
  const [navigation, setNavigation] = useState(false);
  const [arrange, setArrange] = useState(false);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [dialog, setDialog] = useState<'workspace' | 'website' | 'note' | 'task' | 'settings' | 'palette' | 'edit-workspace'>();
  const [draft, setDraft] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState('#8b8aff');
  const [apiKey, setApiKey] = useState('');
  const [keyStatus, setKeyStatus] = useState({ hasKey: false, available: false });
  const [prepared, setPrepared] = useState<Prepared>();
  const [aiResult, setAIResult] = useState<AIResult>();
  const [resultContext, setResultContext] = useState<Prepared>();
  const [running, setRunning] = useState<string>();
  const [undo, setUndo] = useState<{ workspaceId: string; positions: { cardId: string; position: Position }[] }>();
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<{ token: string; workspaces: { name: string; count: number }[] }>();
  const host = useRef<HTMLDivElement>(null);
  const workspace = state?.workspaces.find(w => w.id === state.preferences.activeWorkspaceId) ?? state?.workspaces.find(w => !w.archived);
  const selected = workspace?.cards.find(c => c.id === selectedId);
  const modalKind = dialog ?? (prepared ? 'assistant' : importPreview ? 'import' : undefined);
  useModalAccessibility(modalKind);

  function receive(value: AppState) { current.current = value; setState(value); }
  function mutate(fn: (s: AppState) => void) {
    if (!current.current) return;
    const next = structuredClone(current.current); fn(next);
    if (!stateSchema.safeParse(next).success) { setError('This change exceeds project limits or contains invalid data. Nothing was changed.'); return; }
    receive(next);
    saveQueue.current = saveQueue.current.then(() => call({ type: 'save', state: next })).then(() => undefined).catch(e => setError(`Changes could not be saved: ${e.message}. Keep the app open and retry.`));
  }
  function changeWorkspace(fn: (w: Workspace) => void) {
    const id = workspace?.id; mutate(s => { const w = s.workspaces.find(w => w.id === id); if (w) fn(w); });
  }
  async function attempt<T>(fn: () => Promise<T>): Promise<T | undefined> { try { setError(''); return await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'The action failed.'); } }
  useEffect(() => {
    void call<AppState>({ type: 'load' }).then(receive).catch(e => setError(e.message));
    if (!window.focusspace) return;
    return window.focusspace.subscribe(event => {
      if (event.type === 'state') receive(event.state);
      if (event.type === 'browser') { setHome(false); setPanel(false); setBrowser(event.state); setAddress(event.state.url); }
      if (event.type === 'persistence') setPersistence(event.status);
      if (event.type === 'notice') { if (event.message === 'Return to workspace') { setBrowser(undefined); requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-command-trigger]')?.focus()); } else setNotice(event.message); }
    });
  }, []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        if (!prepared && !importPreview && !running) void showDialog('palette');
      }
      if (event.key === 'Escape') { setNavigation(false); setPanel(false); setDialog(undefined); if (running) void call({ type: 'cancel', requestId: running }); else setPrepared(undefined); setImportPreview(undefined); if (focused) setFocused(false); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [focused, running, !!prepared, !!importPreview]);
  useEffect(() => {
    if (!browser || !host.current) return;
    const element = host.current;
    const resize = () => { const r = element.getBoundingClientRect(); void call({ type: 'bounds', rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } }); };
    const observer = new ResizeObserver(resize); observer.observe(element); resize();
    return () => observer.disconnect();
  }, [browser?.cardId, focused, panel]);
  // Native views sit above HTML: close them before presenting application dialogs.
  async function room() { await attempt(() => call({ type: 'browser', action: 'close' })); setBrowser(undefined); }
  async function switchWorkspace(id: string) {
    setHome(false); setNavigation(false);
    await room(); setSelectedId(undefined); setAIResult(undefined); setResultContext(undefined); setCompareIds([]); setUndo(undefined);
    if (current.current?.preferences.activeWorkspaceId !== id) mutate(s => { s.preferences.activeWorkspaceId = id; const w = s.workspaces.find(w => w.id === id); if (w) w.lastUsedAt = now(); });
  }
  async function open(card: Card) {
    setHome(false); setPanel(false);
    setSelectedId(card.id);
    if (card.kind !== 'website' || !workspace) return;
    await saveQueue.current;
    if (!isWebPreview) { setBrowser({ cardId: card.id, url: card.url!, title: card.title, loading: true, back: false, forward: false }); setAddress(card.url!); }
    await attempt(() => call({ type: 'open', workspaceId: workspace.id, cardId: card.id }));
  }
  async function showDialog(type: typeof dialog) {
    setNavigation(false);
    await room(); setDraft(''); setDescription(''); setAccent('#8b8aff');
    if (type === 'edit-workspace' && workspace) { setDraft(workspace.name); setDescription(workspace.description); setAccent(workspace.accent); }
    if (type === 'settings' && !isWebPreview) { const status = await attempt(() => call<typeof keyStatus>({ type: 'key-status' })); if (status) setKeyStatus(status); }
    setDialog(type);
  }
  function submit() {
    setHome(false);
    if (!draft.trim()) return;
    try {
      if (dialog === 'workspace') { const w = createWorkspace(draft.trim()); w.description = description; w.accent = accent; mutate(s => { s.workspaces.push(w); s.preferences.activeWorkspaceId = w.id; }); }
      else if (dialog === 'edit-workspace') changeWorkspace(w => { w.name = draft.trim(); w.description = description; w.accent = accent; record(w, 'workspace-edited', 'Updated workspace details'); });
      else if (workspace && ['website', 'note', 'task'].includes(dialog ?? '')) {
        const card = createCard(dialog as Card['kind'], draft.trim(), workspace.cards.length, dialog === 'website' ? draft : undefined);
        changeWorkspace(w => { card.position = nextCardPosition(w.cards); w.cards.push(card); record(w, 'card-added', `Added ${card.title}`, card.id); }); setSelectedId(card.id);
      }
      setDialog(undefined);
    } catch (e) { setError((e as Error).message); }
  }
  function editCard(id: string, patch: Partial<Card>, activity = 'card-edited') {
    changeWorkspace(w => { const c = w.cards.find(c => c.id === id); if (c) { Object.assign(c, patch, { updatedAt: now() });
      const last = w.activity[0]; if (activity === 'note-edited' && last?.type === activity && last.cardId === id && Date.now() - Date.parse(last.at) < 30000) last.at = now(); else record(w, activity, `Updated ${c.title}`, c.id);
    } });
  }
  function deleteCard(card: Card) {
    if (!confirm(`Delete “${card.title}”? This cannot be undone.`)) return;
    changeWorkspace(w => { w.cards = w.cards.filter(c => c.id !== card.id); w.cards.forEach(c => { if (c.linkedCardId === card.id) c.linkedCardId = undefined; }); w.summaries = w.summaries.filter(s => s.cardId !== card.id); record(w, 'card-deleted', `Deleted ${card.title}`); }); setSelectedId(undefined);
  }
  function moveCard(card: Card, destination: string) {
    mutate(s => { const from = s.workspaces.find(w => w.id === workspace?.id); const to = s.workspaces.find(w => w.id === destination); if (!from || !to || from === to) return;
      from.cards = from.cards.filter(c => c.id !== card.id); from.cards.forEach(c => { if (c.linkedCardId === card.id) c.linkedCardId = undefined; }); card = { ...card, linkedCardId: undefined }; to.cards.push(card);
      const summaries = from.summaries.filter(x => x.cardId === card.id); from.summaries = from.summaries.filter(x => x.cardId !== card.id); to.summaries.push(...summaries);
      record(from, 'card-moved', `Moved ${card.title} to ${to.name}`); record(to, 'card-moved', `Received ${card.title}`, card.id);
    }); setSelectedId(undefined);
  }
  async function prepare(kind: AIKind) {
    if (!workspace) return;
    let content = ''; let sourceIds: string[] = []; let sourceUrl: string | undefined;
    if (kind === 'summary') {
      const extracted = await attempt(() => call<{ cardId: string; url: string; title: string; text: string }>({ type: 'extract' })); if (!extracted) return;
      content = `${extracted.title}\nSource: ${extracted.url}\n${extracted.text}`; sourceIds = [extracted.cardId]; sourceUrl = extracted.url;
    } else if (kind === 'compare') {
      if (compareIds.length < 2) { setError('Select at least two website cards in grid view to compare saved summaries.'); return; }
      sourceIds = compareIds;
      content = compareIds.map(id => { const c = workspace.cards.find(c => c.id === id)!; const summary = [...workspace.summaries].reverse().find(s => s.cardId === id); return `Card ${id}: ${c.title}\n${c.url}\n${summary ? `Saved ${summary.capturedAt} (${summary.provider}): ${summary.text}` : 'Missing content: summarize this page first.'}`; }).join('\n\n').slice(0, 40000);
    } else if (kind === 'tasks') { if (!aiResult) { setError('Generate a summary or briefing first.'); return; } content = aiResult.text; sourceIds = resultContext?.sourceIds ?? []; }
    else if (kind === 'organize') { content = JSON.stringify(workspace.cards.map(c => ({ id: c.id, kind: c.kind, title: c.title, position: c.position }))); sourceIds = workspace.cards.map(c => c.id); }
    else { content = JSON.stringify({ leftOff: workspace.leftOff, notes: workspace.cards.filter(c => c.kind === 'note'), unfinishedTasks: workspace.cards.filter(c => c.kind === 'task' && !c.done), recentActivity: workspace.activity.slice(0, 25), summaries: workspace.summaries.slice(-10) }).slice(0, 40000); sourceIds = workspace.cards.map(c => c.id); }
    await room(); setPrepared({ kind, content, sourceIds, sourceUrl, workspaceId: workspace.id });
  }
  async function generate() {
    if (!prepared) return;
    const context = prepared; const requestId = uid(); setRunning(requestId); setAIResult(undefined); setError('');
    await saveQueue.current;
    const result = await attempt(() => call<AIResult>({ type: 'ai', requestId, kind: context.kind, workspaceId: context.workspaceId, content: context.content }));
    setRunning(undefined);
    if (!result) return;
    setHome(false); setPanel(true); setPrepared(undefined); setAIResult(result); setResultContext(context);
    mutate(s => { const w = s.workspaces.find(w => w.id === context.workspaceId); if (!w) return;
      if (context.kind === 'briefing') w.briefing = { createdAt: now(), text: result.text, sourceIds: context.sourceIds, provider: result.provider };
      if (context.kind === 'summary') { w.summaries.push({ cardId: context.sourceIds[0], url: context.sourceUrl!, capturedAt: now(), text: result.text, provider: result.provider }); w.summaries = w.summaries.slice(-100); }
    });
  }
  function acceptOrganization() {
    if (!aiResult || !workspace || resultContext?.workspaceId !== workspace.id) return;
    try { changeWorkspace(w => { setUndo({ workspaceId: w.id, positions: applyOrganization(w, aiResult) }); }); setAIResult({ ...aiResult, positions: [] }); }
    catch (e) { setError((e as Error).message); }
  }
  function acceptTasks() {
    if (!aiResult || resultContext?.workspaceId !== workspace?.id) return;
    try { changeWorkspace(w => { addTaskDrafts(w, aiResult.tasks); }); setAIResult({ ...aiResult, tasks: [] }); } catch (e) { setError((e as Error).message); }
  }
  function resetCamera(fit = false) {
    changeWorkspace(w => {
      if (!fit || !w.cards.length) w.camera = defaultCamera();
      else { const rect = document.querySelector('.workspace-canvas')?.getBoundingClientRect(); w.camera = fitCamera(w.cards, rect ? rect.width / Math.max(1, rect.height) : 1); }
    }); setCameraRevision(c => c + 1);
  }
  const visibleCards = workspace?.cards.filter(c => (!focused || !selected || c.id === selected.id) && `${c.title} ${c.body} ${c.url ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  const paletteActions: PaletteAction[] = [
    { title: 'Add a website', action: () => showDialog('website') }, { title: 'Create a note', action: () => showDialog('note') }, { title: 'Create a task', action: () => showDialog('task') },
    { title: 'Toggle grid / room', action: () => { mutate(s => { s.preferences.mode = s.preferences.mode === '2d' ? '3d' : '2d'; }); setDialog(undefined); } },
    { title: 'Start focus mode', action: () => { setFocused(true); setDialog(undefined); } }, { title: 'Generate return briefing', action: () => { setDialog(undefined); return prepare('briefing'); } },
    ...(state?.workspaces.filter(w => !w.archived).map(w => ({ title: `Switch to ${w.name}`, action: () => { setDialog(undefined); return switchWorkspace(w.id); } })) ?? []),
    ...(workspace?.cards.map(c => ({ title: `${c.kind}: ${c.title}`, searchText: `${c.kind} ${c.title} ${c.body} ${c.url ?? ''}`, action: () => { setDialog(undefined); return open(c); } })) ?? []),
  ].filter((a: PaletteAction) => (a.searchText ?? a.title).toLowerCase().includes(draft.toLowerCase()));

  if (!state) return <main className="startup"><img className="brand-mark" src={markUrl} alt="" /><h1>FocusSpace</h1><p>{error || 'Opening your space…'}</p>{error && <button onClick={() => location.reload()}>Retry</button>}</main>;
  return <div ref={surface} className={`app minimal living ${home ? 'at-home' : ''} ${browser ? 'browsing' : ''} ${isWebPreview ? 'web-preview' : ''} ${focused ? 'focused' : ''} ${panel ? '' : 'panel-closed'}`}>
    <FocusField surface={surface} home={home} quiet={!!browser || focused || !!modalKind || navigation || panel} />
    <nav className="minimal-nav" aria-label="Main navigation" data-modal-background><button className="home-brand" aria-label="Home" title="Home" onClick={async () => { await room(); setHome(true); setNavigation(false); setPanel(false); setFocused(false); }}><span className="living-mark"><Icon name="spark" size={22} /></span><span>focus<span className="brand-light">space</span><span className="brand-period">.</span></span></button><span className="nav-center">Find your flow.</span><div><button aria-label="Workspaces" aria-expanded={navigation} title="Workspaces" onClick={async () => { await room(); setPanel(false); setNavigation(!navigation); }}><Icon name="spaces" /></button><button data-command-trigger aria-label="Search & commands" title="Search & commands" onClick={() => showDialog('palette')}><Icon name="search" /></button><button aria-label="Settings & data" title="Settings & data" onClick={() => showDialog('settings')}><Icon name="settings" /></button></div></nav>
    {navigation && !focused && <aside className="sidebar" aria-label="Workspace navigation" data-modal-background><button className="drawer-close" aria-label="Close workspace navigation" onClick={() => setNavigation(false)}>×</button><div className="brand"><img className="brand-mark" src={markUrl} alt="" /><div>FocusSpace<small>A little room for clarity.</small></div></div>
      <button className="search-button" data-command-trigger onClick={() => showDialog('palette')}>⌕ Search & commands <kbd>Ctrl ⇧ P</kbd></button>
      <div className="section-label">YOUR WORKSPACES<button onClick={() => showDialog('workspace')} aria-label="Create workspace">＋</button></div>
      <input aria-label="Search workspaces" placeholder="Find a workspace…" value={workspaceSearch} onChange={e => setWorkspaceSearch(e.target.value)} />
      <nav aria-label="Workspaces">{state.workspaces.filter(w => w.archived === showArchive && w.name.toLowerCase().includes(workspaceSearch.toLowerCase())).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt)).map(w => <button className={`workspace-nav ${workspace?.id === w.id ? 'active' : ''}`} key={w.id} aria-current={workspace?.id === w.id ? 'page' : undefined} onClick={() => { setHome(false); setNavigation(false); void switchWorkspace(w.id); }}><span style={{ background: w.accent }} />{w.name}<small>{w.cards.length}</small></button>)}</nav>
      <button className="muted-button" onClick={() => setShowArchive(!showArchive)}>{showArchive ? '← Active workspaces' : 'Archived workspaces'}</button>
      <div className="sidebar-bottom"><p>Your projects, organized.<br />Your next step, remembered.</p><button onClick={() => showDialog('settings')}>⚙ Settings & data</button></div>
    </aside>}
    <main className="main" data-modal-background>
      {home && (error || notice) && <div role={error ? 'alert' : 'status'} className={`banner ${error ? 'error' : ''}`}>{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}>×</button></div>}
      {home ? <Home workspaces={state.workspaces} activeId={state.preferences.activeWorkspaceId} create={() => showDialog('workspace')} enter={id => { setHome(false); void switchWorkspace(id); }} demo={() => { const w = demoWorkspace(); mutate(s => { s.workspaces.push(w); s.preferences.activeWorkspaceId = w.id; }); setHome(false); }} /> : <>
      <header className="main-header"><div><h1>{workspace?.name ?? 'Make room for your next idea'}</h1></div><div className="header-actions">
        <button aria-label={focused ? 'Exit focus' : 'Focus'} title={focused ? 'Exit focus' : 'Focus'} aria-pressed={focused} onClick={() => setFocused(!focused)}>⛶</button><button title="Project memory" onClick={() => { if (browser) void room(); setPanel(!panel); }} aria-label="Toggle project memory" aria-expanded={panel && !focused}>◷</button>
        {workspace && !focused && <button onClick={() => showDialog('edit-workspace')} aria-label="Edit workspace">•••</button>}
      </div></header>
      {(error || notice) && <div role={error ? 'alert' : 'status'} className={`banner ${error ? 'error' : ''}`}>{error || notice}<button aria-label="Dismiss message" onClick={() => { setError(''); setNotice(''); }}>×</button></div>}
      {!workspace ? <section className="empty"><span className="empty-orb">◇</span><h2>One project. A clearer head.</h2><p>Keep websites, notes, and next steps together.<br />Your space will be here when you return.</p><button className="primary" onClick={() => showDialog('workspace')}>Create your first workspace</button><button onClick={() => { const w = demoWorkspace(); mutate(s => { s.workspaces.push(w); s.preferences.activeWorkspaceId = w.id; }); }}>Try “Build My App” demo</button></section>
      : browser && isWebPreview ? <WebsiteCardPreview website={browser} close={() => void room()} />
      : browser ? <section className="browser-section"><div className="browser-toolbar"><button onClick={room}>← Room</button><button aria-label="Back" disabled={!browser.back} onClick={() => attempt(() => call({ type: 'browser', action: 'back' }))}>‹</button><button aria-label="Forward" disabled={!browser.forward} onClick={() => attempt(() => call({ type: 'browser', action: 'forward' }))}>›</button><button aria-label="Reload" onClick={() => attempt(() => call({ type: 'browser', action: 'reload' }))}>↻</button><form onSubmit={e => { e.preventDefault(); void attempt(() => call({ type: 'browser', action: 'navigate', url: address })); }}><input aria-label="Website address" value={address} onChange={e => setAddress(e.target.value)} /></form><button onClick={() => prepare('summary')}>Summarize</button></div>
        <div className="browser-status">{browser.loading ? 'Loading…' : browser.title}<span>Ctrl + Shift + F2 returns to the room</span></div>
        {browser.error && <div role="alert" className="banner error">{browser.error}<button onClick={() => attempt(() => call({ type: 'browser', action: 'reload' }))}>Retry</button></div>}
        <div ref={host} className="browser-host" /></section>
      : <><div className="workspace-toolbar"><div className="view-toggle" role="group" aria-label="Workspace view"><button aria-label="◇ Room" title="3D room" aria-pressed={state.preferences.mode === '3d'} className={state.preferences.mode === '3d' ? 'active' : ''} onClick={() => mutate(s => { s.preferences.mode = '3d'; })}>◇</button><button aria-label="▦ Grid" title="Grid" aria-pressed={state.preferences.mode === '2d'} className={state.preferences.mode === '2d' ? 'active' : ''} onClick={() => mutate(s => { s.preferences.mode = '2d'; })}>▦</button></div>
        <input aria-label="Search workspace content" placeholder="Search this space…" value={search} onChange={e => setSearch(e.target.value)} />
        <button aria-label="＋ Note" title="Add note" onClick={() => showDialog('note')}>▤</button><button aria-label="＋ Task" title="Add task" onClick={() => showDialog('task')}>✓</button><button aria-label="＋ Website" title="Add website" className="primary" onClick={() => showDialog('website')}>＋ ↗</button></div>
        {workspace.archived && <div className="banner">This workspace is archived.<button onClick={() => changeWorkspace(w => { w.archived = false; })}>Restore workspace</button></div>}
        <div className="workspace-canvas">{!workspace.cards.length ? <section className="empty"><span className="empty-orb">◇</span><h2>What belongs in this space?</h2><p>Add a website to start, then leave a note or next step.</p><button className="primary" onClick={() => showDialog('website')}>Add your first website</button></section>
        : state.preferences.mode === '3d' && !search && !focused ? <><Suspense fallback={<p className="scene-loading" role="status">Opening your room…</p>}><Scene workspace={workspace} arrange={arrange} selected={selectedId} open={open} move={(id, position) => editCard(id, { position }, 'card-arranged')} camera={value => changeWorkspace(w => { w.camera = value; })} fallback={() => { mutate(s => { s.preferences.mode = '2d'; }); setArrange(false); setNotice('3D is unavailable. Your cards are safe in Grid view.'); }} cameraRevision={cameraRevision} /></Suspense><div className="scene-tools"><button className={arrange ? 'active' : ''} onClick={() => setArrange(!arrange)}>{arrange ? '✓ Finish arranging' : 'Arrange cards'}</button><button onClick={() => resetCamera()}>Reset view</button><button onClick={() => resetCamera(true)}>Fit all</button><span>{arrange ? 'Drag cards to move them' : 'Drag to orbit · right-drag to pan · scroll to zoom'}</span></div></>
        : <div className="card-grid">{visibleCards.map(card => <article data-card-id={card.id} className={`content-card ${selectedId === card.id ? 'selected' : ''} ${card.done ? 'completed' : ''}`} key={card.id}>
          <div className="card-type">{card.kind}<span>{card.kind === 'website' ? '↗' : card.kind === 'note' ? '▤' : '○'}</span></div><button className="card-open" onClick={() => open(card)}><h2>{card.title}</h2><p>{card.kind === 'website' ? card.url : card.body || 'Select to edit'}</p></button>
          <div className="card-footer">{card.kind === 'task' ? <label><input type="checkbox" aria-label={`${card.done ? 'Reopen' : 'Complete'} task: ${card.title}`} checked={card.done} onChange={e => editCard(card.id, { done: e.target.checked }, e.target.checked ? 'task-completed' : 'task-reopened')} />{card.done ? 'Completed' : 'Mark complete'}</label> : card.kind === 'website' ? <label><input type="checkbox" aria-label={`Compare page: ${card.title}`} checked={compareIds.includes(card.id)} onChange={e => setCompareIds(e.target.checked ? [...compareIds, card.id] : compareIds.filter(id => id !== card.id))} />Compare</label> : <small>Autosaved locally</small>}<button aria-label={`Manage ${card.title}`} onClick={() => setSelectedId(card.id)}>•••</button></div>
        </article>)}{!visibleCards.length && <p>No matching cards.</p>}</div>}</div>
        {selected && <section className="editor"><div className="editor-heading"><strong>{selected.kind === 'website' ? 'Website details' : selected.kind === 'note' ? 'Your note' : 'Your next step'}</strong><button aria-label="Close card editor" onClick={() => setSelectedId(undefined)}>×</button></div>
          <input aria-label="Card title" value={selected.title} maxLength={200} onChange={e => { if (e.target.value) editCard(selected.id, { title: e.target.value }, selected.kind === 'note' ? 'note-edited' : 'card-edited'); }} />
          {selected.kind !== 'website' && <textarea aria-label="Card content" placeholder="Write something worth returning to…" value={selected.body} maxLength={20000} onChange={e => editCard(selected.id, { body: e.target.value }, selected.kind === 'note' ? 'note-edited' : 'task-edited')} />}
          <div className="editor-actions">{selected.kind === 'website' && <button onClick={() => open(selected)}>Open website ↗</button>}{selected.kind === 'task' && <><button onClick={() => editCard(selected.id, { done: !selected.done }, selected.done ? 'task-reopened' : 'task-completed')}>{selected.done ? 'Reopen task' : 'Complete task'}</button><select aria-label="Link task to website" value={selected.linkedCardId ?? ''} onChange={e => editCard(selected.id, { linkedCardId: e.target.value || undefined })}><option value="">No linked website</option>{workspace.cards.filter(c => c.kind === 'website').map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></>}
          <label>Move to <select aria-label="Move card to workspace" value="" onChange={e => { if (e.target.value) moveCard(selected, e.target.value); }}><option value="">Choose workspace…</option>{state.workspaces.filter(w => w.id !== workspace.id && !w.archived).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><button className="danger" onClick={() => deleteCard(selected)}>Delete</button></div></section>}
      </>}
      <footer className="main-footer"><span>{persistence === 'saved' ? (isWebPreview ? '● Saved in this browser' : '● Saved on this device') : persistence === 'saving' ? 'Saving…' : 'Changes not saved'}{persistence === 'error' && <button onClick={() => mutate(() => {})}>Retry save</button>}</span><span>{workspace?.cards.length ?? 0} cards · {workspace?.cards.filter(c => c.kind === 'task' && !c.done).length ?? 0} unfinished tasks</span></footer></>}
    </main>
    {panel && !focused && !home && <aside className="memory-panel" aria-label="Project memory" data-modal-background><button className="close-preview-memory" aria-label="Close project memory" onClick={() => setPanel(false)}>×</button><div className="panel-heading"><span className="eyebrow">PROJECT MEMORY</span><h2>A good place to return.</h2><p>Keep the thread of your work.</p></div>
      {workspace ? <><label className="field-label">Where I left off<textarea aria-label="Where I left off" value={workspace.leftOff} maxLength={20000} placeholder="I was working on… Next, I want to…" onChange={e => changeWorkspace(w => { w.leftOff = e.target.value; w.updatedAt = now(); })} /></label>
      <div className="next-tasks"><span className="section-label">NEXT STEPS</span>{workspace.cards.filter(c => c.kind === 'task' && !c.done).slice(0, 5).map(c => <button key={c.id} onClick={async () => { await room(); setSelectedId(c.id); }}>○ {c.title}</button>)}{!workspace.cards.some(c => c.kind === 'task' && !c.done) && <p>No unfinished tasks. Add one small next step.</p>}</div>
      <div className="assistant"><div className="assistant-title"><strong>✧ Workspace assistant</strong><span className="badge">{state.preferences.provider === 'demo' ? 'DEMO' : 'OPENAI'}</span></div><p>{state.preferences.provider === 'demo' ? 'Local examples. No credentials or paid calls.' : 'Runs only when you review and send content.'}</p><button className="primary" onClick={() => prepare('briefing')}>Continue where I left off</button><div className="assistant-actions"><button onClick={() => prepare('organize')}>Suggest organization</button><button onClick={() => prepare('compare')}>Compare selected pages</button></div>
      {undo && <button onClick={() => { mutate(s => { const w = s.workspaces.find(w => w.id === undo.workspaceId); if (w) undoOrganization(w, undo.positions); }); setUndo(undefined); }}>Undo organization</button>}
      {aiResult ? <div className="ai-result"><span className="badge">{aiResult.provider === 'demo' ? 'DEMO OUTPUT' : 'OPENAI RESPONSE'}</span><p className="pre-wrap">{aiResult.text}</p>{resultContext?.sourceIds.map(id => { const c = workspace.cards.find(c => c.id === id); return c ? <button className="source-link" key={id} onClick={() => open(c)}>↗ {c.title}</button> : null; })}
        {!!aiResult.positions.length && <><p>Proposed layout ({aiResult.positions.length} cards):</p><ul>{aiResult.positions.map(p => <li key={p.cardId}>{workspace.cards.find(c => c.id === p.cardId)?.title}: {p.position.join(', ')}</li>)}</ul><button onClick={acceptOrganization}>Accept layout</button></>}
        {!!aiResult.tasks.length && <><p>Review task drafts:</p>{aiResult.tasks.map((title, i) => <input key={i} aria-label={`Task draft ${i + 1}`} value={title} maxLength={200} onChange={e => setAIResult({ ...aiResult, tasks: aiResult.tasks.map((t, index) => index === i ? e.target.value : t) })} />)}<button onClick={acceptTasks}>Add proposed tasks</button></>}
        {!aiResult.tasks.length && ['summary', 'briefing', 'compare'].includes(resultContext?.kind ?? '') && <button onClick={() => prepare('tasks')}>Draft tasks from this</button>}
      </div> : workspace.briefing && <div className="ai-result"><span className="badge">SAVED {workspace.briefing.provider.toUpperCase()} BRIEFING</span><small>{new Date(workspace.briefing.createdAt).toLocaleString()}</small><p className="pre-wrap">{workspace.briefing.text}</p></div>}</div>
      <div className="activity"><span className="section-label">RECENT ACTIVITY</span>{workspace.activity.slice(0, 8).map(a => <div key={a.id}><span>{a.detail}</span><small>{new Date(a.at).toLocaleString()}</small></div>)}{!workspace.activity.length && <p>Your meaningful project activity will appear here.</p>}</div></> : <p>Create a workspace to remember your next step.</p>}
    </aside>}
    {dialog && <div className="modal-backdrop"><section className={`modal ${dialog === 'palette' ? 'palette' : ''}`} role="dialog" aria-modal="true" aria-label={dialog} tabIndex={-1}><div className="modal-heading"><h2>{dialog === 'settings' ? 'Settings & your data' : dialog === 'palette' ? 'Find your next move' : dialog === 'edit-workspace' ? 'Workspace details' : `Add ${dialog === 'workspace' ? 'a workspace' : `a ${dialog}`}`}</h2><button aria-label="Close dialog" onClick={() => setDialog(undefined)}>×</button></div>
      {dialog === 'settings' ? <><label>Assistant provider<select value={state.preferences.provider} onChange={e => mutate(s => { s.preferences.provider = e.target.value as 'demo' | 'openai'; })}><option value="demo">Demo — local, no paid calls</option>{!isWebPreview && <option value="openai">OpenAI — your API key</option>}</select></label>{isWebPreview ? <p>The browser preview uses a local demo assistant. API keys and real AI are available in the desktop app.</p> : <><label>Supported model ID<input value={state.preferences.model} maxLength={100} onChange={e => { if (e.target.value) mutate(s => { s.preferences.model = e.target.value; }); }} /></label><p>Use a model available to your OpenAI account that supports structured Responses output. Real integration has not been verified with credentials.</p><label>API key<input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={keyStatus.hasKey ? 'A key is stored securely' : 'Paste your API key'} /></label><button disabled={!apiKey || !keyStatus.available} onClick={async () => { const reply = await attempt(() => call({ type: 'key', key: apiKey })); if (reply !== undefined) { setApiKey(''); setKeyStatus({ ...keyStatus, hasKey: true }); setNotice('API key saved securely.'); } }}>Save key securely</button><button disabled={!keyStatus.hasKey} onClick={async () => { await attempt(() => call({ type: 'key', key: '' })); setKeyStatus({ ...keyStatus, hasKey: false }); }}>Remove key</button></>}
      <hr /><h3>Your local data</h3><p>Exports include project text and saved summaries. Credentials, cookies, and browser sessions are excluded.</p><button onClick={() => attempt(() => call({ type: 'export' }))}>Export workspaces</button><button onClick={async () => { const value = await attempt(() => call<typeof importPreview>({ type: 'import-preview' })); if (value) { setImportPreview(value); setDialog(undefined); } }}>Preview import</button></>
      : dialog === 'palette' ? <><input data-initial-focus aria-label="Search commands and content" onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); document.querySelector<HTMLElement>('.palette-results button')?.focus(); } if (e.key === 'Enter' && paletteActions[0]) { e.preventDefault(); void paletteActions[0].action(); } }} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Search commands, workspaces, and cards…" /><div className="palette-results" onKeyDown={e => { if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return; const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); if (index < 0 || !buttons.length) return; e.preventDefault(); buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus(); }}>{paletteActions.map((a, i) => <button key={i} onClick={a.action}>{a.title}<span>↵</span></button>)}{!paletteActions.length && <p role="status">No matching commands or cards.</p>}</div></>
      : <form onSubmit={e => { e.preventDefault(); submit(); }}><label>{dialog === 'website' ? 'Website address' : 'Name'}<input data-initial-focus value={draft} maxLength={dialog === 'website' ? 2048 : dialog === 'workspace' || dialog === 'edit-workspace' ? 100 : 200} onChange={e => setDraft(e.target.value)} placeholder={dialog === 'website' ? 'https://example.com' : 'Give it a useful name'} required /></label>{['workspace', 'edit-workspace'].includes(dialog) && <><label>Description<textarea value={description} maxLength={1000} onChange={e => setDescription(e.target.value)} /></label><label>Accent color<input type="color" value={accent} onChange={e => setAccent(e.target.value)} /></label></>}<button type="submit" className="primary">{dialog === 'edit-workspace' ? 'Save details' : 'Add to my space'}</button>
      {dialog === 'edit-workspace' && <div className="destructive-actions"><button type="button" onClick={() => { changeWorkspace(w => { w.archived = !w.archived; }); setDialog(undefined); }}>{workspace?.archived ? 'Restore' : 'Archive'} workspace</button><button type="button" className="danger" onClick={() => { if (confirm(`Permanently delete “${workspace?.name}” and all its cards? Export first if you need a backup.`)) { mutate(s => { s.workspaces = s.workspaces.filter(w => w.id !== workspace?.id); s.preferences.activeWorkspaceId = s.workspaces.find(w => !w.archived)?.id; }); setDialog(undefined); } }}>Delete workspace</button></div>}</form>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section></div>}
    {prepared && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Review assistant content"><div className="modal-heading"><h2>Review before {state.preferences.provider === 'demo' ? 'demo generation' : 'sending to OpenAI'}</h2><button aria-label="Close assistant preview" disabled={!!running} onClick={() => setPrepared(undefined)}>×</button></div><p>Request: {prepared.kind}. {state.preferences.provider === 'demo' ? 'This runs locally and makes no API calls.' : `This sends the displayed text and card titles/IDs/positions to OpenAI using ${state.preferences.model}. API usage may incur charges.`}</p><p>No cookies, passwords, or form values are intentionally included. Review the text for sensitive project content.</p><textarea className="content-preview" aria-label="Content to use for assistant" value={prepared.content} maxLength={40000} disabled={!!running} onChange={e => setPrepared({ ...prepared, content: e.target.value })} />{running ? <><p role="status">Working…</p><button onClick={() => call({ type: 'cancel', requestId: running })}>Cancel request</button></> : <button className="primary" onClick={generate}>{error ? 'Retry' : state.preferences.provider === 'demo' ? 'Generate labeled demo' : 'Send to OpenAI'}</button>}{error && <p role="alert" className="error-text">{error}</p>}</section></div>}
    {importPreview && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-label="Import preview"><h2>Import as new workspaces</h2><p>Existing projects will be preserved. Imported projects receive new IDs.</p><ul>{importPreview.workspaces.map((w, i) => <li key={i}>{w.name} · {w.count} cards</li>)}</ul><button onClick={() => setImportPreview(undefined)}>Cancel</button><button className="primary" onClick={async () => { const value = await attempt(() => call<AppState>({ type: 'import-accept', token: importPreview.token })); if (value) receive(value); setImportPreview(undefined); }}>Accept import</button></section></div>}
  </div>;
}
