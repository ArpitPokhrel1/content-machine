# Cloudflare hosting for the storyboard site

This Worker serves `site/public/` and the four existing API routes. It is the same application for `tarjun.com`, `www.tarjun.com`, and `content.tarjun.com`.

## Build and preview

From `site/`:

```powershell
node cloudflare/build.mjs
node --test cloudflare/worker.test.mjs
npx wrangler deploy --dry-run --config cloudflare/wrangler.jsonc
npx wrangler dev --local --config cloudflare/wrangler.jsonc
```

The build creates `cloudflare/content-machine.bin` from tracked source files and refreshes the browser subtitle engine and studio presets. Local memory files, manifests, archives, `.env` files, and untracked files are excluded. The generated bundle is ignored by Git. Open the local URL printed by Wrangler; `/storyboard`, `/maps`, `/subtitles`, and `/assets` are the same routes as the current site. AI calls need credentials or the Workers AI binding and may use paid provider capacity.

## Secrets

The Worker keeps API credentials in Cloudflare Worker secrets. Run these commands from `site/`, replacing each secret value interactively. Do not commit keys or put them in `wrangler.jsonc`.

In the dashboard, open **Workers & Pages → tarjun-content → Settings → Variables and Secrets → Add → Secret → Name/Value → Deploy**. Cloudflare's [environment variable guide](https://developers.cloudflare.com/workers/configuration/environment-variables/) shows the same flow.

```powershell
npx wrangler secret put ACCESS_CODES --config cloudflare/wrangler.jsonc
npx wrangler secret put OPENAI_API_KEY --config cloudflare/wrangler.jsonc
npx wrangler secret put OPENAI_STORYBOARD_MODEL --config cloudflare/wrangler.jsonc
npx wrangler secret put OPENAI_IMAGE_MODEL --config cloudflare/wrangler.jsonc
npx wrangler secret put ANTHROPIC_API_KEY --config cloudflare/wrangler.jsonc
npx wrangler secret put ANTHROPIC_STORYBOARD_MODEL --config cloudflare/wrangler.jsonc
```

`ACCESS_CODES` uses comma-separated `name:code` pairs and is required by `/api/plan` and `/api/frame-image`. Set only the providers you use. Model names are provider model IDs, not ChatGPT or Claude subscription credentials. The Workers AI binding in the config supplies the default `/api/recognize` backend without a Cloudflare API token. To use a separate Naamche service, set `RECOGNIZE_BACKEND=naamche`, `NAAMCHE_ASR_URL`, and optionally `NAAMCHE_ASR_TOKEN` as Worker secrets. `REQUIRE_ACCESS_CODE=true` gates downloads; `REQUIRE_SUBTITLE_CODE=true` gates transcription. Either can be set as a plain Worker variable or secret. The existing Cloudflare REST recognition backend remains a fallback if the AI binding is removed; it then needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.

### Cloudflare draft mode

The storyboard's **Cloudflare draft** choices use the existing Workers AI binding, so they need no OpenAI or Anthropic key. Planning uses [`@cf/zai-org/glm-4.7-flash`](https://developers.cloudflare.com/workers-ai/models/glm-4.7-flash/); the requested Llama 3.1 model was [deprecated](https://developers.cloudflare.com/changelog/post/2026-05-08-planned-model-deprecations/). Images use [`@cf/black-forest-labs/flux-1-schnell`](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/) and return square JPEG previews. FLUX accepts up to 2,048 prompt characters and has no aspect-ratio input. These are lower quality drafts for framing and continuity review; use OpenAI or the local image operator for final assets.

Cloudflare gives the account **10,000 Workers AI neurons per day** on the free plan, [shared by planning, images, subtitles, and any other Workers AI use](https://developers.cloudflare.com/workers-ai/platform/pricing/). Requests stop when the account reaches that allowance. The studio access code still protects each generation route, and failed calls are never retried automatically.

For a local API preview, create `site/cloudflare/.dev.vars` with the relevant keys and model IDs. This path is ignored by Git. Workers AI inference needs a remote binding or a deployed Worker; a fully local preview can still check static pages and API validation responses.

The existing local Cloudflare token could not create this Worker: Cloudflare returned **“No access to the specified resource”** for the Worker secrets endpoint. A new Worker needs a token with **Workers product Admin** access; after creation, **Editor** can deploy updates and manage secrets. Adding the three custom domains also needs **Workers Routes Write** on the `tarjun.com` zone. See Cloudflare's [permissions reference](https://developers.cloudflare.com/workers/authorization/). Keep the token in your local shell or secret store, never in Git.

## Domain routing

The active `tarjun.com` zone has proxied DNS records for the three storyboard hosts. `cloudflare/wrangler.jsonc` routes those hosts to this Worker while retaining its `workers.dev` preview URL:

```json
"routes": [
  { "pattern": "tarjun.com/*", "zone_name": "tarjun.com" },
  { "pattern": "www.tarjun.com/*", "zone_name": "tarjun.com" },
  { "pattern": "content.tarjun.com/*", "zone_name": "tarjun.com" }
]
```

```powershell
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

Requests using Cloudflare DNS now reach this Worker. DNS propagation may temporarily send some visitors to the existing Vercel deployment. The Worker is also available at `https://tarjun-content.content-machine-site.workers.dev`. Keep Vercel online until propagation and IOE migration are complete. This repo contains no Cloudflare credentials.
