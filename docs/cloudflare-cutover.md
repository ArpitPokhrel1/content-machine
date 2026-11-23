# Cloudflare migration status

The `tarjun.com` zone is active on Cloudflare Free with nameservers `rex.ns.cloudflare.com` and `sunny.ns.cloudflare.com`. Spaceship's nameserver change is propagating; some recursive resolvers can still use the previous Vercel nameservers until their caches expire.

| Host | Current service | Status |
| --- | --- | --- |
| `tarjun.com`, `www.tarjun.com`, `content.tarjun.com` | Cloudflare Worker `tarjun-content` through zone routes | Deployed and tested at `https://tarjun-content.content-machine-site.workers.dev`; Cloudflare resolvers use the Worker. Vercel may still answer visitors with cached nameservers. |
| `ioe.tarjun.com` | Vercel project `tarjun` | Keep live on Vercel by the user's decision. A Cloudflare Worker preview exists at `https://tarjun-ioe.content-machine-site.workers.dev`, but its database-backed routes are not ready. |

The storyboard Worker serves static assets, installer download, frame planning, frame image generation, and subtitle recognition. Cloudflare draft planning and square JPEG images use Workers AI without OpenAI or Claude keys, subject to the shared free allowance. OpenAI and Claude remain optional providers; add their API credentials as Worker secrets if desired. See [site/cloudflare/README.md](../site/cloudflare/README.md).

## DNS preservation

These records were checked or restored in the Cloudflare zone:

| Name | Record | Proxy | Verification |
| --- | --- | --- | --- |
| `asr` | A `140.238.161.80` | DNS only | Authoritative `sunny.ns.cloudflare.com` returned the origin IP. The origin itself timed out on ports 80/443 during checks. |
| `kundali` | CNAME `67509bf328a52835.vercel-dns-017.com` | DNS only | Authoritative CNAME lookup matched and the website returned HTTP 200. |
| `@` | Three CAA issuers: `pki.goog`, `sectigo.com`, `letsencrypt.org` | N/A | Cloudflare API returned all three. |

The three storyboard hosts have proxied DNS records and Worker routes in `site/cloudflare/wrangler.jsonc`. The `ioe` host still resolves through the existing Vercel origin. Keep both Vercel projects available during propagation and while IOE remains there.

## IOE hold

The recovered IOE source and migration notes are local in git-ignored `ioe-cloudflare/`; they are not published in this repository. Its Next.js/OpenNext Worker preview renders public pages. The external Neon database is populated but lacks `BlogPost`, `Transaction`, and `Plan.BASIC`; the current Vercel `/api/blog` also returns HTTP 500. A reviewed SQL diff and encrypted backup are documented locally in `ioe-cloudflare/SCHEMA-REVIEW.md`. The user chose to leave the production database unchanged and keep IOE on Vercel. Do not attach `ioe.tarjun.com` to the Cloudflare Worker or apply the SQL without a new instruction.

## Verification and rollback

Check `nslookup -type=ns tarjun.com 1.1.1.1` and `nslookup -type=ns tarjun.com 8.8.8.8` for the assigned Cloudflare nameservers. To test the Cloudflare route while caches are mixed, use `curl --resolve tarjun.com:443:<Cloudflare-IP> https://tarjun.com/api/download` and check `X-Bundle-Version: cloudflare`. Check the storyboard, maps, subtitles, installer, protected planning API, and `kundali` after propagation.

If the storyboard Worker fails, remove or disable its three zone routes in Cloudflare, returning those hosts to their existing Vercel origins. The registrar-level rollback is Spaceship → Advanced DNS → Nameservers → Change → Custom nameservers, entering `ns1.vercel-dns.com` and `ns2.vercel-dns.com`; allow DNS caches to expire. Keep the Vercel deployments live until a separate retirement decision.

Cloudflare Workers Free currently allows 100,000 requests/day and 10 ms CPU/request; Workers AI has a shared free allowance of 10,000 neurons/day. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) · [Spaceship nameserver guide](https://www.spaceship.com/knowledgebase/connect-domain-custom-nameservers/)
