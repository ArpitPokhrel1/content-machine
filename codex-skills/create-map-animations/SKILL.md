---
name: create-map-animations
description: Produce factual, data-accurate animated map videos — Vox/NYT/BBC-explainer-style map graphics for use as B-roll — by deterministically rendering real geographic vector data through the local Map Animation Studio pipeline. Use for requests involving animated maps, choropleths, border timelapses, migration flow arcs, globe zooms, route animations, or any map graphic cut into a video. Not a generative-video tool.
---

# Create Map Animations

> Repo location on this machine: `{{REPO}}` (filled in by `node asset-generation/scripts/setup.mjs`).
> Every path below is relative to it; `cd` there before running commands.

Use the local pipeline at `map-animation/` (paths relative to the repo root). Read
`map-animation/MEMORY.md` and `map-animation/PROMPT_MAP_ANIMATION.md` before acting. Use
`node agent-map.mjs` from that directory for every pipeline operation. First-time setup on a
machine: `node asset-generation/scripts/setup.mjs --maps` (installs its dependencies; needs ffmpeg and
Edge or Chrome).

This pipeline contains **no generative AI**. MapLibre GL JS draws real boundary vectors,
Puppeteer captures frames, ffmpeg encodes MP4. Same input, same output, every time. Never
route a map request to Veo, Gemini, or any text-to-video model — a hallucinated coastline is
a factual error shipped to an audience.

## Workflow

1. Read the complete brief or script. Identify every place named, every number that would
   appear on screen, the narrative beat each map serves, and any territory likely to be
   contested.
2. Run `node agent-map.mjs health` to confirm the render stack (Chromium, ffmpeg, local
   dataset cache) is available.
3. Run `node agent-map.mjs plan`. If scoping information is missing, paste **the entire
   questionnaire from `PROMPT_MAP_ANIMATION.md` Section 2 to the user in one message.** Do
   not ask questions one at a time and do not open a second round-trip for anything that
   questionnaire already covers. The user may answer "defaults"; the five REQUIRED items
   still need real answers.
4. Choose datasets. Natural Earth for world/national geometry and physical layers,
   geoBoundaries for subnational levels. Record the exact dataset, version, and licence for
   every layer you will draw.
5. Write a manifest, then run:

   `node agent-map.mjs draft --manifest <manifest.json>`

   Drafting is cheap and local: it builds the scene-script JSON and a few still preview
   frames. No approval gate here.
6. Present the returned scene-script JSON, every preview still, the dataset + licence table,
   and the disputed-border treatment applied to each scene. Do not render yet.
7. Write an approval file listing the exact scenes, regions, admin levels, data sources, and
   output specs. State the scene count, total frames, and estimated wall-clock render time.
   **Stop for explicit approval.**
8. Only after approval, run:

   `node agent-map.mjs generate --project <project-id> --approval <approval.json>`

9. Poll with `node agent-map.mjs status --project <project-id>`. Never submit an automatic
   retry.
10. Return clickable local MP4 paths and the project folder. Ask for feedback and add generic
    reusable lessons to `map-animation-studio/MEMORY.md` (not `asset-generation/orchestrator_memory.md` — that
    file is specific to the Veo/Gemini generative pipeline and does not apply here).

## Guardrails

- **Never bypass the render gate.** `generate` runs only against an approval file covering
  the exact scenes, regions, and data sources the user reviewed. The gate exists because a
  full render costs real wall-clock CPU time, not because it costs money — treat it exactly
  as the video pipeline treats paid generation.
- Never infer render approval from approval of a plan, a manifest, a draft, or preview
  stills. Approval of one render is not approval of a re-render.
- **Disputed territory default:** follow ISO/UN convention for base geometry, and draw any
  genuinely disputed boundary as a visibly dashed line with a short neutral annotation
  rather than silently resolving it. Never quietly pick a side. The user may override this
  per project with a stated editorial stance; apply that override consistently across every
  scene and record it in the manifest.
- **Boundary data licensing:** use Natural Earth (public domain) and geoBoundaries.org
  (CC-BY, attribution carried in the project folder). **Never use GADM** for anything that
  will be redistributed — it is not free for redistribution. If a needed admin level exists
  only in GADM, say so and ask; do not substitute silently.
- Never invent, estimate, or interpolate a number onto a map. Every displayed value traces to
  a user-supplied file or a named public source. Regions without data render as explicit
  "no data", never as zero.
- Never retry a failed render automatically. Report the failure, name the suspected cause
  (missing dataset, projection error, Chromium crash, ffmpeg encode), and ask.
- Treat requested timestamps and per-beat timings as approximate storytelling guidance; make
  timing frame-exact in the editor.
- Default to silent output. Map clips are B-roll and get audio in the edit.
- Keep label text minimal and factual. No decorative or invented place names.

## Commands

- Health: `node agent-map.mjs health`
- Plan: `node agent-map.mjs plan`
- Draft: `node agent-map.mjs draft --manifest <file>`
- Generate: `node agent-map.mjs generate --project <id> --approval <file>`
- Status: `node agent-map.mjs status --project <id>`

If the local render stack is unavailable, install/refresh it from the project with
`npm install` in `map-animation-studio`, then rerun the non-destructive health command.
