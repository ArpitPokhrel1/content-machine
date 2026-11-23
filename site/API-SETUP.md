# Storyboard API setup on Cloudflare

The live storyboard site uses the Cloudflare Worker `tarjun-content`. **Cloudflare draft** frame planning and image generation work without OpenAI or Claude keys, within Cloudflare's shared Workers AI free allowance. A studio access code is still required for generation; enter it in the Frames tab. The code is held in the browser tab's session storage, and provider credentials never enter the browser.

To use OpenAI or Claude, open **Cloudflare dashboard → Workers & Pages → `tarjun-content` → Settings → Variables and Secrets → Add**. Choose **Secret** for API keys, enter the name and value, then **Deploy**. [Cloudflare's environment variable guide](https://developers.cloudflare.com/workers/configuration/environment-variables/) shows this flow. Add only the provider you will use:

| Secret | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI planning and image generation |
| `OPENAI_STORYBOARD_MODEL` | Responses API text model ID available to your API organization |
| `OPENAI_IMAGE_MODEL` | Images API model ID available to your API organization |
| `ANTHROPIC_API_KEY` | Claude frame planning |
| `ANTHROPIC_STORYBOARD_MODEL` | Messages API model ID available to your Console organization |
| `ACCESS_CODES` | Comma-separated `name:code` entries; already installed on the live Worker |

The Frames tab has separate planning and image provider selectors. It sends at most five frame cards per planning request and makes one image request per clicked frame, without automatic retries. Cloudflare draft images are square JPEG previews; use OpenAI or the local image operator for other aspect ratios and final frames.

API access is distinct from a Codex or Claude Code login. Eligible ChatGPT plans can [claim linked API credits](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions); [OpenAI API billing is separate](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform). Eligible Claude plans can [claim Claude Platform API credits](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans). Claiming credits still requires an API key from the corresponding developer platform for a hosted website.
