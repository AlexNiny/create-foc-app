export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";
export type FilecoinNetwork = "calibration" | "mainnet";

export interface CliOptions {
  target?: string;
  yes: boolean;
  install: boolean;
  initializeGit: boolean;
  packageManager: PackageManager;
  network: FilecoinNetwork;
  help: boolean;
  version: boolean;
}

export interface ScaffoldOptions {
  targetDir: string;
  projectName: string;
  network: FilecoinNetwork;
  packageManager: PackageManager;
}
