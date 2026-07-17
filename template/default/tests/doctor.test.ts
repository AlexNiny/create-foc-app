import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

function runDoctor(
  overrides: Record<string, string | undefined> = {},
  args: string[] = [],
) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        key !== "FOC_SMOKE_PRIVATE_KEY" &&
        key !== "FOC_WALLET_ADDRESS" &&
        key !== "NEXT_PUBLIC_FILECOIN_NETWORK" &&
        !/^NEXT_PUBLIC_.*(?:PRIVATE|SECRET|MNEMONIC|SEED)/i.test(key),
    ),
  );

  return spawnSync(process.execPath, [path.join("scripts", "foc-doctor.mjs"), ...args], {
    cwd: process.cwd(),
    env: {
      ...env,
      NEXT_PUBLIC_FILECOIN_NETWORK: "calibration",
      ...overrides,
      NODE_ENV: "test",
    },
    encoding: "utf8",
  });
}

test("doctor accepts a valid Calibration starter without live credentials", () => {
  const result = runDoctor();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /0 failure\(s\), 1 warning\(s\)/);
  assert.match(result.stdout, /PASS Network/);
});

test("doctor rejects unsupported networks", () => {
  const result = runDoctor({ NEXT_PUBLIC_FILECOIN_NETWORK: "unsupported" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Unsupported NEXT_PUBLIC_FILECOIN_NETWORK=unsupported/);
});

test("doctor rejects private keys exposed through public environment variables", () => {
  const result = runDoctor({ NEXT_PUBLIC_PRIVATE_KEY: "unsafe" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Remove public secret variables: NEXT_PUBLIC_PRIVATE_KEY/);
});

test("doctor rejects malformed server-only smoke credentials", () => {
  const result = runDoctor({ FOC_SMOKE_PRIVATE_KEY: "not-a-private-key" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /must be 0x followed by 64 hexadecimal characters/);
});

test("doctor rejects malformed public wallet addresses", () => {
  const result = runDoctor({ FOC_WALLET_ADDRESS: "not-an-address" });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FOC_WALLET_ADDRESS must be a 20-byte/);
});

test("doctor documents its read-only online mode", () => {
  const result = runDoctor({}, ["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--online/);
  assert.match(result.stdout, /read-only RPC/);
});
