import { Map as MapLibreMap } from "/node_modules/maplibre-gl/dist/maplibre-gl.mjs";
import { bboxOfGeometry } from "/lib/geomath.mjs";

const $ = (id) => document.getElementById(id);
const log = (msg, isError = false) => {
  const el = $("log");
  el.textContent = msg;
  el.className = isError ? "error" : "";
  if (isError) console.error(msg);
};

const FLAGS = { Nepal: "🇳🇵", India: "🇮🇳", China: "🇨🇳", Bangladesh: "🇧🇩", Bhutan: "🇧🇹" };
const ISO3 = { Nepal: "NPL", India: "IND", China: "CHN", Bangladesh: "BGD", Bhutan: "BTN" };

const serverUrl = await window.studio.serverUrl();
const state = {
  draft: null,
  playing: false,
  pickerMap: null,
  countries: new Set(["Nepal"]),
  kind: "establishingZoom",
  aspect: "16:9",
  adminLevel: 0
};

// ---------- health ----------
async function refreshHealth() {
  const pill = $("health-pill");
  try {
    const h = await window.studio.health();
    const problems = Object.entries(h).filter(([k, v]) => k !== "node" && typeof v === "string" && /missing|unreachable/.test(v));
    pill.textContent = problems.length ? `Issues: ${problems.map(([k]) => k).join(", ")}` : "Engine ready";
    pill.className = problems.length ? "bad" : "ok";
    pill.title = JSON.stringify(h, null, 2);
  } catch {
    pill.textContent = "health check failed";
    pill.className = "bad";
  }
}

// ---------- country cards ----------
async function buildCountryCards() {
  const curated = await window.studio.curatedCountries();
  const grid = $("country-grid");
  grid.innerHTML = "";
  for (const name of curated) {
    const card = document.createElement("div");
    card.className = "country-card" + (state.countries.has(name) ? " active" : "");
    card.dataset.name = name;
    card.innerHTML = `<span class="flag">${FLAGS[name] || "🌐"}</span><span class="name">${name}</span>`;
    card.addEventListener("click", () => {
      if (state.countries.has(name)) {
        if (state.countries.size > 1) state.countries.delete(name);
      } else {
        state.countries.add(name);
      }
      card.classList.toggle("active", state.countries.has(name));
      buildManifestFromForm();
      locateSelected();
    });
    grid.appendChild(card);
  }
}

// ---------- pills ----------
function wirePills(containerId, dataAttr, stateKey, onChange) {
  const container = $(containerId);
  container.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      container.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      state[stateKey] = pill.dataset[dataAttr];
      onChange?.();
      buildManifestFromForm();
    });
  });
}
wirePills("kind-pills", "kind", "kind", () => {
  const isChoropleth = state.kind === "choropleth";
  $("f-values").style.display = isChoropleth ? "block" : "none";
});
wirePills("aspect-pills", "aspect", "aspect");
wirePills("admin-level-pills", "level", "adminLevel", () => {
  const level = Number(state.adminLevel);
  const hint = $("admin-level-hint");
  if (level === 3) hint.textContent = "Municipality level draws every local unit for the selected country(ies) — a much larger scene and a slower render. Nepal alone has 774 units.";
  else if (level === 2) hint.textContent = "District level draws every district/county for the selected country(ies).";
  else if (level === 1) hint.textContent = "Province level requires exactly one selected country.";
  else hint.textContent = "Curated launch scope — Nepal, India, China, Bangladesh, Bhutan. More countries land later.";
});

$("f-duration").addEventListener("input", () => {
  $("duration-value").textContent = $("f-duration").value;
  buildManifestFromForm();
});
["f-title", "f-purpose", "f-fps", "f-basemap", "f-disputed", "f-values"].forEach((id) => {
  $(id).addEventListener("input", () => buildManifestFromForm());
  $(id).addEventListener("change", () => buildManifestFromForm());
});

// ---------- examples (kept for power users / agents pasting a full manifest) ----------
async function loadExamples() {
  try {
    const examples = await window.studio.listExamples();
    window.__examples = examples;
  } catch {
    /* non-fatal */
  }
}

// ---------- form -> manifest ----------
function parseValues(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_.-]+)\s*[:=]\s*([-\d.]+)\s*$/);
    if (m) values[m[1].toUpperCase()] = Number(m[2]);
  }
  return values;
}

function buildManifestFromForm() {
  const countries = [...state.countries];
  const durationSec = Number($("f-duration").value) || 4;
  const kind = state.kind;

  const shot = {
    id: "shot1",
    kind,
    startSec: 0,
    endSec: durationSec,
    title: $("f-title").value,
    region: { adminLevel: Number(state.adminLevel), countries }
  };
  if (kind === "choropleth") {
    shot.dataSourceRef = { values: parseValues($("f-values").value), unit: "value" };
    shot.revealMode = "sequential";
  }

  const manifest = {
    title: $("f-title").value,
    purpose: $("f-purpose").value,
    durationSec,
    fps: Number($("f-fps").value) || 24,
    aspectRatio: state.aspect,
    basemap: $("f-basemap").value,
    disputedBorderPolicy: $("f-disputed").value,
    panes: [{ id: "main", projection: kind === "globeHighlight" ? "globe" : "mercator", shots: [shot] }]
  };
  $("manifest-json").value = JSON.stringify(manifest, null, 2);
  return manifest;
}

// ---------- region picker map ----------
function ensurePickerMap() {
  if (state.pickerMap) return state.pickerMap;
  const map = new MapLibreMap({
    container: "picker-map",
    style: {
      version: 8,
      sources: { sat: { type: "raster", tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256 } },
      layers: [{ id: "sat", type: "raster", source: "sat" }]
    },
    center: [85, 27],
    zoom: 3.5,
    attributionControl: false
  });
  state.pickerMap = map;
  return map;
}
ensurePickerMap();

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

async function locateSelected() {
  const names = [...state.countries];
  if (!names.length) return;
  try {
    const features = [];
    for (const name of names) {
      const result = await window.studio.findCountry(name);
      features.push({ ...result.feature, id: features.length });
    }
    const map = ensurePickerMap();
    const apply = () => {
      const geojson = { type: "FeatureCollection", features };
      if (map.getSource("picked")) {
        map.getSource("picked").setData(geojson);
      } else {
        map.addSource("picked", { type: "geojson", data: geojson });
        map.addLayer({ id: "picked-glow", type: "line", source: "picked", paint: { "line-color": "#ffe066", "line-width": 6, "line-blur": 3, "line-opacity": 0.5 } });
        map.addLayer({ id: "picked-fill", type: "fill", source: "picked", paint: { "fill-color": "#e0b354", "fill-opacity": 0.4 } });
        map.addLayer({ id: "picked-line", type: "line", source: "picked", paint: { "line-color": "#ffe066", "line-width": 1.8 } });
      }
      const bbox = unionBbox(features);
      map.fitBounds(bbox, { padding: 50, duration: 900 });
    };
    if (map.loaded()) apply();
    else map.once("load", apply);
  } catch (error) {
    log(`Locate failed: ${error.message}`, true);
  }
}

// ---------- tabs ----------
function switchTab(name) {
  $("tab-picker").classList.toggle("active", name === "picker");
  $("tab-preview").classList.toggle("active", name === "preview");
  $("panel-picker").classList.toggle("active", name === "picker");
  $("panel-preview").classList.toggle("active", name === "preview");
  if (name === "picker" && state.pickerMap) setTimeout(() => state.pickerMap.resize(), 50);
}
$("tab-picker").addEventListener("click", () => switchTab("picker"));
$("tab-preview").addEventListener("click", () => switchTab("preview"));

// ---------- draft ----------
window.studio.onDraftProgress((p) => {
  if (p.phase === "rendering-previews" && p.total) log(`Rendering preview ${p.frame + 1}/${p.total}… (satellite tiles take longer than the flat basemap)`);
  else if (p.phase) log(`Draft: ${p.phase}…`);
});

$("btn-draft").addEventListener("click", async () => {
  const manifest = JSON.parse($("manifest-json").value || "{}");
  $("btn-draft").disabled = true;
  $("btn-render").disabled = true;
  log("Building scene from real geodata and rendering satellite preview frames…");
  try {
    const result = await window.studio.draft(manifest);
    state.draft = result;
    renderFilmstrip(result);
    await loadPreview(result);
    $("btn-render").disabled = false;
    log(`Draft ready: ${result.projectId} — ${result.totalFrames} frames, ~${result.estimatedRenderSeconds}s to render. Sources: ${result.attribution.join(", ")}`);
  } catch (error) {
    log(`Draft failed: ${error.message}`, true);
  } finally {
    $("btn-draft").disabled = false;
  }
});

function renderFilmstrip(result) {
  const strip = $("filmstrip");
  strip.innerHTML = "";
  for (const framePath of result.previewFrames) {
    const base = framePath.split(/[\\/]/).pop();
    const img = document.createElement("img");
    img.src = `${serverUrl}/output/${result.projectId}/previews/${base}`;
    strip.appendChild(img);
  }
}

// ---------- animated preview (real engine, driven live) ----------
async function loadPreview(result) {
  const iframe = $("preview-frame");
  const sceneUrl = `/output/${result.projectId}/scene.json`;
  iframe.src = `${serverUrl}/render/map.html?scene=${encodeURIComponent(sceneUrl)}`;
  await new Promise((resolve) => (iframe.onload = resolve));
  const start = Date.now();
  while (typeof iframe.contentWindow.__msSetTime !== "function") {
    if (Date.now() - start > 20000) throw new Error("Preview engine did not become ready in time.");
    await new Promise((r) => setTimeout(r, 100));
  }
  const scrub = $("scrub");
  scrub.max = String(result.durationSec);
  scrub.value = "0";
  iframe.contentWindow.__msSetTime(0);
  switchTab("preview");
}

let rafHandle = null;
function stopPlayback() {
  state.playing = false;
  if (rafHandle) cancelAnimationFrame(rafHandle);
  $("btn-play").textContent = "▶ Play";
}

$("btn-play").addEventListener("click", () => {
  if (!state.draft) return;
  const iframe = $("preview-frame");
  if (state.playing) {
    stopPlayback();
    return;
  }
  state.playing = true;
  $("btn-play").textContent = "⏸ Pause";
  const durationSec = state.draft.durationSec;
  let startedAt = performance.now() - Number($("scrub").value) * 1000;
  const tick = (now) => {
    if (!state.playing) return;
    let t = (now - startedAt) / 1000;
    if (t >= durationSec) {
      startedAt = now;
      t = 0;
    }
    $("scrub").value = String(t);
    $("time-label").textContent = `${t.toFixed(1)}s`;
    iframe.contentWindow.__msSetTime?.(t);
    rafHandle = requestAnimationFrame(tick);
  };
  rafHandle = requestAnimationFrame(tick);
});

$("scrub").addEventListener("input", () => {
  stopPlayback();
  const iframe = $("preview-frame");
  const t = Number($("scrub").value);
  $("time-label").textContent = `${t.toFixed(1)}s`;
  iframe.contentWindow.__msSetTime?.(t);
});

// ---------- render ----------
window.studio.onGenerateProgress((p) => {
  const bar = $("progress");
  bar.style.display = "block";
  if (p.phase === "rendering" && p.total) {
    bar.value = p.frame / p.total;
    $("progress-label").textContent = `Rendering frame ${p.frame + 1}/${p.total}`;
  } else if (p.phase === "encoding") {
    bar.value = 1;
    $("progress-label").textContent = "Encoding with ffmpeg…";
  }
});

$("btn-render").addEventListener("click", async () => {
  if (!state.draft) return;
  const confirmed = confirm(
    `Render the approved plan now?\n\nProject: ${state.draft.projectId}\nFrames: ${state.draft.totalFrames}\nEstimated time: ~${state.draft.estimatedRenderSeconds}s\n\nThis is the explicit approval — it will actually run the full render.`
  );
  if (!confirmed) return;
  $("btn-render").disabled = true;
  $("btn-draft").disabled = true;
  $("progress").style.display = "block";
  $("progress").value = 0;
  log("Rendering…");
  try {
    const approval = { confirmRender: true, sceneChecksum: state.draft.sceneChecksum };
    const result = await window.studio.generate(state.draft.projectId, approval);
    $("progress").value = 1;
    $("progress-label").textContent = "Done";
    const video = $("result-video");
    video.src = `${serverUrl}/output/${result.projectId}/${result.projectId}.mp4?t=${Date.now()}`;
    $("video-wrap").style.display = "flex";
    $("btn-open-folder").onclick = () => window.studio.showInFolder(result.mp4Path);
    log(`Rendered: ${result.mp4Path} (${result.frameCount} frames)`);
  } catch (error) {
    log(`Render failed: ${error.message}. Fix the issue and click Approve & render again — it will not retry automatically.`, true);
  } finally {
    $("btn-draft").disabled = false;
    $("btn-render").disabled = false;
  }
});

// ---------- init ----------
refreshHealth();
loadExamples();
buildCountryCards().then(() => {
  buildManifestFromForm();
  locateSelected();
});
