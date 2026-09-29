# Nepali audio recognition and portrait captions

The original browser, CLI and `make_subtitles` MCP workflow remain local and free. This optional
workflow uses **Cloudflare-hosted Whisper Large v3 Turbo** to obtain word timestamps, then aligns
the supplied Nepali script and refines cue starts against the audio. Your script supplies every
caption word; recognizer spelling never replaces it. This is ASR-anchored character alignment,
not phoneme-level forced alignment or an emotion classifier.

## Install and configure

Install [uv](https://docs.astral.sh/uv/). The optional package requires Python 3.11+; uv manages its
isolated environment. Regular `npm run srt` and the browser editor do not need Python.

Add these to the existing **`asset-generation/.env`**, or set them in the process environment:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
```

Use a token with Workers AI access. Alternatively set `CLOUDFLARE_USE_WRANGLER=1` and leave the
API token empty to reuse an existing Wrangler login on macOS/Linux. No credential is created or
stored in the review file. Environment variables take precedence. Credentials stay in the local
CLI/MCP process; the public editor has no cloud request code or credential form.

## Recognize and review

Run from the repository root (commands below are single lines and work across shells):

```sh
npm run srt:audio -- recognize --audio voice.mp3 --script script.txt --out Outputs/subtitles/voice
```

This first invocation **only estimates usage**. To upload that recording to Cloudflare:

```sh
npm run srt:audio -- recognize --audio voice.mp3 --script script.txt --out Outputs/subtitles/voice --submit --preeti
```

`recognize` uses `@cf/openai/whisper-large-v3-turbo`, language `ne`, transcription mode, VAD off,
and previous-text conditioning on. It decodes MP3/WAV/FLAC with libsndfile, resamples to 16 kHz mono,
and cuts near pauses into roughly 20-second WAV chunks. Video containers are not accepted by this
optional engine; extract their audio first. `--prompt "कर्ण, इन्द्र, वायुपंखी।"` supplies short name
or vocabulary hints. Do not use the complete script as the recognition prompt.

Open [the subtitle editor](https://content.tarjun.com/subtitles) after this feature is deployed,
or use the local editor below. Under **Match subtitles to the voice · Whisper**, open the generated
`voice.review.json`, then load the same audio/video file with **Load audio or video**.

- **Portrait** is selected on import: 1080×1920 (9:16), Unicode Noto Sans Devanagari, 60 px,
  one block at a time, at most two lines, 350 px bottom space and 96/140 px left/right space.
- Choose **Narrative, Short phrases, Calm, or One word** without calling the API again.
  Each strategy keeps its own edits during the current page session. Only the current cues and
  settings are persisted by the existing editor; export before closing.
- Use **Shift all** for an overall offset, or edit individual cue start/end times. Positive
  offsets display captions later. The existing split/merge/text controls remain available.
- Amber **Check voice alignment** flags mark low text-match confidence. Timing evidence lists
  pauses, energy/pitch changes and onset adjustments. These are acoustic estimates and refer
  to the original alignment, so edited cues still need listening review.
- **Re-time all** deliberately replaces ASR timing with the existing reading-length estimate.
  Reimport the original review file to restore original timings.
- Export **Unicode or Preeti SRT**, or VTT, using the existing font catalogue. Preeti needs a real
  compatible font installed in the video editor; no Preeti font is bundled. The optional
  **Styled Unicode ASS** export carries the chosen preview shape, font, size, position and colour
  for ASS-aware players. It always uses Unicode (Noto if a Preeti font is currently selected).

SRT does not store font, resolution or screen placement. In Resolve, set the timeline to 1080×1920
and apply Track Style after import. Align subtitle zero to the start of the untrimmed audio clip.
The frame rate can round millisecond timings; review against actual footage and social interface
controls. Audio alone cannot locate faces or empty space in the video.

The browser imports the local review file without uploading it. Loading a different recording of
similar length cannot be detected automatically; use the original file. Google Fonts requests
are part of the existing font preview, independent of your script or media.

## Local preview

```sh
node site/scripts/build.mjs
npm run srt:audio -- preview --directory site/public --port 8767
```

Open `http://127.0.0.1:8767/subtitles.html`. The server binds to loopback only. Generated media,
recording-derived data, credentials and virtual environments are excluded from Git and the
installer bundle. The build packages the optional Python source and pinned dependency lock.

## Cached rebuilds and custom strategies

Each API response is cached by model, request parameters, audio contents and chunk offset.
Repeating the same command reuses the cache, including failures. `--refresh` explicitly resends
requests and can incur charges. Network errors/timeouts are **never retried automatically**.
Recognition stops at its first failed chunk; a complete recording is required for export.

Build without cloud access using the saved response files:

```sh
npm run srt:audio -- build --audio voice.mp3 --script script.txt --asr response-1.json response-2.json --out Outputs/subtitles/rebuilt --preeti
```

Provide the successful chunk files from one run, in any order. Overlaps and missing chunks are
rejected. The response files must come from the same recording; timestamps and chunk coverage are
validated, but old external response files are not guaranteed to carry an audio fingerprint.

`--preset portrait` exports one strategy; the default `all` exports all five. `--config presets.json`
overrides parameters or adds named strategies based on an existing one:

```json
{"dramatic":{"base":"portrait","max_words":4,"target_seconds":1.6}}
```

Use `--preset dramatic` with that config. See `audio/examples/presets.json`. The engine chooses
phrase breaks using duration, grapheme count, sentence ends, pauses and pitch/energy changes.
It protects phrases such as “सोह्र श्राद्ध” and “पितृ पक्ष”. A bounded onset pass removes quiet
lead-ins only when sustained audio activity is found; it leaves starts already in speech alone.

Unmatched words remain in the script and are flagged. If a span has no usable time, the engine
writes `alignment.json` and stops instead of silently dropping text. Review the script/recording
and decide how to treat unspoken material. No example-specific deletion is built into the engine.

Outputs include SRT/ASS, optional Preeti SRT, the portable `.review.json`, `alignment.json`,
`metrics.json`, `acoustics.json`, cached `raw/` responses, `runs.json` and `cost.json`.
The review bundle contains the script, cue data, model, audio basename/hash, estimated cost and
waveform summary; it does not contain the audio file or credentials. Treat it as project content.

## Models and cost

Inference uses `POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}`.
Flux uses the equivalent `wss://` endpoint. These are direct Workers AI calls, not OpenAI or
Deepgram account APIs. Rates checked September 29, 2026; verify before planning future spend.

| Adapter | USD per audio minute | Observed on a 90.264-second Nepali narration |
| --- | ---: | --- |
| [Whisper Large v3 Turbo](https://developers.cloudflare.com/workers-ai/models/whisper-large-v3-turbo/) | $0.000513 | Best usable coverage in five chunks; final timing source |
| [Whisper](https://developers.cloudflare.com/workers-ai/models/whisper/) | $0.000453 | Wrong-script text and repetitions |
| [Whisper Tiny English](https://developers.cloudflare.com/workers-ai/models/whisper-tiny-en/) | Unpublished | English/romanized output and out-of-range timestamps |
| [Deepgram Nova-3 HTTP](https://developers.cloudflare.com/workers-ai/models/nova-3/) | $0.0052 | Explicit `ne` rejected by this deployment; diagnostic autodetect recovered only the ending |
| [Deepgram Flux](https://developers.cloudflare.com/workers-ai/models/flux/) | $0.0077 | Romanized/incomplete output; no per-word times in tested schema |

A fresh 90.264-second Turbo pass is approximately **$0.000772** before allowances. One hour is
approximately **$0.03078**. Rebuilding captions or adjusting the preview incurs no API charge.
The original investigation made 22 inference attempts (14 successes, 8 failures) across five
models, including full-vs-chunked Turbo and diagnostic retries. Successful calls were estimated
at **$0.02190** total. Failed-call billing was unknown. No invoice was queried. These results are
one recording, not a general Nepali benchmark; private recording/raw responses are not distributed.

Raw chunked Turbo text had 25.9% character error and 84.7% word error versus the supplied script.
The final captions use the trusted script, so these are recognizer errors, not errors in the final
caption wording. Timing accuracy was not measured against independent hand-labelled boundaries.

`cost.json` distinguishes cached and new requests. It reports list estimates before the shared
[Workers AI allowances](https://developers.cloudflare.com/workers-ai/platform/pricing/), not an
invoice. Unknown rates are `null`, never zero. Any failed-call billing is unknown. Regenerating a
report from historical responses uses this version's rate snapshot if those responses lack a price.

To inspect models or benchmark (this never changes the chosen production model):

```sh
npm run srt:audio -- models
npm run srt:audio -- benchmark --audio voice.mp3 --out Outputs/subtitles/benchmark
npm run srt:audio -- benchmark --audio voice.mp3 --out Outputs/subtitles/benchmark --submit
```

The benchmark tests all five adapters by default. `--models whisper-large-v3-turbo` narrows it.
Nova-3 is tried with explicit Nepali; an unsupported-language response is saved, not silently
replaced with another language. A model result without usable word times is unsuitable for `build`.

## MCP and tests

The new `recognize_subtitles` tool accepts script text and `media_path`. It estimates without
uploading by default; `submit_to_cloudflare: true` runs recognition after the user has authorized
that recording's upload and cost. The existing `make_subtitles` tool is unchanged.

```sh
npm test
npm run test:audio
node asset-generation/mcp/audio-selftest.mjs
```

Tests cover script preservation, split/merged ASR tokens, missing speech flags, all five strategies,
early-start/noise handling, time bounds/overlaps, cache reuse, failure handling, estimates with no
network calls, UTF-8/Preeti conversion, review import rejection and styled export. No live API
credentials or paid calls are needed. Browser smoke checks should additionally cover import,
strategy switching, edits, portrait preview, offsets and both SRT/ASS exports.
