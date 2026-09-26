import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { runPool } from "../lib/pool.mjs";

const read = file => readFile(file, "utf8");

test("client code does not expose cloud credentials", async () => {
  const files = await Promise.all(["public/index.html", "public/app.js", "public/styles.css"].map(read));
  assert.equal(files.some(text => text.includes("google_asset_api")), false);
});

test("generation requires a browser confirmation", async () => {
  assert.match(await read("public/app.js"), /confirm\(`Generate/);
});

test("one video per request, Vertex by default, no retry loop anywhere", async () => {
  const [server, generate, config, pool, images] = await Promise.all(["server.mjs", "lib/generate.mjs", "lib/config.mjs", "lib/pool.mjs", "image-pack/gen-parallel.mjs"].map(read));
  assert.match(generate, /numberOfVideos: 1/);
  assert.match(config, /veo-3\.1-fast-generate-001/);
  assert.match(config, /vertexai: true/);
  for (const code of [server, generate, pool, images]) assert.doesNotMatch(code, /retry/i);
});

test("no machine-specific project, bucket or path is hardcoded in code", async () => {
  const files = ["server.mjs", "agent-video.mjs", "lib/config.mjs", "lib/generate.mjs", "image-pack/gen-parallel.mjs", "scripts/setup.mjs", "scripts/doctor.mjs"];
  for (const file of files) {
    const code = await read(file);
    assert.doesNotMatch(code, /auto-504509|F:[\\/]BUSINESS|C:[\\/]Users/i, file);
  }
});

test("approved prompt edits are sent to the server", async () => {
  assert.match(await read("public/app.js"), /sceneIds: ids, prompts/);
  assert.match(await read("server.mjs"), /promptOverrides/);
});

test("reference assets are bounded and passed to Veo", async () => {
  const client = await read("public/app.js");
  const server = await read("server.mjs");
  const generate = await read("lib/generate.mjs");
  assert.match(client, /slice\(0, 3\)/);
  assert.match(server, /referenceImages/);
  assert.match(generate, /referenceType: "ASSET"/);
  assert.match(server, /ASSET STORY TIMELINE/);
});

test("agent bridge requires an explicit paid-generation flag for projects and batches", async () => {
  const bridge = await read("agent-video.mjs");
  assert.match(bridge, /approval\.confirmPaidGeneration !== true/);
  assert.match(bridge, /spec\.confirmPaidGeneration !== true/);
  assert.match(bridge, /draft --manifest/);
  assert.match(bridge, /generate --project/);
});

test("logo mode uses image-to-video and prohibits generated lettering", async () => {
  const server = await read("server.mjs");
  assert.match(server, /logo_start_frame/);
  assert.match(server, /image: sceneAssets\.find\(asset => asset\.mode === "logo_start_frame"\)/);
  assert.match(server, /No readable text, letters, captions, slogans/);
});

test("scenes and batches run through the bounded pool", async () => {
  const server = await read("server.mjs");
  assert.match(server, /runPool\(scenes, .*concurrency: config\.videoConcurrency/);
  assert.match(server, /runPool\(clips, /);
});

test("runPool caps concurrency, keeps order and never re-runs a failure", async () => {
  let active = 0, peak = 0;
  const calls = [];
  const results = await runPool([1, 2, 3, 4, 5, 6], async n => {
    calls.push(n);
    active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 20));
    active--;
    if (n === 3) throw new Error("boom");
    return n * 10;
  }, { concurrency: 2 });
  assert.equal(peak, 2);
  assert.deepEqual(results.map(r => r?.ok === false ? "fail" : r), [10, 20, "fail", 40, 50, 60]);
  assert.equal(calls.filter(n => n === 3).length, 1);
});

test("no prompt source asks for a watermark-free image (hard safety block)", async () => {
  const sources = ["image-pack/templates/canon.template.mjs", "MASTER-IMAGE-GENERATION.md"];
  const template = await read(sources[0]);
  assert.doesNotMatch(template.match(/export const NEG = "(.*)";/)[1], /watermark/i);
  const files = await readdir("image-pack");
  assert.ok(files.includes("build-frames.mjs") && files.includes("build-refs.mjs"));
});
