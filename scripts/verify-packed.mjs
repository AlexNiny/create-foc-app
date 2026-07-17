#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const root = process.cwd();
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function run(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}.`));
    });
  });
}

const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "create-foc-app-e2e-"));

try {
  await run(npmCommand, ["pack", "--silent", "--pack-destination", temporaryRoot], root);
  const tarballName = (await fs.readdir(temporaryRoot)).find((entry) => entry.endsWith(".tgz"));
  if (!tarballName) throw new Error("npm pack did not produce a tarball.");

  const consumerDir = path.join(temporaryRoot, "consumer");
  const generatedDir = path.join(consumerDir, "generated-app");
  await fs.mkdir(consumerDir);
  await fs.writeFile(
    path.join(consumerDir, "package.json"),
    JSON.stringify({ name: "create-foc-app-e2e-consumer", private: true }, null, 2),
    "utf8",
  );

  await run(npmCommand, ["install", path.join(temporaryRoot, tarballName)], consumerDir);
  await run(
    process.execPath,
    [
      path.join(consumerDir, "node_modules", "create-foc-app", "dist", "cli.js"),
      "generated-app",
      "--no-install",
      "--no-git",
    ],
    consumerDir,
  );
  await run(npmCommand, ["install"], generatedDir);
  await run(npmCommand, ["run", "check"], generatedDir);
  if (process.env.CREATE_FOC_APP_VERIFY_ONLINE === "1") {
    await run(npmCommand, ["run", "foc:doctor:online"], generatedDir);
  }
  console.log("Packed consumer verification passed.");
} finally {
  await fs.rm(temporaryRoot, { recursive: true, force: true });
}
