# MASTER-VIDEO-GENERATION

**A portable, model-agnostic operating skill for turning a script — in any language — into a
directed, continuity-safe sequence of AI-generated clips.**

Paired file: `MASTER-IMAGE-GENERATION.md`, which produces the keyframes this file animates. The
two share one Canon. Never let them disagree.

> **The governing principle of this file:** a beautiful frame without dramaturgy is wallpaper.
> Model syntax is worth nothing until the direction is there. Every technical section below serves
> the dramaturgy sections, never the reverse.

---

## 0. Portability Contract — read this first

No prerequisites. No repository, no vendor, no API key, no installed tool. Copy this file to any
machine, hand it to any agent, and it works.

### 0.1 Capability detection — before anything else

| Tier | What you have | What you do |
| --- | --- | --- |
| **A** | Built-in video generation | Full pipeline end to end |
| **B** | An MCP server or connected tool exposing video generation | Same, through it. Probe the schema first — never assume parameter names or value ranges |
| **C** | A CLI or HTTP endpoint the user described | Same. Ask for one working example invocation before the first paid call |
| **D** | No video capability | Run the full pipeline and **deliver the prompt pack as text**, model-tagged and ready to paste. A complete, valid deliverable — do not refuse the job |

Declare it in one line:

> Capability tier: **\<A/B/C/D\>** — \<tool\>. Target model: \<name or "universal"\>. Durations
> supported: \<…\>. Keyframe support: \<first only / first+last / none / unknown\>. Reference
> images: \<max N / none / unknown\>. Audio: \<yes/no/unknown\>.

If any of those is unknown and the job depends on it, **ask**. Guessing a duration range or a
keyframe capability wastes a paid generation.

### 0.2 Probe before you spend

On tiers B and C, before the first paid call: confirm the allowed duration values, the allowed
aspect ratios, whether resolution is coupled to aspect ratio, whether a last frame requires a
first frame, and where output is written. These five facts cause most first-run failures, and all
five are free to establish.

### 0.3 Output artifact

One file, `<project>/video-pack.md`: the handoff block, the shot list, every motion brief, every
prompt in full, the continuity ledger, and the generation log. **A fresh agent on a fresh machine
must be able to resume from it alone.**

---

## 1. Non-Negotiables

1. **Analyse the complete script before choosing scenes.**
2. **Ask which portions need motion and whether audio is required.** Default is silent.
3. **Never generate on implied approval.** Analysis approved ≠ shot list approved ≠ prompts
   approved ≠ generation approved. One batch approved ≠ a retry approved. Images approved ≠ video
   approved.
4. **Never auto-retry a failure.** Report the error, name the likely cause, ask.
5. **Generate sequentially**, one clip per approved shot, reviewing as you go.
6. **State clip count, total seconds, model, resolution, audio setting, and estimated maximum cost
   before generating.**
7. **Timestamps and reference timings are approximate storytelling guidance, never frame-exact
   editing.** Say this every time a user asks for precise timing.
8. **Return the output folder and every individual clip path.**

---

## 2. Pipeline Position

```
MASTER-IMAGE-GENERATION.md
   S1 ingest → S2 classify → S3 understand → S4 canon → S5 budget → S6 cards → S7 prompts
   → S8 frames generated → S9 HANDOFF BLOCK
                                   ↓
MASTER-VIDEO-GENERATION.md
   V1 scope & clip classification   ── GATE V1 ──
   V2 dramaturgy pass
   V3 shot list, timing, mode       ── GATE V2 ──
   V4 motion briefs
   V5 prompt assembly
   V6 audit                         ── GATE V3 ──
   V7 generate, verify
   V8 assemble & deliver
```

**If you were handed a script and no handoff block**, you are running standalone. Run stages S1–S4
of `MASTER-IMAGE-GENERATION.md` first — translation, classification, story understanding, Canon —
then return here. Never write a video prompt without a Canon; identity and culture drift are
guaranteed otherwise, and they are not fixable in post.

---

## 3. V1 — Scope and Clip Classification — **GATE V1**

### 3.1 What actually needs motion

Most scripts do not need every beat animated. Motion is the most expensive thing in the pipeline
and the easiest to waste. A beat earns motion only when movement carries meaning:

| Animate when | Leave as a still when |
| --- | --- |
| A physical change is the point (a hand completes an act, a door opens) | The beat is a symbolic tableau |
| Atmosphere is the point (fire, water, crowd, weather, cloth) | The image is already saying everything |
| A camera move reveals something withheld | Motion would only add drift risk |
| The beat is the break point or the final image | The beat is a connector between two stronger beats |
| The platform demands motion (a reel opening) | Budget is better spent elsewhere |

A short piece is usually stronger with **a few moving beats among held stills** than with
everything moving. Constant motion flattens emphasis — if everything moves, nothing does.

### 3.2 Classify every clip

```
CLIP TYPE:      character action | atmosphere/B-roll | camera reveal | product/object |
                crowd/scale | abstract/texture | logo/brand | transition
MOTION SOURCE:  subject-driven | camera-driven | environment-driven | light-driven
GENERATION MODE: first+last interpolation | first frame only | reference/ingredients |
                text-to-video | logo image-to-video
FUNCTION:       Establish | Reveal | Power | Pressure | Detail | Reaction | Shift |
                Impact | Aftermath | Exit
```

**Default mode for a scripted sequence: first+last interpolation.** It is what makes output read
as one film rather than N unrelated AI clips. Every other mode is a fallback with a stated reason.

### 3.3 GATE V1 — present and stop

> **Gate V1 — Confirm the video scope.**
>
> Full beat list with a motion recommendation and a one-line reason for each · proposed clip count
> and total seconds · which clips need new keyframes · rough cost band.
>
> 1. Are these the right beats to animate?
> 2. Anything you want held as a still instead — or promoted to motion?
> 3. Audio: silent with VO in post, or generated? (Default silent.)
> 4. Target duration for the finished piece?
> 5. Is the pacing right — a few long held beats, or many short ones?

---

## 4. V2 — The Dramaturgy Pass

This is the stage that separates a directed sequence from a pile of clips. Do not skip it because
the prompts "look fine" — prompts always look fine.

### 4.1 Scene formula

> **Scene = desire + obstacle + space geometry + controlled gaze + rhythm**

Name all five, one sentence each, for the piece and for every clip. A clip missing any of them is
decoration. For non-narrative scripts the formula translates: *desire* is the question the line
answers, *obstacle* is what makes the answer non-obvious, *geometry* is the staging, *gaze* is
where the eye is sent, *rhythm* is the cut length.

### 4.2 The Three-Jobs Rule

Every clip must do at least one:

- **Change emotion** — in the character, or in the viewer
- **Advance action** — a new event, a new piece of information, a new position
- **Increase pressure** — stakes rise, a witness appears, the space tightens

A clip doing none of the three gets cut. Cutting it now is free.

### 4.3 Murch's Rule of Six — how to weight every cut

When deciding where a clip ends and the next begins, the priorities are ranked, and the ranking is
lopsided on purpose:

| Priority | Weight | The question |
| --- | --- | --- |
| Emotion | 51% | Does the cut honour what the moment feels like? |
| Story | 23% | Does it advance the narrative or reveal character? |
| Rhythm | 10% | Does it land on the beat? |
| Eye-trace | 7% | Does the viewer's gaze flow across the cut? |
| 2D screen plane | 5% | Is screen direction respected? |
| 3D space | 4% | Is the geography respected? |

Emotion outweighs everything else roughly two to one against story and five to one against rhythm.
Cutting for pace alone, without serving emotion, produces content that is busy and forgettable.

### 4.4 Rhythm ladder

Design hold lengths as a shape, not a metronome:

```
Slow burn:     4s · 4s · 3s · 2s · 1s · PAUSE · 2s
Building:      2s · 1s · 1s · 0.5s · 0.5s · PAUSE · 1s
Impact:        PAUSE · flash · long stillness
```

**Always place one deliberate pause before the biggest moment.** The pause is what makes the
impact land; without it the impact is just another cut. The longest-held frame in a sequence
should usually be the one immediately *before* its climax, not the climax itself.

### 4.5 The Five Anchors

Carry them from the image stage unchanged: one main emotion, one visual motif, one anchor object,
one break point, one final image. Every clip either serves an anchor or justifies itself some
other way.

**The final image is a destination, not an ending.** Name it before designing any clip; the whole
sequence is built to arrive there.

### 4.6 Spatial clarity

Even in the fastest passage, the viewer must always know: where the subject is, where the
pressure is coming from, which way is out, and which way is the decision. Sketch the geography in
one sentence before any fast-cut sequence. Confusion reads as a technical fault, not as tension.

---

## 5. V3 — Shot List, Timing, Mode — **GATE V2**

### 5.1 Duration discipline

Most video models produce coherent results in the **4–10 second** range; a few extend further.
Beyond a model's coherent range, identity drifts, motion loops, and the clip degrades in its final
seconds.

So: **split long beats into multiple clips.** Do not stretch. A 20-second passage is three or four
clips sharing one environment and one continuous camera logic, not one long generation.

Snap durations to whatever the target model actually allows. Where the model offers discrete
values only (commonly 4 / 6 / 8), snap to them and say what you snapped.

### 5.2 Timing math

1. Estimate read time per line. Default ≈ **2.2 words/second** for dramatic narration; state your
   rate and adjust per language.
2. Non-space-separated or agglutinative languages: use read time directly, never word count.
3. Snap to allowed durations.
4. Short connector lines → shortest allowed. Standard beats → middle. Break-point and final-image
   beats → longest, or split for emphasis.
5. A beat exceeding the maximum splits into `NNa` / `NNb`.

### 5.3 Action density — the rule that prevents fast-forward

**Roughly one complete action per four seconds.** Four seconds holds one action. Eight holds two,
at most. A prompt describing three actions in a four-second clip produces a fast-forward, and the
model will not tell you — it will just compress.

### 5.4 The shot list

| # | Lines | Est. s | Duration | Fn | Emotion | Mode | Start frame | End frame | Camera | Audio | Ends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 07 | 14–15 | 5.9 | 6s | Pressure | resolve | first+last | 07_start | 07_end | slow push, 15% | silent | foot planted, bundle at hip |

The **Ends on** column is the continuity spine — each clip's ending state becomes the next clip's
opening assumption.

### 5.5 GATE V2 — present and stop

> **Gate V2 — Approve the shot list.**
>
> Full shot list · duration math with every snap shown · mode per clip with reasons · the rhythm
> ladder · the named final image · **clip count, total seconds, model, resolution, audio setting,
> estimated maximum cost**.
>
> 1. Is the pacing right?
> 2. Any beat to promote, demote, split, or cut?
> 3. Is the cost acceptable?

---

## 6. V4 — Motion Briefs

One per clip, before any prompt is written.

```
MOTION BRIEF — clip <#>
Script line:    "<source>" → "<literal English>"
Function:       <tag>       Emotion: <one word>, carried by <object or body part>
Change vector:  <the ONE thing that changes — same vector as the keyframe pair>
Subject motion: <which joint, which weight shift, what speed, where it arrives>
Camera:         <ONE dominant move: direction, distance, speed — or "locked off">
Move reason:    <what changed that justifies the camera moving at all>
Environment:    <what moves that is not the subject — cloth, smoke, water, crowd, foliage>
Light:          <constant, or exactly how it changes>
Pace:           <slow settling | steady | one accelerating beat>
Three details:  1. environmental pressure  2. body micro-action  3. sound or motif anchor
Ends on:        <the exact state the last frame holds>
```

### 6.1 One primary camera move per clip

One dominant move. Micro-adjustments are fine — a gentle handheld float, a soft focus shift — but
stacking a dolly, a pan, and a tilt in six seconds produces incoherence, not dynamism.

**Every camera move must answer "what changed?"** Unmotivated movement reads as a drifting camera
operator. If nothing changed, lock the camera off — stillness is a choice, and often the stronger
one.

### 6.2 Motion needs a destination

"She walks" drifts for the full duration and ends nowhere. "She takes three steps and stops with
her hand on the doorframe" **arrives** — and arrival is what makes a clip feel edited rather than
truncated.

Name the speed, too. "Slow push in" and "fast push in" are different shots with different
meanings.

### 6.3 Show, don't tell

The model renders bodies, not feelings. "He is frightened" produces stock acting. Translate to
observable physical cues — a jaw setting, a breath held, knuckles whitening, a gaze dropping and
returning. **Two to four cues per emotional transition**: enough to read, not so many it becomes
overacting.

### 6.4 Concrete over abstract

Replace concepts with consequences. Not "loneliness" — *"a man alone at a table, shoulders
collapsed, face lit blue by a phone, three empty bottles pushed to the edge."* Prefer language
where one action forces the next: tyres kicking up water, a lid actually unscrewing, a strap
pulling taut.

### 6.5 The three-detail check

Every clip embeds: **one environmental pressure** (weather, surface, light, confinement), **one
body micro-action**, **one sound or motif anchor**. A clip failing this gets rewritten, not
generated. And if a prompt could be captioned "cinematic", "establishing shot", or "high quality",
those words are sitting exactly where a concrete physical fact should be.

---

## 7. V5 — Prompt Assembly

### 7.1 The universal skeleton

Layer in this order. It is ordered by how models allocate attention, not by taste.

```
1. Subject / character anchor          ← front-loaded; first 30–40% of tokens carries most weight
2. Action / motion, with destination
3. Scene / environment
4. Camera: shot size, angle, move, speed
5. Lighting and atmosphere
6. Style, mood, palette
7. Sound / audio                       (only if audio is enabled)
8. Duration and aspect ratio
9. Continuity constraints
10. Negative constraints               ← last
```

### 7.2 The formula, compressed

> **\[Cinematography\] + \[Subject\] + \[Action\] + \[Context\] + \[Style & Ambiance\]**

> Medium shot, slow push in on an elderly woman, turning a page of a heavy ledger and settling
> back on her heels as it falls flat, in a low stone room with a single oil lamp on the sill. Warm
> lamp light grows on the near wall as the page settles. Photoreal documentary reenactment,
> shallow depth of field, natural grain, unhurried.

### 7.3 Character anchor — the rule that prevents identity collapse

**Video generators have no memory between clips.** Repeat the complete identity block in every
single generation, at the start of the prompt, pasted verbatim from Canon: face shape, skin tone,
eye colour, hair, exact garments, distinctive accessories.

**Exception — and it matters:** when a start frame is supplied, do *not* re-describe the face,
wardrobe, and room in prose. That information is already in the pixels, and restating it gives the
model licence to reinterpret it. Keep one short grounding phrase — "the elderly woman in the
madder-red wrap" — and spend the rest of the prompt on motion. Without a start frame, paste the
full Canon block.

**Pixels beat prose.** Where a supplied frame and the prompt disagree, the frame usually wins, and
the disagreement surfaces as a visible lurch in the first half-second.

### 7.4 Prompt weight budget

Roughly: **40% camera and motion · 25% subject action · 20% environment and light behaviour · 15%
style and constraints.** When a clip comes back wrong, check which of the four you underspecified.
It is almost always camera and motion.

### 7.5 No contradictions

Models obey the strongest signal rather than averaging — contradictions produce artifacts, not
compromise. Watch for: "still water" with "flowing current"; "close-up" with "sweeping vista";
"locked off" with "handheld energy"; an overcast start frame with a golden-hour prompt; "frozen
moment" with "rapid motion".

### 7.6 Lens language

Some models read numeric optics precisely; others degrade on them. Default to **descriptive
optics** — "shallow depth of field, the background falling soft", "a wide, immersive field that
bends the edges" — and add numeric specs only for a model you know rewards them. As emotional
shorthand: wide reads immersive and exposed, normal reads intimate, long reads compressed and
observed.

### 7.7 Natural language, not tags

Write as if briefing a cinematographer. "masterpiece, 4k, cinematic, highly detailed, trending"
does nothing useful on modern video models and crowds out the tokens that would.

### 7.8 The final image rule

**Every clip needs a named final frame.** The model treats the ending as the emotional destination
and allocates its last second toward reaching it.

Name it concretely: *"coming to rest as her hand settles flat on the page"* or *"ending frozen in
the blue light of the open refrigerator"* — not *"she stands there sadly."* This single clause also
prevents the most common interpolation failure, where the clip overshoots past your end frame.

### 7.9 Full block template

```
CLIP <#> — <duration>s — <aspect> — <mode>
Script line:   "<source>" → "<literal English>"
Intent:        <what this must land>
PROMPT:
  <cinematography: shot size, angle, move, speed>
  <subject anchor — brief if a frame is supplied, full Canon if not>
  <action with destination>
  <environment and what moves in it>
  <light: constant or how it changes>
  <style, grade, palette>
  <ending: "coming to rest as ...">
  <negative constraints, positively phrased>
INPUTS:        first=<path>  last=<path>  refs=<paths>
AUDIO:         <silent | ambient | SFX | dialogue>
ENDS ON:       <state, for the next clip>
```

---

## 8. V6 — Generation Modes

### 8.1 First + last frame interpolation — the default

The model paths between two supplied frames. Quality is decided at the frame stage, not here.

- **Describe the journey, not the endpoints.** The endpoints are supplied. The prompt's job is the
  path: how fast, in what order, with what easing.
- **Name the arrival**, phrased as a completion.
- **Match the prompt's implied action count to the duration** (section 5.3).
- **Never contradict the frames** on light, framing, or wardrobe.
- **Seamless loop:** pass the identical file as both frames and prompt ambient motion only.

Template:

> \<Camera move and speed\>, as \<subject phrase\> \<action with destination\>, \<what moves in the
> environment\>, \<how light behaves\>. \<Pace word\>. \<Grade phrase\>. Coming to rest as \<the end
> frame's state\>.

### 8.2 First frame only

For a held beat with ambient motion — flame, breath, dust, cloth, water, a crowd's small
adjustments. Cleaner and cheaper than a pair when nothing structural changes. The prompt carries
all the motion.

### 8.3 Reference / ingredients

Supply reference images of characters, objects, or locations; framing stays free. Use when a
subject must stay consistent across several shots but each shot needs its own composition.

**The anchoring trap:** many models anchor hard to reference images and quietly reuse their
framing while appearing to follow your prompt. Ask for a macro insert while passing a wide
establishing shot, and you get a mildly cropped wide shot. Fix: drop the reference and carry
identity through the text Canon, or anchor to an image that already has the target composition.

### 8.4 Text-to-video

No frames, no references. Acceptable for abstract, textural, or landscape B-roll with no identity
to hold. **Paste the full Canon and culture anchor** — with no pixels to anchor to, prose is all
the model has.

### 8.5 Multi-shot timestamp prompting

For a complete sequence inside one generation, where cutting in post would cost more than it
gains:

```
[00:00-00:02] Medium shot from behind the elder as she pushes the wooden shutter open.
[00:02-00:04] Reverse on her face, expression opening as the valley light reaches her.
[00:04-00:06] Tracking shot following her hand along the sill to the lamp.
[00:06-00:08] Wide high-angle, the figure small in the stone room.
```

Caveats: timestamps are **approximate**, never frame-exact — say so every time. Timestamp
prompting and first+last interpolation pull against each other; pick one per clip. More than four
windows in eight seconds reads as chaos.

### 8.6 Logo / brand image-to-video

- Use the supplied logo as the **starting frame**. Never as a style reference.
- **Never ask the model to generate, reconstruct, or describe its wording.** It will come back
  altered, and altered brand wording is worse than none.
- Animate **only non-text properties**: light sweep, material response, particles, depth, camera
  drift, background.

> Slow camera drift with a soft light sweep travelling left to right across the mark, subtle
> metallic material response, fine particles settling in the depth behind it, background gradient
> deepening. Locked composition, the mark stationary and unaltered. No readable text, no letters,
> no captions, no slogans, no signage, no subtitles, no generated wordmarks, and no change to the
> shape of the mark.

---

## 9. V7 — Audio Policy

**Default: silent.** Most scripted pipelines lay narration in post, and generated speech will not
match a scripted VO in language, timing, or voice. Worse, it produces visible lip movement that
fights the dub.

Enable audio only on explicit request. Syntax:

```
Dialogue:  A woman says, "We have to leave now."
SFX:       SFX: a heavy wooden shutter scraping open.
Ambient:   Ambient noise: distant wind across terraced fields, a single crow.
```

Ambient and SFX are the safe subset — they add texture without committing to a language. Dialogue
is the risky one. Carry the **sound cell** from each keyframe card into the ambient line even when
generating silent: it tells the post-production editor what the frame wants to sound like.

---

## 10. V8 — Continuity

A sequence is judged on its seams, not its shots.

- **Shared Canon.** Every clip draws on the same blocks. Never re-derive mid-project.
- **Grade lock.** One grade phrase, pasted into every prompt, unchanged.
- **Camera grammar.** Decide the project's camera language up front — mostly locked off with
  occasional slow pushes, or consistently handheld — and hold it. Mixed grammar reads as mixed
  sources.
- **Ends-on chaining.** Each clip's ending state is the next clip's opening assumption. Where two
  beats are spatially continuous, the end frame of one should be the start frame of the next.
- **Screen direction.** A figure moving left-to-right keeps that axis, unless a reversal is meant.
- **Eye-trace across cuts.** Place the next clip's anchor near where the previous clip left the
  eye, unless a jolt is intended.
- **Review each clip before its final frame seeds the next.** Drift compounds: a small error
  becomes the foundation of the next clip, and by the sixth it is a different film.

---

## 11. V9 — Audit, Generate, Verify — **GATE V3**

### 11.1 Pre-flight audit — run before asking for approval

**Dramaturgy gate (six points):** scene formula complete · three-detail check passed · every clip
performs a job · every camera move motivated · spatial geometry readable · five anchors named.

**Craft gate:** one primary camera move per clip · action density within budget · no contradictions
· character anchor present or deliberately omitted because a frame supplies it · final image named
· duration snapped to allowed values · negative constraints positively phrased.

Any failure is revised before delivery, not after generation.

### 11.2 GATE V3

> Every prompt in full · inputs per clip · clip count, total seconds, model, resolution, audio ·
> **estimated maximum cost** · what I do on failure (report and stop, never auto-retry).
>
> Explicit approval to generate?

### 11.3 Generate

Sequentially, one clip at a time, reviewing as you go. Never fire a whole batch and check at the
end — the first clip usually reveals a systematic problem that would otherwise repeat across
every remaining generation.

Log every call: prompt, inputs, parameters, result, cost. Into `video-pack.md`.

### 11.4 Verify — watch, don't assume

A successful API response is not a successful clip.

Watch each clip **at full speed, then again at the midpoint** — interpolation hides its worst work
in the middle, where neither supplied frame constrains it.

1. **Identity** — does the subject stay the same person throughout?
2. **Culture, period, setting** — the failure that looks competent and is completely wrong
3. **Physical plausibility** — does the motion obey weight and gravity?
4. **Arrival** — does it actually land on the end frame, or overshoot?
5. **First half-second** — any lurch means the prompt contradicted the start frame
6. **Text leakage** — text that flickers legible for four frames is worse than text simply present
7. **Hands, faces, limb count** through the whole duration, not just at the ends
8. **Grade consistency** against its neighbours, viewed in sequence

### 11.5 On failure — stop

Report the error verbatim, name the likely cause, state whether it was billed, propose one
targeted change, and **ask**. Never retry automatically. Never retry a safety rejection by arguing
with the filter — rephrase instead.

---

## 12. Model Adapters

Write to the universal skeleton, then adjust for the target. Where you do not know the model,
**the universal form is the correct output** — it degrades gracefully everywhere.

| Family | Notes |
| --- | --- |
| **Veo (3.x)** | Strong with cinematography vocabulary, synchronized SFX, dialogue in quotes, timestamp prompting, first+last frames, JSON-structured prompts. Discrete durations. Some aspect/resolution pairings are constrained — probe first |
| **Kling (3.x)** | Multi-shot handling, native lip-sync, strong on dialogue. Longer native durations than most |
| **Seedance (2.x)** | Longest native sequences, internal editing, lip-sync. Best when one generation must carry a whole passage |
| **Runway / Luma / Pika** | Shorter clips, strong camera-move control. Keep prompts tighter and motion simpler |
| **Sora family** | Rewards narrative prose and world description over technical camera terms |

Never assume a parameter name, a duration value, or a keyframe capability from this table. Probe
(section 0.2), or ask.

---

## 13. The Question Engine

Asking is the cheapest operation in this pipeline. Every unasked question becomes a regenerated
batch — and video regenerations are the most expensive thing here.

**Ask when:** the motion could plausibly go two ways · audio is unspecified · the target duration
is unstated · a clip would need a frame that does not exist yet · a real person, product, or brand
appears · the content touches religion, grief, caste, ethnicity, politics, or minors · cost is
about to be incurred · a model capability is unknown and the job depends on it.

**Do not ask when:** the answer is in the script, the handoff block, or a prior gate · it is a
routine craft decision that is yours · you are asking permission to continue already-approved work.

**Ask in batches.** A numbered list of five questions respects the user's time; five sequential
single questions does not.

### Standing batteries

**Gate V1:** right beats to animate? · anything to hold as a still instead? · audio silent or
generated? · target finished duration? · pacing — few long beats or many short?

**Gate V2:** pacing right? · any beat to promote, demote, split, or cut? · cost acceptable? ·
aspect and resolution confirmed?

**Gate V3:** any prompt to change before I spend? · confirm: generate now?

**After delivery:** which clips work, which do not, and specifically why? · anything worth
recording as a permanent rule for future jobs?

---

## 14. Worked Example

Source line (Nepali): *"पुराना नामहरू उनीहरूसँगै यात्रा गरे, एउटा पोकोमा बाँधिएर।"*
Literal: *"The old names travelled with them, tied in a bundle."*
Clip 07 · 6s · 9:16 · silent · first+last interpolation · function *Pressure*.

**Motion brief**

```
Change vector:  trailing foot completes its step; the bundle swings forward to the hip
Subject motion: one full stride, weight settling forward, shoulders easing on arrival
Camera:         slow push in, about 15%, same low axis
Move reason:    the effort is the subject — the push commits the viewer to the climb
Environment:    thin mist drifting right to left across the valley behind
Light:          constant, cool overcast dawn
Pace:           unhurried, one continuous movement
Three details:  1. wet stone underfoot  2. the strap biting into her forehead
                3. breath and grit, the piece's sound motif
Ends on:        foot planted, bundle at the hip, strap slack, the figure momentarily still
```

**Prompt as sent**

> Slow push in on a low-angle vertical shot, unhurried, as the elderly woman in the madder-red wrap
> completes one full stride up the wet stone hill trail — her rear foot landing and her weight
> settling forward while the cloth bundle on her back swings forward to rest against her hip, the
> forehead strap biting and then going slack. Thin mist drifts right to left across the terraced
> valley behind her. Light stays constant, cool overcast dawn. Photoreal documentary reenactment,
> shallow depth of field, natural film grain. Coming to rest as her foot plants and the bundle
> settles, the figure held momentarily still.
>
> An empty hill trail with no vehicles, no wires, no modern objects. An unmarked frame: no readable
> text, no letters, no numbers, no subtitles, no captions, no watermark. Her face stays the same
> face throughout. Natural anatomy, correct hands. Steady light with no sudden shifts, and no
> camera stutter.

**Inputs:** `first=frames/07_start.png`, `last=frames/07_end.png` · **Ends on:** foot planted,
bundle at hip, strap slack.

---

## 15. Failure Modes

| Symptom | Real cause | Fix |
| --- | --- | --- |
| Transient "high load" / capacity error | Service-side, not your prompt. Usually not billed | Wait, then **ask before retrying**. Usually succeeds on the second attempt |
| Safety rejection on benign content | Filter triggered by *phrasing*, not subject. Common triggers: martial or restraint language, devotional portrayals of revered figures, "concept art character sheet" framings | Bisect the prompt to find the phrase. Rephrase gently. Never argue with the filter |
| Face morphs mid-clip | Frames disagree on identity, or no frames and no Canon anchor | Fix at the frame stage. Never patchable in the video prompt |
| Lurch in the first half-second | Prompt contradicts the start frame — light, framing, or wardrobe | Strip the prompt back to motion only |
| Clip fast-forwards | Too many actions for the duration | One action per four seconds. Split the beat |
| Clip ends before it lands | No arrival named | Add the "coming to rest as…" clause |
| Motion drifts aimlessly | Movement had no destination | Give it an endpoint |
| Camera feels random | Move was unmotivated | Either justify it with a change, or lock off |
| Sequence reads as unrelated clips | Grade or camera grammar not locked | One grade phrase in every prompt; fix the camera language |
| Prompt ignored, reference's framing reused | Model anchoring hard to the reference | Drop the reference, or anchor to an image with the target composition |
| Resolution silently lower than requested | Resolution coupled to aspect ratio on this model | Expected on several models — verify against the model's real constraints before calling it a bug |
| Output generated but not retrieved | Delivery/download step, not generation. **The clip usually exists** | Check the output location before regenerating. Never pay twice for a download failure |

---

## 16. Copy-Paste Operating Prompt

```
You are operating under MASTER-VIDEO-GENERATION.md. Follow it exactly.

HANDOFF BLOCK (from MASTER-IMAGE-GENERATION.md):
<paste, or write "none — run standalone">

SCRIPT (any language):
<paste the full script>

CONTEXT I ALREADY KNOW:
Target model / tool: <or "detect and tell me">
Aspect / resolution: <or "ask me">
Audio:               <silent, VO in post | generate audio | unknown>
Finished duration:   <or "ask me">
Known constraints:   <brand, religious, cultural, legal>

Do this now:
1. State your capability tier, target model, and what you will probe before spending.
2. If there is no handoff block, run S1–S4 of MASTER-IMAGE-GENERATION.md first.
3. V1 — recommend which beats need motion and which stay stills, with a reason each.
4. STOP at GATE V1 and ask me the standing battery.

Do not generate anything. Do not skip a gate. Ask in batches.
```
