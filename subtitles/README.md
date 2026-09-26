# Subtitles: script to SRT

Paste a script, give the length of the audio or video, and get a subtitle file you can drop
straight into **Premiere Pro** or **DaVinci Resolve**. It works for Nepali and English.

**Easiest:** use the editor at **<https://content.tarjun.com/subtitles>**. It's free, it runs in
your browser, and nothing is uploaded.

## What it does

1. **Splits the script into subtitles** at sentence ends (। ? ! .). Long sentences are shared
   evenly across subtitles, and each line stays under your line width (42 characters by default).
2. **Times them to your audio/video length.** Longer lines stay on screen longer, and there's a
   small pause after each sentence. You can load the audio or video file itself so the length is
   exact, or type the length.
3. **Lets you fix anything:** edit the text, drag timings, split and merge subtitles, and preview
   everything on your own video with the chosen font.
4. **Exports** `.srt` (Premiere Pro, DaVinci Resolve, YouTube) or `.vtt` (web).

## Unicode or Preeti?

A subtitle file can't carry a font. You choose the font inside Premiere or Resolve after
importing. What the file *can* carry is the right kind of text for that font:

| Your font | Export as | Examples |
| --- | --- | --- |
| A **Unicode** Nepali font | **Unicode** | Mukta, Kalimati, Noto Sans Devanagari, Hind, Yatra One, Mangal, Nirmala UI |
| A **Preeti-type** font | **Preeti** | Preeti, Ganess, Aakriti, Kanchan, Himalli, Bhaktapur… (the 77 Preeti-encoded fonts on anepali.com) |

Preeti text looks like random English letters (`g]kfn`) until the Preeti font is applied, and
then it reads नेपाल. That's normal.

Kantipur, Sagarmatha and Fontasy Himali look like Preeti fonts but use slightly different
encodings, so a few letters can come out wrong. Use Unicode with them, or check the result.

The editor lists the 58 Unicode and 77 Preeti-type fonts from anepali.com, the Nepali fonts built
into Windows, and 35 widely used English fonts. Turn on the ones you use, and preview them live.
Google Fonts preview for everyone. Preeti-type fonts preview when they're installed on your
computer (download them from anepali.com).

## Importing

- **Premiere Pro:** File › Import the `.srt`, drag it onto the timeline, choose the captions
  track, then set the font in Essential Graphics (or the Properties panel).
- **DaVinci Resolve:** File › Import › Subtitle, drag it onto the timeline, then Inspector ›
  Track › Style › Font.

Both read the files as UTF-8.

## From the command line (and for AI agents)

```powershell
node subtitles/cli.mjs script.txt --duration 1:35.2 -o episode.srt
node subtitles/cli.mjs script.txt --media voiceover.mp3 --encoding preeti -o episode-preeti.srt
node subtitles/cli.mjs --from old.srt --duration 95 -o retimed.srt
```

Options: `--encoding unicode|preeti`, `--input-encoding preeti` (the script itself is typed in
Preeti), `--format srt|vtt`, `--max-chars 42`, `--lines 1|2`, `--start 0`.

Agents use the `make_subtitles` tool of the `content-machine` MCP, which does the same and saves
into `Outputs/`.

## Files

- `lib/subtitles.mjs`: splitting, timing, SRT/VTT read and write (runs in Node and the browser)
- `lib/preeti.mjs`: Unicode ⇄ Preeti conversion
- `fonts.json`: the font catalogue shown by the editor
- `cli.mjs`: the command-line tool
- `test/`: `node --test` (includes a round trip of every Nepali word in the studio's scripts)
