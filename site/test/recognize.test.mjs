// /api/recognize guards the only secret on this site and the only paid call it can make, so its
// refusals are tested without any network: global fetch is stubbed.
import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/recognize.mjs";
import { match, caller } from "../lib/access.mjs";

const response = () => {
  const res = {
    statusCode: null, body: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
  return res;
};
const request = (body, { method = "POST", headers = {} } = {}) => ({ method, headers, body });

const wav = "A".repeat(4000);
let calls;

function stubFetch(result) {
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (result instanceof Error) throw result;
    return { ok: result.status < 400, status: result.status, json: async () => result.payload };
  };
}

const env = { ...process.env };
test.beforeEach(() => {
  process.env.CLOUDFLARE_ACCOUNT_ID = "acct";
  process.env.CLOUDFLARE_API_TOKEN = "token";
  delete process.env.REQUIRE_SUBTITLE_CODE;
  delete process.env.ACCESS_CODES;
  delete process.env.CLOUDFLARE_AI_GATEWAY_ID;
  delete process.env.RECOGNIZE_BACKEND;
  delete process.env.NAAMCHE_ASR_URL;
  delete process.env.NAAMCHE_ASR_TOKEN;
  stubFetch({ status: 200, payload: { success: true, result: { text: "क", words: [] } } });
});
test.after(() => { process.env = env; });

test("GET is refused", async () => {
  const res = response();
  await handler(request(null, { method: "GET" }), res);
  assert.equal(res.statusCode, 405);
  assert.equal(calls.length, 0);
});

test("a missing or malformed audio field never reaches Cloudflare", async () => {
  for (const body of [null, {}, { audio: "", seconds: 5 }, { audio: 123, seconds: 5 }, { audio: "not base64!", seconds: 5 }]) {
    const res = response();
    await handler(request(body), res);
    assert.equal(res.statusCode, 400, `accepted ${JSON.stringify(body)}`);
    assert.equal(res.body.success, false);
  }
  assert.equal(calls.length, 0);
});

test("a piece that is too long in seconds or bytes is refused before billing", async () => {
  for (const [body, status] of [
    [{ audio: wav, seconds: 0 }, 400],
    [{ audio: wav, seconds: 31 }, 400],
    [{ audio: wav, seconds: "abc" }, 400],
    [{ audio: "A".repeat(4_000_000), seconds: 10 }, 413]
  ]) {
    const res = response();
    await handler(request(body), res);
    assert.equal(res.statusCode, status, `accepted ${body.seconds}s / ${body.audio.length} chars`);
  }
  assert.equal(calls.length, 0);
});

test("without credentials the page is told to fall back, not given a stack trace", async () => {
  delete process.env.CLOUDFLARE_API_TOKEN;
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.errors[0].message, /free timing/);
  assert.equal(calls.length, 0);
});

test("a valid piece is forwarded to Whisper and the envelope passed back", async () => {
  const res = response();
  await handler(request({ audio: wav, seconds: 12.5, prompt: "नेपाली भाषा।" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.text, "क");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /accounts\/acct\/ai\/run\/@cf\/openai\/whisper-large-v3-turbo$/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer token");
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.audio, wav);
  assert.equal(sent.language, "ne");
  assert.equal(sent.task, "transcribe");
  assert.equal(sent.initial_prompt, "नेपाली भाषा।");
  assert.equal(res.headers["cache-control"], "no-store");
});

test("the language must look like a language code, defaulting to Nepali", async () => {
  for (const [language, expected] of [["en", "en"], ["../etc", "ne"], [{}, "ne"], ["toolongcode", "ne"]]) {
    stubFetch({ status: 200, payload: { success: true, result: {} } });
    await handler(request({ audio: wav, seconds: 5, language }), response());
    assert.equal(JSON.parse(calls[0].options.body).language, expected);
  }
});

test("bad credentials upstream are reported as the site's problem, not the visitor's", async () => {
  stubFetch({ status: 403, payload: { errors: [{ message: "Authentication error" }] } });
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.errors[0].message, /credentials were refused/);
});

test("an upstream failure is reported once, with no retry from here", async () => {
  stubFetch({ status: 500, payload: { errors: [{ message: "boom" }] } });
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 502);
  assert.match(res.body.errors[0].message, /boom/);
  assert.equal(calls.length, 1);
});

test("a timeout is surfaced as a possible charge, not retried", async () => {
  stubFetch(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 504);
  assert.match(res.body.errors[0].message, /Nothing was retried automatically/);
  assert.equal(calls.length, 1);
});

test("a JSON string body is parsed, and an unparseable one refused", async () => {
  const ok = response();
  await handler(request(JSON.stringify({ audio: wav, seconds: 5 })), ok);
  assert.equal(ok.statusCode, 200);
  const bad = response();
  await handler(request("{not json"), bad);
  assert.equal(bad.statusCode, 400);
});

test("REQUIRE_SUBTITLE_CODE closes the route to anyone without a listed code", async () => {
  process.env.REQUIRE_SUBTITLE_CODE = "true";
  process.env.ACCESS_CODES = "arpit:secret-code,ram:other";
  const refused = response();
  await handler(request({ audio: wav, seconds: 5 }, { headers: { "x-access-code": "guess" } }), refused);
  assert.equal(refused.statusCode, 401);
  assert.equal(calls.length, 0);

  const allowed = response();
  await handler(request({ audio: wav, seconds: 5 }, { headers: { "x-access-code": "secret-code" } }), allowed);
  assert.equal(allowed.statusCode, 200);
  assert.equal(calls.length, 1);
});

test("an AI Gateway id is attached when one is configured", async () => {
  process.env.CLOUDFLARE_AI_GATEWAY_ID = "gw";
  await handler(request({ audio: wav, seconds: 5 }), response());
  assert.equal(calls[0].options.headers["cf-aig-gateway-id"], "gw");
});

// --- Naamche (self-hosted Kriti) backend ---
const naamche = () => { process.env.RECOGNIZE_BACKEND = "naamche"; process.env.NAAMCHE_ASR_URL = "https://kriti.example/asr"; };

test("the Naamche backend forwards to NAAMCHE_ASR_URL, not Cloudflare", async () => {
  naamche();
  stubFetch({ status: 200, payload: { text: "नमस्ते", words: [{ word: "नमस्ते", start: 0.1, end: 0.6 }] } });
  const res = response();
  await handler(request({ audio: wav, seconds: 12.5, language: "ne" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://kriti.example/asr");
  const sent = JSON.parse(calls[0].options.body);
  assert.equal(sent.audio, wav);
  assert.equal(sent.seconds, 12.5);
  assert.equal(sent.language, "ne");
});

test("a plain { text, words } response is normalized to the Cloudflare envelope", async () => {
  naamche();
  stubFetch({ status: 200, payload: { text: "नमस्ते संसार", words: [
    { word: "नमस्ते", start: 0.1, end: 0.6 },
    { word: "संसार", start: 0.6, end: 1.2 }
  ] } });
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.result.text, "नमस्ते संसार");
  assert.equal(res.body.result.words.length, 2);
  assert.deepEqual(res.body.result.words[0], { word: "नमस्ते", start: 0.1, end: 0.6 });
});

test("an already-enveloped response is accepted and malformed words are dropped", async () => {
  naamche();
  stubFetch({ status: 200, payload: { result: { text: "क", words: [
    { word: "क", start: 0, end: 0.3 },
    { word: "", start: 0.3, end: 0.5 },      // no text → dropped
    { word: "ख", start: 0.5, end: 0.5 },     // zero span → dropped
    { word: "ग", start: -1, end: 0.2 }       // negative start → dropped
  ] } } });
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.result.words.length, 1);
  assert.equal(res.body.result.words[0].word, "क");
});

test("the Naamche token is sent as a bearer when configured, omitted when not", async () => {
  naamche();
  await handler(request({ audio: wav, seconds: 5 }), response());
  assert.equal(calls[0].options.headers.Authorization, undefined);
  process.env.NAAMCHE_ASR_TOKEN = "s3cret";
  await handler(request({ audio: wav, seconds: 5 }), response());
  assert.equal(calls.at(-1).options.headers.Authorization, "Bearer s3cret");
});

test("Naamche without a URL tells the page to fall back, and sends nothing", async () => {
  process.env.RECOGNIZE_BACKEND = "naamche";
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.errors[0].message, /free timing/);
  assert.equal(calls.length, 0);
});

test("a refused Naamche token is the studio's problem; other failures report once, no retry", async () => {
  naamche();
  stubFetch({ status: 403, payload: { detail: "forbidden" } });
  const refused = response();
  await handler(request({ audio: wav, seconds: 5 }), refused);
  assert.equal(refused.statusCode, 503);
  assert.match(refused.body.errors[0].message, /NAAMCHE_ASR_TOKEN/);

  stubFetch({ status: 500, payload: { detail: "model crashed" } });
  const failed = response();
  await handler(request({ audio: wav, seconds: 5 }), failed);
  assert.equal(failed.statusCode, 502);
  assert.match(failed.body.errors[0].message, /model crashed/);
  assert.equal(calls.length, 1);
});

test("a Naamche timeout is surfaced without retry", async () => {
  naamche();
  stubFetch(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
  const res = response();
  await handler(request({ audio: wav, seconds: 5 }), res);
  assert.equal(res.statusCode, 504);
  assert.match(res.body.errors[0].message, /Nothing was retried automatically/);
  assert.equal(calls.length, 1);
});

test("shared validation runs before the Naamche backend is chosen", async () => {
  naamche();
  const res = response();
  await handler(request({ audio: "not base64!", seconds: 5 }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test("access codes match by exact value and ignore a missing header", () => {
  process.env.ACCESS_CODES = "arpit:secret-code, ram:other ";
  assert.equal(match("secret-code").name, "arpit");
  assert.equal(match("other").name, "ram");
  assert.equal(match("secret-cod"), null);
  assert.equal(match(undefined), null);
  assert.equal(caller({ headers: {} }, false).name, "anonymous");
  assert.equal(caller({ headers: {} }, true), null);
});
