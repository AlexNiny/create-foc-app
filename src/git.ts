import { spawn } from "node:child_process";

export async function initializeGitRepository(targetDir: string): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const child = spawn("git", ["init", "--quiet"], {
      cwd: targetDir,
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("close", (code) => resolve(code === 0));
  });
}
