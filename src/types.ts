export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type FilecoinNetwork = "calibration" | "mainnet";
export type AppTemplate = "next" | "react";

export interface CliOptions {
  target?: string;
  yes: boolean;
  install: boolean;
  initializeGit: boolean;
  packageManager: PackageManager;
  network: FilecoinNetwork;
  template: AppTemplate;
  help: boolean;
  version: boolean;
}

export interface ScaffoldOptions {
  targetDir: string;
  projectName: string;
  network: FilecoinNetwork;
  packageManager: PackageManager;
}
