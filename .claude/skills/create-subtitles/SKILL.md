---
name: create-subtitles
description: Turn a script (Nepali or English) into an SRT or VTT subtitle file timed to the audio/video length, in Unicode or Preeti encoding, ready to import into Premiere Pro or DaVinci Resolve. Use when the user asks for subtitles, captions, an SRT, or script-to-subtitle timing.
---

# Create Subtitles

All paths are relative to the repo root. The engine is in `subtitles/`; the guide is
`subtitles/README.md`.

## Workflow

1. Get the **script** (or a pack name, whose `script.txt` is used) and the **total length**:
   ask for the audio/video file path (the length is read with ffprobe), or the length in seconds
   or m:ss.
2. Ask, in one message, anything that's unclear:
   - **Font family in the editor.** A Unicode font (Mukta, Kalimati…) means `unicode`; a
     Preeti-encoded font (Preeti, Ganess, Aakriti, Kanchan…, the 77 listed on anepali.com) means `preeti`.
     Kantipur, Sagarmatha and Fontasy Himali use slightly different encodings: prefer Unicode for them.
   - **Lines per subtitle** (1 or 2, default 2) and **line width** (default 42; use about 32 for
     9:16 vertical video).
   - **SRT** (default) or **VTT**.
3. Make it with the `make_subtitles` MCP tool, or with:
   `node subtitles/cli.mjs <script.txt> --media <file> --encoding unicode -o <out.srt>`
4. Show the first few subtitles and the file path. Mention that the font is chosen inside
   Premiere or Resolve, and point to <https://content.tarjun.com/subtitles> for fine-tuning
   timings with a live preview.

## Optional: ASR-aligned Nepali subtitles

For Nepali scripts with a real recording, an alternative workflow anchors the script to actual
recognized speech instead of proportional timing. Only offer it, and only run it after the user
explicitly authorizes sending the recording to Cloudflare — never infer that approval from a
request for subtitles alone.

- Estimate cost first (no upload): `recognize_subtitles` with `submit_to_cloudflare` left unset,
  or `npm run srt:audio -- recognize --audio <file> --script <file>`.
- Only after the user approves the estimate, submit: `recognize_subtitles` with
  `submit_to_cloudflare: true`, or add `--submit`.
- Needs uv, Python 3.11+ and Cloudflare credentials in `asset-generation/.env` or the environment
  (`npm run doctor` if missing). See `subtitles/docs/audio-recognition.md`.
- Still never changes script words; it only times them more precisely. Output includes a
  `.review.json` for the web editor at content.tarjun.com/subtitles (defaults to 9:16 portrait,
  Unicode).

## Rules

- Never change the script's words. Only split and time them.
- Preeti output can't show English letters. If the script mixes English into Nepali, say so and
  suggest Unicode.
- Timing is proportional to reading length by default. When a real audio/video file is given
  (`media_path` / `--media`), the tool also detects its actual pauses (ffmpeg `silencedetect`,
  local, free, no speech recognition) and snaps nearby subtitle breaks onto them — this happens
  automatically, no approval needed, same as the rest of subtitle generation. Report how many
  breaks matched a real pause (the tool returns `pause_alignment`) so the user can see how much of
  the timing came from the audio itself vs. an estimate. For exact sync beyond that, the user
  nudges timings in the web editor.
- Save into `Outputs/<pack>/subtitles/` or `Outputs/subtitles/`, and return the full path.
