import { useEffect, useLayoutEffect, type RefObject } from 'react';
import { ArrowUp, Plus, Square } from 'lucide-react';
import type { AnalysisMode, EvidenceSource } from '../lib/types';
import { DEPTHS, depthOf } from './depth';

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  mode: AnalysisMode;
  onModeChange: (mode: AnalysisMode) => void;
  busy: boolean;
  onStop: () => void;
  sources: EvidenceSource[];
  onOpenEvidence: (addNew: boolean) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  // Why asking is unavailable (blocked, out of tokens); null when it is available.
  blockedReason: string | null;
  placeholder: string;
  large?: boolean;
}

const MAX_HEIGHT = 240;

export function Composer(props: ComposerProps) {
  const { value, onChange, onSubmit, mode, onModeChange, busy, onStop, sources, onOpenEvidence, inputRef, blockedReason, placeholder, large } = props;
  const canSend = !busy && !blockedReason && value.trim().length >= 4;

  // Grow with the text up to a limit, then scroll.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [value, inputRef]);

  useEffect(() => { if (large) inputRef.current?.focus(); }, [large, inputRef]);

  return <form className={`composer${large ? ' composer-large' : ''}`} onSubmit={e => { e.preventDefault(); if (canSend) onSubmit(); }}>
    {!large && <div className="composer-sources">
      {sources.length ? <>
        <span className="muted">Using</span>
        {sources.slice(0, 3).map(s => <button type="button" key={s.id} className="source-chip" onClick={() => onOpenEvidence(false)}>{s.title}</button>)}
        {sources.length > 3 && <button type="button" className="source-chip" onClick={() => onOpenEvidence(false)}>+{sources.length - 3} more</button>}
      </> : <span className="muted">No sources: answers can't quote evidence.</span>}
      <button type="button" className="link-button" onClick={() => onOpenEvidence(true)}><Plus size={14}/> Add source</button>
    </div>}
    <label htmlFor="composer-input" className="visually-hidden">Your question</label>
    <textarea
      id="composer-input"
      ref={inputRef}
      value={value}
      rows={large ? 3 : 1}
      maxLength={3000}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (canSend) onSubmit(); }
      }}
    />
    <div className="composer-footer">
      {large ? <button type="button" className="dashed-button" onClick={() => onOpenEvidence(true)}><Plus size={14}/> {sources.length ? `Sources (${sources.length})` : 'Add a source to quote from'}</button>
        : <>
          <div className="segmented" role="radiogroup" aria-label="Depth">
            {DEPTHS.map(d => <button type="button" key={d.mode} role="radio" aria-checked={mode === d.mode} className={mode === d.mode ? 'segment selected' : 'segment'}
              title={`${d.summary} ${d.calls}.`} onClick={() => onModeChange(d.mode)}>{d.label}</button>)}
          </div>
          {/* Phones get a compact picker instead of the segmented control. */}
          <label className="depth-select"><span className="visually-hidden">Depth</span>
            <select value={mode} onChange={e => onModeChange(e.target.value as AnalysisMode)}>
              {DEPTHS.map(d => <option key={d.mode} value={d.mode}>{d.label}: {d.calls}</option>)}
            </select>
          </label>
        </>}
      <div className="composer-send">
        {!large && <span className="muted small depth-hint" title={depthOf(mode).calls}>{depthOf(mode).summary}</span>}
        {busy ? <button type="button" className="button secondary" onClick={onStop}><Square size={13}/> Stop</button>
          : <button type="submit" className="button primary" disabled={!canSend} title={blockedReason ?? 'Send (Enter). New line: Shift+Enter'}>Ask <ArrowUp size={15}/></button>}
      </div>
    </div>
    {blockedReason && <p className="composer-note" role="status">{blockedReason}</p>}
  </form>;
}
