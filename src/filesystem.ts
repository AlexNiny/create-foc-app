import fs from "node:fs/promises";
import path from "node:path";
import { CliError } from "./errors.js";

export async function assertTemplateExists(templateDir: string): Promise<void> {
  try {
    const stat = await fs.stat(templateDir);
    if (!stat.isDirectory()) {
      throw new CliError(`Template path is not a directory: ${templateDir}`);
    }
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }

    throw new CliError(
      `Embedded template not found at ${templateDir}. Reinstall create-foc-app and try again.`,
    );
  }
}

export async function assertTargetDirectoryEmpty(
  targetDir: string,
): Promise<void> {
  try {
    const stat = await fs.stat(targetDir);
    if (!stat.isDirectory()) {
      throw new CliError(`Target exists and is not a directory: ${targetDir}`);
    }

    const entries = await fs.readdir(targetDir);
    if (entries.length > 0) {
      throw new CliError(
        `Target directory is not empty: ${targetDir}. Refusing to overwrite existing files.`,
      );
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const parentDir = path.dirname(targetDir);
      await fs.mkdir(parentDir, { recursive: true });
      return;
    }

    throw error;
  }
}
