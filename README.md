<p align="center">
  <img src="https://raw.githubusercontent.com/AlexNiny/create-foc-app/master/assets/logo.png" alt="create-foc-app logo" width="240" />
</p>

# create-foc-app

[![npm version](https://img.shields.io/npm/v/create-foc-app.svg)](https://www.npmjs.com/package/create-foc-app)
[![npm downloads](https://img.shields.io/npm/dm/create-foc-app.svg)](https://www.npmjs.com/package/create-foc-app)
[![license](https://img.shields.io/npm/l/create-foc-app.svg)](LICENSE)

Scaffold a working Filecoin Onchain Cloud application in one command.

[`create-foc-app`](https://www.npmjs.com/package/create-foc-app) is a FOC-native developer utility built for the FilecoinTLDR Builder Challenge Cycle 3. It generates Next.js or Vite + React TypeScript starters with a real Synapse SDK integration, safe wallet handling, Filecoin Pay readiness, multi-provider storage receipts, retrieval verification, and an offline-first `foc:doctor`.

## Quick start

```bash
npx create-foc-app@latest my-app
cd my-app
npm run foc:doctor
npm run dev
```

Requires Node.js 20.10 or newer. Calibration is the default network. The generated browser app uses an injected wallet and never embeds a private key in client code.

Next.js is the default template. Generate a Vite + React project explicitly:

```bash
npx create-foc-app@latest my-react-app --template react
```

You can also use the npm initializer form:

```bash
npm create foc-app@latest my-app
```

Choose a template, network, and package manager explicitly when needed:

```bash
npx create-foc-app@latest my-app \
  --template react \
  --network calibration \
  --package-manager pnpm \
  --git
```

## What gets generated

- Next.js App Router by default, or Vite + React with `--template react`
- `@filoz/synapse-sdk` and `viem`
- Browser-wallet connection with Calibration/Mainnet configuration
- Explicit storage preparation through Filecoin Pay
- Two-copy Filecoin Onchain Cloud uploads
- JSON-safe receipts with PieceCID, provider, dataset, and piece identifiers
- Retrieval and byte-for-byte verification
- `npm run foc:doctor` for safe offline readiness checks
- `npm run foc:doctor:online` for read-only RPC, chain ID, and balance checks
- `npm run foc:smoke-test` for an explicit, funded Calibration upload/retrieval test
- Tests, ESLint, type checking, a production build, and AI-agent guidance

## CLI

```text
npx create-foc-app@latest [target-directory] [options]

-y, --yes                         Use safe defaults
--no-install                      Skip dependency installation
--skip-install                    Alias for --no-install
--git / --no-git                 Enable or skip Git initialization
--package-manager <name>          npm | pnpm | yarn | bun
--network <name>                  calibration | mainnet
--template <name>                 next | react (default: next)
-h, --help                        Show help
-v, --version                     Show version
```

The CLI refuses to overwrite a non-empty directory. If dependency installation fails, generated files remain intact and the CLI prints a manual recovery command.

## Why this is not another upload demo

The product is the developer workflow, not the sample upload screen. A fresh project receives:

1. environment and secret-safety diagnostics;
2. wallet and payment-readiness guidance;
3. a narrow, reusable Synapse adapter;
4. structured multi-provider storage receipts; and
5. an end-to-end retrieval integrity check.

This makes Filecoin's storage, payment, provider, dataset, and verification primitives understandable and reusable in a new application.

## Development

Run the CLI directly from this repository:

```bash
npm install
npm run build
node dist/cli.js my-app --no-install
npm run typecheck
npm test
npm pack --dry-run
npm run test:e2e
```

CI validates Node.js 20 and 22, audits dependencies, and installs the packed tarball into clean Next.js and React consumers before running both generated projects' full check suites. The live smoke test remains excluded because it needs a funded Calibration wallet and external storage providers.

## Security model

- Browser flows use the wallet's EIP-1193 provider.
- Optional CLI smoke tests read `FOC_SMOKE_PRIVATE_KEY` only in Node.js.
- The generated doctor rejects public private-key environment variables.
- Local `.env` files are ignored; only `.env.example` is committed.
- Mainnet is never used by the live smoke test.

## License

MIT
