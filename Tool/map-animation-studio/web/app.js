const $ = (id) => document.getElementById(id);
const log = (msg, isError = false) => {
  const el = $("log");
  el.textContent = msg;
  el.className = isError ? "error" : "";
  if (isError) console.error(msg);
};

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

const state = { template: null, districts: [], provinces: [], selection: [], aspect: "16:9", durationSec: 6, draft: null, playing: false, previewRatio: 16 / 9 };

// Inline SVG (stroke-based, 24x24, currentColor) instead of emoji — emoji
// render inconsistently across platforms/fonts and can't be themed or sized
// precisely as a design token the way a vector icon can.
const ICONS = {
  pin: '<svg class="icon" viewBox="0 0 24 24"><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  route: '<svg class="icon" viewBox="0 0 24 24"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h7a3 3 0 013 3v0a3 3 0 01-3 3H8a3 3 0 00-3 3v0a3 3 0 003 3h9"/></svg>',
  map: '<svg class="icon" viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  buildings: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 21V8l6-4v17M14 21V11l6-3v13"/><path d="M4 21h16M7 11h0M7 14h0M7 17h0"/></svg>',
  grid: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>'
};

function fitPreviewBox() {
  const wrap = $("preview-wrap");
  const card = $("map-card");
  const availW = wrap.clientWidth - 32;
  const availH = wrap.clientHeight - 32;
  if (availW <= 0 || availH <= 0) return;
  let w = availW;
  let h = w / state.previewRatio;
  if (h > availH) {
    h = availH;
    w = h * state.previewRatio;
  }
  card.style.width = `${Math.round(w)}px`;
  card.style.height = `${Math.round(h)}px`;
}
window.addEventListener("resize", () => fitPreviewBox());

async function refreshHealth() {
  const pill = $("health-pill");
  try {
    const h = await api("/api/health");
    const problems = Object.entries(h).filter(([k, v]) => k !== "node" && typeof v === "string" && /missing|unreachable/.test(v));
    pill.textContent = problems.length ? `Issues: ${problems.map(([k]) => k).join(", ")}` : "Engine ready";
    pill.className = problems.length ? "bad" : "ok";
  } catch {
    pill.textContent = "health check failed";
    pill.className = "bad";
  }
}

// ---------- templates ----------
const TEMPLATES = [
  {
    id: "spotlight",
    icon: "pin",
    title: "District Spotlight",
    desc: "Zoom to one district, highlighted against all of Nepal.",
    select: "single",
    pool: "districts"
  },
  {
    id: "tour",
    icon: "route",
    title: "District Tour",
    desc: "Camera glides from one selected district to the next, in order.",
    select: "multi",
    pool: "districts"
  },
  {
    id: "provinces",
    icon: "map",
    title: "Province Explorer",
    desc: "Tour Nepal's 7 provinces, one at a time or all together.",
    select: "multi",
    pool: "provinces"
  },
  {
    id: "municipalities",
    icon: "buildings",
    title: "District's Municipalities",
    desc: "Every municipality inside one chosen district, precisely outlined.",
    select: "single",
    pool: "districts"
  },
  {
    id: "overview",
    icon: "grid",
    title: "All-Districts Overview",
    desc: "All 77 districts colored by land area (km²) — real, computed data, not invented.",
    select: "none",
    pool: "districts"
  }
];

function renderTemplateGrid() {
  const grid = $("template-grid");
  grid.innerHTML = "";
  for (const t of TEMPLATES) {
    const card = document.createElement("button");
    card.className = "template-card";
    card.innerHTML = `<div class="icon-badge">${ICONS[t.icon]}</div><h3>${t.title}</h3><p>${t.desc}</p>`;
    card.addEventListener("click", () => selectTemplate(t.id));
    card.dataset.id = t.id;
    grid.appendChild(card);
  }
}

function selectTemplate(id) {
  state.template = TEMPLATES.find((t) => t.id === id);
  state.selection = [];
  document.querySelectorAll(".template-card").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
  const workspace = $("workspace");
  workspace.classList.add("active");
  requestAnimationFrame(() => workspace.classList.add("shown"));
  $("workspace-title").textContent = state.template.title;
  $("workspace-desc").textContent = state.template.desc;
  renderControls();
  resetStage();
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- controls ----------
function renderControls() {
  const t = state.template;
  const pool = t.pool === "provinces" ? state.provinces.map((p) => p.name) : state.districts.map((d) => d.name);
  const controls = $("controls");
  controls.innerHTML = "";

  if (t.select !== "none") {
    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = t.select === "single" ? `Choose a ${t.pool === "provinces" ? "province" : "district"}` : `Choose ${t.pool === "provinces" ? "provinces" : "districts"} (click in the order you want them shown)`;
    controls.appendChild(label);

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Filter…";
    controls.appendChild(search);

    const chipList = document.createElement("div");
    chipList.className = "chip-list";
    chipList.id = "chip-list";
    controls.appendChild(chipList);

    const extra = t.pool === "districts" ? state.districts.reduce((m, d) => ((m[d.name] = d.province), m), {}) : {};
    const buildChips = (filter = "") => {
      chipList.innerHTML = "";
      const f = filter.toLowerCase();
      for (const name of pool) {
        if (f && !name.toLowerCase().includes(f)) continue;
        const chip = document.createElement("div");
        chip.className = "chip" + (state.selection.includes(name) ? " selected" : "");
        chip.textContent = name;
        if (extra[name]) {
          const sub = document.createElement("small");
          sub.textContent = extra[name];
          chip.appendChild(sub);
        }
        chip.addEventListener("click", () => {
          if (t.select === "single") {
            state.selection = [name];
          } else if (state.selection.includes(name)) {
            state.selection = state.selection.filter((n) => n !== name);
          } else {
            state.selection = [...state.selection, name];
          }
          buildChips(search.value);
        });
        chipList.appendChild(chip);
      }
    };
    search.addEventListener("input", () => buildChips(search.value));
    buildChips();

    if (t.select === "multi") {
      const selectAllBtn = document.createElement("button");
      selectAllBtn.className = "btn";
      selectAllBtn.textContent = `Select all ${pool.length}`;
      selectAllBtn.addEventListener("click", () => {
        state.selection = [...pool];
        buildChips(search.value);
      });
      controls.appendChild(selectAllBtn);
    }
  }

  if (t.select === "multi" && t.id === "tour") {
    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = "Order";
    controls.appendChild(label);
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = "Districts are shown in the order you clicked them. Remove and re-click to reorder.";
    controls.appendChild(hint);
  }

  const durLabel = document.createElement("label");
  durLabel.className = "field-label";
  durLabel.textContent = "Duration";
  controls.appendChild(durLabel);
  const durRow = document.createElement("div");
  durRow.style.display = "flex";
  durRow.style.gap = "10px";
  durRow.style.alignItems = "center";
  const durInput = document.createElement("input");
  durInput.type = "range";
  durInput.min = "3";
  durInput.max = "30";
  durInput.value = String(state.durationSec);
  const durValue = document.createElement("span");
  durValue.textContent = `${state.durationSec}s`;
  durValue.style.fontSize = "12px";
  durValue.style.minWidth = "32px";
  durInput.addEventListener("input", () => {
    state.durationSec = Number(durInput.value);
    durValue.textContent = `${state.durationSec}s`;
  });
  durRow.appendChild(durInput);
  durRow.appendChild(durValue);
  controls.appendChild(durRow);

  const aspectLabel = document.createElement("label");
  aspectLabel.className = "field-label";
  aspectLabel.textContent = "Format";
  controls.appendChild(aspectLabel);
  const pillRow = document.createElement("div");
  pillRow.className = "pill-row";
  for (const a of ["16:9", "9:16", "1:1"]) {
    const pill = document.createElement("button");
    pill.className = "pill" + (state.aspect === a ? " active" : "");
    pill.textContent = a;
    pill.addEventListener("click", () => {
      state.aspect = a;
      pillRow.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      if (!state.draft) {
        state.previewRatio = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 }[a];
        fitPreviewBox();
      }
    });
    pillRow.appendChild(pill);
  }
  controls.appendChild(pillRow);
}

// ---------- manifest building ----------
function buildManifest() {
  const t = state.template;
  const durationSec = state.durationSec;
  const base = { title: "", purpose: "Nepal district template preview", durationSec, fps: 24, aspectRatio: state.aspect, basemap: "satellite", disputedBorderPolicy: "flag-dashed" };
  let shot;

  if (t.id === "spotlight") {
    if (!state.selection.length) throw new Error("Choose a district first.");
    base.title = `${state.selection[0]} District`;
    shot = { id: "shot1", kind: "regionHighlight", startSec: 0, endSec: durationSec, region: { adminLevel: 2, countries: ["Nepal"] }, highlight: [{ name: state.selection[0] }], mode: "together" };
  } else if (t.id === "tour") {
    if (state.selection.length < 2) throw new Error("Choose at least 2 districts for a tour.");
    const minDur = state.selection.length * 1.2 + 1.5;
    if (durationSec < minDur) throw new Error(`${state.selection.length} districts needs at least ${Math.ceil(minDur)}s — increase the duration slider.`);
    base.title = "Nepal District Tour";
    shot = { id: "shot1", kind: "regionHighlight", startSec: 0, endSec: durationSec, region: { adminLevel: 2, countries: ["Nepal"] }, highlight: state.selection.map((name) => ({ name })), mode: "sequential", palette: "cycle" };
  } else if (t.id === "provinces") {
    if (!state.selection.length) throw new Error("Choose at least one province.");
    const minDur = state.selection.length * 1.2 + 1.5;
    if (durationSec < minDur) throw new Error(`${state.selection.length} provinces needs at least ${Math.ceil(minDur)}s — increase the duration slider.`);
    base.title = "Nepal Provinces";
    shot = { id: "shot1", kind: "regionHighlight", startSec: 0, endSec: durationSec, region: { adminLevel: 1, countries: ["Nepal"] }, highlight: state.selection.length === state.provinces.length ? "all" : state.selection.map((name) => ({ name })), mode: state.selection.length > 1 ? "sequential" : "together", palette: "cycle" };
  } else if (t.id === "municipalities") {
    if (!state.selection.length) throw new Error("Choose a district first.");
    base.title = `${state.selection[0]} District — Municipalities`;
    shot = { id: "shot1", kind: "establishingZoom", startSec: 0, endSec: durationSec, title: `${state.selection[0]} — every municipality`, region: { adminLevel: 3, countries: ["Nepal"], parentName: state.selection[0] }, color: "#4f9fd8" };
  } else if (t.id === "overview") {
    base.title = "Nepal — 77 Districts by Area";
    const values = {};
    for (const d of state.districts) values[d.name] = d.areaSqKm;
    shot = { id: "shot1", kind: "choropleth", startSec: 0, endSec: durationSec, title: "Nepal — district land area", region: { adminLevel: 2, countries: ["Nepal"] }, dataSourceRef: { values, unit: "km²" }, revealMode: "sequential" };
  }

  base.panes = [{ id: "main", projection: "mercator", shots: [shot] }];
  return base;
}

// ---------- stage / preview ----------
function resetStage() {
  $("placeholder").style.display = "flex";
  $("preview-frame").removeAttribute("src");
  $("preview-controls").classList.remove("active");
  $("filmstrip").innerHTML = "";
  $("btn-render").disabled = true;
  $("progress").style.display = "none";
  $("progress-label").textContent = "";
  $("video-wrap").classList.remove("active");
  $("log").textContent = "";
  state.draft = null;
  state.previewRatio = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 }[state.aspect] || 16 / 9;
  fitPreviewBox();
  stopPlayback();
}

$("btn-draft").addEventListener("click", async () => {
  let manifest;
  try {
    manifest = buildManifest();
  } catch (error) {
    log(error.message, true);
    return;
  }
  $("btn-draft").disabled = true;
  $("btn-render").disabled = true;
  log("Building scene from real OCHA boundary data and rendering satellite preview frames… (this can take a minute)");
  try {
    const result = await api("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manifest) });
    state.draft = result;
    renderFilmstrip(result);
    await loadPreview(result);
    $("btn-render").disabled = false;
    log(`Ready: ${result.projectId} — ${result.totalFrames} frames, ~${result.estimatedRenderSeconds}s to render. Sources: ${result.attribution.join(", ")}`);
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
    img.src = `/output/${result.projectId}/previews/${base}`;
    strip.appendChild(img);
  }
}

async function loadPreview(result) {
  const iframe = $("preview-frame");
  const [w, h] = result.resolution.split("x").map(Number);
  state.previewRatio = w / h;
  fitPreviewBox();
  $("placeholder").style.display = "none";
  const sceneUrl = `/output/${result.projectId}/scene.json`;
  iframe.src = `/render/map.html?scene=${encodeURIComponent(sceneUrl)}`;
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
  $("preview-controls").classList.add("active");
}

const ICON_PLAY = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

let rafHandle = null;
function stopPlayback() {
  state.playing = false;
  if (rafHandle) cancelAnimationFrame(rafHandle);
  $("btn-play").innerHTML = ICON_PLAY;
  $("btn-play").setAttribute("aria-label", "Play preview");
}

$("btn-play").addEventListener("click", () => {
  if (!state.draft) return;
  const iframe = $("preview-frame");
  if (state.playing) {
    stopPlayback();
    return;
  }
  state.playing = true;
  $("btn-play").innerHTML = ICON_PAUSE;
  $("btn-play").setAttribute("aria-label", "Pause preview");
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
  const t = Number($("scrub").value);
  $("time-label").textContent = `${t.toFixed(1)}s`;
  $("preview-frame").contentWindow.__msSetTime?.(t);
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
    const result = await api("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: state.draft.projectId, approval: { confirmRender: true, sceneChecksum: state.draft.sceneChecksum } })
    });
    $("progress").value = 1;
    $("progress-label").textContent = "Done";
    const src = `/output/${result.projectId}/${result.projectId}.mp4?t=${Date.now()}`;
    $("result-video").src = src;
    $("download-link").href = src;
    $("video-wrap").classList.add("active");
    log(`Rendered: ${result.frameCount} frames.`);
  } catch (error) {
    log(`Render failed: ${error.message}. Fix the issue and click Approve & render again — it will not retry automatically.`, true);
  } finally {
    $("btn-draft").disabled = false;
    $("btn-render").disabled = false;
  }
});

// ---------- init ----------
async function init() {
  refreshHealth();
  renderTemplateGrid();
  try {
    const [districts, provinces] = await Promise.all([api("/api/nepal/districts"), api("/api/nepal/provinces")]);
    state.districts = districts;
    state.provinces = provinces;
  } catch (error) {
    log(`Failed to load Nepal boundary index: ${error.message}`, true);
  }
}
init();
