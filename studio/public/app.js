"use strict";
// Content Machine Studio — single-file vanilla SPA. Hash router + fetch helpers.
// Design: SVG icons (no emoji), skeleton loading, staggered reveal, accessible
// lightbox, restrained motion. See studio.css for tokens.

const view = document.getElementById("view");
const sideFoot = document.getElementById("sideFoot");

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id, cls) => `<svg${cls ? ` class="${cls}"` : ""} aria-hidden="true"><use href="#i-${id}"/></svg>`;
const api = async (path, opts) => {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
};
const mediaUrl = (packId, rel) => `/media/${encodeURIComponent(packId)}/${rel.split("/").map(encodeURIComponent).join("/")}`;
const isVideo = (p) => /\.(mp4|webm|mov|m4v)$/i.test(p);
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 1800);
}
async function copy(text, label) { try { await navigator.clipboard.writeText(text); toast((label || "Copied") + " ✓"); } catch { toast("Copy failed"); } }
window.copy = copy;
// Minimal, safe markdown → HTML (headings, bold, inline code, lists, paragraphs).
function md(src) {
  const lines = String(src).split(/\r?\n/); let html = "", inList = false;
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>");
  for (const ln of lines) {
    const h = ln.match(/^(#{1,4})\s+(.*)/);
    if (h) { if (inList) { html += "</ul>"; inList = false; } html += `<h${h[1].length} style="margin:14px 0 6px">${inline(h[2])}</h${h[1].length}>`; continue; }
    const li = ln.match(/^\s*[-*]\s+(.*)/);
    if (li) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { html += "</ul>"; inList = false; }
    if (ln.trim()) html += `<p>${inline(ln)}</p>`;
  }
  if (inList) html += "</ul>";
  return html;
}
function pre(text, label) {
  const id = "c" + Math.random().toString(36).slice(2, 8);
  window["__" + id] = text;
  return `<div class="copybar"><span class="muted" style="font-size:.82rem">${esc(label || "")}</span>
    <button class="btn btn-ghost btn-sm" onclick="copy(window.__${id}, 'Copied')">${icon("copy")} Copy</button></div>
    <div class="pre">${esc(text)}</div>`;
}
function head(eyebrow, title, sub, right) {
  return `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}
    <h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div>${right || ""}</div>`;
}
const emptyState = (msg) => `<div class="empty">${icon("empty")}<p>${esc(msg)}</p></div>`;
const stagger = (i) => reduceMotion ? "" : ` style="animation-delay:${Math.min(i, 22) * 34}ms"`;

// ---------- accessible lightbox with prev/next ----------
let lb = null;
function openLightbox(items, index) {
  closeLightbox();
  let i = index;
  const el = document.createElement("div");
  el.className = "lightbox"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Image viewer");
  const render = () => {
    const it = items[i];
    el.innerHTML = `
      <figure>${isVideo(it.src) ? `<video src="${it.src}" controls autoplay></video>` : `<img src="${it.src}" alt="${esc(it.cap || "")}" />`}</figure>
      <div class="lb-cap">${esc(it.cap || "")} <span class="muted">· ${i + 1} / ${items.length}</span></div>
      <button class="lb-btn lb-close" aria-label="Close">${icon("close")}</button>
      ${items.length > 1 ? `<button class="lb-btn lb-prev" aria-label="Previous">${icon("prev")}</button>
      <button class="lb-btn lb-next" aria-label="Next">${icon("next")}</button>` : ""}`;
    el.querySelector(".lb-close").onclick = closeLightbox;
    const prev = el.querySelector(".lb-prev"), next = el.querySelector(".lb-next");
    if (prev) prev.onclick = (e) => { e.stopPropagation(); i = (i - 1 + items.length) % items.length; render(); };
    if (next) next.onclick = (e) => { e.stopPropagation(); i = (i + 1) % items.length; render(); };
  };
  el.addEventListener("click", (e) => { if (e.target === el || e.target.closest("figure")) closeLightbox(); });
  render();
  document.body.appendChild(el);
  lb = { el, onKey: (e) => { if (e.key === "Escape") closeLightbox(); else if (e.key === "ArrowLeft" && items.length > 1) { i = (i - 1 + items.length) % items.length; render(); } else if (e.key === "ArrowRight" && items.length > 1) { i = (i + 1) % items.length; render(); } } };
  document.addEventListener("keydown", lb.onKey);
}
function closeLightbox() { if (!lb) return; document.removeEventListener("keydown", lb.onKey); lb.el.remove(); lb = null; }

// ---------- views ----------
const state = { packs: null, filter: { q: "", brand: "all", type: "all" }, presets: null };
async function getPresets() { if (!state.presets) state.presets = await api("/api/presets"); return state.presets; }

async function Library() {
  view.innerHTML = head("Your archive", "Library", "Every finished pack in Outputs/ — browse, filter and open.") + `<div id="lib"></div>`;
  const host = document.getElementById("lib");
  if (!state.packs) {
    host.innerHTML = `<div class="grid">${Array.from({ length: 8 }).map(() => `<div class="skel"><div class="thumb"></div><div class="sk-line"></div><div class="sk-line sm"></div></div>`).join("")}</div>`;
    try { state.packs = (await api("/api/packs")).packs; } catch (e) { host.innerHTML = `<div class="note warn">${esc(e.message)}</div>`; return; }
  }
  renderLibrary();
}
function renderLibrary() {
  const packs = state.packs || [];
  const brands = ["all", ...Array.from(new Set(packs.map((p) => p.brand)))];
  const types = ["all", "images", "video", "map", "assets"];
  const f = state.filter;
  const shown = packs.filter((p) =>
    (f.brand === "all" || p.brand === f.brand) &&
    (f.type === "all" || p.type === f.type) &&
    (!f.q || (p.title + " " + p.id).toLowerCase().includes(f.q.toLowerCase())));
  const chip = (val, cur, kind) => `<button class="chip ${val === cur ? "active" : ""}" data-kind="${kind}" data-val="${esc(val)}"${val === cur ? ' aria-pressed="true"' : ""}>${esc(val[0].toUpperCase() + val.slice(1))}</button>`;
  document.getElementById("lib").innerHTML = `
    <div class="toolbar">
      <div class="search">${icon("search")}<input type="search" id="q" placeholder="Search ${packs.length} packs…" value="${esc(f.q)}" aria-label="Search packs" /></div>
      <div class="chips" role="group" aria-label="Filter by brand">${brands.map((b) => chip(b, f.brand, "brand")).join("")}</div>
      <div class="chips" role="group" aria-label="Filter by type">${types.map((t) => chip(t, f.type, "type")).join("")}</div>
    </div>
    <div class="grid">${shown.map(card).join("") || emptyState("No packs match these filters.")}</div>
    <p class="muted num" style="margin-top:18px;font-size:.84rem">${shown.length} of ${packs.length} shown</p>`;
  const q = document.getElementById("q");
  q.addEventListener("input", (e) => { f.q = e.target.value; renderLibrary(); const nq = document.getElementById("q"); nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); });
  view.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => { f[c.dataset.kind] = c.dataset.val; renderLibrary(); }));
}
function card(p, i) {
  const thumb = p.poster
    ? (p.posterType === "video"
        ? `<video src="${mediaUrl(p.id, p.poster)}#t=0.1" muted preload="metadata"></video>`
        : `<img loading="lazy" src="${mediaUrl(p.id, p.poster)}" alt="${esc(p.title)} — cover" />`)
    : `<div class="ph">${esc(p.title[0] || "?")}</div>`;
  const n = p.counts;
  const meta = [n.images ? n.images + " img" : "", n.videos ? n.videos + " vid" : "", !n.total ? "no media" : ""].filter(Boolean).join(" · ");
  return `<a class="card rise"${stagger(i)} href="#/pack/${encodeURIComponent(p.id)}">
    <div class="thumb">${thumb}<span class="badge type">${esc(p.type)}</span>${p.brand !== "Other" ? `<span class="badge brand">${esc(p.brand)}</span>` : ""}</div>
    <div class="body"><b>${esc(p.title)}</b><span class="meta">${meta}</span></div></a>`;
}

async function Pack(id) {
  view.innerHTML = `<a class="back" href="#/library">${icon("back")} Library</a>` + emptyState("Opening pack…");
  let p; try { p = await api("/api/pack?id=" + encodeURIComponent(id)); } catch (e) { view.innerHTML = `<a class="back" href="#/library">${icon("back")} Library</a><div class="note warn">${esc(e.message)}</div>`; return; }
  const right = `<div class="row" style="flex:0">
    <button class="btn btn-ghost btn-sm" onclick="copy(${JSON.stringify(p.path)}, 'Path copied')">${icon("copy")} Copy path</button>
    <button class="btn btn-ghost btn-sm" id="openFolder">${icon("folder")} Open folder</button></div>`;
  const docs = (p.docs || []).map((d) => `<details class="doc"><summary>${esc(d.name)}</summary><div class="pre">${/\.md$/.test(d.name) ? md(d.text) : esc(d.text)}</div></details>`).join("");
  const logs = (p.logs || []).map((d) => `<details class="doc"><summary>${esc(d.name)}</summary><div class="pre">${esc(d.text)}</div></details>`).join("");
  const imgs = p.images.map((rel, i) => `<img loading="lazy"${stagger(i)} class="rise" src="${mediaUrl(p.id, rel)}" alt="${esc(p.title)} ${i + 1}" data-i="${i}" />`).join("");
  const vids = p.videos.map((rel) => `<video class="wide" src="${mediaUrl(p.id, rel)}" controls preload="metadata"></video>`).join("");
  view.innerHTML = `<a class="back" href="#/library">${icon("back")} Library</a>
    ${head(p.brand !== "Other" ? p.brand : "Pack", p.title, p.id, right)}
    <div class="panel"><div class="kv">
      <dt>type</dt><dd>${esc(p.type)}</dd>
      <dt>images</dt><dd>${p.counts.images}</dd>
      <dt>videos</dt><dd>${p.counts.videos}</dd></div></div>
    ${docs ? `<h2 style="margin:18px 0 10px">Notes &amp; script</h2>${docs}` : ""}
    ${vids ? `<h2 style="margin:22px 0 10px">Video</h2><div class="media-grid">${vids}</div>` : ""}
    ${imgs ? `<h2 style="margin:22px 0 10px">Images <span class="muted num" style="font:500 .8rem/1 var(--mono)">(${p.counts.images})</span></h2><div class="media-grid" id="imgGrid">${imgs}</div>` : ""}
    ${logs ? `<h2 style="margin:22px 0 10px">Logs</h2>${logs}` : ""}
    ${!p.counts.total ? emptyState("This pack has no image/video files (it may hold only manifests or status).") : ""}`;
  const of = document.getElementById("openFolder");
  if (of) of.addEventListener("click", async () => { try { await api("/api/open-folder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id }) }); toast("Opened in Explorer"); } catch (e) { toast(e.message); } });
  const grid = document.getElementById("imgGrid");
  if (grid) {
    const items = p.images.map((rel) => ({ src: mediaUrl(p.id, rel), cap: rel.split("/").pop() }));
    grid.querySelectorAll("img").forEach((im) => im.addEventListener("click", () => openLightbox(items, Number(im.dataset.i))));
  }
}

async function Create() {
  view.innerHTML = head("Launch", "Create", "Compose the exact instruction to run a pipeline in Claude Code. Paid or irreversible steps are gated — the Studio never starts them for you.") + `
    <div class="split">
      <div class="panel">
        <div class="field"><label for="pipeline">Pipeline</label>
          <select id="pipeline">
            <option value="images">Image pack — consistent frames from a script</option>
            <option value="video">Video clips — Veo (gated · costs money)</option>
            <option value="map">Map animation — real boundary data (gated render)</option>
            <option value="subtitles">Subtitles — SRT/VTT (free, builds here)</option>
          </select></div>
        <div class="row">
          <div class="field"><label for="aspect">Aspect</label><select id="aspect"><option>9:16</option><option>4:5</option><option>1:1</option><option>16:9</option></select></div>
          <div class="field"><label for="language">Language</label><select id="language"><option value="ne">Nepali</option><option value="hi">Hindi</option><option value="en">English</option></select></div>
          <div class="field" id="secWrap" hidden><label for="seconds">Clip seconds</label><input id="seconds" type="number" value="6" min="2" max="8" /></div>
        </div>
        <div class="row">
          <div class="field" id="styleWrap"><label for="styleSel">Visual style <span class="muted">(optional)</span></label><select id="styleSel"><option value="">— none —</option></select></div>
          <div class="field" id="motionWrap" hidden><label for="motionSel">Camera / motion <span class="muted">(optional)</span></label><select id="motionSel"><option value="">— none —</option></select></div>
        </div>
        <div class="field" id="durWrap" hidden><label for="duration">Voice-over length (for subtitles)</label><input id="duration" placeholder="1:35 or 95" /><p class="help">The subtitle timing is spread across this length.</p></div>
        <div class="field"><label for="script">Script</label><textarea id="script" rows="9" placeholder="Paste your Nepali / Hindi / English script…"></textarea></div>
        <div class="field"><label for="sensitive">Sensitive-content note (optional)</label><input id="sensitive" placeholder="e.g. imply the battle, not graphic" /></div>
        <div class="row"><button class="btn btn-primary" id="composeBtn">Compose instruction</button>
          <button class="btn btn-ghost" id="srtBtn" hidden>Build SRT now</button></div>
      </div>
      <div class="panel" id="out"><div class="empty">${icon("create")}<p>Pick a pipeline, paste a script, and press <b>Compose</b>.<br>For subtitles you can build the file right here.</p></div></div>
    </div>`;
  const pipeline = document.getElementById("pipeline");
  const sync = () => {
    const v = pipeline.value;
    document.getElementById("secWrap").hidden = v !== "video";
    document.getElementById("durWrap").hidden = v !== "subtitles";
    document.getElementById("srtBtn").hidden = v !== "subtitles";
    document.getElementById("styleWrap").hidden = !(v === "images" || v === "video");
    document.getElementById("motionWrap").hidden = v !== "video";
  };
  pipeline.addEventListener("change", sync); sync();
  // Populate style/motion selectors from the preset library.
  getPresets().then((p) => {
    const fill = (sel, arr) => { if (sel) sel.insertAdjacentHTML("beforeend", arr.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")); };
    fill(document.getElementById("styleSel"), p.visual || []);
    fill(document.getElementById("motionSel"), p.motion || []);
  }).catch(() => {});

  document.getElementById("composeBtn").addEventListener("click", async () => {
    const body = { pipeline: pipeline.value, aspect: aspect.value, language: language.value, seconds: Number(document.getElementById("seconds").value || 6), script: document.getElementById("script").value, sensitive: document.getElementById("sensitive").value, styleId: document.getElementById("styleSel").value, motionId: document.getElementById("motionSel").value };
    try {
      const r = await api("/api/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const gate = r.gated ? `<div class="note warn">Gated: this step costs money or is irreversible. The Studio will not start it — approve it inside Claude Code.</div>` : r.paid ? `<div class="note">Note: generation bills your Google Cloud project.</div>` : "";
      document.getElementById("out").innerHTML = `<h2>Paste into Claude Code</h2>${gate}
        ${pre(r.claudePrompt, "Prompt")}
        ${r.cli ? `<div style="margin-top:14px">${pre(r.cli, "Or run")}</div>` : ""}
        ${(r.notes || []).map((n) => `<div class="note">${esc(n)}</div>`).join("")}`;
    } catch (e) { toast(e.message); }
  });
  document.getElementById("srtBtn").addEventListener("click", async () => {
    const script = document.getElementById("script").value, duration = document.getElementById("duration").value;
    const secs = parseDuration(duration);
    if (!script.trim()) return toast("Paste a script first");
    if (!secs) return toast("Give a valid length, e.g. 1:35");
    try {
      const r = await api("/api/subtitles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, durationSeconds: secs, format: "srt", encoding: "unicode" }) });
      document.getElementById("out").innerHTML = `<h2 class="num">${r.cueCount} subtitles · ${r.format.toUpperCase()}</h2>
        <div class="row" style="margin-bottom:10px"><button class="btn btn-primary btn-sm" id="dl">Download .srt</button>
        <a class="btn btn-ghost btn-sm" href="#/subtitles">Open full editor →</a></div>${pre(r.text, "episode.srt")}`;
      document.getElementById("dl").addEventListener("click", () => download("episode.srt", r.text));
    } catch (e) { toast(e.message); }
  });
}
function parseDuration(v) {
  v = String(v || "").trim(); if (!v) return 0;
  if (v.includes(":")) { const parts = v.split(":").map(Number); return parts.reduce((a, b) => a * 60 + b, 0); }
  return Number(v) || 0;
}
function download(name, text) {
  const blob = new Blob(["﻿" + text], { type: "text/plain" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

async function Styles() {
  view.innerHTML = head("Prompt library", "Styles", "Named visual-style and camera-motion presets with ready prompt templates — the vocabulary for every kind of content. Use them in Create, or copy a template. Placeholders in [BRACKETS].") + `<div id="styles"></div>`;
  let p; try { p = await getPresets(); } catch (e) { document.getElementById("styles").innerHTML = `<div class="note warn">${esc(e.message)}</div>`; return; }
  const presetCard = (x, i, kind) => `<div class="panel rise" style="margin:0${reduceMotion ? "" : `;animation-delay:${Math.min(i, 22) * 30}ms`}">
    <div class="page-head" style="margin-bottom:8px"><div><h3 style="font-family:var(--serif);font-size:1.05rem">${esc(x.name)}</h3><p class="sub" style="margin-top:4px">${esc(x.desc || "")}</p></div>
      <button class="btn btn-ghost btn-sm" onclick="copy(${JSON.stringify(x.template)}, 'Template copied')">${icon("copy")} Copy</button></div>
    ${(x.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
    <div class="pre" style="margin-top:10px">${esc(x.template)}</div></div>`;
  const grid2 = (arr, kind) => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">${arr.map((x, i) => presetCard(x, i, kind)).join("")}</div>`;
  const hooks = (p.text?.hooks || []).map((h) => `<div class="note"><b>${esc(h.name)}</b> — ${esc(h.template)}</div>`).join("");
  document.getElementById("styles").innerHTML = `
    <h2 style="margin:4px 0 12px">Visual styles <span class="muted num" style="font:500 .8rem/1 var(--mono)">(${p.visual.length})</span></h2>
    ${grid2(p.visual, "visual")}
    <h2 style="margin:26px 0 12px">Camera &amp; motion <span class="muted num" style="font:500 .8rem/1 var(--mono)">(${p.motion.length})</span> <span class="muted" style="font-size:.8rem">· append one per clip</span></h2>
    ${grid2(p.motion, "motion")}
    <h2 style="margin:26px 0 12px">Hooks, caption &amp; CTA</h2>
    <div class="panel">${hooks}
      <div class="note"><b>Caption default</b> — ${esc(p.text?.caption || "")}</div>
      <div class="note"><b>CTA</b> — ${esc(p.text?.cta || "")}</div></div>
    <p class="muted" style="margin-top:14px;font-size:.82rem">Seeded from <code>studio/research/CONTENT-MACHINE-RESEARCH.md</code>. Add your own in <code>studio/data/style-presets.json</code>.</p>`;
}

async function Voice() {
  view.innerHTML = head("Narration", "Voice", "Nepali · Hindi · English. Naamche Labs' Swar and Kriti are open-weight (self-hosted, no hosted API); Hindi uses a bring-your-own TTS slot. Nothing is wired until you connect it.") + `<div id="slots"></div>`;
  let slots; try { slots = (await api("/api/voice")).slots; } catch (e) { document.getElementById("slots").innerHTML = `<div class="note warn">${esc(e.message)}</div>`; return; }
  document.getElementById("slots").innerHTML = slots.map((s, i) => voiceCard(s, i)).join("");
  slots.forEach((s) => {
    const btn = document.getElementById("save-" + s.id);
    if (btn) btn.addEventListener("click", async () => {
      const patch = { providers: {} };
      if (s.setup.type === "api-key") patch.providers[s.id] = { provider: document.getElementById("prov-" + s.id).value, apiKey: document.getElementById("key-" + s.id).value, note: document.getElementById("note-" + s.id).value };
      else patch.providers[s.id] = { endpoint: document.getElementById("ep-" + s.id).value, note: document.getElementById("note-" + s.id).value };
      try { await api("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); toast("Saved locally ✓"); Voice(); } catch (e) { toast(e.message); }
    });
  });
}
function voiceCard(s, i) {
  const tag = s.connected ? `<span class="tag on">connected</span>` : `<span class="tag off">not connected</span>`;
  const langs = s.languages.map((l) => `<span class="tag">${esc(l)}</span>`).join("");
  const links = s.setup.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join(" · ");
  const steps = s.setup.steps.map((t) => `<li>${esc(t)}</li>`).join("");
  const form = s.setup.type === "api-key"
    ? `<div class="row"><div class="field"><label>Provider</label><input id="prov-${s.id}" value="${esc(s.saved.provider)}" placeholder="elevenlabs / google / azure" /></div>
         <div class="field"><label>API key ${s.saved.hasKey ? "(saved)" : ""}</label><input id="key-${s.id}" type="password" placeholder="${s.saved.hasKey ? "•••• leave blank to keep" : "paste key"}" /></div></div>`
    : `<div class="field"><label>Inference endpoint URL</label><input id="ep-${s.id}" value="${esc(s.saved.endpoint)}" placeholder="http://127.0.0.1:8000/…  (from your Colab/local run)" /></div>`;
  return `<div class="panel rise"${stagger(i)}>
    <div class="page-head" style="margin-bottom:10px"><div><h2>${esc(s.name)}</h2><p class="sub">${esc(s.vendor)} · ${esc(s.kind)}</p></div>${tag}</div>
    <p class="muted">${esc(s.summary)}</p>
    <div style="margin:8px 0 14px">${langs}</div>
    <details class="doc"><summary>How to connect</summary>
      <ol style="color:var(--muted);margin:8px 0 10px 18px">${steps}</ol>
      <p style="font-size:.9rem">${links}</p>
      ${form}
      <div class="field" style="margin-top:10px"><label>Note (optional)</label><input id="note-${s.id}" value="${esc(s.saved.note)}" /></div>
      <button class="btn btn-primary btn-sm" id="save-${s.id}">Save connection</button>
    </details></div>`;
}

function Subtitles() {
  view.innerHTML = head("Captions", "Subtitles", "The free in-browser editor — paste a script, time it to your voice-over, export for Premiere Pro or DaVinci Resolve (Unicode or Preeti). Runs fully local.") + `
    <div class="note">Nepali voice-matching (Cloudflare Whisper) needs the hosted site; the free proportional timing works here offline.</div>
    <iframe class="tool" src="/subtool/subtitles.html" title="Subtitle editor"></iframe>`;
}

async function Settings() {
  view.innerHTML = head("Setup", "MCP & APIs", "The content-machine MCP drives all generation. Here's its health, the lines to add the MCP on any machine, and your local API keys.") + `<div id="set"></div>`;
  let h, cfg; try { [h, cfg] = await Promise.all([api("/api/mcp"), api("/api/config")]); } catch (e) { document.getElementById("set").innerHTML = `<div class="note warn">${esc(e.message)}</div>`; return; }
  const sp = h.secretsPresent || {};
  const mcpBlock = h.mcp || {};
  document.getElementById("set").innerHTML = `
    <div class="split">
      <div class="panel"><h2>Engine health</h2>
        <div class="note ${h.configured ? "" : "warn"}">${h.configured ? "Configured — ready to generate." : "Not configured. Run <code>npm run setup</code> in the Content Machine folder."}</div>
        <div class="kv" style="margin-top:12px">
          <dt>mcp name</dt><dd><code>${esc(h.install.mcpName)}</code></dd>
          <dt>cloud project</dt><dd>${esc(h.project)}</dd>
          <dt>location</dt><dd>${esc(h.location)}</dd>
          <dt>video bucket</dt><dd>${esc(h.bucket || "—")}</dd>
          <dt>image model</dt><dd>${esc(h.models.image)}</dd>
          <dt>video model</dt><dd>${esc(h.models.video)}</dd>
          <dt>prompt model</dt><dd>${esc(h.models.prompt)}</dd>
          <dt>bundle</dt><dd>${esc(h.bundleVersion || "—")}</dd>
        </div>
        <div style="margin-top:12px">
          <span class="tag ${sp.ELEVENLABS_API_KEY ? "on" : "off"}">ElevenLabs key ${sp.ELEVENLABS_API_KEY ? "present" : "absent"}</span>
          <span class="tag ${sp.CLOUDFLARE_API_TOKEN ? "on" : "off"}">Cloudflare token ${sp.CLOUDFLARE_API_TOKEN ? "present" : "absent"}</span>
        </div>
      </div>
      <div class="panel"><h2>Add the engine MCP</h2>
        <p class="muted">Installs &amp; registers the <code>content-machine</code> MCP for Claude Code / Codex. Runs locally with the user's own Google account.</p>
        ${pre(h.install.windows, "Windows · PowerShell")}
        <div style="margin-top:12px">${pre(h.install.mac, "macOS / Linux")}</div>
        <p style="margin-top:12px"><a href="${esc(h.install.site)}" target="_blank" rel="noopener">${esc(h.install.site)} ↗</a></p>
      </div>
    </div>
    <div class="panel"><h2>Add the Studio MCP ${mcpBlock.ready ? `<span class="tag on">MCP-ready</span>` : ""}</h2>
      <p class="muted">Exposes your Library and tools (list packs, read a pack, compose prompts, build subtitles) to any MCP client. Register it in Claude Code:</p>
      ${pre(mcpBlock.addCommand || "claude mcp add content-machine-studio -- node \"" + (h.repoRoot || "") + "/studio/mcp/studio-mcp.mjs\"", "claude mcp add")}
      <div style="margin-top:12px">${pre(JSON.stringify(mcpBlock.clientConfig || {}, null, 2), "mcp.json (for other clients)")}</div>
      ${mcpBlock.httpNote ? `<div class="note">${esc(mcpBlock.httpNote)}</div>` : ""}
    </div>
    <div class="panel"><h2>Voice / TTS API key</h2>
      <p class="muted">Stored locally in <code>studio/studio.config.local.json</code> (gitignored). Used by the Voice tab's TTS slot for Hindi/English.</p>
      <div class="row"><div class="field"><label>Provider</label><input id="sp" value="${esc(cfg.providers?.tts?.provider || "")}" placeholder="elevenlabs / google / azure" /></div>
        <div class="field"><label>API key ${cfg.providers?.tts?.apiKey ? "(saved: " + esc(cfg.providers.tts.apiKey) + ")" : ""}</label><input id="sk" type="password" placeholder="paste key — blank keeps current" /></div></div>
      <button class="btn btn-primary btn-sm" id="saveKey">Save key</button>
    </div>`;
  document.getElementById("saveKey").addEventListener("click", async () => {
    const provider = document.getElementById("sp").value, apiKey = document.getElementById("sk").value;
    const patch = { providers: { tts: { provider } } };
    if (apiKey) patch.providers.tts.apiKey = apiKey;
    try { await api("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); toast("Saved ✓"); Settings(); } catch (e) { toast(e.message); }
  });
}

// ---------- router ----------
const routes = { library: Library, create: Create, styles: Styles, voice: Voice, subtitles: Subtitles, settings: Settings };
function router() {
  closeLightbox();
  const hash = location.hash.replace(/^#\/?/, "") || "library";
  const [name, arg] = hash.split("/");
  document.querySelectorAll(".navlink").forEach((a) => {
    const on = a.dataset.route === (name === "pack" ? "library" : name);
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  view.scrollTo ? window.scrollTo(0, 0) : null;
  if (name === "pack" && arg) return Pack(decodeURIComponent(arg));
  (routes[name] || Library)();
}
window.addEventListener("hashchange", router);

async function boot() {
  router();
  try {
    const h = await api("/api/mcp");
    sideFoot.innerHTML = `<span class="dot ${h.configured ? "ok" : "warn"}"></span> engine ${h.configured ? "ready" : "not set up"}<br><span style="color:var(--dim)">${esc(h.install.mcpName)}</span>`;
  } catch { sideFoot.innerHTML = `<span class="dot warn"></span> engine unknown`; }
}
boot();
