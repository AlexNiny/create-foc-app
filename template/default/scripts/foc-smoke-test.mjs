#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Synapse, calibration } from "@filoz/synapse-sdk";
import { privateKeyToAccount } from "viem/accounts";

function loadLocalEnv() {
  const filePath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function normalize(result) {
  return {
    pieceCid: result.pieceCid.toString(),
    size: result.size,
    complete: result.complete,
    requestedCopies: result.requestedCopies,
    copies: result.copies.map((copy) => ({
      providerId: copy.providerId.toString(),
      dataSetId: copy.dataSetId.toString(),
      pieceId: copy.pieceId.toString(),
      role: copy.role,
      retrievalUrl: copy.retrievalUrl,
    })),
    failedAttempts: result.failedAttempts.map((attempt) => ({
      providerId: attempt.providerId.toString(),
      role: attempt.role,
      error: attempt.error,
    })),
  };
}

function equalBytes(left, right) {
  return left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);
}

loadLocalEnv();

if ((process.env.NEXT_PUBLIC_FILECOIN_NETWORK || "calibration") !== "calibration") {
  console.error("Refusing to run: foc:smoke-test is Calibration-only.");
  process.exit(1);
}

const privateKey = process.env.FOC_SMOKE_PRIVATE_KEY;
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  console.error("Set a funded Calibration-only FOC_SMOKE_PRIVATE_KEY in .env.local.");
  console.error("The account needs tFIL for gas and tUSDFC for storage.");
  process.exit(1);
}

const payload = new TextEncoder().encode(
  "create-foc-app deterministic live Calibration smoke payload v1 ".padEnd(256, "."),
);
const account = privateKeyToAccount(privateKey);
const synapse = Synapse.create({ account, chain: calibration, source: "create-foc-app-smoke" });

console.log(`Preparing ${payload.byteLength} bytes for ${account.address} on Calibration...`);
const prepared = await synapse.storage.prepare({ dataSize: BigInt(payload.byteLength) });
if (prepared.transaction) {
  const { hash } = await prepared.transaction.execute({ onHash: (txHash) => console.log(`Funding transaction: ${txHash}`) });
  console.log(`Funding confirmed: ${hash}`);
} else {
  console.log("Account is already funded and approved.");
}

const upload = await synapse.storage.upload(payload, {
  copies: 2,
  pieceMetadata: { filename: "create-foc-app-smoke.txt", contentType: "text/plain" },
});
const receipt = normalize(upload);
console.log(`Stored ${receipt.copies.length}/${receipt.requestedCopies} copies as ${receipt.pieceCid}.`);

const downloaded = await synapse.storage.download({ pieceCid: upload.pieceCid });
const verified = equalBytes(downloaded, payload);
const report = { network: "calibration", verified, ...receipt };

console.log(verified ? "Retrieval verified byte for byte." : "Retrieved content mismatch.");
console.log(`FOC_SMOKE_RESULT=${JSON.stringify(report)}`);
if (!verified || !receipt.complete) process.exitCode = 1;
