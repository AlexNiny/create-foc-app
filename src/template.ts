import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_TEMPLATE,
  PLACEHOLDERS,
  TEMPLATE_OVERRIDE_ENV,
  getPackageRoot,
} from "./constants.js";
import { CliError } from "./errors.js";
import type { AppTemplate, ScaffoldOptions } from "./types.js";

const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const TEXT_FILE_NAMES = new Set([
  ".env.example",
  ".gitignore",
  "AGENTS.md",
  "README.md",
]);

function mapEntryName(name: string): string {
  if (name === "gitignore") {
    return ".gitignore";
  }

  if (name === "env.example") {
    return ".env.example";
  }

  return name;
}

function replaceTokens(input: string, options: ScaffoldOptions): string {
  const packageManagerRun = options.packageManager === "yarn"
    ? "yarn"
    : `${options.packageManager} run`;

  return input
    .replaceAll(PLACEHOLDERS.projectName, options.projectName)
    .replaceAll(PLACEHOLDERS.network, options.network)
    .replaceAll(PLACEHOLDERS.packageManager, options.packageManager)
    .replaceAll(PLACEHOLDERS.packageManagerInstall, `${options.packageManager} install`)
    .replaceAll(PLACEHOLDERS.packageManagerRun, packageManagerRun);
}

function shouldTransformFile(destinationPath: string): boolean {
  const baseName = path.basename(destinationPath);
  if (TEXT_FILE_NAMES.has(baseName)) {
    return true;
  }

  return TEXT_FILE_EXTENSIONS.has(path.extname(destinationPath));
}

export function resolveTemplateDir(
  fromUrl: string,
  template: AppTemplate = DEFAULT_TEMPLATE,
): string {
  const override = process.env[TEMPLATE_OVERRIDE_ENV];
  if (process.env.NODE_ENV === "test" && override) {
    return path.resolve(override);
  }

  const directory = template === "react" ? "react" : "default";
  return path.join(getPackageRoot(fromUrl), "template", directory);
}

async function copyEntry(
  sourcePath: string,
  destinationPath: string,
  options: ScaffoldOptions,
): Promise<void> {
  const entry = await fs.lstat(sourcePath);
  if (entry.isSymbolicLink()) {
    throw new CliError(`Refusing to copy symlinked template entry: ${sourcePath}`);
  }

  if (entry.isDirectory()) {
    await fs.mkdir(destinationPath, { recursive: true });
    const children = await fs.readdir(sourcePath);
    for (const child of children) {
      const mappedName = replaceTokens(mapEntryName(child), options);
      await copyEntry(
        path.join(sourcePath, child),
        path.join(destinationPath, mappedName),
        options,
      );
    }
    return;
  }

  if (shouldTransformFile(destinationPath)) {
    const raw = await fs.readFile(sourcePath, "utf8");
    await fs.writeFile(destinationPath, replaceTokens(raw, options), "utf8");
    return;
  }

  await fs.copyFile(sourcePath, destinationPath);
}

export async function scaffoldProject(
  templateDir: string,
  options: ScaffoldOptions,
): Promise<void> {
  await fs.mkdir(options.targetDir, { recursive: true });
  const entries = await fs.readdir(templateDir);

  for (const entry of entries) {
    const mappedName = replaceTokens(mapEntryName(entry), options);
    await copyEntry(
      path.join(templateDir, entry),
      path.join(options.targetDir, mappedName),
      options,
    );
  }
}
