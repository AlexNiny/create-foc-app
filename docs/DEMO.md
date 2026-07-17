# Demo guide

## Deterministic demo

This path requires no wallet and proves the tool, package, generated project, diagnostics, tests, and production build.

```bash
npm install
npm run build
node dist/cli.js create-foc-demo --no-install
cd create-foc-demo
npm install
npm run foc:doctor
npm run foc:doctor:online
npm run check
```

Show:

1. the empty directory before generation;
2. the single CLI command;
3. generated `lib/foc/adapter.ts` and scripts;
4. the offline and read-only online doctor reports;
5. the running dashboard and successful production build.

## Live Calibration demo

Prepare a disposable wallet with Calibration tFIL and tUSDFC.

```bash
cp .env.example .env.local
# Set FOC_SMOKE_PRIVATE_KEY in .env.local
npm run foc:smoke-test
```

For the browser flow:

1. set the wallet to Calibration;
2. connect it in the generated app;
3. prepare Filecoin Pay funding and approval;
4. store the default payload;
5. point out the PieceCID and two provider/dataset receipts;
6. retrieve and show byte-for-byte verification.

Do not show `.env.local`, terminal history containing credentials, or wallet private keys in a recording.

## Suggested 90-second video

- 0–15s: empty directory → run `npm create foc-app@latest demo`.
- 15–30s: `foc:doctor` shows safe configuration.
- 30–45s: open the generated dashboard and connect the wallet.
- 45–65s: prepare and upload two copies.
- 65–80s: highlight PieceCID, Provider IDs, and Dataset IDs.
- 80–90s: retrieve, verify, and close on “zero to verifiable Filecoin app in one command.”
