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
├── setup.ps1 / setup.sh     ← first-time setup on a studio laptop
├── Tool/                    ← the machine itself
│   ├── MASTER-IMAGE-GENERATION.md   ← how to write great image prompts
│   ├── MASTER-VIDEO-GENERATION.md   ← how to direct great video clips
│   ├── orchestrator_memory.md       ← every lesson learned the hard way (keep adding to it)
│   ├── mcp/                         ← the "content-machine" MCP server the agents connect to
│   ├── image-pack/                  ← image tools
│   ├── map-animation-studio/        ← the map tool (no AI, real map data)
│   ├── .env                         ← THIS laptop's Google settings (never committed)
│   └── README.md                    ← every command and file format
├── site/                    ← the website content.tarjun.com (Vercel)
├── .claude/, codex-skills/  ← skills and helper agents for Claude Code and Codex
├── knowledge/               ← Claude's saved memory about past projects
├── examples/                ← a finished project's recipe files
└── Outputs/                 ← finished images and videos (stays on each laptop, not in git)
```

**The only thing that changes between laptops is `Tool/.env`.** Everything else is identical.

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

## Giving someone access to content.tarjun.com

```powershell
cd site
npm run new-code -- ram          # prints a code and a "ram:<code>" entry
```

1. In Vercel, open the project **content-machine**, then **Settings → Environment Variables**.
2. Add the entry to `ACCESS_CODES`, comma-separated: `arpit:xxxx,ram:yyyy`.
3. Redeploy (or just push any commit).
4. Send them the code and the link <https://content.tarjun.com>.

To remove someone, delete their entry and redeploy. Their installed copy keeps working, but they
can't download updates.

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
- **Never put `Tool/.env` on GitHub.** It's blocked already. Don't work around the block.
- **After editing a Claude skill** in `.claude/skills/`, run `node Tool/scripts/sync-codex-skills.mjs` so Codex gets the
  same change.

### Changing the showcase on the website

The images and clips on content.tarjun.com are real outputs, listed in
`site/media-selection.json` with the script line each one came from. To change them, edit that
file and run:

```powershell
node site/scripts/prepare-media.mjs
```

This makes small web copies in `site/public/media/`. Commit and push.

---

## Speed settings (in `Tool/.env`)

- `IMAGE_LOCATIONS=us-central1,us-east4,europe-west4`: Google limits images per minute *per
  region*, so listing three regions gives about three times the speed.
- `VIDEO_CONCURRENCY=3`: how many video clips are made at the same time, after the approved pilot
  clip passes.

---

## When something breaks

| You see | Do this |
| --- | --- |
| "No credentials configured" | Run setup again, or `npm run setup` inside `Tool/` |
| Login, permission, 401 or 403 errors | `gcloud auth application-default login`, then `npm run doctor -- --online` |
| `429 RESOURCE_EXHAUSTED` | Google's per-minute limit. Nothing was charged. Wait a minute and ask the agent to fill in the missing frames |
| The agent can't find the `content-machine` tools | Re-run setup, or `claude mcp add --scope user content-machine -- node "<repo>/Tool/mcp/server.mjs"` |
| "fetch failed" from `agent-video.mjs` | That older command route needs the local server. Run `npm start` in `Tool/` (the MCP route doesn't need it) |
| Black bars on images or videos | A known model habit. The fix is in `Tool/orchestrator_memory.md` |
| Modern things in a historical scene | Tell the agent. It tightens that place's "not this" list |
| `ffmpeg` not found | `winget install Gyan.FFmpeg`, then open a new terminal |

Still stuck? Run `npm run doctor` and paste the output to Claude Code.

---

## Going deeper

- `Tool/README.md`: every command, file format and MCP tool.
- `Tool/MASTER-IMAGE-GENERATION.md`, `Tool/MASTER-VIDEO-GENERATION.md`: the craft.
- `Tool/orchestrator_memory.md`: the lab notebook. Every new lesson goes here. It's how the
  machine gets smarter.
