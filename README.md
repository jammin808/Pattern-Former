# PATTERN-FORMER | Reasoning Workbench MVP

A standalone Vite/React + TypeScript application with a server-side model API (Anthropic Claude by default, Gemini optional), user-supplied evidence, structured claim ledger, independent adversarial review, and investigation history. This is a **working implementation candidate**, not a verified reasoning engine or a production-ready research platform.

## What's implemented

- **No browser API key:** Model calls run only in `api/analyze.ts` (also callable by the local Node dev server). Credentials come exclusively from the server environment: `ANTHROPIC_API_KEY` (preferred, uses Claude with structured outputs and server-side refusal fallback) or `GEMINI_API_KEY`.
- **Depth maps to effort:** on Claude, Light/Medium/Heavy runs use `low`/`medium`/`high` effort.
- **Three depth pipelines:** Light uses one analyst call. Medium adds an independent challenger call; Heavy/Adversarial additionally call an adjudicator. The challenger sees the initial question and supplied evidence, not the analyst's answer.
- **Structured claims and provenance:** The server normalises model-generated claims and only accepts citation IDs present in supplied evidence. Quoted text is compared against the actual pasted material.
- **Precise trust labels:** `quote-matched` means source text contains a quotation, **not** that the source is authentic or the claim is substantiated. `inferred` and `unverified` remain visibly distinct.
- **Interactive review:** Overview, claim ledger, challenge panel, relationship overview, source library, follow-up runs and JSON/Markdown export.
- **Google sign-in:** Users sign in with Google Identity Services. The server verifies the Google ID token and sets a signed, HttpOnly session cookie (7 days).
- **Per-user token limits:** Every analysis records its input and output tokens (including failed stages) against the user in Supabase. Each user has a monthly allowance (a default you set, or a per-user override), checked before each run. Admins (`ADMIN_EMAILS`) are not limited.
- **Admin page:** Admins see every user's usage this month and lifetime, can set per-user limits, change the default limit, and block or unblock accounts.
- **Persistence:** Up to 25 investigations and 12 results per investigation, kept in browser localStorage per signed-in user. Not synced or encrypted.
- **Initial automated tests** for claim normalisation, source allowlisting, source quotation checks and input validation.

## Requirements

Node.js 22 or newer, npm, and either an Anthropic API key (default model `claude-opus-5-5`, override with `ANTHROPIC_MODEL`) or a Gemini API key (`GEMINI_MODEL`).

## Sign-in and usage limits setup

1. **Google OAuth client.** In Google Cloud Console → APIs & Services → Credentials, create an *OAuth client ID* of type *Web application*. Under *Authorized JavaScript origins* add `https://pattern-former.vercel.app` and `http://localhost:3000` (and any other domain you serve from). No redirect URI is needed. Copy the client ID into `GOOGLE_CLIENT_ID`.
2. **Session secret.** Generate one with `openssl rand -base64 48` and set it as `SESSION_SECRET`. Changing it signs everyone out.
3. **Admins.** Set `ADMIN_EMAILS` to your Google email (comma-separate several).
4. **Database.** The schema in `supabase/migrations/` is already applied to the `pattern-former` Supabase project. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Supabase dashboard → Project Settings → API keys → `service_role` or a secret key). This key bypasses row-level security: keep it server-side only.
5. The default monthly allowance starts at 200,000 tokens per user; change it on the admin page.

## Local setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local and provide ANTHROPIC_API_KEY (or GEMINI_API_KEY). Server-side only.
npm run dev
```

Open http://localhost:3000. The Vite UI proxies `/api/analyze` to the local Node API at `127.0.0.1:8787`. The local server reads `.env.local` using `dotenv`. `npm run build` creates the static frontend bundle and checks TypeScript. `npm test` runs the pure logic tests. No API credentials are needed to run tests.

### Deploying to Vercel

1. Set `ANTHROPIC_API_KEY` (optionally `ANTHROPIC_MODEL`) — or `GEMINI_API_KEY`/`GEMINI_MODEL` — as **server environment variables** in Vercel. Never use a `VITE_`-prefixed key.
2. Use framework preset **Vite**, build command `npm run build` and output directory `dist`.
3. Vercel will serve the serverless `api/analyze.ts` endpoint alongside the static Vite app.
4. Validate deployment with a non-sensitive test query before inviting external users.

**Important:** Sign-in and monthly token limits bound what each Google account can spend, but anyone with a Google account can sign up and receive the default allowance. Keep the default modest, watch the admin page, and block accounts you don't recognise. There are no per-minute rate limits yet, and a limit is checked before a run starts, so concurrent runs can overshoot it. Model call costs increase with analysis depth.

## Privacy and evidence limits

- Uploaded text is sent to the configured model provider (Anthropic or Google) when a question is analysed. Avoid uploading sensitive or third-party confidential material without appropriate permission and policy review.
- Projects are stored in your current browser's `localStorage`, unencrypted. Clear browser site data to delete local copies. Export first if you want to retain a project.
- URLs are recorded as attribution metadata only. **They are not fetched or verified.** Claims are not externally fact-checked. Matching a string in supplied text is not validating its provenance, credibility, entailment or causal interpretation.
- The model may make mistakes, including inventing interpretations. The structured output schema limits shape, not truthfulness. Evidence labels represent workflow status, not a scientific probability.
- Server-side model errors are logged and surfaced to clients as generic errors without raw provider diagnostics.

## Repository migration

This application replaces the original AI Studio prototype. The superseded `constants.ts`, `types.ts`, `components/`, `metadata.json` and browser-based `services/geminiService.ts` have been removed; the previous version remains available in git history (commit `05ba197`).

## Suggested next release

1. Add per-minute rate limits, an atomic token reservation so concurrent runs cannot overshoot a limit, cost (not just token) reporting, and server-side storage of investigations.
2. Add a safe document ingestion pipeline (sandboxed parsing, size limits, source provenance, prompt-injection testing).
3. Integrate independently retrieved research with source-to-claim entailment checks and conflict analysis. Do not relabel `quote-matched` as verified.
4. Maintain immutable evidence snapshots per analysis run, and add explicit claim-to-claim dependency edges with revision propagation.
5. Build a blinded evaluation suite that compares direct Gemini, prompt-only PATTERN-FORMER and the staged workflow on truthfulness, calibration, correction and cost.
6. Add proper model compatibility discovery and provider adapters before replacing the model configuration default.

## Relevant code

- `lib/reasoning.ts`: provider selection (Anthropic/Gemini), model orchestration and structured analysis stages.
- `lib/claims.ts`: deterministic claim/evidence mapping and quote matching.
- `lib/schema.ts`: request and model-output schemas.
- `api/analyze.ts`: private model endpoint: sign-in check, limit check, validation, usage recording and safe errors.
- `api/auth/*`, `api/me.ts`, `api/admin.ts`, `lib/auth.ts`, `lib/db.ts`, `lib/account.ts`: Google sign-in, sessions, users, usage and admin controls.
- `supabase/migrations/`: database schema for users, usage events and settings.
- `App.tsx`: investigation workspace, claim inspection and exports.
- `tests/claims.test.ts`: baseline pure unit tests.

## Licence

No licence is included. The original repository had no detected licence. Confirm ownership and select appropriate licensing terms before distribution or publication beyond personal review.
