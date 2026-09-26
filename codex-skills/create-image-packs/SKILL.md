---
name: create-image-packs
description: Turn a script in any language (Nepali history, mythology, heritage explainers) into a story-coherent 9:16 image pack. Chunk the script into 20 words, give each chunk five 4-word frames, lock character and environment references, write the frames with parallel chunk-writer agents, and generate in parallel on gemini-2.5-flash-image. Use when the user asks for images, stills, frames, keyframes or an image pack from a script.
---

# Create Image Packs

> Repo location on this machine: `{{REPO}}` (filled in by `node Tool/scripts/setup.mjs`).
> Every path below is relative to it; `cd` there before running commands.

> Codex has no chunk-writer subagents: write every `shots/cNN.json` yourself (step 5), then continue. The builder still guarantees identical Canon across frames.

All paths below are relative to the repo root (the folder holding `CLAUDE.md`). The prompt-writing
rules live in `Tool/MASTER-IMAGE-GENERATION.md` and the model lessons in
`Tool/orchestrator_memory.md`. Read both before planning. The tools are in `Tool/image-pack/`.

## Approval

- The user does not need to approve image generation. Generate, then show results. Re-rolling a
  defective frame also needs no approval.
- **But** when the user asks to verify the characters and environment first, stop after the
  references (step 4) and wait.
- Paid **video** always needs explicit approval (see `CLAUDE.md`). Approving images never
  approves video.

## How the work is split

One lead agent (you) owns everything that must be identical across frames: the reading of the
script, the Canon, the references, the prompt assembly and the verification. Parallel
`chunk-writer` subagents own only the scene clauses. `build-frames.mjs` pastes the same GRADE,
Canon, anchor and NEG strings into every prompt, so parallel writing can't cause visual drift.

```
lead: read script → story.md + canon.mjs → refs (parallel) → verify refs
        ↓ fan out
chunk-writers ×N: shots/c01–c04.json | shots/c05–c08.json | …   (in parallel)
        ↓ merge
lead: build-frames.mjs → gen-parallel.mjs (parallel per chunk/region) → verify → deliver
```

## Workflow

1. **Set up the pack.** Create `Tool/output/<slug>-image-pack-<YYYYMMDD>/`. Save the script
   verbatim to `script.txt`, then run `node Tool/image-pack/chunk-script.mjs <pack>/script.txt`.
   This writes `words.txt` and `chunks.md`: 20-word chunks → 5 frames of 4 words each
   (`cNN-1` … `cNN-5`). The last chunk may be short.
2. **Analyse, in this order (you, never delegated), and write it to `<pack>/story.md`:**
   - **Script:** the literal translation table (asserted vs implied facts), six-axis
     classification, story spine, five anchors, and anything uncertain. Flag historical claims
     that disagree with mainstream sources, but keep the frames faithful to the script.
   - **Characters:** one Canon block per recurring character, with 2–3 permanent marks and a
     distinct colour each. Say which looks are your invention.
   - **Environments:** the GRADE with a hex palette, a culture anchor naming what the place is and
     what it is NOT, and every location the script needs, including places outside the main
     setting.
   - **Chunk plan:** the story of each chunk and one line per frame (characters · environment ·
     action). Each frame shows its own 4 words but carries its chunk's context.
   - **Staging decisions** for sensitive beats (see Fixed rules).
   Present the analysis and **ask all questions in one batch**: aspect ratio, how to stage
   sensitive beats, whether "today" lines stay in period, and whether scenes outside the main
   setting are wanted.
3. **Lock the Canon in code.** Copy `Tool/image-pack/templates/canon.template.mjs` to
   `<pack>/canon.mjs` and fill in ASPECT, GRADE, NEG, ANCHORS, CHARS, GROUPS, ENVS and MOTIFS from
   story.md. Everything visual that repeats lives here, once.
4. **References:** `node Tool/image-pack/build-refs.mjs <pack>`, then
   `node Tool/image-pack/gen-parallel.mjs <pack>/jobs-refs.json <pack>/refs 5 90`. View them on
   a contact sheet (`check-frames.mjs <pack>/refs`) and fix drift before any story frame. Crop
   stray background people out (and point `ref:` at the crop). For three or more characters who
   appear together, build a lineup strip with ffmpeg `hstack` and register it in `GROUPS`. If a
   plate keeps drifting, drop its `ref` and describe the place in the scene.
5. **Fan out.** Split the chunks into groups of about four and launch one `chunk-writer` agent per
   group **in a single message** so they run concurrently. Give each one the pack path and its
   chunk ids. Each writer reads story.md, canon.mjs and chunks.md, writes `shots/cNN.json`, and
   validates its chunks with `build-frames.mjs --check --chunks`. For a pack of 8 chunks or
   fewer, write the shots yourself.
6. **Merge and assemble:** `node Tool/image-pack/build-frames.mjs <pack>`. It fails on any
   missing frame, unknown key, missing reference, "watermark" or over-long prompt. Fix and
   re-run. Skim the writers' flagged beats and the chunk seams (last frame of one chunk, first
   of the next) for story continuity.
7. **Generate in parallel:**
   `node Tool/image-pack/gen-parallel.mjs <pack>/jobs-frames.json <pack>/frames 5 90`, run in the
   background. With `IMAGE_LOCATIONS` set in `Tool/.env`, jobs spread across regions, each with
   its own quota. Re-running the same command only fills missing ids. Expect 429s under this
   quota: a 429 generates and bills nothing, so re-run at a slower pace (`2 45`, then `1 60`). A
   missing image with `promptFeedback.blockReason` is a prompt block: fix the wording, don't
   retry it blindly.
8. **Verify every frame by looking:** `node Tool/image-pack/check-frames.mjs <pack>/frames`
   builds one contact sheet per chunk and lists letterboxed frames. Check culture and period
   drift first (modern buildings, water tanks, flags, wrong hats), then duplicated characters,
   then text, then composition.
9. **Re-roll with one fix each.** Save the fix as `<id>-v2.png` and change only one clause. For
   letterboxing, describe a composition that can only be vertical (three stacked bands, top to
   bottom). Once a frame is replaced, move the old version to `superseded/`.
10. **Deliver.** Move the pack to `Outputs/`. Keep `frames/` holding exactly one final file per
    frame, named `cNN-F.png`. Write `prompt-pack.md` with the status, the re-roll log and open
    risks. Add new model lessons to `Tool/orchestrator_memory.md`. Return the folder path and the
    frame count.

## Fixed rules

- Never write "no watermark" in a prompt: it triggers a safety block. Use `No text, no captions,
  no signage, no lettering and no logos anywhere in the frame.`
- Ban flags outright on Nepali historical shots. Otherwise the model paints the modern national
  flag.
- Sensitive historical rituals (sati) are shown truthfully as the custom but kept non-graphic:
  the shrouded body on the pyre, the widow seated beside it, and flames and smoke hiding
  everything on top once it is lit. Executions are shown as the arrest, then the aftermath (a
  fallen turban at the gate), with no weapon stroke.
- Numbers in the script become visual density or countable objects, never numerals.
- Chunk writers never edit `canon.mjs` and never restate Canon in a scene. Only the lead changes
  the Canon, and a Canon change means regenerating every frame that uses it.
