import path from "node:path";
import { isSea } from "node:sea";

// In dev, the studio root is the project folder itself: `node agent-map.mjs`
// sets process.argv[1] to agent-map.mjs's absolute path, and agent-map.mjs
// lives at the project root, so its dirname is the root. (Deliberately not
// import.meta.url: this module is bundled to CommonJS for the packaged exe
// — see build/build-exe.mjs — and esbuild statically empties `import.meta`
// in cjs output regardless of any runtime isSea() branch around it.)
//
// In a packaged exe, agent-map.mjs and its lib/ imports are bundled into
// the binary, but render/, lib/geomath.mjs (fetched by the browser over
// HTTP, not imported by Node) and node_modules/maplibre-gl still need to
// exist as real files next to the exe — so the root becomes the exe's own
// directory, laid out identically to the dev project folder.
//
// A third entry point (gui/main.js, Electron) does not live at the project
// root and does not go through the esbuild/SEA bundle either, so the
// argv[1] heuristic would resolve to gui/ instead of the project root.
// Rather than guess per-entry-point, any entry point outside the two cases
// above sets MAP_STUDIO_ROOT itself (a plain CJS `__dirname`-based path,
// computed before importing anything under lib/) and that always wins.
export const IS_PACKAGED = isSea();
export const STUDIO_ROOT =
  process.env.MAP_STUDIO_ROOT || (IS_PACKAGED ? path.dirname(process.execPath) : path.dirname(path.resolve(process.argv[1])));
