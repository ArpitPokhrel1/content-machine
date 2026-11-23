import bundle from "./content-machine.bin";

const DRAFT_PLAN_MODEL = "@cf/zai-org/glm-4.7-flash";
const DRAFT_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const fail = (message, status = 400) => json({ error: message }, status);
const subtitleFail = (message, status = 400) => json({ success: false, errors: [{ message }] }, status);
const sha256 = async value => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
async function caller(request, env, required) {
  const given = await sha256(request.headers.get("x-access-code") || "");
  let found = null;
  for (const pair of String(env.ACCESS_CODES || "").split(",").map(s => s.trim()).filter(Boolean)) {
    const separator = pair.indexOf(":");
    const name = separator > 0 ? pair.slice(0, separator) : "user";
    const code = separator > 0 ? pair.slice(separator + 1) : pair;
    const stored = await sha256(code);
    let difference = 0;
    for (let i = 0; i < given.length; i++) difference |= given[i] ^ stored[i];
    if (difference === 0) found = { name };
  }
  return found || (required ? null : { name: "anonymous" });
}
const bodyJson = async (request, maxBytes = 50_000) => {
  if (Number(request.headers.get("Content-Length") || 0) > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text);
  } catch { return null; }
};
const upstreamError = async response => {
  const body = await response.json().catch(() => null);
  return String(body?.error?.message || body?.errors?.[0]?.message || body?.detail || `Provider returned HTTP ${response.status}.`).slice(0, 300);
};

async function download(request, env) {
  if (request.method !== "GET") return fail("GET only.", 405);
  if (!await caller(request, env, env.REQUIRE_ACCESS_CODE === "true")) return fail("Invalid access code. Ask the studio for yours.", 401);
  return new Response(bundle, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": 'attachment; filename="content-machine.tar.gz"',
      "X-Bundle-Version": env.BUNDLE_VERSION || "cloudflare",
      "Cache-Control": "no-store"
    }
  });
}

async function plan(request, env) {
  if (request.method !== "POST") return fail("POST only.", 405);
  if (!await caller(request, env, true)) return fail("Enter your studio access code.", 401);
  const body = await bodyJson(request);
  if (!body) return fail("Invalid JSON.", 400);
  const frames = body.frames, provider = body.provider;
  if (!["cloudflare", "openai", "anthropic"].includes(provider)) return fail("Choose Cloudflare draft, OpenAI, or Anthropic.", 400);
  if (!Array.isArray(frames) || !frames.length || frames.length > 5 || frames.some(f => typeof f?.id !== "string" || typeof f?.excerpt !== "string")) return fail("Send one to five frame cards.", 400);
  const input = `You are directing a ${String(body.format || "storyboard").slice(0, 30)}. Read the story context and locked visual canon. For each supplied frame, write one concrete visual direction with subject/action, shot composition, foreground/middle/background, light, and story function. Preserve asserted facts. Do not invent people, dates, cultural details or readable text. Return only JSON: {"frames":[{"id":"exact supplied id","direction":"..."}]}.

STORY AND CANON
${String(body.context || "").slice(0, 12_000)}

FRAMES
${JSON.stringify(frames.map(f => ({ id: f.id, excerpt: f.excerpt, context: String(f.context || "").slice(0, 300), shot: f.shot, function: f.function, currentDirection: f.direction || "" })))}`;
  let text;
  if (provider === "cloudflare") {
    if (!env.AI) return fail("Cloudflare draft AI is not configured for this site.", 503);
    try {
      const result = await env.AI.run(DRAFT_PLAN_MODEL, {
        messages: [
          { role: "system", content: "You are a storyboard director. Return only valid JSON with a frames array. No markdown." },
          { role: "user", content: input }
        ],
        max_completion_tokens: 1600,
        temperature: 0.3
      });
      text = result?.choices?.[0]?.message?.content || result?.response || "";
    } catch { return fail("Cloudflare draft planning is unavailable or its daily quota is exhausted. Nothing was retried.", 503); }
  } else {
    let url, headers, payload;
    if (provider === "openai") {
      if (!env.OPENAI_API_KEY || !env.OPENAI_STORYBOARD_MODEL) return fail("OpenAI API is not configured for this site.", 503);
      url = "https://api.openai.com/v1/responses";
      headers = { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" };
      payload = { model: env.OPENAI_STORYBOARD_MODEL, input, max_output_tokens: 1600 };
    } else {
      if (!env.ANTHROPIC_API_KEY || !env.ANTHROPIC_STORYBOARD_MODEL) return fail("Claude API is not configured for this site.", 503);
      url = "https://api.anthropic.com/v1/messages";
      headers = { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
      payload = { model: env.ANTHROPIC_STORYBOARD_MODEL, max_tokens: 1600, messages: [{ role: "user", content: input }] };
    }
    let response;
    try { response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(50_000) }); }
    catch { return fail("The API request timed out. Nothing was retried; check provider usage before trying again.", 504); }
    if (!response.ok) return fail(await upstreamError(response), response.status === 429 ? 429 : 502);
    const data = await response.json().catch(() => null);
    text = provider === "openai" ? (data?.output || []).flatMap(x => x.content || []).filter(x => x.type === "output_text").map(x => x.text).join("\n") : (data?.content || []).filter(x => x.type === "text").map(x => x.text).join("\n");
  }
  try {
    const first = text.indexOf("{"), last = text.lastIndexOf("}");
    const parsed = JSON.parse(text.slice(first, last + 1));
    const allowed = new Set(frames.map(f => f.id));
    const result = (parsed.frames || []).filter(f => allowed.has(f?.id) && typeof f.direction === "string" && f.direction.trim()).map(f => ({ id: f.id, direction: f.direction.trim().slice(0, 1200) }));
    if (!result.length) throw new Error();
    return json({ frames: result, provider });
  } catch { return fail("The model returned no usable frame directions.", 502); }
}

async function frameImage(request, env) {
  if (request.method !== "POST") return fail("POST only.", 405);
  if (!await caller(request, env, true)) return fail("Enter your studio access code.", 401);
  const body = await bodyJson(request), prompt = body?.prompt;
  if (typeof prompt !== "string" || prompt.length < 40 || prompt.length > 4000) return fail("Image prompt must be 40–4000 characters.");
  const provider = body.provider || "openai";
  if (!["cloudflare", "openai"].includes(provider)) return fail("Choose Cloudflare draft or OpenAI for image generation.");
  if (provider === "cloudflare") {
    if (!env.AI) return fail("Cloudflare draft AI is not configured for this site.", 503);
    if (prompt.length > 2048) return fail("Cloudflare draft prompts are limited to 2,048 characters. Shorten the canon or use OpenAI.");
    try {
      const result = await env.AI.run(DRAFT_IMAGE_MODEL, { prompt, steps: 4 });
      if (typeof result?.image !== "string" || !result.image) return fail("Cloudflare draft returned no image.", 502);
      return new Response(base64JsonStream(result.image, "image/jpeg"), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
    } catch { return fail("Cloudflare draft imaging is unavailable or its daily quota is exhausted. Nothing was retried.", 503); }
  }
  if (!env.OPENAI_API_KEY || !env.OPENAI_IMAGE_MODEL) return fail("OpenAI image API is not configured for this site.", 503);
  const size = { "9:16": "1024x1536", "4:5": "1024x1536", "1:1": "1024x1024", "16:9": "1536x1024" }[body.aspect] || "1024x1536";
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL, prompt, size, n: 1, output_format: "png" }),
      signal: AbortSignal.timeout(110_000)
    });
  } catch { return fail("Image generation timed out. Nothing was retried; check provider usage before trying again.", 504); }
  if (!response.ok) return fail(await upstreamError(response), response.status === 429 ? 429 : 502);
  // The browser expects {image,mime}; the provider returns {data:[{b64_json}]}.
  // Copy the base64 string through a stream so a large image does not consume the
  // Worker CPU or memory budget during JSON parsing and serialization.
  const stream = await imageJsonStream(response.body);
  if (!stream) return fail("The image API returned no image.", 502);
  return new Response(stream, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

function base64JsonStream(image, mime) {
  const encoder = new TextEncoder();
  let offset = -1;
  return new ReadableStream({
    pull(controller) {
      if (offset < 0) { controller.enqueue(encoder.encode('{"image":"')); offset = 0; return; }
      if (offset < image.length) {
        controller.enqueue(encoder.encode(image.slice(offset, offset + 32_768)));
        offset += 32_768;
        return;
      }
      controller.enqueue(encoder.encode(`","mime":"${mime}"}`));
      controller.close();
    }
  });
}

async function imageJsonStream(body) {
  if (!body) return null;
  const reader = body.getReader(), decoder = new TextDecoder(), encoder = new TextEncoder();
  const marker = /"b64_json"\s*:\s*"/;
  let pending = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) { reader.releaseLock(); return null; }
    pending += decoder.decode(value, { stream: true });
    const match = marker.exec(pending);
    if (match) { pending = pending.slice(match.index + match[0].length); break; }
    pending = pending.slice(-64);
  }
  let first = true;
  return new ReadableStream({
    async pull(controller) {
      try {
        if (first) { controller.enqueue(encoder.encode('{"image":"')); first = false; }
        if (!pending) {
          const { done, value } = await reader.read();
          if (done) throw new Error("Image data ended unexpectedly.");
          pending = decoder.decode(value, { stream: true });
        }
        const end = pending.indexOf('"');
        if (end < 0) {
          controller.enqueue(encoder.encode(pending));
          pending = "";
          return;
        }
        controller.enqueue(encoder.encode(pending.slice(0, end)));
        controller.enqueue(encoder.encode('","mime":"image/png"}'));
        controller.close();
        reader.cancel().catch(() => {});
      } catch (error) { controller.error(error); reader.cancel().catch(() => {}); }
    },
    cancel() { return reader.cancel(); }
  });
}

async function recognize(request, env) {
  if (request.method !== "POST") return subtitleFail("POST only.", 405);
  if (!await caller(request, env, env.REQUIRE_SUBTITLE_CODE === "true")) return subtitleFail("Voice alignment needs an access code on this site.", 401);
  const body = await bodyJson(request, 2_700_000), audio = body?.audio, seconds = Number(body?.seconds);
  if (typeof audio !== "string" || !audio || !/^[A-Za-z0-9+/=\s]+$/.test(audio)) return subtitleFail("Send { audio: <base64 wav>, seconds }.");
  if (audio.length > 2_700_000) return subtitleFail("That piece of audio is too long.", 413);
  if (!(seconds > 0 && seconds <= 30)) return subtitleFail("Each piece must be between 0 and 30 seconds.");
  const language = typeof body.language === "string" && /^[a-z]{2,3}$/.test(body.language) ? body.language : "ne";
  const backend = (env.RECOGNIZE_BACKEND || "cloudflare").toLowerCase();
  let url, headers, payload;
  if (backend === "naamche") {
    if (!env.NAAMCHE_ASR_URL) return subtitleFail("Voice alignment isn't configured on this site yet.", 503);
    url = env.NAAMCHE_ASR_URL;
    headers = { "Content-Type": "application/json", ...(env.NAAMCHE_ASR_TOKEN ? { Authorization: `Bearer ${env.NAAMCHE_ASR_TOKEN}` } : {}) };
    payload = { audio, seconds, language };
  } else {
    const cloudflarePayload = { audio, language, task: "transcribe", vad_filter: false, condition_on_previous_text: true, ...(typeof body.prompt === "string" ? { initial_prompt: body.prompt.slice(0, 400) } : {}) };
    if (env.AI) {
      try {
        const result = await env.AI.run("@cf/openai/whisper-large-v3-turbo", cloudflarePayload);
        if (!result || typeof result.text !== "string") return subtitleFail("Recognition returned no result.", 502);
        return json({ success: true, result });
      } catch { return subtitleFail("Recognition failed. Nothing was retried automatically.", 502); }
    }
    if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) return subtitleFail("Voice alignment isn't configured on this site yet.", 503);
    url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/openai/whisper-large-v3-turbo`;
    headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };
    if (env.CLOUDFLARE_AI_GATEWAY_ID) headers["cf-aig-gateway-id"] = env.CLOUDFLARE_AI_GATEWAY_ID;
    payload = cloudflarePayload;
  }
  let response;
  try { response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(50_000) }); }
  catch { return subtitleFail("Recognition timed out. Nothing was retried automatically.", 504); }
  if (!response.ok) return subtitleFail(await upstreamError(response), response.status === 401 || response.status === 403 ? 503 : 502);
  const data = await response.json().catch(() => null);
  if (!data) return subtitleFail("Recognition returned no result.", 502);
  if (backend !== "naamche") return json(data);
  const source = data.result || data;
  const words = (Array.isArray(source.words) ? source.words : []).map(w => ({ word: String(w.word ?? w.text ?? "").trim(), start: Number(w.start), end: Number(w.end) })).filter(w => w.word && w.start >= 0 && w.end > w.start);
  return json({ success: true, result: { text: typeof source.text === "string" ? source.text : "", words }, model: "naamche/kriti" });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (path === "/api/download") return download(request, env);
    if (path === "/api/plan") return plan(request, env);
    if (path === "/api/frame-image") return frameImage(request, env);
    if (path === "/api/recognize") return recognize(request, env);
    if (path.startsWith("/api/")) return fail("No such API route.", 404);
    if (path !== "/" && !path.endsWith("/") && !path.split("/").pop().includes(".")) {
      url.pathname = `${path}.html`;
      return env.ASSETS.fetch(new Request(url, request));
    }
    const response = await env.ASSETS.fetch(request);
    if (path === "/install.ps1" || path === "/install.sh") {
      const headers = new Headers(response.headers);
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("Cache-Control", "no-cache");
      return new Response(response.body, { status: response.status, headers });
    }
    return response;
  }
};
