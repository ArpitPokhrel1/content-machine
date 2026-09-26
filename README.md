# Content Machine

**Give it a story. Get back everything your video needs.**

You write, or paste, a script: a history story, a myth, a festival explainer, an ad. It can be
in Nepali, English or any other language. Content Machine has three parts:

| | What you get | What you need |
| --- | --- | --- |
| **1. Assets** | Pictures and short videos for the story. Every character keeps the same face and clothes from the first picture to the last. | The install (below) |
| **2. Maps** | Animated map shots (a district lighting up, a zoom from the globe to a village), drawn from real map data. | The install (below) |
| **3. Subtitles** | A subtitle file for **Premiere Pro** or **DaVinci Resolve**, timed to your audio or video, in Unicode or Preeti. | **Nothing.** Free, in your browser: <https://content.tarjun.com/subtitles> |

See it all at **<https://content.tarjun.com>**. Every picture, video and map there was made by
Content Machine.

---

## Subtitles: no install needed

1. Open **<https://content.tarjun.com/subtitles>**.
2. Paste your script, and load your voice-over or video (so it knows the length), or just type
   the length, like `1:35`.
3. Press **Make subtitles**. Check them over the video, and fix any text or timing.
4. Choose **Unicode** (for fonts like Mukta, Kalimati, Noto) or **Preeti** (for Preeti, Kantipur,
   Himalb…) and pick your font.
5. Press **Export for Premiere Pro** or **Export for DaVinci Resolve**. Import the file there, and
   set the same font.

Your script and video never leave your computer.

---

## Assets and maps: what you need

1. **An access code.** Ask the studio for one.
2. **A Google account with a Google Cloud project that has billing turned on.** Google does the
   actual drawing, and bills you directly for it. Create a project at
   <https://console.cloud.google.com/projectcreate>.
3. **An AI assistant on your computer:** [Claude Code](https://claude.com/claude-code) is
   recommended, or Codex. This is what you'll talk to.

A Windows PC or a Mac is fine. You don't need to know how to code.

---

## Getting started (about 10 minutes, once)

1. Go to **<https://content.tarjun.com/assets>** and copy the install line for your computer (it's at the bottom).
2. **Windows:** open **PowerShell** (press the Start button, type *PowerShell*, press Enter).
   **Mac:** open **Terminal**.
3. Paste the line and press Enter. Then follow along:
   - Type your **access code** when it asks.
   - Your browser opens. **Sign in with Google** and click *Allow*.
   - Pick your **Cloud project** from the list it shows.
   - It asks whether to also install the **map** part. Say **y** if you want maps.
4. Done. It connects itself to your AI assistant.

> On Windows it installs a few helper programs it needs. If it asks you to open a new window and
> run the line again, just do that. It picks up where it left off.

---

## Using it

Open Claude Code and ask for what you want, in plain words:

- *"Use content-machine to make a vertical image pack from this script: …"*
- *"Make the pictures for chunk 3 again, the king's turban looks wrong."*
- *"Turn pictures c03 and c07 into 6-second videos, no sound."*

What happens next:

1. **It reads the whole script first**, then asks all its questions in one go: the shape of the
   pictures, how to show sensitive moments, and so on.
2. **It meets the cast.** It makes one portrait of each character and one picture of each place,
   so every later picture matches them. Want to check those first? Just say so.
3. **It makes the pictures.** Every four words of your script become one picture. Several are
   made at the same time, so it's quick.
4. **It checks every picture itself** and redoes the ones that went wrong.
5. **Videos always ask first.** Before making any video, it shows you exactly which clips, how
   long they are and roughly what they'll cost, and waits for your *yes*.

Everything is saved on **your own computer**, in the **ContentMachine › Outputs** folder in your
home folder. One folder per project.

---

## Good to know

- **It's yours.** It runs on your computer, uses your Google account, and saves to your disk.
  Nothing you make is stored anywhere else.
- **Cost.** Pictures cost a few cents each. Video costs more, which is why it always shows you
  the cost and waits for your yes. Google bills you directly.
- **No words inside pictures.** Pictures never contain writing, signs or numbers. Add titles
  later in your video editor, where they're easy to fix and translate.
- **No made-up history.** It won't add people, dates or events that aren't in your script.
- **Maps too.** Ask for an animated map (districts, borders, routes) and it draws one from real
  map data, never guessed.

---

## Updating

Run the same install line from <https://content.tarjun.com> again. You get the newest version,
and your settings and your Outputs folder stay exactly as they were.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| "Invalid access code" | Check the code. Capital letters matter. |
| It says you're not signed in to Google | Run the install line again and sign in when the browser opens. |
| "429" or "resource exhausted" | Google is asking you to slow down. Nothing was charged. Wait a minute and ask again. |
| Your assistant doesn't know "content-machine" | Close and reopen Claude Code. If that doesn't help, run the install line again. |
| Something else | In PowerShell or Terminal, type `cd ~/ContentMachine` then `npm run doctor`, and paste what it prints to Claude Code. It'll tell you what to fix. |

---

## A few words you'll see

- **Pack:** one project's folder of pictures (and videos).
- **Chunk:** 20 words of your script. Each chunk becomes five pictures.
- **Frame:** one picture. `c03-2` means chunk 3, picture 2.
- **Canon:** the fixed description of each character and place, reused for every picture so
  nobody changes face halfway through.
- **Pilot clip:** the one test video it makes first, before making the rest.

---

*Running the studio, setting up from GitHub, or giving people access codes? See the
[Studio guide](docs/STUDIO-GUIDE.md). Every command and file format is in
[asset-generation/README.md](asset-generation/README.md).*
