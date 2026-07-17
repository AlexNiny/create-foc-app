# Generated project guidance

This is a `create-foc-app` Filecoin Onchain Cloud starter.

## Boundaries

- Keep raw Synapse SDK calls inside `lib/foc/adapter.ts` and the Node-only smoke script.
- Keep application-facing receipts JSON-safe; convert PieceCID objects and bigints at the adapter boundary.
- Browser wallet actions must remain explicit user actions.
- Never expose private keys through `NEXT_PUBLIC_*`, React props, logs, or browser bundles.
- `foc:doctor` must remain read-only. Transactions belong only in explicit app actions or `foc:smoke-test`.
- Calibration is the safe development default. Do not silently switch to Mainnet.

## Verification after changes

```bash
__PM_RUN__ foc:doctor
__PM_RUN__ lint
__PM_RUN__ typecheck
__PM_RUN__ test
__PM_RUN__ build
```

Run `__PM_RUN__ foc:smoke-test` only with a funded, disposable Calibration account.
