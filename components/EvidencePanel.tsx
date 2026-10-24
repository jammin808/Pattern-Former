import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { EvidenceSource, Investigation } from '../lib/types';

interface EvidencePanelProps {
  investigation: Investigation | undefined;
  adding: boolean;
  onAddingChange: (adding: boolean) => void;
  onAdd: (source: { title: string; url: string; content: string }) => string | null;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const quotedBy = (investigation: Investigation, id: string) =>
  investigation.results.reduce((n, r) => n + r.claims.filter(c => c.citations.some(x => x.sourceId === id && x.quoteMatches)).length, 0);

function SourceForm({ onAdd, onCancel }: { onAdd: EvidencePanelProps['onAdd']; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);

  return <form className="source-form" onSubmit={e => { e.preventDefault(); const problem = onAdd({ title, url, content }); if (problem) setError(problem); }}>
    <label>Title<input ref={titleRef} value={title} maxLength={160} placeholder="e.g. Trial summary" onChange={e => setTitle(e.target.value)}/></label>
    <label>Text to quote from<textarea rows={7} value={content} maxLength={12000} placeholder="Paste the passage. It is treated as evidence to examine, never as instructions." onChange={e => setContent(e.target.value)}/>
      <span className="muted small">{content.length.toLocaleString('en')} / 12,000 characters</span></label>
    <label>Link <span className="muted">(optional, not opened or checked)</span><input type="url" value={url} placeholder="https://" onChange={e => setUrl(e.target.value)}/></label>
    {error && <p className="field-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button primary">Add source</button></div>
  </form>;
}

export function EvidencePanel({ investigation, adding, onAddingChange, onAdd, onRemove, onClose }: EvidencePanelProps) {
  const sources: EvidenceSource[] = investigation?.sources ?? [];
  return <aside className="evidence-panel" aria-label="Evidence">
    <div className="panel-head">
      <h2>Evidence</h2>
      <div className="panel-actions">
        {!adding && sources.length < 8 && <button type="button" className="link-button" onClick={() => onAddingChange(true)}><Plus size={14}/> Add source</button>}
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close evidence panel"><X size={16}/></button>
      </div>
    </div>
    <p className="muted small">Every question in this investigation can quote these. Quotes are checked word for word against the text you paste. Up to 8 sources.</p>
    {adding && <SourceForm onAdd={onAdd} onCancel={() => onAddingChange(false)}/>}
    {sources.map(s => {
      const n = investigation ? quotedBy(investigation, s.id) : 0;
      return <div className="source-card" key={s.id}>
        <div className="source-card-head"><strong>{s.title}</strong>
          <button type="button" className="icon-button danger" onClick={() => onRemove(s.id)} aria-label={`Remove ${s.title}`}><Trash2 size={15}/></button></div>
        <span className="muted small">{s.content.length.toLocaleString('en')} characters · {n ? `quoted by ${n} claim${n === 1 ? '' : 's'}` : 'not yet quoted'}</span>
        {s.url && <a className="small" href={s.url} target="_blank" rel="noopener noreferrer">{s.url.replace(/^https?:\/\//, '')}</a>}
        <details><summary className="small">Show text</summary><p className="source-text">{s.content}</p></details>
      </div>;
    })}
    {!sources.length && !adding && <div className="panel-empty">
      <p>No sources yet.</p>
      <p className="muted small">Without sources, answers can't quote evidence and every factual claim stays unverified.</p>
      <button type="button" className="button secondary" onClick={() => onAddingChange(true)}><Plus size={14}/> Add a source</button>
    </div>}
  </aside>;
}
