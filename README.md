# Content Machine

You give it a script. It gives you a folder of images and video clips that look like they came
from the same film.

That's the whole idea. The script can be in Nepali, English or any other language: a history
explainer, a myth, an app launch, whatever. The machine reads it, works out who's in it and
where it happens, locks that look down, and then produces every frame in that same look.

This README is for anyone opening the repo cold, including you on a brand-new laptop. No coding
knowledge needed. If you can copy-paste a command, you're fine.

---

## How it actually works

Think of it as a small film crew that lives on your computer.

1. **The director reads the whole script first.** Not skimming, the whole thing. It translates it
   line by line, works out the story, and asks you every question it has in one go.
2. **It writes the "look book".** Every character gets a fixed description (face, clothes, one or
   two marks like a scar or a ring) and a fixed colour. Every place gets one too. Then the
   instruction "this is Kathmandu in the 1600s, and specifically *not* a Mughal court, not
   Tibet, not modern Nepal". This is called the **Canon**. It gets written once and never
   reworded, because to an AI model a reworded description is a different person.
3. **It photographs the cast.** One reference portrait per character, one empty shot per place.
   You can check these before anything else happens.
4. **It splits the script into small pieces.** Every 4 words of script becomes one image, grouped
   in chunks of 20 words (5 images). Each image still carries the full context: who, where, when,
   and what's at stake.
5. **Many helpers work at once.** The director hands chunks to several helper agents in parallel.
   They only write *what happens* in each frame. They're not allowed to touch the look book, and
   a script glues the same look book onto every single prompt. That's how you get speed without
   the characters drifting.
6. **Images get generated in parallel**, then the director looks at every single one, fixes the
   bad ones one change at a time, and moves the finished pack into `Outputs/`.
7. **Video is the expensive part, so it asks first.** It shows you exactly which clips, the
   prompts, how many seconds, and the cost. Nothing gets generated until you say yes. Then it
   makes one test clip, and if that looks right, it makes the rest at the same time.

There's also a third tool, the **Map Animation Studio**. It makes explainer-style animated maps
(borders, districts, migration arrows). It doesn't use AI at all. It draws real map data, because
a made-up border is a factual error.

---

## What's in the box

```text
Content Machine/
├── README.md              ← you are here
├── CLAUDE.md, AGENTS.md   ← the rules the AI agents follow (Claude Code / Codex)
├── setup.ps1 / setup.sh   ← run once on a new computer
├── Tool/                  ← the machine itself
│   ├── MASTER-IMAGE-GENERATION.md   ← how to write great image prompts (the brains)
│   ├── MASTER-VIDEO-GENERATION.md   ← how to direct great video clips
│   ├── orchestrator_memory.md       ← every lesson learned the hard way, and still growing
│   ├── .env                         ← YOUR settings for this laptop (created by setup)
│   ├── image-pack/                  ← image tools
│   ├── map-animation-studio/        ← the map tool
│   └── archive/                     ← older, longer versions of the guides
├── .claude/               ← skills and helper agents for Claude Code
├── codex-skills/          ← the same skills for Codex
├── knowledge/             ← Claude's saved memory about past projects
├── examples/              ← a finished project's recipe files, to copy from
└── Outputs/               ← finished images and videos (stays on each computer, not in git)
```

Here's the key point. **The only thing that changes between laptops is `Tool/.env`**, which holds
your Google login details and project name. Everything else is identical everywhere.

---

## Setting up a new computer

Budget about 20 minutes. You only do this once per machine.

### 1. Install the basics

On Windows, open **PowerShell** and paste these one at a time:

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Gyan.FFmpeg
winget install Google.CloudSDK
```

Then **close PowerShell and open a new one**, so it picks up what you just installed.

On a Mac, the equivalent is `brew install node git ffmpeg` plus the Google Cloud CLI from
<https://cloud.google.com/sdk>.

You'll also want **Claude Code** (or Codex) installed, since that's what you actually talk to.

### 2. Get the repo

```powershell
cd $HOME\Documents
git clone https://github.com/ArpitPokhrel1/content-machine.git
cd content-machine
```

### 3. Decide how you'll pay Google

The machine uses Google's models (Gemini for images, Veo for video). You need **one** of these:

- **Option A: a Google Cloud project (what the studio uses).** In the Google Cloud Console, pick
  or create a project, turn on billing, and enable the **Vertex AI API**. Write down the
  **project ID** (e.g. `my-studio-12345`). Optionally create a **Cloud Storage bucket** for
  video output; if you skip it, videos download directly instead.
- **Option B: a Gemini API key.** Simpler. Get one at <https://aistudio.google.com/apikey>. Good
  for a second laptop or a teammate.

### 4. Run setup

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

(That long first part just lets Windows run a script you downloaded. Mac: `./setup.sh`.) It installs everything, asks for your project ID or API key, and writes
`Tool/.env` for you. Add `-Maps` (Mac: `--maps`) if you want the map tool too. That's an extra
~500 MB.

If you chose Option A, log in to Google once:

```powershell
gcloud auth application-default login
```

### 5. Check it's all working

```powershell
cd Tool
npm run doctor -- --online
```

You want to see **All good.** If not, each ✘ line tells you exactly what to fix. The online check
is free. It doesn't generate anything.

### 6. Start it

```powershell
npm start
```

Leave that window open. The machine now runs at <http://127.0.0.1:4317> (there's a simple web
page there too). Open Claude Code in the repo folder, and you're in business.

---

## Using it day to day

You don't run commands yourself. You talk to Claude Code, opened in this folder, like you'd
brief a production assistant:

- *"Here's the script for the Dullu episode. Make me a 9:16 image pack."*
- *"Make video clips from frames c03 and c07 of the Sati pack, silent, 6 seconds each."*
- *"Animate a map zooming from Nepal into Dailekh district."*

What happens next:

- **Images:** it asks its questions in one batch, then just gets on with it. It doesn't need your
  permission to generate images. (Want to check the characters first? Say so, and it'll stop
  after the cast photos.)
- **Video:** it always stops and shows you the plan and the cost. It won't spend money on video
  until you clearly say yes.
- **Maps:** it asks the whole map questionnaire at once, shows you a preview, and only renders
  after you approve.
- Finished work lands in `Outputs/<project-name>/`.

---

## The rules that keep you safe (and solvent)

These are baked into the agents, so you don't have to police them. But you should know they
exist:

- **No paid video without your explicit yes.** Approving the images doesn't count, and neither
  does approving the plan.
- **No automatic retries.** If something fails, it tells you why and asks. It never quietly
  spends money trying again.
- **No text inside images.** No captions, signs or numbers. Text gets added in editing, where
  it's spelled right and can be translated.
- **No invented history.** It won't add dates, names or events the script doesn't say.
- **Maps use real data only** (Natural Earth, geoBoundaries), and disputed borders are shown as
  dashed lines rather than picking a side.

---

## Sharing it with other people (content.tarjun.com)

Teammates and clients don't need GitHub access. Send them to **<https://content.tarjun.com>**.
They paste one install line, type the access code you gave them, sign in with **their own**
Google account, and pick **their own** Cloud project. From then on:

- The machine runs on **their** computer, as an MCP server called `content-machine` that the
  installer connects to their Claude Code or Codex.
- Google bills **their** project, not yours.
- Every image and video is saved on **their** disk, in `ContentMachine/Outputs`.

**Giving someone access:**

```powershell
cd site
npm run new-code -- ram          # prints a code, plus the "ram:<code>" entry
```

Add that entry to the `ACCESS_CODES` variable in the Vercel project `content-machine`
(Settings → Environment Variables, comma-separated), then redeploy. To take access away, delete
their entry and redeploy. People who already installed keep their copy, but can't download
updates.

The website rebuilds itself whenever you `git push`, so the next time anyone re-runs the install
line, they get your latest prompts and lessons.

---

## What it costs

Maps are free: everything runs on your computer. Images and video are billed by Google to
whichever project or API key is in `Tool/.env`. Images cost a few cents each. Video costs a lot
more per second, which is exactly why the agent quotes the clip count, seconds and estimated
cost and waits for your yes. A `429` error means Google said "slow down". Nothing was made, so
nothing was charged.

---

## Why it's fast

Old way: one image, wait, next image, wait. One video, wait a few minutes, next video.

Now:

- **Several helper agents write frames at the same time**, each on its own chunk of the script.
- **Images generate in parallel batches.** Google limits how many images you can make per minute
  *per region*. List several regions in `Tool/.env` (`IMAGE_LOCATIONS=us-central1,us-east4,europe-west4`)
  and you get that many times the speed.
- **Videos generate side by side** (3 at a time by default, `VIDEO_CONCURRENCY` in `.env`), after
  one test clip proves the prompts work.

And the consistency doesn't suffer, because the look book is decided once, by one agent, before
any of the parallel work starts.

---

## Moving to another laptop

1. Do the setup steps above on the new machine. That's it for the tool.
2. **Finished images and videos don't travel through git** (they're gigabytes). Copy the
   `Outputs/` folder yourself if you need old work, with a USB drive, Google Drive, whatever.
3. When the tool improves on one laptop (new lessons, better prompts), save it to GitHub:

   ```powershell
   git add -A
   git commit -m "What changed"
   git push
   ```

   and on the other laptop: `git pull`.

Never put `Tool/.env` on GitHub. It's already blocked, but don't go around the block.

---

## When something breaks

| You see | Do this |
| --- | --- |
| "No credentials configured" | Run `npm run setup` inside `Tool/` |
| Anything about login, permission, 401/403 | `gcloud auth application-default login`, then `npm run doctor -- --online` |
| `429 RESOURCE_EXHAUSTED` | Google's per-minute limit. Nothing was charged. Wait a minute and ask it to fill in the missing frames |
| "fetch failed" from the agent | The server isn't running. `npm start` in `Tool/` |
| Images come back with black bars | Known model habit. The agent knows the fix (see `orchestrator_memory.md`) |
| Images show modern stuff in a historical scene | Tell the agent. It'll tighten that place's "not this" list |
| `ffmpeg` not found | `winget install Gyan.FFmpeg`, then open a new terminal |

Still stuck? Run `npm run doctor` and paste its output to Claude Code. It'll know what to do.

---

## A few words you'll hear

- **Canon:** the fixed description of every character and place, pasted word-for-word into
  every prompt.
- **Culture anchor:** the "specifically this place and time, and NOT these look-alikes" sentence.
  Most of the fixes in the lesson log come back to it: it's what keeps images looking
  authentically Nepali instead of generic.
- **Chunk / frame:** 20 words of script = 1 chunk = 5 frames of 4 words each.
- **Keyframe:** an image used as the first (or last) frame of a video clip.
- **Pilot clip:** the one test video made before the rest.
- **Grade:** the colour and film look shared by every frame.

---

## Going deeper

- `Tool/README.md` is the technical walkthrough: every command and file format.
- `Tool/MASTER-IMAGE-GENERATION.md` and `Tool/MASTER-VIDEO-GENERATION.md` hold the craft.
  Read them once and you'll understand every decision the agent makes.
- `Tool/orchestrator_memory.md` is the lab notebook. When something goes wrong in a new way,
  make sure the lesson ends up here. That file is how this machine gets smarter.
