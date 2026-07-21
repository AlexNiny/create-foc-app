import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

import { detectPackageManager, formatHelp, parseArgs } from "../dist/args.js";
import { assertTargetDirectoryEmpty, assertTemplateExists } from "../dist/filesystem.js";
import { initializeGitRepository } from "../dist/git.js";
import { manualInstallCommand, shellQuote } from "../dist/install.js";
import { validateProjectName } from "../dist/project-name.js";
import { scaffoldProject, resolveTemplateDir } from "../dist/template.js";

const fixtureTemplate = path.resolve("test/fixtures/template");

async function makeTempDir(prefix = "create-foc-app-") {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("parseArgs applies defaults and flags", () => {
  assert.deepEqual(parseArgs(["demo"], "npm"), {
    target: "demo",
    yes: false,
    install: true,
    initializeGit: true,
    packageManager: "npm",
    network: "calibration",
    template: "next",
    help: false,
    version: false,
  });

  assert.deepEqual(
    parseArgs([
      "--yes",
      "--skip-install",
      "--no-git",
      "--package-manager",
      "pnpm",
      "--network",
      "mainnet",
    ]),
    {
      target: "foc-app",
      yes: true,
      install: false,
      initializeGit: false,
      packageManager: "pnpm",
      network: "mainnet",
      template: "next",
      help: false,
      version: false,
    },
  );
});

test("parseArgs selects the React template explicitly", () => {
  assert.equal(parseArgs(["demo", "--template", "react"]).template, "react");
  assert.throws(
    () => parseArgs(["demo", "--template", "vue"]),
    /Unsupported template "vue"\. Expected next or react/,
  );
});

test("detectPackageManager recognizes common npm user agents", () => {
  assert.equal(detectPackageManager("pnpm/10.0.0 npm/? node/v22"), "pnpm");
  assert.equal(detectPackageManager("yarn/4.1.0 npm/? node/v22"), "yarn");
  assert.equal(detectPackageManager("unknown/1.0"), "npm");
});

test("formatHelp includes primary flags", () => {
  const help = formatHelp();
  assert.match(help, /--package-manager <name>/);
  assert.match(help, /--network <name>/);
  assert.match(help, /--template <name>/);
  assert.match(help, /--git \/ --no-git/);
  assert.match(help, /--no-install, --skip-install/);
});

test("validateProjectName rejects invalid names", () => {
  assert.equal(validateProjectName("valid-name"), undefined);
  assert.match(validateProjectName("Invalid") ?? "", /lowercase/);
  assert.match(validateProjectName(".hidden") ?? "", /cannot start/);
  assert.match(validateProjectName("node:fs") ?? "", /valid npm package name/);
});

test("assertTargetDirectoryEmpty refuses existing files", async () => {
  const dir = await makeTempDir();
  await fs.writeFile(path.join(dir, "file.txt"), "x", "utf8");
  await assert.rejects(
    assertTargetDirectoryEmpty(dir),
    /Target directory is not empty/,
  );
});

test("resolveTemplateDir honors override", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  process.env.CREATE_FOC_APP_TEMPLATE_DIR = fixtureTemplate;
  try {
    assert.equal(resolveTemplateDir(import.meta.url), fixtureTemplate);
    await assert.doesNotReject(assertTemplateExists(fixtureTemplate));
  } finally {
    delete process.env.CREATE_FOC_APP_TEMPLATE_DIR;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("resolveTemplateDir ignores overrides outside tests", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.CREATE_FOC_APP_TEMPLATE_DIR = fixtureTemplate;
  try {
    assert.notEqual(resolveTemplateDir(import.meta.url), fixtureTemplate);
  } finally {
    delete process.env.CREATE_FOC_APP_TEMPLATE_DIR;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("resolveTemplateDir keeps Next.js as default and resolves React separately", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.match(resolveTemplateDir(import.meta.url), /template[/\\]default$/);
    assert.match(resolveTemplateDir(import.meta.url, "react"), /template[/\\]react$/);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("scaffoldProject maps dotfiles and replaces placeholders", async () => {
  const dir = await makeTempDir();
  const targetDir = path.join(dir, "demo");
  await scaffoldProject(fixtureTemplate, {
    targetDir,
    projectName: "demo-app",
    network: "mainnet",
    packageManager: "pnpm",
  });

  assert.equal(
    await fs.readFile(path.join(targetDir, "README.md"), "utf8"),
    "# demo-app\n\nNetwork: mainnet\n\nPackage manager: pnpm\nInstall: pnpm install\nRun: pnpm run\n",
  );
  assert.equal(await fs.readFile(path.join(targetDir, ".gitignore"), "utf8"), "node_modules\n");
  assert.equal(
    await fs.readFile(path.join(targetDir, ".env.example"), "utf8"),
    "NEXT_PUBLIC_FILECOIN_NETWORK=mainnet\n",
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "src/config.txt"), "utf8"),
    "name=demo-app\n",
  );
  assert.equal(
    await fs.readFile(path.join(targetDir, "public/favicon.ico"), "utf8"),
    "not-an-ico-but-binary-safe\n",
  );
});

test("scaffoldProject refuses symlinked template entries", async () => {
  const dir = await makeTempDir();
  const templateDir = path.join(dir, "template");
  const targetDir = path.join(dir, "target");
  const outsideFile = path.join(dir, "outside.txt");
  await fs.mkdir(templateDir);
  await fs.writeFile(outsideFile, "must-not-copy", "utf8");
  await fs.symlink(outsideFile, path.join(templateDir, "linked-secret.txt"));

  await assert.rejects(
    scaffoldProject(templateDir, {
      targetDir,
      projectName: "demo-app",
      network: "calibration",
      packageManager: "npm",
    }),
    /Refusing to copy symlinked template entry/,
  );
});

test("production template renders a complete FOC starter", async () => {
  const dir = await makeTempDir();
  const targetDir = path.join(dir, "real-starter");
  const productionTemplate = path.resolve("template/default");

  await scaffoldProject(productionTemplate, {
    targetDir,
    projectName: "real-starter",
    network: "calibration",
    packageManager: "yarn",
  });

  const generatedPackage = JSON.parse(
    await fs.readFile(path.join(targetDir, "package.json"), "utf8"),
  );
  assert.equal(generatedPackage.name, "real-starter");
  assert.match(generatedPackage.scripts.check, /^yarn foc:doctor/);
  assert.equal(generatedPackage.scripts["foc:doctor:online"], "node scripts/foc-doctor.mjs --online");
  const generatedReadme = await fs.readFile(path.join(targetDir, "README.md"), "utf8");
  assert.match(generatedReadme, /yarn install/);
  assert.match(generatedReadme, /yarn foc:doctor/);
  assert.doesNotMatch(generatedReadme, /__(?:PACKAGE_MANAGER|PM_INSTALL|PM_RUN)__/);
  const generatedAgentGuide = await fs.readFile(path.join(targetDir, "AGENTS.md"), "utf8");
  assert.match(generatedAgentGuide, /yarn typecheck/);
  assert.doesNotMatch(generatedAgentGuide, /__PM_RUN__/);
  assert.equal(generatedPackage.dependencies["@filoz/synapse-sdk"], "1.1.0");
  assert.equal(
    await fs.readFile(path.join(targetDir, ".env.example"), "utf8").then((value) => value.split("\n")[0]),
    "NEXT_PUBLIC_FILECOIN_NETWORK=calibration",
  );
  await assert.doesNotReject(fs.access(path.join(targetDir, "lib/foc/adapter.ts")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "scripts/foc-doctor.mjs")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "scripts/foc-smoke-test.mjs")));
});

test("React template renders a complete Vite FOC starter", async () => {
  const dir = await makeTempDir();
  const targetDir = path.join(dir, "react-starter");
  const productionTemplate = path.resolve("template/react");

  await scaffoldProject(productionTemplate, {
    targetDir,
    projectName: "react-starter",
    network: "mainnet",
    packageManager: "pnpm",
  });

  const generatedPackage = JSON.parse(
    await fs.readFile(path.join(targetDir, "package.json"), "utf8"),
  );
  assert.equal(generatedPackage.name, "react-starter");
  assert.equal(generatedPackage.scripts.dev, "vite");
  assert.match(generatedPackage.scripts.check, /^pnpm run foc:doctor/);
  assert.equal(generatedPackage.dependencies["@filoz/synapse-sdk"], "1.1.0");
  assert.equal(generatedPackage.devDependencies.vite, "6.4.3");
  assert.equal(
    await fs.readFile(path.join(targetDir, ".env.example"), "utf8").then((value) => value.split("\n")[0]),
    "VITE_FILECOIN_NETWORK=mainnet",
  );
  await assert.doesNotReject(fs.access(path.join(targetDir, "src", "App.tsx")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "src", "lib", "foc", "adapter.ts")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "vite.config.ts")));
  await assert.rejects(fs.access(path.join(targetDir, "next.config.ts")));
});

test("manualInstallCommand quotes target paths safely", () => {
  assert.equal(
    manualInstallCommand("npm", "/tmp/space dir"),
    "cd '/tmp/space dir' && npm install",
  );
  assert.equal(shellQuote("/tmp/$HOME/it's-safe"), "'/tmp/$HOME/it'\\''s-safe'");
});

test("initializeGitRepository creates repository metadata", async () => {
  const dir = await makeTempDir();
  assert.equal(await initializeGitRepository(dir), true);
  await assert.doesNotReject(fs.access(path.join(dir, ".git")));
});

test("cli smoke scaffolds with --no-install", async () => {
  const workspace = await makeTempDir();
  const targetName = path.join("nested space", "smoke-app");
  const cliPath = path.resolve("dist/cli.js");

  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, targetName, "--network", "mainnet", "--no-install", "--no-git"],
      {
        cwd: workspace,
        env: {
          ...process.env,
          NODE_ENV: "test",
          CREATE_FOC_APP_TEMPLATE_DIR: fixtureTemplate,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Scaffolded smoke-app/);
  assert.match(result.stdout, /Skipped dependency installation/);
  assert.equal(
    await fs.readFile(path.join(workspace, targetName, "README.md"), "utf8"),
    "# smoke-app\n\nNetwork: mainnet\n\nPackage manager: npm\nInstall: npm install\nRun: npm run\n",
  );
});

test("cli preserves files and prints recovery command when package manager is missing", async () => {
  const workspace = await makeTempDir();
  const cliPath = path.resolve("dist/cli.js");

  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, "missing-pm-app", "--package-manager", "pnpm", "--no-git"],
      {
        cwd: workspace,
        env: {
          ...process.env,
          PATH: "",
          NODE_ENV: "test",
          CREATE_FOC_APP_TEMPLATE_DIR: fixtureTemplate,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });

  assert.equal(result.code, 1);
  assert.match(result.stdout, /Scaffolded missing-pm-app/);
  assert.match(result.stderr, /Generated files were preserved/);
  assert.match(result.stderr, /pnpm install/);
  await assert.doesNotReject(fs.access(path.join(workspace, "missing-pm-app", "README.md")));
});
