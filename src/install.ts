import { spawn } from "node:child_process";
import type { PackageManager } from "./types.js";

function installArgs(packageManager: PackageManager): string[] {
  switch (packageManager) {
    case "npm":
      return ["install"];
    case "pnpm":
      return ["install"];
    case "yarn":
      return ["install"];
    case "bun":
      return ["install"];
  }
}

export function manualInstallCommand(
  packageManager: PackageManager,
  targetDir: string,
): string {
  const quotedTarget = JSON.stringify(targetDir);
  switch (packageManager) {
    case "npm":
      return `cd ${quotedTarget} && npm install`;
    case "pnpm":
      return `cd ${quotedTarget} && pnpm install`;
    case "yarn":
      return `cd ${quotedTarget} && yarn install`;
    case "bun":
      return `cd ${quotedTarget} && bun install`;
  }
}

export async function installDependencies(
  packageManager: PackageManager,
  targetDir: string,
): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn(packageManager, installArgs(packageManager), {
      cwd: targetDir,
      stdio: "inherit",
    });

    child.once("error", () => resolve(1));
    child.once("close", (code) => {
      resolve(code ?? 1);
    });
  });
}
