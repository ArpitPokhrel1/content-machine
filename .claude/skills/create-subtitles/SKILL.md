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

## Rules

- Never change the script's words. Only split and time them.
- Preeti output can't show English letters. If the script mixes English into Nepali, say so and
  suggest Unicode.
- Timing is proportional to reading length, not speech recognition. For exact sync, the user
  nudges timings in the web editor.
- Save into `Outputs/<pack>/subtitles/` or `Outputs/subtitles/`, and return the full path.
