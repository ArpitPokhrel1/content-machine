# Content Machine over MCP: workflow

You're driving Content Machine through its MCP tools. Everything runs on the user's own machine:
generation uses **their** Google account and Cloud project, and every file is saved in **their**
local Outputs folder. Paths returned by the tools are real paths on their disk. Give those to the
user.

Read `image-method` (or `video-method`) and `model-lessons` before planning. This file only maps
the method onto the tools.

## Image pack

1. **`health`**: confirm auth is ready. If it isn't, stop and ask the user to re-run the installer.
2. **`create_pack(title, script)`**: saves the script and returns the chunk table (20-word chunks
   → five 4-word frames `cNN-1…5`).
3. **Understand the script yourself, fully**: literal translation (asserted vs implied facts),
   classification, story spine, five anchors, characters, environments, chunk plan. Ask the user
   every open question **in one batch**. Save it with `write_pack_file(pack, "story.md", …)`.
4. **Lock the Canon**: `read_guide("canon-template")`, fill it in, and
   `write_pack_file(pack, "canon.mjs", …)`. GRADE, Canon, anchors and NEG are written once here
   and never reworded.
5. **References**: `build_prompts(stage "refs")` → `generate_images(stage "refs")` →
   `job_status` until finished → `contact_sheets(folder "refs")`. Look at every reference and fix
   drift in canon.mjs before any story frame. If the user asked to verify characters first, stop
   here.
6. **Shots**: for each chunk, `write_pack_file(pack, "shots/cNN.json", …)` with five entries:
   `{ "id": "c03-1", "chars": ["K"], "env": "court", "scene": "…" }`. Scenes hold framing, action,
   depth and light only. Never restate the Canon. If your client can run subagents, split the
   chunks across several writers in parallel; they must only read canon.mjs.
   Validate with `build_prompts(stage "frames", check true)`.
7. **Frames**: `build_prompts(stage "frames")` → `generate_images(stage "frames")`. It runs in
   parallel batches in the background. Poll `job_status`. On 429 quota errors, call
   `generate_images` again later with a smaller `batch_size` (2, then 1) and a longer
   `gap_seconds`. Existing frames are skipped.
8. **Verify by looking**: `contact_sheets(folder "frames")`, paging with `start`/`limit`, and
   `view_image` for close checks. Check culture and period drift, identity, duplicates, text and
   letterboxing. Reroll one change at a time: fix that shot's scene, delete nothing, and generate
   again with `force` only when the user agrees to replace frames.
9. **Deliver**: `write_pack_file(pack, "prompt-pack.md", …)` with decisions and open risks, then
   `list_outputs` and give the user the folder path.

## Video (always approval-gated, and billed)

1. Ask which beats need motion, audio (default silent), and the finished duration, in one batch.
2. Write `video-pack.md` (handoff block + shot list) and one `clips/<id>.json` per clip:
   `{ "id": "c07", "prompt": "… Coming to rest as …", "image": "frames/c07-1.png", "endImage": "frames/c07-2.png", "duration": 6 }`.
   Use `refs` (max 3) instead of keyframes for subject-reference clips, and 8 s for those.
3. `prepare_clips` → show the user **every prompt, the frames per clip, clip count, total
   seconds, model, resolution, audio and estimated maximum cost**. Wait for an explicit yes.
4. `generate_videos(confirm_paid_generation: true, only: [pilot])`, then watch it.
5. If the pilot is right, `generate_videos(confirm_paid_generation: true, except: [pilot])`.
   Clips run several at a time. Poll `job_status`, then `list_outputs`.
6. Never re-run a failed clip without new approval. Report the error and the likely cause.

## Rules that never bend

- Paid video only after explicit approval of the exact clips and cost.
- No readable text in any frame. Never write "watermark" in a prompt.
- Never invent story, dates or people the script doesn't support.
- Numbers become countable objects, never numerals.
