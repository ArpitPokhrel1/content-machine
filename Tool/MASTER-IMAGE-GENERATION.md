# MASTER-IMAGE-GENERATION

Turn a script in any language into a story-coherent image pack whose frames also work as video
keyframes. Paired with `MASTER-VIDEO-GENERATION.md`: they share one Canon and must never disagree.

This is the concise version. It keeps the 20% of the method that drives 80% of the output
quality, plus every lesson that has changed a real result (section 7). The full treatment, with
more theory and examples, is `archive/MASTER-IMAGE-GENERATION.full.md`. Read it when a job goes
wrong in a way this file doesn't cover.

---

## 0. Rules

1. **Read the whole script before proposing anything.** No partial reads.
2. **Never invent story.** No dates, extra named characters, villains, historical claims, slogans,
   or caste and cultural markers the script doesn't support. Implied facts are declared, never
   slipped in.
3. **No readable text, numbers or digits in any frame** unless the user asks for them.
4. **Image generation needs no approval.** Generate, then show the results. The exception is when
   the user asks to verify characters and environments first: stop after the references.
   **Paid video always needs explicit approval.** Approving images never approves video.
5. **Never auto-retry a failure.** Read the error, name the cause, then fix one thing (section 8).
6. **Look at every image before delivering it.** A file count or an OK from the API proves
   nothing.
7. **Return every output path.**

If you have no image tool, run the whole method and deliver the prompt pack as text. That is a
complete deliverable.

---

## 1. Understand the script (never shortcut this stage)

Every later stage inherits the mistakes made here, so this stage stays thorough.

### 1.1 Literal translation table

| # | Source line | Literal English | Asserted visual facts | Implied visual facts |
| --- | --- | --- | --- | --- |

- **Asserted** facts are what the script states, and you must render them. **Implied** facts are what a
  good director would infer. You may render them, but only once they are listed here, where the
  user can strike them. Anything in neither column is invention.
- Keep untranslatable terms as **source term plus gloss**: "daura-suruwal (wrapped tunic and
  trousers with a cloth waistband)". Writing "traditional clothing" instead destroys the model's
  best retrieval key.
- Record priority markers (`(1)`, `★`, bold) and weight those beats, but never render the marker.
- Flag every number now. It becomes visual density or countable objects, never a numeral.
- Note register shifts (narration → direct address, past → present). They are your cut points.

### 1.2 Classify on six axes

```
CONTENT TYPE    narrative | documentary/explainer | devotional | historical/heritage |
                commercial | educational | promotional | poetic
NARRATIVE MODE  character-driven | conceptual tableau | montage | direct address | reenactment
REGISTER        reverent | intimate | urgent | celebratory | elegiac | plainspoken | playful
CULTURAL FRAME  exact culture + region + period, specific enough to exclude the neighbours
PLATFORM        vertical short (9:16 default) | horizontal | square | print
LITERALNESS     literal | symbolic | mixed (say which lines are which)
```

**Conceptual tableau warning:** many heritage and explainer scripts have *no* recurring
characters. Say so plainly. Forcing a protagonist onto them is the most expensive common mistake.

### 1.3 Story flow

- **Story spine:** one sentence.
- **Five anchors for the whole piece:** one emotion, one visual motif, one anchor object, one
  break point, and one final image. Name the final image first, because every earlier frame is
  designed to arrive there.
- **Beat function per beat:** `Establish · Reveal · Power · Pressure · Detail · Reaction · Shift ·
  Impact · Aftermath · Exit`. Every beat must change emotion, advance action, or raise pressure.
  Cut the ones that do none of these.
- **Rhythm:** long → shorter → shorter → pause → impact. Put one deliberate pause before the
  biggest moment.

### 1.4 Questions: ask all of them in ONE batch

Classification (the least certain axis) · which implied facts to strike · **which parts need
video and which stay stills** · aspect ratio · narration in post or generated audio · brand,
religious or cultural constraints · how to stage sensitive beats (death, execution, ritual) ·
whether "today" lines stay in period · known past failures. Never ask what the script already
answers.

---

## 2. Canon: write it once, paste it verbatim everywhere

To an image model a synonym is a new character. Canon blocks are written once, approved, and
then pasted **character for character** into every prompt they apply to. Never rephrase them per
scene.

### 2.1 Character

```
<NAME>, <role>: <age band>, <build>, <skin tone, named ethnicity>, <face shape>, <eyes>, <hair>,
<2–3 PERMANENT distinguishing marks>. He/She wears <named garments + fabric + colour>.
<Permanent adornment>. <Bearing>. Never <the specific drift seen for this character>.
```

- **Two or three hard anchors beat ten adjectives.** "A small scar through the right eyebrow, a
  silver ring on the right thumb" survives generation. "Kind, weathered, dignified" averages into
  a stock face.
- **Give every character a distinct colour** (a king in ivory and crimson, a general in ochre
  with a maroon turban). Colour is the most reliable identity cue at small sizes.
- **Only permanent traits go in Canon.** A wet cloak or a raised arm belongs in the scene.
- **The `Never:` line is the highest-yield line.** Fill it from drift you have actually observed.
- Name the ethnicity outright ("light-skinned Indian tone, jet-black hair"), or the model drifts
  toward European features.

### 2.2 Environment, culture anchor, grade

```
CULTURE ANCHOR  Specifically <culture, region, period>, and specifically NOT <the 3–5 cultures
                the model actually drifts to>: <architecture by named form>, <landscape>,
                <dress by garment name per gender>, <headwear>, <ritual objects>, <horizon>.
ENVIRONMENT     <place, time of day>: <materials, structure, fixed contents>, <light source
                and direction>.
GRADE           <medium>. <depth of field, described>. Palette: <4–6 named colours WITH HEX>.
                <contrast>, <grain>, realistic skin with visible pores rather than smoothed plastic.
```

- **Naming what a place is NOT does more than any amount of positive description.** Name the
  neighbours the model really confuses it with. For Malla-era Kathmandu that means not a Mughal
  court, not Rajasthani, not Tibetan, not Chinese, not modern Nepal.
- **Every generic noun needs its regional form.** "Round shields" come back Viking, "stone
  gateway" comes back Tudor, "brick house" comes back a Roman villa. Name the real form and add
  "never <the wrong culture>".
- One GRADE per project is what makes 70 images read as one film.
- Keep a second anchor for every place outside the main setting (Tibet, a pass, heaven).
- Open object blocks with plain description ("The stone is a single huge boulder…"), never an
  all-caps title. Capitalised object names get carved onto the object.

### 2.3 Locked references

Before any story frame, generate the references and view them on a contact sheet:

- one **full-body, neutral pose, plain backdrop** image per recurring character. Crop out any
  stray background people, or they leak into keyframes.
- one **establishing plate with no people** per recurring environment
- for three or more characters who appear together, an ffmpeg `hstack` **lineup strip**, so the
  group uses one reference slot

Fix drift here, where it is cheap. If a plate keeps drifting, drop it and describe the place in
text instead.

---

## 3. Shot budget: 20-word chunks of five 4-word frames

- **One frame per 4 words.** 4 words is about 1.8 s of narration at 2.2 words/s, roughly the
  natural hold of a still. `Tool/image-pack/chunk-script.mjs` cuts the script into 20-word
  chunks of five 4-word frames (`cNN-1` … `cNN-5`).
- For compounding languages (Nepali, German), 3 words per frame is closer. For scripts with no
  word spaces (Chinese, Japanese, Thai), budget by read time: 1 frame per 1.8 s. State which basis
  you used.
- **The count is a budget, not a blade.** Snap each frame to a meaning boundary: merge two windows
  that show the same subject, place and action; split a window that shows two different facts;
  and never stage half a clause. Land within ±20% of the budget, and if you don't, say why.
- **Context integrity (non-negotiable):** every frame shows its own 4 words but carries its chunk's
  full context: **who** (Canon), **where** (environment), **when** (period and time of day) and
  **what is at stake** (beat function). The model has no memory between calls, so a short window
  with thin context produces a frame from a different film.

Present a **chunk plan**: the story of each chunk and one line per frame (chars · environment ·
action).

---

## 4. The frame card: think before you prompt

Per frame, decide:

- **Beat:** the one thing that changes, in one sentence, plus its function tag.
- **Emotion routed through the body or an object, never named.** "She is grieving" gives you a
  stock sad face. A jaw set, knuckles whitening, a lamp guttering or a cloth torn is what reads.
  A hand at rest is filler; a hand deciding is a shot.
- **Framing** (ECU…EW) and **one anchor** the eye lands on first.
- **Three depth layers, each with a job:** foreground to frame or give scale, midground for the
  subject and action, background for context and stakes.
- **Light:** one motivated source, with its direction, quality and colour.
- **Implied motion:** a posture that can only resolve forward, or one blurred element against a
  sharp anchor. This is what gives a video model a direction to travel.
- **Three concrete details:** one environmental pressure, one body micro-action, one motif.
  If a frame could be captioned "cinematic, beautiful lighting", it failed this check.

---

## 5. Prompt assembly

Models weight the first 30–40% of the prompt most heavily, so the order is fixed:

```
Create a vertical 9:16 <framing> <angle>, tall portrait composition filling the frame edge to
edge: <anchor subject + exact state> <action with a destination>. <FG>; <MG>; <BG>.
<Environment>. Lit by <one source>. <Implied-motion cue>.
<Reference line>  <GRADE>  <Canon blocks of characters in frame>  <CULTURE ANCHOR>  <NEG>
```

- **Reference line**, when references are attached (max 3: characters first, then the plate if a
  slot is free): *"Match the faces, builds and costumes of the named characters to the attached
  character reference photographs, and the architecture to the attached location photograph;
  take nothing else from them, not their poses or backgrounds."*
- **Standard NEG** (last, always):
  *"No text, no captions, no signage, no lettering and no logos anywhere in the frame. No flags,
  no banners, no pennants and no national flags of any kind. Period-true objects only: no glass
  windows, no electric light, no plastic, no modern objects. Natural anatomy, correct hands with
  five fingers, no cloned faces."*
- Write prose, not tag soup. "masterpiece, 8k, trending" is noise.
- Use positive phrasing: "an empty street" beats "a street with no cars". The model renders what
  you name.
- Specific script → preserve it exactly. Generic script → add only place type, period dress,
  objects, framing and light.
- **Keep every prompt under 4000 characters** (the server truncates, and the NEG goes first).
  The builder prints the max length. Check it before generating.
- Build prompts **in code** (`canon.mjs` + `build-frames.mjs`), so Canon, GRADE, anchor and
  NEG are identical strings in every job. Never hand-copy them.

---

## 6. Frame pairs for video

For a shot marked for video with first+last interpolation:

- **Change vector:** "Between start and end, exactly this changes: ___". Use one concrete physical
  change (a gesture completes, weight shifts, a gaze moves, a lamp grows, the camera pushes 15%).
  Two changes halve coherence; three guarantee artifacts.
- **Make the end frame an edit of the start frame**, with the start frame attached: *"Edit the
  supplied image. Keep the identical camera, framing, background, characters, clothing and
  grade. The only change: …"* Re-sending the full start prompt with a swapped clause returns
  near-copies.
- Keep the same light direction and colour in both frames. Mismatched light is the top cause of
  mid-clip morphing.
- Physical contact between people (grabbing, carrying): let the video model carry it from a first
  frame alone. Image edits drop characters.
- A static beat with only ambient motion (flame, breath, mist) needs a start frame only.
- Compose for motion: leave headroom and edge margin, keep hands and faces off the edges, keep one
  clear foreground/background split, and avoid dead-centre symmetry.

---

## 7. Proven fixes (each has changed a real output)

| Problem | Fix |
| --- | --- |
| "no watermark" → hard SAFETY block, no image | Never write "watermark". Use the standard NEG line |
| Any flag-shaped object → modern national flag | Ban the category: "no flags, no banners, no pennants, no poles" |
| Nepali dhwaja rendered as flags | Describe it: long, narrow, loose red and white cloth strips knotted at one end |
| Vertical frame comes back letterboxed (wide vistas, window/depth shots) | Describe a composition that can only be vertical: "portrait orientation, three bands top to bottom: sky / valley / figures" |
| Mentioning a crop shape ("survives a circular crop") | The model draws the circle. Say "full-bleed rectangular photograph filling the frame edge to edge" |
| Capitalised object label | Gets carved onto the object. Use plain description |
| A number must be seen | Never count fingers. Use countable objects: "exactly eight clay lamps in one straight row" |
| Gesture caught halfway (a shield half raised) | State the finished safe state ("shield fully down covering the face") |
| "Gold sheen" or "lit from within" on a deity | The whole body turns gilded. Put divinity in the halo, eyes, light and motes, and attach a natural-skin reference |
| Culture anchor in a heaven or abstract scene | Pulls in earthly buildings and shrines. Drop the anchor, give the scene concrete nouns of its own, and add "no building, no room, no ritual object" |
| A human scale named for a non-person ("the height of an adult") | Becomes a person. Scale to objects, or make it a shadow on a surface |
| A detail in a subordinate clause (a leaning flame) | Gets ignored. Give it a drawable consequence in the same sentence |
| Something airborne above a city → a colossus | State the altitude and scale: the city tiny and far below, open sky around it |
| Previous frame attached for continuity | The model clones its composition. Only do it for deliberate mirrors |
| Large skin-tone edit on a reference | Identity drifts. Regenerate from the updated Canon text instead |
| Combined edits | One change per edit, and name the period-correct replacement concretely |
| Number plates or decals readable | Hide them by framing (side or rear angle, garland over the plate) |
| Empty response with `finishReason: STOP` | Transient. Print `promptFeedback` first; if it has no `blockReason`, one identical re-call is fair |
| `429 RESOURCE_EXHAUSTED` | Quota, nothing billed. Re-run only the missing ids at a slower pace |

Model-specific lessons keep accumulating in `orchestrator_memory.md`. Read it before every job,
and add every new lesson there.

---

## 8. Generate, verify, reroll

1. References first → view the contact sheet → fix drift.
2. Story frames, **one chunk (5 frames) per parallel batch**, or with the pooled runner (see
   `Tool/README.md`). Run it in the background.
3. **Verify by looking** at the per-chunk contact sheets (`check-frames.mjs`), in this order:
   culture and period drift (modern buildings, water tanks, flags, wrong hats) → identity and
   duplicated characters → hands and crowd faces → text leakage → letterboxing and composition →
   grade consistency across the set.
4. **Reroll with one change** and save it as `<id>-v2.png`. Rewriting the whole prompt makes the
   failure impossible to read. **If two targeted rerolls fail, the fault is in a Canon block or a
   reference, not the scene.** Go up a layer.
5. Deliver: move the pack to `Outputs/`, keep one final file per frame (`cNN-F.png`, old versions
   in `superseded/`), and update `prompt-pack.md` with the status, the reroll log and open risks.

`prompt-pack.md` holds the translation, classification, Canon, chunk plan and every prompt. A
fresh agent on a fresh machine must be able to resume from it alone.

---

## 9. Handoff to video

```
HANDOFF — <project>
Classification · GRADE (verbatim) · culture anchor (verbatim) · Canon blocks (verbatim)
Five anchors · rhythm ladder · aspect · audio decision · open risks
Frame ledger: shot | file(s) | pair role | change vector | hold | beat fn | sound
```

---

## 10. Copy-paste operating prompt

```
Operate under Tool/MASTER-IMAGE-GENERATION.md and read Tool/orchestrator_memory.md first.

SCRIPT (any language):
<full script>

KNOWN: platform/aspect <…> · culture/period <…> · audio <…> · constraints <…> · past failures <…>

1. Literal translation table (asserted vs implied), six-axis classification, story spine,
   five anchors.
2. Characters (Canon), environments (GRADE + culture anchor), chunk plan.
3. Ask every open question in ONE batch.
4. Then generate references → frames, verify every frame by looking, and deliver.
```
