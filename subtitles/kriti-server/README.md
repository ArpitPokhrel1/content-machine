# Self-hosted Kriti ASR for voice-aligned subtitles

`content.tarjun.com/subtitles` times your subtitles by matching your script onto recognized speech.
That matching needs **word-level timestamps**. This small server gives the site a Nepali recognizer
(Naamche Labs' [Kriti](https://github.com/Naamche-Labs/kriti)) that returns them, so the site can use
a Nepali-specific model instead of Cloudflare Whisper.

## Why a server is needed at all

Kriti is **open weights, not a hosted API**, and its `kriti.transcribe()` returns text with no
timings. Kriti wraps a NeMo RNN-T model, and NeMo *can* emit word timestamps — this server loads
Kriti, reaches the NeMo model underneath, and asks for them. A Vercel function can't load a 119M
PyTorch model, which is why recognition runs here and the site only proxies to it.

The site never changes your script's words. Recognition supplies *timing*; every character on screen
comes from the script you paste.

## The contract

```
POST /            Authorization: Bearer <KRITI_AUTH_TOKEN>   (only if that env var is set)
body:  { "audio": "<base64 16 kHz mono wav>", "seconds": <float>, "language": "ne" }
200:   { "text": "<transcript>", "words": [ { "word": "...", "start": 0.12, "end": 0.63 }, ... ] }
```
`start`/`end` are seconds within the piece of audio sent; the browser adds each piece's offset. The
browser already decodes, resamples to 16 kHz mono, and cuts the recording into pieces ≤20 s, so this
server only handles one short piece per request.

`GET /health → { "status": "ok", "model_loaded": true|false }` for platform probes.

## Run it

```bash
pip install -r requirements.txt
# install Kriti per its repo README (pip install -e '.[runtime]' from a Kriti checkout)
export KRITI_AUTH_TOKEN="choose-a-long-random-string"     # optional but recommended if public
uvicorn server:app --host 0.0.0.0 --port 8000
```

A GPU box, Hugging Face Inference Endpoint, Replicate, Modal, or Fly.io with a GPU all work — any
host that gives you one HTTPS URL. CPU works for short clips but is slow.

## Point the site at it

On the Vercel project for `content.tarjun.com`, set:

| Env var | Value |
| --- | --- |
| `RECOGNIZE_BACKEND` | `naamche` |
| `NAAMCHE_ASR_URL` | the HTTPS URL of this server (the `POST /` route) |
| `NAAMCHE_ASR_TOKEN` | the same string as `KRITI_AUTH_TOKEN`, if you set one |

Leave `RECOGNIZE_BACKEND` unset (or `cloudflare`) to keep using Whisper. The switch is in
[`site/api/recognize.mjs`](../../site/api/recognize.mjs); its tests cover both backends
(`site/test/recognize.test.mjs`).

## Check it before wiring the site

```bash
# a tiny silence clip just proves the shape; use a real Nepali clip to see words.
python - <<'PY'
import base64, json, urllib.request, wave, io
buf = io.BytesIO()
with wave.open(buf, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
    w.writeframes(b"\x00\x00" * 16000)   # 1 s of silence
body = json.dumps({"audio": base64.b64encode(buf.getvalue()).decode(), "seconds": 1.0, "language": "ne"}).encode()
req = urllib.request.Request("http://localhost:8000/", body, {"Content-Type": "application/json"})
print(urllib.request.urlopen(req).read().decode())
PY
```

If you get `501 … no word timestamps`, your NeMo build isn't exposing them: check the NeMo version
(recent releases return seconds directly) or set `KRITI_TIME_STRIDE` to your encoder's seconds/frame
(Conformer at 10 ms stride, 8x subsampling ≈ `0.08`). The extraction tolerates both seconds and
frame-offset formats; see `words_from_hypothesis` in [`server.py`](server.py).

## Honest caveats

- Kriti is **Nepali only** — it does not detect language the way Whisper does. Use it only for Nepali
  audio; keep the Cloudflare backend for anything else.
- The per-run cost shown on the page is Whisper's list price. On this backend the real cost is your
  own compute; treat that number as a placeholder, not a bill.
- Kriti's exact `transcribe()` signature can vary by release. `server.py` tries the common shapes; if
  your build differs, the fix is a few lines in `transcribe_with_timestamps`.
