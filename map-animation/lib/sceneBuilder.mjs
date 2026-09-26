import { loadAdmin0, loadAdmin1, loadGeoBoundaries, loadNepalOcha, findCountry, geocode, isDisputedFeature, SOURCES } from "./geodata.mjs";
import { greatCircleArc, bboxOfGeometry, centroidOfBbox, fitBbox, labelPoint } from "./geomath.mjs";
import { applyDisplayNames, resolveNames } from "./regionNames.mjs";

const ASPECTS = {
  "16:9": { width: 1920, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "1:1": { width: 1080, height: 1080 }
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function tagFeature(feature, index, extraProps = {}) {
  return { ...feature, id: index, properties: { ...feature.properties, __disputed: isDisputedFeature(feature.properties), ...extraProps } };
}

// Nepal is special-cased end-to-end (ADM0-ADM3) rather than handled by the
// generic Natural-Earth/geoBoundaries split below. Verified by direct
// inspection, not assumption (see MEMORY.md):
//  - geoBoundaries' NPL ADM2 (district) layer is the pre-2017 75-district
//    file with real defects: duplicate "Bara"/"Saptari" labels (really Parsa/
//    Siraha), no Rupandehi polygon, Dailekh labelled Jajarkot.
//  - UN OCHA's COD-AB for Nepal (data.humdata.org, cod-ab-npl) is correct and
//    current across ALL four levels: exactly 77 districts, no mislabelling,
//    every level carries its own parent name/pcode (adm1_name, adm2_name,
//    ...), and — measured directly — all four levels agree on the exact same
//    boundary in the Darchula/Kalapani corner (no seam), because it follows
//    the boundary neutral/UN sources use rather than Nepal's 2020 claim.
//  - geoBoundaries' NPL ADM0 *does* include that 2020 claim (the
//    Kalapani-Lipulekh-Limpiyadhura extension near Darchula, which India
//    disputes) — useful when a shot specifically wants to show Nepal's
//    official map, but it disagrees with every other source's subdivisions
//    by ~30km there, so it is opt-in rather than the default.
// Default: OCHA for every level (0-3), consistent, no claim. Opt in to the
// claimed ADM0 outline with `region.nepalBoundaryVariant: "claim"`.
const NEPAL_ISO3 = "NPL";
const NEPAL_CLAIM_NOTE =
  "This map shows Nepal's official 2020 boundary (Survey Department of Nepal / Open Data Nepal), which includes the Kalapani-Lipulekh-Limpiyadhura area near Darchula. India disputes this and administers/maps the same area as part of Uttarakhand.";
const NEPAL_NO_CLAIM_NOTE =
  "Nepal's boundary here follows UN/OCHA convention and does not include the Kalapani-Lipulekh-Limpiyadhura area near Darchula that Nepal's 2020 official map claims — a separate, live boundary dispute with India.";

async function resolveAdmin0Feature(name, notes, opts = {}) {
  const country = await findCountry(name);
  if (country.iso3 !== NEPAL_ISO3) return { feature: country.feature, iso3: country.iso3, name: country.name, source: "naturalEarth" };
  // Deliberately not stamping a NAME property onto either feature here: the
  // caller's tagFeature(..., {NAME: r.name}) already adds one, and it must
  // be added *after* isDisputedFeature() runs — that heuristic compares NAME
  // against BRK_NAME, a Natural-Earth-only field neither source has, so a
  // NAME with no matching BRK_NAME reads as a false "disputed" mismatch and
  // dashes the entire border, not just an intentionally-flagged segment.
  if (opts.nepalBoundaryVariant === "claim") {
    const { geojson, attribution } = await loadGeoBoundaries(NEPAL_ISO3, "ADM0");
    notes.add(NEPAL_CLAIM_NOTE);
    return { feature: geojson.features[0], iso3: NEPAL_ISO3, name: "Nepal", source: attribution };
  }
  const { geojson, attribution } = await loadNepalOcha(0);
  notes.add(NEPAL_NO_CLAIM_NOTE);
  return { feature: geojson.features[0], iso3: NEPAL_ISO3, name: "Nepal", source: attribution };
}

function unionBbox(features) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features) {
    const [a, b, c, d] = bboxOfGeometry(f.geometry);
    minX = Math.min(minX, a);
    minY = Math.min(minY, b);
    maxX = Math.max(maxX, c);
    maxY = Math.max(maxY, d);
  }
  return [minX, minY, maxX, maxY];
}

async function resolveRegion(region, attribution, notes) {
  const level = region.adminLevel ?? 0;
  const countries = region.countries || (region.query ? [region.query] : []);

  if (region.scope === "world" || (countries.length === 1 && String(countries[0]).toLowerCase() === "world")) {
    const admin0 = await loadAdmin0();
    attribution.add(SOURCES.admin0.attribution);
    return { features: admin0.features.map((f, i) => tagFeature(f, i)), iso3: null, name: "World" };
  }

  if (level === 0) {
    const resolved = [];
    for (const name of countries) resolved.push(await resolveAdmin0Feature(name, notes, { nepalBoundaryVariant: region.nepalBoundaryVariant }));
    resolved.forEach((r) => attribution.add(r.source === "naturalEarth" ? SOURCES.admin0.attribution : r.source));
    return { features: resolved.map((r, i) => tagFeature(r.feature, i, { NAME: r.name })), iso3: resolved[0]?.iso3, name: resolved.map((r) => r.name).join(", ") };
  }

  if (countries.length !== 1) throw new Error("Admin level 1/2/3 regions require exactly one country in `region.countries`.");
  const country = await findCountry(countries[0]);
  const iso3 = country.iso3;

  let features;
  if (iso3 === NEPAL_ISO3) {
    if (![1, 2, 3].includes(level)) throw new Error(`Unsupported adminLevel ${level}. Use 0 (country), 1 (province), 2 (district), or 3 (municipality).`);
    const { geojson, attribution: ochaAttribution } = await loadNepalOcha(level);
    attribution.add(ochaAttribution);
    features = geojson.features;
  } else if (level === 1) {
    const admin1 = await loadAdmin1();
    attribution.add(SOURCES.admin1.attribution);
    features = admin1.features.filter((f) => f.properties.adm0_a3 === iso3);
    if (!features.length) throw new Error(`No admin-1 (state/province) data found for ${country.name} in Natural Earth.`);
  } else if ([2, 3].includes(level)) {
    const { geojson, attribution: gbAttribution } = await loadGeoBoundaries(iso3, `ADM${level}`);
    attribution.add(gbAttribution);
    features = geojson.features;
  } else {
    throw new Error(`Unsupported adminLevel ${level}. Use 0 (country), 1 (state/province), 2 (district/county), or 3 (municipality) where geoBoundaries covers it.`);
  }

  // Containment filter by parent unit name — only meaningful where the
  // source stamps a parent name on every feature (OCHA's Nepal layers do:
  // adm1_name/adm2_name on every ADM2/ADM3 feature; a spatial join would be
  // needed for sources that don't, which this does not attempt).
  if (region.parentName) {
    const parentField = `adm${level - 1}_name`;
    const key = normalize(region.parentName);
    const filtered = features.filter((f) => normalize(f.properties[parentField]) === key);
    if (!filtered.length) throw new Error(`No level-${level} units found with parent "${region.parentName}" (checked ${parentField}; that field may not exist on this source).`);
    features = filtered;
  }

  let tagged = features.map((f, i) => tagFeature(f, i));

  // Selection filter by exact name(s) — reuses regionHighlight's safe
  // resolver (exact/aliased match only, never silent substring matching, and
  // it throws with the full available list on a miss instead of guessing).
  if (region.names?.length) {
    const labelled = applyDisplayNames(tagged, { iso3, level });
    const idx = resolveNames(region.names, labelled);
    tagged = idx.map((i, newI) => tagFeature(labelled[i], newI));
  }

  return { features: tagged, iso3, name: country.name };
}

async function resolvePoint(spec) {
  if (spec.coords) return { lon: spec.coords[0], lat: spec.coords[1], label: spec.label || spec.query };
  const hit = await geocode(spec.query);
  return { lon: hit.lon, lat: hit.lat, label: spec.label || spec.query };
}

function buildChoroplethColorExpression(field, ramp, domain, noDataColor) {
  const [lo, hi] = domain;
  const stops = ramp.length > 1 ? ramp : [ramp[0], ramp[0]];
  const step = (hi - lo) / (stops.length - 1 || 1);
  const rampExpr = ["interpolate", ["linear"], ["coalesce", ["get", field], lo]];
  stops.forEach((color, i) => rampExpr.push(lo + step * i, color));
  return ["case", ["==", ["get", "__noData"], true], noDataColor, rampExpr];
}

function joinValues(features, dataSource) {
  if (!dataSource) return features;
  const values = dataSource.values || {};
  return features.map((f) => {
    const p = f.properties;
    const key3 = p.ADM0_A3 || p.adm0_a3 || p.shapeGroup;
    const key2 = p.ISO_A2 || p.iso_a2;
    // Nepal (OCHA) features carry pcodes and one populated adm{N}_name field
    // depending on level; other sources use NAME/name/shapeName.
    const keyPcode = p.adm1_pcode || p.adm2_pcode || p.adm3_pcode;
    const keyName = p.NAME || p.name || p.shapeName || p.adm1_name || p.adm2_name || p.adm3_name;
    const value = values[key3] ?? values[key2] ?? values[keyPcode] ?? values[keyName] ?? null;
    return { ...f, properties: { ...f.properties, __value: value, __noData: value === null || value === undefined } };
  });
}

function domainOf(features) {
  const vals = features.map((f) => f.properties.__value).filter((v) => typeof v === "number");
  if (!vals.length) return [0, 1];
  return [Math.min(...vals), Math.max(...vals)];
}

const HIGHLIGHT_ACCENT = "#ffb703";
const HIGHLIGHT_CYCLE = ["#ffb703", "#4cc9f0", "#ef476f", "#06d6a0", "#b388ff", "#ff7a45", "#f4d35e"];

function bboxArea(feature) {
  const [a, b, c, d] = bboxOfGeometry(feature.geometry);
  return (c - a) * (d - b);
}

// National outline derived from the subdivisions themselves: every edge that
// belongs to exactly one polygon is on the outside. Only valid for a
// topologically clean layer (Nepal ADM3: ~all interior edges are shared by two
// municipalities); it makes the outline and the internal borders agree by
// construction instead of mixing two upstream files. Returns chained lines.
function outerEdgeLines(features) {
  const q = (n) => Math.round(n * 1e6);
  const key = ([x, y]) => `${q(x)},${q(y)}`;
  const edges = new Map();
  for (const f of features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        for (let i = 0; i + 1 < ring.length; i++) {
          const a = key(ring[i]);
          const b = key(ring[i + 1]);
          if (a === b) continue;
          const k = a < b ? `${a}|${b}` : `${b}|${a}`;
          const e = edges.get(k);
          if (e) e.n++;
          else edges.set(k, { n: 1, a: ring[i], b: ring[i + 1], ka: a, kb: b, used: false });
        }
      }
    }
  }
  const outer = [...edges.values()].filter((e) => e.n === 1);
  const at = new Map();
  const link = (k, e) => (at.get(k) || at.set(k, []).get(k)).push(e);
  outer.forEach((e) => {
    link(e.ka, e);
    link(e.kb, e);
  });
  const lines = [];
  for (const start of outer) {
    if (start.used) continue;
    start.used = true;
    const coords = [start.a, start.b];
    let tail = start.kb;
    for (;;) {
      const next = (at.get(tail) || []).find((e) => !e.used);
      if (!next) break;
      next.used = true;
      if (next.ka === tail) {
        coords.push(next.b);
        tail = next.kb;
      } else {
        coords.push(next.a);
        tail = next.ka;
      }
    }
    lines.push(coords);
  }
  return { type: "Feature", id: 0, properties: {}, geometry: { type: "MultiLineString", coordinates: lines } };
}

// Parse `highlight` into entries: "all" | ["Bagmati", {name|names, label, color}].
function parseHighlight(spec, features) {
  if (spec === "all" || spec === undefined) {
    const lon = (i) => centroidOfBbox(bboxOfGeometry(features[i].geometry))[0];
    const order = features.map((_, i) => i).sort((a, b) => lon(a) - lon(b));
    return order.map((i) => ({ idx: [i], label: features[i].properties.__label }));
  }
  if (!Array.isArray(spec) || !spec.length) throw new Error('regionHighlight: `highlight` must be "all" or a non-empty array of names / {name|names,label,color}.');
  return spec.map((item) => {
    const obj = typeof item === "string" ? { name: item } : item;
    const names = obj.names || (obj.name ? [obj.name] : []);
    if (!names.length) throw new Error("regionHighlight: each highlight entry needs `name` or `names`.");
    const idx = resolveNames(names, features);
    return { idx, label: obj.label ?? (idx.length === 1 ? features[idx[0]].properties.__label : names.join(" + ")), color: obj.color };
  });
}

// Country & regional highlighting: draw every subdivision with crisp borders,
// then spotlight named regions one at a time (or together) with the camera
// following each. All geometry comes from the datasets in resolveRegion().
async function buildRegionHighlight(shot, spec, disputedOutline, attribution, notes, view) {
  const level = spec.region?.adminLevel ?? 1;
  const countries = spec.region?.countries || (spec.region?.query ? [spec.region.query] : []);
  const region = await resolveRegion(spec.region, attribution, notes);
  const features = applyDisplayNames(region.features, { iso3: region.iso3, level });
  const entries = parseHighlight(spec.highlight, features);
  const mode = spec.mode || "sequential";
  if (!["sequential", "together"].includes(mode)) throw new Error(`regionHighlight mode must be "sequential" or "together", got "${mode}".`);
  const keepPrevious = (spec.previous || "fade") === "keep";
  const dur = spec.endSec - spec.startSec;
  const intro = spec.introSec ?? Math.min(1.2, dur * 0.15);
  const outro = mode === "sequential" ? spec.holdSec ?? Math.min(0.8, dur * 0.1) : 0;
  const body = dur - intro - outro;
  if (body <= 0) throw new Error(`regionHighlight shot "${shot.id}" is too short (${dur}s) for its intro/hold; lengthen it or set introSec/holdSec.`);
  const slot = mode === "sequential" ? body / entries.length : body;
  const t0 = spec.startSec + intro;
  if (mode === "sequential" && slot < 0.6) {
    throw new Error(`regionHighlight shot "${shot.id}": ${entries.length} regions in ${body.toFixed(1)}s leaves ${slot.toFixed(2)}s each - too fast to read. Need at least 0.6s per region (${(entries.length * 0.6 + intro + outro).toFixed(1)}s total), or use mode "together".`);
  }

  entries.forEach((entry, n) => {
    const color = entry.color || spec.color || (spec.palette === "cycle" ? HIGHLIGHT_CYCLE[n % HIGHLIGHT_CYCLE.length] : HIGHLIGHT_ACCENT);
    entry.start = mode === "sequential" ? t0 + n * slot : t0;
    const fadeIn = Math.min(0.5, slot * 0.3);
    for (const i of entry.idx) {
      const p = features[i].properties;
      p.__hlIn0 = entry.start;
      p.__hlIn1 = entry.start + fadeIn;
      p.__hlColor = color;
      if (mode === "sequential" && !keepPrevious && n < entries.length - 1) {
        p.__hlOut0 = entry.start + slot;
        p.__hlOut1 = entry.start + slot + Math.min(0.4, slot * 0.25);
      }
    }
  });

  // Each label names exactly the region being lit and disappears when it fades.
  if (spec.labels !== false) {
    entries.forEach((entry, n) => {
      const biggest = entry.idx.reduce((a, b) => (bboxArea(features[b]) > bboxArea(features[a]) ? b : a), entry.idx[0]);
      const fades = mode === "sequential" && !keepPrevious && n < entries.length - 1;
      shot.labels.push({ text: entry.label.replace(/ Province$/, "\nProvince"), at: labelPoint(features[biggest].geometry), showAtSec: entry.start + 0.15, hideAtSec: fades ? entry.start + slot : null, style: "region" });
    });
  }

  // Camera: whole-region establishing frame, then (sequential) a glide to each
  // highlight. Both axes and padding are fitted; tiny regions keep some context.
  // Subdivisions of one country: frame the whole country. Country-level
  // highlighting: frame the highlighted countries with generous context, not
  // every listed neighbour (a huge neighbour would shrink the subject to a sliver).
  const framed = level === 0 ? [...new Set(entries.flatMap((e) => e.idx))].map((i) => features[i]) : features;
  const all = fitBbox(unionBbox(framed), { ...view, padding: level === 0 ? 0.25 : 0.1, minSpanDeg: level === 0 ? 8 : 0 });
  if (spec.camera) {
    shot.camera = spec.camera;
  } else if (spec.cameraMode === "fit" || mode === "together") {
    shot.camera = { from: { ...all, pitch: 0, bearing: 0 }, to: { center: all.center, zoom: all.zoom + 0.2, pitch: 0, bearing: 0 }, easing: "easeInOutCubic" };
  } else {
    const path = [
      { atSec: spec.startSec, ...all },
      { atSec: t0, ...all }
    ];
    const trans = Math.min(1.1, slot * 0.4);
    let prev = all;
    entries.forEach((entry, n) => {
      const fit = fitBbox(unionBbox(entry.idx.map((i) => features[i])), {
        ...view,
        padding: spec.padding ?? 0.26,
        minSpanDeg: spec.minSpanDeg ?? (level >= 2 ? 0.5 : 0.9)
      });
      if (n > 0) path.push({ atSec: entry.start, ...prev });
      path.push({ atSec: entry.start + trans, ...fit, dip: n > 0 ? 0.45 : 0 });
      prev = fit;
    });
    path.push({ atSec: spec.endSec, ...prev });
    shot.cameraPath = path.map((k) => ({ ...k, pitch: 0, bearing: 0 }));
  }

  // National outline on top; everything outside it is dimmed by a mask cut from
  // that same outline (so no second, slightly different border is ever drawn).
  let outline = null;
  let outlineRings = [];
  // countryOutline: "adm0" (official country file), "subdivisions" (perimeter
  // of the subdivisions, exact by construction), or false. Default: derive
  // Nepal's outline from whichever subdivision layer was just fetched (OCHA
  // is topologically clean and this guarantees zero seam with it by
  // construction, rather than trusting a second file to happen to agree);
  // every other country uses the separate ADM0 file.
  const isNepal = region.iso3 === NEPAL_ISO3;
  const outlineMode = spec.countryOutline ?? (isNepal ? "subdivisions" : "adm0");
  if (level >= 1 && outlineMode === "subdivisions") {
    const lines = outerEdgeLines(features);
    outline = { type: "FeatureCollection", features: [lines] };
    outlineRings = lines.geometry.coordinates.filter((c) => c.length > 3 && c[0][0] === c.at(-1)[0] && c[0][1] === c.at(-1)[1]);
    if (isNepal) notes.add(NEPAL_NO_CLAIM_NOTE);
  } else if (level >= 1 && outlineMode !== false) {
    const country = await resolveAdmin0Feature(countries[0], notes, { nepalBoundaryVariant: spec.region?.nepalBoundaryVariant });
    attribution.add(country.source === "naturalEarth" ? SOURCES.admin0.attribution : country.source);
    outline = { type: "FeatureCollection", features: [{ type: "Feature", id: 0, properties: {}, geometry: country.feature.geometry }] };
    const polys = country.feature.geometry.type === "Polygon" ? [country.feature.geometry.coordinates] : country.feature.geometry.coordinates;
    outlineRings = polys.map((p) => p[0]);
  }
  let context = null;
  if (outlineRings.length && spec.region?.context !== false) {
    const [x0, y0, x1, y1] = unionBbox(features);
    const rect = [[x0 - 12, y0 - 12], [x1 + 12, y0 - 12], [x1 + 12, y1 + 12], [x0 - 12, y1 + 12], [x0 - 12, y0 - 12]];
    // Holes must wind opposite to the outer ring (rect is counter-clockwise).
    const signed = (r) => r.reduce((a, p, i) => a + (i ? r[i - 1][0] * p[1] - p[0] * r[i - 1][1] : 0), 0);
    const holes = outlineRings.map((r) => (signed(r) > 0 ? [...r].reverse() : r));
    context = [{ type: "Feature", id: 0, properties: {}, geometry: { type: "Polygon", coordinates: [rect, ...holes] } }];
  }

  shot.layers.push({
    id: `${shot.id}-highlight`,
    type: "regionHighlight",
    data: { type: "FeatureCollection", features },
    context: context ? { type: "FeatureCollection", features: context } : null,
    outline,
    baseOpacity: spec.baseOpacity ?? 0.3,
    highlightOpacity: spec.highlightOpacity ?? 0.55,
    borderColor: spec.borderColor || "#ffffff",
    disputedOutline,
    reveal: { mode: "fade", startSec: spec.startSec, endSec: spec.startSec + Math.max(0.4, intro) }
  });
}

async function buildShot(shotSpec, disputedPolicy, attribution, notes, view) {
  const shot = {
    id: shotSpec.id,
    startSec: shotSpec.startSec,
    endSec: shotSpec.endSec,
    title: shotSpec.title,
    labels: [],
    legend: shotSpec.legend || null,
    dateCounter: shotSpec.dateCounter || null,
    layers: []
  };

  for (const l of shotSpec.labels || []) {
    const p = await resolvePoint(l);
    shot.labels.push({ text: l.text || p.label, at: [p.lon, p.lat], showAtSec: l.showAtSec ?? shotSpec.startSec });
  }

  const disputedOutline = disputedPolicy !== "hide";

  if (shotSpec.kind === "establishingZoom" || shotSpec.kind === "isometricFlyover" || shotSpec.kind === "globeHighlight") {
    const region = await resolveRegion(shotSpec.region, attribution, notes);
    const bbox = unionBbox(region.features);
    const fit = fitBbox(bbox, { ...view, padding: shotSpec.padding ?? 0.12, minSpanDeg: shotSpec.minSpanDeg ?? 0 });
    // Center stays fixed on the target throughout and only zoom (plus pitch/
    // bearing for a flyover) animates. Panning the center *and* zooming at
    // the same time makes the subject invisible until the pan nearly
    // arrives (it is off-screen at low zoom far from the target) — keeping
    // center fixed avoids that class of bug and reads as a clean push-in.
    shot.camera = shotSpec.camera || {
      from: { center: fit.center, zoom: shotSpec.kind === "globeHighlight" ? 0.8 : 0.6, pitch: 0, bearing: 0 },
      to: { center: fit.center, zoom: fit.zoom, pitch: shotSpec.kind === "isometricFlyover" ? 55 : 0, bearing: shotSpec.kind === "isometricFlyover" ? 25 : 0 },
      easing: "easeInOutCubic"
    };
    shot.layers.push({
      id: `${shot.id}-region`,
      type: "fill",
      data: { type: "FeatureCollection", features: region.features },
      color: shotSpec.color || "#e0b354",
      opacity: 0.5,
      disputedOutline,
      reveal: { mode: "fade", startSec: shotSpec.startSec, endSec: Math.min(shotSpec.endSec, shotSpec.startSec + 1.2) }
    });
  } else if (shotSpec.kind === "regionHighlight") {
    await buildRegionHighlight(shot, shotSpec, disputedOutline, attribution, notes, view);
  } else if (shotSpec.kind === "choropleth") {
    const region = await resolveRegion(shotSpec.region, attribution, notes);
    const dataSource = shotSpec.dataSourceRef;
    const withValues = joinValues(region.features, dataSource);
    const domain = shotSpec.domain || domainOf(withValues);
    const ramp = shotSpec.colorRamp || ["#12263a", "#1f6f8b", "#99e2b4", "#f4d35e"];
    shot.layers.push({
      id: `${shot.id}-choropleth`,
      type: "fill",
      data: { type: "FeatureCollection", features: withValues },
      colorExpression: buildChoroplethColorExpression("__value", ramp, domain, shotSpec.noDataColor || "#2a2a30"),
      disputedOutline,
      opacity: 0.6,
      reveal: { mode: shotSpec.revealMode || "sequential", startSec: shotSpec.startSec, endSec: shotSpec.endSec }
    });
    if (shotSpec.revealMode === "sequential" || !shotSpec.revealMode) {
      withValues.sort((a, b) => (a.properties.__value ?? -Infinity) - (b.properties.__value ?? -Infinity));
    }
    shot.legend = shot.legend || {
      title: dataSource?.unit ? `Value (${dataSource.unit})` : "Value",
      colorRamp: ramp,
      min: domain[0],
      max: domain[1],
      noDataNote: withValues.some((f) => f.properties.__noData) ? "Grey = no data" : null
    };
    const bbox = unionBbox(withValues);
    const fit = fitBbox(bbox, { ...view, padding: shotSpec.padding ?? 0.1 });
    shot.camera = shotSpec.camera || {
      from: { center: fit.center, zoom: Math.max(0, fit.zoom - 0.6), pitch: 0, bearing: 0 },
      to: { center: fit.center, zoom: fit.zoom, pitch: 0, bearing: 0 },
      easing: "easeOutCubic"
    };
  } else if (shotSpec.kind === "flowArcs") {
    const features = [];
    for (const pair of shotSpec.pairs) {
      const from = await resolvePoint(pair.from);
      const to = await resolvePoint(pair.to);
      features.push({
        type: "Feature",
        id: features.length,
        properties: { weight: pair.weight ?? 1, __disputed: false },
        geometry: { type: "LineString", coordinates: greatCircleArc([from.lon, from.lat], [to.lon, to.lat], { liftDeg: shotSpec.liftDeg ?? 6 }) }
      });
    }
    shot.layers.push({
      id: `${shot.id}-arcs`,
      type: "line",
      data: { type: "FeatureCollection", features },
      color: shotSpec.color || "#ffd166",
      width: shotSpec.lineWidth || 2.4,
      draw: { startSec: shotSpec.startSec, endSec: shotSpec.endSec }
    });
    shot.camera = shotSpec.camera || {
      from: { center: [0, 20], zoom: 1.2, pitch: 0, bearing: 0 },
      to: { center: [0, 20], zoom: 1.6, pitch: 0, bearing: 0 },
      easing: "easeInOutCubic"
    };
  } else if (shotSpec.kind === "routeLine") {
    const points = [];
    for (const wp of shotSpec.waypoints) points.push(await resolvePoint(wp));
    const coordinates = points.map((p) => [p.lon, p.lat]);
    shot.layers.push({
      id: `${shot.id}-route`,
      type: "line",
      data: { type: "FeatureCollection", features: [{ type: "Feature", id: 0, properties: { __disputed: false }, geometry: { type: "LineString", coordinates } }] },
      color: shotSpec.color || "#06d6a0",
      width: shotSpec.lineWidth || 3,
      draw: { startSec: shotSpec.startSec, endSec: shotSpec.endSec }
    });
    shotSpec.waypoints.forEach((wp, i) => {
      const point = points[i];
      shot.labels.push({ text: wp.label || wp.query, at: [point.lon, point.lat], showAtSec: shotSpec.startSec + (i / points.length) * (shotSpec.endSec - shotSpec.startSec) });
    });
    const bbox = coordinates.reduce(
      ([minX, minY, maxX, maxY], [x, y]) => [Math.min(minX, x), Math.min(minY, y), Math.max(maxX, x), Math.max(maxY, y)],
      [Infinity, Infinity, -Infinity, -Infinity]
    );
    const fit = fitBbox(bbox, { ...view, padding: shotSpec.padding ?? 0.15 });
    shot.camera = shotSpec.camera || {
      from: { center: fit.center, zoom: Math.max(0, fit.zoom - 1), pitch: 0, bearing: 0 },
      to: { center: fit.center, zoom: fit.zoom, pitch: 0, bearing: 0 },
      easing: "easeInOutCubic"
    };
  } else if (shotSpec.kind === "dotDensity" || shotSpec.kind === "proportionalSymbol") {
    const points = shotSpec.points || [];
    const values = points.map((p) => p.value ?? 1);
    const maxVal = Math.max(...values, 1);
    const features = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i].coords ? { lon: points[i].coords[0], lat: points[i].coords[1] } : await resolvePoint(points[i]);
      const baseRadius = shotSpec.kind === "proportionalSymbol" ? 4 + 26 * Math.sqrt((points[i].value ?? 1) / maxVal) : shotSpec.dotRadius || 3;
      features.push({ type: "Feature", id: i, properties: { __disputed: false, __baseRadius: baseRadius, value: points[i].value ?? 1 }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
    }
    shot.layers.push({
      id: `${shot.id}-points`,
      type: "circle",
      data: { type: "FeatureCollection", features },
      color: shotSpec.color || "#ef476f",
      opacity: 0.85,
      reveal: { mode: shotSpec.kind === "dotDensity" ? "sequential" : "grow", startSec: shotSpec.startSec, endSec: shotSpec.endSec }
    });
    const bbox = features.length ? unionBbox(features) : [-20, -10, 20, 10];
    const fit = fitBbox(bbox, { ...view, padding: shotSpec.padding ?? 0.15 });
    shot.camera = shotSpec.camera || {
      from: { center: fit.center, zoom: Math.max(0, fit.zoom - 0.5), pitch: 0, bearing: 0 },
      to: { center: fit.center, zoom: fit.zoom, pitch: 0, bearing: 0 },
      easing: "easeOutCubic"
    };
  } else if (shotSpec.kind === "heatmapDensity") {
    const points = shotSpec.points || [];
    const features = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i].coords ? { lon: points[i].coords[0], lat: points[i].coords[1] } : await resolvePoint(points[i]);
      features.push({ type: "Feature", id: i, properties: { value: points[i].value ?? 1, __disputed: false }, geometry: { type: "Point", coordinates: [p.lon, p.lat] } });
    }
    shot.layers.push({
      id: `${shot.id}-heat`,
      type: "heatmap",
      data: { type: "FeatureCollection", features },
      weightField: "value",
      opacity: 0.85,
      reveal: { startSec: shotSpec.startSec, endSec: shotSpec.endSec }
    });
    const bbox = features.length ? unionBbox(features) : [-20, -10, 20, 10];
    const fit = fitBbox(bbox, { ...view, padding: shotSpec.padding ?? 0.15 });
    shot.camera = shotSpec.camera || {
      from: { center: fit.center, zoom: fit.zoom, pitch: 0, bearing: 0 },
      to: { center: fit.center, zoom: fit.zoom, pitch: 0, bearing: 0 },
      easing: "linear"
    };
  } else if (shotSpec.kind === "borderTimelapse") {
    if (!shotSpec.keyframes?.length) throw new Error(`borderTimelapse shot "${shotSpec.id}" needs at least one keyframe with user-supplied geojson (no bundled historical dataset — see references/contracts.md).`);
    const layerId = `${shot.id}-timelapse`;
    shot.layers.push({
      id: layerId,
      type: "fill",
      data: shotSpec.keyframes[0].geojson,
      color: shotSpec.color || "#e0b354",
      opacity: 0.75,
      disputedOutline: false,
      reveal: { mode: "fade", startSec: shotSpec.startSec, endSec: shotSpec.startSec + 0.5 }
    });
    shot.borderTimelapse = { layerId, keyframes: shotSpec.keyframes.map((k) => ({ atSec: k.atSec, geojson: k.geojson })) };
    shot.dateCounter = shot.dateCounter || { startYear: shotSpec.keyframes[0].year, endYear: shotSpec.keyframes.at(-1).year, startSec: shotSpec.startSec, endSec: shotSpec.endSec };
    shot.camera = shotSpec.camera || { from: { center: [0, 20], zoom: 2, pitch: 0, bearing: 0 }, to: { center: [0, 20], zoom: 2, pitch: 0, bearing: 0 }, easing: "linear" };
  } else {
    throw new Error(`Unknown shot kind "${shotSpec.kind}".`);
  }

  return shot;
}

export async function buildScene(manifest) {
  const { width, height } = manifest.resolution || ASPECTS[manifest.aspectRatio || "16:9"];
  const attribution = new Set(manifest.attributionExtra || []);
  const notes = new Set(manifest.editorialNotes || []);
  const disputedPolicy = manifest.disputedBorderPolicy || "flag-dashed";
  const basemap = manifest.basemap || "satellite";
  if (basemap === "satellite") attribution.add("Esri, Maxar, Earthstar Geographics — World Imagery");

  const panes = [];
  for (const paneSpec of manifest.panes) {
    const timeline = [];
    const view = { width: width / manifest.panes.length, height };
    for (const shotSpec of paneSpec.shots) timeline.push(await buildShot(shotSpec, disputedPolicy, attribution, notes, view));
    panes.push({ id: paneSpec.id, projection: paneSpec.projection || "mercator", timeline });
  }

  const durationSec = manifest.durationSec || Math.max(...panes.flatMap((p) => p.timeline.map((s) => s.endSec)));

  return {
    id: manifest.projectId,
    title: manifest.title,
    fps: manifest.fps || 30,
    durationSec,
    width,
    height,
    background: manifest.background || { ocean: "#050507", land: "#1c1c22" },
    basemap,
    disputedBorderPolicy: disputedPolicy,
    panes,
    attribution: [...attribution],
    editorialNotes: [...notes]
  };
}
