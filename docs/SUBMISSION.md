# FilecoinTLDR Cycle 3 submission guide

## Positioning

**Title:** create-foc-app

**Short description:** A create-next-app-style CLI that generates a safe, production-shaped Filecoin Onchain Cloud application with wallet setup, Filecoin Pay readiness, multi-provider storage receipts, retrieval verification, diagnostics, tests, and an optional live Calibration smoke test.

## Judging-criteria mapping

- **Meaningful Filecoin use (30%)** — Synapse SDK, Filecoin Pay preparation, USDFC funding/approval, two storage providers, PieceCID, datasets, pieces, retrieval, and byte verification.
- **Working demo quality (25%)** — one command generates an app that installs, diagnoses, tests, builds, and performs the complete live flow.
- **Creativity/usefulness (20%)** — the product removes integration friction and catches unsafe/missing configuration; it is not another upload page.
- **AI-guided process (10%)** — link `docs/AI_BUILD_LOG.md` and retain the planning artifacts.
- **Clarity/public showcase (15%)** — use the deterministic demo script and a short live Calibration video.

## Required submission items

- Project title
- Short description
- Live demo link
- Public repository link
- Explanation of FOC/Filecoin usage
- Short AI build log
- Public X post link

## X post checklist

- Include the live demo link.
- Include a screenshot or short demo video.
- Tag `@Filecoin` and `@FilecoinTLDR`.
- State the developer outcome, not just the technology.

Suggested copy:

> I built create-foc-app: one command to generate a working Filecoin Onchain Cloud app with wallet setup, Filecoin Pay readiness, multi-provider receipts, retrieval verification, and foc:doctor. From zero to verifiable storage in five minutes. [demo] [repo] @Filecoin @FilecoinTLDR

## Evidence to capture before submission

- npm package or installable tarball
- clean `npm pack --dry-run` output
- root test output
- generated project doctor/lint/typecheck/test/build output
- live Calibration `FOC_SMOKE_RESULT` receipt
- PieceCID, provider IDs, and dataset IDs visible in the demo
