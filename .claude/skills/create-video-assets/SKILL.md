---
name: create-video-assets
description: Turn a full script in any language into multiple consistent, cinematic, approval-gated Veo video clips through the local orchestrator, either drafted from the script or animated from approved keyframes in parallel. Use for requests to create video clips, B-roll, scene batches, script visualizations, or videos guided by reference images.
---

# Create Video Assets

All commands run from `asset-generation/` (paths relative to the repo root). Read
`asset-generation/orchestrator_memory.md` and `asset-generation/MASTER-VIDEO-GENERATION.md` before acting. Operate the
pipeline only through `node agent-video.mjs`. Never call a media API directly, approve on the
user's behalf, or retry automatically.

If the server isn't running, start it with `npm start` (from `asset-generation/`) in the background, then run
the free `node agent-video.mjs health`.

## Two routes

| Route | Use when | Flow |
| --- | --- | --- |
| **A. Script draft** | No keyframes; quick B-roll from a script | `draft` (one text-model call) → review → `generate` |
| **B. Keyframe batch** (default for story sequences) | Keyframes from an image pack, first+last interpolation | clip-writers in parallel → `merge-clips` → approve → pilot → rest in parallel |

## Route A: script draft

1. Read the complete script. Identify mood, visual cues, characters, products, locations and
   continuity needs.
2. Ask which portions need video and whether audio is required, if either is unclear. Default is
   silent.
3. Present a concise scene list and cost-saving assumptions. **Stop for approval before
   drafting**, because drafting makes one text-model request.
4. Write a manifest and run `node agent-video.mjs draft --manifest <manifest.json>`:
   ```json
   { "context": "...", "script": "full script", "instructions": "portions, mood, continuity, exclusions",
     "aspectRatio": "9:16", "duration": 6, "maxScenes": 4, "audio": false }
   ```
   Durations are 4, 6 or 8 s; aspect ratios are 16:9 or 9:16; maxScenes is 1–12.
5. Present the returned visual bible and every exact prompt. Don't generate yet.
6. Write the approval file. Only after the user explicitly approves the exact scenes, prompts,
   reference assets and cost, set `confirmPaidGeneration: true`:
   ```json
   { "confirmPaidGeneration": true, "sceneIds": ["scene_01"],
     "prompts": { "scene_01": "exact approved prompt" },
     "assets": { "scene_01": [ { "path": "absolute/or/relative/ref.png", "mode": "subject_reference",
       "role": "Preserve this character's face, clothing and silhouette.", "startSecond": 0, "endSecond": 8 } ] } }
   ```
   Use at most three PNG/JPEG views of the same subject per scene, and 8 s for any scene with
   subject references. For a logo, attach exactly one image with `"mode": "logo_start_frame"`
   and nothing else.
7. `node agent-video.mjs generate --project <id> --approval <approval.json>`. Approved scenes
   run in parallel (`VIDEO_CONCURRENCY`). Poll with `status --project <id>`.

## Route B: keyframe batch (parallel)

1. Start from an image pack whose keyframes are verified. Write `<project>/video-pack.md`: the
   handoff block (Canon, grade phrase, culture anchor, five anchors), the rhythm ladder, and the
   shot list with mode, duration, start/end frames and **ends on** per clip. Ask the scope
   questions in one batch first (which beats move, audio, finished duration).
2. **Fan out:** for more than about six clips, launch `clip-writer` agents in a single message,
   each owning a contiguous run of clips. They write `<project>/clips/<id>.json`. For fewer clips,
   write them yourself.
3. **Merge:** `node video/merge-clips.mjs <project> --aspect 9:16`. It validates frames and
   durations and writes `clips.json` with `confirmPaidGeneration: false`.
4. **Approval gate:** present every prompt, the input frames per clip, clip count, total seconds,
   model, resolution, audio, and estimated maximum cost. Wait for an explicit yes, then set
   `confirmPaidGeneration: true` yourself.
5. **Pilot:** `node agent-video.mjs batch --clips <project>/clips.json --only <pilot-id>`. Watch
   it (full speed, then the midpoint). If it shows a systematic problem, stop and report it.
6. **Rest in parallel:** `node agent-video.mjs batch --clips <project>/clips.json --except <pilot-id>`.
   Poll with `node agent-video.mjs batch-status --batch <id>`.

## After generation (both routes)

- Watch every clip, check the edges for black bars, and check small secondary figures across the
  whole clip.
- Return clickable local MP4 paths and the output folder. Ask for feedback and add reusable
  lessons to `asset-generation/orchestrator_memory.md`.
- A failed clip is reported with its error, likely cause, and whether it was billed. Never
  resubmit it without new explicit approval.

## Guardrails

- Never bypass an approval gate or infer paid approval from approval of analysis, prompts or
  images.
- Final Veo prompts are concise English, whatever the script's language.
- For logos: no readable text, letters, captions, slogans, signage, subtitles or generated
  wordmarks. Animate only light, material, particles, camera, depth and background.
- Treat requested timestamps as approximate. Frame-exact timing happens in the editor.
- Never print credentials or base64 asset data into the conversation.
