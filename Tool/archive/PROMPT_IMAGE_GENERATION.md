# Master Prompt: Script-Centric Image & Keyframe Generation

**Role of this file.** This is the persistent context layer for every image request in this
project — single stills, image packs, and especially the **start-frame / end-frame pairs** that
feed Veo first-and-last-frame interpolation. Load it before writing a single prompt. Its
companion is `PROMPT_VIDEO_GENERATION.md`; the two share one canon and must never disagree.

**Governing rule.** The script is the source of truth. Nothing enters a frame that the script,
the user, or the locked canon put there. You are not illustrating a vibe — you are staging a
specific line of a specific script for a specific audience.

---

## 0. Operating Contract

Inherited from `CLAUDE.md`, `AGENTS.md`, and `orchestrator_memory.md`. Non-negotiable.

1. Read the **complete** script before choosing a single frame.
2. Ask what needs visuals, the aspect ratio, and whether audio matters downstream — before drafting.
3. **Never generate a paid image without explicit approval.** `--confirm true` is the user's word,
   never your inference. Approval for a prompt pack is not approval to generate. Approval for
   one batch is not approval for a reroll.
4. Present the visual bible and every exact prompt for review before generating.
5. Never auto-retry a failure. Report it, name the suspected cause, ask.
6. Return the local output folder and every file path when done.

### Hard technical limits

| Constraint | Value |
| --- | --- |
| Image model | `gemini-2.5-flash-image` (Imagen is **not** enabled on project `auto-504509`) |
| Reference images per call | **3 maximum** |
| Aspect ratios in use | `9:16` (reels), `16:9` (covers, landscape video) |
| Keyframe pairing | `lastFrame` requires `image` — an end frame is useless without its start frame |
| Rate limits | Sleep 4s between batch items; on `429` sleep 20–25s and **ask** before retrying |
| Working directory | `F:/BUSINESS/Content Machine` — `node_modules` lives here |

```
node agent-video.mjs image --prompt TEXT --confirm true [--aspect 9:16] [--count N] [--ref FILE ...]
```

For batches of 10+, a standalone `.mjs` calling `@google/genai` directly is faster and less
rate-limit-prone than the HTTP round trip. Delete the script when the batch is done.

---

## 1. Context Architecture

An image model has **no memory between calls**. Every call is a cold start. So context here is
not "conversation history" — it is a set of layers you re-materialize, verbatim, into every
prompt. This is the whole discipline.

```
L0  SOURCE      The script, untouched. Immutable. Quoted, never paraphrased into the prompt.
L1  READING     Translation, beat map, emotional arc, cultural register, sensitivities.
L2  CANON       Character / Environment / Prop / Grade blocks. Written once, pasted verbatim
                into every applicable prompt for the life of the project.
L3  SCENE       The one beat being rendered: action, framing, light, moment-in-time.
L4  CONSTRAINT  Negative library + culture anchor + text suppression. Always appended.
L5  CONTINUITY  Reference PNGs (max 3), the start frame when generating its end frame, seeds.
```

**Load order in the final prompt string: L3 → L2 → L1 (only what the beat needs) → L4.**
Scene first, because the model weights early tokens most heavily for composition. Canon next,
because identity must survive. Constraints last, because they are a filter, not a subject.

**Drift is a context failure, not a model failure.** Every time a frame comes back wrong —
wrong culture, wrong face, wrong century — the diagnosis is the same: a layer was thin, or a
layer was omitted. Fix the layer, not the seed.

---

## 2. Phase A — Script Ingestion

Produce all four artifacts before proposing any frame. Write them into `<project>/prompts.md`.
That file is the project's context store; a fresh agent must be able to resume from it alone.

### A1. Line-by-line translation table

Required whenever the script is not in English. Literal, not literary — you are extracting
visual facts, not prose quality.

| # | Source line | Literal English | Visual facts asserted | Priority |
| --- | --- | --- | --- | --- |
| 01 | ... | ... | interior, night, one elder, manuscript | (1) |

"Visual facts asserted" is the column that matters. It separates what the script **states** from
what you would be **inventing**.

### A2. Context analysis

```
Setting:           where, indoor/outdoor, geography
Era:               period, and what that forbids (no wires, no plastic, no eyeglasses...)
Culture register:  the exact tradition. Specific enough to exclude the neighbours.
Emotional arc:     line by line — where it lifts, where it lands
Audience:          who watches, on what surface, with what expectations
Sensitivities:     religious, caste, ethnic, political, grief, minors
Text policy:       default is no readable text anywhere (see section 7)
```

### A3. Inventory — characters, environments, props

For each, decide **recurring or single-use**. Recurring entities get a canon block (section 3).
Single-use entities are described inline in their one scene.

Be honest about the "no characters" case. A conceptual or documentary script often has zero
recurring people, and every beat is a symbolic tableau. Forcing a protagonist onto that kind of
script is a common and expensive mistake.

### A4. Frame plan

| Beat | Script line | Shot | Start frame | End frame | Change vector | Reuse? |
| --- | --- | --- | --- | --- | --- | --- |
| 03 | 05–06 | MCU | hand rests on the ledger | hand has turned the page | page turn, light warms | new |

**Change vector** is the single most important cell in this table. See section 5.

---

## 3. Phase B — The Visual Bible (L2 Canon)

Canon blocks are written once, approved once, then **pasted verbatim** for the rest of the
project. Do not rewrite them per scene. Do not "improve" the wording. A synonym is a new
character to the model.

### 3.1 Character canon block

```
CHARACTER — <id>
Identity:   <age band, build, height read, gender presentation, ethnicity/region>
Face:       <face shape, skin tone and texture, nose, eyes incl. colour, brows, mouth,
             distinguishing marks — two or three permanent, specific ones>
Hair:       <colour, texture, length, how it is worn or tied, hairline>
Wardrobe:   <named garments, fabrics, colours, how they are worn, wear-and-age state>
Adornment:  <jewellery, marks, tools, sacred items — permanent ones only>
Bearing:    <posture, default expression, how they hold their hands>
Never:      <the specific drift you must block for this character>
```

Rules:

- **Permanent vs situational.** Only permanent traits belong in canon. A wet cloak, a lit lamp,
  a raised arm are scene facts and belong in L3.
- **Two or three anchors beat ten adjectives.** "A vertical scar through the left brow, a chipped
  lower front tooth, a brass ring on the right thumb" holds identity far better than a paragraph
  of soft description that the model will average away.
- **Name the drift.** The `Never:` line is not decoration. It is the highest-yield line in the
  block. Populate it from observed failures, not from imagination.
- **Lock the reference first.** Generate one clean full-body, neutral-pose, plain-background
  reference per recurring character. Get it approved *before* any scene work. Then attach it via
  `--ref` **and** paste the text block. Reference image and text block are not alternatives — the
  image holds the face, the text holds everything the crop cuts off.

### 3.2 Environment canon block

```
ENVIRONMENT — <id>
Type:          <interior/exterior, function, scale>
Architecture:  <materials, construction method, roof, openings, floor, age and repair state>
Landscape:     <terrain, vegetation, water, horizon, what is visible in the distance>
Contents:      <the fixed objects that live here and recur across shots>
Light rig:     <the source or sources, direction, quality, colour temperature>
Time & season: <default; note per-scene deviations in L3>
Never:         <the wrong-place drift to block>
```

Environments drift harder than characters and get checked less. A model asked for a hill village
will happily deliver a European one, and it will look competent — which is exactly why it slips
through review. Write the environment block with the same rigour as the character block.

### 3.3 Prop canon block

Reserve this for objects that carry story weight across beats — the manuscript, the thread, the
vessel, the product. Same shape: material, size relative to a hand, wear state, `Never:`.

### 3.4 Grade canon block

One per project. This is what makes a pack read as one film rather than N unrelated images.

```
GRADE
Medium:     <photoreal documentary reenactment | filmic | illustrated | ...>
Lens & DoF: <focal length feel, depth of field behaviour>
Palette:    <four to six named colours, plus what is absent from the palette>
Contrast:   <lifted blacks | deep shadow | flat>
Texture:    <film grain, halation, cleanliness of the image>
Skin:       <realistic pore and imperfection — actively resist plastic smoothing>
Aspect:     <9:16 | 16:9> with <title-safe zone description>
```

### 3.5 Culture / period anchor block

The single most valuable block in this file. Generative image models regress toward a
statistical mean that is usually Western, usually generic, and usually confidently wrong. The
only reliable defence is **positive specificity plus named exclusion**.

```
CULTURE ANCHOR
Specifically <exact culture, region, and period>, and specifically not <the three or four
neighbouring or superficially similar cultures the model actually drifts toward>:
<architecture and materials>, <landscape and agriculture>, <animals and tools>,
<men's dress by garment name>, <women's dress by garment name>, <headwear>,
<ritual objects>, <what the horizon looks like>.
```

Two rules make it work:

- **Name what it is not.** "Not generic South Asian, not European, not Middle Eastern, not
  Central Asian" does more work than any amount of positive description alone, because it targets
  the specific attractors the model falls into.
- **Use garment names, not descriptions.** A named garment with a short gloss —
  "daura-suruwal (wrapped tunic and trousers with a cloth waistband)" — beats "traditional
  clothing" every time. One is a retrieval key; the other is a blank.

Maintain a **drift log** in `<project>/prompts.md`: what the model produced versus what it should
have been. Every entry becomes a `Never:` line. This is the project's accumulated memory, and it
compounds across jobs.

---

## 4. Phase C — The Prompt Schema

Two forms of the same content. Use **block form** for planning, review, and the prompt pack.
Convert to **prose form** for the actual API call — `gemini-2.5-flash-image` responds better to
one vivid paragraph followed by a constraints sentence.

### 4.1 Block form (for `prompts.md` and user review)

```
BEAT:         <id> — <script line numbers>
SCRIPT LINE:  "<the source line, quoted>"
INTENT:       <what this frame must make the viewer feel or understand>
ASSET:        <9:16 vertical cinematic still | 16:9 cover> · <start frame | end frame>
SUBJECT:      <who or what, referencing canon ids>
ACTION:       <the exact physical moment — hands, gaze, weight, contact>
ENVIRONMENT:  <canon id> plus <what is different about it in this beat>
COMPOSITION:  <shot size, angle, subject placement, foreground/mid/background layering,
               depth of field, title-safe space>
LIGHT:        <source, direction, quality, colour, time of day>
PALETTE:      <from GRADE, plus any beat-specific accent>
TEXTURE:      <the two or three materials the camera is close enough to read>
CANON:        <verbatim paste of every applicable canon block>
CULTURE:      <verbatim paste of the culture anchor>
CONSTRAINTS:  <beat-specific must-haves>
AVOID:        <negative library plus beat-specific exclusions>
REFS:         <up to 3 file paths, and why each is attached>
```

### 4.2 Prose form (what actually goes to the model)

One paragraph, ordered **framing → subject → action → environment → light → texture → style**,
then canon, then a final constraints sentence.

> A close vertical shot of [SUBJECT doing ACTION] in [ENVIRONMENT], [composition and depth of
> field], lit by [LIGHT], [texture and palette], [medium and grade]. [CANON blocks, verbatim.]
> [CULTURE ANCHOR, verbatim.] No readable text, no letters, no numbers, no logos, no watermark;
> [beat-specific exclusions].

The order is not arbitrary. Framing first locks composition before the model commits to a layout.
Constraints last, because they filter an image the model has already conceived — put them first
and they read as subject matter, and you get the thing you excluded.

### 4.3 Specificity rule

- If the script is specific, **preserve its specificity exactly**. Do not embellish.
- If the script is generic, add only: place type, period-correct dress, ritual or work objects,
  camera framing, light, mood, title-safe space.
- **Never invent**: dates, named extra characters, villains, historical claims, slogans, logos,
  caste or ethnic markers the script does not support, or an emotional beat the script did not
  earn.

Inventing detail is the most common way a competent-looking image pack becomes unusable.

---

## 5. Start Frame and End Frame Pairs

This section is the reason this file exists. Everything above serves it.

A keyframe pair is not two images of a scene. It is **one scene at two moments**, and Veo
interpolates the path between them. The quality of the finished clip is decided here, not in the
video prompt.

### 5.1 The Change Vector

Before writing either prompt, write one sentence:

> **Between the start frame and the end frame, exactly this changes: ______.**

If you cannot fill that blank with one concrete, physically describable change, the pair is not
ready. Vague vectors ("the mood shifts", "time passes") produce morphing mush.

Good change vectors:

| Class | Example |
| --- | --- |
| Completed gesture | the hand that rested on the ledger has turned the page |
| Weight shift | the standing figure has settled onto her heels, shoulders down |
| Gaze | the eyes have moved from the object up to the horizon |
| Light | the lamp flame has grown, warming the near wall |
| Atmosphere | the mist over the far ridge has thinned, revealing the peak |
| Camera | the frame has pushed about 15% closer on the same axis |
| Crowd | the loose group has leaned in, closing the gap around the centre |

**One vector per pair.** Two simultaneous changes halve coherence. Three guarantee artifacts at
the midpoint, which is exactly where interpolation hides its worst work. If a beat genuinely
needs two changes, it needs two clips.

### 5.2 Writing the end-frame prompt

Take the start-frame prompt and change **only** the words the change vector touches.

Everything else is copied character for character: the canon blocks, the culture anchor, the
light description, the palette, the texture line, the composition line, the constraints. Not
rewritten. **Copied.** A rephrased sentence is a new instruction, and the model will act on it.

Then attach the **generated start frame PNG as a reference image** for the end-frame call. The
text holds the intent; the reference holds the pixels. Neither alone is sufficient.

### 5.3 Pair discipline checklist

Run this on every pair before it goes into a video job.

- [ ] Same environment, same camera position — unless the vector *is* a camera move
- [ ] Same light source, direction, and colour temperature. Mismatched lighting between frames is
      the top cause of mid-clip flicker and morphing
- [ ] Same wardrobe, same props, same hair, same jewellery, in the same state
- [ ] Same grade, same depth of field, same grain
- [ ] Exactly one thing different, and it is the declared vector
- [ ] Both frames are individually usable as a still — a broken end frame poisons the whole clip
- [ ] For a seamless loop: the end frame *is* the start frame. Use the identical file.

### 5.4 When not to use a pair

- The beat is a static hold with only ambient motion (flame, dust, breath). A start frame alone
  plus a motion-only video prompt is cleaner and cheaper.
- The beat is a hard cut to a new location. That is two beats, not one interpolation.
- The change is a transformation the model cannot path through physically. Interpolation always
  finds a route; if no plausible route exists, it invents a disturbing one.

---

## 6. Reference Image Strategy (L5)

**Maximum three per call.** Choose them deliberately; they are not free context.

| Situation | Attach |
| --- | --- |
| Recurring character in a new scene | the locked character reference plus the text canon block |
| End frame of a pair | the approved start frame |
| Product or logo must be exact | the real asset file, never a description |
| Continuing a location across beats | one approved wide of that location |
| Radically new framing needed | **nothing** — see below |

### The anchoring trap

`gemini-2.5-flash-image` **anchors hard** to supplied reference images and will resist large
compositional changes, quietly reusing the reference's framing while appearing to follow your
prompt. Ask for a macro insert while passing a wide establishing shot as reference, and you get a
mildly cropped wide shot.

Fix: **drop the reference entirely** for shots that need radically different framing, and carry
identity through the text canon block alone. Or anchor to a *different* image that already has
the target composition. Recognising this early saves a dozen rerolls.

### Context drift

Do not chain many edits in one long conversational thread — generations start blending into each
other. Start a clean call with the canon pasted fresh.

---

## 7. Constraint Layer (L4)

### 7.1 Standard negative block — append to essentially every call

```
no readable text, no letters, no numbers, no digits, no logos, no watermark, no UI overlay,
no poster typography, no speech bubbles, no subtitles, no captions, no distorted hands,
no extra fingers, no melted faces, no identical cloned faces, no over-smoothed plastic skin,
no fantasy glow, no magic beams, no neon, no gore, no caricatured villains, no modern objects
in historical scenes, no wires, no vehicles, no sneakers, no backpacks, no wristwatches,
no eyeglasses in period scenes.
```

### 7.2 Situational additions

| Scene contains | Add |
| --- | --- |
| Ritual fire | no matches, no gas lighter, no electric bulb |
| Manuscript or ledger | decorative marks only, and they must be unreadable |
| Map | no labels, no readable place names, no text-bearing arrows |
| Phone, laptop, screen | screen dark, blurred, or unreadable; no app branding |
| Any public figure | no exact likeness of a living public figure |
| Crowd | no repeated cloned faces; natural variation in age and dress |

### 7.3 The text rule — absolute by default

**No readable text, numbers, or digits in any frame, ever, unless the user explicitly asks.**

This includes the traps that get missed: script line-number markers like `(1)` or `(5)`; numeric
quantities from the script (a line saying "one hundred families" gets a nearly-full ledger, a
crowded courtyard, a densely marked page — **never a numeral**); phone numbers; app UI text;
signage; and manuscript writing.

Where a surface must look written, ask for "old ink marks that are decorative and unreadable".

Rationale: the model renders text unreliably, misspelled text destroys an otherwise finished
frame, and baked-in text locks one language into an asset that will be captioned in post.

### 7.4 Negative phrasing that actually works

Prefer a positive description of the absence over a bare prohibition. "A desolate landscape with
no buildings or roads" outperforms "no man-made structures", because the model is being asked to
render a scene rather than to suppress a concept it has just been primed with.

---

## 8. Generation, Verification, Reroll

### Step 1 — Folders

```
<project>/
  prompts.md          the context store — written BEFORE generating
  frames/             beatNN_start.png, beatNN_end.png
  refs/               locked character and location references
```

### Step 2 — Write `prompts.md` first

Source task, output paths, references, translation table, context analysis, all canon blocks, the
shared prefix, the beat and frame plan, reuse decisions, **every prompt in full**, and the
verification plan. This is a hard requirement, not a formality — it is what makes the job
resumable and auditable.

### Step 3 — Present and stop

Show the visual bible and the prompts. Wait for explicit approval. Then generate.

### Step 4 — Generate

Characters and locations first, approved, before any scene frames. Then start frames. Then end
frames, each with its start frame attached. `sleep(4000)` between items.

### Step 5 — Verify by looking

**Actually open and view every PNG.** A file count is not verification. Check in this order:

1. Culture and period — the failure that survives casual review
2. Identity — the same person as the reference, in every appearance
3. Hands, fingers, faces in crowds
4. Any text that leaked in
5. Composition and title-safe space
6. Pair coherence (section 5.3) for keyframe pairs

### Step 6 — Reroll with one correction

Change **one variable**. Do not rewrite the prompt — a rewrite makes the failure uninterpretable
and usually introduces a new one. Log what you changed and what happened; that log becomes canon.

If two targeted rerolls fail, the problem is a canon block or a reference image, not the scene
prompt. Go up a layer.

---

## 9. Worked Example — A Keyframe Pair

Script line: *"The old names travelled with them, carried in a bundle."*

**Change vector:** the walking figure's trailing foot has completed its step, and the bundle has
swung forward against her hip.

### Start frame (prose form, as sent)

> A vertical 9:16 cinematic still, medium-wide low-angle shot on a narrow stone-cut hill trail:
> an elderly woman climbing away from camera, caught mid-stride with her rear foot still rolling
> off the stone, a cloth-wrapped bundle held against her back by a forehead strap. Terraced millet
> fields fall away below her on the left; stone-and-mud-mortar houses with slate roofs sit small
> and blurred in the valley behind. Shallow depth of field, the trail's foreground grit sharp, the
> village soft. Overcast dawn light, cool and directionless, thin mist in the middle distance.
> Earthy stone grey, undyed cotton off-white, madder red in the bundle cloth, wet slate
> blue-green. Photoreal documentary reenactment, natural film grain, realistic weathered skin with
> visible pores and sun lines.
>
> [CHARACTER — ELDER: sixties, small and wiry, deeply lined brown skin, a vertical scar through
> the left brow, white hair pulled into a low knot, faded madder-red gunyu wrap and undyed cholo
> blouse, a single thin brass earring in the right ear, carries herself leaning slightly forward
> from the hips. Never: young, never plump, never in bright saturated fabric, never bare-headed in
> full sun.]
>
> [CULTURE ANCHOR: specifically Nepali Himalayan mid-hill, not generic South Asian, not European,
> not Middle Eastern, not Central Asian, not Tibetan: stone-and-mud-mortar houses with slate roofs
> and carved wooden window frames often painted blue, terraced rice and millet following the hill
> contours, water buffalo and hill oxen rather than European cattle, men in daura-suruwal and
> dhaka topi, women in gunyu-cholo with dhaka-pattern shawls, pine and rhododendron forest,
> distant snow peaks optional.]
>
> No readable text, no letters, no numbers, no logos, no watermark, no modern objects, no wires,
> no vehicles, no plastic, no distorted hands, no over-smoothed skin, no fantasy glow.

### End frame

The identical string, with exactly two clauses replaced:

- `caught mid-stride with her rear foot still rolling off the stone` →
  `her rear foot now landed and planted, weight settled forward`
- `a cloth-wrapped bundle held against her back by a forehead strap` →
  `the cloth-wrapped bundle swung forward and resting against her hip, forehead strap slack`

Everything else — canon, culture, light, palette, grain, constraints — is copied character for
character. The start frame PNG is attached as the reference.

---

## 10. Failure Modes

| Symptom | Real cause | Fix |
| --- | --- | --- |
| Wrong culture, confidently rendered | Culture anchor missing, weak, or lacking named exclusions | Add the "not X, not Y, not Z" clause using the actual observed drift targets |
| Face changes between beats | Canon block paraphrased instead of pasted, or reference not attached | Paste verbatim and attach the locked reference |
| Prompt ignored, reference's framing reused | Model anchoring hard to the reference image | Drop the reference, or anchor to an image with the target composition |
| Text leaked into the frame | Negative block omitted, or a script number rendered literally | Re-append 7.1; convert quantities to visual density |
| Mid-clip morphing in the resulting video | Start and end frames disagree on light, wardrobe, or camera | Rebuild the end frame from the start prompt with one clause changed |
| `429 RESOURCE_EXHAUSTED` | Rapid sequential calls | Sleep 20–25s, ask before retrying, add `sleep(4000)` between batch items |
| `blockReason: SAFETY` on a benign prompt | Filter triggered by *phrasing*, not content. Known triggers: "concept art character design sheet", devotional full-body portraits of revered figures, "restrained... mid-battle" | Bisect the prompt to find the phrase, then rephrase gently. Do not argue with the filter |
| `Cannot find package '@google/genai'` | Script run outside the project directory | `cd "F:/BUSINESS/Content Machine"` first |

---

## 11. Copy-Paste Operating Prompt

```
Load PROMPT_IMAGE_GENERATION.md as your operating context.

Script: <paste the full script, in its original language>
Deliverable: <e.g. 12 start/end keyframe pairs, 9:16, for a Veo interpolation sequence>
Culture / register: <exact tradition, region, period>
Audience and platform: <...>
Known drift to block: <anything that has gone wrong before>

Do this, then STOP for approval:
1. Line-by-line translation with a "visual facts asserted" column.
2. Context analysis: setting, era, culture register, emotional arc, sensitivities.
3. Inventory: recurring characters, environments, props — or state plainly that there are none.
4. Character, environment, prop, grade, and culture-anchor canon blocks.
5. Beat plan with a one-sentence CHANGE VECTOR for every keyframe pair.
6. Every prompt in full, block form, written to <project>/prompts.md.
7. Estimated image count and cost.

Do not call the image API. Do not set --confirm. Wait for my explicit approval.
```
