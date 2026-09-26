import { Map as MapLibreMap, setNow } from "/node_modules/maplibre-gl/dist/maplibre-gl.mjs";
import { EASING, sliceLineByFraction } from "/lib/geomath.mjs";

const params = new URLSearchParams(location.search);
const sceneUrl = params.get("scene");
if (!sceneUrl) throw new Error("map-runtime: missing ?scene= query param");

const scene = await (await fetch(sceneUrl)).json();
document.title = scene.title || scene.id || "map-animation-studio";

// Deliberately NOT sized to scene.width/height in pixels: the CSS already
// fills 100% of the document (see map.html), which is exactly right in both
// contexts this page runs in — Puppeteer capture, where page.setViewport()
// is set to exactly scene.width x scene.height so 100% resolves to that
// same pixel size, and a live browser/iframe preview, where the embedding
// page controls the iframe's actual box size (typically smaller, to fit a
// letterboxed player) and this page should simply fill whatever it's given.
// Pinning this to scene.width/height in px would render at native export
// resolution even inside a much smaller preview iframe, forcing the browser
// to scale the whole canvas down — blurry and not a true render of what the
// preview box shows.
const stage = document.getElementById("stage");

// Esri World Imagery: free, keyless, CORS-enabled satellite basemap tiles.
// This gives the "real satellite" look the borders/choropleth are drawn on
// top of; the borders themselves still come from our own vector geodata,
// never from the imagery, so factual accuracy of the overlay is unaffected
// by which basemap sits underneath it.
const SATELLITE_TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

// Frames are rendered against a virtual clock (setNow), so MapLibre's default
// 300ms paint-property transitions would leave every value mid-fade after a
// time jump and make a frame depend on which frames were rendered before it.
// Zero-duration transitions make each frame a pure function of t.
const NO_TRANSITION = { duration: 0, delay: 0 };

function buildBaseStyle() {
  if (scene.basemap === "flat") {
    return { version: 8, transition: NO_TRANSITION, sources: {}, layers: [{ id: "ms-ocean-bg", type: "background", paint: { "background-color": scene.background?.ocean || "#050507" } }] };
  }
  return {
    version: 8,
    transition: NO_TRANSITION,
    sources: {
      "ms-satellite": { type: "raster", tiles: [SATELLITE_TILE_URL], tileSize: 256, maxzoom: 19, attribution: "Esri, Maxar, Earthstar Geographics" }
    },
    layers: [
      { id: "ms-satellite", type: "raster", source: "ms-satellite", paint: { "raster-saturation": -0.15, "raster-contrast": 0.05, "raster-fade-duration": 0 } },
      // A faint dark scrim keeps bright imagery (snow, desert, cloud) from
      // washing out the border/label overlay on top of it.
      { id: "ms-scrim", type: "background", paint: { "background-color": "#000000", "background-opacity": 0.15 } }
    ]
  };
}

const paneCount = scene.panes.length;
const panes = scene.panes.map((paneSpec, index) => {
  const container = document.createElement("div");
  container.className = "ms-pane";
  const wPct = 100 / paneCount;
  container.style.left = `${index * wPct}%`;
  container.style.width = `${wPct}%`;
  const mapDiv = document.createElement("div");
  mapDiv.id = "map";
  container.appendChild(mapDiv);
  const overlay = document.createElement("div");
  overlay.className = "ms-overlay";
  container.appendChild(overlay);
  stage.appendChild(container);

  const map = new MapLibreMap({
    container: mapDiv,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    projection: paneSpec.projection === "globe" ? { type: "globe" } : { type: "mercator" },
    style: buildBaseStyle(),
    center: [0, 20],
    zoom: 1
  });

  return { spec: paneSpec, map, container, overlay, labelEls: new Map(), addedLayerIds: new Set(), lineBaseCoords: new Map() };
});

await Promise.all(
  panes.map(
    (pane) =>
      new Promise((resolve) => {
        if (pane.map.loaded()) resolve();
        else pane.map.once("load", resolve);
      })
  )
);

function ensureSource(map, id, geojson) {
  if (!map.getSource(id)) map.addSource(id, { type: "geojson", data: geojson, lineMetrics: true });
}

function addLayerIfMissing(pane, layerDef) {
  const { map } = pane;
  if (pane.addedLayerIds.has(layerDef.id)) return;
  const srcId = `${layerDef.id}-src`;
  ensureSource(map, srcId, layerDef.data);

  if (layerDef.type === "fill") {
    map.addLayer({
      id: layerDef.id,
      type: "fill",
      source: srcId,
      paint: {
        "fill-color": layerDef.colorExpression || layerDef.color || "#3388ff",
        "fill-opacity": 0
      }
    });
    // A wider, blurred "glow" line under a thin sharp line reads clearly
    // against bright/high-contrast satellite imagery (snow, desert, cloud)
    // in a way a single thin line does not — the standard broadcast-graphic
    // trick for a border that has to sit on top of a photographic basemap.
    if (layerDef.disputedOutline) {
      map.addLayer({
        id: `${layerDef.id}-disputed-glow`,
        type: "line",
        source: srcId,
        filter: ["==", ["get", "__disputed"], true],
        paint: { "line-color": "#ff7a45", "line-width": 7, "line-blur": 3, "line-opacity": 0 }
      });
      map.addLayer({
        id: `${layerDef.id}-disputed`,
        type: "line",
        source: srcId,
        filter: ["==", ["get", "__disputed"], true],
        paint: { "line-color": "#ffb347", "line-width": 1.8, "line-dasharray": [2, 2], "line-opacity": 0 }
      });
    }
    map.addLayer({
      id: `${layerDef.id}-outline-glow`,
      type: "line",
      source: srcId,
      filter: ["!=", ["get", "__disputed"], true],
      paint: { "line-color": layerDef.borderColor || "#ffe066", "line-width": 6, "line-blur": 3, "line-opacity": 0 }
    });
    map.addLayer({
      id: `${layerDef.id}-outline`,
      type: "line",
      source: srcId,
      filter: ["!=", ["get", "__disputed"], true],
      paint: { "line-color": layerDef.borderColor || "#ffe066", "line-width": 1.6, "line-opacity": 0 }
    });
  } else if (layerDef.type === "regionHighlight") {
    addRegionHighlightLayers(pane, layerDef, srcId);
  } else if (layerDef.type === "line") {
    map.addLayer({
      id: layerDef.id,
      type: "line",
      source: srcId,
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": layerDef.color || "#ffd166",
        "line-width": layerDef.width || 2,
        "line-opacity": 0,
        ...(layerDef.dasharray ? { "line-dasharray": layerDef.dasharray } : {})
      }
    });
    pane.lineBaseCoords.set(layerDef.id, layerDef.data.features.map((f) => f.geometry.coordinates));
  } else if (layerDef.type === "circle") {
    map.addLayer({
      id: layerDef.id,
      type: "circle",
      source: srcId,
      paint: {
        "circle-radius": ["*", 0, ["coalesce", ["get", "__baseRadius"], 4]],
        "circle-color": layerDef.color || "#ef476f",
        "circle-opacity": 0,
        "circle-stroke-width": 0.5,
        "circle-stroke-color": "rgba(255,255,255,0.6)"
      }
    });
  } else if (layerDef.type === "heatmap") {
    map.addLayer({
      id: layerDef.id,
      type: "heatmap",
      source: srcId,
      paint: {
        "heatmap-weight": ["coalesce", ["get", layerDef.weightField || "value"], 1],
        "heatmap-intensity": 1,
        "heatmap-radius": layerDef.radius || 24,
        "heatmap-opacity": 0
      }
    });
  }
  pane.addedLayerIds.add(layerDef.id);
}

// Region highlighting. Design goals: subdivision borders must read as thin,
// hard, exact lines (no blur/glow - a blur widens the line and makes the true
// boundary ambiguous), a dark casing so white borders survive bright satellite
// imagery, and a clearly heavier national outline.
const BORDER_WIDTH = ["interpolate", ["linear"], ["zoom"], 4, 0.9, 7, 1.3, 10, 1.9, 13, 2.6];
const CASING_WIDTH = ["interpolate", ["linear"], ["zoom"], 4, 2.4, 7, 3, 10, 3.8, 13, 5];
const HL_STATE = ["coalesce", ["feature-state", "hl"], 0];
const scaled = (k, expr) => ["interpolate", ["linear"], ["zoom"], ...expr.slice(3).map((v, i) => (i % 2 === 1 ? v * k : v))];

function addRegionHighlightLayers(pane, def, srcId) {
  const { map } = pane;
  const id = def.id;
  const border = def.borderColor || "#ffffff";
  const join = { "line-join": "round" };
  if (def.context) {
    ensureSource(map, id + "-ctx-src", def.context);
    map.addLayer({ id: id + "-ctx-fill", type: "fill", source: id + "-ctx-src", paint: { "fill-color": "#000000", "fill-opacity": 0 } });
  }
  map.addLayer({ id: id + "-base", type: "fill", source: srcId, paint: { "fill-color": "#000000", "fill-opacity": 0 } });
  map.addLayer({
    id: id + "-hl",
    type: "fill",
    source: srcId,
    paint: { "fill-color": ["coalesce", ["get", "__hlColor"], "#ffb703"], "fill-opacity": ["*", HL_STATE, def.highlightOpacity ?? 0.55] }
  });
  map.addLayer({ id: id + "-casing", type: "line", source: srcId, layout: join, paint: { "line-color": "#000000", "line-width": CASING_WIDTH, "line-opacity": 0 } });
  map.addLayer({ id: id + "-line", type: "line", source: srcId, layout: join, paint: { "line-color": border, "line-width": BORDER_WIDTH, "line-opacity": 0 } });
  // Lit region: dark casing + bright edge, drawn above every base border so a
  // neighbour's line can never overpaint it.
  map.addLayer({ id: id + "-hl-casing", type: "line", source: srcId, layout: join, paint: { "line-color": "#000000", "line-width": scaled(1.9, CASING_WIDTH), "line-opacity": ["*", HL_STATE, 0.6] } });
  map.addLayer({ id: id + "-hl-line", type: "line", source: srcId, layout: join, paint: { "line-color": ["coalesce", ["get", "__hlColor"], "#ffb703"], "line-width": scaled(1.9, BORDER_WIDTH), "line-opacity": HL_STATE } });
  if (def.disputedOutline) {
    map.addLayer({
      id: id + "-disputed",
      type: "line",
      source: srcId,
      filter: ["==", ["get", "__disputed"], true],
      paint: { "line-color": "#ffb347", "line-width": 1.8, "line-dasharray": [2, 2], "line-opacity": 0 }
    });
  }
  if (def.outline) {
    ensureSource(map, id + "-out-src", def.outline);
    map.addLayer({ id: id + "-out-casing", type: "line", source: id + "-out-src", layout: join, paint: { "line-color": "#000000", "line-width": scaled(1.6, CASING_WIDTH), "line-opacity": 0 } });
    map.addLayer({ id: id + "-out-line", type: "line", source: id + "-out-src", layout: join, paint: { "line-color": border, "line-width": scaled(1.7, BORDER_WIDTH), "line-opacity": 0 } });
  }
}

const rampAt = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : Math.max(0, Math.min(1, (t - a) / (b - a))));
function highlightValue(p, t) {
  let v = rampAt(t, p.__hlIn0, p.__hlIn1);
  if (p.__hlOut0 !== undefined) v = Math.min(v, 1 - rampAt(t, p.__hlOut0, p.__hlOut1));
  return Math.round(EASING.easeInOutCubic(v) * 1000) / 1000;
}

function updateRegionHighlight(pane, def, eased, t) {
  const { map } = pane;
  const id = def.id;
  const set = (layer, prop, value) => map.getLayer(layer) && map.setPaintProperty(layer, prop, value);
  set(id + "-base", "fill-opacity", eased * (def.baseOpacity ?? 0.3));
  set(id + "-casing", "line-opacity", eased * 0.55);
  set(id + "-line", "line-opacity", eased * 0.95);
  set(id + "-ctx-fill", "fill-opacity", eased * 0.5);
  set(id + "-out-casing", "line-opacity", eased * 0.6);
  set(id + "-out-line", "line-opacity", eased);
  set(id + "-disputed", "line-opacity", eased);
  const cache = (pane.hlCache ||= new Map());
  for (const feat of def.data.features) {
    const p = feat.properties;
    if (p.__hlIn0 === undefined) continue;
    const v = highlightValue(p, t);
    const key = id + ":" + feat.id;
    if (cache.get(key) === v) continue;
    cache.set(key, v);
    map.setFeatureState({ source: id + "-src", id: feat.id }, { hl: v });
  }
}

function activeShot(paneSpec, t) {
  const shots = paneSpec.timeline;
  for (const shot of shots) if (t >= shot.startSec && t < shot.endSec) return shot;
  return shots[shots.length - 1];
}

function lerp(a, b, f) {
  return a + (b - a) * f;
}

// Multi-keyframe camera: piecewise eased segments between {atSec,center,zoom}.
// A key's dip briefly pulls the zoom back mid-segment so a hop between two
// zoomed-in regions reads as a glide over the country, not a blind pan.
function applyCameraPath(map, path, t) {
  let i = 0;
  while (i < path.length - 2 && t >= path[i + 1].atSec) i++;
  const a = path[i];
  const b = path[i + 1] || a;
  const f = b.atSec <= a.atSec ? 1 : Math.max(0, Math.min(1, (t - a.atSec) / (b.atSec - a.atSec)));
  const e = EASING.easeInOutCubic(f);
  map.jumpTo({
    center: [lerp(a.center[0], b.center[0], e), lerp(a.center[1], b.center[1], e)],
    zoom: lerp(a.zoom, b.zoom, e) - (b.dip || 0) * Math.sin(Math.PI * f),
    pitch: 0,
    bearing: 0
  });
}

function applyCamera(map, shot, f, t) {
  if (shot.cameraPath) return applyCameraPath(map, shot.cameraPath, t);
  if (!shot.camera) return;
  const { from, to, easing = "easeInOutCubic" } = shot.camera;
  const ef = (EASING[easing] || EASING.linear)(f);
  map.jumpTo({
    center: [lerp(from.center[0], to.center[0], ef), lerp(from.center[1], to.center[1], ef)],
    zoom: lerp(from.zoom, to.zoom, ef),
    pitch: lerp(from.pitch ?? 0, to.pitch ?? 0, ef),
    bearing: lerp(from.bearing ?? 0, to.bearing ?? 0, ef)
  });
}

function progressFor(range, t) {
  if (!range) return 1;
  const { startSec, endSec } = range;
  if (endSec <= startSec) return t >= startSec ? 1 : 0;
  return Math.max(0, Math.min(1, (t - startSec) / (endSec - startSec)));
}

function updateLayer(pane, layerDef, t) {
  const { map } = pane;
  const p = progressFor(layerDef.reveal || layerDef.draw, t);
  const eased = (EASING[layerDef.easing] || EASING.linear)(p);

  if (layerDef.type === "fill") {
    const mode = layerDef.reveal?.mode || "fade";
    if (mode === "sequential") {
      const features = layerDef.data.features;
      const cutoff = Math.ceil(eased * features.length);
      features.forEach((feat, i) => {
        map.setFeatureState({ source: `${layerDef.id}-src`, id: feat.id }, { revealed: i < cutoff });
      });
      map.setPaintProperty(layerDef.id, "fill-opacity", ["case", ["boolean", ["feature-state", "revealed"], false], layerDef.opacity ?? 0.85, 0]);
    } else {
      map.setPaintProperty(layerDef.id, "fill-opacity", eased * (layerDef.opacity ?? 0.85));
    }
    map.setPaintProperty(`${layerDef.id}-outline`, "line-opacity", eased);
    map.setPaintProperty(`${layerDef.id}-outline-glow`, "line-opacity", eased * 0.55);
    if (layerDef.disputedOutline) {
      map.setPaintProperty(`${layerDef.id}-disputed`, "line-opacity", eased);
      map.setPaintProperty(`${layerDef.id}-disputed-glow`, "line-opacity", eased * 0.55);
    }
  } else if (layerDef.type === "regionHighlight") {
    updateRegionHighlight(pane, layerDef, eased, t);
  } else if (layerDef.type === "line") {
    map.setPaintProperty(layerDef.id, "line-opacity", layerDef.fadeIn === false ? (layerDef.opacity ?? 1) : eased * (layerDef.opacity ?? 1));
    if (layerDef.draw) {
      const baseCoordsList = pane.lineBaseCoords.get(layerDef.id);
      const features = layerDef.data.features.map((f, i) => ({
        ...f,
        geometry: { ...f.geometry, coordinates: sliceLineByFraction(baseCoordsList[i], eased) }
      }));
      map.getSource(`${layerDef.id}-src`).setData({ type: "FeatureCollection", features });
    }
  } else if (layerDef.type === "circle") {
    const mode = layerDef.reveal?.mode || "grow";
    if (mode === "sequential") {
      const features = layerDef.data.features;
      const cutoff = Math.ceil(eased * features.length);
      features.forEach((feat, i) => {
        map.setFeatureState({ source: `${layerDef.id}-src`, id: feat.id }, { revealed: i < cutoff });
      });
      map.setPaintProperty(layerDef.id, "circle-opacity", ["case", ["boolean", ["feature-state", "revealed"], false], layerDef.opacity ?? 0.85, 0]);
      map.setPaintProperty(layerDef.id, "circle-radius", ["coalesce", ["get", "__baseRadius"], 4]);
    } else {
      map.setPaintProperty(layerDef.id, "circle-opacity", eased * (layerDef.opacity ?? 0.85));
      map.setPaintProperty(layerDef.id, "circle-radius", ["*", eased, ["coalesce", ["get", "__baseRadius"], 4]]);
    }
  } else if (layerDef.type === "heatmap") {
    map.setPaintProperty(layerDef.id, "heatmap-opacity", eased * (layerDef.opacity ?? 0.8));
  }
}

function updateOverlay(pane, shot, t) {
  const overlay = pane.overlay;
  overlay.querySelectorAll("[data-managed]").forEach((el) => el.remove());

  (shot.labels || []).forEach((label) => {
    const shownAt = label.showAtSec ?? shot.startSec;
    if (t < shownAt || (label.hideAtSec != null && t >= label.hideAtSec)) return;
    const fade = Math.min(rampAt(t, shownAt, shownAt + 0.25), label.hideAtSec == null ? 1 : 1 - rampAt(t, label.hideAtSec - 0.25, label.hideAtSec));
    const pos = pane.map.project(label.at);
    const el = document.createElement("div");
    el.className = label.style === "region" ? "ms-label ms-label-region" : "ms-label";
    el.dataset.managed = "1";
    el.style.left = `${pos.x}px`;
    el.style.top = `${pos.y - (label.style === "region" ? 0 : 10)}px`;
    el.style.opacity = String(fade);
    el.textContent = label.text;
    overlay.appendChild(el);
  });

  if (shot.title) {
    const el = document.createElement("div");
    el.className = "ms-title";
    el.dataset.managed = "1";
    el.style.opacity = "1";
    el.textContent = shot.title;
    overlay.appendChild(el);
  }

  if (shot.legend) {
    const el = document.createElement("div");
    el.className = "ms-legend";
    el.dataset.managed = "1";
    el.style.opacity = "1";
    const ramp = shot.legend.colorRamp || ["#2c7fb8", "#7fcdbb", "#edf8b1"];
    el.innerHTML = `<div>${shot.legend.title || ""}</div><div class="ramp">${ramp
      .map((c) => `<span style="background:${c}"></span>`)
      .join("")}</div><div style="display:flex;justify-content:space-between"><span>${shot.legend.min ?? ""}</span><span>${shot.legend.max ?? ""}</span></div>${
      shot.legend.noDataNote ? `<div style="opacity:.7;margin-top:4px">${shot.legend.noDataNote}</div>` : ""
    }`;
    overlay.appendChild(el);
  }

  if (shot.dateCounter) {
    const { startYear, endYear, startSec, endSec, format = "year" } = shot.dateCounter;
    const p = progressFor({ startSec, endSec }, t);
    const value = Math.round(lerp(startYear, endYear, p));
    const el = document.createElement("div");
    el.className = "ms-date-counter";
    el.dataset.managed = "1";
    el.style.opacity = "1";
    el.textContent = format === "year" ? String(value) : value.toLocaleString();
    overlay.appendChild(el);
  }

  if (scene.attribution?.length) {
    const el = document.createElement("div");
    el.className = "ms-attribution";
    el.dataset.managed = "1";
    el.textContent = scene.attribution.join(" · ");
    overlay.appendChild(el);
  }

  // Disputed-territory transparency: burned into the frame, not just
  // metadata, per this project's "never silently pick a side" policy.
  if (scene.editorialNotes?.length) {
    const el = document.createElement("div");
    el.className = "ms-editorial-note";
    el.dataset.managed = "1";
    el.textContent = scene.editorialNotes.join(" ");
    overlay.appendChild(el);
  }
}

async function setTime(t) {
  setNow(t * 1000);
  for (const pane of panes) {
    const shot = activeShot(pane.spec, t);
    const f = progressFor({ startSec: shot.startSec, endSec: shot.endSec }, t);
    for (const layerDef of shot.layers || []) addLayerIfMissing(pane, layerDef);
    applyCamera(pane.map, shot, f, t);
    for (const layerDef of shot.layers || []) updateLayer(pane, layerDef, t);
    if (shot.borderTimelapse) {
      const { keyframes } = shot.borderTimelapse;
      const active = [...keyframes].reverse().find((k) => t >= k.atSec) || keyframes[0];
      const srcId = `${shot.borderTimelapse.layerId}-src`;
      const src = pane.map.getSource(srcId);
      if (src && pane._lastTimelapseKey !== active.atSec) {
        src.setData(active.geojson);
        pane._lastTimelapseKey = active.atSec;
      }
    }
    updateOverlay(pane, shot, t);
    pane.map.triggerRepaint();
  }
  await Promise.all(panes.map((pane) => waitForRender(pane.map)));
}

// `idle` reliably fires after a real style/data change, but a frame with no
// paint-property delta can leave nothing "dirty" to settle. The short
// fallback timeout guarantees every frame still gets screenshotted promptly.
//
// Satellite raster tiles arrive over the network after every camera jump, so
// "idle within 200ms" captured half-loaded frames (black/blurred patches)
// whenever the camera moved far between frames — exactly what a region-to-
// region highlight does. In the headless page, animation frames are not
// delivered between screenshots, so MapLibre neither requests the new tiles
// nor paints the ones that arrive (and loaded() stays false) unless a render
// is forced: redraw() synchronously, then keep redrawing until every tile is
// in. Bounded, so an unreachable tile server can never hang a render.
const TILE_WAIT_MS = 15000;
function waitForRender(map) {
  return new Promise((resolve) => {
    const deadline = Date.now() + TILE_WAIT_MS;
    const settle = () => {
      map.redraw();
      if (map.areTilesLoaded() || Date.now() > deadline) resolve();
      else setTimeout(settle, 50);
    };
    settle();
  });
}

window.__msReady = Promise.resolve(true);
window.__msSetTime = setTime;
window.__msSceneMeta = { fps: scene.fps, durationSec: scene.durationSec, width: scene.width, height: scene.height };
