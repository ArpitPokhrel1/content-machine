---
title: Kriti ASR
emoji: 🗣️
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
short_description: Nepali speech to word timestamps for Content Machine subtitles
---

# Kriti ASR — Nepali speech → word timestamps

A tiny recognition endpoint for Content Machine's voice-aligned subtitles
(`content.tarjun.com/subtitles`). It runs Naamche Labs' [Kriti](https://github.com/Naamche-Labs/kriti)
and returns **word-level timestamps**, which is what the subtitle aligner needs. The site never
shows the recognized text — your pasted script supplies every caption word; recognition supplies only
the *timing*.

The YAML header above configures this as a **Hugging Face Docker Space**. The `Dockerfile`,
`server.py`, and `requirements.txt` next to it are the whole service.

## Why a server exists

Kriti is open weights, and its `kriti.transcribe()` returns text with **no timings**. Kriti wraps a
NeMo RNN-T model, and NeMo *can* emit word timestamps — so `server.py` loads Kriti, reaches the NeMo
model underneath, and asks for them.

## The contract

```
POST /            Authorization: Bearer <KRITI_AUTH_TOKEN>   (only if that secret is set)
body:  { "audio": "<base64 16 kHz mono wav>", "seconds": <float>, "language": "ne" }
200:   { "text": "<transcript>", "words": [ { "word": "...", "start": 0.12, "end": 0.63 }, ... ] }
```
`start`/`end` are seconds within the piece sent; the browser adds each piece's offset. The browser
decodes, resamples and cuts the recording into ≤20 s pieces, so one request = one short piece.
`GET /` and `GET /health` are open liveness checks.

## Deploy on Hugging Face Spaces (free)

1. [huggingface.co/new-space](https://huggingface.co/new-space) → **SDK: Docker**, blank template,
   **CPU basic (free)**, visibility **Public**.
2. Add these four files to the Space (web UI *Files → Add file*, or git push):
   `Dockerfile`, `server.py`, `requirements.txt`, and this `README.md`.
3. Space **Settings → Variables and secrets → New secret**: `KRITI_AUTH_TOKEN` = a long random
   string. (Optional but recommended; without it the endpoint is open to anyone who finds the URL.)
4. Wait for the build (the first one is slow — it installs PyTorch + NeMo). Watch the **build logs**;
   if the Kriti install line fails, that's the place to adjust (see the `Dockerfile` comment).
5. Your endpoint is the Space URL, e.g. `https://<user>-kriti-asr.hf.space`.

Then on the Vercel project for `content.tarjun.com`:

| Variable | Value |
| --- | --- |
| `RECOGNIZE_BACKEND` | `naamche` |
| `NAAMCHE_ASR_URL` | your Space URL (the `POST /` route, i.e. the root) |
| `NAAMCHE_ASR_TOKEN` | the same string as `KRITI_AUTH_TOKEN` |

Leave `RECOGNIZE_BACKEND` unset to keep the default Cloudflare Whisper backend. The switch is in
[`site/api/recognize.mjs`](../../site/api/recognize.mjs); `site/test/recognize.test.mjs` covers both.

## Cold start (free-tier caveat)

Free Spaces sleep after ~48 h idle and take 30–60 s to wake and load the model. The site's proxy
times out at 50 s and never retries, so the **first** chunk after a long sleep can fail. Before a
subtitle run, open the Space URL (or hit `/health`) once and wait ~1 minute to warm it, then
generate. A paid always-on Space, Modal, or a small VM removes this.

## Running it elsewhere

Nothing here is HF-specific except the README header and `app_port`. Any host that runs the container
and gives you one HTTPS URL works (a VM with Caddy/TLS, Modal, etc.). The architecture, backends and
data boundaries are documented in [`../docs/architecture.md`](../docs/architecture.md) and
[`../docs/audio-recognition.md`](../docs/audio-recognition.md).

## Honest caveats

- Kriti is **Nepali only** — it does not detect language. Use it for Nepali audio; keep the Cloudflare
  backend for anything else.
- The per-run cost shown on the page is Whisper's list price. On this backend the real cost is the
  host's compute (free on HF's CPU tier), so treat that number as a placeholder.
- Kriti's exact `transcribe()` signature varies by release; `server.py` tries the common shapes, and
  `words_from_hypothesis` handles both seconds and frame-offset timestamp formats.
