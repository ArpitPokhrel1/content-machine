# Self-hosted Nepali ASR endpoint for Content Machine's voice-aligned subtitles.
#
# Why this exists: content.tarjun.com/subtitles matches your script onto recognized speech, and that
# needs *word-level timestamps*. Naamche Labs' Kriti is open weights but its `kriti.transcribe()`
# returns text only — it throws the timings away. Kriti wraps a NeMo RNN-T model, and NeMo *can*
# emit word timestamps, so this server loads Kriti, reaches the NeMo model underneath, and asks for
# timestamps. It speaks exactly the contract site/api/recognize.mjs expects.
#
# Contract
#   POST /            Authorization: Bearer <KRITI_AUTH_TOKEN>   (only if that env var is set)
#   body:  { "audio": "<base64 16 kHz mono wav>", "seconds": <float>, "language": "ne" }
#   200:   { "text": "<transcript>", "words": [ { "word": "...", "start": 0.12, "end": 0.63 }, ... ] }
#          start/end are seconds within this piece of audio; the browser adds the piece's offset.
#   4xx/5xx: { "detail": "<reason>" }   (no retry anywhere; a failed call still cost compute)
#
# GET /health → { "status": "ok", "model_loaded": true|false }   for your platform's probes.
#
# Run:  pip install -r requirements.txt && uvicorn server:app --host 0.0.0.0 --port 8000
# Then on Vercel set: RECOGNIZE_BACKEND=naamche, NAAMCHE_ASR_URL=<this url>, NAAMCHE_ASR_TOKEN=<token>.
import base64
import binascii
import io
import os
import tempfile
import wave

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

MAX_SECONDS = 30.0
MAX_AUDIO_BYTES = 2_000_000          # mirrors the site's per-piece cap
AUTH_TOKEN = os.environ.get("KRITI_AUTH_TOKEN", "").strip()
# NeMo gives word timings in seconds on recent versions. On older ones only frame offsets are
# present; multiply by the acoustic time stride (window_stride * encoder subsampling). A Conformer
# at 10 ms window stride and 8x subsampling is 0.08 s/frame — override if your checkpoint differs.
TIME_STRIDE = float(os.environ.get("KRITI_TIME_STRIDE", "0.08"))

app = FastAPI(title="Content Machine — Kriti ASR", version="1.0")
_model = None   # the Kriti wrapper; its .model is the NeMo RNN-T model


def get_model():
    """Load Kriti once and keep it warm. Raises if the package or weights are missing."""
    global _model
    if _model is None:
        from kriti import load_model   # imported lazily so /health works before weights download
        _model = load_model()
    return _model


def nemo_model(kriti):
    """Reach the underlying NeMo model. Kriti holds it on `.model`; fall back by duck-typing."""
    inner = getattr(kriti, "model", None)
    if inner is not None and hasattr(inner, "transcribe"):
        return inner
    if hasattr(kriti, "transcribe"):
        return kriti
    raise HTTPException(status_code=500, detail="Could not find a NeMo model with transcribe() inside Kriti.")


def words_from_hypothesis(hyp):
    """Pull [{word,start,end}] out of a NeMo hypothesis across NeMo versions.

    Recent NeMo: hyp.timestamp == {'word': [{'word','start','end','start_offset','end_offset'}, ...]}.
    Older NeMo: offsets only, so convert with TIME_STRIDE. Returns [] if no word timing is present —
    the caller turns that into a clear 501 instead of silently guessing times.
    """
    ts = getattr(hyp, "timestamp", None)
    if not isinstance(ts, dict):
        return []
    entries = ts.get("word") or ts.get("words") or []
    out = []
    for e in entries:
        text = str(e.get("word", e.get("char", ""))).strip()
        if not text:
            continue
        if e.get("start") is not None and e.get("end") is not None:
            start, end = float(e["start"]), float(e["end"])
        elif e.get("start_offset") is not None and e.get("end_offset") is not None:
            start, end = float(e["start_offset"]) * TIME_STRIDE, float(e["end_offset"]) * TIME_STRIDE
        else:
            continue
        if end > start >= 0:
            out.append({"word": text, "start": round(start, 3), "end": round(end, 3)})
    return out


def transcribe_with_timestamps(nemo, wav_path):
    """Call NeMo asking for word timestamps, tolerant of signature differences between versions."""
    try:
        results = nemo.transcribe([wav_path], timestamps=True)
    except TypeError:
        # IndicConformer forks sometimes want language_id and/or lack the timestamps kwarg name.
        results = nemo.transcribe([wav_path], timestamps=True, language_id="ne")
    hyp = results[0] if isinstance(results, (list, tuple)) and results else results
    # NeMo may return (best, all) tuples; take the best hypothesis.
    if isinstance(hyp, (list, tuple)) and hyp:
        hyp = hyp[0]
    text = getattr(hyp, "text", hyp if isinstance(hyp, str) else "")
    return str(text), words_from_hypothesis(hyp)


class RecognizeRequest(BaseModel):
    audio: str
    seconds: float | None = None
    language: str | None = "ne"


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/")
def recognize(req: RecognizeRequest, authorization: str | None = Header(default=None)):
    if AUTH_TOKEN:
        if authorization != f"Bearer {AUTH_TOKEN}":
            raise HTTPException(status_code=403, detail="Bad or missing bearer token.")

    if req.seconds is not None and not (0 < req.seconds <= MAX_SECONDS):
        raise HTTPException(status_code=400, detail=f"seconds must be between 0 and {MAX_SECONDS}.")
    try:
        raw = base64.b64decode(req.audio, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="audio must be base64.")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="That piece of audio is too long.")
    # Reject anything that isn't a readable WAV before touching the GPU.
    try:
        with wave.open(io.BytesIO(raw)) as w:
            if w.getnchannels() != 1:
                raise HTTPException(status_code=400, detail="Send mono audio.")
    except wave.Error:
        raise HTTPException(status_code=400, detail="audio must be a WAV file.")

    nemo = nemo_model(get_model())
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(raw)
        wav_path = tmp.name
    try:
        text, words = transcribe_with_timestamps(nemo, wav_path)
    finally:
        try:
            os.unlink(wav_path)
        except OSError:
            pass

    if not words:
        # The whole point is word timing; if this NeMo build won't emit it, say so loudly rather
        # than return text the aligner can't place. Check your NeMo version or KRITI_TIME_STRIDE.
        raise HTTPException(status_code=501, detail="This model build returned no word timestamps. The subtitle aligner needs them.")
    return {"text": text, "words": words}
