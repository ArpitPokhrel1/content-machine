import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The production Worker imports its generated tarball through Wrangler's Data
// module rule. Replace that import for unit tests, which only exercise AI paths.
const source = readFileSync(new URL("./worker.mjs", import.meta.url), "utf8")
  .replace('import bundle from "./content-machine.bin";', "const bundle = new Uint8Array();");
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const request = (path, body, code = "draft-code") => new Request(`https://tarjun.com${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-access-code": code },
  body: JSON.stringify(body)
});
const env = run => ({ ACCESS_CODES: "studio:draft-code", AI: { run } });

test("Cloudflare draft planning returns the existing frames contract", async () => {
  const calls = [];
  const response = await worker.fetch(request("/api/plan", {
    provider: "cloudflare", context: "A river crossing at dusk.", format: "Storyboard",
    frames: [{ id: "c01-1", excerpt: "cross the old river" }]
  }), env(async (model, input) => {
    calls.push({ model, input });
    return { choices: [{ message: { content: '{"frames":[{"id":"c01-1","direction":"Wide shot of the crossing at dusk."}]}' } }] };
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { frames: [{ id: "c01-1", direction: "Wide shot of the crossing at dusk." }], provider: "cloudflare" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "@cf/zai-org/glm-4.7-flash");
});

test("Cloudflare draft image preserves image and MIME contract", async () => {
  const calls = [];
  const response = await worker.fetch(request("/api/frame-image", {
    provider: "cloudflare", prompt: "A clear storyboard frame of a wooden bridge over a river at dusk.", aspect: "16:9"
  }), env(async (model, input) => { calls.push({ model, input }); return { image: "/9j/" }; }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { image: "/9j/", mime: "image/jpeg" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "@cf/black-forest-labs/flux-1-schnell");
  assert.equal(calls[0].input.steps, 4);
});

test("Cloudflare draft rejects missing access and long prompts before inference", async () => {
  let calls = 0;
  const ai = env(async () => { calls++; return { image: "/9j/" }; });
  const body = { provider: "cloudflare", prompt: "A".repeat(2049) };
  assert.equal((await worker.fetch(request("/api/frame-image", body, "wrong"), ai)).status, 401);
  assert.equal((await worker.fetch(request("/api/frame-image", body), ai)).status, 400);
  assert.equal(calls, 0);
});

test("Cloudflare draft does not retry a failed inference", async () => {
  let calls = 0;
  const response = await worker.fetch(request("/api/frame-image", {
    provider: "cloudflare", prompt: "A clear storyboard frame of a wooden bridge over a river at dusk."
  }), env(async () => { calls++; throw new Error("quota"); }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /Nothing was retried/);
  assert.equal(calls, 1);
});
