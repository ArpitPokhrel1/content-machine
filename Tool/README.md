# Content Machine: Tool (technical walkthrough)

The reusable pipeline. No generated media lives here. Finished work goes to `../Outputs/`. The
plain-language guide is `../README.md`, and the operating rules for agents are `../CLAUDE.md`
and `../AGENTS.md`.

| Pipeline | Purpose | Entry point |
| --- | --- | --- |
| Video orchestrator | Script or keyframes → approval-gated Veo clips, run in parallel | `server.mjs` + `agent-video.mjs` |
| Image packs | Script → story-coherent image pack, run in parallel | `image-pack/*.mjs` |
| Map Animation Studio | Deterministic map video from real geodata (no generative AI) | `map-animation-studio/agent-map.mjs` |

---

## 1. Configuration: one file per machine

Everything machine-specific lives in `Tool/.env` (template: `.env.example`, writer:
`npm run setup`). `lib/config.mjs` loads it for every script, whatever the working directory.
Real environment variables override it. No project ID, bucket or path is hardcoded anywhere, and
`npm test` enforces that.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI mode. Auth via `gcloud auth application-default login` or `GOOGLE_APPLICATION_CREDENTIALS` |
| `GEMINI_API_KEY` | Gemini API mode, used when no project is set. Model names differ (e.g. `veo-3.1-fast-generate-preview`) |
| `GOOGLE_CLOUD_LOCATION` / `PROMPT_LOCATION` | Media region (default `us-central1`) / text-model region (default `global`) |
| `VIDEO_OUTPUT_BUCKET` | Optional. Set: Veo writes to GCS and `gcloud storage cp` downloads. Empty: bytes come back inline |
| `PROMPT_MODEL`, `VIDEO_MODEL`, `IMAGE_MODEL`, `VIDEO_RESOLUTION` | Defaults: `gemini-3.1-flash-lite`, `veo-3.1-fast-generate-001`, `gemini-2.5-flash-image`, `1080p` (720p except on 16:9) |
| `VIDEO_CONCURRENCY` | Clips generated at once after approval (default 3) |
| `IMAGE_LOCATIONS` | Comma list of regions. Image jobs are dealt round-robin to one lane per region, each with its own quota |
| `PORT` | Local server port (default 4317) |

```powershell
npm run setup              # install deps, write .env, install Codex skills, seed Claude memory
npm run doctor             # local checks;  npm run doctor -- --online  adds one free API call
npm start                  # http://127.0.0.1:4317 (browser UI + the API the agents use)
npm test                   # guardrail tests (approval flags, no retries, no hardcoded IDs, pool)
```

---

## 2. Parallel architecture

Consistency comes from deciding everything shared **once**, then parallelising only the parts
that can't drift.

```text
                 ┌──────────── lead agent (serial) ────────────┐
script ─────────►│ translation · story spine · chunk plan       │
                 │ canon.mjs (GRADE, Canon, anchors, NEG)       │
                 │ references → verified by eye                 │
                 └───────┬─────────────────────────────┬────────┘
          fan out        │                             │
   chunk-writer ×N  shots/cNN.json          clip-writer ×N  clips/<id>.json
          (parallel subagents: scene clauses only, Canon read-only)
                 ┌───────┴─────────────────────────────┴────────┐
                 │ build-frames.mjs / merge-clips.mjs           │  ← pastes identical Canon
                 └───────┬─────────────────────────────┬────────┘     into every prompt
   gen-parallel.mjs: batches × region lanes      agent-video batch: pilot → VIDEO_CONCURRENCY
                 └──────────── lead verifies every output ──────┘
```

The subagent definitions are `../.claude/agents/chunk-writer.md` and `clip-writer.md`.
`lib/pool.mjs` is the bounded worker pool: capped concurrency and spaced starts, and a failure
is recorded, never re-run.

---

## 3. Image packs (`image-pack/`)

Full workflow: `../.claude/skills/create-image-packs/SKILL.md`. Rules:
`MASTER-IMAGE-GENERATION.md`.

```powershell
node image-pack/chunk-script.mjs <pack>/script.txt          # words.txt + chunks.md (20-word chunks → 5×4-word frames)
copy image-pack/templates/canon.template.mjs <pack>/canon.mjs   # then fill it in
node image-pack/build-refs.mjs <pack>                        # jobs-refs.json from canon.mjs
node image-pack/gen-parallel.mjs <pack>/jobs-refs.json <pack>/refs 5 90
node image-pack/build-frames.mjs <pack> [--check] [--chunks c03,c04]   # canon + shots/*.json → jobs-frames.json
node image-pack/gen-parallel.mjs <pack>/jobs-frames.json <pack>/frames 5 90 [--force]
node image-pack/check-frames.mjs <pack>/frames               # contact sheet per chunk + letterbox scan (ffmpeg)
```

- **`shots/cNN.json`**: `[{ "id": "c03-1", "chars": ["K","B"], "env": "court", "anchor"?: "tibet"|"none", "scene": "…{{MOTIF}}…" }]`.
  The builder rejects unknown keys, missing frames, missing references, more than 3 refs,
  "watermark", and prompts over 4000 characters.
- **`gen-parallel.mjs`** `<batchSize> <gapSeconds>` paces each region lane (`5 90` is safe for
  one quota). Existing `<id>.png` files are skipped, so re-running fills gaps. No-image results
  log `finishReason` and `promptFeedback`, and results go to `<pack>/logs/`.
- Refs in job files resolve relative to the jobs file.

---

## 4. Video orchestrator

Full workflow: `../.claude/skills/create-video-assets/SKILL.md`. Rules:
`MASTER-VIDEO-GENERATION.md`.

```powershell
node agent-video.mjs health
node agent-video.mjs draft --manifest m.json                   # Route A: 1 text-model call → prompts
node agent-video.mjs review --project <id>
node agent-video.mjs generate --project <id> --approval a.json # approved scenes, VIDEO_CONCURRENCY at once
node agent-video.mjs status --project <id>
node video/merge-clips.mjs <project> --aspect 9:16             # Route B: clips/*.json → clips.json (unapproved)
node agent-video.mjs batch --clips <project>/clips.json --only <pilot>
node agent-video.mjs batch --clips <project>/clips.json --except <pilot>
node agent-video.mjs batch-status --batch <id>
node agent-video.mjs image|video --prompt "…" --confirm true   # quick one-offs → output/quick/
```

**Guardrails in code:** `generate` and `batch` refuse without `confirmPaidGeneration: true`,
quick calls without `--confirm true`, and the browser UI asks for confirmation. Each clip is
exactly one request (`numberOfVideos: 1`), and nothing is ever re-run automatically. The batch
endpoint rejects an end frame without a start frame, keyframes mixed with subject refs, and
subject refs at anything but 8 s on Veo fast. There's a 10 MB per-image limit and at most 3
references.

**Server API** (`server.mjs`, bound to 127.0.0.1): `GET /api/health` · `POST /api/prompts` ·
`GET /api/projects/:id[/plan]` · `POST /api/projects/:id/generate` · `POST /api/batch/video` ·
`GET /api/batch/:id` · `POST /api/quick/image` · `POST /api/quick/video`.

**Output:**

```text
output/<project-id>/  input.json  prompts.json  approved.json  status.json  assets/  videos/scene_01.mp4
output/<batch-id>/    batch.json  status.json  videos/<clip-id>.mp4
output/quick/         image-<stamp>-1.png  video-<stamp>.mp4
```

Move finished folders into `../Outputs/`.

---

## 5. Map Animation Studio

See `map-animation-studio/README.md` and `MEMORY.md`, plus `PROMPT_MAP_ANIMATION.md` for the
one-batch questionnaire. Install with `node scripts/setup.mjs --maps`. It needs ffmpeg and Edge
or Chrome (`MAP_STUDIO_CHROME_PATH` overrides the browser path). Boundary data is fetched once
into `data/cache/`. The CLI is `node agent-map.mjs health | plan | draft | generate | status`,
and render always waits for explicit approval.

---

## 6. Files

| Path | What |
| --- | --- |
| `MASTER-IMAGE-GENERATION.md`, `MASTER-VIDEO-GENERATION.md` | Concise canonical prompt methods (full versions in `archive/`) |
| `orchestrator_memory.md` | Model-behaviour lessons from real runs. Read before every job, append after |
| `PROMPT_MAP_ANIMATION.md` | Map scoping questionnaire |
| `lib/` | `config.mjs` (env + client), `generate.mjs` (one image / one clip), `pool.mjs` (parallel pool) |
| `image-pack/` | Chunker, canon builders, parallel runner, contact sheets, canon template |
| `video/merge-clips.mjs` | Merges clip-writer output for the approval gate |
| `scripts/` | `setup.mjs`, `doctor.mjs`, `sync-codex-skills.mjs` |
| `public/` | Browser UI served by `server.mjs` |
| `archive/` | Older and full-length references (see `archive/README.md`) |

**Keeping the agents in sync:** edit the Claude skills in `../.claude/skills/`, run
`node scripts/sync-codex-skills.mjs` to regenerate `../codex-skills/`, then `npm run setup` to
install them into `~/.codex/skills`.
