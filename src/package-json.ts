import fs from "node:fs/promises";
import path from "node:path";
import { getPackageRoot } from "./constants.js";

interface PackageManifest {
  version?: string;
}

export async function readPackageVersion(fromUrl: string): Promise<string> {
  const manifestPath = path.join(getPackageRoot(fromUrl), "package.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as PackageManifest;

  return parsed.version ?? "0.0.0";
}
