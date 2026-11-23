# Storyboard API setup

The storyboard page calls two server-side Vercel functions. It never sends provider keys to the browser.

Set these encrypted **Production** environment variables on the `content-machine` Vercel project:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI frame planning and image generation |
| `OPENAI_STORYBOARD_MODEL` | A Responses API text model available to your API organization |
| `OPENAI_IMAGE_MODEL` | An Images API model available to your API organization |
| `ANTHROPIC_API_KEY` | Claude frame planning |
| `ANTHROPIC_STORYBOARD_MODEL` | A Messages API model available to your Console organization |
| `ACCESS_CODES` | Existing comma-separated `name:code` list; required for every storyboard API call |

Redeploy after changing environment variables. The Frames tab accepts a studio access code and holds it in session storage for that browser tab. It sends at most five frame cards per planning request. Image generation makes one request per clicked frame and does not retry automatically.

Plan and API eligibility vary. Eligible ChatGPT subscriptions can claim API credits in a linked API organization; [OpenAI API billing remains separate](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform). Claude Max, Ultra and Team plans can claim [monthly Claude Platform API credits](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans). Neither a Codex nor Claude Code login is itself a server API credential. Hosted websites cannot assume ChatGPT plan usage via Sign in with ChatGPT without [partner access](https://developers.openai.com/siwc/quickstart).
