# Folder Structure

This repo is split into `Tool/` (the reusable pipeline — scripts, servers, skill docs, master prompt references) and `Outputs/` (every generated image/video pack, organized by project; not committed to git). New generations land in `Tool/output/` by default; move finished packs into `Outputs/` to keep the split intact. `Other/` holds unrelated business documents (not committed). See `README.md` for the plain-language guide and `Tool/README.md` for the technical walkthrough.

All paths in this file are relative to the repo root. The only machine-specific file is `Tool/.env` (credentials, Cloud project, bucket), created by `npm run setup` in `Tool/`. If a command fails with a credentials error, run `npm run doctor` in `Tool/` before anything else.

# Parallel Processing

Split work so everything that must look identical is decided once, then fan out:

- **Serial, by the lead agent, never delegated:** reading the whole script, the story spine and chunk plan, the Canon (`canon.mjs` / `video-pack.md`), the references, prompt assembly (`build-frames.mjs`, `merge-clips.mjs`), and verification by looking.
- **Parallel:** scene-clause writing (`chunk-writer` subagents, several chunks each), clip prompt writing (`clip-writer` subagents), image generation (`gen-parallel.mjs`, one lane per region in `IMAGE_LOCATIONS`), and video generation after approval (`VIDEO_CONCURRENCY` clips at once, after one pilot clip passes).
- Launch parallel subagents in a single message. Subagents never edit the Canon.

# Local Video Asset Production

When the user asks to create video assets, B-roll, cinematic clips, or script-based scenes, use the shared local orchestrator instead of calling a media API directly.

Read `Tool/orchestrator_memory.md`, `Tool/MASTER-VIDEO-GENERATION.md` and the `create-video-assets` skill (`.claude/skills/create-video-assets/SKILL.md`, mirrored for Codex in `codex-skills/`). Operate the pipeline through `node agent-video.mjs` from the `Tool/` directory.

Mandatory rules:

- Analyze the complete script before choosing scenes.
- Ask which portions need video and whether audio is required when unspecified.
- Never call `draft` until the user approves prompt drafting.
- Present the returned visual bible and prompts for review.
- Never call `generate` until the user explicitly approves the exact scenes, prompts, estimated cost, and reference assets.
- Never set `confirmPaidGeneration` yourself based on implied approval.
- Use at most three PNG/JPEG views of the same subject per scene.
- Treat a supplied logo as the image-to-video starting frame. Never prompt the model to reconstruct its wording; prohibit all readable text, letters, captions, slogans, signage, subtitles, and synthetic wordmarks.
- Treat asset start/end seconds as approximate storytelling guidance.
- Never retry a failed generation automatically.
- Generate one pilot clip first; run the remaining approved clips in parallel only after the pilot passes review.
- Return the local output folder and individual MP4 paths.

# Local Image Pack Production

When the user asks for images, stills, frames or an image pack from a script, follow the `create-image-packs` skill (`.claude/skills/create-image-packs/SKILL.md`, mirrored for Codex in `codex-skills/`). Use the tools in `Tool/image-pack/` and the rules in `Tool/MASTER-IMAGE-GENERATION.md`.

- Chunk the script into 20-word chunks of five 4-word frames. Analyse the script, then the characters, then the environments; lock them in `canon.mjs`; fan scene writing out to `chunk-writer` subagents; assemble with `build-frames.mjs`; generate in parallel.
- Image generation needs no approval, unless the user asks to verify the characters and environments first.
- Open every frame and look at it before delivering. Move the finished pack into `Outputs/`.

# Local Map Animation Production

When the user asks for animated map graphics, administrative-border maps, choropleths, migration/flow maps, globe zooms, route animations, or any Vox/NYT/BBC-explainer-style map video, use the local Map Animation Studio pipeline instead of a generative video/image model. This pipeline draws real geographic vector data — it is deterministic, not generative — because borders and coordinates must be factually accurate.

Read `Tool/PROMPT_MAP_ANIMATION.md` and the `create-map-animations` skill (`.claude/skills/create-map-animations/SKILL.md`, mirrored for Codex in `codex-skills/`). Operate the pipeline through `node agent-map.mjs` from `Tool/map-animation-studio/`.

Mandatory rules:

- Never route a map-animation request to Veo, Gemini, or any text-to-video/image model — coastlines and borders must come from real datasets, not a generative model.
- Ask every scoping question from `PROMPT_MAP_ANIMATION.md` Section 2 in one single batch, not drip-fed across turns.
- Never call `generate` until the user explicitly approves the exact scenes, regions, admin levels, data sources, and estimated render time.
- Never infer render approval from approval of a plan, manifest, or draft/preview stills.
- Use only Natural Earth (public domain) and geoBoundaries.org (CC-BY) boundary data. Never use GADM for anything redistributed.
- Follow ISO/UN convention for borders and render genuinely disputed boundaries as a dashed line with a neutral annotation rather than silently picking a side, unless the user states an explicit editorial override.
- Never invent, estimate, or interpolate a number onto a map; every on-screen value traces to a user-supplied file or a named public source.
- Treat requested timestamps/beats as approximate storytelling guidance.
- Never retry a failed render automatically.
- Return the local output folder and individual MP4 paths.
