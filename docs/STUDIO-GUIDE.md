# Studio guide

For whoever runs Content Machine itself: setting up the studio's own laptops from GitHub, giving
people access, updating the website, and fixing things. Everyone else only needs the
[README](../README.md) and <https://content.tarjun.com>.

---

## What's in the repo

```text
Content Machine/
├── README.md                ← the plain-language guide
├── docs/STUDIO-GUIDE.md     ← you are here
├── CLAUDE.md, AGENTS.md     ← the rules the AI agents follow (Claude Code / Codex)
├── package.json             ← shortcuts: npm run setup | doctor | maps | srt | test
├── setup.ps1 / setup.sh     ← first-time setup on a studio laptop
│
├── asset-generation/        ← PART 1: images and video from a script
│   ├── MASTER-IMAGE-GENERATION.md, MASTER-VIDEO-GENERATION.md   ← the craft
│   ├── orchestrator_memory.md       ← every lesson learned the hard way (keep adding to it)
│   ├── mcp/                         ← the "content-machine" MCP server (drives all three parts)
│   ├── image-pack/, video/          ← tools
│   ├── .env                         ← THIS laptop's Google settings (never committed)
│   └── README.md                    ← every command and file format
├── map-animation/           ← PART 2: factual map animation (no AI, real map data)
├── subtitles/               ← PART 3: script → SRT/VTT, Unicode ⇄ Preeti, font catalogue
│
├── site/                    ← content.tarjun.com: / hub, /assets, /maps, /subtitles (Vercel)
├── .claude/, codex-skills/  ← skills and helper agents for Claude Code and Codex
├── knowledge/               ← Claude's saved memory about past projects
├── examples/                ← a finished project's recipe files
└── Outputs/                 ← finished images, videos, maps, subtitles (not in git)
```

**The only thing that changes between laptops is `asset-generation/.env`.** Everything else is identical.

---

## Setting up a studio laptop (from GitHub)

About 20 minutes, once per machine.

1. **Install the basics.** In PowerShell, one line at a time, then close and reopen PowerShell:

   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install Git.Git
   winget install Gyan.FFmpeg
   winget install Google.CloudSDK
   ```

   Mac: `brew install node git ffmpeg` plus the Google Cloud CLI. Also install Claude Code (or
   Codex).

2. **Get the repo:**

   ```powershell
   cd $HOME\Documents
   git clone https://github.com/ArpitPokhrel1/content-machine.git
   cd content-machine
   ```

3. **Run setup:**

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\setup.ps1
   ```

   It installs everything and signs you in with Google in the browser. It asks which Cloud
   project to use (or for a Gemini API key), switches on Vertex AI, and connects the
   `content-machine` MCP to Claude Code and Codex. Add `-Maps` for the map tool (about 500 MB).

4. **Check it:** `cd Tool` then `npm run doctor -- --online`. You want **All good.**

That's it. Open Claude Code anywhere and ask for an image pack.

---

## Access to content.tarjun.com (codes are OFF right now)

Anyone can install from <https://content.tarjun.com/assets>. Just send people the link. Each
person's generation is billed to their own Google Cloud project, never yours.

**To require access codes again later:**

1. In Vercel, open the project **content-machine**, then **Settings → Environment Variables**.
2. Add `REQUIRE_ACCESS_CODE` = `true` (Production and Preview).
3. Make a code for each person, and add it to `ACCESS_CODES` (comma-separated, keep the
   existing entries), e.g. `arpit:xxxx,ram:yyyy`:

   ```powershell
   cd site
   npm run new-code -- ram          # prints a code and a "ram:<code>" entry
   ```

4. Redeploy (Deployments → ⋯ → Redeploy, or push any commit).

The installers adapt on their own: they only ask for a code when the site requires one. To remove
someone, delete their entry and redeploy. Their installed copy keeps working, but they can't
download updates. To open access again, delete `REQUIRE_ACCESS_CODE` (or set it to `false`)
and redeploy.

---

## Keeping everything in sync

The website rebuilds itself every time you push to GitHub. The next time anyone re-runs the
install line, they get your newest prompts and lessons.

```powershell
git add -A
git commit -m "What changed"
git push
```

On another studio laptop, run `git pull`.

- **Finished images and videos don't travel through git** (they're gigabytes). Copy `Outputs/`
  yourself if you need old work.
- **Never put `asset-generation/.env` on GitHub.** It's blocked already. Don't work around the block.
- **After editing a Claude skill** in `.claude/skills/`, run `node asset-generation/scripts/sync-codex-skills.mjs` so Codex gets the
  same change.

### The website's pages

`site/public/`: `index.html` (hub), `assets.html`, `maps.html`, `subtitles.html` (the editor;
`subtitles.js` loads the engine the build copies from `subtitles/lib` into `public/sub/`). The
build (`site/scripts/build.mjs`) runs on Vercel at every push.

### Changing the showcase on the website

The images and clips on content.tarjun.com are real outputs, listed in
`site/media-selection.json` with the script line each one came from. To change them, edit that
file and run:

```powershell
node site/scripts/prepare-media.mjs
```

This makes small web copies in `site/public/media/` (clips, stills, walkthrough frames and map renders). Commit and push.

---

## Speed settings (in `asset-generation/.env`)

- `IMAGE_LOCATIONS=us-central1,us-east4,europe-west4`: Google limits images per minute *per
  region*, so listing three regions gives about three times the speed.
- `VIDEO_CONCURRENCY=3`: how many video clips are made at the same time, after the approved pilot
  clip passes.

---

## When something breaks

| You see | Do this |
| --- | --- |
| "No credentials configured" | Run setup again, or `npm run setup` inside `asset-generation/` |
| Login, permission, 401 or 403 errors | `gcloud auth application-default login`, then `npm run doctor -- --online` |
| `429 RESOURCE_EXHAUSTED` | Google's per-minute limit. Nothing was charged. Wait a minute and ask the agent to fill in the missing frames |
| The agent can't find the `content-machine` tools | Re-run setup, or `claude mcp add --scope user content-machine -- node "<repo>/asset-generation/mcp/server.mjs"` |
| "fetch failed" from `agent-video.mjs` | That older command route needs the local server. Run `npm start` in `asset-generation/` (the MCP route doesn't need it) |
| Black bars on images or videos | A known model habit. The fix is in `asset-generation/orchestrator_memory.md` |
| Modern things in a historical scene | Tell the agent. It tightens that place's "not this" list |
| `ffmpeg` not found | `winget install Gyan.FFmpeg`, then open a new terminal |

Still stuck? Run `npm run doctor` and paste the output to Claude Code.

---

## Going deeper

- `asset-generation/README.md`: every command, file format and MCP tool.
- `asset-generation/MASTER-IMAGE-GENERATION.md`, `asset-generation/MASTER-VIDEO-GENERATION.md`: the craft.
- `asset-generation/orchestrator_memory.md`: the lab notebook. Every new lesson goes here. It's how the
  machine gets smarter.
