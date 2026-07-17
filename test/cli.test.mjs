import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawn } from "node:child_process";

import { formatHelp, parseArgs } from "../dist/args.js";
import { assertTargetDirectoryEmpty, assertTemplateExists } from "../dist/filesystem.js";
import { manualInstallCommand } from "../dist/install.js";
import { validateProjectName } from "../dist/project-name.js";
import { scaffoldProject, resolveTemplateDir } from "../dist/template.js";

const fixtureTemplate = path.resolve("test/fixtures/template");

async function makeTempDir(prefix = "create-foc-app-") {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test("parseArgs applies defaults and flags", () => {
  assert.deepEqual(parseArgs(["demo"]), {
    target: "demo",
    yes: false,
    install: true,
    packageManager: "npm",
    network: "calibration",
    help: false,
    version: false,
  });

  assert.deepEqual(
    parseArgs([
      "--yes",
      "--no-install",
      "--package-manager",
      "pnpm",
      "--network",
      "mainnet",
    ]),
    {
      target: "foc-app",
      yes: true,
      install: false,
      packageManager: "pnpm",
      network: "mainnet",
      help: false,
      version: false,
    },
  );
});

test("formatHelp includes primary flags", () => {
  const help = formatHelp();
  assert.match(help, /--package-manager <name>/);
  assert.match(help, /--network <name>/);
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

test("scaffoldProject maps dotfiles and replaces placeholders", async () => {
  const dir = await makeTempDir();
  const targetDir = path.join(dir, "demo");
  await scaffoldProject(fixtureTemplate, {
    targetDir,
    projectName: "demo-app",
    network: "mainnet",
  });

  assert.equal(
    await fs.readFile(path.join(targetDir, "README.md"), "utf8"),
    "# demo-app\n\nNetwork: mainnet\n",
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
  });

  const generatedPackage = JSON.parse(
    await fs.readFile(path.join(targetDir, "package.json"), "utf8"),
  );
  assert.equal(generatedPackage.name, "real-starter");
  assert.equal(generatedPackage.dependencies["@filoz/synapse-sdk"], "1.1.0");
  assert.equal(
    await fs.readFile(path.join(targetDir, ".env.example"), "utf8").then((value) => value.split("\n")[0]),
    "NEXT_PUBLIC_FILECOIN_NETWORK=calibration",
  );
  await assert.doesNotReject(fs.access(path.join(targetDir, "lib/foc/adapter.ts")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "scripts/foc-doctor.mjs")));
  await assert.doesNotReject(fs.access(path.join(targetDir, "scripts/foc-smoke-test.mjs")));
});

test("manualInstallCommand quotes target paths safely", () => {
  assert.equal(
    manualInstallCommand("npm", "/tmp/space dir"),
    'cd "/tmp/space dir" && npm install',
  );
});

test("cli smoke scaffolds with --no-install", async () => {
  const workspace = await makeTempDir();
  const targetName = path.join("nested space", "smoke-app");
  const cliPath = path.resolve("dist/cli.js");

  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, targetName, "--network", "mainnet", "--no-install"],
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
    "# smoke-app\n\nNetwork: mainnet\n",
  );
});

test("cli preserves files and prints recovery command when package manager is missing", async () => {
  const workspace = await makeTempDir();
  const cliPath = path.resolve("dist/cli.js");

  const result = await new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [cliPath, "missing-pm-app", "--package-manager", "pnpm"],
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
