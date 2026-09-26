---
name: project-chyasal-kirat-image-pack
description: "Chyasal / Kirat / Lichhavi vertical explainer — 20 core + 15 supplementary + 12 gap-fill frames done, video not yet generated or approved"
metadata: 
  node_type: memory
  type: project
  originSessionId: a77435b9-30f9-4255-b897-b95fadf12ec7
  modified: 2026-09-24T06:06:13.755Z
---

A 9:16 historical explainer on the Kirat–Lichhavi conflict and the etymology of Chyasal ("chya" eight + "sah" hundred → the 800 dead). Core 20-beat frames live in `Outputs/chyasal-kirat-lichhavi-image-pack-20260923/frames/` as `beatNN-slug.png`, 768x1344. A second, supplementary batch of 15 in-between detail/cutaway frames (spread throughout the same script, no refs/logs/scaffolding — just the delivered PNGs per user request) lives in `Outputs/Chyasal/chyasal-extra-frames-20260924/` as `extraNN-slug.png`.

A third batch of 12 gap-fill frames (Vaishali, the Lichhavi march, the Kirat court and sentries, the night siege, the one-meadow encirclement, the empty meadow, Lichhavi rule, the name passed down) lives in `Outputs/Chyasal/chyasal-gap-frames-20260924/frames/` as `gNN-slug.png` (2026-09-24). Three silent 8 s Veo clips (v1-arrival from g04, v2-siege from g07, v3-aftermath from g09) were approved and generated 2026-09-24 in `Outputs/Chyasal/chyasal-gap-frames-20260924/videos/` (cropped for the 10 px bars; originals in `raw/`). In v2 the torches read as planted on the terraces rather than carried by climbing men.

As of 2026-09-24 all 35 stills (20 core + 15 supplementary) are generated and visually reviewed. **No video has been generated and none has been approved.**

**Why:** The first 20-scene batch half-failed and was misdiagnosed as a service outage; the real cause was a safety block on the phrase "no watermark" (see `Tool/orchestrator_memory.md`, which now carries the root cause and the re-roll lessons). The 15-frame supplementary batch (2026-09-24) hit a different recurring issue instead: generic prop/architecture nouns (shields, gateway, construction site) defaulted to Viking/Tudor/Roman visual tropes until the prompts named the actual Nepali regional form explicitly — also logged in `Tool/orchestrator_memory.md`.

**How to apply:** Superseded frame versions from the first batch are kept in that pack's `superseded/` folder, and per-batch results are in its `logs/`; the second batch was delivered as images-only with no such scaffolding, by explicit request. If the user returns to this project, the next step is the video approval gate — present scenes, prompts and estimated cost before any Veo call. See [[feedback-image-generation-autonomy]].
