# Deploying Content Machine Studio to a domain

The Studio is a single zero-dependency Node process that reads your local `Outputs/` and engine,
so it's designed to run on the generating machine (or one with `Outputs/` mounted) and be published
through a reverse proxy.

## 1. Run the server, localhost-bound

```bash
HOST=127.0.0.1 PORT=8080 node studio/server.mjs
```

Keep it alive with pm2 / nssm (Windows service) / a systemd unit.

## 2. Put it behind HTTPS at your domain

- **Caddy** (simplest, auto-HTTPS): see `Caddyfile.example` — set your domain, `caddy run`.
- **Cloudflare Tunnel**: `cloudflared tunnel --url http://127.0.0.1:8080` (no open ports).
- **nginx**: `proxy_pass http://127.0.0.1:8080;` with your TLS block.

Because the cockpit exposes your library and can write local config, keep it private — add basic
auth at the proxy (commented in the example) or restrict by IP/Access while it's for your eyes only.

## 3. MCP over the domain (next step)

`studio/mcp/studio-mcp.mjs` is the full MCP server (stdio) today. To make the **domain itself** an
MCP endpoint, add the SDK's Streamable-HTTP transport to `server.mjs` at `/mcp` and reuse the same
tool definitions — the tools are already written; only the transport changes. Until then, register
the stdio MCP per machine with the line shown in the Studio's **MCP & APIs** tab.
