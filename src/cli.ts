#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { formatHelp, parseArgs } from "./args.js";
import { assertTargetDirectoryEmpty, assertTemplateExists } from "./filesystem.js";
import { initializeGitRepository } from "./git.js";
import { manualInstallCommand, installDependencies, shellQuote } from "./install.js";
import { readPackageVersion } from "./package-json.js";
import { validateProjectName } from "./project-name.js";
import { promptForProjectName } from "./prompt.js";
import { resolveTemplateDir, scaffoldProject } from "./template.js";
import { CliError } from "./errors.js";
import type { CliOptions } from "./types.js";

function relativeTarget(targetDir: string): string {
  const relative = path.relative(process.cwd(), targetDir);
  return relative && !relative.startsWith("..") ? relative : targetDir;
}

async function resolveProjectName(options: CliOptions): Promise<string> {
  if (options.target) {
    return options.target;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CliError(
      "Target directory is required in non-interactive mode. Pass a directory name or use --yes.",
    );
  }

  return await promptForProjectName();
}

function formatRunScriptCommand(
  packageManager: CliOptions["packageManager"],
  scriptName: string,
): string {
  switch (packageManager) {
    case "npm":
    case "pnpm":
    case "bun":
      return `${packageManager} run ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
  }
}

export async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(formatHelp());
    return;
  }

  if (options.version) {
    console.log(await readPackageVersion(import.meta.url));
    return;
  }

  const requestedTarget = await resolveProjectName(options);
  const targetDir = path.resolve(process.cwd(), requestedTarget);
  const projectName = path.basename(targetDir);

  const validationError = validateProjectName(projectName);
  if (validationError) {
    throw new CliError(validationError);
  }

  await assertTargetDirectoryEmpty(targetDir);

  const templateDir = resolveTemplateDir(import.meta.url);
  await assertTemplateExists(templateDir);

  await scaffoldProject(templateDir, {
    targetDir,
    projectName,
    network: options.network,
    packageManager: options.packageManager,
  });

  console.log(`Scaffolded ${projectName} at ${relativeTarget(targetDir)}.`);

  if (options.initializeGit) {
    const initialized = await initializeGitRepository(targetDir);
    console.log(initialized ? "Initialized an empty Git repository." : "Skipped Git initialization because git is unavailable.");
  } else {
    console.log("Skipped Git initialization.");
  }

  if (!options.install) {
    console.log("Skipped dependency installation.");
    console.log(
      `Next: ${manualInstallCommand(options.packageManager, relativeTarget(targetDir))}`,
    );
    return;
  }

  console.log(`Installing dependencies with ${options.packageManager}...`);
  const installCode = await installDependencies(options.packageManager, targetDir);
  if (installCode !== 0) {
    console.error("");
    console.error("Dependency installation failed. Generated files were preserved.");
    console.error(`Run this manually: ${manualInstallCommand(options.packageManager, targetDir)}`);
    process.exitCode = installCode;
    return;
  }

  console.log("");
  console.log("Success.");
  console.log(
    `Next: cd ${shellQuote(relativeTarget(targetDir))} && ${formatRunScriptCommand(options.packageManager, "foc:doctor")}`,
  );
}

async function main(): Promise<void> {
  try {
    await run();
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = error.exitCode;
      return;
    }

    if (error instanceof Error) {
      console.error(`Unexpected error: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    console.error("Unexpected non-error failure.");
    process.exitCode = 1;
  }
}

await main();
