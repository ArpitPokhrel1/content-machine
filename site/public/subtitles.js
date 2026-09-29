// Script → subtitles editor (content.tarjun.com/subtitles). Everything runs in the browser.
// The engine in ./sub/ is copied at build time from the repo's subtitles/lib, the same code
// the CLI and the content-machine MCP tool use.
import { splitScript, timeCues, retime, shift, buildFile, parseFile, parseTime, visibleLength, unicodeToPreeti, preetiToUnicode } from "./sub/subtitles.mjs";

import { parseAudioReview, STRATEGY_LABELS, buildAss } from "./sub/audio-review.mjs";

const $ = s => document.querySelector(s);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const radio = name => document.querySelector(`input[name="${name}"]:checked`)?.value;
const setRadio = (name, value) => { const r = document.querySelector(`input[name="${name}"][value="${value}"]`); if (r) r.checked = true; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ---------- state ----------
const KEY = "cm-subtitles-v1";
let cues = [];
let total = 0;            // seconds: from the media file, else the typed length
let mediaName = "";
let active = -1;
let audioReview = null, audioStrategy = null;
let fonts = { unicode: [], preeti: [], english: [] };
const DEFAULT_ON = {
  unicode: ["Mukta", "Noto Sans Devanagari", "Hind", "Kalimati", "Mangal", "Nirmala UI", "Yatra One", "Rozha One", "Tiro Devanagari Hindi", "Kalam", "Baloo 2"],
  preeti: ["Preeti", "Ganess", "Aakriti", "Kanchan", "Himalli", "Bhaktapur"],
  english: ["Inter", "Montserrat", "Poppins", "Roboto", "Open Sans", "Bebas Neue", "Arial", "Calibri"]
};
let enabled = structuredClone(DEFAULT_ON);

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      script: $("#script").value, inEnc: radio("inEnc"), duration: $("#duration").value, maxChars: $("#maxChars").value,
      lines: radio("lines"), startAt: $("#startAt").value, cues, outEnc: radio("outEnc"), font: $("#font").value,
      size: $("#size").value, color: $("#color").value, look: radio("look"), aspect: radio("aspect"), captionPosition: $("#captionPosition").value, enabled
    }));
  } catch { /* private mode or storage blocked: the editor still works, it just won't remember */ }
}
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); };

function restore() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { s = null; }
  if (!s) return;
  $("#script").value = s.script || "";
  setRadio("inEnc", s.inEnc); setRadio("lines", s.lines); setRadio("outEnc", s.outEnc); setRadio("look", s.look); setRadio("aspect", s.aspect);
  $("#duration").value = s.duration || ""; $("#maxChars").value = s.maxChars || 42; $("#startAt").value = s.startAt || "0:00";
  $("#size").value = s.size || 46; $("#color").value = s.color || "#ffffff";
  $("#captionPosition").value = ["bottom", "center", "top"].includes(s.captionPosition) ? s.captionPosition : "bottom";
  cues = Array.isArray(s.cues) ? s.cues : [];
  if (s.enabled) enabled = { ...DEFAULT_ON, ...s.enabled };
  restore.font = s.font;
}

// ---------- time helpers ----------
function fmt(t) {
  if (!Number.isFinite(t)) return "";
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t - Math.floor(t / 60) * 60;
  const ss = s.toFixed(3).padStart(6, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
const short = t => `${String(Math.floor(t / 60)).padStart(2, "0")}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const typedTotal = () => parseTime($("#duration").value);
function currentTotal() {
  const m = $("#player");
  if (m.src && Number.isFinite(m.duration)) return m.duration;
  const typed = typedTotal();
  if (Number.isFinite(typed) && typed > 0) return typed;
  return cues.length ? cues.at(-1).end : 0;
}

// ---------- fonts ----------
const loadedGoogle = new Set();
function loadGoogle(name) {
  if (loadedGoogle.has(name)) return;
  loadedGoogle.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, "+")}:wght@400;700&display=swap`;
  document.head.append(link);
}
const installCache = new Map();
// A local font is "installed" if text measured in it differs from both fallback measurements.
function isInstalled(name) {
  if (installCache.has(name)) return installCache.get(name);
  const ctx = document.createElement("canvas").getContext("2d");
  const sample = "abcdefghijklmnopqrstuvwxyz{}[]'\";:/?<>1234567890 नेपाल";
  const w = f => { ctx.font = `40px ${f}`; return ctx.measureText(sample).width; };
  const result = ["monospace", "serif", "sans-serif"].some(base => w(`"${name}", ${base}`) !== w(base));
  installCache.set(name, result);
  return result;
}
const fontInfo = name => [...fonts.unicode, ...fonts.preeti, ...fonts.english].find(f => f.name === name);
function prepareFont(name) {
  const f = fontInfo(name);
  if (f?.web === "google") loadGoogle(name);
}

function fillFontSelect() {
  const sel = $("#font");
  const enc = radio("outEnc");
  const want = sel.value || restore.font || (enc === "preeti" ? "Preeti" : "Mukta");
  const groups = enc === "preeti"
    ? [["Nepali · Preeti", fonts.preeti]]
    : [["Nepali · Unicode", fonts.unicode], ["English", fonts.english]];
  sel.innerHTML = groups.map(([label, list]) => {
    const on = list.filter(f => enabled[f === undefined ? "" : groupOf(f)]?.includes(f.name));
    return on.length ? `<optgroup label="${label}">${on.map(f => `<option>${esc(f.name)}</option>`).join("")}</optgroup>` : "";
  }).join("");
  if (!sel.options.length) sel.innerHTML = `<option>${enc === "preeti" ? "Preeti" : "Mukta"}</option>`;
  const has = v => [...sel.options].some(o => o.value === v);
  const fallback = enc === "preeti" ? "Preeti" : "Mukta";
  sel.value = has(want) ? want : has(fallback) ? fallback : sel.options[0].value;
  restore.font = null;
  applyStyle();
}
const groupOf = f => fonts.english.includes(f) ? "english" : f.encoding === "preeti" ? "preeti" : "unicode";

function fontNote() {
  const name = $("#font").value, f = fontInfo(name), enc = radio("outEnc");
  const note = $("#font-note");
  const hasNepali = cues.some(c => /[ऀ-ॿ]/.test(c.text));
  if (enc === "preeti") {
    note.innerHTML = isInstalled(name)
      ? `${esc(name)} is installed: the preview shows the real Preeti text.`
      : `${esc(name)} isn't installed on this computer, so the preview shows it in Unicode. The exported file is still correct. ${f?.url ? `<a href="${f.url}" target="_blank" rel="noopener">Get ${esc(name)}</a>.` : ""}`;
  } else if (f && groups.isEnglish(f) && hasNepali) {
    note.textContent = `${name} has no Nepali letters. Premiere and Resolve would show empty boxes; pick a Nepali Unicode font for Nepali lines.`;
  } else if (f?.web === "local") {
    note.textContent = isInstalled(name) ? `${name} is installed on this computer.` : `${name} isn't installed on this computer; the preview uses a similar font.`;
  } else note.textContent = "";
  document.querySelectorAll(".font-name").forEach(n => { n.textContent = name; });
}
const groups = { isEnglish: f => fonts.english.includes(f) };

function applyStyle() {
  const stage = $("#stage"), cap = $("#caption");
  const name = $("#font").value;
  prepareFont(name);
  stage.style.setProperty("--cap-font", `"${name}"`);
  stage.style.setProperty("--cap-size", $("#size").value);
  stage.style.setProperty("--cap-color", $("#color").value);
  cap.className = `caption look-${radio("look")}`;
  stage.dataset.aspect = radio("aspect");
  stage.dataset.position = $("#captionPosition").value;
  fontNote();
  renderCaption(true);
  saveSoon();
}

// ---------- font dialog ----------
let fdGroup = "unicode";
function renderFontList() {
  const q = $("#fontSearch").value.trim().toLowerCase();
  const list = fonts[fdGroup].filter(f => !q || f.name.toLowerCase().includes(q));
  const sample = fdGroup === "english" ? "The story begins at dawn" : fdGroup === "preeti" ? unicodeToPreeti("यो कथा ३०० वर्ष पुरानो हो।") : "यो कथा ३०० वर्ष पुरानो हो।";
  $("#fontList").innerHTML = list.map(f => {
    const on = enabled[fdGroup].includes(f.name);
    const tag = f.web === "google" ? "Google Fonts" : f.source === "windows" ? "Built into Windows" : f.source === "system" ? "System font" : "Install to preview";
    const get = f.url && f.web !== "google" ? ` · <a href="${f.url}" target="_blank" rel="noopener">get it</a>` : "";
    return `<li><input type="checkbox" id="f-${esc(f.name)}" data-name="${esc(f.name)}" ${on ? "checked" : ""}>
      <label class="fd-name" for="f-${esc(f.name)}">${esc(f.name)}</label>
      <span class="fd-tag">${tag}${get}</span>
      <span class="fd-sample" data-font="${esc(f.name)}" style="font-family:'${esc(f.name)}', ${fdGroup === "preeti" ? "monospace" : "'Noto Sans Devanagari', sans-serif"}">${esc(sample)}</span></li>`;
  }).join("") || `<li><span class="hint">No fonts match.</span></li>`;
  $("#fd-count").textContent = `${enabled[fdGroup].length} of ${fonts[fdGroup].length} turned on`;
  // Load Google fonts for samples only as they scroll into view.
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { prepareFont(e.target.dataset.font); io.unobserve(e.target); } }), { root: $("#fontList") });
  document.querySelectorAll(".fd-sample").forEach(s => io.observe(s));
}
$("#fontList").addEventListener("change", e => {
  const name = e.target.dataset.name;
  if (!name) return;
  const set = new Set(enabled[fdGroup]);
  e.target.checked ? set.add(name) : set.delete(name);
  enabled[fdGroup] = [...set];
  $("#fd-count").textContent = `${enabled[fdGroup].length} of ${fonts[fdGroup].length} turned on`;
});
$("#manageFonts").addEventListener("click", () => {
  fdGroup = radio("outEnc") === "preeti" ? "preeti" : "unicode";
  document.querySelectorAll("#fontDialog .tab").forEach(t => { t.setAttribute("aria-selected", String(t.dataset.group === fdGroup)); t.tabIndex = t.dataset.group === fdGroup ? 0 : -1; });
  renderFontList();
  $("#fontDialog").showModal();
});
document.querySelectorAll("#fontDialog .tab").forEach(t => t.addEventListener("click", () => {
  fdGroup = t.dataset.group;
  document.querySelectorAll("#fontDialog .tab").forEach(x => { x.setAttribute("aria-selected", String(x === t)); x.tabIndex = x === t ? 0 : -1; });
  renderFontList();
}));
$("#fontSearch").addEventListener("input", renderFontList);
$("#fontDialog").addEventListener("close", () => { fillFontSelect(); save(); });

// ---------- cues ----------
function badIndexes() {
  const t = currentTotal();
  return new Set(cues.flatMap((c, i) => (c.end <= c.start || (i && c.start < cues[i - 1].end - 0.0005) || (t && c.end > t + 0.0005)) ? [i] : []));
}

function renderCues() {
  const list = $("#cues");
  const maxChars = Number($("#maxChars").value);
  const bad = badIndexes();
  const preeti = radio("outEnc") === "preeti";
  list.innerHTML = cues.map((c, i) => {
    const w = Math.max(...c.text.split("\n").map(visibleLength));
    return `<li class="cue${i === active ? " on" : ""}" data-i="${i}">
      <span class="cue-n">${i + 1}</span>
      <div class="cue-times">
        <input class="time-in t-start${bad.has(i) ? " bad" : ""}" value="${fmt(c.start)}" aria-label="Subtitle ${i + 1} start">
        <input class="time-in t-end${bad.has(i) ? " bad" : ""}" value="${fmt(c.end)}" aria-label="Subtitle ${i + 1} end">
      </div>
      <textarea class="cue-text" lang="ne" rows="2" aria-label="Subtitle ${i + 1} text">${esc(c.text)}</textarea>
      <div class="cue-foot">
        <button type="button" data-act="play">▶ Play</button>
        <button type="button" data-act="split" title="Split at the cursor">Split</button>
        <button type="button" data-act="merge" ${i === cues.length - 1 ? "disabled" : ""}>Merge with next</button>
        <button type="button" data-act="delete">Delete</button>
        ${c.needs_review ? `<span class="warn">Check voice alignment</span>` : ""}
        ${preeti && /[A-Za-z]/.test(c.text) ? `<span class="warn">English letters won't show in Preeti</span>` : ""}
        <span class="w${w > maxChars ? " over" : ""}" title="Longest line, in characters">${w}/${maxChars}</span>
      </div>
    </li>`;
  }).join("");
  $("#empty-cues").hidden = cues.length > 0;
  $("#stage-empty").hidden = cues.length > 0 || Boolean(player.src);
  $("#addCue").hidden = cues.length === 0;
  $("#cue-count").textContent = cues.length ? `${cues.length} subtitles` : "";
  ["#exPremiere", "#exResolve", "#exVtt", "#exAss"].forEach(s => { $(s).disabled = cues.length === 0; });
  renderTimeline();
  active = -1; tick();
  fontNote();
  saveSoon();
}

function renderTimeline() {
  const t = currentTotal() || 1;
  const bad = badIndexes();
  $("#tl-cues").innerHTML = cues.map((c, i) =>
    `<button type="button" data-i="${i}" class="${i === active ? "on" : ""}${bad.has(i) ? " bad" : ""}" style="left:${c.start / t * 100}%;width:${Math.max(0.2, (c.end - c.start) / t * 100)}%" aria-label="Subtitle ${i + 1}, ${short(c.start)}"></button>`).join("");
}

$("#cues").addEventListener("input", e => {
  const li = e.target.closest(".cue");
  if (!li || !e.target.classList.contains("cue-text")) return;
  const i = Number(li.dataset.i);
  cues[i].text = e.target.value;
  const w = Math.max(...cues[i].text.split("\n").map(visibleLength)), max = Number($("#maxChars").value);
  const wEl = li.querySelector(".w");
  wEl.textContent = `${w}/${max}`;
  wEl.classList.toggle("over", w > max);
  if (i === active) renderCaption(true);
  saveSoon();
});
$("#cues").addEventListener("change", e => {
  const li = e.target.closest(".cue");
  if (!li || !e.target.classList.contains("time-in")) return;
  const i = Number(li.dataset.i), v = parseTime(e.target.value);
  if (!Number.isFinite(v)) { e.target.value = fmt(e.target.classList.contains("t-start") ? cues[i].start : cues[i].end); return; }
  cues[i][e.target.classList.contains("t-start") ? "start" : "end"] = Math.round(v * 1000) / 1000;
  renderCues();
});
$("#cues").addEventListener("click", e => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const li = btn.closest(".cue"), i = Number(li.dataset.i), c = cues[i];
  if (btn.dataset.act === "play") { seek(c.start + 0.001); play(true); return; }
  if (btn.dataset.act === "delete") cues.splice(i, 1);
  if (btn.dataset.act === "merge" && cues[i + 1]) {
    const n = cues[i + 1], max = Number($("#maxChars").value);
    const joined = `${c.text} ${n.text}`;
    cues.splice(i, 2, { start: c.start, end: n.end, text: visibleLength(joined) > max && !joined.includes("\n") ? `${c.text}\n${n.text}` : joined });
  }
  if (btn.dataset.act === "split") {
    const ta = li.querySelector(".cue-text");
    let at = ta.selectionStart;
    const flat = c.text;
    if (!at || at >= flat.length) { const words = flat.split(/\s+/); at = words.slice(0, Math.ceil(words.length / 2)).join(" ").length; }
    const a = flat.slice(0, at).trim(), b = flat.slice(at).trim();
    if (!a || !b) return;
    const mid = c.start + (c.end - c.start) * visibleLength(a) / (visibleLength(a) + visibleLength(b));
    cues.splice(i, 1, { start: c.start, end: Math.round(mid * 1000) / 1000, text: a.replace(/\n/g, " ") }, { start: Math.round(mid * 1000) / 1000, end: c.end, text: b.replace(/\n/g, " ") });
  }
  renderCues();
});
$("#addCue").addEventListener("click", () => {
  const last = cues.at(-1)?.end ?? 0;
  cues.push({ start: last, end: last + 2, text: "" });
  renderCues();
  $("#cues").lastElementChild?.querySelector(".cue-text").focus();
});
$("#tl-cues").addEventListener("click", e => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  e.stopPropagation();
  const i = Number(b.dataset.i);
  seek(cues[i].start + 0.001);
  $(`.cue[data-i="${i}"]`)?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
});
$("#timeline").addEventListener("click", e => {
  const r = e.currentTarget.getBoundingClientRect();
  seek((e.clientX - r.left) / r.width * currentTotal());
});

// ---------- make / re-time / shift / import ----------
function scriptUnicode() {
  const s = $("#script").value;
  return radio("inEnc") === "preeti" ? preetiToUnicode(s) : s;
}
function msg(sel, text) { $(sel).textContent = text; }
$("#make").addEventListener("click", () => {
  const script = scriptUnicode().trim();
  const t = currentTotal();
  const start = parseTime($("#startAt").value) || 0;
  if (!script) return msg("#make-msg", "Paste your script first.");
  if (!(t > 0)) { $("#duration").focus(); return msg("#make-msg", "Load your audio/video, or type its length (for example 1:35)."); }
  if (start >= t) return msg("#make-msg", "The first subtitle starts after the end of the video.");
  const texts = splitScript(script, { maxChars: Number($("#maxChars").value), maxLines: Number(radio("lines")) });
  clearAudioReview();
  cues = timeCues(texts, t, { start });
  active = -1;
  renderCues();
  msg("#make-msg", `${cues.length} subtitles across ${short(t)}. Check them on the right, then export.`);
  seek(start);
});
$("#retime").addEventListener("click", () => {
  const t = currentTotal();
  if (!cues.length || !(t > 0)) return;
  cues = retime(cues, t, { start: parseTime($("#startAt").value) || 0 }).map(c => ({start:c.start, end:c.end, text:c.text}));
  msg("#make-msg", "Timings replaced with reading-length estimates. Import the audio review again to recover the original voice timing.");
  renderCues();
});
$("#shiftGo").addEventListener("click", () => {
  const by = parseTime(String($("#shiftBy").value).replace(/^-/, "")) * (String($("#shiftBy").value).trim().startsWith("-") ? -1 : 1);
  if (!Number.isFinite(by) || !cues.length) return;
  cues = shift(cues, by);
  renderCues();
});
$("#importSrt").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  const parsed = parseFile(await file.text(), { encoding: radio("inEnc") });
  e.target.value = "";
  if (!parsed.length) return msg("#make-msg", "That file has no subtitles I can read.");
  clearAudioReview();
  cues = parsed;
  if (!$("#duration").value && !$("#player").src) $("#duration").value = fmt(cues.at(-1).end);
  renderCues();
  msg("#make-msg", `Opened ${file.name}: ${cues.length} subtitles.`);
});

// ---------- optional voice alignment review ----------
function clearAudioReview() {
  audioReview = null; audioStrategy = null;
  $("#audio-strategies").hidden = true;
  $("#audio-evidence").hidden = true;
  $("#audio-waveform").hidden = true;
}
function applyAudioStrategy(name) {
  if (audioStrategy) audioReview.strategies[audioStrategy].cues = structuredClone(cues);
  audioStrategy = name;
  cues = structuredClone(audioReview.strategies[name].cues);
  setRadio("outEnc", "unicode"); setRadio("aspect", "9:16"); setRadio("lines", "2");
  $("#size").value = "60"; $("#maxChars").value = "32"; $("#maxCharsOut").textContent = "32";
  $("#captionPosition").value = "bottom";
  if (!enabled.unicode.includes("Noto Sans Devanagari")) enabled.unicode.push("Noto Sans Devanagari");
  $("#font").value = ""; restore.font = "Noto Sans Devanagari"; fillFontSelect();
  const flagged = cues.filter(c => c.needs_review).length;
  msg("#audio-summary", `${audioReview.model} · ${flagged} cues to review` + (audioReview.cost !== null ? ` · recognition estimate $${audioReview.cost.toFixed(6)} before allowances` : ""));
  renderCues(); seek(cues[0].start);
}
$("#importAudioReview").addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("The review file is too large (20 MB maximum).");
    const parsed = parseAudioReview(await file.text());
    // Validate fully before replacing the user's working captions.
    audioReview = parsed; audioStrategy = null;
    $("#script").value = parsed.script; setRadio("inEnc", "unicode");
    if (!player.src) $("#duration").value = fmt(parsed.audio.duration);
    mediaName = parsed.audio.name.replace(/\.[^.]+$/, "");
    $("#audioStrategy").replaceChildren(...Object.keys(parsed.strategies).map(name => new Option(STRATEGY_LABELS[name] || name, name)));
    $("#audioStrategy").value = parsed.defaultStrategy;
    $("#audio-strategies").hidden = false;
    const wave = $("#audio-waveform"); wave.replaceChildren(); wave.hidden = !parsed.waveform.length;
    if (parsed.waveform.length) {
      // Bound drawing work for long recordings while retaining the loudest sample per bin.
      const step = Math.max(1, Math.ceil(parsed.waveform.length / 900));
      const values = [];
      for (let i=0; i<parsed.waveform.length; i+=step) values.push(Math.max(...parsed.waveform.slice(i, i+step)));
      const max = Math.max(...values) || 1;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", values.map((v,i)=>`M${i*900/values.length},${20-18*v/max}V${20+18*v/max}`).join(" "));
      wave.append(path);
    }
    applyAudioStrategy(parsed.defaultStrategy); updateStats();
    const mismatch = player.src && Math.abs(player.duration - parsed.audio.duration) > .25;
    msg("#audio-import-msg", mismatch ? "Loaded timing, but the selected media length differs. Load the original recording before judging sync." : `Loaded ${file.name}. Load ${parsed.audio.name} to check the voice; script wording is preserved.`);
  } catch (error) { msg("#audio-import-msg", error.message); }
  finally { e.target.value = ""; }
});
$("#audioStrategy").addEventListener("change", e => applyAudioStrategy(e.target.value));

// ---------- media + playback ----------
const player = $("#player");
let clock = 0, playing = false, lastTick = 0;
$("#media").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  if (player.src) URL.revokeObjectURL(player.src);
  mediaName = file.name.replace(/\.[^.]+$/, "");
  player.src = URL.createObjectURL(file);
  $("#stage-empty").hidden = true;
  player.addEventListener("loadedmetadata", () => {
    $("#duration").value = fmt(player.duration);
    msg("#make-msg", `${file.name}: ${short(player.duration)} long.`);
    renderTimeline(); tick(); save();
  }, { once: true });
});
const now = () => player.src ? player.currentTime : clock;
function seek(t) {
  const clamped = Math.max(0, Math.min(currentTotal() || 0, t));
  if (player.src) player.currentTime = clamped; else clock = clamped;
  tick();
}
function play(on = !playing) {
  playing = on;
  $("#play").classList.toggle("playing", playing);
  $("#play").setAttribute("aria-label", playing ? "Pause" : "Play");
  if (player.src) playing ? player.play().catch(() => {}) : player.pause();
  lastTick = performance.now();
  if (playing) requestAnimationFrame(loop);
}
function loop(ts) {
  if (!playing) return;
  if (!player.src) {
    clock += (ts - lastTick) / 1000;
    if (clock >= currentTotal()) { clock = currentTotal(); play(false); }
  }
  lastTick = ts;
  tick();
  requestAnimationFrame(loop);
}
player.addEventListener("ended", () => play(false));
$("#play").addEventListener("click", () => play());
document.addEventListener("keydown", e => {
  if (e.code === "Space" && !e.target.closest("input, textarea, select, button, dialog, a")) { e.preventDefault(); play(); }
});

function tick() {
  const t = now(), T = currentTotal();
  $("#clock").textContent = `${short(t)} / ${short(T)}`;
  $("#tl-head").style.left = `${T ? t / T * 100 : 0}%`;
  const i = cues.findIndex(c => t >= c.start && t < c.end);
  if (i !== active) {
    active = i;
    document.querySelectorAll(".cue.on, .tl-cues button.on").forEach(n => n.classList.remove("on"));
    if (i >= 0) {
      $(`.cue[data-i="${i}"]`)?.classList.add("on");
      $(`.tl-cues button[data-i="${i}"]`)?.classList.add("on");
      if (playing && !document.activeElement?.closest(".cues")) {
        const row = $(`.cue[data-i="${i}"]`), list = $("#cues");
        if (row) {
          const delta = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
          if (delta < 0 || delta + row.clientHeight > list.clientHeight) list.scrollTop += delta;
        }
      }
    }
    renderCaption();
  }
}
function renderCaption() {
  const cap = $("#caption");
  const c = cues[active];
  const evidence = $("#audio-evidence");
  evidence.hidden = !c?.reason?.length;
  evidence.textContent = c?.reason?.length ? `Timing evidence: ${c.reason.join(", ")}.${c.onset_adjustment_ms ? ` Start refined +${c.onset_adjustment_ms} ms.` : ""}${c.median_pitch_hz ? ` Pitch ${c.median_pitch_hz} Hz.` : ""}${c.graphemes_per_second ? ` ${c.graphemes_per_second} visual characters/s.` : ""}${c.needs_review ? " Listen and check this cue." : ""} Acoustic estimates; edits may change their relevance.` : "";
  if (!c) { cap.innerHTML = ""; return; }
  const name = $("#font").value;
  const preeti = radio("outEnc") === "preeti" && isInstalled(name);
  const text = preeti ? unicodeToPreeti(c.text) : c.text;
  cap.style.fontFamily = radio("outEnc") === "preeti" && !preeti ? `"Mukta", "Noto Sans Devanagari", sans-serif` : "";
  cap.innerHTML = text.split("\n").map(l => `<span>${esc(l)}</span>`).join("\n");
}

// ---------- export ----------
function download(format, editor) {
  const enc = radio("outEnc");
  const body = format === "ass" ? buildAss(cues, {aspect:radio("aspect"), font:radio("outEnc") === "preeti" ? "Noto Sans Devanagari" : $("#font").value, size:Number($("#size").value), color:$("#color").value, position:$("#captionPosition").value, look:radio("look")}) : buildFile(cues, { format, encoding: enc });
  const base = (mediaName || "subtitles").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
  const name = `${base}-${format === "ass" ? "unicode" : enc}.${format}`;
  const url = URL.createObjectURL(new Blob(["﻿" + body], { type: format === "vtt" ? "text/vtt" : format === "ass" ? "text/plain" : "application/x-subrip" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  const font = $("#font").value;
  const steps = editor === "premiere" ? `In Premiere Pro: File › Import ${name}, drag it onto the timeline, then set the font to ${font} in Essential Graphics.`
    : editor === "resolve" ? `In DaVinci Resolve: File › Import › Subtitle, drag it onto the timeline, then Inspector › Track › set the font to ${font}.`
    : `Saved ${name}.`;
  msg("#export-msg", `Saved ${name}. ${steps}`);
  toast(steps);
}
$("#exPremiere").addEventListener("click", () => download("srt", "premiere"));
$("#exResolve").addEventListener("click", () => download("srt", "resolve"));
$("#exVtt").addEventListener("click", () => download("vtt", "web"));
$("#exAss").addEventListener("click", () => download("ass", "web"));

function toast(text) {
  document.querySelector(".toast")?.remove();
  const t = Object.assign(document.createElement("div"), { className: "toast", role: "status", textContent: text });
  document.body.append(t);
  setTimeout(() => t.remove(), 7000);
}

// ---------- settings wiring ----------
$("#maxChars").addEventListener("input", () => { $("#maxCharsOut").textContent = $("#maxChars").value; renderCues(); });
$("#script").addEventListener("input", () => { updateStats(); saveSoon(); });
$("#duration").addEventListener("change", () => { renderTimeline(); tick(); save(); });
document.querySelectorAll('input[name="outEnc"]').forEach(r => r.addEventListener("change", () => { fillFontSelect(); renderCues(); }));
document.querySelectorAll('input[name="inEnc"], input[name="lines"]').forEach(r => r.addEventListener("change", () => { updateStats(); save(); }));
["#font", "#size", "#color", "#captionPosition"].forEach(s => $(s).addEventListener("input", applyStyle));
document.querySelectorAll('input[name="look"], input[name="aspect"]').forEach(r => r.addEventListener("change", applyStyle));
function updateStats() {
  const s = scriptUnicode().trim();
  const words = s ? s.split(/\s+/).length : 0;
  $("#script-stats").textContent = `${words} words${radio("inEnc") === "preeti" && s ? " · read as Preeti and converted to Unicode" : ""}`;
}

// ---------- start ----------
restore();
$("#maxCharsOut").textContent = $("#maxChars").value;
updateStats();
try {
  const cat = await fetch("sub/fonts.json").then(r => r.json());
  fonts = { unicode: cat.nepali.filter(f => f.encoding === "unicode"), preeti: cat.nepali.filter(f => f.encoding === "preeti"), english: cat.english };
  for (const g of Object.keys(enabled)) enabled[g] = enabled[g].filter(n => fonts[g].some(f => f.name === n));
} catch { /* offline: the select falls back to Mukta / Preeti */ }
fillFontSelect();
renderCues();
tick();
