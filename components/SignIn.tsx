import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { Account } from '../lib/types';
import { getConfig, signInWithGoogle } from '../services/client';

// The subset of Google Identity Services used here.
interface GoogleIdentity {
  accounts: { id: {
    initialize(options: { client_id: string; callback: (response: { credential: string }) => void }): void;
    renderButton(element: HTMLElement, options: Record<string, string | number>): void;
  } };
}
declare global { interface Window { google?: GoogleIdentity } }

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: GSI_SRC, async: true });
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('Google sign-in could not be loaded. Check your connection or content blockers.')), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

export function SignIn({ onSignedIn, notice }: { onSignedIn: (account: Account) => void; notice?: string }) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | undefined>(notice);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { googleClientId } = await getConfig();
      if (!googleClientId) throw new Error('Google sign-in is not configured on the server (GOOGLE_CLIENT_ID).');
      await loadGoogleScript();
      if (cancelled || !window.google || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true); setError(undefined);
          try { onSignedIn(await signInWithGoogle(credential)); }
          catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.'); setBusy(false); }
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', width: 280 });
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Sign-in is unavailable.'); });
    return () => { cancelled = true; };
  }, [onSignedIn]);

  return <div className="auth-screen">
    <div className="auth-card">
      <div className="brand"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect width="28" height="28" rx="8" className="brand-tile"/><path d="M8 19 L14 9 L20 19 M10.5 15 H17.5" className="brand-mark" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg><strong>Pattern-Former</strong></div>
      <h1>Sign in to continue</h1>
      <p className="muted">Test claims, decisions and documents against your own evidence. Each account has a monthly token allowance.</p>
      <div className="google-button" ref={buttonRef} aria-busy={busy}/>
      {busy && <p className="muted small">Signing in…</p>}
      {error && <div className="banner warning" role="alert"><AlertTriangle size={16}/><span>{error}</span></div>}
      <p className="muted small">We store your Google name, email and picture, plus how many tokens each analysis used. Investigations stay in this browser.</p>
    </div>
  </div>;
}
