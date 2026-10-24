import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Activity, AlertTriangle, ArrowRight, BookOpen, Check, ChevronDown, Download, FileText, GitBranch, Layers, Loader2, LogOut, Network, Plus, Search, Send, Shield, Square, Trash2, Users } from 'lucide-react';
import type { Account, AnalysisMode, AnalysisResult, Claim, EvidenceSource, Investigation } from './lib/types';
import { ApiError, exportJSON, exportMarkdown, getAccount, readInvestigations, requestAnalysis, saveInvestigations, signOut } from './services/client';
import { SignIn } from './components/SignIn';
import { AdminPanel, UsageBar, formatTokens } from './components/AdminPanel';
import './styles.css';

type Tab = 'overview' | 'claims' | 'challenge' | 'structure' | 'sources';
const modes: AnalysisMode[] = ['LIGHT', 'MEDIUM', 'HEAVY', 'ADVERSARIAL'];
const modeDescription: Record<AnalysisMode, string> = {
  LIGHT: 'Fast framing and direct analysis',
  MEDIUM: 'Analysis plus independent challenge',
  HEAVY: 'Full challenge and adjudication',
  ADVERSARIAL: 'Full scrutiny and opposing arguments',
};
const newInvestigation = (): Investigation => ({ id: crypto.randomUUID(), name: 'Untitled investigation', createdAt: new Date().toISOString(), sources: [], results: [] });

function saveFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Article({ text }: { text: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>;
}
function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="section"><h3>{title}</h3>{children}</section>;
}
function StatementList({ items }: { items: string[] }) {
  return items.length ? <ul className="statement-list">{items.map((item, i) => <li key={`${i}-${item.slice(0, 20)}`}>{item}</li>)}</ul> : <p className="muted">No entries returned.</p>;
}

function ClaimCard({ claim, sources, selected, onClick }: { claim: Claim; sources: EvidenceSource[]; selected: boolean; onClick: () => void }) {
  const sourceMap = new Map(sources.map(s => [s.id, s]));
  return <div className={`claim-card ${selected ? 'selected' : ''}`}>
    <button className="claim-head" onClick={onClick} aria-expanded={selected}>
      <span className="monospace">{claim.id}</span>
      <span className={`claim-status status-${claim.support}`}>{claim.support.replace('-', ' ')}</span>
      <ChevronDown size={15} className={selected ? 'rotated' : ''}/>
    </button>
    <p>{claim.text}</p>
    {selected && <div className="claim-detail">
      <p><strong>Interpretation:</strong> {claim.explanation}</p>
      <p className="muted small">Type: {claim.kind}. A quote match establishes only that the words appear in user-supplied material, not that the source or claim is true.</p>
      {claim.citations.length ? claim.citations.map((citation, index) => <div className="citation" key={`${citation.sourceId}-${index}`}>
        <div className="citation-head"><BookOpen size={14}/> {sourceMap.get(citation.sourceId)?.title || citation.sourceId}
          <span className={citation.quoteMatches ? 'match' : 'nonmatch'}>{citation.quoteMatches ? 'Quote located' : 'Quote not located'}</span>
        </div>
        <blockquote>{citation.excerpt}</blockquote>
        {sourceMap.get(citation.sourceId)?.url && <a href={sourceMap.get(citation.sourceId)?.url} target="_blank" rel="noopener noreferrer">Source URL (unverified) ↗</a>}
      </div>) : <p className="muted small">No allowed source excerpt was supplied for this claim.</p>}
    </div>}
  </div>;
}

function StructureMap({ result, sources, onSelectClaim }: { result: AnalysisResult; sources: EvidenceSource[]; onSelectClaim: (id: string) => void }) {
  const claims = result.claims.slice(0, 6);
  return <div className="map-canvas">
    <p className="muted small">A dependency-oriented view of the current analysis. Edges show cited excerpts, not proven causal relationships.</p>
    <div className="map-columns">
      <div className="map-column"><h4>Problem</h4><div className="map-node root-node">{result.question}</div><h4>Hypotheses</h4>{result.hypotheses.slice(0, 4).map((h, i) => <div className="map-node" key={i}>{h}</div>)}</div>
      <div className="map-column"><h4>Claims</h4>{claims.map(claim => <button key={claim.id} className="map-node map-action" onClick={() => onSelectClaim(claim.id)}><strong>{claim.id}</strong> {claim.text}</button>)}</div>
      <div className="map-column"><h4>Supplied evidence</h4>{sources.length ? sources.map(s => <div className="map-node evidence-node" key={s.id}><BookOpen size={14}/><strong>{s.title}</strong><span className="muted small">Cited by {claims.filter(c => c.citations.some(x => x.sourceId === s.id)).length} claims</span></div>) : <div className="map-node muted">No source documents supplied</div>}</div>
    </div>
    <p className="muted small">Select a claim to inspect the linked quotations. This MVP is a relationship overview; it does not yet support graph editing or automated dependency propagation.</p>
  </div>;
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
  if (account === undefined) return <div className="auth-screen"><Loader2 className="spin" size={22}/></div>;
  if (!account) return <SignIn onSignedIn={handleSignedIn} notice={notice}/>;
  return <Workspace key={account.user.id} account={account} onAccountChange={setAccount}
    onSignOut={() => { void signOut().catch(() => undefined); setAccount(null); }}/>;
}

function Workspace({ account, onAccountChange, onSignOut }: { account: Account; onAccountChange: (account: Account) => void; onSignOut: () => void }) {
  const userId = account.user.id;
  const [view, setView] = useState<'work' | 'admin'>('work');
  const [items, setItems] = useState<Investigation[]>(() => readInvestigations(userId));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [mode, setMode] = useState<AnalysisMode>('MEDIUM');
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceURL, setSourceURL] = useState('');
  const [sourceContent, setSourceContent] = useState('');
  const [addingSource, setAddingSource] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const active = items.find(i => i.id === activeId) ?? items[0];
  const result = active?.results.find(r => r.id === runId) ?? active?.results.at(-1);
  const hasResults = Boolean(result);

  useEffect(() => { try { saveInvestigations(userId, items); } catch { setError('Browser storage is full or unavailable. Export your work to avoid losing it.'); } }, [items, userId]);

  function makeProject(): Investigation {
    const project = newInvestigation();
    setItems(previous => [project, ...previous]);
    setActiveId(project.id); setRunId(null); setTab('overview'); setError(null); setView('work');
    return project;
  }

  function updateProject(id: string, transform: (item: Investigation) => Investigation): void {
    setItems(previous => previous.map(item => item.id === id ? transform(item) : item));
  }

  function addSource() {
    if (sourceTitle.trim().length === 0 || sourceContent.trim().length < 10) { setError('Supply a title and at least 10 characters of source material.'); return; }
    if (sourceURL.trim()) {
      try { if (!/^https?:$/.test(new URL(sourceURL.trim()).protocol)) throw new Error(); }
      catch { setError('Source URL must start with http:// or https://.'); return; }
    }
    const project = active || makeProject();
    if (project.sources.length >= 8) { setError('The current limit is eight sources per investigation.'); return; }
    const source: EvidenceSource = { id: `s_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, title: sourceTitle.trim(), url: sourceURL.trim() || undefined, content: sourceContent.trim() };
    if (source.content.length > 12000) { setError('Each source is limited to 12,000 characters.'); return; }
    updateProject(project.id, item => ({ ...item, sources: [...item.sources, source] }));
    setSourceTitle(''); setSourceURL(''); setSourceContent(''); setAddingSource(false); setError(null);
  }

  async function submit(question = query) {
    if (working || question.trim().length < 4) return;
    const project = active || makeProject();
    const controller = new AbortController(); abortRef.current = controller;
    setWorking(true); setError(null);
    try {
      const prior = project.results.at(-1);
      const context = prior ? `Earlier question: ${prior.question}\nEarlier conclusion: ${prior.conclusion}\nEarlier unknowns: ${prior.unknowns.join('; ')}`.slice(0, 4000) : undefined;
      const response = await requestAnalysis({ question: question.trim(), mode, sources: project.sources, context }, controller.signal);
      updateProject(project.id, item => ({ ...item, name: item.results.length === 0 ? question.trim().slice(0, 75) : item.name, results: [...item.results, response].slice(-12) }));
      setActiveId(project.id); setRunId(response.id); setTab('overview'); setSelectedClaim(null); setQuery('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { onSignOut(); return; }
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Analysis failed.');
    } finally {
      setWorking(false); abortRef.current = null;
      // Refresh the allowance shown in the sidebar after every attempt.
      getAccount().then(onAccountChange).catch(() => undefined);
    }
  }

  function exportProject(kind: 'json' | 'md') {
    if (!active) return;
    const name = `pattern-former-${active.id.slice(0, 8)}.${kind}`;
    saveFile(name, kind === 'json' ? exportJSON(active) : exportMarkdown(active), kind === 'json' ? 'application/json' : 'text/markdown');
  }

  function selectClaim(id: string) { setSelectedClaim(id); setTab('claims'); }
  return <div className="app-layout">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Network size={19}/></div><div><strong>PATTERN-FORMER</strong><span>REASONING WORKBENCH <b>0.2</b></span></div></div>
      <button className="primary full" onClick={makeProject}><Plus size={16}/> New investigation</button>
      <div className="side-label">INVESTIGATIONS <span>{items.length}</span></div>
      <nav className="project-list" aria-label="Investigations">{items.map(item => <button key={item.id} className={`project-item ${active?.id === item.id ? 'active' : ''}`} onClick={() => { setActiveId(item.id); setRunId(null); setTab('overview'); setError(null); setView('work'); }}><FileText size={15}/><span>{item.name}</span><small>{item.results.length}</small></button>)}</nav>
      <div className="usage-panel">
        <div className="side-label">THIS MONTH <span>{account.allowance.limit === null ? 'UNLIMITED' : `${Math.min(100, Math.round(account.allowance.limit ? account.allowance.monthTokens / account.allowance.limit * 100 : 100))}%`}</span></div>
        <UsageBar used={account.allowance.monthTokens} limit={account.allowance.limit}/>
        <p className="small muted">{formatTokens(account.allowance.monthTokens)} {account.allowance.limit === null ? 'tokens used this month' : `of ${formatTokens(account.allowance.limit)} tokens this month`}</p>
      </div>
      <div className="account-row">
        {account.user.picture ? <img src={account.user.picture} alt="" referrerPolicy="no-referrer"/> : <span className="avatar-fallback">{(account.user.name || account.user.email)[0]?.toUpperCase()}</span>}
        <div><strong>{account.user.name || account.user.email}</strong><span>{account.user.email}</span></div>
        <button className="icon-button" onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button>
      </div>
      <div className="sidebar-bottom"><Shield size={15}/><span>Investigations are stored in this browser, unencrypted. Avoid sensitive material on shared devices.</span></div>
    </aside>

    <main className="workspace">
      <header className="topbar"><div className="breadcrumbs"><span>WORKSPACE</span><ArrowRight size={13}/><strong>{active?.name || 'New analysis'}</strong></div><div className="top-actions">{account.user.isAdmin && <button className={view === 'admin' ? 'text-button active-view' : 'text-button'} onClick={() => setView(view === 'admin' ? 'work' : 'admin')}><Users size={15}/> {view === 'admin' ? 'Workspace' : 'Admin'}</button>}<button className="text-button" onClick={makeProject}><Plus size={15}/> New</button>{active && <><button className="text-button" onClick={() => exportProject('md')} title="Export Markdown"><Download size={15}/> Report</button><button className="text-button" onClick={() => exportProject('json')} title="Export JSON"><Download size={15}/> JSON</button></>}</div></header>
      <div className="workspace-scroll"><div className="content-width">{view === 'admin' ? <AdminPanel currentUserId={userId}/> : <>
        {account.user.status === 'blocked' && <div className="error-banner" role="alert"><AlertTriangle size={16}/><span>Your account has been blocked, so new analyses are disabled. Saved investigations remain available.</span></div>}
        <div className="page-heading"><span className="eyebrow"><Activity size={14}/> ANALYTICAL INTEGRITY ENGINE</span><h1>Ask a better question.<br/><em>Get a defensible answer.</em></h1><p>A structured workspace for assumptions, evidence, competing explanations and adversarial review. Sources are user supplied and not independently authenticated.</p></div>
        {error && <div className="error-banner" role="alert"><AlertTriangle size={16}/><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}
        <section className="composer"><div className="composer-header"><span>ANALYSIS REQUEST</span><div className="mode-caption">{modeDescription[mode]}</div></div>
          <textarea value={query} onChange={e => setQuery(e.target.value)} maxLength={3000} placeholder="Enter a proposition, decision, claim, or research question..." rows={4} aria-label="Analysis question" disabled={working}/>
          <div className="composer-footer"><div className="mode-options" role="group" aria-label="Analysis depth">{modes.map(m => <button type="button" key={m} className={mode === m ? 'mode active' : 'mode'} onClick={() => setMode(m)} aria-pressed={mode === m}>{m}</button>)}</div>
            {working ? <button className="cancel-button" onClick={() => abortRef.current?.abort()}><Square size={14}/> Stop waiting</button> : <button className="primary" onClick={() => { void submit(); }} disabled={query.trim().length < 4}><Send size={15}/> Analyse</button>}</div>
        </section>
        {working && <div className="working" role="status"><Loader2 className="spin" size={19}/><div><strong>Reasoning stages running</strong><span>Constructing the argument, challenging alternatives and adjudicating where the selected mode requires it.</span></div></div>}

        <div className="analysis-header"><div><span className="eyebrow">CURRENT INVESTIGATION</span><h2>{active?.name || 'Untitled investigation'}</h2></div><div className="analysis-summary"><span><BookOpen size={14}/> {active?.sources.length || 0} sources</span><span><Layers size={14}/> {active?.results.length || 0} runs</span></div></div>
        {active && active.results.length > 1 && <div className="history-row"><label htmlFor="run-choice">Analysis history</label><select id="run-choice" value={result?.id || ''} onChange={e => setRunId(e.target.value)}>{[...active.results].reverse().map((r, index) => <option key={r.id} value={r.id}>{new Date(r.createdAt).toLocaleString()} · {r.mode} · {r.question.slice(0, 62)}{index === 0 ? ' (latest)' : ''}</option>)}</select></div>}
        <div className="tabs" role="tablist" aria-label="Analysis views">{([['overview','Overview',FileText],['claims','Claim ledger',Check],['challenge','Challenge',Shield],['structure','Structure',GitBranch],['sources','Sources',BookOpen]] as const).map(([name,label,Icon]) => <button key={name} className={tab === name ? 'tab active' : 'tab'} onClick={() => setTab(name)} role="tab" aria-selected={tab === name}><Icon size={15}/>{label}</button>)}</div>

        {tab === 'overview' && (result ? <div className="results-grid"><div><div className="result-card prominent"><div className="result-topline"><span className="eyebrow">SYNTHESIS</span><span className={`confidence confidence-${result.confidence.toLowerCase()}`}>{result.confidence} CONFIDENCE</span></div><h3>Conclusion</h3><Article text={result.conclusion}/></div>
          <Section title="Problem framing"><Article text={result.frame}/></Section><Section title="Competing hypotheses"><StatementList items={result.hypotheses}/></Section><Section title="Key assumptions"><StatementList items={result.assumptions}/></Section></div>
          <aside className="insights"><div className="result-card"><div className="eyebrow">ANALYSIS RECORD</div><div className="stat"><strong>{result.claims.length}</strong><span>Recorded claims</span></div><div className="stat"><strong>{result.challenges.length}</strong><span>Independent objections</span></div><div className="stat"><strong>{result.methodology.steps.length}</strong><span>Reasoning stages</span></div><p className="small muted">{result.methodology.model} · {(result.methodology.durationMs / 1000).toFixed(1)}s{result.methodology.tokens && ` · ${formatTokens(result.methodology.tokens.input + result.methodology.tokens.output)} tokens`}</p></div><div className="result-card"><h3>Unresolved questions</h3><StatementList items={result.unknowns}/></div><button className="secondary full" onClick={() => setTab('claims')}>Inspect supporting claims <ArrowRight size={15}/></button></aside></div> : <div className="empty-state"><Search size={30}/><h3>Start an investigation</h3><p>Enter a question, add sources if available, and run an analysis. Light mode is a single pass; Heavy and Adversarial add separate challenge and adjudication steps.</p></div>)}

        {tab === 'claims' && (result ? <div className="claims-list"><div className="notice"><AlertTriangle size={17}/><span><strong>Evidence discipline:</strong> “Quote matched” means an excerpt appears in the supplied text. It is not an independent fact check. “Inferred” is model interpretation. Claims can still be wrong.</span></div>{result.claims.length ? result.claims.map(c => <ClaimCard key={c.id} claim={c} sources={active?.sources || []} selected={selectedClaim === c.id} onClick={() => setSelectedClaim(selectedClaim === c.id ? null : c.id)}/>) : <p className="empty-inline">No claims returned.</p>}</div> : <div className="empty-state">Run an analysis to generate claim records.</div>)}

        {tab === 'challenge' && (result ? <div className="challenge-layout"><div><div className="result-card"><span className="eyebrow">INDEPENDENT CHALLENGER</span><h3>Strongest objections</h3>{result.challenges.length ? result.challenges.map((c, index) => <div className="challenge-item" key={index}><div className="challenge-title"><span>{index + 1}. {c.objection}</span><span className={`severity severity-${c.severity.toLowerCase()}`}>{c.severity}</span></div><p>{c.implication}</p></div>) : <p className="muted">Light mode does not run a separate challenge stage.</p>}</div></div><div className="result-card"><h3>Challenge again</h3><p className="muted">Examine a claim using a new question. The next run will include a limited summary of the previous analysis.</p><button className="secondary full" onClick={() => { setQuery(`Steelman the strongest objection to this conclusion and say what evidence would settle it: ${result.conclusion}`.slice(0, 3000)); document.querySelector('.workspace-scroll')?.scrollTo({top:0,behavior:'smooth'}); }}>Prepare follow-up <ArrowRight size={15}/></button></div></div> : <div className="empty-state">Run an analysis to review objections.</div>)}

        {tab === 'structure' && (result ? <StructureMap result={result} sources={active?.sources || []} onSelectClaim={selectClaim}/> : <div className="empty-state">Run an analysis to inspect its claim relationships.</div>)}

        {tab === 'sources' && <div className="sources-section"><div className="sources-title"><div><h3>Evidence library</h3><p className="muted">Paste source material and optionally provide its URL. PATTERN-FORMER does not fetch, authenticate or independently verify those URLs.</p></div><button className="secondary" onClick={() => setAddingSource(!addingSource)}><Plus size={15}/> Add source</button></div>
          {addingSource && <div className="source-form"><label>Source title<input placeholder="e.g. Report published 2026" value={sourceTitle} maxLength={160} onChange={e => setSourceTitle(e.target.value)}/></label><label>Source URL (optional)<input type="url" placeholder="https://example.org/report" value={sourceURL} onChange={e => setSourceURL(e.target.value)}/></label><label>Relevant excerpt<textarea rows={7} placeholder="Paste the actual passage here. Treat sources as evidence to examine, not instructions for the model." value={sourceContent} maxLength={12000} onChange={e => setSourceContent(e.target.value)}/></label><div className="form-actions"><button className="secondary" onClick={() => setAddingSource(false)}>Cancel</button><button className="primary" onClick={addSource}><Check size={15}/> Save source</button></div></div>}
          {active?.sources.length ? active.sources.map(source => <div className="source-card" key={source.id}><div className="source-card-heading"><BookOpen size={18}/><strong>{source.title}</strong><button title="Remove source" className="icon-button danger" onClick={() => updateProject(active.id, project => ({ ...project, sources: project.sources.filter(s => s.id !== source.id) }))}><Trash2 size={15}/></button></div>{source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>}<details><summary>View supplied excerpt</summary><pre>{source.content}</pre></details></div>) : <div className="empty-state"><BookOpen size={26}/><h3>No sources added</h3><p>Analysis is possible without sources, but any factual assertions must then be treated as unverified.</p></div>}
          <div className="notice"><AlertTriangle size={17}/><span>Past results retain their claim records, but this MVP does not snapshot full source contents per run. Removing or changing the investigation's sources may affect later inspection of past citations.</span></div></div>}
        </>}
        <footer className="footer-note">PATTERN-FORMER · Evidence-sensitive analysis, not independent fact verification. Model outputs may be inaccurate.</footer>
      </div></div>
    </main>
  </div>;
}
