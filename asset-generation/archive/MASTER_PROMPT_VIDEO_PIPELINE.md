# Master Prompt: Nepali Script → Image → Video Production Pipeline

**Purpose:** This file is a complete, self-contained handoff. A fresh agent with no prior
context should be able to read this file, understand everything that was built and decided,
and continue the work without asking the user to re-explain anything.

**Working directory:** `f:\BUSINESS\Content Machine`
**Last updated:** 2026-08-21
**Cloud project:** `auto-504509` (Google Cloud / Vertex AI)

---

## 0. TL;DR for a Fresh Agent

You are operating a **local, approval-gated pipeline** that turns Nepali marketing/storytelling
scripts into culturally-accurate 9:16 vertical video assets for social media (Reels/Shorts/
TikTok), using Google Vertex AI.

Two client projects have been completed end-to-end:

| Project | Topic | Status |
| --- | --- | --- |
| **Janai Purnima / Sacred Thread** | Mythological (Bali + Guru Brihaspati) → product CTA | 13 video clips done |
| **Bamsawali App Launch** | Surname/thar origins → genealogy app CTA | 14 video clips done |

The core loop is: **analyze script → write prompt-pack markdown → generate start+end frame
images → user reviews → generate video by interpolating between the frames**.

**Read `master_prompt_image_generation_file.md` in this same folder.** It is the operating
manual for image prompt construction (prompt schema, negative-prompt library, cultural detail
library, reroll strategy). This file you're reading now is the *pipeline + project state*
companion to it.

---

## 1. Infrastructure & Environment

### 1.1 Authentication

Auth is via **gcloud Application Default Credentials (ADC)** — NOT API keys, NOT tokens in files.

```powershell
gcloud auth application-default login   # only if ADC is missing/expired
gcloud config get-value project          # should print: auto-504509
```

Verified working as of last session (account: `pokhrelarpit@gmail.com`).

> **Historical note / do not repeat:** The `.env` originally contained two raw secrets named
> `google_asset_api` and `print_assess_token` (the latter a `ya29.…` OAuth access token). They
> were unused by any code, expire in ~1 hour, and were removed. Do not reintroduce raw tokens
> into `.env`. If auth breaks, re-run `gcloud auth application-default login`.

### 1.2 Current `.env`

```dotenv
GOOGLE_CLOUD_PROJECT=auto-504509
GOOGLE_CLOUD_LOCATION=us-central1
PROMPT_LOCATION=global
VIDEO_OUTPUT_BUCKET=auto-504509-veo-output-26
PROMPT_MODEL=gemini-3.1-flash-lite
VIDEO_MODEL=veo-3.1-generate-001
VIDEO_RESOLUTION=1080p
IMAGE_MODEL=gemini-2.5-flash-image
PORT=4317
```

### 1.3 Models in use — and why

| Role | Model | Notes |
| --- | --- | --- |
| Image generation | `gemini-2.5-flash-image` ("Nano Banana") | **Works today, no enablement needed.** Supports reference images for character consistency and conversational multi-turn editing. |
| Video generation | `veo-3.1-generate-001` | Full-quality tier (NOT `-fast`). Supports `image` + `lastFrame` interpolation. |
| Text/prompt planning | `gemini-3.1-flash-lite` | Only used by the legacy `draft` flow in `server.mjs`. |

**Imagen is NOT available on this project.** Every Imagen variant
(`imagen-4.0-ultra-generate-001`, `imagen-4.0-generate-001`, `imagen-3.0-*`,
`imagegeneration@006`, etc.) returns **404** across `us-central1`, `global`, `us-east4`, and
`us-east1`. This is a project-level access/allowlist issue, not a code bug. Veo works fine in
the same project, so it is specifically Imagen that is not enabled.

To enable it (user action, console only — an agent cannot do this):
Vertex AI → Model Garden → project `auto-504509` → search "Imagen" → open the Imagen 4 card →
Enable / accept terms. **This is not blocking** — `gemini-2.5-flash-image` is a fine substitute
and arguably better for this work because of reference-image character consistency.

### 1.4 Known API constraints (learned the hard way)

- **Veo 1080p only works on 16:9.** All 9:16 output is capped at **720p** by Google. The
  `resolutionFor()` helper in `server.mjs` handles this fallback automatically — do not "fix" it.
- **Veo durations:** only `4`, `6`, or `8` seconds. No other values.
- **`lastFrame` requires `image`.** You cannot supply an end frame without a start frame; it is
  image-to-video only.
- **Max 3 reference images per image-generation call.**
- **GCS output is mandatory for Veo** — it writes to `gs://auto-504509-veo-output-26/…`, then
  the pipeline downloads locally via `gcloud storage cp`.

---

## 2. Codebase Changes Made This Session

### 2.1 `server.mjs` — Express orchestrator on `127.0.0.1:4317`

Original state: script → Gemini prompt-planning → Veo video, approval-gated, project-folder
output. **Changes made:**

1. **Added image generation.** New `POST /api/quick/image` endpoint. Dual-mode
   `generateOneImage()` helper auto-detects by model name: `imagen*` models use
   `ai.models.generateImages()`; everything else (Gemini image models) uses
   `ai.models.generateContent()` with `responseModalities: ["IMAGE"]` and
   `imageConfig.aspectRatio`. Accepts up to 3 `referenceImages` for character consistency.
2. **Added quick single-prompt video.** New `POST /api/quick/video`. Supports `image`,
   `lastFrame`, `model`, `resolution`, `duration`, `aspectRatio`, `audio`.
3. **Added `lastFrame` support** to the quick-video path (start→end frame interpolation).
4. **Made resolution configurable** via `VIDEO_RESOLUTION` + the `resolutionFor()` 16:9 guard.
   Replaced two hardcoded `"720p"` strings.
5. **Added `output/quick/`** flat output folder for one-off generations.
6. **FIXED A REAL BUG:** `gcloudExecutable` was hardcoded to
   `%LOCALAPPDATA%\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`. That path contains a
   space, was passed unquoted to a `shell: true` child process, and `cmd.exe` split it
   mid-path — so **every single video download failed** with
   `'C:\Users\Legion\AppData\Local\Google\Cloud' is not recognized…`. Changed to plain
   `"gcloud"` (relies on PATH) and removed the now-pointless `access()` precheck.
   **The videos had generated fine and were sitting in GCS — only the download was broken.**

### 2.2 `agent-video.mjs` — CLI bridge

Added `image` and `video` subcommands, an `options()` multi-value arg reader, `--ref` (repeatable,
max 3), and `--end-image`. Full usage:

```
node agent-video.mjs health
node agent-video.mjs draft   --manifest FILE
node agent-video.mjs review  --project ID
node agent-video.mjs status  --project ID
node agent-video.mjs generate --project ID --approval FILE
node agent-video.mjs image --prompt TEXT --confirm true [--aspect 9:16] [--count N] [--ref FILE …] [--model M]
node agent-video.mjs video --prompt TEXT --confirm true [--aspect 9:16] [--duration 6] [--audio true] [--image FILE] [--end-image FILE] [--model M] [--resolution R]
```

Both `image` and `video` **hard-refuse without `--confirm true`** — this is the billing guard.

### 2.3 Running the server

```powershell
npm start          # node --env-file=.env server.mjs
```

Health check: `curl -s http://127.0.0.1:4317/api/health`

> **Practical note:** For batch work (10+ generations), the CLI/HTTP round-trip is slow and
> rate-limit-prone. In practice most batch generation this session was done with **standalone
> `.mjs` scripts** calling `@google/genai` directly, run via `node script.mjs`, then deleted.
> See §6 for reusable templates. This is the recommended approach for batches.

---

## 3. THE RULES — Non-Negotiable

These come from `CLAUDE.md` (project instructions) and from user corrections during the session.
**Violating these is the single fastest way to lose the user's trust.**

### 3.1 Approval gates (from `CLAUDE.md`)

1. **Analyze the complete script before choosing scenes.** Never generate from a partial read.
2. **Ask which portions need video and whether audio is required** when unspecified.
3. **Never draft prompts until the user approves prompt drafting.**
4. **Present the visual bible and prompts for review** before generating.
5. **Never generate until the user explicitly approves** the exact scenes, prompts, estimated
   cost, and reference assets.
6. **Never set `confirmPaidGeneration` / `--confirm true` yourself based on implied approval.**
   Approval for images is NOT approval for video. Approval for one batch is NOT approval for a
   retry.
7. **Never retry a failed generation automatically.** Always report the failure and ask.
8. **Return the local output folder and individual MP4 paths** when done.

### 3.2 Content rules

- **Max 3 PNG/JPEG reference views of the same subject per scene.**
- **Supplied logos** → use as image-to-video starting frame. Never ask the model to reconstruct
  wording. Prohibit all readable text, letters, captions, slogans, signage, subtitles, and
  synthetic wordmarks.
- **Asset start/end seconds are approximate storytelling guidance**, not frame-exact editing.
- **Default to silent video** unless the user explicitly asks for generated audio. (Both
  projects are silent — the Nepali VO is added in post.)
- **NO readable text, numbers, or digits in any frame, ever**, unless explicitly requested.
  This includes: script line-number markers like `(1)`, quantities from the script
  (e.g. "100 families / 46 seats" → convey via a nearly-full ledger, never numerals), phone
  numbers, app UI text, and manuscript writing (use "decorative unreadable marks").

### 3.3 THE CULTURAL RULE — most important lesson of the session

> **"Everything is to be Nepal centric — people, culture, language, traditions, everything."**
> — the user, verbatim

The image model **constantly drifts** toward generic/wrong cultures unless explicitly blocked.
Observed real failures this session:

| Beat | What the model produced | Should have been |
| --- | --- | --- |
| Bamsawali 02 | European stone cottages, Mediterranean fields, European cattle | Nepali terraced paddies, hill oxen |
| Bamsawali 03 | Middle Eastern desert mesa, keffiyeh-style headwraps | Green Nepali mid-hills, doko baskets |
| Bamsawali 05 | Central Asian fur hat, large drawn broadsword | Dhaka topi, sheathed khukuri |
| Bamsawali 06 | Half-timbered Tudor/German village, European folk dress | Stone/slate Nepali houses, dhaka shawls |
| Bamsawali 01 | Generic knit sweaters, plain skirts | Daura-suruwal, gunyu-cholo, dhaka topi |
| Janai 04 (Bali) | Horned red-eyed fantasy demon w/ warhammer | Regal human Asura king, mukuta crown |
| Janai 04 (retry) | European lion-crest plate armor + broadsword | Mahabharat/Ramayana-serial Indian royal |

**Mandatory Nepali anchoring block — paste into every prompt with people or settlements:**

```text
Specifically Nepali Himalayan hill setting, not generic South Asian, not European, not Middle
Eastern, not Central Asian, not Tibetan: stone-and-mud-mortar houses with slate roofs, carved
wooden window frames often painted blue, terraced rice/millet paddies following the hill
contours, water buffalo or hill oxen (not European cattle), men in daura-suruwal (wrapped tunic
and trousers with a cloth waistband) and dhaka topi caps, women in gunyu-cholo (wrapped skirt
and blouse) with dhaka-pattern shawls, Himalayan foothill or mid-hill terrain with pine and
rhododendron forest, distant snow peaks optional.
```

**For Indian-mythological content** (the Janai Purnima project), the register is different —
the user's exact words: *"classic cultural sanskrit texts character, texts, like mahabharat,
ramayana"*. Anchor with: traditional gold **mukuta** crown, dhoti and angavastram, layered gold
Indian court jewelry, bare muscular torso with armlets, red tilak — **explicitly** no horns, no
glowing eyes, no Western plate armor, no fantasy weapons.

### 3.4 Standard negative-prompt block

```text
no readable text, no numbers, no digits, no logos, no watermark, no UI overlay, no speech
bubbles, no modern plastic, no distorted hands, no extra fingers, no melted or cloned faces,
no over-smoothed skin, no fantasy glow, no magic beams, no caricatured figures, no gore,
no modern objects in historical scenes.
```

---

## 4. THE PIPELINE — Repeatable 7-Step Workflow

This is the process that produced both finished projects. Follow it in order.

### Step 1 — Analyze the full script

Read the entire script before touching anything. Produce:
- **Line-by-line Nepali→English translation table** (literal enough to preserve meaning).
- **Context analysis**: setting, era, characters (or explicitly *no characters*), emotional arc,
  sensitive handling notes.
- **Character inventory**: does this script even have recurring characters? The Bamsawali script
  did **not** (it's conceptual/documentary, so all beats are symbolic tableaux). The Janai
  Purnima script did (Bali, Brihaspati, Brahma).

### Step 2 — Ask the required questions

Format (9:16 vs 16:9), audio (silent vs SFX), scope (which lines need video), and anything
genuinely ambiguous. **Do not ask about things you can decide from the script.**

### Step 3 — Beat plan with timing math

Map each script line to a beat. Estimate spoken duration at roughly **2.2 Nepali words/second**
(dramatic narration pace), then snap to Veo's allowed `4 / 6 / 8` seconds. Short connector lines
get 4s; priority/emotional beats get 6s; the longest lines get 8s or split into two clips
(e.g. Janai `beat11a` + `beat11b`).

If the user marks lines with priority markers (the Bamsawali script used `(1)`…`(5)`),
**prioritize those beats** for the strongest visual treatment — and never render the marker.

### Step 4 — Lock character references FIRST (if the script has characters)

Generate one clean, full-body, neutral-pose, plain-background reference per character. Approve
each with the user **before** any scene work. Then paste that character's full text description
**verbatim into every scene prompt** (the image model has no memory between calls) **and**
attach the reference PNG via `--ref` / `referenceImages`.

### Step 5 — Write the prompt-pack markdown BEFORE generating

Create `<project>/prompts.md` containing: source task, output folders, references used,
translation table, context analysis, locked character descriptions, shared prompt prefix, beat
plan table, reuse decisions, **every individual prompt in full**, verification plan. This is a
hard requirement from `master_prompt_image_generation_file.md` §16 Step 2.

### Step 6 — Generate start + end frame images

For each beat, generate a `_start.png` and an `_end.png`. The end frame should be *"the same
scene a moment later"* with a specific, describable change (hand completes a motion, crowd leans
in, light warms, mist thins). **Attach the start frame as a reference when generating the end
frame** for continuity.

Then **spot-check every frame visually** (actually `Read` the PNGs — a file count is not
verification) and reroll failures with **one precise correction**, not a full rewrite.

**Present to the user and stop.** Do not proceed to video without explicit approval.

### Step 7 — Generate video via `image` + `lastFrame` interpolation

This is what makes the output feel coherent instead of like 13 unrelated AI clips.

```js
await ai.models.generateVideos({
  model: "veo-3.1-generate-001",
  prompt: beat.prompt,
  image:     { imageBytes: startB64, mimeType: "image/png" },
  config: {
    numberOfVideos: 1,
    durationSeconds: beat.duration,      // 4 | 6 | 8
    aspectRatio: "9:16",
    resolution: "720p",                   // 9:16 is capped at 720p
    outputGcsUri: `gs://auto-504509-veo-output-26/<project>/<beat>/`,
    generateAudio: false,
    lastFrame: { imageBytes: endB64, mimeType: "image/png" }
  }
});
```

Poll `ai.operations.get({ operation })` every 10s until `operation.done`, then
`gcloud storage cp <uri> <local.mp4>`.

---

## 5. Failure Modes & Their Fixes

Every one of these was hit for real this session. Recognize them instantly.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `{"code":8,"message":"The service is currently experiencing high load"}` | **Transient Veo capacity.** Not your prompt, not billed. | Wait and retry — **but ASK THE USER FIRST** (no-auto-retry rule). Succeeded on retry every time it happened. |
| `{"code":429,"RESOURCE_EXHAUSTED"}` | Image-gen rate limit from rapid sequential calls. | Sleep 20–25s and retry. Always put `await sleep(4000)` between batch items. |
| `promptFeedback.blockReason: "SAFETY"` on a totally benign prompt | False-positive filter. Triggered by *phrasings*, not content. Known triggers: `"Concept art character design sheet for an animated mythological film"`; naming a revered religious figure in a devotional full-body portrait; "restrained… mid-battle". | Rephrase, don't argue. Bisect the prompt to find the trigger phrase. Softer framing works ("gently tying… during a divine ritual" passed where "binding… restrained mid-battle" failed). |
| `raiMediaFilteredCount: 1` in Veo response, no video | Video-level safety filter. **Explicitly not charged** — Google's message says so. | Rephrase the action to be less martial/restraint-y. |
| `Cloud Storage download failed: 'C:\…\Google\Cloud' is not recognized` | The old hardcoded gcloud path bug. | **Already fixed** in `server.mjs`. If it reappears in a standalone script, use plain `"gcloud"`. |
| `operation._fromAPIResponse is not a function` | Passing a bare `{name}` object to `ai.operations.get()`. | Either keep the real operation object from `generateVideos()`, or hit the REST endpoint `…:fetchPredictOperation` directly with an ADC bearer token. |
| Model ignores composition instructions, reuses the reference image's framing | **`gemini-2.5-flash-image` anchors HARD to supplied reference images**, resisting large compositional/setting changes. | **Drop the reference image entirely** for shots that need a radically different framing (this is how the true macro shot was finally achieved), or anchor to a *different* image that already has the target composition. |
| `Cannot find package '@google/genai'` | Script run from outside the project dir. | Always `cd "f:/BUSINESS/Content Machine"` first — `node_modules` lives there. |

---

## 6. Reusable Script Templates

Write these to a temp `.mjs` in the project root, run with `node`, then **delete them** when
done (keeps the repo clean — this was the pattern all session).

### 6.1 Batch image generation

```js
import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ai = new GoogleGenAI({ vertexai: true, project: "auto-504509", location: "us-central1" });
const outDir = "<pack>/images";
await mkdir(outDir, { recursive: true });

const NEG = "no readable text, no numbers, no digits, no logos, no watermark, no distorted hands, no extra fingers, no melted or cloned faces, culturally Nepali not generic.";
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gen(id, prompt, refs = []) {
  const parts = [{ text: prompt }];
  for (const r of refs) {
    const b = await readFile(r);
    parts.push({ inlineData: { mimeType: "image/png", data: b.toString("base64") } });
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } }
      });
      const img = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!img) { console.log(id, "NO IMAGE", JSON.stringify(res.promptFeedback || "unknown")); return; }
      const target = path.join(outDir, `${id}.png`);
      await writeFile(target, Buffer.from(img.inlineData.data, "base64"));
      console.log(id, "OK ->", target);
      return;
    } catch (e) {
      if (e.message.includes("RESOURCE_EXHAUSTED")) { console.log(id, "rate limited, retrying…"); await sleep(25000); continue; }
      console.log(id, "FAIL", e.message.slice(0, 200)); return;
    }
  }
}

for (const [id, prompt, refs] of jobs) { await gen(id, prompt, refs); await sleep(4000); }
```

### 6.2 Batch video generation (start+end interpolation)

```js
import { GoogleGenAI } from "@google/genai";
import { readFile, mkdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const ai = new GoogleGenAI({ vertexai: true, project: "auto-504509", location: "us-central1" });
const bucket = "auto-504509-veo-output-26";
const imagesDir = "<pack>/images", videosDir = "<pack>/videos";
await mkdir(videosDir, { recursive: true });

const download = (uri, target) => new Promise((resolve, reject) => {
  const p = spawn("gcloud", ["storage", "cp", uri, target], { windowsHide: true, shell: true });
  let err = ""; p.stderr.on("data", c => err += c);
  p.on("error", reject);
  p.on("close", code => code === 0 ? resolve() : reject(new Error(err.slice(0, 300))));
});

for (const beat of beats) {   // beat = { id, duration, prompt }
  try {
    const s = await readFile(path.join(imagesDir, `${beat.id}_start.png`));
    const e = await readFile(path.join(imagesDir, `${beat.id}_end.png`));
    let op = await ai.models.generateVideos({
      model: "veo-3.1-generate-001",
      prompt: beat.prompt,
      image: { imageBytes: s.toString("base64"), mimeType: "image/png" },
      config: {
        numberOfVideos: 1, durationSeconds: beat.duration, aspectRatio: "9:16",
        resolution: "720p", outputGcsUri: `gs://${bucket}/<project>/${beat.id}/`,
        generateAudio: false,
        lastFrame: { imageBytes: e.toString("base64"), mimeType: "image/png" }
      }
    });
    while (!op.done) { await new Promise(r => setTimeout(r, 10000)); op = await ai.operations.get({ operation: op }); }
    if (op.error) { console.log(beat.id, "ERROR", JSON.stringify(op.error)); continue; }
    const v = op.response?.generatedVideos?.[0];
    if (!v?.video) { console.log(beat.id, "NO VIDEO", JSON.stringify(op.response)); continue; }
    const target = path.join(videosDir, `${beat.id}.mp4`);
    await download(v.video.uri, target); await access(target);
    console.log(beat.id, "OK ->", target);
  } catch (err) { console.log(beat.id, "FAIL", err.message.slice(0, 300)); }
}
```

### 6.3 Recovering videos when generation succeeded but download failed

```powershell
$token = gcloud auth application-default print-access-token
$url = "https://us-central1-aiplatform.googleapis.com/v1/projects/auto-504509/locations/us-central1/publishers/google/models/veo-3.1-generate-001:fetchPredictOperation"
$body = @{ operationName = "<full/operation/name>" } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri $url -Method Post -Headers @{Authorization="Bearer $token"} -ContentType "application/json" -Body $body
$resp.response.videos[0].gcsUri
```

Then `gcloud storage cp "<gsUri>" "<local.mp4>"`. **Re-downloading is not re-generating — no
new charge.**

---

## 7. PROJECT A — "The Sacred Thread of Janai Purnima"

**Project ID:** `the-sacred-thread-of-janai-purnima-d641341b`
**Folders:** `output/the-sacred-thread-of-janai-purnima-d641341b/{images,videos}/`
**Prompt pack:** `prompt/the-sacred-thread-of-janai-purnima-d641341b/prompts.md`
**Format:** 9:16, silent, 720p, `veo-3.1-generate-001`

### 7.1 Story

Nepali promo script for a "Janai Purnima set" product. Vishnu Purana arc: demon king **Bali**,
blessed by **Brahma**, drives the gods from heaven → gods flee to **Guru Brihaspati** →
Brihaspati performs a ritual creating a sacred thread (raksha-sutra) → Bali receives it and is
sanctified → that same thread is what Nepalis tie on their wrist today → product CTA.

### 7.2 Locked character references (in `output/quick/`)

| Character | File | Description (paste verbatim into prompts) |
| --- | --- | --- |
| **Guru Brihaspati** | `image-2026-08-18T08-19-19-540Z-1.png` | Elderly Vedic sage, long flowing white beard and white hair, warm brown skin, calm dignified expression, draped saffron-orange robes, large wooden rudraksha-style bead necklaces, holding a wooden staff topped with a crystal orb, bare feet in simple sandals. |
| **Demon King Bali** | `image-2026-08-18T08-23-04-170Z-1.png` | Muscular Indian king, dark bronze skin, strong noble jawline, fierce but dignified expression, **no horns, no glowing eyes**, long dark hair, tall golden mukuta-style crown, layered gold necklaces and gold armlets, red-and-gold silk dhoti and angavastram over a bare muscular torso, gold anklets, bare feet, red tilak on forehead. |
| **Brahma** | `image-2026-08-18T09-33-06-655Z-1.png` | Four-headed deity, three faces visible from the front, one head behind, four arms, elderly serene bearded faces, warm bronze-gold skin, white and saffron robes, gold jewelry and a tall crown, seated on a lotus, holding a lotus flower, a mala, a kamandalu, and a scripture book. |
| **Present-day devotee** | `image-2026-08-18T09-35-10-771Z-1.png` | Hands and forearm only, **face never shown**, warm skin tone, off-white and saffron traditional sleeve fabric, red-and-gold kalava thread on the wrist. |
| **Product** | `image-2026-08-18T09-35-28-009Z-1.png` | Flatlay of coiled red-and-gold kalava threads, brass diya, marigold petals, rice grains, dark wood, warm side light, no text/logo. |

Devas (no single lock): radiant otherworldly beings, luminous golden-bronze skin with subtle
inner glow, tall ornate gold crowns, layered gold/gemstone jewelry, shimmering white-and-gold
silks, soft golden aura.

### 7.3 Final 13-beat structure — ALL VIDEOS COMPLETE

| Beat | Script line | Content | Dur | File |
| --- | --- | --- | --- | --- |
| 01 | जनै पुर्णिमा…त्यो सानो डोरो | Modern hands tying the thread (hook) | 4s | `beat01.mp4` |
| 02 | (same line, match-cut) | Same thread on Bali's wrist, stopping his attack | 4s | `beat02.mp4` |
| 03 | ब्रह्मजीको वरदान पाएका | Bali kneeling, receiving Brahma's blessing | 4s | `beat03.mp4` |
| 04 | देवताहरूलाई स्वर्गबाट लखेटेपछि | Gods flee heaven as Bali strides through the gate | 4s | `beat04.mp4` |
| 05 | देवताहरु गुरु बृहस्पतितिर पुगे | Brihaspati opens his eyes; gods kneel pleading | 4s | `beat05.mp4` |
| 06 | एउटा रक्षा-विधि…डोरो श्रीजना गरे | Ritual creates the glowing thread | 6s | `beat06.mp4` |
| 07 | गुरु वृहस्पतिले…डोरोले बधिदिए | **Bali bows and ties the thread on HIMSELF** | 6s | `beat07.mp4` |
| 08 | डोरी बढेपछि…सन्त भएको | Demon army calms, kneels in reverence | 6s | `beat08.mp4` |
| 09 | तेही डोरी आज हामि…बध्छौ | Present-day festival thread-tying | 6s | `beat09.mp4` |
| 10 | त्यो डोरीले…आत्मा शान्त गराउछ | Extreme macro of the thread, subtle glow | 6s | `beat10.mp4` |
| 11a | र हरेक वर्ष…(part 1) | Window silhouette, contemplative reflection | 8s | `beat11a.mp4` |
| 11b | …लगाउन नबिर्सिनुहोला (part 2) | Folded hands, settled contentment | 6s | `beat11b.mp4` |
| 12 | तपाईंको यो पूर्णिमा…जानकारी | Product reveal / CTA | 8s | `beat12.mp4` |

Total ≈ 72s. **User correction incorporated:** beat07 originally had Brihaspati tying the thread
onto Bali; the user corrected that **Bali respects Brihaspati, bows, and puts it on himself.**

### 7.4 Legacy files — safe to delete

`scene_01.mp4` … `scene_05.mp4` and `scene_0*_start/end.png` are from an earlier 5-scene-only
version, **superseded by the 13-beat structure**. The user was asked about deleting them and
never answered — leave them unless asked. Note `scene_03.mp4` is still the old text-to-video
version (its frame-interpolated regen failed twice on transient load and was left on hold).

### 7.5 ⚠️ OUTSTANDING REQUEST — DO THIS FIRST

The user's most recent production request on this project, **not yet actioned**:

> *"for the red thread video, replace the video scene of gods running towards guru brihaspati"*

That is **beat05** (`देवताहरु गुरु बृहस्पतितिर पुगे`) — currently `beat05_start.png` (Brihaspati
meditating as a Deva approaches) → `beat05_end.png` (Devas kneeling before him) →
`beat05.mp4`. The user wants this scene **replaced**. They did not specify what to replace it
with, so **ask** what they want instead before regenerating. Then: new start/end frames → user
review → new `beat05.mp4`.

---

## 8. PROJECT B — "Bamsawali App Launch"

**Folders:** `bamsawali-app-launch-image-pack/{images,videos}/`
**Prompt pack:** `bamsawali-app-launch-image-pack/bamsawali-app-launch-image-prompts.md`
**Format:** 9:16, silent, 720p, `veo-3.1-generate-001`

### 8.1 Story

Nepali explainer → product pitch. How surnames (**thar**) originated: in ancient times there was
no paper or record, so identity came from **place**, **work**, and **lineage** → place-names
became surnames (Paudi→Paudel, Pokhar→Pokhrel, Daha→Dahal) → occupations became surnames
(Bhandari/storekeeper, Adhikari/administrator, Khadka/weapon-bearer) → society recognized it →
time made it permanent → **today it's fading and we don't recognize our own relatives** →
**Bamsawali App** digitizes your family tree → limited seats this month → contact CTA →
"जय कुलदेवता!"

**No recurring characters** — every beat is a symbolic/documentary tableau. This was verified
against the script, not assumed.

### 8.2 Priority markers

The user marked lines with `(1)`…`(5)`. These are **beat-priority markers to prioritize
visually — and must NEVER be rendered as digits.** They map to beats 01, 02, 05, 06, 08.

### 8.3 Final 14-beat structure — ALL VIDEOS COMPLETE

| Beat | Content | Priority | Dur | File |
| --- | --- | --- | --- | --- |
| 00 | Newborn received into grandmother's arms — carries a thar before a name | hook | 4s | `00-baby-born-with-thar.mp4` |
| 01 | Oral-only world: elder speaks by lamplight, **no paper anywhere** | **(1)** | 4s | `01-no-records.mp4` |
| 02 | Place + work + lineage: farmer, weaver, elder & child | **(2)** | 6s | `02-place-work-lineage.mp4` |
| 03 | Villagers name a family by the ridge they came from | — | 4s | `03-name-attaches.mp4` |
| 04 | Layered Himalayan terrain — place-born surnames | — | 4s | `04-place-based-surnames.mp4` |
| 05 | Storekeeper, official, guard — work-born surnames | **(3)** | 6s | `05-work-based-surnames.mp4` |
| 06 | Community recognizes the family | **(4)** | 6s | `06-society-recognized.mp4` |
| 07 | Time-passing: doorway onto a mountain trail | — | 4s | `07-time-made-permanent.mp4` |
| 08 | Neglected manuscript, family disengaged | **(5)** | 6s | `08-tradition-obscured.mp4` |
| 09 | Relatives greet each other as strangers | — | 4s | `09-relatives-unknown.mp4` |
| 10 | Family digitizing the old record together | app pitch | 6s | `10-app-digital-preservation.mp4` |
| 11 | Nearly-full ledger + woven nametags = scarcity, **zero numerals** | urgency | 6s | `11-limited-seats-urgency.mp4` |
| 12 | Hand lifting a phone to message | CTA | 4s | `12-contact-cta.mp4` |
| 13 | Kul devata shrine, diya, marigold, praying hands | closing | 6s | `13-jai-kuldevata-closing.mp4` |

Total ≈ 70s. All 14 videos generated **first-try, zero failures**.

Each beat has `<slug>_start.png` and `<slug>_end.png`. The original single stills
(`<slug>.png`, beats 01–13) are retained for reference/reuse tracking.

---

## 9. Working Style the User Expects

Learned from direct feedback and corrections across the session:

- **Don't ask permission mid-task for things already approved.** The user said *"Now dont ask me
  anything until you finish making images"* — batch the work, report at the end.
- **But DO stop at the real gates** (before billed video, before a retry). These are different
  things and the user respects the distinction.
- **Actually LOOK at generated images.** `Read` the PNGs and critique them honestly. The user
  values catching drift before they have to. Every cultural fix this session came from an
  honest self-review, and the user explicitly reinforced the standard after one slipped through.
- **Report failures plainly**, including which ones weren't billed.
- **Clean up scratch `.mjs` scripts** after batch runs.
- **Keep the prompt-pack markdown updated** with reroll logs and final build summaries — the
  user reads these.
- **Long batches run in the background**; report when the notification arrives.

---

## 10. Immediate Next Actions for a Fresh Agent

1. **Confirm environment:** `cd "f:\BUSINESS\Content Machine"`, check
   `gcloud config get-value project` → `auto-504509`, and that ADC is valid.
2. **Handle the outstanding beat05 replacement** on the Janai Purnima project (§7.5) — ask the
   user what should replace the "gods running toward Guru Brihaspati" scene.
3. Optionally ask whether to delete the superseded `scene_*.mp4` / `scene_*_start|end.png`
   legacy files in the Janai Purnima folder.
4. For any **new** script: start at §4 Step 1 and follow the pipeline. Read
   `master_prompt_image_generation_file.md` alongside this file.

---

## 11. File Map

```text
f:\BUSINESS\Content Machine\
├─ MASTER_PROMPT_VIDEO_PIPELINE.md      ← this file
├─ master_prompt_image_generation_file.md ← image-prompt operating manual (READ IT)
├─ CLAUDE.md                             ← project rules / approval gates
├─ AGENTS.md, orchestrator_memory.md     ← agent rules (Codex-compatible)
├─ README.md                             ← "Frame Foundry" original docs
├─ .env                                  ← model + project config (no secrets)
├─ server.mjs                            ← Express orchestrator :4317
├─ agent-video.mjs                       ← CLI bridge
├─ public/                               ← browser UI (index.html, app.js, styles.css)
├─ output/
│  ├─ quick/                             ← character refs + one-off generations
│  └─ the-sacred-thread-of-janai-purnima-d641341b/
│     ├─ images/  (beat01_start … beat12_end, + legacy scene_*)
│     └─ videos/  (beat01 … beat12, + legacy scene_*)
├─ prompt/
│  └─ the-sacred-thread-of-janai-purnima-d641341b/prompts.md
└─ bamsawali-app-launch-image-pack/
   ├─ bamsawali-app-launch-image-prompts.md
   ├─ images/  (00-… _start/_end … 13-… _start/_end)
   └─ videos/  (00-baby-born-with-thar … 13-jai-kuldevata-closing)
```
