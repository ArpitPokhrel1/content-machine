import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { STUDIO_ROOT } from "./studioRoot.mjs";

export const OUTPUT_ROOT = path.join(STUDIO_ROOT, "output");

const SAFE_ID = /^[a-z0-9][a-z0-9-_]{1,63}$/i;

export function assertSafeProjectId(id) {
  if (!id || !SAFE_ID.test(id)) {
    throw new Error(`Invalid project id "${id}". Use letters, numbers, "-", "_" only (2-64 chars).`);
  }
  return id;
}

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "map-project"
  );
}

export function projectDir(id) {
  assertSafeProjectId(id);
  return path.join(OUTPUT_ROOT, id);
}

export async function createProjectDirs(id) {
  const dir = projectDir(id);
  await mkdir(path.join(dir, "geo"), { recursive: true });
  await mkdir(path.join(dir, "previews"), { recursive: true });
  await mkdir(path.join(dir, "frames"), { recursive: true });
  return dir;
}

export async function writeProjectJson(id, filename, data) {
  const dir = projectDir(id);
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, filename);
  await writeFile(target, JSON.stringify(data, null, 2), "utf8");
  return target;
}

export async function readProjectJson(id, filename) {
  const target = path.join(projectDir(id), filename);
  return JSON.parse(await readFile(target, "utf8"));
}

export async function listProjects() {
  try {
    return await readdir(OUTPUT_ROOT);
  } catch {
    return [];
  }
}
