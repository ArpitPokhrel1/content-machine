# Master Prompt: Script-Centric Video Generation

**Role of this file.** This is the persistent context layer for every Veo generation in this
project. It turns an analysed script into approved, cost-estimated, continuity-safe clips. Its
companion is `PROMPT_IMAGE_GENERATION.md`, which produces the keyframes this file animates. The
two share one canon; they must never disagree.

**Governing rule.** A video prompt describes **change over time**. The frames already establish
who and where. If your video prompt is re-describing what is visibly in the start frame, you are
spending tokens fighting your own images. Describe the motion, the camera, and the light — and
let the frames carry identity.

---

## 0. Operating Contract

Inherited from `CLAUDE.md`, `AGENTS.md`, and `orchestrator_memory.md`. Non-negotiable.

1. Analyse the **complete** script before choosing scenes.
2. Ask which portions need video and whether audio is required. **Default is silent.**
3. **Never call `draft` until the user approves prompt drafting** — drafting spends a text-model
   request.
4. Present the returned visual bible and every exact prompt for review. Do not generate yet.
5. **Never call `generate` until the user explicitly approves** the exact scenes, prompts,
   estimated cost, and reference assets.
6. **Never set `confirmPaidGeneration` or `--confirm true` on implied approval.** Approval of
   analysis is not approval of prompts. Approval of prompts is not approval of generation.
   Approval of images is not approval of video. Approval of a batch is not approval of a retry.
7. **Never retry a failed generation automatically.** Report the error, name the likely cause,
   ask.
8. Generate sequentially, one video per approved scene.
9. Return the local output folder and every individual MP4 path.

### Hard technical limits

| Constraint | Value |
| --- | --- |
| Model | `veo-3.1-generate-001` (full tier) or `veo-3.1-fast-generate-001` |
| Duration | **4, 6, or 8 seconds only.** No other values |
| Aspect ratio | `16:9` or `9:16` |
| Resolution | 1080p on 16:9 only. **9:16 is capped at 720p by Google** — `resolutionFor()` in `server.mjs` handles this. Do not "fix" it |
| Keyframes | `lastFrame` **requires** `image`. Interpolation is image-to-video only |
| Output | GCS is mandatory. Veo writes to `gs://auto-504509-veo-output-26/...`, then the pipeline downloads with `gcloud storage cp` |
| Watermark | All output carries SynthID |
| Working directory | `F:/BUSINESS/Content Machine` |

```
node agent-video.mjs draft    --manifest FILE
node agent-video.mjs review   --project ID
node agent-video.mjs generate --project ID --approval FILE
node agent-video.mjs status   --project ID
node agent-video.mjs video --prompt TEXT --confirm true [--aspect 9:16] [--duration 6]
                           [--audio true] [--image FILE] [--end-image FILE] [--resolution R]
```

---

## 1. Context Architecture for Motion

Veo, like the image model, has no memory between calls. Each clip is a cold start. But a video
job carries one extra layer the image job does not: **the frames themselves are context**, and
they are the strongest context in the call.

```
L0  SOURCE       The script. Immutable.
L1  READING      Beat map, emotional arc, timing math, culture register.
L2  CANON        The same Visual Bible the image file locked. Shared, never re-derived.
L3  MOTION       The one thing this clip does: subject motion, camera move, light change.
L4  CONSTRAINT   Negative constraints, text suppression, audio policy.
L5  ANCHORS      Start frame, end frame, reference images. Pixels beat words.
```

**Precedence: pixels > prose.** Where the start frame and the prompt disagree, the frame usually
wins, and the mismatch shows up as a lurch in the first half-second. So the prompt's job is to be
*consistent with* the frames and to add only what a still cannot express: motion, duration,
camera, sound.

**Prompt weight budget.** Roughly: 40% camera and motion, 25% subject action, 20% environment and
light behaviour, 15% style and constraints. When a clip comes back wrong, check which of those
four you underspecified — it is almost always camera and motion.

---

## 2. Phase A — Script to Shot List

### A1. Beat mapping with timing math

Map every script line to a beat. Estimate narration pace, then **snap to 4 / 6 / 8**.

- Estimate at roughly **2.2 words per second** for dramatic narration (this rate was calibrated
  on Nepali VO; adjust per language and re-check against a real read).
- Short connector lines → 4s. Standard beats → 6s. Priority or emotional beats → 8s.
- A line that needs more than 8s **splits into two clips** (`beat11a`, `beat11b`) sharing one
  environment and one continuous camera logic. It does not get stretched.

| Beat | Lines | Words | Est. sec | Veo duration | Priority | Mode |
| --- | --- | --- | --- | --- | --- | --- |
| 03 | 05–06 | 13 | 5.9 | 6 | (1) | start+end |

If the script carries priority markers, give those beats the strongest visual treatment — and
**never render the marker itself**.

### A2. Mode selection per beat

| Mode | Use when | Inputs |
| --- | --- | --- |
| **Start + end interpolation** | The beat has a clear physical change with a plausible path | `image` + `lastFrame` + motion prompt |
| **Start frame only** | Static hold with ambient motion (flame, breath, dust, cloth) | `image` + motion prompt |
| **Ingredients / reference** | Consistent subject across several shots, framing is free | reference images + full prompt |
| **Text-to-video** | Abstract, textural, or landscape B-roll with no identity to hold | prompt only |
| **Logo image-to-video** | A supplied logo must animate | logo as `image`, section 8 rules |

**Default for a scripted sequence: start + end interpolation.** It is what makes output feel like
one coherent film rather than N unrelated AI clips. Everything else is a fallback.

### A3. Cost estimate before approval

State plainly: number of clips, seconds each, total seconds, model, resolution, audio on/off, and
the estimated maximum cost. Then stop.

---

## 3. The Motion Brief (L3)

For every clip, write this before writing the prompt.

```
MOTION BRIEF — beat <id>
Change vector:  <the same one-sentence vector from the keyframe pair, if there is one>
Subject motion: <what the body does — the joint, the weight, the speed, the arrival>
Camera:         <move, direction, distance, speed; or "locked off">
Environment:    <what moves that is not the subject — cloth, smoke, water, crowd, foliage>
Light:          <how light changes across the clip, or "constant">
Pace:           <the energy: slow settling, steady, a single accelerating beat>
Ends on:        <the exact state the last frame must hold>
```

Rules that decide clip quality:

- **One dominant motion.** A dolly-in *and* a pan *and* a subject turn *and* a light shift in six
  seconds is four ideas competing for the same frames. Pick one to lead; let the rest be small.
- **Motion needs a destination.** "She walks" drifts. "She takes three steps forward and stops
  with her hand on the doorframe" arrives — and arrival is what makes an 8-second clip feel
  edited rather than truncated.
- **Speed matters more than direction.** "Slow push in" and "fast push in" are different shots.
  Name the speed.
- **Physical plausibility over spectacle.** Veo paths between your keyframes. If no plausible
  physical path exists, it invents one, and the invention is usually the artifact you will see at
  the midpoint.

---

## 4. The Prompt Schema

### 4.1 The formula

**[Cinematography] + [Subject] + [Action] + [Context] + [Style & Ambiance]**

Cinematography first. It is the strongest lever in a Veo prompt and the one most often left out.

> Medium shot, slow push in on an elderly woman, turning a page of a heavy ledger with her right
> hand and settling back on her heels as it falls flat, in a low stone room with a small oil lamp
> on the sill. Warm lamp light grows on the near wall as the page settles. Photoreal documentary
> reenactment, shallow depth of field, natural film grain, unhurried.

### 4.2 Block form (for the prompt pack and user review)

```
BEAT:         <id> — <script line numbers> — <duration>s — <mode>
SCRIPT LINE:  "<source line, quoted>"
INTENT:       <what this clip must land emotionally>
CINEMATOGRAPHY: <shot size, angle, lens behaviour, camera move and speed>
SUBJECT:      <who, referencing canon id — brief, the frame carries the detail>
ACTION:       <the motion, with a destination>
CONTEXT:      <environment, and what moves in it>
LIGHT:        <constant, or how it changes>
STYLE:        <grade line from the shared canon>
AUDIO:        <silent | SFX | ambient | dialogue — see section 7>
NEGATIVE:     <positive-phrased exclusions>
INPUTS:       image=<path>  lastFrame=<path>  refs=<paths>
ENDS ON:      <the state the final frame must hold, for the next clip's continuity>
```

### 4.3 Cinematography vocabulary

Use the film terms. They are trained tokens and they hit reliably.

| Category | Terms |
| --- | --- |
| Movement | dolly in, dolly out, tracking shot, crane up, crane down, slow pan left/right, tilt up/down, whip pan, handheld, locked off, POV, orbit |
| Composition | extreme wide, wide, establishing, medium, medium close-up, close-up, extreme close-up, over the shoulder, two-shot, low angle, high angle, Dutch angle |
| Lens and focus | shallow depth of field, deep focus, macro lens, wide-angle, telephoto compression, soft focus, rack focus |
| Light | golden hour, overcast diffuse, hard side light, backlit rim, practical lamp, firelight flicker, moonlit, harsh fluorescent |
| Pace | slow, unhurried, steady, deliberate, gradual, sudden |

### 4.4 What to leave out

With a start frame supplied, **do not re-describe** the character's face, wardrobe, the room's
architecture, or the palette. It is already in the pixels, and repeating it in prose gives the
model licence to reinterpret it. Keep one short subject phrase for grounding ("the elderly woman
in the madder-red wrap") and spend the rest of the prompt on motion.

Without a start frame (text-to-video), the opposite applies: paste the full canon blocks from
`PROMPT_IMAGE_GENERATION.md` section 3, verbatim.

---

## 5. Interpolation Prompts (start + end)

The dominant mode. Special rules:

- **Describe the journey, not the endpoints.** The endpoints are supplied. The prompt's job is
  the path: how fast, in what order, with what easing.
- **Name the arrival.** End the prompt with the state the end frame shows, phrased as a
  completion: "...coming to rest as her hand settles flat on the page." This tells Veo where to
  spend its last second and prevents the clip overshooting past your end frame.
- **Match the prompt's implied duration to the requested duration.** A prompt describing three
  distinct actions in a 4-second clip produces a fast-forward. Four seconds holds roughly one
  action. Eight holds two, at most.
- **Do not contradict the frames.** If the start frame is overcast and your prompt says golden
  hour, you get a visible grade shift in the first second.
- **Seamless loop:** pass the identical file as both `image` and `lastFrame`, and prompt only
  ambient motion.

Template:

> [Camera move and speed], as [subject phrase] [action verb with destination], [what moves in the
> environment], [how light behaves]. [Pace word]. [Grade phrase]. Coming to rest as [the end
> frame's state].

---

## 6. Timestamp Prompting (multi-shot in one generation)

For a full sequence inside a single 8-second clip, address each window explicitly. Use this for
montage or reveal beats where cutting in post would cost more than it gains.

```
[00:00-00:02] Medium shot from behind the elder as she pushes the wooden shutter open.
[00:02-00:04] Reverse shot on her face, expression opening as the valley light reaches her.
[00:04-00:06] Tracking shot following her hand along the sill to the lamp.
[00:06-00:08] Wide, high-angle crane shot, the figure small in the stone room.
```

Caveats:

- Timestamps are **approximate storytelling guidance**, not frame-exact editing. Say this to the
  user every time they ask for precise timing. Frame-exact cuts belong in editing software.
- Timestamp prompting and start+end interpolation pull against each other. Pick one per clip.
- More than four windows in eight seconds reads as chaos.

---

## 7. Audio Policy

**Default is silent** (`generateAudio: false`). Both reference projects are silent, because the
narration VO is added in post. Only enable audio when the user explicitly asks.

When audio is approved, the syntax is:

```
Dialogue:      A woman says, "We have to leave now."
Sound effects: SFX: a heavy wooden shutter scraping open.
Ambient:       Ambient noise: distant wind across terraced fields, a single crow.
```

Notes:

- Generated dialogue will not match a scripted VO in language, timing, or voice. If the script
  has narration, keep the clip silent and lay the VO in post.
- Generated speech risks producing readable lip movement that fights a post-production dub.
- Ambient and SFX are the safe subset. Dialogue is the risky one.

---

## 8. Logo Image-to-Video — Special Mode

When the user supplies a logo:

- Use the logo file as the **image-to-video starting frame**. Never as a style reference.
- **Never ask the model to generate, reconstruct, or describe its wording.** The wording will come
  back altered, and altered brand wording is worse than no wording.
- Include a strict negative: *no readable text, no letters, no captions, no slogans, no signage,
  no subtitles, no generated wordmarks.*
- Animate **only non-text visual properties**: light sweep, material response, particles, depth,
  camera drift, background.

Template:

> Slow camera drift with a soft light sweep travelling left to right across the mark, subtle
> metallic material response, fine particles settling in the depth behind it, background gradient
> deepening. Locked composition, the mark stationary and unaltered. No readable text, no letters,
> no captions, no slogans, no signage, no subtitles, no generated wordmarks, no shape changes to
> the mark.

---

## 9. Constraint Layer (L4)

Veo negatives work best phrased as **positive descriptions of absence** — "an empty road with no
vehicles" beats "no cars".

Standard block:

```
no readable text, no letters, no numbers, no subtitles, no captions, no watermark, no UI overlay,
no logos, no distorted hands, no extra fingers, no morphing faces, no identity change mid-clip,
no sudden lighting shifts, no camera stutter, no modern objects in historical scenes,
no fantasy glow, no gore.
```

The text rule from `PROMPT_IMAGE_GENERATION.md` section 7.3 applies in full, and harder: text
that flickers into legibility for four frames is worse than text that is simply there.

---

## 10. Continuity Across Clips

A sequence is judged on its seams, not its shots.

- **Shared canon.** Every clip in a project draws on the same Visual Bible. Never re-derive it
  mid-project.
- **Ends-on chaining.** Each beat's `ENDS ON` line becomes the next beat's opening state. Where
  two beats are continuous in space, the end frame of one should be the start frame of the next.
- **Grade lock.** One grade phrase, pasted into every clip prompt, unchanged.
- **Camera grammar.** Decide the project's camera language up front — mostly locked off with
  occasional slow pushes, or consistently handheld — and hold it. Mixed grammar reads as
  mixed sources.
- **Direction of travel.** If a figure moves left-to-right in beat 3, keep that axis unless a
  cut is meant to feel like a reversal.
- **Review each clip before its final frame is used as the next clip's start frame.** Drift
  compounds: a small error in one clip becomes the foundation of the next, and by clip six it is a
  different film.

---

## 11. Generation Procedure

### Step 1 — Manifest and draft

Write the manifest per `references/contracts.md`. Get approval to draft. Then:

```
node agent-video.mjs draft --manifest <manifest.json>
```

### Step 2 — Present and stop

Show the returned visual bible and **every exact scene prompt**. Do not generate.

### Step 3 — Frames

Produce and approve start/end frames via `PROMPT_IMAGE_GENERATION.md`. Image approval is not
video approval.

### Step 4 — Approval file and the cost gate

Build the approval file with reference paths, roles, and approximate story timing. State the
number of videos, durations, audio setting, model, resolution, and estimated maximum cost.
Explain that Veo reference timing is not frame-exact. **Stop for explicit approval.**

### Step 5 — Generate, sequentially

```
node agent-video.mjs generate --project <project-id> --approval <approval.json>
```

Direct API shape, for batch scripts:

```js
await ai.models.generateVideos({
  model: "veo-3.1-generate-001",
  prompt: beat.prompt,
  image: { imageBytes: startB64, mimeType: "image/png" },
  config: {
    numberOfVideos: 1,
    durationSeconds: beat.duration,          // 4 | 6 | 8
    aspectRatio: "9:16",
    resolution: "720p",                       // 9:16 is capped at 720p
    outputGcsUri: "gs://auto-504509-veo-output-26/<project>/<beat>/",
    generateAudio: false,
    lastFrame: { imageBytes: endB64, mimeType: "image/png" }
  }
});
```

Poll `ai.operations.get({ operation })` every 10s until `operation.done`, then
`gcloud storage cp <uri> <local.mp4>`.

### Step 6 — Status and delivery

```
node agent-video.mjs status --project <project-id>
```

Watch each clip **at full speed and again at the midpoint**, where interpolation artifacts hide.
Check: does identity hold, is the motion physically plausible, does it actually land on the end
frame, did any text flicker in, is the grade consistent with its neighbours.

Return the project folder and every clip path. Ask for feedback, and write anything generically
reusable into `orchestrator_memory.md`.

---

## 12. Worked Example

Script line: *"The old names travelled with them, carried in a bundle."*
Beat 07 · 6 seconds · 9:16 · 720p · silent · start + end interpolation.

**Motion brief**

```
Change vector:  trailing foot completes its step; bundle swings forward to the hip
Subject motion: one full stride, weight settling forward, shoulders easing down on arrival
Camera:         slow push in, roughly 15%, on the same low axis
Environment:    thin mist drifting right to left across the valley behind
Light:          constant, overcast dawn
Pace:           unhurried, one continuous movement
Ends on:        foot planted, bundle at the hip, strap slack, figure momentarily still
```

**Prompt as sent**

> Slow push in on a low-angle vertical shot, unhurried, as the elderly woman in the madder-red
> wrap completes one full stride up the stone hill trail, her rear foot landing and her weight
> settling forward while the cloth bundle on her back swings forward to rest against her hip. Thin
> mist drifts right to left across the terraced valley behind her. Light stays constant, cool
> overcast dawn. Photoreal documentary reenactment, shallow depth of field, natural film grain.
> Coming to rest as her foot plants and the bundle settles, the figure momentarily still.
>
> An empty hill trail with no vehicles, no wires, no modern objects. No readable text, no letters,
> no numbers, no subtitles, no captions, no watermark, no morphing face, no identity change, no
> sudden lighting shift, no camera stutter.

**Inputs:** `image=frames/beat07_start.png`, `lastFrame=frames/beat07_end.png`

---

## 13. Failure Modes

| Symptom | Real cause | Fix |
| --- | --- | --- |
| `code 8: service is currently experiencing high load` | Transient Veo capacity. Not your prompt. Not billed | Wait and retry — **but ask the user first**. Has succeeded on retry every time |
| `raiMediaFilteredCount: 1`, no video returned | Video-level safety filter. Google's message states this is not charged | Rephrase the action to be less martial or restraint-oriented. Do not argue with the filter |
| Face morphs mid-clip | Start and end frames disagree on identity, or no frames supplied at all | Fix the pair in the image stage; never patch it in the video prompt |
| Lurch in the first half-second | Prompt contradicts the start frame (light, framing, wardrobe) | Strip the prompt back to motion only |
| Clip fast-forwards through the action | Too many actions for the duration | One action per 4s. Split the beat |
| Clip ends before it lands | No arrival named | Add the "coming to rest as..." clause |
| Motion drifts aimlessly | Motion had no destination | Give the movement an endpoint |
| Sequence reads as unrelated clips | Grade or camera grammar not locked | Paste one grade phrase into every prompt; fix the camera language |
| `Cloud Storage download failed: 'C:\...\Google\Cloud' is not recognized` | Old hardcoded gcloud path with an unquoted space, split by `cmd.exe`. **The video generated fine — only the download broke** | Use plain `"gcloud"` and rely on PATH. Already fixed in `server.mjs`; recover the clip from GCS rather than regenerating |
| `operation._fromAPIResponse is not a function` | A bare `{name}` object passed to `ai.operations.get()` | Keep the real operation object from `generateVideos()`, or hit `:fetchPredictOperation` directly with an ADC bearer token |
| 1080p request silently returns 720p | 9:16 is capped at 720p by Google | Expected. Do not "fix" `resolutionFor()` |

---

## 14. Copy-Paste Operating Prompt

```
Load PROMPT_VIDEO_GENERATION.md as your operating context, and
PROMPT_IMAGE_GENERATION.md for the shared canon.

Script: <paste the full script, in its original language>
Deliverable: <e.g. a 12-clip 9:16 sequence for a reel>
Audio: <silent unless stated>
Culture / register: <exact tradition, region, period>

Do this, then STOP for approval:
1. Full script analysis and beat map.
2. Timing math per beat, snapped to 4 / 6 / 8 seconds, with the split decisions shown.
3. Mode per beat: start+end, start-only, ingredients, text-to-video, or logo.
4. A MOTION BRIEF for every beat.
5. Every video prompt in full, block form.
6. Clip count, total seconds, model, resolution, audio setting, estimated maximum cost.

Do not run draft. Do not run generate. Do not set confirmPaidGeneration.
Wait for my explicit approval at each gate.
```
