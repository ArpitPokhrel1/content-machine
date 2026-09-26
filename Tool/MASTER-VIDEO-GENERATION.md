# MASTER-VIDEO-GENERATION

Turn a script in any language into a directed, continuity-safe sequence of AI video clips.
Paired with `MASTER-IMAGE-GENERATION.md`, which produces the keyframes this file animates. Both
share one Canon.

This is the concise version: the 20% of the method that drives 80% of the result, plus every
lesson that has changed a real clip (section 7). The full treatment, with theory, cut-weighting
and more examples, is `archive/MASTER-VIDEO-GENERATION.full.md`.

> A beautiful frame without dramaturgy is wallpaper. Direction first, model syntax second.

---

## 0. Rules

1. **Analyse the complete script before choosing scenes.**
2. **Ask which portions need motion and whether audio is required.** The default is silent.
3. **Never generate on implied approval.** Analysis ≠ shot list ≠ prompts ≠ paid generation.
   Approved images ≠ approved video. One approved batch ≠ an approved retry.
4. **Before generating, state:** clip count, total seconds, model, resolution, audio, and the
   estimated maximum cost. Then wait for an explicit "go".
5. **Never auto-retry a failure.** Report it verbatim, name the likely cause, say whether it was
   billed, propose one change, and ask.
6. **Timestamps are approximate storytelling guidance**, never frame-exact. Say so every time.
7. **Return the output folder and every clip path.**

**No handoff block from the image stage?** Run sections 1–2 of `MASTER-IMAGE-GENERATION.md`
first (translation, classification, story, Canon). Never write a video prompt without a Canon;
identity and culture drift can't be fixed in post.

---

## 1. Scope: what actually needs motion

Motion is the most expensive thing in the pipeline. A beat earns it only when movement carries
the meaning:

| Animate | Keep as a still |
| --- | --- |
| A physical change is the point (a hand completes an act, a door opens) | A symbolic tableau |
| Atmosphere is the point (fire, water, crowd, weather, cloth) | The image already says everything |
| A camera move reveals something withheld | Motion would only add drift risk |
| The break point or the final image | A connector between two stronger beats |

A few moving beats among held stills beats everything moving. If everything moves, nothing does.

**Ask in one batch:** which beats to animate · anything to hold or promote · audio (silent with
VO in post is the default) · target finished duration · pacing (few long beats or many short).

---

## 2. Dramaturgy: the pass that makes it a film

For the piece and for every clip, name the following in one sentence each:

> **Scene = desire + obstacle + space geometry + controlled gaze + rhythm**

For non-narrative scripts: desire = the question the line answers, obstacle = what makes it
non-obvious, geometry = the staging, gaze = where the eye goes, rhythm = cut length.

- **Every clip does one job:** change emotion, advance action, or raise pressure. Otherwise cut it.
- **Cut for emotion first.** Emotion outweighs story, and story outweighs rhythm. Cutting for pace
  alone gives you busy, forgettable content.
- **Rhythm ladder, not a metronome:** `4s · 4s · 3s · 2s · PAUSE · impact`. The longest hold is
  usually the one just *before* the climax.
- **The five anchors** (emotion, motif, anchor object, break point, final image) carry over from
  the image stage unchanged. The final image is the sequence's destination.
- **Spatial clarity:** in every clip the viewer knows where the subject is, where the pressure
  comes from, and which way is out.

---

## 3. Shot list

- **Duration:** snap to the model's allowed values (Veo: 4 / 6 / 8 s). Long beats split into
  `NNa`/`NNb` sharing one environment. Never stretch one generation.
- **Action density: one complete action per ~4 s.** Three actions in 4 s plays as fast-forward.
- **Default mode: first+last frame interpolation.** It is what makes N clips read as one film.
  Every other mode is a fallback with a stated reason:
  - *first frame only*: a held beat with ambient motion (flame, breath, mist, cloth)
  - *subject reference*: identity must hold but framing is free. On Veo fast, this **requires 8 s**
  - *text-to-video*: abstract or landscape B-roll only. Paste the full Canon and culture anchor
  - *logo start frame*: see section 6

| # | Lines | Dur | Fn | Emotion | Mode | Start | End | Camera | Audio | Ends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

**Ends on** is the continuity spine: each clip's final state is the next clip's opening
assumption.

---

## 4. Motion brief → prompt

### 4.1 Brief (one per clip, before the prompt)

```
Change vector   the ONE thing that changes (same vector as the keyframe pair)
Subject motion  which joint, which weight shift, what speed, where it ARRIVES
Camera          ONE dominant move + speed, or locked off, and what change justifies it
Environment     what moves that isn't the subject (cloth, smoke, water, crowd)
Light           constant, or exactly how it changes
Ends on         the exact state of the last frame
```

### 4.2 Prompt rules

- **Order:** camera + speed → subject → action with destination → environment motion → light →
  grade phrase → "Coming to rest as <end state>" → constraints last.
- **Weight budget:** about 40% camera and motion, 25% subject action, 20% environment and light,
  15% style and constraints. When a clip is wrong, the underspecified part is almost always
  camera and motion.
- **One primary camera move per clip.** Every move must answer "what changed?". If nothing did,
  lock off.
- **Motion needs a destination.** "She walks" drifts. "She takes three steps and stops with her
  hand on the doorframe" arrives.
- **Show, don't tell.** Two to four physical cues per emotional change (jaw sets, breath held,
  gaze drops and returns), never "he is frightened".
- **Name the final frame:** "Coming to rest as her hand settles flat on the page." This one clause
  stops the model overshooting past your end frame.
- **With a start frame, don't re-describe it.** The face, wardrobe and room are already in the
  pixels, and restating them invites the model to reinterpret them (a visible lurch in the first
  half-second). Keep one grounding phrase ("the elderly woman in the madder-red wrap") and spend
  the prompt on motion. **Without a frame, paste the full Canon block.**
- **Lock the start pose in words** ("palms stay joined above her head for the entire clip"). A pose
  word that contradicts the frame makes Veo move the subject to match the words.
- **No contradictions** (still water + flowing current; close-up + sweeping vista; overcast frame
  + golden-hour prompt). Models obey the strongest signal and never average.
- **Final Veo prompts are in concise English**, whatever the script's language.
- **Standard closing constraints:** *"No readable text, no letters, no numbers, no subtitles, no
  captions anywhere. Her face stays the same face throughout. Natural anatomy, correct hands.
  Steady light with no sudden shifts."* Never write "watermark".

### 4.3 Worked example (6 s, 9:16, silent, first+last)

> Slow push in on a low-angle vertical shot, unhurried, as the elderly woman in the madder-red
> wrap completes one full stride up the wet stone hill trail — her rear foot landing and her
> weight settling forward while the cloth bundle on her back swings forward to rest against her
> hip. Thin mist drifts right to left across the terraced valley behind her. Light stays
> constant, cool overcast dawn. Photoreal documentary reenactment, shallow depth of field,
> natural film grain. Coming to rest as her foot plants and the bundle settles. No vehicles, no
> wires, no modern objects. No readable text, no letters, no subtitles. Her face stays the same
> face throughout. Natural anatomy, correct hands.

---

## 5. Continuity across clips

- **One Canon, one grade phrase, and one camera grammar** (for example mostly locked off with
  occasional slow pushes), held for the whole project. Mixed grammar reads as mixed sources.
- **Ends-on chaining:** where two beats are spatially continuous, the end frame of one is the
  start frame of the next.
- **Keep screen direction.** A figure moving left-to-right keeps that axis.
- **Quality is decided at the frame stage.** A face that morphs mid-clip is a keyframe problem
  and can't be patched in the video prompt.

---

## 6. Logo / brand image-to-video

The supplied logo is the **starting frame**, never a style reference. Never ask the model to
generate, reconstruct or describe its wording. Animate only non-text properties: light sweep,
material response, particles, depth, camera drift, background.

> Slow camera drift with a soft light sweep travelling left to right across the mark, subtle
> metallic material response, fine particles settling in the depth behind it. Locked
> composition, the mark stationary and unaltered. No readable text, no letters, no captions, no
> slogans, no signage, no subtitles, no generated wordmarks, and no change to the shape of the
> mark.

---

## 7. Proven Veo fixes (each has changed a real clip)

| Problem | Fix |
| --- | --- |
| Subject-reference job rejected at 6 s | Veo fast needs **8 s** for any `subject_reference` scene |
| 9:16 text-to-video comes back letterboxed (114 px bars) | Start from a full-bleed 9:16 keyframe. Crop in post: `crop=592:1052:64:114,scale=720:1280` |
| 10 px bars even from a keyframe | Check the edge strip, not only `cropdetect`. Fix: `crop=720:1260:0:10,scale=720:1280` |
| "Locked-off camera" still drifts | Treat it as unachievable. Stabilise or crop in post |
| Loose hair "in the wind" | Renders as detached floating strands. Never write it |
| Deities "in the background" in reference mode | Identical grey duplicates. Keep them out of frame, or supply them via keyframes |
| A stream (milk, light) with no visible origin | Veo invents a source (a second animal head). Keep the origin in both frames, lock the camera, and add "no additional animals or heads enter the frame" |
| A non-physical start state (a leaning flame) | Veo normalises it back. Give it a continuous cause for the whole clip and name the end state ("never returns to upright") |
| "Hammer strikes a glowing disc" | White flash hides the figure. Write "a small controlled burst of sparks" |
| Small secondary figure vanishes mid-clip | Check small figures across the whole clip, not only the ends. Trim the head if needed |
| Transformation (god → animal/human) | Both keyframes share a light column. Build the second keyframe as an edit of the first with the target identity attached |
| Walking shadow with no caster | Works if the sun is to the side or ahead in the keyframe. A photographer's-own-shadow angle makes Veo drift the camera instead |
| Output "failed" but the clip exists | Check the output folder before paying twice. `/api/quick/video` returns `file`, not `files` |
| High-load or capacity error | Service-side and usually not billed. Wait, then **ask** before retrying |
| Safety rejection on benign content | Bisect the prompt to find the phrase and rephrase it gently. Never argue with the filter |

---

## 8. Generate: pilot, then parallel

1. **Pre-flight audit:** every clip has a job, one camera move, action density within budget, a
   named final frame, no contradictions, a duration snapped to allowed values, and a character
   anchor (or a start frame supplying it).
2. **Approval gate:** show every prompt, inputs per clip, count, seconds, model, resolution, audio,
   and max cost. Wait for an explicit yes.
3. **Pilot clip first.** Generate one representative clip and watch it. The first clip usually
   reveals a systematic problem that would otherwise repeat across the batch.
4. **Then run the rest in parallel** (`agent-video.mjs batch`, concurrency from
   `VIDEO_CONCURRENCY`). All clips share one Canon, one grade phrase and approved keyframes, so
   running them in parallel costs no consistency. Parallelism is only safe *after* the pilot
   passes.
5. **Verify by watching, at full speed and then again at the midpoint.** Interpolation hides its
   worst work in the middle. Check identity → culture and period → physics → arrival on the end
   frame → first half-second lurch → text flicker → hands and limbs → grade against neighbours.
   Crop-check the edges for bars.
6. Log every call (prompt, inputs, parameters, result) in `<project>/video-pack.md`. Add new model
   lessons to `orchestrator_memory.md`.

---

## 9. Audio

The default is **silent**. Scripted pieces get narration in post, and generated speech fights
the dub with visible lip movement. Enable audio only on request. Ambient and SFX lines are the
safe subset (`Ambient noise: distant wind across terraced fields`). Dialogue is the risky one
(`A woman says, "We have to leave now."`).

---

## 10. Copy-paste operating prompt

```
Operate under Tool/MASTER-VIDEO-GENERATION.md and read Tool/orchestrator_memory.md first.

HANDOFF BLOCK: <paste, or "none — run image stages 1–2 first">
SCRIPT: <full script>
KNOWN: model <…> · aspect <…> · audio <…> · finished duration <…> · constraints <…>

1. Recommend which beats need motion (reason each) and ask the scope questions in ONE batch.
2. Shot list with mode, duration snaps and ends-on states.
3. Motion brief + prompt per clip, then pre-flight audit.
4. STOP: count, seconds, model, resolution, audio, max cost. Wait for explicit approval.
5. Pilot one clip → then the rest in parallel → watch every clip → deliver paths.
```
