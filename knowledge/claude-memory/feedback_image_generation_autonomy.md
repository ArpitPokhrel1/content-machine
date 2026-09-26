---
name: feedback-image-generation-autonomy
description: User does not want to be asked for approval before generating images; only paid video generation needs an explicit gate
metadata: 
  node_type: memory
  type: feedback
  originSessionId: a77435b9-30f9-4255-b897-b95fadf12ec7
  modified: 2026-09-23T09:50:17.252Z
---

For this content pipeline, generate images without stopping to ask — just run the batch and show the results. Video generation still requires an explicit approval gate.

**Why:** The user stated it directly (2026-09-23): "for generating images, you don't have to ask me. you can just show the results." Images are cheap relative to Veo video jobs; the approval gate exists to protect against paid video spend, not image spend.

**How to apply:** In the Frame Foundry / `agent-video.mjs` workflow, skip the "stop for approval before drafting prompts / generating images" step and proceed straight to generating stills, then present them. Re-rolling defective frames also does not need approval. Still never call `generate` (Veo) or set `confirmPaidGeneration` without explicit per-batch approval of scenes, prompts and cost — that gate is mandatory and is reinforced in CLAUDE.md. See [[project-chyasal-kirat-image-pack]].
