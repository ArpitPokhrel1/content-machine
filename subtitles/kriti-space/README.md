---
title: Nepali Subtitles (Kriti)
emoji: 🇳🇵
colorFrom: indigo
colorTo: green
sdk: gradio
sdk_version: 4.44.1
app_file: app.py
pinned: false
short_description: Upload Nepali audio, get an SRT (Kriti ASR)
---

# Nepali Subtitles (Kriti)

Upload Nepali audio → get an `.srt`. Transcription by [Naamche Labs' Kriti](https://github.com/Naamche-Labs/kriti)
(an open Nepali speech model), running free on Hugging Face **ZeroGPU**.

This is a **public transcription** tool: the model writes the words. That's different from the
subtitle *aligner* at `content.tarjun.com/subtitles`, where you paste a script and recognition only
supplies timing. Here a Nepali-specialized recognizer matters, because its text is the subtitle.

## Deploy (free)

1. [huggingface.co/new-space](https://huggingface.co/new-space) → **SDK: Gradio**, blank template.
2. **Hardware: ZeroGPU** (free for personal accounts; up to 2 such Spaces).
3. **Visibility: Public.** Create it.
4. Add `app.py`, `requirements.txt`, `packages.txt`, and this `README.md` (overwrite the generated
   README — ours has the config header). Commit to `main`.
5. Watch the build/runtime **Logs**. The first build is slow (PyTorch + NeMo). If it fails, the
   likely spot is the `kriti` line in `requirements.txt` (torch version clash on the ZeroGPU image) —
   paste the log and it's a one-line fix.

The app is then at `https://<user>-<space>.hf.space`, embeddable in `content.tarjun.com` via an iframe.

## Notes

- **Nepali only** — Kriti doesn't detect language.
- Files are capped at **10 minutes** (`MAX_SECONDS` in `app.py`) since it's free public GPU.
- Output is **Unicode** Devanagari SRT. Set the font in Premiere/Resolve after import.
- The sibling [`../kriti-server/`](../kriti-server/README.md) is the *other* use of Kriti — a JSON
  backend for the script-alignment timing path — not this transcription UI.
- Architecture: [`../docs/architecture.md`](../docs/architecture.md).
