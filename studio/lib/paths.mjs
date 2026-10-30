// Shared path anchors for the Studio cockpit.
// REPO_ROOT is the "Content Machine" folder (studio/ sits directly inside it).
import path from "node:path";
import { fileURLToPath } from "node:url";

export const STUDIO_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO_ROOT = path.resolve(STUDIO_DIR, "..");
export const OUTPUTS_DIR = path.join(REPO_ROOT, "Outputs");
export const SITE_PUBLIC = path.join(REPO_ROOT, "site", "public");
export const SITE_BUNDLE = path.join(REPO_ROOT, "site", "bundle");
export const ASSET_GEN_DIR = path.join(REPO_ROOT, "asset-generation");
export const MAP_DIR = path.join(REPO_ROOT, "map-animation");
export const SUBTITLES_DIR = path.join(REPO_ROOT, "subtitles");
export const CONFIG_FILE = path.join(STUDIO_DIR, "studio.config.local.json");

// Keep a resolved target inside an allowed base dir (blocks path traversal).
export function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}
