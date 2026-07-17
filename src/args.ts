import { DEFAULT_NETWORK, DEFAULT_PROJECT_NAME } from "./constants.js";
import type { CliOptions, FilecoinNetwork, PackageManager } from "./types.js";
import { CliError } from "./errors.js";

const PACKAGE_MANAGERS: ReadonlySet<string> = new Set([
  "npm",
  "pnpm",
  "yarn",
  "bun",
]);

const NETWORKS: ReadonlySet<string> = new Set(["calibration", "mainnet"]);

export function detectPackageManager(
  userAgent = process.env.npm_config_user_agent,
): PackageManager {
  const name = userAgent?.split("/")[0];
  return PACKAGE_MANAGERS.has(name ?? "") ? (name as PackageManager) : "npm";
}

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new CliError(`Missing value for ${flag}.`);
  }

  return value;
}

export function parseArgs(
  argv: string[],
  defaultPackageManager = detectPackageManager(),
): CliOptions {
  const options: CliOptions = {
    yes: false,
    install: true,
    initializeGit: true,
    packageManager: defaultPackageManager,
    network: DEFAULT_NETWORK as FilecoinNetwork,
    help: false,
    version: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === "--") {
      const target = argv[index + 1];
      if (target) {
        options.target = target;
      }
      break;
    }

    if (!arg.startsWith("-")) {
      if (options.target) {
        throw new CliError(`Unexpected extra argument: ${arg}`);
      }
      options.target = arg;
      continue;
    }

    switch (arg) {
      case "--yes":
      case "-y":
        options.yes = true;
        break;
      case "--no-install":
      case "--skip-install":
        options.install = false;
        break;
      case "--git":
        options.initializeGit = true;
        break;
      case "--no-git":
        options.initializeGit = false;
        break;
      case "--package-manager": {
        const value = takeValue(argv, index, arg);
        if (!PACKAGE_MANAGERS.has(value)) {
          throw new CliError(
            `Unsupported package manager "${value}". Expected npm, pnpm, yarn, or bun.`,
          );
        }
        options.packageManager = value as PackageManager;
        index += 1;
        break;
      }
      case "--network": {
        const value = takeValue(argv, index, arg);
        if (!NETWORKS.has(value)) {
          throw new CliError(
            `Unsupported network "${value}". Expected calibration or mainnet.`,
          );
        }
        options.network = value as FilecoinNetwork;
        index += 1;
        break;
      }
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--version":
      case "-v":
        options.version = true;
        break;
      default:
        throw new CliError(`Unknown option: ${arg}`);
    }
  }

  if (options.yes && !options.target) {
    options.target = DEFAULT_PROJECT_NAME;
  }

  return options;
}

export function formatHelp(): string {
  return [
    "create-foc-app",
    "",
    "Usage:",
    "  create-foc-app [target-directory] [options]",
    "",
    "Options:",
    "  -y, --yes                        Use safe defaults",
    "  --no-install, --skip-install    Skip dependency installation",
    "  --git / --no-git                Enable or skip Git initialization",
    "  --package-manager <name>        npm | pnpm | yarn | bun",
    "  --network <name>                calibration | mainnet",
    "  -h, --help                      Show this help message",
    "  -v, --version                   Show the current version",
    "",
    "Examples:",
    `  create-foc-app ${DEFAULT_PROJECT_NAME}`,
    `  create-foc-app ${DEFAULT_PROJECT_NAME} --network mainnet`,
  ].join("\n");
}
