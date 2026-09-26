# Map Animation Studio

A local, **non-generative** pipeline for factual, geographically-accurate animated map videos —
Vox/NYT/BBC-explainer-style choropleths, border reveals, flow/migration arcs, zoom establishing
shots, rotating globes, route animations, dot-density/bubble maps, heatmaps, and side-by-side
comparisons — for use as B-roll in video edits.

**No Veo, no Gemini, no text-to-video anywhere in this pipeline.** Every frame is drawn from real
administrative-boundary vector data (Natural Earth, geoBoundaries.org) by MapLibre GL JS, captured
frame-by-frame with a real Chromium browser, and encoded to MP4 with ffmpeg. Same input, same
output, every time — because a hallucinated coastline is a factual error, not a style miss.

## Why this exists instead of calling an AI video model

Generative video models cannot be trusted to draw a specific country's real borders, a real
coastline, or a real numeric choropleth — they interpolate a plausible-looking map, not an
accurate one. This tool renders real GeoJSON geometry from licensed-for-reuse datasets instead,
so it is safe to use for maps whose accuracy actually matters.

## Requirements

- Node.js 20+ (this machine has v24).
- ffmpeg on `PATH` (already installed here — `ffmpeg -version` to confirm).
- A Chromium-based browser installed (Edge or Chrome — Windows ships Edge by default). Override
  the auto-detected path with `MAP_STUDIO_CHROME_PATH` if needed.
- Internet access on first use of a given country/region (boundary GeoJSON is fetched once and
  cached to `data/cache/`; later runs reuse the cache and work offline).

No API keys, no paid service, no Mapbox/Google Maps account. Run `node agent-map.mjs health` to
verify all of the above.

## Desktop GUI

```powershell
npm install
npx electron gui/main.js
```

A real Electron app: a live interactive MapLibre map (satellite basemap, real boundary data),
a curated country picker (Nepal, India, China, Bangladesh, Bhutan for now — the CLI/engine
already works for any country), an animation-style + format picker, a live animated preview
driven by the same `render/map.html` engine used for export, and one-click render with an
inline result player. See `gui/main.js`/`gui/renderer.js`. It calls the exact same `lib/core.mjs`
functions as the CLI — there is one render/approval implementation, not two.

## Website — Nepal district template gallery

```powershell
npm install
npm run web
```

Opens on `http://127.0.0.1:4173` (falls back to a free port if that one's busy). A real browser
app, not Electron-locked — a mapanimation.io-style template gallery scoped to Nepal's
administrative geography: District Spotlight, District Tour (sequential highlight across several
districts), Province Explorer, District's Municipalities (every municipality inside one chosen
district), and an All-Districts Overview choropleth by real land area. Same draft → live animated
preview → explicit-approval render flow as the CLI/GUI, exposed as a small JSON API
(`web/server.mjs`, see the `/api/*` routes) calling the same `lib/core.mjs` functions — three
front ends, one engine and one approval gate. District/province/municipality names for the
pickers come straight from OCHA's data (`/api/nepal/districts`, `/api/nepal/provinces`), not a
hand-maintained list, so they can never drift from what actually renders.

## Country & regional highlighting

`regionHighlight` lights named countries, provinces, districts or municipalities one at a time (or together) on a satellite basemap, with hard, exact borders and a camera that follows each region. See `references/contracts.md` ("Region highlighting") and the examples `example-nepal-province-highlight.json` and `example-country-highlight.json`. Nepal district-level (ADM2) highlighting is deliberately refused: the upstream layer has wrong/missing districts.

## Basemap: satellite imagery + real borders

By default every scene renders on Esri World Imagery (free, keyless, CORS-enabled satellite
tiles) with administrative borders drawn as a glowing vector overlay on top — the borders come
from Natural Earth/geoBoundaries, never from the imagery itself, so switching the basemap never
affects boundary accuracy. Pass `"basemap": "flat"` in a manifest for the old solid-color
background (much faster, no per-frame tile fetches) when iterating on a scene before a final
satellite render.

## Quick start

```powershell
npm install
node agent-map.mjs health
node agent-map.mjs draft --manifest references/examples/example-establishing-shot.json
# review output/<project-id>/previews/*.png and the returned scene plan, then:
node agent-map.mjs generate --project <project-id> --approval approval.json
```

`approval.json` must contain `{ "confirmRender": true, "sceneChecksum": "<from draft output>" }`.
See `references/contracts.md` for the full manifest/approval schema and every supported shot
`kind`, and `references/examples/` for two working example manifests (a country establishing
zoom and a multi-country choropleth).

## For an AI agent operating this tool

Read `PROMPT_MAP_ANIMATION.md` (the one-shot scoping questionnaire — ask it in a single batch,
never drip-fed) and the `create-map-animations` skill in `../.claude/skills/` (the workflow
and guardrails, including the disputed-territory default policy and the render approval gate).
`../CLAUDE.md` points here for any map-animation request in this repo.

## Architecture

```
agent-map.mjs        CLI: health | plan | draft | generate | status
lib/
  geodata.mjs         Fetch + disk-cache Natural Earth / geoBoundaries / Nominatim, with
                      license-safe source selection (never GADM) and disputed-feature flagging
  sceneBuilder.mjs     manifest.json -> scene.json (resolves regions/points, builds camera
                       keyframes, joins data values, computes color ramps)
  geomath.mjs          Dependency-free great-circle arcs, line "draw-on" slicing, easing —
                       shared between Node (scene building) and the browser (per-frame runtime)
  staticServer.mjs      Minimal loopback-only static file server (path-traversal guarded)
  projects.mjs          Per-project output folders, id validation, JSON read/write
  browser.mjs           Locates a local Chrome/Edge/Chromium install (no bundled browser download)
render/
  map.html, map-runtime.js   MapLibre GL page: interprets scene.json, drives camera + every
                             layer type (fill/line/circle/heatmap) against a virtual clock
                             (`setNow`) for deterministic, frame-accurate capture
  capture.mjs           Puppeteer: launches the local browser headless, steps the virtual
                         clock frame by frame, screenshots each frame
  encode.mjs            Spawns ffmpeg (argv array, never a shell string) to stitch frames to MP4
build/build-exe.mjs      Packages agent-map.mjs + lib/ into dist/map-animation-studio/ — a
                         standalone exe via Node's official Single Executable Application
                         support (see "Packaged exe" below)
```

Nothing is generated by an LLM. `sceneBuilder.mjs` is the only place that turns a manifest into
pixels-to-be, and every number or coordinate it uses traces back to a manifest field or a fetched
dataset — never an invented value.

## Security notes

- Every `ffmpeg`/browser subprocess is invoked with an argv array, never a shell string — no
  project id, title, or file path can inject a shell command.
- Project ids are validated against a strict allowlist regex before touching the filesystem.
- The static file server binds to `127.0.0.1` only and resolves every request path against its
  root before reading, refusing anything that would escape it.
- `generate` recomputes a SHA-256 of `scene.json` and refuses to run unless the approval file's
  `sceneChecksum` matches exactly — a render can never run against a plan that wasn't the one
  reviewed.
- No API keys or credentials exist anywhere in this pipeline.
- Nominatim (geocoding) calls are rate-limited to ~1/sec with a descriptive User-Agent and cached
  to disk, per OSM's usage policy.

## Packaged exe (cross-device / non-Node machines)

```powershell
npm run build:exe
```

Produces `dist/map-animation-studio/` containing `map-animation-studio.exe` plus the `render/`,
`lib/geomath.mjs`, and `node_modules/maplibre-gl/` it serves to the browser at render time.
**Distribute the whole folder, not just the exe** — same reason Electron or VS Code ship an exe
next to a `resources/` folder rather than one giant file. The target machine still needs its own
Chrome/Edge and ffmpeg on `PATH`; neither is bundled (bundling a browser download would make the
exe's provenance harder to audit, so it deliberately uses whatever browser is already installed
and trusted on that machine).

This uses Node's own official **Single Executable Application** feature (bundled via esbuild,
injected via `postject`) — not a third-party packager — so there's no additional supply-chain
trust beyond Node, esbuild, and postject themselves. Injecting the blob invalidates node.exe's
original code signature; the exe still runs, but for wider distribution sign it with your
organization's certificate: `signtool sign /fd SHA256 /a map-animation-studio.exe`.

## Known limits (documented, not silently papered over)

- **No true 3D terrain.** `isometricFlyover` tilts the camera over the flat map; there's no
  elevation data (adding it would mean either an API key or bundling large DEM tiles).
- **No bundled historical boundaries.** `borderTimelapse` requires the user to supply each
  keyframe's GeoJSON — the two open historical-boundary datasets found in research are GPL-3.0
  and CC-BY-NC-SA respectively, neither safe to redistribute inside rendered video output.
- **Disputed borders** are flagged via Natural Earth's own `TYPE`/`BRK_NAME` fields (a documented
  heuristic, not the dedicated `ne_10m_admin_0_disputed_areas` overlay) — good enough to avoid
  silently picking a side, not a substitute for a cartographer's review on a sensitive project.
  **Nepal is handled explicitly instead of by that heuristic**: every admin level (0-3) routes
  through UN OCHA's COD-AB for Nepal (correct, current, internally consistent — see
  `references/contracts.md`), which by default follows UN/neutral convention and does **not**
  include the Kalapani-Lipulekh-Limpiyadhura area near Darchula that Nepal's 2020 official map
  claims; a fixed note is burned into every Nepal frame either way. Pass
  `region.nepalBoundaryVariant: "claim"` on a country-level shot to show that official claim
  instead (geoBoundaries' ADM0).
- **Municipality-level (`adminLevel: 3`) scenes are large.** Nepal's 775 local units produce a
  large `scene.json` and a materially slower render — expected, not a bug, given the geometry
  volume; there is no simplification step yet between "fetch" and "embed in the scene."
- **Geocoding** goes through public Nominatim; for heavy/offline use, consider vendoring a
  GeoNames city-coordinate dump instead (see the research notes captured in this project's build
  history) rather than increasing Nominatim call volume.
