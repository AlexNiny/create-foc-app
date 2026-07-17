#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const results = [];
const supportedSynapseVersion = "1.1.0";
const privateKeyPattern = /^0x[0-9a-fA-F]{64}$/;
const cliArgs = process.argv.slice(2);
const online = cliArgs.includes("--online");

if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
  console.log("Usage: foc:doctor [--online]");
  console.log("  --online  Add read-only RPC, chain ID, and wallet balance checks.");
  process.exit(0);
}

const unknownArgs = cliArgs.filter((arg) => arg !== "--online");

function report(level, label, detail) {
  results.push({ level, label, detail });
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
      }),
  );
}

const envFiles = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
  ".env.production",
  ".env.production.local",
  ".env.test",
  ".env.test.local",
];
const fileEnv = Object.assign({}, ...envFiles.map((file) => parseEnvFile(path.join(root, file))));
const env = { ...fileEnv, ...process.env };

if (unknownArgs.length > 0) {
  report("FAIL", "Arguments", `Unknown option(s): ${unknownArgs.join(", ")}`);
}

const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
if (nodeMajor > 20 || (nodeMajor === 20 && nodeMinor >= 10)) report("PASS", "Node.js", process.version);
else report("FAIL", "Node.js", `Found ${process.version}; Node 20.10+ is required.`);

const requiredFiles = ["package.json", "app/page.tsx", "lib/foc/adapter.ts", ".env.example"];
const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missingFiles.length === 0) report("PASS", "Starter files", "All required generated files are present.");
else report("FAIL", "Starter files", `Missing: ${missingFiles.join(", ")}`);

let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const dependencies = packageJson.dependencies ?? {};
  const missingDependencies = ["@filoz/synapse-sdk", "viem", "next"].filter((name) => !dependencies[name]);
  if (missingDependencies.length === 0) report("PASS", "FOC dependencies", "Synapse SDK, viem, and Next.js are declared.");
  else report("FAIL", "FOC dependencies", `Missing: ${missingDependencies.join(", ")}`);

  try {
    const installedSdk = JSON.parse(
      fs.readFileSync(path.join(root, "node_modules", "@filoz", "synapse-sdk", "package.json"), "utf8"),
    );
    if (installedSdk.version === supportedSynapseVersion) {
      report("PASS", "Synapse compatibility", `Installed supported SDK ${installedSdk.version}.`);
    } else {
      report("WARN", "Synapse compatibility", `Tested with ${supportedSynapseVersion}; found ${installedSdk.version}. Run the full check suite.`);
    }
  } catch {
    report("WARN", "Synapse compatibility", "Dependencies are not installed; installed SDK version was not checked.");
  }
} catch (error) {
  report("FAIL", "package.json", error instanceof Error ? error.message : String(error));
}

const network = env.NEXT_PUBLIC_FILECOIN_NETWORK || "__FOC_NETWORK__";
if (network === "calibration") report("PASS", "Network", "Calibration testnet (safe default).");
else if (network === "mainnet") report("WARN", "Network", "Mainnet selected. Transactions spend real assets.");
else report("FAIL", "Network", `Unsupported NEXT_PUBLIC_FILECOIN_NETWORK=${network}`);

const publicSecretKeys = Object.keys(env).filter((key) =>
  /^NEXT_PUBLIC_.*(?:PRIVATE(?:_KEY)?|SECRET(?:_KEY)?|MNEMONIC|SEED(?:_PHRASE)?)/i.test(key),
);
if (publicSecretKeys.length === 0) report("PASS", "Secret boundary", "No public private-key variables detected.");
else report("FAIL", "Secret boundary", `Remove public secret variables: ${publicSecretKeys.join(", ")}`);

const privateKey = env.FOC_SMOKE_PRIVATE_KEY;
const walletAddress = env.FOC_WALLET_ADDRESS;
if (walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
  report("FAIL", "Wallet address", "FOC_WALLET_ADDRESS must be a 20-byte 0x-prefixed hexadecimal address.");
} else if (walletAddress) {
  report("PASS", "Wallet address", "A public address is available for read-only balance checks.");
}
if (!privateKey) report("WARN", "Live smoke test", "FOC_SMOKE_PRIVATE_KEY is absent; offline checks still work.");
else if (privateKeyPattern.test(privateKey)) report("PASS", "Live smoke test", "A valid server-only Calibration credential format is available.");
else report("FAIL", "Live smoke test", "FOC_SMOKE_PRIVATE_KEY must be 0x followed by 64 hexadecimal characters.");

async function runOnlineChecks() {
  if (network !== "calibration" && network !== "mainnet") return;

  const [{ Synapse, TOKENS, calibration, formatUnits, mainnet }, { createPublicClient, custom, http, isAddress }, { privateKeyToAccount }] = await Promise.all([
    import("@filoz/synapse-sdk"),
    import("viem"),
    import("viem/accounts"),
  ]);
  const chain = network === "mainnet" ? mainnet : calibration;
  const client = createPublicClient({ chain, transport: http() });

  try {
    const chainId = await client.getChainId();
    if (chainId !== chain.id) {
      report("FAIL", "RPC chain ID", `Expected ${chain.id}; RPC returned ${chainId}.`);
      return;
    }
    report("PASS", "RPC connectivity", `${chain.name} responded with chain ID ${chainId}.`);
  } catch (error) {
    report("FAIL", "RPC connectivity", error instanceof Error ? error.message : String(error));
    return;
  }

  try {
    let account;
    if (walletAddress && isAddress(walletAddress)) {
      account = walletAddress;
    } else if (privateKey && privateKeyPattern.test(privateKey) && network === "calibration") {
      account = privateKeyToAccount(privateKey);
    } else {
      report("WARN", "Wallet balances", "Set public FOC_WALLET_ADDRESS to check FIL and USDFC balances without a private key.");
      return;
    }

    const transport = typeof account === "string"
      ? custom({ request: ({ method, params }) => client.request({ method, params }) })
      : undefined;
    const synapse = Synapse.create({
      account,
      chain,
      ...(transport ? { transport } : {}),
      source: "create-foc-app-doctor",
    });
    const [filBalance, usdfcBalance] = await Promise.all([
      synapse.payments.walletBalance({ token: TOKENS.FIL }),
      synapse.payments.walletBalance({ token: TOKENS.USDFC }),
    ]);
    report(
      "PASS",
      "Wallet balances",
      `${typeof account === "string" ? account : account.address}: ${formatUnits(filBalance, 18)} ${network === "calibration" ? "tFIL" : "FIL"}, ${formatUnits(usdfcBalance, 18)} ${network === "calibration" ? "tUSDFC" : "USDFC"}.`,
    );
    if (network === "calibration" && (filBalance === 0n || usdfcBalance === 0n)) {
      report("WARN", "Calibration funding", "A required balance is zero. Funding guide: https://docs.filecoin.cloud/getting-started/");
    } else if (network === "calibration") {
      report("PASS", "Calibration funding", "Both tFIL gas and tUSDFC storage balances are available.");
    }
  } catch (error) {
    report("FAIL", "Wallet balances", error instanceof Error ? error.message : String(error));
  }
}

if (online) {
  await runOnlineChecks();
}

console.log("\nFilecoin Onchain Cloud Doctor\n");
for (const result of results) {
  const icon = result.level === "PASS" ? "✓" : result.level === "WARN" ? "!" : "✕";
  console.log(`${icon} ${result.level.padEnd(4)} ${result.label}`);
  console.log(`       ${result.detail}`);
}

const failures = results.filter((result) => result.level === "FAIL").length;
const warnings = results.filter((result) => result.level === "WARN").length;
console.log(`\n${failures} failure(s), ${warnings} warning(s).`);
process.exitCode = failures > 0 ? 1 : 0;
