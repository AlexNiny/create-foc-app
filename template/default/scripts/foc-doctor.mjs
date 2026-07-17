#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const results = [];

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

if (env.FOC_SMOKE_PRIVATE_KEY) report("PASS", "Live smoke test", "Server-only Calibration credential is available.");
else report("WARN", "Live smoke test", "FOC_SMOKE_PRIVATE_KEY is absent; offline checks still work.");

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
