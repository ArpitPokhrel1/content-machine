import test from "node:test";
import assert from "node:assert/strict";
import plan from "../api/plan.mjs";
import image from "../api/frame-image.mjs";

function response() {
  return { statusCode: 200, body: null, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
}
const request = (body, code = "secret") => ({ method: "POST", headers: { "x-access-code": code }, body });

test("API routes reject callers without an access code", async () => {
  process.env.ACCESS_CODES = "owner:secret";
  const a = response(), b = response();
  await plan(request({}, "wrong"), a);
  await image(request({}, "wrong"), b);
  assert.equal(a.statusCode, 401);
  assert.equal(b.statusCode, 401);
});

test("Claude planning returns directions only for requested frames", async () => {
  process.env.ACCESS_CODES = "owner:secret";
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_STORYBOARD_MODEL = "test-model";
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /api\.anthropic\.com/);
    assert.equal(JSON.parse(options.body).messages[0].role, "user");
    return { ok: true, json: async () => ({ content: [{ type: "text", text: '{"frames":[{"id":"c01-1","direction":"A wide view of the courtyard at dawn."},{"id":"other","direction":"ignore"}]}' }] }) };
  };
  try {
    const res = response();
    await plan(request({ provider: "anthropic", context: "A courtyard.", frames: [{ id: "c01-1", excerpt: "the courtyard at dawn" }] }), res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.frames, [{ id: "c01-1", direction: "A wide view of the courtyard at dawn." }]);
  } finally { globalThis.fetch = original; }
});

test("image route requires a configured image API", async () => {
  process.env.ACCESS_CODES = "owner:secret";
  delete process.env.OPENAI_API_KEY;
  const res = response();
  await image(request({ prompt: "A detailed frame with a person walking across a courtyard at dawn." }), res);
  assert.equal(res.statusCode, 503);
});
