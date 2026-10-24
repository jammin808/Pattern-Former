import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, BookOpen, Download, Loader2, LogOut, Menu, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, Users, X } from 'lucide-react';
import type { Account, AnalysisMode, Investigation } from './lib/types';
import { ApiError, exportJSON, exportMarkdown, getAccount, readInvestigations, requestAnalysis, saveInvestigations, signOut } from './services/client';
import { SignIn } from './components/SignIn';
import { AdminPanel, UsageBar, formatTokens } from './components/AdminPanel';
import { AnswerCard } from './components/AnswerCard';
import { Composer } from './components/Composer';
import { EvidencePanel } from './components/EvidencePanel';
import { DEPTHS, depthOf, typicalSeconds } from './components/depth';
import './styles.css';

const EXAMPLES = [
  { title: 'Test a causal claim', question: 'Does this study show that the treatment caused the improvement?' },
  { title: 'Weigh a decision', question: 'Should we renew the lease or move, given these terms?' },
  { title: 'Check a document', question: 'What does this letter commit us to, and what does it leave open?' },
];
const DEPTH_KEY = 'pattern-former:depth';
const EVIDENCE_KEY = 'pattern-former:evidence-open';

const newInvestigation = (): Investigation => ({ id: crypto.randomUUID(), name: 'New investigation', createdAt: new Date().toISOString(), sources: [], results: [] });

function readPreference<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try { const v = localStorage.getItem(key); return allowed.includes(v as T) ? v as T : fallback; } catch { return fallback; }
}
function writePreference(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* Preferences are a convenience only. */ }
}

function saveFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nextResetDate(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString(undefined, { day: 'numeric', month: 'long', timeZone: 'UTC' });
}

export default function App() {
  // undefined while checking for an existing session, null when signed out.
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | undefined>();
  useEffect(() => {
    getAccount().then(setAccount).catch(e => {
      if (!(e instanceof ApiError && e.status === 401)) setNotice(e instanceof Error ? e.message : 'Could not check your session.');
      setAccount(null);
    });
  }, []);
  const handleSignedIn = useCallback((next: Account) => { setNotice(undefined); setAccount(next); }, []);
  if (account === undefined) return <div className="auth-screen"><Loader2 className="spin" size={22} aria-label="Loading"/></div>;
  if (!account) return <SignIn onSignedIn={handleSignedIn} notice={notice}/>;
  return <Workspace key={account.user.id} account={account} onAccountChange={setAccount}
    onSignOut={() => { void signOut().catch(() => undefined); setAccount(null); }}/>;
}

interface PendingTurn { investigationId: string; question: string; mode: AnalysisMode; startedAt: number }
interface FailedTurn { investigationId: string; question: string; mode: AnalysisMode; error: string }

function PendingAnswer({ turn, typical }: { turn: PendingTurn; typical: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const seconds = Math.max(0, Math.floor((now - turn.startedAt) / 1000));
  const depth = depthOf(turn.mode);
  return <div className="pending" role="status" aria-live="polite">
    <div className="pending-head"><strong>Working on a {depth.label.toLowerCase()} answer</strong>
      <span className="muted tabular" aria-label={`${seconds} seconds elapsed`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
    <ul className="stages">{depth.stages.map(s => <li key={s}><Loader2 className="spin" size={15} aria-hidden="true"/>{s}</li>)}</ul>
    <span className="muted small">{typical ? `Your recent ${depth.label.toLowerCase()} answers took about ${typical} seconds.` : 'This can take up to a minute or two at deeper levels.'} You can keep typing your next question.</span>
  </div>;
}

function Workspace({ account, onAccountChange, onSignOut }: { account: Account; onAccountChange: (account: Account) => void; onSignOut: () => void }) {
  const userId = account.user.id;
  const [items, setItems] = useState<Investigation[]>(() => readInvestigations(userId));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'work' | 'admin'>('work');
  const [mode, setModeState] = useState<AnalysisMode>(() => readPreference(DEPTH_KEY, DEPTHS.map(d => d.mode), 'MEDIUM'));
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const [failed, setFailed] = useState<FailedTurn | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(() => readPreference(EVIDENCE_KEY, ['open', 'closed'] as const, 'open') === 'open' && window.innerWidth >= 1200);
  const [addingSource, setAddingSource] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ item: Investigation; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const active = items.find(i => i.id === activeId) ?? items[0];
  const activePending = pending && active && pending.investigationId === active.id ? pending : null;
  const activeFailed = failed && active && failed.investigationId === active.id ? failed : null;
  const isEmpty = !active || (active.results.length === 0 && !activePending && !activeFailed);
  const typical = useMemo(() => (pending ? typicalSeconds(items, pending.mode) : null), [items, pending]);
  const { monthTokens, limit } = account.allowance;
  const blockedReason = account.user.status === 'blocked' ? 'Your account has been blocked, so you can’t ask new questions. Your saved investigations are still here.'
    : limit !== null && monthTokens >= limit ? `You’ve used this month’s ${formatTokens(limit)} tokens. Your allowance resets on ${nextResetDate()}.` : null;

  useEffect(() => { try { saveInvestigations(userId, items); } catch { setError('Browser storage is full or unavailable. Export your work to avoid losing it.'); } }, [items, userId]);
  useEffect(() => { if (!undo) return; const t = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(t); }, [undo]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setNavOpen(false); if (window.innerWidth < 1200) setEvidenceOpen(false); } };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Bring the newest turn into view: the pending card while waiting, the start of the new answer when it lands.
  const lastResultId = active?.results.at(-1)?.id;
  useEffect(() => {
    if (activePending) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [activePending]);
  useEffect(() => {
    if (activeFailed) threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeFailed]);
  useEffect(() => {
    if (lastResultId) document.getElementById(`turn-${lastResultId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [lastResultId]);

  function setMode(next: AnalysisMode) { setModeState(next); writePreference(DEPTH_KEY, next); }
  function toggleEvidence(open: boolean, adding = false) {
    setEvidenceOpen(open); setAddingSource(open && adding);
    if (window.innerWidth >= 1200) writePreference(EVIDENCE_KEY, open ? 'open' : 'closed');
  }

  function updateProject(id: string, transform: (item: Investigation) => Investigation, toFront = false): void {
    setItems(previous => {
      const next = previous.map(item => item.id === id ? transform(item) : item);
      if (!toFront) return next;
      const moved = next.find(item => item.id === id);
      return moved ? [moved, ...next.filter(item => item.id !== id)] : next;
    });
  }

  function makeProject(): Investigation {
    setView('work'); setNavOpen(false); setError(null);
    // Reuse an untouched investigation rather than piling up empty ones.
    if (active && active.results.length === 0 && active.sources.length === 0 && !activePending) {
      inputRef.current?.focus(); return active;
    }
    const project = newInvestigation();
    setItems(previous => [project, ...previous]);
    setActiveId(project.id); setQuery('');
    return project;
  }

  function selectProject(id: string) { setActiveId(id); setView('work'); setNavOpen(false); setError(null); setRenaming(null); }

  function addSource({ title, url, content }: { title: string; url: string; content: string }): string | null {
    if (!title.trim()) return 'Give the source a title.';
    if (content.trim().length < 10) return 'Paste at least 10 characters of text to quote from.';
    if (url.trim()) {
      try { if (!/^https?:$/.test(new URL(url.trim()).protocol)) throw new Error(); }
      catch { return 'Links must start with http:// or https://.'; }
    }
    const project = active ?? makeProject();
    if (project.sources.length >= 8) return 'An investigation can have up to 8 sources. Remove one first.';
    const source = { id: `s_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, title: title.trim(), url: url.trim() || undefined, content: content.trim() };
    updateProject(project.id, item => ({ ...item, sources: [...item.sources, source] }));
    setAddingSource(false);
    return null;
  }

  function deleteProject(id: string) {
    const index = items.findIndex(i => i.id === id);
    if (index < 0) return;
    setUndo({ item: items[index], index });
    setItems(previous => previous.filter(i => i.id !== id));
    if (active?.id === id) setActiveId(null);
  }

  function restoreProject() {
    if (!undo) return;
    setItems(previous => { const next = [...previous]; next.splice(Math.min(undo.index, next.length), 0, undo.item); return next; });
    setActiveId(undo.item.id); setUndo(null);
  }

  async function submit(questionText = query, depth = mode) {
    const question = questionText.trim();
    if (pending || blockedReason || question.length < 4) return;
    const project = active ?? makeProject();
    const controller = new AbortController(); abortRef.current = controller;
    setPending({ investigationId: project.id, question, mode: depth, startedAt: Date.now() });
    setFailed(null); setError(null); setQuery('');
    try {
      const prior = project.results.at(-1);
      const context = prior ? `Earlier question: ${prior.question}\nEarlier conclusion: ${prior.conclusion}\nEarlier unknowns: ${prior.unknowns.join('; ')}`.slice(0, 4000) : undefined;
      const response = await requestAnalysis({ question, mode: depth, sources: project.sources, context }, controller.signal);
      updateProject(project.id, item => ({
        ...item,
        name: item.results.length === 0 && item.name === 'New investigation' ? question.slice(0, 80) : item.name,
        results: [...item.results, response].slice(-12),
      }), true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { onSignOut(); return; }
      if (controller.signal.aborted) setQuery(current => current || question);
      else setFailed({ investigationId: project.id, question, mode: depth, error: e instanceof Error ? e.message : 'The analysis failed.' });
    } finally {
      setPending(null); abortRef.current = null;
      // Refresh the allowance after every attempt, since failed runs use tokens too.
      getAccount().then(onAccountChange).catch(() => undefined);
    }
  }

  function followUp(question: string, depth?: AnalysisMode) {
    setQuery(question.slice(0, 3000));
    if (depth) setMode(depth);
    window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(question.length, question.length); }, 0);
  }

  function exportProject(kind: 'json' | 'md') {
    if (!active) return;
    const slug = active.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'investigation';
    saveFile(`${slug}.${kind}`, kind === 'json' ? exportJSON(active) : exportMarkdown(active), kind === 'json' ? 'application/json' : 'text/markdown');
  }

  const composer = (large: boolean) => <Composer value={query} onChange={setQuery} onSubmit={() => void submit()} mode={mode} onModeChange={setMode}
    busy={Boolean(pending)} onStop={() => abortRef.current?.abort()} sources={active?.sources ?? []} onOpenEvidence={adding => toggleEvidence(true, adding)}
    inputRef={inputRef} blockedReason={blockedReason} large={large}
    placeholder={large ? 'For example: does this contract let the supplier pass on the delay costs?' : 'Ask a follow-up, or challenge the answer…'}/>;

  const usedPercent = limit === null ? null : limit === 0 ? 100 : Math.min(100, Math.round(monthTokens / limit * 100));

  return <div className="shell">
    <aside className={`sidebar${navOpen ? ' open' : ''}`} aria-label="Investigations and account">
      <div className="brand">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" className="brand-tile"/><path d="M8 19 L14 9 L20 19 M10.5 15 H17.5" className="brand-mark" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <strong>Pattern-Former</strong>
        <button type="button" className="icon-button nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={18}/></button>
      </div>
      <button type="button" className="button primary full" onClick={() => makeProject()}><Plus size={16}/> New investigation</button>
      <nav className="investigations" aria-label="Investigations">
        <h2 className="nav-heading">Investigations</h2>
        {items.length ? items.map(item => {
          const answering = pending?.investigationId === item.id;
          return <button type="button" key={item.id} className={`nav-item${active?.id === item.id && view === 'work' ? ' current' : ''}`} aria-current={active?.id === item.id && view === 'work' ? 'page' : undefined} onClick={() => selectProject(item.id)}>
            <span className="nav-title">{item.name}</span>
            <span className="nav-meta">{answering ? 'Answering…' : `${item.results.length} question${item.results.length === 1 ? '' : 's'}${item.sources.length ? ` · ${item.sources.length} source${item.sources.length === 1 ? '' : 's'}` : ''}`}</span>
          </button>;
        }) : <p className="muted small nav-empty">Your investigations will appear here.</p>}
      </nav>
      <div className="sidebar-foot">
        {account.user.isAdmin && <button type="button" className={`nav-item admin-link${view === 'admin' ? ' current' : ''}`} onClick={() => { setView('admin'); setNavOpen(false); }}><span className="nav-title"><Users size={15}/> Users and usage</span></button>}
        <div className="usage-card">
          <div className="usage-head"><span>This month</span><span className="muted tabular">{usedPercent === null ? 'No limit' : `${usedPercent}%`}</span></div>
          <UsageBar used={monthTokens} limit={limit}/>
          <span className="muted small tabular">{limit === null ? `${formatTokens(monthTokens)} tokens used` : `${formatTokens(monthTokens)} of ${formatTokens(limit)} tokens`}</span>
        </div>
        <div className="account-row">
          {account.user.picture ? <img src={account.user.picture} alt="" referrerPolicy="no-referrer"/> : <span className="avatar-fallback" aria-hidden="true">{(account.user.name || account.user.email)[0]?.toUpperCase()}</span>}
          <div><strong>{account.user.name || account.user.email}</strong><span>{account.user.email}</span></div>
          <button type="button" className="icon-button" onClick={onSignOut} aria-label="Sign out" title="Sign out"><LogOut size={16}/></button>
        </div>
        <p className="muted tiny">Investigations are saved in this browser only, unencrypted.</p>
      </div>
    </aside>
    {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} aria-hidden="true"/>}

    <main className="main">
      <header className="topbar">
        <button type="button" className="icon-button nav-open" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={18}/></button>
        {view === 'admin' ? <h1 className="topbar-title">Users and usage</h1>
          : renaming !== null && active ? <form className="rename" onSubmit={e => { e.preventDefault(); const name = renaming.trim(); if (name) updateProject(active.id, item => ({ ...item, name: name.slice(0, 120) })); setRenaming(null); }}>
            <label htmlFor="rename-input" className="visually-hidden">Investigation name</label>
            <input id="rename-input" autoFocus value={renaming} maxLength={120} onChange={e => setRenaming(e.target.value)} onBlur={e => e.currentTarget.form?.requestSubmit()} onKeyDown={e => { if (e.key === 'Escape') setRenaming(null); }}/>
          </form>
          : <div className="topbar-title-row">
            <h1 className="topbar-title">{active?.name ?? 'New investigation'}</h1>
            {active && <button type="button" className="icon-button" onClick={() => setRenaming(active.name)} aria-label="Rename investigation" title="Rename"><Pencil size={15}/></button>}
          </div>}
        {view === 'work' && <div className="topbar-actions">
          <button type="button" className={`button secondary${evidenceOpen ? ' pressed' : ''}`} aria-pressed={evidenceOpen} onClick={() => toggleEvidence(!evidenceOpen)}><BookOpen size={15}/> Evidence{active?.sources.length ? ` (${active.sources.length})` : ''}</button>
          {active && <details className="menu">
            <summary className="icon-button" aria-label="More actions"><MoreHorizontal size={18}/></summary>
            <div className="menu-list" role="menu">
              <button type="button" role="menuitem" disabled={!active.results.length} onClick={e => { exportProject('md'); e.currentTarget.closest('details')?.removeAttribute('open'); }}><Download size={15}/> Export as Markdown</button>
              <button type="button" role="menuitem" onClick={e => { exportProject('json'); e.currentTarget.closest('details')?.removeAttribute('open'); }}><Download size={15}/> Export as JSON</button>
              <button type="button" role="menuitem" className="danger" disabled={pending?.investigationId === active.id} onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); deleteProject(active.id); }}><Trash2 size={15}/> Delete investigation</button>
            </div>
          </details>}
        </div>}
      </header>

      {view === 'admin' ? <div className="admin-scroll"><AdminPanel currentUserId={userId}/></div> : <div className="work">
        <section className="conversation" aria-label="Conversation">
          <div className="thread" ref={threadRef}>
            <div className="thread-inner">
              {error && <div className="banner warning" role="alert"><AlertTriangle size={16}/><span>{error}</span><button type="button" className="link-button" onClick={() => setError(null)}>Dismiss</button></div>}
              {isEmpty ? <div className="start">
                <h2 className="start-title">What do you want to examine?</h2>
                <p className="start-lead">Ask about a claim, a decision or a document. You get a conclusion, the claims behind it graded against your sources, and the strongest objections.</p>
                {composer(true)}
                <section aria-labelledby="depth-heading" className="start-section">
                  <h3 id="depth-heading">How deep should it go?</h3>
                  <div className="depth-grid" role="radiogroup" aria-labelledby="depth-heading">
                    {DEPTHS.map(d => <button type="button" key={d.mode} role="radio" aria-checked={mode === d.mode} className={`depth-card${mode === d.mode ? ' selected' : ''}`} onClick={() => setMode(d.mode)}>
                      <strong>{d.label}</strong><span>{d.summary}</span><span className="muted small">{d.calls}</span>
                    </button>)}
                  </div>
                </section>
                <section aria-labelledby="examples-heading" className="start-section">
                  <h3 id="examples-heading">Or start from an example</h3>
                  <div className="example-grid">{EXAMPLES.map(x => <button type="button" key={x.title} className="example" onClick={() => followUp(x.question)}><strong>{x.title}</strong><span>{x.question}</span></button>)}</div>
                </section>
              </div> : <>
                {active!.results.map((r, i) => <div className="turn" key={r.id} id={`turn-${r.id}`}>
                  <p className="question">{r.question}</p>
                  <AnswerCard result={r} sources={active!.sources} isLatest={i === active!.results.length - 1 && !activePending} onFollowUp={followUp}/>
                </div>)}
                {activePending && <div className="turn"><p className="question">{activePending.question}</p><PendingAnswer turn={activePending} typical={typical}/></div>}
                {activeFailed && <div className="turn">
                  <p className="question">{activeFailed.question}</p>
                  <div className="failed" role="alert">
                    <p><AlertTriangle size={16}/> <strong>No answer this time.</strong> {activeFailed.error}</p>
                    <div className="failed-actions">
                      <button type="button" className="button secondary" disabled={Boolean(pending) || Boolean(blockedReason)} onClick={() => void submit(activeFailed.question, activeFailed.mode)}><RotateCcw size={14}/> Try again</button>
                      <button type="button" className="link-button" onClick={() => { followUp(activeFailed.question, activeFailed.mode); setFailed(null); }}>Edit the question</button>
                    </div>
                  </div>
                </div>}
              </>}
            </div>
          </div>
          {!isEmpty && <div className="dock">{composer(false)}</div>}
        </section>
        {evidenceOpen && <>
          <div className="scrim evidence-scrim" onClick={() => toggleEvidence(false)} aria-hidden="true"/>
          <EvidencePanel investigation={active} adding={addingSource} onAddingChange={setAddingSource} onAdd={addSource}
            onRemove={id => active && updateProject(active.id, item => ({ ...item, sources: item.sources.filter(s => s.id !== id) }))}
            onClose={() => toggleEvidence(false)}/>
        </>}
      </div>}
    </main>

    {undo && <div className="toast" role="status">
      <span>Deleted “{undo.item.name}”.</span>
      <button type="button" className="link-button" onClick={restoreProject}>Undo</button>
    </div>}
  </div>;
}
