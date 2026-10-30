# Content Machine Studio

A **local cockpit** over the Content Machine engine — one place to browse everything you've made,
launch new generations, manage voice, and see the MCP/API wiring. It drives the existing pipelines
(`asset-generation/`, `map-animation/`, `subtitles/`); it does not replace them.

It is the companion to the marketing site at [content.tarjun.com](https://content.tarjun.com):
same brand, but this runs on **your** machine and reads **your** `Outputs/`.

## Run it

```bash
node studio/server.mjs
```

Then open **http://127.0.0.1:4178**. Zero dependencies — plain Node (built-in `http`). It binds to
`127.0.0.1` only (not reachable from the network). Set `PORT=5000 node studio/server.mjs` to change
the port; if 4178 is busy it falls back to a free one.

## What's inside

| Tab | What it does |
| --- | --- |
| **Library** | Scans every folder in `Outputs/`, builds cards with a poster, counts, brand (Bamsawali / Biopunki / Other) and type (images / video / map). Search + filter. Click a card to see all images (click to zoom), play videos, read `story.md` / `prompt-pack.md` / `shot-list.md`, and open the folder in Explorer. |
| **Create** | Paste a script, pick pipeline + aspect + language + a **style/motion preset**, and it composes the **exact** Claude Code prompt (and CLI line) to run it. Subtitles build right here into a downloadable `.srt`. |
| **Styles** | A prompt-preset library — 17 visual styles (Mythic Epic, Paubha/Thangka, Kathmandu Noir, UGC iPhone, …), 8 camera-motion presets, and hook/caption/CTA templates. Each has a copy-paste prompt template. Seeded from the research report; edit `studio/data/style-presets.json` to add your own. |
| **Voice** | Three provider slots — **Swar** (Naamche, NE/EN voice clone), **Kriti** (Naamche, NE speech-to-text), and a **TTS** slot for Hindi/English. Shows how to connect each and saves the config locally. *Nothing is wired to a paid service yet* — the slots are ready for later. |
| **Subtitles** | The existing free in-browser subtitle editor, embedded and fully local. |
| **MCP & APIs** | Live engine health (Cloud project, models, bucket), the install line to add the `content-machine` MCP on any machine, and a local API-key form. |

## MCP-ready

The Studio ships its own MCP server (`studio/mcp/studio-mcp.mjs`) that exposes its **safe, free**
surface to any MCP client — `list_packs`, `get_pack`, `health`, `list_styles`, `compose_prompt`,
`make_subtitles`. It deliberately exposes nothing that costs money or renders; generation stays
behind the engine's own `content-machine` MCP and explicit approval.

Register it in Claude Code (the Settings tab shows the exact line with your path):

```bash
claude mcp add content-machine-studio -- node "<repo>/studio/mcp/studio-mcp.mjs"
```

It reuses the MCP SDK already vendored in `asset-generation/node_modules` — nothing to install.

## Deploy to a web domain

The server is a single zero-dep Node process, so hosting is: run it with `HOST=0.0.0.0 PORT=8080
node studio/server.mjs` behind your reverse proxy (Caddy/nginx/Cloudflare Tunnel) at your domain.
Because the engine and `Outputs/` live on the machine that generates, the Studio is designed to run
on that machine (or one with the `Outputs/` folder mounted). For a fully remote, multi-user MCP over
the domain, the next step is wiring the SDK's Streamable-HTTP transport into `server.mjs` at `/mcp`
(the stdio server already defines every tool; only the transport is added). Keep `HOST=127.0.0.1`
for local-only use.

## Gates (important)

The Studio **never** starts anything that costs money or is irreversible. Image generation (billed
per frame) and especially **video** (Veo) and **map render** are shown as copy-paste prompts you run
and approve inside Claude Code, exactly as the engine's rules require. The only thing it runs for you
is free, local work (scanning, subtitle building, reading config).

## Files

```
studio/
  server.mjs   zero-dep http server: static + /api + /media (Range) + /subtool
  lib/
    paths.mjs    repo anchors + path-traversal guard
    packs.mjs    scans Outputs/ → gallery index (tolerant of any pack layout)
    engine.mjs   composes pipeline prompts (+ style/motion presets); builds SRT via subtitles/lib
    presets.mjs  loads the style/motion/text preset library
    voice.mjs    provider slot definitions + status (Swar / Kriti / TTS)
    config.mjs   read/write studio.config.local.json (gitignored secrets)
    mcp.mjs      engine health + Studio-MCP connect info (secrets reported present/absent only)
  mcp/
    studio-mcp.mjs   the Studio MCP server (stdio) — safe read/compose tools
  data/
    style-presets.json   the prompt-preset library (edit to add your own)
  research/
    CONTENT-MACHINE-RESEARCH.md   sourced research + "what to build" + preset appendix
  public/        index.html, app.js (SPA), studio.css (brand theme)
```

## Notes on voice

Naamche Labs' models are **open-weight** (Hugging Face / Colab) with no hosted API, and cover
**Nepali/English only** — not Hindi. So v1 ships the slots and the "how to connect" steps; wiring
inference (a local/Colab endpoint for Swar/Kriti, or a TTS API key for Hindi/English) is the next
step and drops into `lib/voice.mjs` (`synth()` / `transcribe()` stubs are already there). Your
engine `.env` already holds an ElevenLabs key — the Settings tab detects it.

## Next (not in v1)

- Wire `synth()`/`transcribe()` to connected slots.
- Deploy the gallery layer to the hosted domain (the scanner/API is deploy-ready).
- Trigger free MCP steps directly from Create once the MCP is reachable from the server.
