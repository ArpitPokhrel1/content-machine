// Content Machine Studio — PUBLIC web subset for content.tarjun.com/studio.
// 100% static + client-side (no server): a prompt-style Library, a prompt
// Composer, and a Subtitle builder that reuses the same engine the /subtitles
// page ships. The full cockpit (local Library, video, maps, MCP) runs locally.
import { makeCues, buildFile, parseTime } from "../sub/subtitles.mjs";

const view = document.getElementById("view");

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id) => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const stagger = (i) => reduceMotion ? "" : ` style="animation-delay:${Math.min(i, 22) * 30}ms"`;
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 1800); }
async function copy(text, label) { try { await navigator.clipboard.writeText(text); toast((label || "Copied") + " ✓"); } catch { toast("Copy failed"); } }
window.copy = copy;
function pre(text, label) {
  const id = "c" + Math.random().toString(36).slice(2, 8); window["__" + id] = text;
  return `<div class="copybar"><span class="muted" style="font-size:.82rem">${esc(label || "")}</span>
    <button class="btn btn-ghost btn-sm" onclick="copy(window.__${id}, 'Copied')">${icon("copy")} Copy</button></div>
    <div class="pre">${esc(text)}</div>`;
}
const head = (eyebrow, title, sub) => `<div class="page-head"><div>${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}</div></div>`;

let PRESETS = null;
async function getPresets() { if (!PRESETS) PRESETS = await (await fetch("/studio/style-presets.json")).json(); return PRESETS; }

// ---------- compose (mirrors studio/lib/engine.mjs, pure) ----------
const ASPECTS = { "9:16": "vertical 9:16 (reel / short)", "4:5": "portrait 4:5 (feed)", "1:1": "square 1:1", "16:9": "wide 16:9 (landscape)" };
const LANGS = { ne: "Nepali", hi: "Hindi", en: "English" };
function findPreset(p, id) { return (p.visual || []).find((x) => x.id === id) || (p.motion || []).find((x) => x.id === id) || null; }
function compose(p, { pipeline, script = "", aspect = "9:16", language = "ne", seconds = 6, sensitive = "", styleId = "", motionId = "" }) {
  const A = ASPECTS[aspect] || aspect, L = LANGS[language] || language;
  const sb = script.trim() ? `\n\nSCRIPT:\n"""\n${script.trim()}\n"""` : "";
  const sens = sensitive.trim() ? `\n\nSensitive-content note: ${sensitive.trim()}` : "";
  const st = styleId ? findPreset(p, styleId) : null, mo = motionId ? findPreset(p, motionId) : null;
  const sl = st ? `\n\nVisual style — ${st.name}: ${st.template}` : "";
  const ml = mo ? `\n\nCamera / motion — ${mo.name}: ${mo.template}` : "";
  if (pipeline === "images") return { gated: false, paid: true, prompt: `Use content-machine to make a ${A} image pack from this ${L} script. Keep every character and location consistent across all frames (one frame per ~4 words). Pictures must contain no text, signs or numbers.${sl}${sens}${sb}`, notes: ["Images bill your Google Cloud project a few cents per frame; no approval gate."] };
  if (pipeline === "video") return { gated: true, paid: true, prompt: `Use content-machine to turn the approved frames of this ${L} story into ${seconds}-second ${A} video clips. Show me the exact clips, lengths and estimated cost first and wait for my yes. Generate one pilot clip, then the rest in parallel after it passes.${sl}${ml}${sens}${sb}`, notes: ["⚠ Video costs real money and is gated — approve the exact clips and cost inside Claude Code."] };
  if (pipeline === "map") return { gated: true, paid: false, prompt: `Use content-machine to make an animated map for this story (real boundary data, not a generative model). Ask the map scoping questions in one batch, then show the plan. Do not render until I approve regions, admin levels, data sources and render time.${sb}`, notes: ["Maps are drawn from real open data; render is gated."] };
  return { gated: false, paid: false, prompt: `Use content-machine make_subtitles for this ${L} script, ${A}. Time it to the voice-over length.${sb}`, notes: ["Free — or build it right here on the Subtitles tab."] };
}

// ---------- views ----------
async function Styles() {
  view.innerHTML = head("Prompt library", "Styles", "Named visual-style and camera-motion presets with ready prompt templates — the vocabulary for every kind of content. Placeholders in [BRACKETS].") + `<div id="s"></div>`;
  let p; try { p = await getPresets(); } catch (e) { document.getElementById("s").innerHTML = `<div class="note warn">Couldn't load presets: ${esc(e.message)}</div>`; return; }
  const cardOf = (x, i) => `<div class="panel rise" style="margin:0${reduceMotion ? "" : `;animation-delay:${Math.min(i, 22) * 30}ms`}">
    <div class="page-head" style="margin-bottom:8px"><div><h3 style="font-family:var(--serif);font-size:1.05rem">${esc(x.name)}</h3><p class="sub" style="margin-top:4px">${esc(x.desc || "")}</p></div>
      <button class="btn btn-ghost btn-sm" onclick="copy(${JSON.stringify(x.template)}, 'Template copied')">${icon("copy")} Copy</button></div>
    ${(x.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}
    <div class="pre" style="margin-top:10px">${esc(x.template)}</div></div>`;
  const grid = (arr) => `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">${arr.map(cardOf).join("")}</div>`;
  const hooks = (p.text?.hooks || []).map((h) => `<div class="note"><b>${esc(h.name)}</b> — ${esc(h.template)}</div>`).join("");
  document.getElementById("s").innerHTML = `
    <h2 style="margin:4px 0 12px">Visual styles <span class="muted num" style="font:500 .8rem/1 var(--mono)">(${p.visual.length})</span></h2>${grid(p.visual)}
    <h2 style="margin:26px 0 12px">Camera &amp; motion <span class="muted num" style="font:500 .8rem/1 var(--mono)">(${p.motion.length})</span> <span class="muted" style="font-size:.8rem">· one per clip</span></h2>${grid(p.motion)}
    <h2 style="margin:26px 0 12px">Hooks, caption &amp; CTA</h2><div class="panel">${hooks}
      <div class="note"><b>Caption default</b> — ${esc(p.text?.caption || "")}</div>
      <div class="note"><b>CTA</b> — ${esc(p.text?.cta || "")}</div></div>`;
}

async function Create() {
  const p = await getPresets().catch(() => ({ visual: [], motion: [] }));
  view.innerHTML = head("Prompt composer", "Composer", "Compose the exact instruction to run a pipeline in Content Machine (Claude Code + the MCP). The web app only writes the prompt — paid or irreversible steps are run and approved locally.") + `
    <div class="split">
      <div class="panel">
        <div class="field"><label for="pipeline">Pipeline</label>
          <select id="pipeline">
            <option value="images">Image pack — consistent frames from a script</option>
            <option value="video">Video clips — Veo (gated · costs money)</option>
            <option value="map">Map animation — real boundary data (gated)</option>
            <option value="subtitles">Subtitles — SRT/VTT</option>
          </select></div>
        <div class="row">
          <div class="field"><label for="aspect">Aspect</label><select id="aspect"><option>9:16</option><option>4:5</option><option>1:1</option><option>16:9</option></select></div>
          <div class="field"><label for="language">Language</label><select id="language"><option value="ne">Nepali</option><option value="hi">Hindi</option><option value="en">English</option></select></div>
          <div class="field" id="secWrap" hidden><label for="seconds">Clip seconds</label><input id="seconds" type="number" value="6" min="2" max="8" /></div>
        </div>
        <div class="row">
          <div class="field" id="styleWrap"><label for="styleSel">Visual style <span class="muted">(optional)</span></label><select id="styleSel"><option value="">— none —</option>${(p.visual || []).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div>
          <div class="field" id="motionWrap" hidden><label for="motionSel">Camera / motion <span class="muted">(optional)</span></label><select id="motionSel"><option value="">— none —</option>${(p.motion || []).map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label for="script">Script</label><textarea id="script" rows="8" placeholder="Paste your Nepali / Hindi / English script…"></textarea></div>
        <div class="field"><label for="sensitive">Sensitive-content note (optional)</label><input id="sensitive" placeholder="e.g. imply the battle, not graphic" /></div>
        <button class="btn btn-primary" id="go">Compose instruction</button>
      </div>
      <div class="panel" id="out"><div class="empty">${icon("create")}<p>Pick a pipeline, paste a script, and press <b>Compose</b>.</p></div></div>
    </div>`;
  const g = (id) => document.getElementById(id);
  const sync = () => { const v = g("pipeline").value; g("secWrap").hidden = v !== "video"; g("styleWrap").hidden = !(v === "images" || v === "video"); g("motionWrap").hidden = v !== "video"; };
  g("pipeline").addEventListener("change", sync); sync();
  g("go").addEventListener("click", async () => {
    const pp = await getPresets();
    const r = compose(pp, { pipeline: g("pipeline").value, aspect: g("aspect").value, language: g("language").value, seconds: Number(g("seconds").value || 6), script: g("script").value, sensitive: g("sensitive").value, styleId: g("styleSel").value, motionId: g("motionSel").value });
    const gate = r.gated ? `<div class="note warn">Gated: costs money or is irreversible — approve it inside Claude Code.</div>` : r.paid ? `<div class="note">Note: generation bills your Google Cloud project.</div>` : "";
    g("out").innerHTML = `<h2>Paste into Claude Code</h2>${gate}${pre(r.prompt, "Prompt")}${(r.notes || []).map((n) => `<div class="note">${esc(n)}</div>`).join("")}
      <p class="muted" style="margin-top:12px;font-size:.84rem">Need the engine? <a href="/assets#install">Install Content Machine ↗</a></p>`;
  });
}

function Subtitles() {
  view.innerHTML = head("Captions", "Subtitles", "Paste a script and a voice-over length; get an SRT/VTT, timed proportionally. Runs fully in your browser. For voice-matching and Preeti fine-tuning, use the full editor.") + `
    <div class="split">
      <div class="panel">
        <div class="field"><label for="script">Script</label><textarea id="script" rows="9" placeholder="Paste your script…"></textarea></div>
        <div class="row">
          <div class="field"><label for="dur">Voice-over length</label><input id="dur" placeholder="1:35 or 95" /></div>
          <div class="field"><label for="fmt">Format</label><select id="fmt"><option value="srt">SRT (Premiere / Resolve)</option><option value="vtt">VTT (web)</option></select></div>
          <div class="field"><label for="enc">Encoding</label><select id="enc"><option value="unicode">Unicode</option><option value="preeti">Preeti</option></select></div>
        </div>
        <button class="btn btn-primary" id="go">Build subtitles</button>
        <p class="muted" style="margin-top:12px;font-size:.84rem"><a href="/subtitles">Open the full editor (voice-match, fonts, preview) →</a></p>
      </div>
      <div class="panel" id="out"><div class="empty">${icon("subs")}<p>Paste a script and a length, then press <b>Build</b>.</p></div></div>
    </div>`;
  const g = (id) => document.getElementById(id);
  g("go").addEventListener("click", () => {
    const script = g("script").value.trim(); if (!script) return toast("Paste a script first");
    const secs = parseTime(g("dur").value || ""); if (!Number.isFinite(secs) || secs <= 0) return toast("Give a length, e.g. 1:35");
    try {
      const cues = makeCues(script, secs, {});
      const text = buildFile(cues, { format: g("fmt").value, encoding: g("enc").value });
      g("out").innerHTML = `<h2 class="num">${cues.length} subtitles · ${g("fmt").value.toUpperCase()}</h2>
        <button class="btn btn-primary btn-sm" id="dl" style="margin-bottom:10px">Download .${g("fmt").value}</button>${pre(text, "episode." + g("fmt").value)}`;
      g("dl").addEventListener("click", () => { const blob = new Blob(["﻿" + text], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "episode." + g("fmt").value; a.click(); URL.revokeObjectURL(a.href); });
    } catch (e) { toast(e.message); }
  });
}

// ---------- router ----------
const routes = { styles: Styles, create: Create, subtitles: Subtitles };
function router() {
  const name = location.hash.replace(/^#\/?/, "").split("/")[0] || "styles";
  document.querySelectorAll(".navlink[data-route]").forEach((a) => { const on = a.dataset.route === name; a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  window.scrollTo(0, 0);
  (routes[name] || Styles)();
}
window.addEventListener("hashchange", router);
router();
