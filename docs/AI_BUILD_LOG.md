# AI build log

## Ideation

The initial idea was a `create-next-app`-style utility for Filecoin. AI-assisted challenge research identified three constraints that shaped the product:

- the challenge explicitly asks for a tool, adapter, or developer utility;
- meaningful Filecoin use and a working demo carry 55% of judging weight;
- an older `create-filecoin-app` already exists, so a generic Filecoin starter would not be distinctive.

The idea was narrowed to a Filecoin Onchain Cloud-native generator with a concrete success metric: a developer should reach a verifiable multi-provider upload in five minutes.

## Planning

AI agents independently analyzed acceptance criteria and architecture. The resulting plan separated the publishable CLI from its embedded Next.js template, made Calibration the default, isolated Synapse SDK calls behind one adapter, and split offline CI from a funded live smoke test.

A critic rejected the first plan because it tested the source-tree CLI instead of the packed npm artifact and did not define the normalized receipt. The plan was amended to require a clean consumer tarball install and an explicit `FocReceipt` contract, then approved.

## Implementation

Parallel implementation produced:

- a dependency-free TypeScript CLI using Node built-ins;
- safe target validation, template rendering, package-manager execution, and install recovery;
- package-manager detection, safe shell recovery output, and optional Git initialization;
- a Next.js starter using Synapse SDK 1.1.0 and viem;
- a browser-wallet prepare/upload/retrieve/verify workflow;
- offline `foc:doctor` diagnostics and an opt-in Calibration smoke test;
- a read-only online doctor mode for RPC, chain ID, SDK compatibility, and balance checks;
- CLI, verification, build, packaging, and generated-consumer tests.

The actual published Synapse package was inspected to confirm current `prepare`, `upload`, `download`, `UploadResult`, and `CopyResult` types rather than relying on memory or pseudocode.

## Debugging and validation

The project is validated at two levels:

1. Root CLI build, typecheck, unit/integration tests, and npm package contents.
2. A freshly generated consumer project that installs dependencies and runs doctor, lint, typecheck, tests, and a production Next.js build.

GitHub Actions repeats these checks on Node.js 20 and 22, while Dependabot tracks npm and workflow dependency updates. Future release publishing is gated on the same checks and requests npm provenance.

The live Calibration test remains explicit because it requires external providers and a funded wallet. No live-network success is claimed unless that command is run and its receipt is preserved.
