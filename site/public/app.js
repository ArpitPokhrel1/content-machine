// Content Machine landing page. Everything visual comes from media/manifest.json, which
// site/scripts/prepare-media.mjs builds from real generated outputs and their script lines.
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, el = document) => el.querySelector(s);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") n.textContent = v;
    else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of [].concat(kids)) if (kid) n.append(kid);
  return n;
};

function caption(item, tag = "figcaption") {
  return el(tag, {}, [
    item.ne ? el("span", { class: "ne", lang: "ne", text: item.ne }) : null,
    item.en ? el("span", { class: "en", text: item.en }) : null,
    item.project ? el("span", { class: "proj", text: item.project }) : null
  ]);
}

async function main() {
  const m = await fetch("media/manifest.json").then(r => r.json());
  hero(m.clips);
  drift(m.stills);
  ticker(m);
  walkthrough(m.walkthrough);
  marquees(m.stills);
  reel(m.clips);
}

// Hero: one clip at a time, the subtitle is the script line it was generated from.
function hero(clips) {
  const order = ["krishna-named", "atri-eclipse", "janai-thread", "pushpak", "krishna-river", "balarama", "atri-trimurti", "janai-bound"];
  const list = order.map(id => clips.find(c => c.id === id)).filter(Boolean);
  const video = $("#hero-video"), sub = $(".subtitle"), ne = $("#hero-ne"), en = $("#hero-en");
  let i = 0;
  const show = clip => {
    sub.classList.add("fading");
    setTimeout(() => {
      ne.textContent = clip.ne || clip.en;
      en.textContent = clip.ne ? clip.en : clip.project;
      sub.classList.remove("fading");
    }, reduced ? 0 : 250);
  };
  const load = clip => {
    video.poster = clip.poster;
    if (!reduced) { video.src = clip.video; video.play().catch(() => {}); }
    show(clip);
  };
  video.loop = false;
  video.addEventListener("ended", () => { i = (i + 1) % list.length; load(list[i]); });
  load(list[0]);
  if (reduced) setInterval(() => { i = (i + 1) % list.length; load(list[i]); }, 6000);
  // Stop the hero clip when it scrolls away, resume when it's back.
  new IntersectionObserver(([e]) => {
    if (reduced || document.body.classList.contains("paused")) return;
    e.isIntersecting ? video.play().catch(() => {}) : video.pause();
  }).observe(video);
}

function drift(stills) {
  const cols = [...document.querySelectorAll(".drift-col")];
  const shuffled = stills.map((s, k) => ({ s, k: (k * 7) % stills.length })).sort((a, b) => a.k - b.k).map(x => x.s);
  cols.forEach((col, c) => {
    const mine = shuffled.filter((_, k) => k % cols.length === c);
    for (const s of [...mine, ...mine]) col.append(el("img", { src: s.image, alt: "", loading: "lazy", decoding: "async", width: 432, height: 768 }));
  });
}

function ticker(m) {
  const lines = [...m.walkthrough.frames.map(f => f.words), ...m.clips.map(c => c.ne), ...m.stills.map(s => s.ne)].filter(Boolean);
  const unique = [...new Set(lines)];
  const track = $("#ticker");
  for (const line of [...unique, ...unique]) track.append(el("span", { lang: "ne", text: line }), el("i", { text: "✦" }));
}

// Walkthrough: scroll position picks which 4-word window is lit and which frame shows.
function walkthrough(w) {
  const script = $("#walk-script"), frames = $("#walk-frames"), dots = $("#walk-dots");
  const wins = w.frames.map((f, i) => {
    const span = el("span", { class: "win", text: f.words });
    script.append(span, i < w.frames.length - 1 ? " " : "");
    frames.append(el("img", { src: f.image, alt: `Frame ${f.id}, generated from the words “${f.words}”`, loading: i ? "lazy" : "eager", width: 432, height: 768 }));
    dots.append(el("span"));
    return span;
  });
  const imgs = [...frames.children], dotEls = [...dots.children], steps = [...document.querySelectorAll(".walk-steps li")];
  const section = $(".walk");
  let current = -1;
  const set = idx => {
    if (idx === current) return;
    current = idx;
    wins.forEach((s, k) => { s.classList.toggle("on", k === idx); s.classList.toggle("done", k < idx); });
    imgs.forEach((im, k) => im.classList.toggle("on", k === idx));
    dotEls.forEach((d, k) => d.classList.toggle("on", k <= idx));
    $("#walk-id").textContent = w.frames[idx].id;
    $("#walk-words").textContent = w.frames[idx].words;
  };
  let ticking = false;
  const update = () => {
    ticking = false;
    const r = section.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
    set(Math.min(w.frames.length - 1, Math.floor(p * w.frames.length)));
    const step = Math.min(steps.length - 1, Math.floor(p * steps.length));
    steps.forEach((s, k) => s.classList.toggle("on", k === step));
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function marquees(stills) {
  const half = Math.ceil(stills.length / 2);
  [[$("#row-a"), stills.slice(0, half)], [$("#row-b"), stills.slice(half)]].forEach(([track, items]) => {
    const card = (s, copy) => el("figure", { class: "card", "aria-hidden": copy ? "true" : null }, [
      el("img", { src: s.image, alt: copy ? "" : `${s.project}: generated from “${s.ne}” (${s.en})`, loading: "lazy", decoding: "async", width: 432, height: 768 }),
      caption(s)
    ]);
    items.forEach(s => track.append(card(s, false)));
    if (!reduced) items.forEach(s => track.append(card(s, true)));
  });
}

// Reel: each clip loads and plays only while on screen.
function reel(clips) {
  const grid = $("#reel-grid");
  const figs = clips.map(c => {
    const video = el("video", { muted: true, playsinline: true, loop: true, preload: "none", poster: c.poster, "aria-label": `Generated clip: ${c.en}`, controls: reduced ? true : null });
    video.muted = true;
    video.dataset.src = c.video;
    const fig = el("figure", { class: "clip" }, [video, caption(c)]);
    grid.append(fig);
    return fig;
  });
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      const fig = e.target, video = $("video", fig);
      if (e.isIntersecting) {
        fig.classList.add("in");
        if (!video.src) video.src = video.dataset.src;
        if (!reduced && !document.body.classList.contains("paused")) video.play().catch(() => {});
      } else video.pause();
    }
  }, { threshold: 0.35 });
  figs.forEach(f => io.observe(f));
}

// Pause all motion (marquees, ticker, drift, videos).
$("#pause").addEventListener("click", e => {
  const paused = document.body.classList.toggle("paused");
  e.currentTarget.setAttribute("aria-pressed", String(paused));
  e.currentTarget.textContent = paused ? "Play motion" : "Pause motion";
  document.querySelectorAll("video").forEach(v => paused ? v.pause() : (v.src && v.play().catch(() => {})));
});

// Install tabs (arrow keys supported) and copy buttons.
const tabs = [...document.querySelectorAll(".tab")];
const select = tab => tabs.forEach(t => {
  const on = t === tab;
  t.setAttribute("aria-selected", String(on));
  t.tabIndex = on ? 0 : -1;
  document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
});
tabs.forEach((t, k) => {
  t.addEventListener("click", () => select(t));
  t.addEventListener("keydown", e => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(k + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    select(next); next.focus();
  });
});
if (/Mac|Linux/i.test(navigator.userAgentData?.platform || navigator.platform)) select($("#tab-mac"));
document.querySelectorAll(".copy").forEach(btn => btn.addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(btn.previousElementSibling.textContent); btn.textContent = "Copied ✓"; }
  catch { btn.textContent = "Select & copy"; }
  setTimeout(() => { btn.textContent = "Copy"; }, 1800);
}));

main().catch(err => console.error("Could not load media manifest", err));
