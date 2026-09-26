---
name: feedback-image-pack-chunking
description: "User's preferred script-to-image method — 20-word chunks, 5 frames of 4 words each, generated 5 in parallel; analyse script→characters→environment first"
metadata:
  node_type: memory
  type: feedback
  originSessionId: e98d984c-539f-4ccc-bafc-6571c8ce6040
  modified: 2026-09-24T05:25:54.648Z
---

For script-to-image packs, the user wants this order: analyse the script, then design the characters, then the environments (ancient Nepal/Kathmandu for history pieces). Then chunk the script into 20 words, split each chunk into five 4-word frames, and generate the five frames of a chunk in parallel. On 2026-09-24 they asked to verify the characters and environments before any story frames, and to have the method saved into the skill and tool.

**Why:** The user stated it directly. It keeps each frame tied to its chunk's context while matching the narration pace (about 1 image per 4 words).

**How to apply:** Use the `create-image-packs` skill and `Tool/image-pack/`. Show reference images for verification when asked. Otherwise generate without asking ([[feedback-image-generation-autonomy]]). Treat the rate limit as the real constraint: five in parallel work, but back-to-back batches hit 429s. See [[project-sati-bhim-malla-image-pack]].
