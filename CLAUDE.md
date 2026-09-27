# Folder Structure

Content Machine has three parts, run from this one folder (all paths below are relative to it):

| Part | Folder | What it does |
| --- | --- | --- |
| Assets | `asset-generation/` | Script → story-coherent image packs and approval-gated Veo video. Prompts, image-pack tools, MCP server, setup/doctor. |
| Maps | `map-animation/` | Deterministic animated maps from real boundary data (no generative model). |
| Subtitles | `subtitles/` | Script + audio/video length → SRT/VTT for Premiere Pro / DaVinci Resolve, Unicode or Preeti. |

Also: `site/` (content.tarjun.com), `Outputs/` (every generated pack, per project; not committed to git), `Other/` (unrelated business documents, not committed). New asset generations land in `asset-generation/output/`; move finished packs into `Outputs/`. Root `package.json` has shortcuts: `npm run setup | doctor | maps -- <cmd> | srt -- <args> | test`. See `README.md` (plain language), `docs/STUDIO-GUIDE.md` (running the studio) and each part's own README.

The only machine-specific file is `asset-generation/.env` (credentials, Cloud project, bucket), created by `npm run setup`. If a command fails with a credentials error, run `npm run doctor` before anything else.

# MCP and content.tarjun.com

`asset-generation/mcp/server.mjs` exposes all three parts as the `content-machine` MCP server (registered by setup): asset tools, `map_*` tools and `make_subtitles`. When its tools are available, prefer them; they enforce the same gates (`generate_videos` needs `confirm_paid_generation: true`, `map_render` needs `confirm_render: true`, each set only after explicit approval). `site/` is the Vercel site at content.tarjun.com that hands out the installer (open to everyone for now; set the Vercel env var `REQUIRE_ACCESS_CODE=true` to require a code from `ACCESS_CODES`); outsiders run everything locally with their own Google account and Cloud project.

# Parallel Processing

Split work so everything that must look identical is decided once, then fan out:

- **Serial, by the lead agent, never delegated:** reading the whole script, the story spine and chunk plan, the Canon (`canon.mjs` / `video-pack.md`), the references, prompt assembly (`build-frames.mjs`, `merge-clips.mjs`), and verification by looking.
- **Parallel:** scene-clause writing (`chunk-writer` subagents, several chunks each), clip prompt writing (`clip-writer` subagents), image generation (`gen-parallel.mjs`, one lane per region in `IMAGE_LOCATIONS`), and video generation after approval (`VIDEO_CONCURRENCY` clips at once, after one pilot clip passes).
- Launch parallel subagents in a single message. Subagents never edit the Canon.

# Local Video Asset Production

When the user asks to create video assets, B-roll, cinematic clips, or script-based scenes, use the shared local orchestrator instead of calling a media API directly.

Read `asset-generation/orchestrator_memory.md`, `asset-generation/MASTER-VIDEO-GENERATION.md` and the `create-video-assets` skill (`.claude/skills/create-video-assets/SKILL.md`, mirrored for Codex in `codex-skills/`). Operate the pipeline through `node agent-video.mjs` from the `asset-generation/` directory.

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

When the user asks for images, stills, frames or an image pack from a script, follow the `create-image-packs` skill (`.claude/skills/create-image-packs/SKILL.md`, mirrored for Codex in `codex-skills/`). Use the tools in `asset-generation/image-pack/` and the rules in `asset-generation/MASTER-IMAGE-GENERATION.md`.

- Chunk the script into 20-word chunks of five 4-word frames. Analyse the script, then the characters, then the environments; lock them in `canon.mjs`; fan scene writing out to `chunk-writer` subagents; assemble with `build-frames.mjs`; generate in parallel.
- Image generation needs no approval, unless the user asks to verify the characters and environments first.
- Open every frame and look at it before delivering. Move the finished pack into `Outputs/`.

# Local Map Animation Production

When the user asks for animated map graphics, administrative-border maps, choropleths, migration/flow maps, globe zooms, route animations, or any Vox/NYT/BBC-explainer-style map video, use the local Map Animation Studio pipeline instead of a generative video/image model. This pipeline draws real geographic vector data — it is deterministic, not generative — because borders and coordinates must be factually accurate.

Read `map-animation/PROMPT_MAP_ANIMATION.md` and the `create-map-animations` skill (`.claude/skills/create-map-animations/SKILL.md`, mirrored for Codex in `codex-skills/`). Operate the pipeline through `node agent-map.mjs` from `map-animation/`.

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

# Subtitles (Script to SRT)

When the user asks for subtitles, captions or an SRT from a script, follow the `create-subtitles` skill (`.claude/skills/create-subtitles/SKILL.md`). Use the `make_subtitles` MCP tool or `node subtitles/cli.mjs`.

- Never change the script's words; only split and time them.
- Timing is proportional to reading length across the given audio/video length, not speech recognition. Point the user to content.tarjun.com/subtitles for fine-tuning.
- `unicode` output is for Unicode fonts (Mukta, Kalimati, Noto…); `preeti` output converts the text for the 77 Preeti-encoded fonts on anepali.com (Preeti, Ganess, Aakriti, Kanchan…); Kantipur, Sagarmatha and Fontasy Himali use their own slightly different encodings and are not guaranteed. Preeti can't show English letters.
- An .srt can't carry a font: tell the user to set it in Premiere Pro or DaVinci Resolve after importing.
