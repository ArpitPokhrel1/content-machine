# Map Animation Studio Memory

Operating lessons for this pipeline specifically (kept separate from `../orchestrator_memory.md`,
which is entirely about the Veo/Gemini generative pipeline and does not apply here — this
pipeline draws real vector geodata and has no generative-model failure modes to log).

- `findCountry()`'s substring fallback must only run when no feature matches exactly. A predicate
  that ORs an exact-match check with a substring check in one pass can return the wrong feature
  when an unrelated name merely contains the query — "India" matched "Br. Indian Ocean Ter."
  first because "indian".includes("india"), and that feature happened to iterate before the real
  country. Always resolve exact matches in their own pass before falling back to substring/fuzzy
  matching against name fields pulled from a large open dataset.
- For an `establishingZoom`/`isometricFlyover`/`globeHighlight` default camera, keep `center`
  fixed on the target the whole shot and animate only `zoom` (+ pitch/bearing for a flyover).
  Animating center and zoom together from a wide starting point makes the subject invisible for
  most of the shot: at low zoom far from the target, the target is off-screen; it only enters
  frame once the pan has nearly finished. Fixed-center-only-zoom reads as a clean push-in and has
  no such dead zone.
- Sequential reveal (`fill`/`circle` layers) must use `Math.ceil(progress * count)` for the
  reveal cutoff, not `Math.floor`. With `floor`, the very last feature in the ordering only
  reaches its "revealed" threshold at `progress === 1` exactly — and discrete frame sampling
  (`t = i / fps` for `i` in `[0, totalFrames)`) never lands exactly on the shot's `endSec`, so the
  last (often most important/highest-value) feature never appears at all. `ceil` gives it a full
  reveal step of headroom before the shot ends.
- Node's SEA packaging bundles the CLI to CommonJS via esbuild. Any module that branches on
  `isSea()` to decide whether to use `import.meta.url` still breaks, because esbuild statically
  empties `import.meta` in `cjs` output regardless of what the runtime branch would have done —
  the crash happens at module-evaluation time, before the branch is ever reached. Compute a dev
  entry-point directory from `process.argv[1]` instead of `import.meta.url` in any file that may
  end up in the bundle (see `lib/studioRoot.mjs`).
- MapLibre GL's ESM bundle (`node_modules/maplibre-gl/dist/maplibre-gl.mjs`) exports `Map` as a
  named export, not a default export — `import maplibregl from '...'` fails at runtime with "does
  not provide an export named 'default'". Use `import { Map as MapLibreMap } from '...'`.
- `page.goto(..., { waitUntil: "load" })` does not block on a module script's outstanding
  top-level `await` (e.g. a scene `fetch()` and waiting for MapLibre's own `load` event) —
  Chromium's document `load` event fires once the module has started executing, not once its
  returned evaluation promise settles. Poll for the runtime's readiness function instead
  (`page.waitForFunction(() => typeof window.__msSetTime === "function")`) rather than assuming
  navigation completion means the page is ready to drive.
- `isDisputedFeature()` compares a feature's `NAME` against `BRK_NAME` — a Natural-Earth-only
  field pair. Stamping a synthetic `NAME` onto a non-Natural-Earth feature (e.g. a geoBoundaries
  feature, which has `shapeName` instead and no `BRK_NAME` at all) makes the heuristic see a
  `NAME`/`BRK_NAME` mismatch and flag the whole feature as disputed — which dashes its *entire*
  outline, not a real disputed segment. Add a display `NAME` only via `tagFeature`'s `extraProps`
  (applied *after* the disputed check runs), never by mutating the feature's properties before it
  reaches `tagFeature`.
- Measured, don't assumed: Natural Earth's Nepal polygon stops at 30.18°N in the Darchula/
  Kalapani band; geoBoundaries' NPL ADM0 (Open Data Nepal's "new political and administrative
  boundaries") reaches 30.47°N there — Nepal's 2020 official map addition, disputed by India.
  geoBoundaries' NPL ADM1 (a different upstream source, Survey Department of Nepal) only reaches
  30.25°N in the same band: a real ~30km seam against its own country's ADM0 outline, not a bug
  in this codebase. Before trusting "the newest boundary" claim for any country, download the
  candidate datasets and diff their bounding boxes in the specific disputed band rather than
  trusting a source's name or date field.
- **Superseded by the next point**: geoBoundaries' NPL ADM2 (district) layer was found to be the
  pre-2017 75-district file — duplicate "Bara"/"Saptari" (really Parsa/Siraha), no Rupandehi
  polygon, Dailekh labelled Jajarkot — and was hard-gated behind `acceptKnownDataIssues` rather
  than fixed, because no better *geoBoundaries* source was found at the time.
- **The actual fix**: UN OCHA's COD-AB for Nepal (data.humdata.org, dataset `cod-ab-npl`, a
  `npl_admin_boundaries.geojson.zip` bundling ADM0-ADM3 in one download) is correct and current
  across all four levels — exactly 77 districts, no mislabelling, every level carries its own
  parent name/pcode (`adm1_name`, `adm2_name`, ...) with no spatial join needed for hierarchy
  filtering, and license CC BY-IGO. Measured directly: all four levels agree on the identical
  boundary in the Darchula band (no seam) because OCHA follows the neutral/UN convention rather
  than Nepal's 2020 claim — so it's also the fix for the ADM0/ADM1 seam noted above, just without
  the claimed Kalapani extension. `sceneBuilder.mjs` now uses OCHA as Nepal's default source for
  every level; geoBoundaries' claimed ADM0 is kept as an explicit opt-in
  (`region.nepalBoundaryVariant: "claim"`) for shots that specifically want to show it. Lesson:
  when a "no good source exists" gate has stood for a while, it's worth spending 20 minutes on
  HDX/data.humdata.org before accepting the gate as permanent — COD-AB datasets exist for most
  countries and are usually better-maintained than a generic global compilation's per-country cut.
- Zip-extraction libraries commonly have symlink/path-traversal CVEs in their "extract to disk at
  the entry's own path" mode (e.g. `extract-zip`'s GHSA-jmr9-qjv8-65gv, unpatched). When only a
  couple of known entry names are needed from a zip whose source is trusted, use a low-level
  parser (`yauzl`) to read the entry into memory and write it to a cache path *you* choose — this
  removes the vulnerable operation from the dependency tree entirely rather than trusting a
  wrapper library not to have it.
- Renders must be a pure function of t. MapLibre's default 300ms paint-property transitions and 300ms
  raster-tile fade-in both run against the virtual clock (`setNow`), so after a time jump a value is
  left mid-fade: borders/fills that should be fully on render at ~0 opacity, and freshly loaded satellite
  tiles render black. Set style-level `transition: {duration:0, delay:0}` and the satellite layer's
  `raster-fade-duration: 0`. Symptom seen: an entire layer group missing from a mid-shot preview still.
- In the headless capture page, animation frames are not delivered between screenshots, so MapLibre neither
  requests new tiles nor paints arrived ones, and `map.loaded()` stays false. Waiting on `idle`/`loaded()`
  either captures half-loaded tiles or hangs to a timeout. Force `map.redraw()` and poll
  `areTilesLoaded()` (bounded). Cost: renders now wait on real network tiles per frame.
- Before trusting a subnational layer to label things on screen, audit names against an independent source.
  geoBoundaries NPL ADM2 has duplicate names (Bara/Saptari), a missing Rupandehi, and Dailekh mislabelled
  Jajarkot; a Nominatim point-in-polygon check per official district found it. It is refused for
  `regionHighlight` rather than patched from memory. ADM1 uses "Province 1/2" for Koshi/Madhesh.
- Two boundary files that "agree on average" (mean offset ~0.3 km) still draw a visible double line at
  video scale. When an outline and internal borders must coincide, derive the outline from the subdivisions
  (edges belonging to exactly one polygon) instead of drawing a second source. Check topology first: count
  shared vs single edges — Nepal ADM1/ADM3 are clean (single-edge counts ≈ true perimeter), ADM2 is not.
- Don't re-draw neighbouring countries from Natural Earth next to an official national outline; NE's coarse
  geometry shows as a ghost line beside it. Dim the outside with a mask polygon cut from the drawn outline.
- Chaining `regionHighlight` shots across admin levels (e.g. ADM2 district -> ADM3 municipality) with default cameras
  gives a visible jump at the cut (shot 2 opens on its own whole-region fit, not shot 1's end frame) and can zoom
  *out* at the end (`minSpanDeg` 0.5 is wider than a small municipality). The default sequential glide is also
  squeezed into `min(1.1s, slot*0.4)`, too fast for a short shot. For a multi-level push-in, pass an explicit
  `camera {from,to}` per shot with each `from` equal to the previous `to`, and fit the final unit with `minSpanDeg: 0`.
