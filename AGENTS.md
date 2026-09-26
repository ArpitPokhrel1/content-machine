# Video Asset Agent Instructions

This repo has three parts: `asset-generation/` (images and video), `map-animation/` (factual map animation) and `subtitles/` (script to SRT). Finished work goes to `Outputs/`. Run asset commands from `asset-generation/`, map commands from `map-animation/` (`node agent-map.mjs`, see the `create-map-animations` skill), and subtitles with `node subtitles/cli.mjs` from the repo root (see the `create-subtitles` skill). The only machine-specific file is `asset-generation/.env`, created by `npm run setup`; run `npm run doctor` when anything fails to connect.

For requests to turn scripts into still images or an image pack, use the `create-image-packs` skill (installed from `codex-skills/` by setup) and the tools in `asset-generation/image-pack/`. Chunk the script into 20 words, give each chunk five 4-word frames, lock the Canon in `canon.mjs`, write `shots/cNN.json`, assemble with `build-frames.mjs`, and generate in parallel. Image generation does not need the video approval gates.

For requests to turn scripts into video assets, use the `create-video-assets` skill and the local `agent-video.mjs` bridge. After approval, generate one pilot clip, then the rest in parallel with `agent-video.mjs batch`.

Read `orchestrator_memory.md` and the concise master prompts `MASTER-IMAGE-GENERATION.md` / `MASTER-VIDEO-GENERATION.md` (in `asset-generation/`) before planning. Preserve the two approval gates: one before the prompt-planning request and one before paid Veo generation. Never generate or retry without explicit approval.

Codex-generated PNG/JPEG files may be attached as subject references through the approval manifest. Use no more than three views of the same subject per scene and describe timeline placement as approximate.

For logo jobs, use the supplied logo as the image-to-video starting frame and prohibit all generated text or lettering. Animate non-text visual qualities only.
