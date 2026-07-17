import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_PROJECT_NAME = "foc-app";
export const DEFAULT_NETWORK = "calibration";
export const TEMPLATE_OVERRIDE_ENV = "CREATE_FOC_APP_TEMPLATE_DIR";
export const PLACEHOLDERS = {
  projectName: "__PROJECT_NAME__",
  network: "__FOC_NETWORK__",
  packageManager: "__PACKAGE_MANAGER__",
  packageManagerInstall: "__PM_INSTALL__",
  packageManagerRun: "__PM_RUN__",
} as const;

export function getPackageRoot(fromUrl: string): string {
  return path.resolve(path.dirname(fileURLToPath(fromUrl)), "..");
}
