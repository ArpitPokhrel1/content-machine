# Map Animation Studio Contracts

## Draft manifest (`agent-map.mjs draft --manifest <file>`)

```json
{
  "projectId": "south-asia-population",
  "title": "South Asia — population",
  "purpose": "8s B-roll under a voiceover line about regional population",
  "durationSec": 8,
  "fps": 30,
  "aspectRatio": "16:9",
  "background": { "ocean": "#050507", "land": "#1c1c22" },
  "basemap": "satellite",
  "disputedBorderPolicy": "flag-dashed",
  "attributionExtra": [],
  "editorialNotes": [],
  "panes": [
    {
      "id": "main",
      "projection": "mercator",
      "shots": [ /* see Shot kinds below */ ]
    }
  ]
}
```

- `aspectRatio`: `16:9` (1920x1080), `9:16` (1080x1920), or `1:1` (1080x1080). Override with an explicit `resolution: {width,height}`.
- `basemap`: `satellite` (default — Esri World Imagery, free/keyless raster tiles, real terrain/coastline under the vector overlay) or `flat` (the old solid-color background, much faster to render since it needs no per-frame tile fetches — use it for quick iteration on a scene before a final satellite render).
- `disputedBorderPolicy`: `flag-dashed` (default — dashed outline + neutral note, per `PROMPT_MAP_ANIMATION.md` Section 2G), `hide` (drop the outline entirely), or `solid` (render as an ordinary border — only on an explicit user editorial override, record why in the manifest).
- `editorialNotes`: seed notes here if you already know of a dispute the automatic checks won't catch. The builder adds to this automatically for known cases (see the Nepal note below) — it is not purely a generic heuristic.
- `panes`: one entry for a normal clip; two or more for a side-by-side comparison. Each pane has its own independent camera and shot timeline; all panes share the scene's `fps`/`durationSec`/`width`/`height`.
- Every shot needs `id`, `startSec`, `endSec`, and `kind`. Shots in a pane play sequentially in the order given; a layer added by one shot stays on screen (fill/line/circle color and outline persist) unless a later shot's `kind` replaces the same layer id — this is what makes a cumulative choropleth-then-highlight sequence possible.

### Shot kinds

| `kind` | Required fields | Notes |
| --- | --- | --- |
| `establishingZoom` | `region` | Globe/wide view pushes in to fit the region. Camera center is fixed on the region's centroid and only zoom (and pitch/bearing for `isometricFlyover`) animates — panning and zooming at once can leave the subject off-screen until the pan nearly finishes, so the builder deliberately avoids it unless you pass an explicit `camera`. |
| `isometricFlyover` | `region` | Same as `establishingZoom` plus pitch/bearing for a tilted 2.5D look. No elevation/terrain data is fetched (keyless pipeline); it's a tilted flat plane, not true relief. |
| `globeHighlight` | `region` | Same builder as `establishingZoom` with `projection: "globe"` on the pane. |
| `regionHighlight` | `region`, `highlight` | Country & regional highlighting. Draws every subdivision with crisp borders, then lights the named regions. See **Region highlighting** below. |
| `choropleth` | `region`, `dataSourceRef.values` | `values` keys match ISO3 (`ADM0_A3`), ISO2, or the exact `NAME` field — check the draft output's dataset table if a country doesn't join. `revealMode`: `"sequential"` (default, low→high value) or `"fade"` (all at once). Never invent a value: every number must come from `dataSourceRef.values` as supplied. |
| `flowArcs` | `pairs: [{from:{query|coords}, to:{query|coords}, weight}]` | Great-circle arcs, draw progressively over the shot. `from`/`to` accept a place-name `query` (geocoded via Nominatim, cached) or explicit `coords: [lon, lat]`. |
| `routeLine` | `waypoints: [{query|coords, label}]` | Single path drawn progressively through the waypoints in order; each waypoint gets a timed label. |
| `dotDensity` / `proportionalSymbol` | `points: [{query|coords, value, label}]` | `dotDensity` pops points in one at a time (low→high); `proportionalSymbol` grows circle radius by `value` (∝ √value, the correct convention — never scale radius linearly with value). |
| `heatmapDensity` | `points: [{query|coords, value}]` | Continuous density surface, opacity ramps in over the shot. |
| `borderTimelapse` | `keyframes: [{atSec, year, geojson}]` | **No bundled historical-boundary dataset** — aourednik/historical-basemaps is GPL-3.0 and CShapes is CC-BY-NC-SA, neither safe to redistribute in client video output. The user must supply each keyframe's GeoJSON explicitly; the shot only swaps between supplied snapshots. Say so if a request implies historical borders and no snapshots are supplied — do not substitute current borders as a stand-in for history. |

Optional per-shot fields available on every kind: `title`, `labels` (array of `{query|at:[lon,lat], text, showAtSec}`), `legend`, `dateCounter`, `camera` (explicit override — `{from:{center,zoom,pitch,bearing}, to:{...}, easing}`).

### Region highlighting (`regionHighlight`)

```json
{ "id": "provinces", "kind": "regionHighlight", "startSec": 0, "endSec": 14,
  "region": { "adminLevel": 1, "countries": ["Nepal"] },
  "highlight": ["Koshi", "Madhesh", { "names": ["Bagmati", "Gandaki"], "label": "Central Nepal", "color": "#4cc9f0" }],
  "mode": "sequential" }
```

- `highlight`: `"all"` (west→east) or a list of names / `{name | names, label, color}` (`names` lights several regions as one step). Names match the displayed name or a source name exactly (case/accents/"Province" suffix ignored) — never by substring. An unknown or ambiguous name is an error that lists the valid names, not a silent miss. Nepal ADM1 accepts `Koshi`/`Province 1`, `Madhesh`/`Province 2`, `Sudurpashchim`/`Sudurpaschim`.
- `mode`: `sequential` (default; one step per entry, camera follows) or `together` (all lit at once, fixed frame). Sequential needs ≥0.6s per entry.
- Optional: `previous` (`"fade"` default | `"keep"` for a cumulative build-up), `palette: "cycle"` (one colour per step; default is a single accent), `color`, `cameraMode` (`"follow"` | `"fit"`), `padding`, `minSpanDeg`, `introSec`, `holdSec`, `labels: false`, `borderColor`, `baseOpacity`, `highlightOpacity`, `countryOutline` (`"subdivisions"` | `"adm0"` | `false`), `region.context: false` (no dimming mask).
- **Border rendering:** subdivision borders are thin hard lines over a dark casing (no glow/blur, which would widen the line and blur the true boundary); the national outline is heavier; the lit region gets a bright edge above every other border. Everything outside the country is dimmed by a mask cut from the *same* outline that is drawn, so two slightly different borders never appear.
- **National outline source:** for Nepal the outline defaults to the perimeter of the subdivisions themselves at every level (1/2/3) — OCHA's data is topologically clean, so outline and internal borders agree exactly by construction. Pass `countryOutline: "adm0"` to use a separate country file instead — for Nepal that pulls in the ADM0 claim/no-claim logic described below.
- Level 0 with several `countries` highlights countries (frame is built around the highlighted ones, not every listed neighbour).

#### Nepal district layer (ADM2) — fixed, no longer gated

geoBoundaries' NPL ADM2 was the pre-2017 75-district file (Nepal has 77) with real labelling defects: duplicate `Bara`/`Saptari` (really Parsa/Siraha), no separate Rupandehi polygon, Dailekh labelled Jajarkot. `regionHighlight`/`resolveRegion` no longer use that source for Nepal at any level — see `region.adminLevel` below. There is no gate or `acceptKnownDataIssues` flag anymore; district-level Nepal requests just work.

### `region.adminLevel`

`0` = country, `1` = state/province, `2` = district/county, `3` = municipality/local unit. Level 0 accepts multiple `countries`; levels 1-3 require exactly one. Non-Nepal: level 1 uses Natural Earth, levels 2-3 use geoBoundaries (`ADM2`/`ADM3`) and only exist for a country if geoBoundaries publishes that level — a missing level throws a clear error rather than silently falling back to a coarser one. Municipality level can be large (Nepal's 775 local units is a large scene.json) — expect a slower render, not a bug.

**Nepal routes through OCHA's COD-AB at every level (0-3)** (`cod-ab-npl` on data.humdata.org, CC BY-IGO) instead of geoBoundaries/Natural Earth — verified by direct inspection to have exactly 77 correctly-labelled districts and 775 municipalities, with every level carrying its parent name (`adm1_name` on districts, `adm2_name` on municipalities, etc. — see `region.parentName` below) and, measured directly, all four levels agreeing on an identical boundary in the Darchula/Kalapani band (no seam). That agreement holds because OCHA follows the UN/neutral convention rather than Nepal's 2020 official claim (the Kalapani-Lipulekh-Limpiyadhura area near Darchula, which India disputes) — so **OCHA is the default and does not show the claim**. To show Nepal's official 2020 map instead for a country-level shot, set `region.nepalBoundaryVariant: "claim"` (uses geoBoundaries' ADM0, which does include it); the frame then states the dispute instead of stating that the claim is omitted. Either way a note is burned into the frame — this is deliberate, not something to clean up by removing it.

### `region.names` / `region.parentName` (generic, any `establishingZoom`/`choropleth`/etc. shot, any admin level)

- `region.names: ["Kaski"]` selects only the named unit(s) instead of every unit at that level — resolved the same safe way `regionHighlight`'s `highlight` is (exact/aliased match only, throws with the full list on a miss, never silent substring matching). Use this for a "zoom to one district" shot without going through `regionHighlight`.
- `region.parentName: "Gandaki"` filters to units whose parent matches (e.g. `adminLevel: 2` + `parentName: "Gandaki"` = every district in Gandaki province; `adminLevel: 3` + `parentName: "Kaski"` = every municipality in Kaski district). Only works where the source stamps a parent name on each feature — true for Nepal's OCHA layers, not attempted as a spatial join for other sources.

### Dataset attribution (automatic)

`draft` records every dataset actually used (Natural Earth admin-0/1, geoBoundaries per-country ADM0/1/2/3, Esri World Imagery when `basemap: "satellite"`) in the returned `attribution` array and burns a small credit line into the bottom-right of every frame. Never remove or edit that credit — the license (public domain for Natural Earth, CC-BY/CC-BY-SA for geoBoundaries, Esri's own terms for World Imagery) requires it to survive into the rendered output.

## Render approval (`agent-map.mjs generate --project <id> --approval <file>`)

```json
{
  "confirmRender": true,
  "sceneChecksum": "<sha256 from the draft output's sceneChecksum field>"
}
```

`generate` recomputes the checksum of the project's current `scene.json` and refuses to run if it doesn't match — this is what stops a render from ever running against a plan the user didn't actually see. If the manifest changes after approval, re-run `draft` and get a fresh approval with the new checksum; never patch `sceneChecksum` by hand to make an old approval match a new plan.
