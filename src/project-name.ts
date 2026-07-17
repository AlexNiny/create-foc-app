import { builtinModules } from "node:module";

const NAME_PATTERN =
  /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

const BLOCKED_NAMES = new Set([
  "node_modules",
  "favicon.ico",
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

export function validateProjectName(name: string): string | undefined {
  if (!name) {
    return "Project name is required.";
  }

  if (name.length > 214) {
    return "Project name must be 214 characters or fewer.";
  }

  if (name.startsWith(".") || name.startsWith("_")) {
    return 'Project name cannot start with "." or "_".';
  }

  if (!NAME_PATTERN.test(name)) {
    return "Project name must be a valid npm package name using lowercase URL-safe characters.";
  }

  if (encodeURIComponent(name) !== name) {
    return "Project name must not contain non-URL-safe characters.";
  }

  if (BLOCKED_NAMES.has(name)) {
    return `Project name "${name}" is reserved.`;
  }

  return undefined;
}
