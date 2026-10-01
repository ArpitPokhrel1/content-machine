"""Read credentials without logging, copying, or committing OAuth secrets."""
import os
import tomllib
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv


def credentials():
    # Share the existing per-machine configuration; explicit environment wins.
    repo = Path(__file__).resolve().parents[4]
    load_dotenv(repo / "asset-generation" / ".env", override=False)
    account = os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
    if not account:
        raise RuntimeError("Set CLOUDFLARE_ACCOUNT_ID in .env")
    token = os.getenv("CLOUDFLARE_API_TOKEN", "")
    if not token and os.getenv("CLOUDFLARE_USE_WRANGLER", "0") == "1":
        for path in [Path.home()/"Library/Preferences/.wrangler/config/default.toml", Path.home()/".config/.wrangler/config/default.toml", Path.home()/".wrangler/config/default.toml"]:
            if not path.exists():
                continue
            conf = tomllib.loads(path.read_text(encoding="utf-8"))
            expiry = conf.get("expiration_time")
            if expiry and datetime.fromisoformat(expiry.replace("Z", "+00:00")) <= datetime.now(timezone.utc):
                raise RuntimeError("Wrangler login expired. Run npx wrangler whoami to refresh it, then retry.")
            token = conf.get("oauth_token", "")
            if token:
                break
    if not token:
        raise RuntimeError("Set CLOUDFLARE_API_TOKEN or enable an existing Wrangler login.")
    return account, token
