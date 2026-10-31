# Nepali audio -> SRT, in the browser, free, via Naamche Labs' Kriti on Hugging Face ZeroGPU.
#
# People upload an audio file; Kriti (an open Nepali ASR, a NeMo RNN-T model) transcribes it WITH
# timestamps, and we build an .srt they can download. Unlike the subtitle *aligner* on
# content.tarjun.com/subtitles (where a pasted script supplies the words and recognition only supplies
# timing), here the recognizer writes the words — so a Nepali-specialized model actually matters.
#
# ZeroGPU notes: the model is loaded at import on CPU (no CUDA at module scope), and moved to the GPU
# inside the @spaces.GPU call, which is the only place a GPU is attached on the free ZeroGPU tier.
import os
import tempfile

import gradio as gr
import spaces

MAX_SECONDS = 600            # 10 min cap: this is a free, public GPU — keep jobs bounded
TIME_STRIDE = float(os.environ.get("KRITI_TIME_STRIDE", "0.08"))   # fallback: seconds per frame
LANG = "ne"

# --- model (loaded once, on CPU, at import) ------------------------------------------------------
_model = None
_load_error = None
try:
    from kriti import load_model
    _model = load_model()
except Exception as e:                       # show the reason in the UI instead of a dead Space
    _load_error = f"{type(e).__name__}: {e}"


def nemo_model(kriti):
    """Reach the underlying NeMo model; Kriti holds it on `.model`."""
    inner = getattr(kriti, "model", None)
    if inner is not None and hasattr(inner, "transcribe"):
        return inner
    if hasattr(kriti, "transcribe"):
        return kriti
    raise RuntimeError("No NeMo model with transcribe() found inside Kriti.")


# --- timing + SRT helpers ------------------------------------------------------------------------
def _times(e):
    if e.get("start") is not None and e.get("end") is not None:
        return float(e["start"]), float(e["end"])
    if e.get("start_offset") is not None and e.get("end_offset") is not None:
        return float(e["start_offset"]) * TIME_STRIDE, float(e["end_offset"]) * TIME_STRIDE
    return None


def group_words(words, max_chars=42, max_dur=6.0, max_gap=0.7):
    """Fallback when the model gives word timings but no segment timings: pack words into cues."""
    segs, cur, start, last = [], [], None, None
    for s, e, w in words:
        if not cur:
            cur, start, last = [w], s, e
            continue
        joined = " ".join(cur)
        if len(joined) + 1 + len(w) > max_chars or (e - start) > max_dur or (s - last) > max_gap:
            segs.append((start, last, joined))
            cur, start, last = [w], s, e
        else:
            cur.append(w); last = e
    if cur:
        segs.append((start, last, " ".join(cur)))
    return segs


def segments_from_hyp(hyp):
    """[(start, end, text)] from a NeMo hypothesis: prefer segment timings, else group words."""
    ts = getattr(hyp, "timestamp", None)
    if not isinstance(ts, dict):
        return []
    segs = []
    for e in (ts.get("segment") or []):
        text = str(e.get("segment", e.get("text", ""))).strip()
        t = _times(e)
        if text and t and t[1] > t[0]:
            segs.append((t[0], t[1], text))
    if segs:
        return segs
    words = []
    for e in (ts.get("word") or ts.get("words") or []):
        w = str(e.get("word", e.get("char", ""))).strip()
        t = _times(e)
        if w and t and t[1] > t[0]:
            words.append((t[0], t[1], w))
    return group_words(words)


def fmt_ts(t):
    if t < 0:
        t = 0
    h = int(t // 3600); m = int((t % 3600) // 60); s = int(t % 60); ms = int(round((t - int(t)) * 1000))
    if ms == 1000:
        s += 1; ms = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_srt(segs):
    blocks = [f"{i}\n{fmt_ts(s)} --> {fmt_ts(e)}\n{text}" for i, (s, e, text) in enumerate(segs, 1)]
    return "\n\n".join(blocks) + "\n"


def to_wav16k(path):
    """Decode anything (mp3/m4a/wav/…) to 16 kHz mono wav; returns (path, seconds)."""
    import librosa
    import soundfile as sf
    y, _ = librosa.load(path, sr=16000, mono=True)
    out = os.path.join(tempfile.gettempdir(), "in16k.wav")
    sf.write(out, y, 16000, subtype="PCM_16")
    return out, len(y) / 16000.0


# --- inference -----------------------------------------------------------------------------------
@spaces.GPU(duration=120)
def transcribe(audio_path):
    if _load_error:
        raise gr.Error(f"The Kriti model failed to load on this Space: {_load_error}")
    if not audio_path:
        raise gr.Error("Upload a Nepali audio file first.")

    wav, seconds = to_wav16k(audio_path)
    if seconds > MAX_SECONDS:
        raise gr.Error(f"Audio is {seconds/60:.1f} min; this free tool caps at {MAX_SECONDS//60} min. Split it first.")

    nemo = nemo_model(_model)
    try:
        import torch
        if torch.cuda.is_available():
            nemo.to("cuda")
    except Exception:
        pass

    try:
        results = nemo.transcribe([wav], timestamps=True)
    except TypeError:
        results = nemo.transcribe([wav], timestamps=True, language_id=LANG)
    hyp = results[0] if isinstance(results, (list, tuple)) and results else results
    if isinstance(hyp, (list, tuple)) and hyp:
        hyp = hyp[0]

    segs = segments_from_hyp(hyp)
    if not segs:
        raise gr.Error("The model returned no timestamps, so an SRT can't be built. "
                       "Its NeMo build may not expose them (see KRITI_TIME_STRIDE).")

    srt = build_srt(segs)
    out = os.path.join(tempfile.gettempdir(), "subtitles.srt")
    with open(out, "w", encoding="utf-8") as f:
        f.write(srt)
    return srt, out


# --- UI ------------------------------------------------------------------------------------------
with gr.Blocks(title="Nepali Subtitles (Kriti)") as demo:
    gr.Markdown(
        "# नेपाली Subtitles — Kriti\n"
        "Upload Nepali audio and get an **.srt** subtitle file. Transcription by "
        "[Naamche Labs' Kriti](https://github.com/Naamche-Labs/kriti), an open Nepali speech model. "
        f"Max {MAX_SECONDS//60} minutes per file."
    )
    audio = gr.Audio(type="filepath", label="Nepali audio (mp3, m4a, wav…)")
    go = gr.Button("Transcribe → SRT", variant="primary")
    with gr.Row():
        srt_box = gr.Textbox(label="SRT preview", lines=16, show_copy_button=True)
        srt_file = gr.File(label="Download .srt")
    go.click(transcribe, inputs=audio, outputs=[srt_box, srt_file])
    gr.Markdown(
        "_The words come from the model, so proofread before use. Set the font in Premiere Pro or "
        "DaVinci Resolve after importing — an .srt can't carry one._"
    )

if __name__ == "__main__":
    demo.queue(max_size=20).launch()
