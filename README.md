# PATTERN-FORMER | Reasoning Workbench MVP

A standalone Vite/React + TypeScript application with a server-side Gemini API, user-supplied evidence, structured claim ledger, independent adversarial review, and investigation history. This is a **working implementation candidate**, not a verified reasoning engine or a production-ready research platform.

## What's implemented

- **No browser API key:** Gemini calls run only in `api/analyze.ts` (also callable by the local Node dev server). Credentials come exclusively from the server environment.
- **Three depth pipelines:** Light uses one analyst call. Medium adds an independent challenger call; Heavy/Adversarial additionally call an adjudicator. The challenger sees the initial question and supplied evidence, not the analyst's answer.
- **Structured claims and provenance:** The server normalises model-generated claims and only accepts citation IDs present in supplied evidence. Quoted text is compared against the actual pasted material.
- **Precise trust labels:** `quote-matched` means source text contains a quotation, **not** that the source is authentic or the claim is substantiated. `inferred` and `unverified` remain visibly distinct.
- **Interactive review:** Overview, claim ledger, challenge panel, relationship overview, source library, follow-up runs and JSON/Markdown export.
- **Persistence:** Up to 25 investigations and 12 results per investigation, kept in browser localStorage. Not synced or encrypted.
- **Initial automated tests** for claim normalisation, source allowlisting, source quotation checks and input validation.

## Requirements

Node.js 22 or newer, npm, a Gemini API key and a configured model that supports JSON output.

## Local setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local and provide GEMINI_API_KEY (server-side only).
npm run dev
```

Open http://localhost:3000. The Vite UI proxies `/api/analyze` to the local Node API at `127.0.0.1:8787`. The local server reads `.env.local` using `dotenv`. `npm run build` creates the static frontend bundle and checks TypeScript. `npm test` runs the pure logic tests. No API credentials are needed to run tests.

### Deploying to Vercel

1. Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) as **server environment variables** in Vercel. Never use `VITE_GEMINI_API_KEY`.
2. Use framework preset **Vite**, build command `npm run build` and output directory `dist`.
3. Vercel will serve the serverless `api/analyze.ts` endpoint alongside the static Vite app.
4. Validate deployment with a non-sensitive test query before inviting external users.

**Important:** This MVP has no user accounts, persistent server database, usage quotas, distributed rate limits, billing controls, cross-user isolation or production monitoring. Public deployment of a key-funded endpoint is **not recommended** until authentication, quotas and abuse controls are implemented. Model call costs increase with analysis depth.

## Privacy and evidence limits

- Uploaded text is sent to the Gemini API when a question is analysed. Avoid uploading sensitive or third-party confidential material without appropriate permission and policy review.
- Projects are stored in your current browser's `localStorage`, unencrypted. Clear browser site data to delete local copies. Export first if you want to retain a project.
- URLs are recorded as attribution metadata only. **They are not fetched or verified.** Claims are not externally fact-checked. Matching a string in supplied text is not validating its provenance, credibility, entailment or causal interpretation.
- The model may make mistakes, including inventing interpretations. The structured output schema limits shape, not truthfulness. Evidence labels represent workflow status, not a scientific probability.
- Server-side model errors are logged and surfaced to clients as generic errors without raw provider diagnostics.

## Repository migration

This application replaces the original AI Studio prototype. The superseded `constants.ts`, `types.ts`, `components/`, `metadata.json` and browser-based `services/geminiService.ts` have been removed; the previous version remains available in git history (commit `05ba197`).

## Suggested next release

1. Add accounts, authorization, per-user/per-project access policies, durable database storage, server-side audit logs and budget/usage limits.
2. Add a safe document ingestion pipeline (sandboxed parsing, size limits, source provenance, prompt-injection testing).
3. Integrate independently retrieved research with source-to-claim entailment checks and conflict analysis. Do not relabel `quote-matched` as verified.
4. Maintain immutable evidence snapshots per analysis run, and add explicit claim-to-claim dependency edges with revision propagation.
5. Build a blinded evaluation suite that compares direct Gemini, prompt-only PATTERN-FORMER and the staged workflow on truthfulness, calibration, correction and cost.
6. Add proper model compatibility discovery and provider adapters before replacing the model configuration default.

## Relevant code

- `lib/reasoning.ts`: model orchestration and structured analysis stages.
- `lib/claims.ts`: deterministic claim/evidence mapping and quote matching.
- `lib/schema.ts`: request and model-output schemas.
- `api/analyze.ts`: private Gemini endpoint, validation and safe errors.
- `App.tsx`: investigation workspace, claim inspection and exports.
- `tests/claims.test.ts`: baseline pure unit tests.

## Licence

No licence is included. The original repository had no detected licence. Confirm ownership and select appropriate licensing terms before distribution or publication beyond personal review.
