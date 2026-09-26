# Master Prompt: Map Animation Scoping

**Role of this file.** This is the one-shot context-gathering layer for every map-animation
request in this project. Load it before writing a single line of scene-script JSON. Its
companion is the `create-map-animations` skill (`.claude/skills/`, mirrored in `codex-skills/`);
the two share one contract and must never disagree.

**Governing rule.** Map Animation Studio is a **deterministic renderer, not a generative
model.** Every frame is real geographic vector data drawn to a projection. Nothing appears
on a map that a named dataset or the user put there. You are not illustrating a vibe — you
are stating geographic and numeric fact on screen, and a wrong border or a wrong number is
a factual error, not a style miss.

---

## 0. Operating Contract

Inherited from `CLAUDE.md`, `AGENTS.md`, and `map-animation-studio/MEMORY.md`. Non-negotiable.

1. Read the **complete** brief or script before choosing a single scene.
2. **Ask every scoping question in ONE batch.** Paste Section 2 whole. Do not drip questions
   across turns and do not open a second round-trip for something Section 2 already covers.
3. Present the full scene plan — regions, styles, datasets, licences, disputed-border
   handling — and stop for review before any full render.
4. **Never run `generate` without explicit approval of the exact scene list.** There is no
   money at stake; wall-clock CPU time is. Approval of a draft is not approval to render.
   Approval of one render is not approval of a re-render.
5. Never auto-retry a failed render. Report it, name the suspected cause, ask.
6. Never silently pick a side on a disputed border. See Section 2G.
7. Return the local output folder and every MP4 path when done.

### Hard technical limits

| Constraint | Value |
| --- | --- |
| Render stack | MapLibre GL JS + Puppeteer (frame capture) + ffmpeg (encode) |
| Generative AI | **None.** No Veo, no Gemini, no text-to-video anywhere in this pipeline |
| Boundary data | Natural Earth (public domain), geoBoundaries.org (CC-BY) |
| Forbidden data | **GADM** — not licensed for redistribution. Never ship a GADM-derived frame |
| Output | MP4 (H.264), frame-by-frame deterministic — same input, same output |
| Working directory | `Tool/map-animation-studio/` (relative to the repo root) |
| Cost | Zero. Everything is local and open-data. Time is the only budget |

```
node agent-map.mjs draft    --manifest <manifest.json>
node agent-map.mjs generate --project <id> --approval <approval.json>
```

---

## 1. The One-Batch Rule

A map brief has roughly thirty knobs and only five of them actually block work. Asking them
serially burns the user's patience and still misses things. So: send Section 2 in full, once.
Most questions carry a stated default, and the user may answer **"defaults"** to accept all of
them at once. Five questions are marked **REQUIRED** — they cannot be defaulted, guessed, or
inferred from context, and `draft` does not run until they are answered.

---

## 2. The Questionnaire

> Copy everything below this line to the user verbatim, in one message.

I can build this as an accurate, data-driven animated map. Answer what you can — anything
marked *(default: …)* you can skip and I'll use the default, or just reply **"defaults"** for
all of them. The five **REQUIRED** items I do need from you.

### A. Geographic Scope

1. **REQUIRED — What area?** Country, region, continent, city, or a list of them. Name the
   exact places; "South Asia" and "India + Nepal + Bhutan" render differently.
2. What administrative level should be drawn? *(default: level 0 = national borders; level 1
   = states/provinces available; level 2 = districts where geoBoundaries covers it)*
3. Any neighbouring areas that must stay visible for context, or must be greyed out?
   *(default: neighbours shown, muted grey, unlabelled)*
4. Projection preference? *(default: Web Mercator for flat maps, orthographic globe for
   rotating-globe and zoom-out shots)*

### B. Animation Style & Camera

5. **REQUIRED — Which style(s)?** Pick one per scene:

| Style | What it shows best |
| --- | --- |
| Animated choropleth reveal | A value per region, filling in over time |
| Border-change timelapse | Territory shifting across dates |
| Flow / migration arc map | Movement between origin and destination pairs |
| Dot-density / bubble map | Counts as discrete dots or scaled circles |
| Zoom establishing shot | Globe → country → region → city |
| Rotating 3D globe | Spinning earth with regions highlighted |
| Annotated route / journey line | A path drawn progressively with labels |
| Side-by-side comparison | Two maps or two dates in one frame |
| Heatmap density animation | Continuous intensity surface over time |
| Proportional symbol animation | Symbols growing/shrinking with a value |
| Isometric flyover (2.5D) | Tilted, pitched camera moving over terrain |

6. Camera movement? *(default: slow ease-in-out push toward the subject, no hard cuts
   inside a scene)*
7. How many separate scenes/clips do you want? *(default: one clip per style you picked)*

### C. Data to Visualize

8. **REQUIRED — If any numbers appear on screen, where do they come from?** A CSV/XLSX you
   supply, a named public source (World Bank, UN, census), or the figures typed out in your
   message. I will not invent, estimate, or interpolate a number onto a map.
9. What is the unit and how should it be labelled? *(default: raw value with thousands
   separators, unit named once in the legend)*
10. Legend on or off, and where? *(default: on, bottom-left, with a min/max colour ramp)*
11. Should regions with no data be distinguishable? *(default: yes — hatched grey, marked
    "no data" in the legend)*

### D. Time Range

12. Does this animate across time? If so, first and last date, and the step
    *(default: no time axis — a single static-date reveal)*
13. Show a running date/year counter? *(default: yes when a time range exists, top-right)*
14. Seconds of screen time per time step? *(default: pace the whole scene to the duration in
    Q15 rather than fixing a per-step rate)*

### E. Visual Style & Branding

15. **REQUIRED — Purpose and target duration.** What is this cut into, and how long should
    the clip run? (e.g. "8-second B-roll under a voiceover line", "30-second explainer beat")
16. Base map look? *(default: dark editorial — near-black land, subtle grey borders, one
    accent colour for the data)*
17. Accent / brand colours, or a supplied brand palette file? *(default: a colourblind-safe
    sequential ramp; diverging ramp when values cross zero)*
18. Labels: which place names, in which language/script, at what density? *(default: only
    the regions being discussed, English exonyms, sparse)*
19. Logo or watermark? *(default: none)*

### F. Output Specs

20. Aspect ratio? *(default: 16:9; 9:16 and 1:1 available)*
21. Resolution and frame rate? *(default: 1920×1080 at 30 fps; 4K available but roughly 4×
    the render time)*
22. Transparent background or alpha matte for compositing? *(default: no — solid background)*
23. Do you want the still preview frames kept alongside the MP4? *(default: yes)*

### G. Political / Territorial Sensitivity

24. **REQUIRED — How should genuinely disputed borders be handled?** My default, unless you
    say otherwise, is: **follow ISO/UN convention for the base geometry, and draw any
    genuinely disputed boundary as a visibly dashed line with a short neutral annotation
    rather than silently picking a side.** Confirm this default, or tell me the editorial
    stance you want for this project and I'll apply it consistently across every scene.
25. Are there specific territories in frame you already know are contested, or naming
    conventions your audience expects? *(no default — tell me if any apply)*
26. Any place names that must use a particular local form? *(default: ISO/UN endonym where
    the dataset provides one)*

### H. Audio & Pacing

27. Audio? *(default: silent — the clip is B-roll and gets its audio in the edit)*
28. Should the animation hit specific beats or timestamps in an existing voiceover?
    *(default: no; if yes, send the VO timings and treat them as approximate storytelling
    guidance, to be made frame-exact in your editor)*
29. Hold frames at the start and end for editing handles? *(default: 0.5 s still at each end)*

### I. Delivery

30. Output folder name / project id? *(default: `map-animation-studio/output/<slug>-<date>`)*
31. One file per scene, or a single stitched MP4? *(default: one MP4 per scene, plus a
    stitched version if there is more than one)*
32. Anything downstream I should know — editor, codec preference, delivery deadline?
    *(default: H.264 MP4, no constraints)*

---

## 3. After the answers land

1. Write the manifest and run `draft`. This is cheap and local — no approval needed.
2. Present the returned scene-script JSON, the preview stills, the dataset and licence for
   every layer, and the disputed-border treatment applied.
3. State the scene count, total frame count, and the estimated wall-clock render time.
   **Stop for explicit approval.**
4. Only then write the approval file and run `generate`.
5. Return clickable local MP4 paths and the project folder. Add any generic reusable lesson
   to `orchestrator_memory.md`.
