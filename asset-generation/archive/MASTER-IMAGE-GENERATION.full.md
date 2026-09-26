# MASTER-IMAGE-GENERATION

**A portable, model-agnostic operating skill for turning any script, in any language, into a
story-coherent image set whose frames double as video keyframes.**

Paired file: `MASTER-VIDEO-GENERATION.md`. The two share one Canon. Never let them disagree.

---

## 0. Portability Contract — read this first

This file has **no prerequisites**. It does not require this repository, a specific model, a
specific vendor, an API key, or any installed tool. It is a set of instructions for an agent.
Copy it to any machine, hand it to any agent, and it works.

### 0.1 Capability detection — do this before anything else

Determine what you can actually do, then say so out loud in one line.

| Tier | What you have | What you do |
| --- | --- | --- |
| **A** | Built-in image generation (Codex image tools, native multimodal output) | Run the full pipeline end to end |
| **B** | An MCP server or connected tool exposing image generation | Same, through that tool. Probe its schema first; never assume parameter names |
| **C** | A CLI or HTTP endpoint the user has described | Same, through it. Ask for one example invocation before the first paid call |
| **D** | No generation capability at all | Run the full pipeline and **deliver the prompt pack as text**. This is a complete, valid deliverable — do not refuse the job |

Say, verbatim, at the start of the job:

> Capability tier: **\<A/B/C/D\>** — \<tool name or "prompt pack only"\>. Aspect ratio support:
> \<known/unknown\>. Reference-image support: \<yes/no/unknown, max N\>.

### 0.2 Model-agnostic writing rules

Because you may not know the target model, write prompts that survive any of them:

- **Prose, not tag soup.** Full cinematic sentences. "masterpiece, 8k, cinematic, trending" is
  noise on every modern model.
- **Positive phrasing.** "An empty street" beats "a street with no cars". The model renders what
  you name; naming a thing to forbid it often summons it.
- **Verb-first.** Open with the operation: *Create / Generate / Design / Transform / Edit*.
- **Front-load.** Generators weight roughly the first 30–40% of tokens most heavily. Framing,
  subject, and action go first. Style and constraints go last.
- **Lens language is optional and model-dependent.** Some models read "shot on 50mm, f/1.8"
  precisely; others (Nano Banana family) degrade on it. Default to *descriptive* optics —
  "shallow depth of field, the background falling soft" — and add numeric lens specs only when
  you know the target model rewards them.
- **Hex codes for anything brand-critical.** `#0d3d2d` is unambiguous; "deep emerald" is a range.
- **World-knowledge anchors are free compression.** "Bethel, New York, August 1969" carries more
  reliable visual information than forty adjectives — provided the reference is real and the
  agent is confident in it. Never invent one.

### 0.3 Output artifact

Every run produces one file, `<project>/prompt-pack.md`, holding the translation, the
classification, the Canon, the shot ledger, and every prompt in full. **A fresh agent on a fresh
machine must be able to resume the job from that file alone.** This is the portability
guarantee.

---

## 1. Non-Negotiables

1. **Read the complete script before proposing anything.** No partial reads, ever.
2. **Never generate a paid asset on implied approval.** Approval of the analysis is not approval
   of the Canon. Approval of the Canon is not approval of the prompts. Approval of the prompts is
   not approval to generate. Approval of one batch is not approval of a reroll.
3. **Stop at every Gate.** The gates in section 2 are hard stops, not checkpoints you narrate
   past.
4. **Never auto-retry a failure.** Report it, name the suspected cause, ask.
5. **Never invent story.** No dates, no named extra characters, no villains, no historical
   claims, no slogans, no cultural or caste markers the script does not support.
6. **Default to no readable text in any frame** (section 10.3).
7. **State cost and count before generating**, in whatever unit the tier-A/B/C tool bills in.
8. **Return every output path** when done.

---

## 2. The Pipeline

```
  SCRIPT (any language)
      ↓
  S1  INGEST          faithful literal translation + visual-fact extraction
      ↓
  S2  CLASSIFY        content type, register, platform, intent      ── GATE 1 ──
      ↓
  S3  UNDERSTAND      story spine, dramaturgy, emotional arc, anchors
      ↓
  S4  EXTRACT         characters / environments / settings / props  ── GATE 2 ──
      ↓
  S5  BUDGET          shot count via the 4-word rule + integrity pass ── GATE 3 ──
      ↓
  S6  CARD            one keyframe card per image
      ↓
  S7  PROMPT          assemble prompts; frame-pair design for video
      ↓
  S8  GENERATE        ── GATE 4 ── then generate, verify, reroll
      ↓
  S9  HANDOFF         hand the frame ledger to MASTER-VIDEO-GENERATION.md
```

The four Gates are where you stop and ask. Everything else you do on your own judgment.

---

## 3. S1 — Ingest and Translate

The script may be in any language. Do not work from a paraphrase, a summary, or a vibe.

### 3.1 Faithful literal translation

Produce a line-numbered table. Literal, not literary — you are mining visual facts, not
producing good prose.

| # | Source line | Literal English | Visual facts **asserted** | Visual facts **implied** | Marker |
| --- | --- | --- | --- | --- | --- |
| 01 | … | … | interior, night, one elder, a bound ledger | grief, age, a house long lived in | (1) |

The two fact columns are the heart of this stage. **Asserted** is what the script states and you
must render. **Implied** is what a competent director would infer and you may render — but every
implied fact must be declared here, in the open, so the user can strike it. Anything in neither
column is invention and is forbidden.

### 3.2 Non-obvious extraction targets

- **Priority markers.** Scripts often carry `(1)`, `(5)`, `★`, bold, or caps to mark emphasis.
  Record them, weight those beats — and **never render the marker itself**.
- **Numbers.** Every quantity gets flagged now, because it must become visual density later, not
  a numeral (section 10.3).
- **Untranslatable terms.** Ritual objects, kinship terms, garment names, place types. Keep the
  **source-language term plus a short gloss** — "daura-suruwal (wrapped tunic and trousers with a
  cloth waistband)". The named term is a retrieval key for the model; the gloss is the fallback.
  Translating it to "traditional clothing" destroys both.
- **Register shifts.** Where the script moves from narration to address, from past to present,
  from public to intimate. These are your cut points later.
- **Read time.** Estimate seconds per line. Default ≈ **2.2 words/second** for dramatic narration;
  adjust and state your rate. This drives the shot budget in S5.

---

## 4. S2 — Classify — **GATE 1**

Classification decides everything downstream — grade, pacing, how literal you are, how much
invention is allowed. Get it wrong and every later stage inherits the error.

### 4.1 Classify along six axes

```
CONTENT TYPE:     narrative story | documentary/explainer | devotional/religious |
                  historical/heritage | product/commercial | educational | testimonial |
                  news/journalistic | promotional/announcement | abstract/poetic
NARRATIVE MODE:   character-driven | conceptual tableau | montage/list | direct address |
                  reenactment | process/demonstration
REGISTER:         reverent | intimate | urgent | celebratory | elegiac | plainspoken |
                  playful | authoritative
CULTURAL FRAME:   <exact culture, region, period — specific enough to exclude the neighbours>
PLATFORM:         vertical short | horizontal long | square social | broadcast | web hero | print
LITERALNESS:      literal (render what is said) | symbolic (render what is meant) |
                  mixed (declare which lines are which)
```

The **conceptual tableau** case deserves its own warning. Many documentary, heritage, and
explainer scripts have **zero recurring characters** — every beat is a symbolic composition.
Forcing a protagonist onto such a script is one of the most common and most expensive mistakes in
this pipeline. Say plainly when a script has no characters.

### 4.2 GATE 1 — present and stop

> **Gate 1 — Validate my reading.**
>
> 1. Translation table, with asserted vs implied facts separated.
> 2. Classification across all six axes, with the one-line reason for each.
> 3. Story spine in one sentence.
> 4. Anything in the script I could not confidently interpret.
>
> **Questions I need answered before I go further:**
> - Is the classification right, particularly \<the axis you are least sure of\>?
> - Which implied facts should I strike?
> - **Which parts of the script need moving video, and which need stills only?**
> - Aspect ratio and platform?
> - Will narration be added in post, or must audio be generated?
> - Any hard brand, cultural, or religious constraints I should know now?
> - Any prior failures with this kind of content I should block against?
>
> I will not proceed until you confirm.

The video-scope question belongs **here, at the first gate**, not later. It changes the shot
budget, the frame-pair design, and the cost estimate. Asking it after the Canon is locked wastes
a full cycle.

---

## 5. S3 — Understand the Story

Classification tells you what kind of thing this is. This stage tells you what it *does*.

### 5.1 Scene formula

Apply to the piece as a whole, then to each beat:

> **Scene = desire + obstacle + space geometry + controlled gaze + rhythm**

If you cannot name all five in one sentence each, the beat is decoration, not a scene. Decorative
beats are where budget goes to die.

For non-narrative scripts, the formula still holds in translated form: *desire* becomes the
question the line answers, *obstacle* becomes the thing that makes it non-obvious, *geometry*
becomes the composition, *gaze* becomes where the eye is sent, *rhythm* becomes hold length.

### 5.2 The Five Anchors — commit to exactly five for the whole piece

```
1. One main emotion        the single feeling the piece is built to deliver
2. One visual motif        a recurring perceptual hook (a colour, a shape, a material, a gesture)
3. One anchor object       the physical thing the story keeps returning to
4. One break point         the moment control cracks, the beat everything else serves
5. One final image         the last frame, named now, before any other frame is designed
```

Five. Not eight. The discipline is the point — a piece with eight motifs has none. Naming the
final image first is not a stylistic flourish: every earlier frame is designed to arrive there,
and the video stage will use it as the sequence's emotional destination.

### 5.3 Beat structure

Map the script to beats and tag each with a **function**:

`Establish · Reveal · Power · Pressure · Detail · Reaction · Shift · Impact · Aftermath · Exit`

Then apply the **Three-Jobs Rule**: every beat must change emotion, advance action, or increase
pressure. A beat doing none of the three gets cut — and cutting it *before* the budget stage is
free, where cutting it after generation is not.

### 5.4 Rhythm

Design the hold pattern as a ladder, not a metronome. The characteristic shape is
**long → shorter → shorter → pause → impact**. Always place at least one deliberate pause before
the biggest moment; the pause is what makes the impact land. Flat, evenly-timed image sequences
read as a slideshow no matter how good each frame is.

---

## 6. S4 — Extract Characters, Environments, Settings — **GATE 2**

### 6.1 Classify every entity

For each entity the script asserts, decide:

| Question | Consequence |
| --- | --- |
| **Recurring or single-use?** | Recurring gets a Canon block and a locked reference. Single-use is described inline |
| **Foreground or texture?** | Foreground gets a face and detail. Texture (a crowd, a herd, a skyline) gets group description only |
| **Named or anonymous?** | Named needs identity stability. Anonymous must *not* become accidentally consistent — that reads as a plot point that isn't there |
| **Real or representative?** | A real person or product needs a reference file. A representative figure must not resemble a real public individual |

### 6.2 Canon blocks

Written once. Approved once. Then **pasted verbatim** into every applicable prompt for the life of
the project. Do not rewrite per scene. Do not "improve" the wording. To an image model, a synonym
is a new character.

```
CHARACTER — <id>
Identity:   <age band, build, height read, gender presentation, region>
Face:       <shape, skin tone and texture, nose, eyes with colour, brows, mouth,
             plus TWO OR THREE permanent distinguishing marks>
Hair:       <colour, texture, length, how worn, hairline>
Wardrobe:   <named garments, fabrics, colours, how worn, wear-and-age state>
Adornment:  <jewellery, marks, tools, sacred items — permanent only>
Bearing:    <posture, default expression, how they hold their hands>
Never:      <the specific drift to block for this character>
```

```
ENVIRONMENT — <id>
Type:          <interior/exterior, function, scale>
Architecture:  <materials, construction, roof, openings, floor, age and repair state>
Landscape:     <terrain, vegetation, water, horizon, what is visible in the distance>
Contents:      <fixed objects that recur across shots>
Light rig:     <source or sources, direction, quality, colour temperature>
Time & season: <default; per-scene deviations live in the shot card>
Never:         <the wrong-place drift to block>
```

```
SETTING — <id>            (the social/temporal frame, distinct from the physical environment)
Period:        <era, and what it forbids: no wires, no plastic, no eyeglasses, no synthetics>
Social frame:  <who is present, who is absent, what the hierarchy is, what is being done>
Activity:      <the work, ritual, or transaction the space is currently hosting>
Sound world:   <what this place sounds like — carried forward to the video stage>
Never:         <anachronism and register drift to block>
```

```
PROP — <id>
Material, size relative to a hand, wear state, how it is held, Never:
```

```
GRADE                     (one per project — this is what makes N images read as one film)
Medium:      <photoreal documentary reenactment | filmic narrative | illustrated | ...>
Optics:      <depth of field behaviour, described not numbered unless the model rewards numbers>
Palette:     <four to six named colours WITH HEX, plus what is deliberately absent>
Contrast:    <lifted blacks | deep shadow | flat>
Texture:     <grain, halation, bloom, how clean the image is allowed to be>
Skin:        <realistic pore and imperfection — actively resist plastic smoothing>
Aspect:      <ratio> with <title-safe zone description>
```

### 6.3 Three rules that decide whether Canon works

- **Permanent versus situational.** Only permanent traits are Canon. A wet cloak, a lit lamp, a
  raised arm are scene facts and belong in the shot card.
- **Two or three hard anchors beat ten soft adjectives.** "A vertical scar through the left brow,
  a chipped lower front tooth, a brass ring on the right thumb" survives generation. "Kind,
  weathered, dignified" does not — the model averages it into a stock face.
- **The `Never:` line is the highest-yield line in every block.** Populate it from observed
  failures, not imagination. Maintain a **drift log** in the prompt pack: what the model produced
  versus what it should have been. Every entry becomes a `Never:`. This is the project's memory
  and it compounds across jobs.

### 6.4 Cultural fidelity protocol

Image models regress toward a statistical mean that is usually Western, usually generic, and
usually confidently wrong — competent enough to pass casual review, which is exactly the danger.

The defence is **positive specificity plus named exclusion**:

```
CULTURE ANCHOR
Specifically <exact culture, region, period>, and specifically NOT <the three or four
neighbouring or superficially similar cultures the model actually drifts toward>:
<architecture and materials>, <landscape and agriculture>, <animals and tools>,
<dress by garment name, per gender>, <headwear>, <ritual objects>, <what the horizon looks like>.
```

Naming what it is *not* does more work than any volume of positive description, because it
targets the specific attractors the model falls into. Derive the exclusion list from real observed
drift, and add to it every time you catch a new one.

### 6.5 GATE 2 — present and stop

> **Gate 2 — Lock the Canon.**
>
> Entity inventory with recurring/single-use classification · every Canon block in full · the
> culture anchor · the Grade · the Five Anchors · the final image, named.
>
> Confirm each character, each environment, each setting. Correct anything that is wrong now —
> after this point these blocks are pasted verbatim into every prompt, and changing one means
> regenerating everything that used it.

For tiers A–C, generate **locked references** after this gate: one clean, full-body, neutral-pose,
plain-background image per recurring character, and one establishing wide per recurring
environment. Approve those individually before any story frame. They cost little and they prevent
the expensive failure.

---

## 7. S5 — Shot Budget: the 4-Word Rule — **GATE 3**

### 7.1 The base rule

> **Default: one image per four words of script.**

`N_target = ceil(total_script_words / 4)`

Four words at a ~2.2 words/second narration pace is about **1.8 seconds of screen time** — the
natural floor for a held image before it reads as a stall, and the natural ceiling before rapid
cutting reads as noise.

### 7.2 What the rule actually measures

The word count is a **proxy for screen time**, and that matters when the script is not in English.
Word density varies enormously by language: an agglutinative or compounding language (Nepali,
Turkish, Finnish, German, Hungarian) packs far more meaning into one word, and a script with no
word spacing at all (Japanese, Chinese, Thai) breaks the count outright.

So:

| Source language | Budget basis |
| --- | --- |
| Analytic, space-separated (English, Spanish, Indonesian) | 1 image / 4 words |
| Agglutinative or compounding (Nepali, Turkish, German, Finnish) | 1 image / 3 words, or use read time |
| No word boundaries (Japanese, Chinese, Thai) | **Read time: 1 image / 1.8 seconds of narration** |
| Any language, when unsure | **Read time. It is the real invariant** |

Always state which basis you used and what it produced.

### 7.3 The integrity pass — this is the part that matters

`N_target` is a **budget, not a slicing instruction.** Slicing a script mechanically every four
words shreds beats mid-clause and produces images that each show a fragment of an idea and none of
them the idea. The rule is: **take the budget, then snap every boundary to a semantic seam.**

Apply these four operations, in order:

**MERGE** — Collapse adjacent windows that share subject, location, *and* phase of action. Two
near-identical images in sequence read as a rendering error, not as emphasis.

**SPLIT** — Break a window that contains two distinct visual facts. A window that changes location
mid-way, or shows two different subjects acting, is two images however few words it holds.

**FLOOR** — No image may represent less than one complete semantic unit. If a four-word window cuts
a clause in half, extend it to the clause boundary. A dangling fragment cannot be staged.

**CEILING** — No image may span more than about twelve words, more than one location, or more than
one beat function. Past that, the image stops being a shot and becomes a summary.

Then check the result: **the final count should land within ±20% of `N_target`.** If it does not,
say so and say why — "the script is 240 words, budget 60, delivering 71 because eleven windows
straddled clause boundaries and had to be extended" is a good answer. Silently drifting to 40 or
110 is not.

### 7.4 Context integrity — the non-negotiable

Every image, no matter how small its word window, must independently carry:

- **Who** — the correct character in correct Canon, or a deliberate absence of people
- **Where** — the correct environment and setting, not a neutral void
- **When** — the correct period and time of day
- **What is at stake** — the beat function, legible in the composition

A four-word window is a *timing* decision. It is never licence to drop context. Every prompt
carries the full Canon regardless of how short its window is — the model has no memory between
calls, so a short window with thin context produces a frame from a different film.

### 7.5 The shot ledger

| # | Lines | Words | Basis | Beat fn | Emotion | Chars | Env | Anchor object | Hold | Video? | Pair? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 07 | 14–15 | 5 | word | Pressure | resolve | ELDER | TRAIL | bundle | 1.8s | yes | start+end |

The `Video?` and `Pair?` columns are the handoff to `MASTER-VIDEO-GENERATION.md`. Fill them from
the user's Gate 1 answer about which parts need motion.

### 7.6 GATE 3 — present and stop

> **Gate 3 — Approve the shot plan.**
>
> Script: \<W\> words · basis: \<word/read-time\> · budget `N_target` = \<N\> · **delivering \<M\>
> images** (\<±x%\>, because \<reason\>).
>
> Full shot ledger · which shots become video and which stay stills · which are start/end frame
> pairs · total image count · **estimated cost**.
>
> - Is the density right, or do you want it looser or tighter?
> - Are the video selections correct?
> - Any beat you want promoted, demoted, or cut?

---

## 8. S6 — The Keyframe Card

One card per image, before any prompt is written. The card is where the thinking happens; the
prompt is just its serialization.

```
CARD — shot <#>
Script line:   "<source line, quoted>"  →  "<literal English>"
Beat function: <Establish|Reveal|Power|Pressure|Detail|Reaction|Shift|Impact|Aftermath|Exit>
Story beat:    <the one thing that changes here, in ONE sentence>
Emotion:       <one word> — routed through <the object or body part carrying it>
Framing:       <ECU|CU|MCU|MS|MW|W|EW> + <angle> + <optics, described>
Anchor:        <the ONE thing the eye lands on within 0.3 seconds>
Depth FG:      <foreground element — its job is to frame, obstruct, or give scale>
Depth MG:      <midground — the subject and the action>
Depth BG:      <background — the stakes, the context, the world>
Implied motion:<the movement this still cannot perform, frozen as physical residue>
Light:         <ONE motivated source + direction + quality + colour>
Palette:       <from GRADE, with hex, plus any beat accent>
Texture:       <the two or three materials the camera is close enough to read>
Sound:         <what is audible under this frame — carried to the video stage>
Hold:          <seconds>
Pair role:     <single | start frame | end frame of #N>
Change vector: <if a pair: the ONE thing that differs between start and end>
Canon used:    <ids>
Refs to attach:<paths, max per model>
```

### 8.1 Four things every card must carry

A card missing any of these produces a frame that looks finished and communicates nothing:

1. **One readable beat** — sayable in a single sentence
2. **One function tag** — from the taxonomy above
3. **One emotion, routed through an object or the body** — not through a described feeling
4. **One implied motion** — the movement the still cannot perform, frozen as its residue

### 8.2 Emotion without naming emotion

The model renders bodies and objects, not feelings. "She is grieving" produces a stock sad face.
Redirect the work a face would do:

| The job | Where it goes instead |
| --- | --- |
| Decision | Anatomy mid-action — a hand gripping, a foot preloading, weight committed |
| Internal state | An object crossing a threshold — the lamp guttering, the cloth finally torn |
| Rivalry, attention | Spatial arrangement and depth — who occupies the frame, who is pushed to its edge |
| Cost | Physical deformation or residue — a sweat bead, a worn strap, a stain |

**A hand at rest is filler. A hand deciding is a shot.**

### 8.3 Implied motion — making a still carry movement

Name the *artifact* motion leaves behind, not "motion":

- Directional blur smear — background streaked along the travel axis, subject sharp
- Frozen partial blur — one element blurred (smoke, a wheel, a hem) while the anchor stays crisp
- Posture vector — a body locked in a pose that can only resolve forward
- Sharp subject against a soft field — shallow-depth isolation
- Deliberate total stillness — zero blur, reading as a stopped clock

This is also precisely what makes a still usable as a **video keyframe**: a frame with a legible
motion vector gives the video model a direction to travel. A perfectly static, perfectly balanced
frame gives it nothing, and it will invent something.

### 8.4 The three-detail check — run on every card

Every card must embed three concrete physical facts:

1. **Environmental pressure** — a spatial fact carrying emotion (rain on glass, a corridor too
   narrow, a lamp about to fail)
2. **Physical micro-action** — emotion on the body (jaw sets, knuckles whiten, a gaze drops)
3. **A motif or sound anchor** — the recurring hook tied to the piece's spine

Cards that fail this are rewritten, not generated. And if a card could be captioned "beautiful
lighting", "cinematic", or "high quality", it has failed — those are the words that appear exactly
where a concrete physical fact should have been.

---

## 9. S7 — Prompt Assembly

### 9.1 Structure — in this order, always

```
1. VERB + framing + angle + optics          ← front-loaded: models weight the first 30–40% most
2. Anchor subject and its exact state
3. Action, with a destination
4. Three depth clauses (FG job, MG job, BG job)
5. Environment and setting
6. Light: one motivated source, direction, quality, colour
7. Texture and palette, with hex where it matters
8. Implied-motion cue
9. Medium and grade
10. CANON blocks, pasted verbatim
11. CULTURE ANCHOR, pasted verbatim
12. Constraints — last
```

Constraints go last for a concrete reason: they filter an image the model has already conceived.
Put them first and they read as subject matter, and you get the thing you excluded.

### 9.2 The template

> **Create** a \<aspect\> \<framing\> \<angle\>: \<anchor subject\> \<action with destination\>.
> In the foreground \<FG and its job\>; behind, \<MG\>; beyond, \<BG\>. \<Environment and setting.\>
> Lit by \<one motivated source, direction, quality, colour\>. \<Texture\>, \<palette with hex\>.
> \<Implied-motion cue.\> \<Medium and grade.\>
>
> \[CANON — verbatim\] \[CULTURE ANCHOR — verbatim\]
>
> \<Constraints, positively phrased.\>

### 9.3 Specificity discipline

- Script is specific → **preserve its specificity exactly.** Do not embellish.
- Script is generic → add only: place type, period-correct dress, work or ritual objects, framing,
  light, mood, title-safe space.
- Script is silent on something → leave it out, or declare it as an implied fact at Gate 1.

Invention is the most common route from a competent-looking image pack to an unusable one.

---

## 10. Frame Pairs and the Video Handoff

Shots marked for video need frames designed as **keyframes**, not as stills that happen to exist.

### 10.1 The Change Vector

For every pair, write one sentence before writing either prompt:

> **Between the start frame and the end frame, exactly this changes: ______.**

If you cannot fill that blank with one concrete, physically describable change, the pair is not
ready. "The mood shifts" and "time passes" produce morphing mush at the midpoint, which is exactly
where interpolation hides its worst work.

| Class | Example |
| --- | --- |
| Completed gesture | the hand that rested on the ledger has turned the page |
| Weight shift | the standing figure has settled onto her heels, shoulders down |
| Gaze | the eyes have moved from the object up to the horizon |
| Light | the lamp flame has grown, warming the near wall |
| Atmosphere | the mist over the far ridge has thinned, revealing the peak |
| Camera | the frame has pushed about 15% closer on the same axis |
| Crowd | the loose group has leaned in, closing the gap around the centre |

**One vector per pair.** Two simultaneous changes halve coherence; three guarantee artifacts. A
beat needing two changes needs two clips.

### 10.2 Writing the end frame

Take the start-frame prompt and change **only** the words the vector touches. Everything else —
Canon, culture anchor, light, palette, texture, composition, constraints — is copied character for
character. Not rewritten. **Copied.** A rephrased sentence is a new instruction and the model will
act on it.

Where the tool supports reference images, attach the **generated start frame** when generating its
end frame. Text holds intent; the reference holds pixels. Neither alone is enough.

### 10.3 Pair discipline checklist

- [ ] Same environment, same camera position — unless the vector *is* a camera move
- [ ] Same light source, direction, and colour temperature. **Mismatched lighting between frames is
      the single top cause of mid-clip flicker and morphing**
- [ ] Same wardrobe, props, hair, adornment, in the same state
- [ ] Same grade, same depth behaviour, same grain
- [ ] Exactly one thing different, and it is the declared vector
- [ ] Both frames stand alone as usable stills — a broken end frame poisons the whole clip
- [ ] For a seamless loop: the end frame **is** the start frame, the identical file

### 10.4 When a pair is wrong

- Static hold with only ambient motion (flame, breath, dust) → start frame only, and let the video
  prompt carry the motion
- A hard cut to a new location → that is two beats, not one interpolation
- A transformation with no plausible physical path → interpolation always finds a route; with no
  plausible route it invents a disturbing one

### 10.5 Composing frames so they survive as video

- **Leave headroom and edge margin.** Video models crop, drift, and push in. A frame composed to
  the millimetre loses its composition in the first second.
- **Avoid dead-centre symmetry** unless the beat is specifically about stillness — symmetric frames
  give a motion model nothing to move toward.
- **Keep one clear depth separation.** A legible foreground/background split gives parallax
  somewhere to happen.
- **Keep hands and faces away from the frame edge**, where motion models damage them first.
- **Title-safe zone stays clear** if captions land in post.

---

## 11. Constraint Layer

### 11.1 Standard block

```
An empty frame of text: no readable text, no letters, no numbers, no digits, no captions,
no subtitles, no logos, no watermark, no UI overlay, no poster typography, no speech bubbles.
Natural anatomy: correct hands with five fingers, no distortion, no cloned faces, no merged limbs.
Realistic skin with visible pore and texture rather than smoothed plastic.
Period-true objects only. Natural light only.
```

Phrase exclusions as positive absences wherever you can — "a desolate landscape with no buildings
or roads" outperforms "no man-made structures", because you are asking for a scene rather than
priming a concept and then suppressing it.

### 11.2 Situational additions

| Scene contains | Add |
| --- | --- |
| Ritual fire | lit by flame alone — no matches, no gas lighter, no electric bulb |
| Manuscript or ledger | decorative ink marks only, unreadable as language |
| Map | unlabelled parchment, no place names, no text-bearing arrows |
| Screen or phone | screen dark, blurred, or unreadable; no app branding |
| Any public figure | a representative figure, resembling no living public individual |
| Crowd | natural variation in age, build, and dress; no repeated faces |
| Minors | fully clothed, age-appropriate, non-sexualised, no isolation framing |

### 11.3 The text rule — absolute by default

**No readable text, numbers, or digits in any frame, unless the user explicitly asks.**

The traps that get missed: script line-number markers like `(1)`; numeric quantities from the
script — a line saying "one hundred families" gets a nearly-full ledger, a crowded courtyard, a
densely marked page, **never a numeral**; phone numbers; app UI; signage; manuscript writing.

Where a surface must look written: *"old ink marks, decorative and unreadable."*

Three reasons this is a default rather than a preference: most models render text unreliably;
misspelled text destroys an otherwise finished frame; and baked-in text locks one language into an
asset that will be captioned, dubbed, or localised in post.

If the user *does* want text, quote it exactly and specify weight, colour with hex, size, and
position: `"HEADLINE"` in bold, `#3b82f6`, centred, upper third.

---

## 12. S8 — Generate, Verify, Reroll — **GATE 4**

### 12.1 GATE 4

> Every prompt in full · image count · reference strategy · **estimated cost** · what I will do if
> a generation fails (report and stop — never auto-retry).
>
> Explicit approval to generate?

### 12.2 Order of generation

1. Locked character and environment references — approved individually
2. Start frames
3. End frames, each with its start frame attached
4. Standalone stills

Pace the calls. Where the tool rate-limits, leave a few seconds between items; on a rate-limit
error, wait and **ask** before retrying.

### 12.3 Verify by looking

**Open and view every image.** A file count is not verification, and neither is a successful API
response. Check in this order — the first item is the one that survives casual review:

1. **Culture, period, and setting** — the failure that looks competent and is completely wrong
2. **Identity** — the same person as the reference, in every appearance
3. **Hands, fingers, faces in crowds**
4. **Text leakage** — any legible mark anywhere
5. **Composition, depth layers, title-safe space**
6. **Pair coherence** (section 10.3) for keyframes
7. **Grade consistency across the set** — view them as a contact sheet, not one at a time

### 12.4 The ten-gate keyframe audit

A frame earns its place only if: function tag named · one readable beat · emotion routed through
an object · an implied-motion cue present · a state-change rather than a static pose · three depth
layers each with a job · implied camera named · palette held to the Grade · text rule respected ·
sound cell filled.

### 12.5 Reroll with one correction

Change **one variable**. Do not rewrite the prompt — a rewrite makes the failure uninterpretable
and usually introduces a new one. Log the change and its result; that log becomes Canon.

**If two targeted rerolls fail, the fault is in a Canon block or a reference image, not in the
scene prompt.** Go up a layer. This single habit saves more time than any other in this file.

---

## 13. The Question Engine

This pipeline interrogates. Asking is not friction — it is the cheapest operation available, and
every unasked question becomes a regenerated batch.

**Ask when:** two readings of the script would produce materially different images · the culture,
period, or register is not certain · the script implies something it does not state · a number,
date, or name would have to be rendered · a real person, product, or brand appears · the content
touches religion, grief, caste, ethnicity, politics, or minors · cost is about to be incurred.

**Do not ask when:** the answer is in the script · the answer is in a prior gate's approval · it is
a routine craft decision that is yours to make · you are asking permission to continue work
already approved.

### Standing battery — Gate 1

1. Is my classification right, especially \<the least certain axis\>?
2. Which implied facts should I strike?
3. **Which parts need video, which are stills only?**
4. Aspect ratio and platform?
5. Narration in post, or generated audio?
6. Hard brand, cultural, or religious constraints?
7. Known prior failures to block against?
8. Density preference — sparse and held, or dense and cut?

### Standing battery — Gate 2

1. Is each character right — age, dress, bearing, the `Never:` line?
2. Is each environment right, specifically as opposed to a generic neighbour?
3. Is the period correct, and what does it forbid?
4. Are the Five Anchors the right five?
5. Is the named final image the right ending?

### Standing battery — Gate 3

1. Is the density right — \<M\> images across \<W\> words?
2. Are the video selections correct?
3. Any beat to promote, demote, or cut?
4. Is the cost acceptable?

### Standing battery — Gate 4

1. Any prompt to change before I spend?
2. Confirm: generate now?

**Ask in batches, not one at a time.** A numbered list of six questions respects the user's time;
six sequential single questions does not.

---

## 14. Worked Example

Source line (Nepali): *"पुराना नामहरू उनीहरूसँगै यात्रा गरे, एउटा पोकोमा बाँधिएर।"*
Literal: *"The old names travelled with them, tied in a bundle."*

Classification: heritage/documentary · conceptual tableau with one recurring figure · elegiac ·
Nepali Himalayan mid-hill, pre-modern · vertical short · symbolic.
Budget: 8 source words, agglutinative → 1 image / 3 words → 3 images. Integrity pass MERGEs two
(same subject, same location, same action phase) → **2 images: one start/end pair.**

**Card, shot 07 (start):** Beat *Pressure* · emotion *resolve*, routed through the strap · anchor
*the bundle* · FG trail grit giving scale, MG the figure mid-stride, BG the valley as stakes ·
implied motion *posture vector, weight committed uphill* · sound *breath and grit underfoot* ·
change vector *the trailing foot completes its step and the bundle swings forward to the hip.*

**Start-frame prompt, as sent:**

> **Create** a vertical 9:16 medium-wide low-angle frame: an elderly woman climbing a narrow
> stone-cut hill trail away from camera, caught mid-stride with her rear foot still rolling off the
> stone, a cloth-wrapped bundle carried on her back by a forehead strap. In the foreground, coarse
> trail grit and a broken stone lip give scale and partly obstruct the lower frame; behind her,
> terraced millet fields fall away to the left; beyond, stone-and-mud-mortar houses with slate roofs
> sit small and soft in the valley. Overcast dawn light, cool and directionless, with thin mist in
> the middle distance. Weathered skin with visible pores and sun lines, coarse handwoven cloth, wet
> slate. Palette: stone grey `#6b6a65`, undyed cotton `#e8e2d4`, madder red `#8c3b2e`, slate
> blue-green `#4a5c58`. Her body is locked in a posture that can only resolve forward, the sharp
> figure held against a softly falling background. Photoreal documentary reenactment, shallow depth
> of field, natural film grain.
>
> \[CHARACTER — ELDER: sixties, small and wiry, deeply lined brown skin, a vertical scar through the
> left brow, white hair in a low knot, faded madder-red gunyu wrap and undyed cholo blouse, a single
> thin brass earring in the right ear, carries herself leaning forward from the hips. Never: young,
> never plump, never in bright saturated fabric, never bare-headed in full sun.\]
>
> \[CULTURE ANCHOR: specifically Nepali Himalayan mid-hill, and specifically not generic South
> Asian, not European, not Middle Eastern, not Central Asian, not Tibetan:
> stone-and-mud-mortar houses with slate roofs and carved wooden window frames often painted blue,
> terraced rice and millet following the hill contours, water buffalo and hill oxen rather than
> European cattle, men in daura-suruwal and dhaka topi, women in gunyu-cholo with dhaka-pattern
> shawls, pine and rhododendron forest, distant snow peaks optional.\]
>
> An empty frame of text: no letters, no numbers, no captions, no watermark. An unmarked trail with
> no wires, no vehicles, no modern objects, no plastic. Natural anatomy, correct hands. Realistic
> skin texture rather than smoothed plastic.

**End frame:** the identical string with exactly two clauses replaced —
`caught mid-stride with her rear foot still rolling off the stone` →
`her rear foot now landed and planted, her weight settled forward`, and
`carried on her back by a forehead strap` →
`swung forward and resting against her hip, the forehead strap slack`.
Everything else copied character for character. Start frame attached as reference.

---

## 15. Handoff to the Video Stage

Emit this block into `<project>/prompt-pack.md`. It is the complete interface — the video stage
needs nothing else from you.

```
HANDOFF — <project>
Classification:  <six axes>
Grade:           <verbatim>
Culture anchor:  <verbatim>
Canon blocks:    <all, verbatim>
Five anchors:    <emotion, motif, object, break point, final image>
Rhythm:          <the hold ladder>
Frame ledger:
  shot | file(s)            | pair role   | change vector | hold | beat fn | sound
  07   | 07_start, 07_end    | start+end   | <one line>    | 1.8s | Pressure| breath, grit
Aspect / resolution: <...>
Audio decision:  <silent, VO in post | generated audio approved>
Open risks:      <drift log entries still unresolved>
```

---

## 16. Copy-Paste Operating Prompt

```
You are operating under MASTER-IMAGE-GENERATION.md. Follow it exactly.

SCRIPT (any language):
<paste the full script>

CONTEXT I ALREADY KNOW:
Platform / aspect: <or "you decide, ask me">
Culture / period:  <or "infer and confirm at Gate 1">
Audio:             <VO in post | generate audio | unknown>
Known constraints: <brand, religious, cultural, legal>
Prior failures:    <anything that has gone wrong before>

Do this now:
1. State your capability tier and what tool you will use.
2. S1 — line-by-line literal translation, asserted vs implied visual facts separated.
3. S2 — classify on all six axes.
4. STOP at GATE 1 and ask me the standing battery, including which parts need video.

Do not generate anything. Do not skip a gate. Ask in batches.
```
