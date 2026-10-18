# Implementation status and acceptance checklist

Scope: Reviewable MVP, based on a code-level analysis of the Pattern-Former repository `main` as of 17 October 2026.

## Implemented

- [x] Server-held Gemini credential; no browser `VITE_` API key substitution
- [x] API payload length/type/schema validation and generic provider errors
- [x] Configurable Gemini model
- [x] 1/2/3-stage model workflow for Light / Medium / Heavy or Adversarial
- [x] Independent challenger not shown analyst draft before generating objections
- [x] Structured claim ledger with deterministic source-ID allowlist and literal quotation matching
- [x] Prominent indication that literal matches do not establish factual validity
- [x] Interactive tabs for synthesis, claims, adversarial objections, structure and source text
- [x] Saved investigations and versioned results using browser localStorage
- [x] Export entire investigation to Markdown and JSON
- [x] Tests for quote matching, source handling and input limits
- [x] CI workflow definition

## Not yet implemented

- [x] Dependency install, `npm run typecheck`, `npm test` (4/4) and `npm run build` pass
- [ ] Live Gemini API integration test (requires an API key)
- [ ] Automated retrieval of external evidence, authenticated source provenance, or substantive entailment checking
- [ ] True claim-to-claim dependency edges and automatic revision propagation
- [ ] User accounts and server-side durable storage, permissions, quotas, abuse prevention
- [ ] Uploading PDFs, extracting tables, file parsing and document safety sandboxing
- [ ] Multi-model adapters, model registry or model price comparison
- [ ] Benchmark suite measuring accuracy improvement over the baseline
- [ ] Editable graph canvas or real-time collaboration
- [ ] Live deployed preview

## Checks performed on import

- Node.js 22: `npm install`, `npm run typecheck`, `npm test` and `npm run build` all pass
- Built client bundle contains no reference to `GEMINI_API_KEY`
- Local API server starts; `/api/health` responds and `/api/analyze` returns 503 when no key is configured
- Live model calls not exercised (no API key available)

## Recommended acceptance sequence on developer machine

1. Unzip and open project.
2. `npm install`
3. `npm run typecheck && npm test && npm run build`
4. Copy `.env.example` to `.env.local`; set a valid `GEMINI_API_KEY`.
5. `npm run dev`
6. Test Light/Medium/Heavy flows with questions both with and without supplied excerpts.
7. Test that fabricated citations remain unverified and that no Gemini key appears in client bundles.
8. Before public deployment, add authentication, quotas and rate limits.
