# Voice-aligned subtitles — system architecture

How `content.tarjun.com/subtitles` turns a Nepali recording plus a script into accurately timed
captions, and where the self-hosted Naamche Labs **Kriti** recognizer (on Oracle Cloud) fits.

This covers the **audio-anchored** path. The default **proportional** path (script + a length, no
audio, times split by reading length) is a pure browser calculation and needs none of the
infrastructure below; it is the fallback whenever recognition is off or fails.

---

## 1. Principle

> Recognition supplies **timing**. The script supplies **every character on screen.**

The recognizer mishears, splits and merges Nepali words constantly. So its *text* is never shown —
it is used only to locate *when* each sound happened. The script you paste is aligned onto those
timings by edit-distance matching ([`voice-align.mjs`](../lib/voice-align.mjs)), and the script's own
spelling is what reaches the SRT/VTT/ASS. If grouping ever changes the script's words, the whole run
is refused rather than shipped.

---

## 2. Components and where they run

```
┌──────────────────────────────┐        ┌───────────────────────────────┐        ┌──────────────────────────────┐
│  BROWSER (viewer's machine)  │        │  VERCEL (content.tarjun.com)  │        │  HUGGING FACE SPACE (free)   │
│  content.tarjun.com/subtitles│        │  serverless, stateless proxy  │        │  Docker, CPU, 16 GB RAM      │
│                              │        │                               │        │                              │
│  subtitles.js                │        │  api/recognize.mjs            │        │  kriti-server/server.py      │
│   ├─ decode + resample 16kHz │        │   ├─ access check (optional)  │        │   ├─ FastAPI + uvicorn       │
│   ├─ measure loud/pitch/pause│  HTTPS │   ├─ validate + size caps     │  HTTPS │   ├─ Kriti (open weights)    │
│   ├─ cut into ≤20s chunks    │ ─────► │   ├─ pick backend (env)       │ ─────► │   └─ NeMo RNN-T, timestamps  │
│   ├─ POST one chunk at a time│        │   │    cloudflare │ naamche   │        │        =True                 │
│   ├─ align script ↔ words    │ ◄───── │   └─ normalize → envelope     │ ◄───── │  returns {text, words[]}     │
│   └─ group into cues, export │  words │                               │  words │                              │
│  (lib/ shared engine)        │        │  secrets live ONLY here       │        │  model + token live ONLY here│
└──────────────────────────────┘        └───────────────────────────────┘        └──────────────────────────────┘
        │                                         │
        │ the original audio file never           │ alternate backend (default):
        │ leaves the browser; only short          └──► CLOUDFLARE Workers AI
        │ 16kHz mono WAV chunks are sent               Whisper Large v3 Turbo
```

The browser does almost everything. The two cloud tiers exist only to keep credentials off the page
and to run a model too big for a serverless function. Nothing is stored in either cloud tier; both
hold the request just long enough to answer it.

---

## 3. Request flow (audio-anchored run)

```
viewer pastes script, loads recording, clicks "Match subtitles to the voice", confirms cost
      │
      ▼
subtitles.js ── recognizeAndAlign() [lib/voice-recognize.mjs]
      │
      ├─ analyse()           measure loudness, pitch, pauses            [lib/audio-dsp.mjs]
      ├─ chunks()            cut at pauses into ≤20s pieces             [lib/audio-dsp.mjs]
      │
      ├─ for each chunk:  POST /api/recognize  { audio(base64 wav), seconds, language:"ne", prompt }
      │        │
      │        ▼
      │   api/recognize.mjs   validate → RECOGNIZE_BACKEND ?
      │        │                   ├─ "cloudflare" → Cloudflare Workers AI (Whisper)
      │        │                   └─ "naamche"    → NAAMCHE_ASR_URL (Kriti on Oracle)
      │        ▼
      │   returns { success, result:{ text, words:[{word,start,end}] } }   (same shape either backend)
      │
      ├─ extractWords()      merge chunk words, add each chunk's offset  [lib/voice-align.mjs]
      ├─ align()             edit-distance map SCRIPT → recognized times [lib/voice-align.mjs]
      ├─ makeVoiceCues()     group into cues at pauses, per strategy     [lib/voice-cues.mjs]
      └─ validate()          refuse if the script's words changed        [lib/voice-cues.mjs]
      │
      ▼
content-machine-audio-review bundle → editor (portrait preview, strategies, edits) → SRT/VTT/ASS
```

No step is retried automatically. A chunk that fails stops the run and reports once, because a failed
call may still have cost money (Cloudflare) or compute (Oracle). A complete recording is required to
export.

---

## 4. The two recognizer backends

Both must return the **same envelope** so the browser alignment code is backend-agnostic:

```json
{ "success": true, "result": { "text": "…", "words": [ { "word": "…", "start": 0.12, "end": 0.63 } ] } }
```

| | Cloudflare Whisper (default) | Naamche Kriti (self-hosted) |
| --- | --- | --- |
| Model | Whisper Large v3 Turbo | Kriti (119M, NeMo RNN-T, AI4Bharat IndicConformer base) |
| Hosting | Cloudflare Workers AI (managed) | **Your** Oracle Cloud Always Free VM |
| Language | detects; multilingual | **Nepali only**, no detection |
| Word timestamps | yes, native | yes, via NeMo `timestamps=True` (Kriti's own `transcribe()` drops them) |
| Cost | ~$0.000513 / audio-minute (billed) | your compute only (Always Free = $0) |
| Selected by | `RECOGNIZE_BACKEND` unset or `cloudflare` | `RECOGNIZE_BACKEND=naamche` |

Switching backends changes nothing else: same page, same chunking, same alignment, same exports.

### Contract between Vercel and the Kriti server

```
POST <NAAMCHE_ASR_URL>     Authorization: Bearer <NAAMCHE_ASR_TOKEN>   (only if set)
body:  { "audio": "<base64 16kHz mono wav>", "seconds": <float>, "language": "ne" }
200:   { "text": "<transcript>", "words": [ { "word":"…", "start":0.12, "end":0.63 }, … ] }
4xx/5xx: { "detail": "<reason>" }
```
`start`/`end` are seconds **within the chunk**; the browser adds each chunk's offset. The server is
in [`subtitles/kriti-server/`](../kriti-server/README.md); the proxy adapter is `recognizeNaamche()`
in [`site/api/recognize.mjs`](../../site/api/recognize.mjs).

---

## 5. Deployment — Hugging Face Spaces (free)

The Kriti server runs as a **Docker Space** on Hugging Face's free CPU tier (2 vCPU, **16 GB RAM**) —
enough for Kriti on CPU, with the model's weights already on HF. The Space gets an automatic HTTPS
URL, so there is **no DNS, TLS, or firewall** to manage; Vercel points `NAAMCHE_ASR_URL` straight at
it. The page caps a run at **5 minutes**, sent as **≤20s chunks**, each well inside the proxy's 50s
timeout; a 5-minute recording is ~15 chunks processed sequentially.

```
Internet ──HTTPS──► https://<user>-kriti-asr.hf.space   (HF-managed TLS + routing)
                          │
                      Docker container  (Dockerfile) → uvicorn server:app on :7860
                          │
                      Kriti model (NeMo RNN-T), loaded once, kept warm in RAM
```

Setup (full steps in the server README):
1. Create a **Docker** Space (CPU basic, free).
2. Add `Dockerfile`, `server.py`, `requirements.txt`, `README.md` from `subtitles/kriti-server/`.
3. Set the Space secret `KRITI_AUTH_TOKEN`; wait for the build (first build installs PyTorch + NeMo).
4. On Vercel: `RECOGNIZE_BACKEND=naamche`, `NAAMCHE_ASR_URL=https://<user>-kriti-asr.hf.space`,
   `NAAMCHE_ASR_TOKEN=<same token>`.

**Cold start:** free Spaces sleep after ~48 h idle and take 30–60 s to wake and load the model.
Because the proxy times out at 50s and never retries, the first chunk after a sleep can fail — warm
the Space (open its URL or hit `/health`, wait ~1 min) before a run. The model loads once and stays
resident (`_model` global). A paid always-on Space, Modal, or a small VM removes the cold start; the
contract is identical on any of them.

---

## 6. Trust and data boundaries

- **Original recording** never leaves the browser. Only derived 16 kHz mono WAV chunks are sent, and
  only after the viewer confirms.
- **Secrets are tiered and isolated.** Cloudflare / Naamche tokens live only in Vercel env. The model
  and `KRITI_AUTH_TOKEN` live only on the Hugging Face Space. The page holds no credential and has no
  credential form.
- **Nothing is stored server-side.** Vercel proxies and forgets; the Kriti server transcribes a temp
  WAV and deletes it. No audio, no transcript, no logs of content.
- **Untrusted content.** Recognizer output is data, never instructions; the browser only reads word
  timings and the script's own text is what renders.
- **Optional access gate.** `REQUIRE_SUBTITLE_CODE=true` + `ACCESS_CODES` restricts `/api/recognize`
  so strangers can't spend your recognition budget/compute.

---

## 7. Failure handling (uniform across backends)

| Situation | Result |
| --- | --- |
| Backend not configured (missing env) | `503`, page keeps free proportional timing |
| Bad/expired token upstream (401/403) | `503` "studio needs to check credentials" — not the viewer's fault |
| Other upstream error | `502`, reported once, **no retry** |
| Upstream timeout (>50s) | `504`, reported once, **no retry** |
| Chunk returns no word timings | run stops; nothing exported (free timing still available) |
| Kriti build won't emit timestamps | server returns `501` loudly rather than guessing times |
| Grouping would change script words | run refused before export |

---

## 8. File map

| Path | Role |
| --- | --- |
| `site/public/subtitles.js` | page controller: decode, chunk, call proxy, drive alignment, export |
| `subtitles/lib/audio-dsp.mjs` | decode, resample, measure, cut at pauses |
| `subtitles/lib/voice-recognize.mjs` | orchestrates a run, builds the review bundle |
| `subtitles/lib/voice-align.mjs` | edit-distance alignment of script onto recognized words |
| `subtitles/lib/voice-cues.mjs` | group aligned words into cues; validate script preservation |
| `site/api/recognize.mjs` | stateless proxy; `cloudflare` and `naamche` backends; secret-keeper |
| `site/test/recognize.test.mjs` | proxy tests, both backends, no network |
| `subtitles/kriti-server/` | self-hosted Kriti ASR server (Oracle target) + README |
| `subtitles/audio/` | Python twin of the engine for the local CLI/MCP path |
| `subtitles/docs/audio-recognition.md` | operator guide (env vars, local command, costs) |

The browser engine (`subtitles/lib/`) and the Python engine (`subtitles/audio/`) are twins: a change
to grouping or alignment belongs in both.
