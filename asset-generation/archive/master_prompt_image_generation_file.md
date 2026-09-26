# Master Prompt File: Bamsawali Image Generation

Use this file to delegate Bamsawali image-generation work to a junior intern using Codex, Claude, ChatGPT, or any other image-generating agent.

This document is self-contained. It includes the operating rules, prompt structure, visual references, reusable prompt templates, prior Bamsawali pack patterns, and blog-cover examples needed to complete the task without opening any other local prompt pack or skill file.

The goal is to turn Nepali genealogy, gotra, kul, thar, and family-history scripts into realistic image assets that look like documentary stills or believable blog-cover photographs. The images should make viewers hesitate before deciding whether they are AI-generated.

This file is intentionally detailed. Follow it as an operating manual.

---

## 1. Core Outcome

For every script, produce:

1. A line-by-line English translation if the source is Nepali.
2. A context analysis explaining the historical, cultural, religious, geographic, and visual arc.
3. A beat-by-beat prompt plan.
4. Final generated images saved in a clean folder.
5. A prompt-pack markdown file documenting every final prompt and reuse decision.
6. A verification summary: image count, dimensions, visual spot-check, and known limitations.

The final assets must be:

- Photorealistic.
- Culturally respectful.
- Nepali and Himalayan in texture, architecture, clothing, light, and objects.
- Free of readable text unless explicitly required.
- Free of logos, watermarks, UI overlays, speech bubbles, and accidental poster typography.
- Saved in the project workspace, not only in the image tool's default generated-image folder.

---

## 2. Output Types

### A. Short-Video / Reel Image Pack

Use this for scripts like Paudel, Neupane, Kafle, Ghimire, etc.

- Aspect ratio: vertical `9:16`.
- Target output: `30-35` images unless the user asks otherwise.
- Preferred generated size: roughly `941x1672` or any clean vertical 9:16 equivalent.
- Output folder pattern: `<surname-or-topic>-image-pack/images`.
- Prompt-pack file pattern: `<surname-or-topic>-image-pack/<surname-or-topic>-image-prompts.md`.
- Filename pattern:
  - `01-opening-hook.png`
  - `02-rishi-root.png`
  - `03-gotra-adoption.png`
  - Use two-digit numbering.
  - Use lowercase hyphenated English filenames.

### B. Blog Cover Pack

Use this for markdown blog articles or Drive folders of articles.

- Aspect ratio: horizontal landscape `16:9`.
- Target output: one cover per script/article.
- Preferred generated size: roughly `1672x941`, `1536x864`, `1920x1080`, or any clean horizontal 16:9 equivalent.
- Output folder pattern: `<source>-blog-cover-pack/images`.
- Prompt-pack file pattern: `<source>-blog-cover-pack/blog-cover-prompts.md`.
- Filename pattern:
  - Use the markdown slug as the image filename.
  - Example: `kafle-surname-history.md` -> `kafle-surname-history.png`.

---

## 3. Generation Mode Rules For Codex Agents

Use the built-in image generation tool by default.

If Codex generates images into its default generated-image directory, copy the selected final PNGs into the workspace output folder before finishing. Do not leave project assets only in the hidden/default generated-images folder.

Do not use CLI/API fallback unless the user explicitly requests CLI/API/model controls or true transparent output. Normal Bamsawali images are standard raster photos and should use the built-in image tool.

For many images, make one generation call per distinct image prompt. Do not ask for many unrelated images in one single prompt.

For duplicated or bilingual articles, you may reuse one generated image and copy it to multiple final filenames, but document that reuse clearly.

---

## 4. Source Intake And Optional Research

Before writing prompts, read the source script fully. If related files are available in the workspace, they may be used as additional optional context, but this master file is enough to run the task without them.

Optional local discovery commands:

```powershell
rg --files
rg -n "Paudel|पौडेल|Neupane|न्यौपाने|Kafle|काफ्ले|gotra|गोत्र|वंश|थर" .
```

If the user gives a Google Drive folder, list all files in the folder, identify scripts/articles, and generate one output image per script unless asked otherwise.

Do not over-research every ancient claim unless the task is specifically fact-checking. For image generation, the main need is visual context, cultural accuracy, and a coherent visual progression.

Embedded references begin in Section 24. Use those embedded references as the default source of truth for style, workflow, and reusable image concepts.

---

## 5. Script Analysis Pattern

Most Bamsawali "Thar Yatra" surname scripts follow this arc:

1. Direct surname hook.
2. Question that creates curiosity.
3. Ancient root: rishi, gotra, pravara, scripture, or kul memory.
4. Migration pressure or historical turning point.
5. Entry into Nepal or a specific kingdom/region.
6. A defining local incident, settlement, court event, ritual, occupation, ecology, or oral name.
7. Sound change or word evolution into the present surname.
8. Spread across Nepal.
9. Important descendants or cultural legacy.
10. CTA: send to family/friend, comment next surname, follow Bamsawali.

Your images must follow this progression visually. Do not jump randomly between scenes.

---

## 6. Line-By-Line Translation Requirement

For Nepali scripts, create a translation table before prompt writing.

Use this format:

```markdown
## Line-by-Line English Translation

| Nepali script line | English translation |
| --- | --- |
| न्यौपाने। | Neupane. |
| कथा सुरु हुन्छ... | The story begins... |
```

Keep translation literal enough to preserve meaning. Do not rewrite the script into a new script unless the user asks.

---

## 7. Context Analysis Template

After translation, write a short analysis like this:

```markdown
## Context Analysis

This script belongs to Bamsawali's religion, culture, and family-history format. It traces a surname through gotra/rishi memory, migration, local settlement, oral naming, and modern family identity.

Visual spine:
- Ancient root: <rishi/gotra/kul>
- Migration route: <place A> to <place B>
- Defining episode: <court miracle / kafal hill / Paudi origin / etc.>
- Naming moment: <word evolution>
- Spread: <regions>
- Closing: family sharing and digital vansawali preservation

Sensitive handling:
- Treat ancient and contested details as symbolic documentary reenactment, not literal proof.
- Avoid caricatures of any religious or ethnic group.
- Do not show graphic violence.
- Use realistic ritual, domestic, and geographic details.
```

If the topic is Tamang, Gurung, Magar, Newar, Buddhist, Kirat, or another non-Brahmin/non-Hindu lineage, adapt the visual system to that culture. Do not force Hindu puja props into scenes where they do not belong.

---

## 8. Beat Breakdown Rules

For video scripts:

- Create `30-35` beats.
- Each beat should map to around `4-5 words` or one short script idea.
- The first image should work as a hook.
- The last image should work as a CTA or modern preservation frame.
- Reuse generic Bamsawali frames only when the context is truly generic.

Beat table format:

```markdown
## Image Beat Plan

| # | Cue | English beat | Image type | Reuse/new |
| --- | --- | --- | --- | --- |
| 01 | `काफ्ले` | Surname hook | Old manuscript close-up | New or reuse generic |
| 02 | `काफल` | Kafal fruit origin | Kafal macro | New |
| 03 | `ऋषि शाण्डिल्य` | Rishi root | Ancient ashram | New |
```

For blog covers:

- Create one visual concept per article topic.
- If the same topic has English and Nepali versions, generate one concept and copy it to both output filenames.
- If multiple scripts are the same surname topic, reuse the same cover unless the article/video script differs visually.

---

## 9. Reuse Decision Rules

Reuse existing generated images when:

- The beat is generic Bamsawali opening material.
- The beat is a generic manuscript, "Thar Yatra," family sharing, or digital preservation scene.
- The user explicitly says to reuse similar contexts.
- The previous image already matches the new script with no cultural or factual mismatch.

Generate a new image when:

- The beat mentions a specific rishi, gotra, region, kingdom, fruit, ritual, miracle, local place, migration route, or naming event.
- The scene would confuse the viewer if reused.
- The previous image has the wrong culture, clothing, geography, aspect ratio, or object symbolism.
- The previous image contains accidental text, strange hands, distorted faces, modern objects in a historical scene, or AI-looking polish.

Always document reuse like this:

```markdown
### 05. Thar Yatra Manuscript

Reuse: copy an existing generic "Thar Yatra manuscript" image to the new pack when a previous pack is available. If no previous image exists, regenerate it using the embedded reusable prompt in Section 26.

Reason: This is a generic Bamsawali manuscript-opening frame and fits the shared surname-history tone.
```

---

## 10. Master Visual System

Use this shared visual system for Hindu/gotra surname-history video images:

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Visual system: photoreal documentary reenactment, realistic enough to feel like carefully staged historical footage, natural human imperfections, authentic textures, no over-polished AI look
Culture and setting: Nepali / western Himalayan lineage context, gotra and kul memory, stone hill settlements, terraced fields, brass puja objects, red tika, janai, palm-leaf or handmade paper manuscripts, wool and cotton textiles, temple courtyards, mountain light
Camera language: 35mm or 50mm documentary lens, natural depth of field, grounded eye-level or slightly low perspective, cinematic but not glossy
Lighting: warm dawn or late afternoon natural light, realistic shadows, firelight only when contextually appropriate, no artificial fantasy glow
Color: earthy stone, muted saffron, madder red, off-white cotton, dark wood, aged paper, brass, Himalayan blue-grey distance
Texture: rough stone, handwoven wool, worn cotton, oxidized brass, soot-darkened wood, handmade paper fibers, dust, smoke only when natural
Constraints: no readable text, no logo, no watermark, no modern objects in historical scenes, no fantasy glow, no caricatured villains, no gore, no exaggerated costumes, no plastic, no eyeglasses unless modern scene
```

Use this for modern CTA / preservation images:

```text
Use case: photorealistic-natural
Asset type: vertical 9:16 closing still for a Nepali genealogy short video
Visual system: candid documentary lifestyle image, natural family interaction, realistic skin texture, normal hands, no over-polished AI look
Culture and setting: modern Nepali family context, multi-generation family members, old family photos or notebooks, smartphone sharing, quiet domestic interior, ancestry preservation mood without visible branding
Camera language: 35mm documentary lens, natural depth of field, grounded perspective
Lighting: soft window light or warm indoor evening light
Constraints: no readable phone text, no logo, no watermark, no distorted hands, no staged influencer pose, no app branding
```

Use this for blog covers:

```text
Use case: photorealistic-natural
Asset type: horizontal 16:9 landscape blog cover for Bamsawali
Visual system: photoreal Nepali documentary cover photo, natural lighting, realistic skin, cloth, architecture, objects, and weather
Theme: cultural heritage, surname history, oral history, vansawali, gotra, kul, ancestral memory, migration, family identity
Composition: wide cinematic layout with one clear focal group and calm negative space for a blog title overlay; avoid clutter near the title-safe area
Lighting: dawn, late afternoon, or soft mountain daylight; realistic shadows and atmospheric depth
Constraints: no readable text, no logo, no watermark, no UI, no poster typography, no fantasy effects
```

---

## 11. Pixel-Level Composition Guidance

Think of every image as a usable frame, not just a pretty scene.

### For 9:16 Reels

- Keep the main subject in the center third or lower two-thirds.
- Leave space near the top or upper-left for editor-added Nepali captions.
- Avoid placing important faces at the extreme top edge where mobile UI may cover them.
- Foreground should contain tactile detail: manuscript, brass lamp, red thread, fruit, water vessel, firewood, ritual tray, or hands.
- Midground should contain people and action.
- Background should contain geography: terraced hills, stone houses, forest, court, river, temple, or mountain path.
- Avoid overcrowding. Four to seven visible people is usually enough.
- Close-ups work best for opening hooks, manuscripts, ritual hands, fruit, water, fire, and naming symbolism.
- Wide shots work best for migration, settlement, kingdom arrival, dispersal, and spread across Nepal.

### For 16:9 Blog Covers

- Use a wide environmental composition.
- Put the main human group or symbolic object off-center.
- Leave a clean title-safe zone on one side, usually sky, hill haze, wall, floor, or shadow.
- Do not place tiny detailed text or faces in the title-safe area.
- The image must still read clearly when cropped to a website thumbnail.
- Do not make the cover look like a movie poster. It should feel like a documentary editorial photo.

---

## 12. Cultural Detail Library

Use details from the correct place and community. Never mix everything into every image.

### Hindu / Brahmin / Gotra Surname Scenes

Useful objects:

- Handmade paper manuscript.
- Palm-leaf manuscript.
- Cloth-wrapped vansawali notebook.
- Brass diya.
- Brass lota.
- Copper or brass kalash.
- Puja thali.
- Red tika.
- Janai.
- Kusa grass.
- Rice grains.
- Marigold petals.
- Red cotton thread.
- Wooden writing board.
- Wool rug.
- Low wooden table.

Useful clothing:

- Off-white cotton dhoti/daura-like garments.
- Homespun shawls.
- Wool blankets.
- Dhaka topi for later/hill contexts.
- Simple traditional leather or rope sandals.
- Muted saffron cloth only where religiously appropriate.

Avoid:

- Modern printed shirts in ancient scenes.
- Zippers, sneakers, backpacks, wristwatches, sunglasses.
- Eyeglasses in ancient or medieval scenes.
- Plastic buckets, modern steel railings, wires, concrete roads, motorcycles.
- Gold-heavy fantasy royal costumes.

### Western Nepal / Himalayan Hill Context

Useful environments:

- Stone houses with slate roofs.
- Terraced fields.
- Dry Karnali-like hills.
- High ridge trails.
- River gorges.
- Pine or mixed hill forest.
- Temple courtyard.
- Stone fort gate.
- Royal hill court.
- Mud-plastered interiors.
- Smoke-darkened wooden beams.

Useful mood:

- Mountain dawn.
- Late afternoon golden light.
- Cold blue-grey distance.
- Dust in dry hill air.
- Smoke from diya, hearth, or ritual fire when natural.

### Kafle-Specific Details

Use:

- Kafal berry clusters.
- Red berries on hill trees.
- Kafal-covered Bajhang slopes.
- Khoriya clearing.
- New hill homestead.
- Shandilya gotra memory.
- Places like Kafalseri, Shandil Kot, Shandeli Triveni as living-memory landscapes.

Avoid:

- Generic apple or cherry trees instead of Kafal.
- Tropical lowland fruit trees.
- Overly glossy berries that look like plastic.

### Neupane-Specific Details

Use:

- Kaudinya gotra memory.
- Two learned Bhatta brothers.
- Kanyakubja to Darchula to Jumla route.
- Jumla royal court.
- Vratabandha preparation.
- Arani fire sticks.
- Sacred water spring emerging from the ground.
- Brass water vessel.
- Fire and water as ritual symbols.
- Dhulagoh/Jumla stone settlement.

Avoid:

- Giant magical fountains.
- Fire beams from hands.
- Fantasy sorcery effects.
- Readable title plaques saying Navpaniya or Neupane.

### Paudel-Specific Details

Use:

- Atri / Atreya gotra memory.
- Paudi of Tehri Garhwal.
- Doti / Ajayameru arrival.
- Vansharaj Bhatta court or military service.
- Paudi of Bajhang as settlement/capital.
- Chilkhaya/Kalikot settlement.
- Oral evolution from Paudiwala to Paudel.
- Mountain kingdom, court, and migration imagery.

Avoid:

- Graphic battle scenes.
- Exact portraits of modern public figures.
- Overly grand palaces that do not fit western Nepal hill architecture.

### Blog Cover Community Contexts

For Tamang:

- Use Tamang hill village, prayer flags, mani stones, prayer wheels, carved wooden windows, Buddhist-Tamang cultural cues, realistic traditional clothing.
- Do not force Brahmin puja details unless the script does.

For Gurung:

- Use Gurung hill village, stone houses, slate roofs, rhododendron, Annapurna-like mountain backdrop, elders and family with lineage notebook.

For Magar:

- Use Magar hill settlement, community courtyard, woven baskets, madal drum, traditional clothing, terraced hills.

For Kul Devata:

- Use ancestral shrine, family deity context, brass puja items, old notebooks, elders and children, terraced hill village.

For Same Gotra Marriage:

- Use two families and elders in respectful discussion, family tree chart with no readable labels, priest or elder explaining lineage, calm mood.

---

## 13. Prompt Schema

Use this structure for every generated image:

```text
Use case: <historical-scene | photorealistic-natural>
Asset type: <vertical 9:16 cinematic still for a Nepali genealogy short video | horizontal 16:9 landscape blog cover>
Primary request: <one clear sentence describing the scene>
Scene/backdrop: <place, architecture, geography, period>
Subject: <people/objects/actions>
Style/medium: photoreal documentary reenactment, realistic human imperfections, authentic texture
Composition/framing: <close-up / medium / wide; subject placement; overlay-safe space if needed>
Lighting/mood: <dawn / late afternoon / warm lamp / cold mountain light; emotional tone>
Color palette: <earthy stone, off-white cotton, madder red, brass, mountain blue-grey, etc.>
Materials/textures: <paper fibers, brass patina, rough stone, wool weave, fruit skin, water, ash, dust>
Constraints: <must-have rules>
Avoid: <negative constraints>
```

Use complete paragraphs instead of short labels when sending to a non-Codex image model. Most image models respond better to a single vivid paragraph plus a final constraints sentence.

---

## 14. Negative Prompt Library

Add these constraints to almost every Bamsawali generation:

```text
No readable text, no logos, no watermark, no UI overlay, no poster typography, no speech bubbles, no modern plastic, no random English letters, no distorted hands, no extra fingers, no melted faces, no identical cloned faces, no over-smoothed skin, no glossy fantasy armor, no neon colors, no fantasy glow, no magic beams, no gore, no caricatured villains, no modern buildings in historical scenes, no wires, no vehicles, no sneakers, no backpacks, no wristwatches, no eyeglasses in ancient scenes.
```

Use specific negative constraints when needed:

- Ritual scene: `no modern matches, no gas lighter, no electric bulb`.
- Manuscript scene: `decorative marks may exist but they must be unreadable`.
- Map scene: `no labels, no arrows with text, no readable place names`.
- Phone scene: `phone screen must be dark, blurred, or unreadable; no app branding`.
- Public figures: `do not create exact likenesses of living public figures`.

---

## 15. Prompt Examples

### Example 1: Generic Opening Hook

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A close documentary-style image of elderly Nepali hands opening an old family genealogy manuscript on a low wooden table inside a traditional hill home.
Scene/backdrop: mud-plastered room with stone wall texture, a small brass oil lamp, folded Nepali textiles, and faint family photos blurred in the background.
Subject: wrinkled hands, handmade paper, old ink marks that are decorative and unreadable, a subtle red thread beside the manuscript to symbolize lineage.
Style/medium: photoreal documentary reenactment, natural imperfections, authentic textures.
Composition/framing: close-up, hands and manuscript dominant, shallow depth of field, vertical frame with room for later text overlay.
Lighting/mood: warm oil-lamp and late afternoon window light, intimate and ancestral.
Constraints: no readable text, no logo, no watermark, no modern plastic, no fantasy effects.
```

### Example 2: Rishi / Gotra Root

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali Hindu genealogy short video
Primary request: A realistic ancient Himalayan ashram scene showing a revered elderly rishi teaching a small group of disciples.
Scene/backdrop: forest-edge hermitage in the foothills, stone platform, sacred fire, palm-leaf manuscripts, distant snow peaks.
Subject: sage figure seated calmly with disciples listening, simple saffron and off-white robes, janai visible where natural.
Style/medium: photoreal historical reenactment, respectful Hindu spiritual tone, no fantasy.
Composition/framing: medium-wide vertical shot, rishi slightly off-center, disciples and manuscripts forming a natural triangle.
Lighting/mood: dawn light, smoke from small yajna fire, quiet and scholarly.
Constraints: no divine glow, no supernatural effects, no readable text, no logo, no watermark.
```

### Example 3: Migration Under Insecurity

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A realistic medieval Himalayan migration scene showing families leaving an ancestral hill village with sacred and household items.
Scene/backdrop: narrow mountain trail above terraced fields, stone homes fading behind, distant smoke on the horizon without showing any enemy.
Subject: elders, parents, children, and pack animals carrying wrapped manuscripts, brass vessels, blankets, and grain sacks.
Style/medium: photoreal documentary reenactment, emotionally restrained, historically grounded.
Composition/framing: vertical leading-line trail, family moving from lower foreground toward a high mountain pass.
Lighting/mood: overcast dawn, quiet sorrow and determination.
Constraints: no gore, no visible attacking group, no religious stereotypes, no modern objects, no readable text, no logo, no watermark.
```

### Example 4: Local Naming Moment

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A realistic village path scene where local people recognize a newly settled family by the hill or place they came from.
Scene/backdrop: stone lane with grain baskets, handmade pottery, wool blankets, terraced fields and dry hills behind.
Subject: local villagers warmly greeting the family; one elder gestures toward the ridge while the family stands with manuscript bundle and household items.
Style/medium: photoreal documentary reenactment, human and natural.
Composition/framing: medium-wide vertical shot, market items foreground, faces and gestures central.
Lighting/mood: warm late afternoon, neighborly and everyday.
Constraints: no readable text, no speech bubbles, no logo, no watermark, no modern objects.
```

### Example 5: Word Evolution Without Text

```text
Use case: historical-scene
Asset type: vertical 9:16 symbolic still for a Nepali genealogy short video
Primary request: A realistic generational storytelling scene symbolizing a spoken place-name becoming a family surname over time, without showing written words.
Scene/backdrop: traditional hill home interior with old manuscript, red thread, brass oil lamp, and younger family members listening.
Subject: an elderly villager speaking to a younger adult while a child listens, with the family's wrapped manuscript between them.
Style/medium: photoreal documentary reenactment, no fantasy, no literal typography.
Composition/framing: medium vertical shot, elder's speaking gesture and listener's attentive face central, manuscript foreground.
Lighting/mood: warm evening lamp light, intimate oral-history feeling.
Constraints: no readable text, no speech bubbles, no logo, no watermark, no modern objects.
```

### Example 6: Modern Family Sharing CTA

```text
Use case: photorealistic-natural
Asset type: vertical 9:16 closing still for a Nepali genealogy short video
Primary request: A realistic modern scene of a Nepali family preserving old genealogy records digitally, without visible app branding or readable text.
Scene/backdrop: clean but lived-in Nepali home, low wooden table, old handwritten family notebook, brass diya, framed ancestors blurred.
Subject: a young adult photographing an old family record while an elder points to a family branch; another person arranges printed family photos.
Style/medium: candid documentary photography, warm realistic natural imperfections, not a stock photo.
Composition/framing: medium vertical shot around the table, old paper and phone camera central, space for final CTA overlay.
Lighting/mood: warm evening indoor light, practical and hopeful.
Constraints: no readable screen text, no visible brand logos, no watermark, no artificial studio look.
```

### Example 7: Horizontal Blog Cover

```text
Use case: photorealistic-natural
Asset type: horizontal 16:9 landscape blog cover for Bamsawali
Primary request: A Nepali multi-generation family quietly examines an old vansawali manuscript beside an ancestral hill shrine.
Scene/backdrop: terraced hills, stone village path, small shrine under old trees, mountain haze behind.
Subject: elder opening the manuscript, younger family members listening, brass puja vessels and marigold petals in the foreground.
Style/medium: photoreal documentary cover photo, realistic skin, cloth, architecture, and weather.
Composition/framing: wide cinematic composition, family on the right third, clean negative space on the left for blog title overlay.
Lighting/mood: warm dawn light, calm ancestral mood.
Color palette: stone grey, off-white cotton, muted red, brass gold, soft green hills, blue-grey mountains.
Constraints: no readable text, no logo, no watermark, no UI, no poster typography, no fantasy effects.
```

---

## 16. Image Generation Procedure

### Step 1: Create Output Folders

```powershell
New-Item -ItemType Directory -Force -Path '<pack-name>\images'
```

Examples:

```powershell
New-Item -ItemType Directory -Force -Path 'ghimire-image-pack\images'
New-Item -ItemType Directory -Force -Path 'drive-blog-cover-pack\images'
```

### Step 2: Write The Prompt Pack

Create a markdown prompt-pack file before or during generation.

It must include:

- Source task.
- Output folder.
- References used. If external files were not available, write: "Self-contained master prompt file only."
- Translation table.
- Context analysis.
- Shared prompt prefix.
- Beat plan.
- Every individual prompt.
- Reuse decisions.
- Final build summary.

### Step 3: Generate One Image Per New Prompt

For Codex built-in image generation:

- Send exactly one image prompt at a time.
- Keep the prompt complete.
- Do not assume the model remembers previous constraints unless the tool has conversation memory. Repeat critical constraints.
- After each generation, note the timestamp or filename.

### Step 4: Copy Generated Files Into Workspace

Generated files may appear in a hidden Codex-generated directory. Copy the selected final files into `<pack-name>\images`.

Use stable final names:

```powershell
Copy-Item -LiteralPath '<generated-source.png>' -Destination '<pack-name>\images\01-opening-hook.png' -Force
```

Do not delete original generated files unless the user asks.

### Step 5: Verify Dimensions

Use PowerShell:

```powershell
$outDir='<pack-name>\images'
Add-Type -AssemblyName System.Drawing
$files=Get-ChildItem $outDir -Filter '*.png' | Sort-Object Name
$bad=@()
foreach($f in $files){
  $img=[System.Drawing.Image]::FromFile($f.FullName)
  try {
    if($img.Width -le 0 -or $img.Height -le 0){
      $bad += [pscustomobject]@{Name=$f.Name; Width=$img.Width; Height=$img.Height}
    }
  } finally {
    $img.Dispose()
  }
}
[pscustomobject]@{PngCount=$files.Count; DimensionIssues=$bad.Count}
if($bad.Count -gt 0){ $bad | Format-Table -AutoSize }
```

For stricter checks:

Vertical reel:

```powershell
$outDir='<pack-name>\images'
Add-Type -AssemblyName System.Drawing
Get-ChildItem $outDir -Filter '*.png' | ForEach-Object {
  $img=[System.Drawing.Image]::FromFile($_.FullName)
  try {
    [pscustomobject]@{
      Name=$_.Name
      Width=$img.Width
      Height=$img.Height
      Ratio=[math]::Round($img.Width/$img.Height, 3)
    }
  } finally {
    $img.Dispose()
  }
} | Format-Table -AutoSize
```

Expected vertical ratio is about `0.562`.

Horizontal cover:

Expected horizontal ratio is about `1.778`.

### Step 6: Spot Check Visually

Open at least:

- First image.
- One ancient/rishi image.
- One migration image.
- One local naming image.
- One CTA image.
- Any image involving hands, rituals, water, fire, maps, or phones.

Reject and regenerate if:

- Text appears in the image.
- Hands are badly distorted.
- Faces are melted, cloned, or uncanny.
- Historical scene contains modern plastic, vehicles, power wires, sneakers, backpacks, or eyeglasses.
- Religious visuals look fantasy-magical instead of documentary.
- People or objects overlap title-safe space in a blog cover.
- Image is wrong aspect ratio.
- Culture/geography is clearly wrong.

---

## 17. Reroll Strategy

When an image fails, do not rewrite everything. Add one precise correction.

Examples:

Bad: model added readable script.

```text
Regenerate the same scene, but remove all readable writing. Manuscript marks may exist only as blurred decorative strokes. Absolutely no legible letters, no labels, no signs, no poster text.
```

Bad: scene looks too modern.

```text
Regenerate with period-authentic materials only: stone houses, handmade textiles, brass vessels, wooden tools, bare feet or simple sandals. No concrete roads, no power wires, no plastic, no sneakers, no wristwatches, no eyeglasses.
```

Bad: miracle looks like fantasy.

```text
Regenerate as a restrained documentary reenactment. The water/fire should appear natural and physically plausible, with witnesses reacting quietly. No glowing beams, no supernatural aura, no fantasy effects.
```

Bad: image looks like stock photo.

```text
Regenerate with more natural documentary imperfections: uneven cloth, weathered skin, rough stone, dust, aged brass, imperfect posture, candid expressions. Avoid studio lighting and commercial stock-photo polish.
```

---

## 18. Final Handoff Format

When the task is done, report:

```text
Done. Generated <N> images and saved them in:
<folder path>

Prompt pack:
<prompt pack path>

Verified:
- <N> PNG files
- Dimensions: <size or ratio>
- Spot-checked: <brief note>

Notes:
- <reuse summary or any known limitation>
```

Keep the final message short. The user can open the files directly.

---

## 19. Full Checklist For Interns

Before starting:

- [ ] Read the user script fully.
- [ ] If local files are available, optionally find related context with `rg --files` and `rg`.
- [ ] Read the embedded references in Sections 24-28 for style.
- [ ] Confirm output type: vertical video pack or horizontal blog covers.
- [ ] Create output folder.

Before generating:

- [ ] Translate Nepali line-by-line if needed.
- [ ] Write context analysis.
- [ ] Identify visual spine.
- [ ] Decide which frames can be reused.
- [ ] Create beat plan.
- [ ] Write shared prompt prefix.
- [ ] Write individual prompts.

During generation:

- [ ] Generate one image per prompt.
- [ ] Repeat critical constraints in each prompt.
- [ ] Copy every final PNG into workspace.
- [ ] Use stable numbered or slug-based filenames.
- [ ] Document every reuse.

After generation:

- [ ] Verify file count.
- [ ] Verify dimensions/aspect ratio.
- [ ] Spot-check images visually.
- [ ] Reroll failed images.
- [ ] Update prompt pack with final summary.
- [ ] Report final paths to the user.

---

## 20. Never Do These

- Do not generate images without first understanding the script.
- Do not skip translation for Nepali scripts.
- Do not put readable Nepali, Sanskrit, Hindi, or English text inside the image unless the user explicitly asks.
- Do not use random stock-photo South Asian visuals that ignore Nepal-specific architecture and terrain.
- Do not make ancient scenes look like modern wedding photography.
- Do not use fantasy divine glow for rishis.
- Do not show Muslims, Mughals, kings, or any group as caricatured villains.
- Do not show graphic violence.
- Do not create exact likenesses of current living public figures.
- Do not leave project deliverables only in Codex's hidden generated-image folder.
- Do not overwrite existing user assets without permission unless the user asked for replacement.

---

## 21. Quick Copy-Paste Master Prompt For A New Surname Video Pack

Use this prompt to instruct an image-generating agent:

```text
You are generating a Bamsawali "Thar Yatra" image pack from a Nepali surname-history script.

First translate the script line by line into English. Then analyze the religious, cultural, gotra/kul, migration, geography, oral-naming, and modern-family context. Break the script into 30-35 visual beats, each covering roughly 4-5 words or one short idea from the script. For each beat, write a realistic image prompt and then generate one vertical 9:16 photoreal documentary still.

Visual style: Nepali / Himalayan genealogy documentary reenactment, realistic enough to feel like staged historical footage, natural human imperfections, authentic textures, no over-polished AI look. Use stone hill settlements, terraced fields, brass puja objects, red tika, janai where culturally appropriate, handmade paper manuscripts, cloth-wrapped family records, wool and cotton textiles, temple courtyards, mountain light, and lived-in domestic details.

Aspect ratio: vertical 9:16. Save all outputs as PNG files in `<topic>-image-pack/images`, with numbered hyphenated filenames. Also create `<topic>-image-pack/<topic>-image-prompts.md` containing translation, context analysis, beat plan, shared prompt prefix, individual prompts, reuse notes, and final build summary.

Constraints for every image: no readable text, no logo, no watermark, no UI overlay, no speech bubbles, no modern plastic or modern objects in historical scenes, no fantasy glow, no magic beams, no gore, no caricatured villains, no exact likenesses of living public figures, no distorted hands, no extra fingers, no over-smoothed skin, no modern wires/vehicles/sneakers/backpacks/wristwatches/eyeglasses in ancient scenes.

Use reuse only for generic Bamsawali scenes like opening manuscript, Thar Yatra manuscript, time-passing transition, family-sharing CTA, and digital preservation. Generate new images for specific rishis, gotras, places, migrations, rituals, miracles, ecological markers, local naming scenes, and culturally unique moments. Verify final count, dimensions, and visual quality before reporting completion.
```

---

## 22. Quick Copy-Paste Master Prompt For Blog Covers

Use this prompt to instruct an image-generating agent:

```text
You are generating Bamsawali blog cover images from a folder of markdown scripts/articles.

List all scripts. For each script, identify its core topic, culture, surname/kul/gotra context, geography, and visual theme. Generate one horizontal 16:9 landscape blog cover PNG per script. If English and Nepali files are the same article, use one shared visual concept and save a copy under each script's filename.

Visual style: photoreal Nepali documentary cover photo, realistic skin, cloth, architecture, objects, and weather. Themes should include cultural heritage, surname history, oral history, vansawali, gotra, kul, migration, ancestral memory, family identity, and regional geography. Leave calm negative space for a blog title overlay. The cover must feel like an editorial documentary photograph, not a poster, not an illustration, not a generic stock photo.

Aspect ratio: horizontal 16:9. Save all outputs as PNG files in `<source>-blog-cover-pack/images`, using each markdown slug as the image filename. Also create `<source>-blog-cover-pack/blog-cover-prompts.md` containing source list, mapping table, visual concepts, prompts, reuse notes, and verification summary.

Constraints for every image: no readable text, no logo, no watermark, no UI, no poster typography, no fantasy effects, no modern objects if the scene is historical, no distorted hands, no exact likenesses of living public figures.

Verify final count, dimensions, and title-safe composition before reporting completion.
```

---

## 23. Quality Bar

The image is acceptable only if it feels like:

- A real Nepali family-history documentary still.
- A respectful historical reenactment.
- A travel/editorial photograph of a lineage place.
- A tactile cultural memory made from people, landscape, manuscripts, and ritual objects.

The image is not acceptable if it feels like:

- Generic AI fantasy art.
- A tourist stock photo with costumes.
- A wedding photoshoot.
- A glossy devotional poster.
- A random ancient-India scene with no Nepali specificity.
- A collage with readable fake text.

When in doubt, make the image quieter, more documentary, more tactile, and more specific to the script.

---

## 24. Embedded Image Generation Operating Reference

This section replaces any need to read an external image-generation skill file.

### Default Mode

Use the normal built-in image generation capability of the agent. For Codex, this is the built-in `image_gen` tool. For Claude, ChatGPT, or another agent, use that agent's image generation tool or connected image model.

Do not switch to CLI/API mode unless the user explicitly asks for it. Ordinary Bamsawali work does not require model-specific CLI controls.

### Multi-Image Rule

For many different scenes, generate one image per prompt. Do not put 30 different requested images into one image prompt. Each image needs its own prompt because each has distinct subject, geography, props, camera framing, and constraints.

### Saving Rule

Generated images often land in a default hidden generated-image folder. The intern must copy selected final images into the requested project output folder.

Example:

```powershell
Copy-Item -LiteralPath '<generated-source.png>' -Destination '<pack-name>\images\01-opening-hook.png' -Force
```

Never finish while final project images exist only in the agent's default generated-image directory.

### Iteration Rule

If an output fails, reroll with one precise correction. Do not rewrite the whole visual system. Preserve what worked and only correct what failed.

Common corrections:

- Remove readable writing.
- Remove modern objects.
- Make clothing period-authentic.
- Make the ritual less fantasy-like.
- Improve hands and faces.
- Add more Nepali/Himalayan geography.
- Add title-safe negative space for blog covers.

### Validation Rule

The intern must visually inspect outputs. A file count alone is not enough.

Reject images with:

- Fake readable text.
- Deformed hands.
- Melted faces.
- Cloned faces.
- Modern objects in medieval scenes.
- Generic Indian palace/costume imagery when the script is about Nepali hill context.
- Fantasy glow around rishis or ritual fire.
- Poster-like typography.
- Logos or watermarks.

### Taxonomy Slugs To Use In Prompts

Use these terms at the beginning of prompts when helpful:

- `historical-scene`: for ancient, medieval, migration, court, ashram, kingdom, or ritual reenactment.
- `photorealistic-natural`: for modern family, blog cover, documentary lifestyle, or editorial cover images.
- `infographic-diagram`: only when the user explicitly asks for diagrams.
- `background-extraction`: only for transparent cutouts, normally not needed for Bamsawali.

For Bamsawali, the two main slugs are `historical-scene` and `photorealistic-natural`.

---

## 25. Embedded Prompting Reference

This section replaces any need to read external prompting-reference files.

### Prompt Structure

Write prompts in this order:

1. Asset type and aspect ratio.
2. Scene/backdrop.
3. Main subject and action.
4. Cultural/historical details.
5. Camera and composition.
6. Lighting and mood.
7. Texture and color.
8. Constraints and avoid list.

Best format:

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: ...
Scene/backdrop: ...
Subject: ...
Style/medium: ...
Composition/framing: ...
Lighting/mood: ...
Materials/textures: ...
Constraints: ...
Avoid: ...
```

For image models that prefer prose, convert the same information into one vivid paragraph followed by a constraints sentence.

### Specificity Rule

If the script is specific, preserve its specificity. Do not invent unrelated details.

If the script is generic, add only helpful visual detail:

- realistic place type,
- period-appropriate clothing,
- ritual objects,
- camera framing,
- title-safe space,
- mood and lighting.

Do not invent:

- extra historical claims,
- exact dates not in the script,
- extra characters with names,
- new villains,
- slogans,
- logos,
- caste or ethnic markers that the script does not support.

### Composition Rules

For people:

- Describe what they are doing with hands.
- Describe gaze direction if important.
- Keep poses natural.
- Avoid huge crowd scenes unless the script requires them.

For historical scenes:

- Place tactile objects in the foreground.
- Put human action in the midground.
- Use landscape or architecture in the background.

For blog covers:

- Put main action off-center.
- Leave negative space for title overlay.
- Avoid busy detail in the title-safe zone.

### Text Rules

Default: no readable text.

If the scene needs a manuscript, ask for:

```text
old ink marks that are decorative and unreadable
```

If the scene needs a map, ask for:

```text
handmade map-like paper with no labels and no readable place names
```

If the scene needs a phone or laptop:

```text
screen dark, blurred, or unreadable; no app branding; no visible logo
```

### Cultural Accuracy Rules

Do not treat "South Asian" as enough. Bamsawali visuals need Nepali specificity:

- terraced hills,
- stone and mud hill houses,
- slate roofs,
- carved wooden pillars,
- brass and copper ritual objects,
- handmade paper,
- wool shawls,
- dhaka topi where historically appropriate,
- mountain light,
- dry western Nepal terrain or green mid-hill terrain depending on region.

### Historical Accuracy Rules

For ancient/medieval scenes:

- no concrete roads,
- no power lines,
- no plastic,
- no modern backpacks,
- no zippers,
- no sneakers,
- no printed T-shirts,
- no wristwatches,
- no sunglasses,
- no eyeglasses,
- no modern steel bridges,
- no motorcycles or cars.

### Religious Sensitivity Rules

Rishis and rituals should look respectful and grounded.

Use:

- sacred fire,
- simple ashram,
- disciples,
- manuscripts,
- brass kalash,
- kusa grass,
- riverbank,
- forest hermitage.

Avoid:

- divine laser beams,
- superhero poses,
- excessive glowing aura,
- fantasy costumes,
- caricatured priests,
- sensational blood or violence.

---

## 26. Embedded Reusable Bamsawali Prompt Library

Use these prompts directly when a new script contains a matching generic beat. Replace the gotra, surname, region, or object details as needed.

### 26.1 Generic Opening Hook: Manuscript And Hands

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A close documentary-style image of elderly Nepali hands opening an old family genealogy manuscript on a low wooden table inside a traditional hill home.
Scene/backdrop: mud-plastered room with stone wall texture, a small brass oil lamp, folded Nepali textiles, and faint family-photo shapes blurred in the background.
Subject: wrinkled hands, handmade paper, old ink marks that are decorative and unreadable, a subtle red thread running beside the manuscript to symbolize lineage.
Style/medium: photoreal documentary reenactment, natural imperfections, authentic textures.
Composition/framing: close-up, hands and manuscript dominant, shallow depth of field, vertical frame with room for later text overlay.
Lighting/mood: warm oil-lamp and late afternoon window light, intimate and ancestral.
Constraints: no readable text, no logo, no watermark, no modern plastic, no fantasy effects, no distorted hands.
```

### 26.2 Generic Thar Yatra Manuscript

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic opening still for a surname-history journey
Primary request: A low wooden table holding an old manuscript, brass diya, red thread, handmade paper, and a cloth-wrapped family record.
Scene/backdrop: traditional Nepali hill home interior with a blurred Himalayan foot trail visible through an open window.
Subject: manuscript and ritual objects arranged naturally, as if a family is about to begin tracing its surname journey.
Style/medium: photoreal documentary still, tactile paper and brass textures.
Composition/framing: close-medium vertical frame, table in lower half, clean upper space for later overlay text.
Lighting/mood: warm dawn light and soft diya glow, quiet anticipation.
Constraints: no readable text, no logo, no watermark, no modern objects, no plastic.
```

### 26.3 Ancient Rishi Root

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali Hindu genealogy short video
Primary request: A realistic ancient Himalayan ashram scene showing a revered elderly rishi teaching a small group of disciples.
Scene/backdrop: forest-edge hermitage in the foothills, stone platform, sacred fire, palm-leaf manuscripts, distant snow peaks.
Subject: sage figure seated calmly with disciples listening, simple saffron and off-white robes, janai visible where natural.
Style/medium: photoreal historical reenactment, respectful Hindu spiritual tone, no fantasy.
Composition/framing: medium-wide vertical shot, rishi slightly off-center, disciples and manuscripts forming a natural triangle.
Lighting/mood: dawn light, smoke from small yajna fire, quiet and scholarly.
Constraints: no divine glow, no supernatural effects, no readable text, no logo, no watermark, no eyeglasses.
```

### 26.4 Gotra Adoption

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: Disciples and family elders formally adopting a gotra tradition beside a sacred fire.
Scene/backdrop: ancient ashram courtyard with handmade manuscripts, brass vessels, kusa grass, and simple stone architecture.
Subject: elder scholar guiding younger disciples and family members; a red thread links manuscript, ritual tray, and younger generation.
Style/medium: photoreal documentary reenactment, grounded and culturally respectful.
Composition/framing: vertical frame, manuscript and brass lamp in foreground, elders and disciples layered behind.
Lighting/mood: warm natural temple-courtyard light, reverent and calm.
Constraints: no readable text, no logo, no watermark, no fantasy glow, no modern objects.
```

### 26.5 Time Passing Through Lineage

```text
Use case: historical-scene
Asset type: vertical 9:16 symbolic transition still for a Nepali genealogy short video
Primary request: A realistic symbolic image of time passing across generations of a lineage.
Scene/backdrop: old wooden room transitioning visually into a mountain trail through a doorway, with stacked manuscripts, a brass lamp nearly burned down, and dawn outside.
Subject: one elder hand placing a manuscript bundle into a travel cloth, suggesting family memory being carried forward.
Style/medium: photoreal documentary reenactment, subtle and grounded.
Composition/framing: vertical frame, interior foreground and open door to mountain trail in background.
Lighting/mood: pre-dawn blue outside, warm lamp inside, reflective and ancestral.
Constraints: no readable text, no logo, no watermark, no modern objects, no fantasy effects.
```

### 26.6 Peaceful Ancestral Settlement

```text
Use case: historical-scene
Asset type: vertical 9:16 establishing still for a Nepali genealogy short video
Primary request: A premodern Himalayan hill settlement where a lineage lives before migration or expansion.
Scene/backdrop: terraced fields, stone houses with slate roofs, a small family shrine, steep mountain paths, forested ridges.
Subject: family elders and children near a courtyard, carrying prayer items and manuscripts, living peacefully.
Style/medium: photoreal historical reenactment, natural landscape realism.
Composition/framing: wide vertical establishing shot, settlement rising diagonally through the frame.
Lighting/mood: clear mountain morning, dignified and rooted.
Constraints: no modern roads, wires, vehicles, plastic, readable text, logo, or watermark.
```

### 26.7 Migration Under Pressure

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A realistic medieval Himalayan migration scene showing families leaving an ancestral hill village with sacred and household items.
Scene/backdrop: narrow mountain trail above terraced fields, stone homes fading behind, distant smoke on the horizon without showing any enemy.
Subject: elders, parents, children, and pack animals carrying wrapped manuscripts, brass vessels, blankets, and grain sacks.
Style/medium: photoreal documentary reenactment, emotionally restrained, historically grounded.
Composition/framing: vertical leading-line trail, family moving from lower foreground toward a high mountain pass.
Lighting/mood: overcast dawn, quiet sorrow and determination.
Constraints: no gore, no visible attacking group, no religious stereotypes, no modern objects, no readable text, no logo, no watermark.
```

### 26.8 Kingdom Or Court Arrival

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: Migrant scholars or families arrive at a medieval western Nepal hill court.
Scene/backdrop: stone palace courtyard, carved wooden doorway, wool rugs, brass ritual objects, rugged mountain light.
Subject: learned travelers presenting wrapped manuscripts and puja bundles respectfully to local king, officials, or elders.
Style/medium: photoreal historical reenactment, formal but grounded.
Composition/framing: vertical mid-wide shot, receiving court on one side and travelers on the other.
Lighting/mood: warm afternoon light, cautious acceptance and dignity.
Constraints: no readable text, no logo, no watermark, no modern objects, no fantasy palace, no eyeglasses.
```

### 26.9 Royal Ritual / Vratabandha Preparation

```text
Use case: historical-scene
Asset type: vertical 9:16 ritual still for a Nepali genealogy short video
Primary request: A realistic royal or family vratabandha preparation in a medieval courtyard.
Scene/backdrop: stone courtyard, carved wooden pillars, wool rugs, brass kalash, kusa grass, rice, flower petals, sacred thread.
Subject: young initiate seated near ritual tray, priests and elders preparing the ceremony with focused, natural gestures.
Style/medium: photoreal historical reenactment, respectful Hindu ritual realism.
Composition/framing: medium vertical shot, ritual tray and hands in foreground, initiate and elders behind.
Lighting/mood: warm ceremonial light, solemn and calm.
Constraints: no readable text, no logo, no watermark, no modern objects, no plastic, no theatrical costume.
```

### 26.10 Sacred Water Or Fire Moment

```text
Use case: historical-scene
Asset type: vertical 9:16 restrained sacred-court still for a Nepali genealogy short video
Primary request: A sacred ritual moment involving natural water or fire, shown as believable documentary reenactment rather than fantasy.
Scene/backdrop: stone court or ritual courtyard with brass vessels, kusa grass, wool rugs, and mountain light.
Subject: learned priest or ancestor kneeling calmly near the ritual space while witnesses watch with quiet awe; water emerges naturally from earth or a contained sacred flame burns in a yajna hearth.
Style/medium: photoreal historical reenactment, grounded and reverent.
Composition/framing: vertical medium shot, water/fire and brass vessels in foreground, witnesses in midground.
Lighting/mood: warm ritual light, restrained wonder.
Constraints: no glowing beams, no magical aura, no fantasy sorcery, no readable text, no logo, no watermark, no modern matches or lighters.
```

### 26.11 Local Oral Naming Moment

```text
Use case: historical-scene
Asset type: vertical 9:16 cinematic still for a Nepali genealogy short video
Primary request: A realistic village path scene where local people identify a newly settled family by the place, hill, forest, or event they are associated with.
Scene/backdrop: stone lane with grain baskets, handmade pottery, wool blankets, terraced fields and dry hills behind.
Subject: local villagers warmly greeting the family; one elder gestures toward the ridge or settlement while the family stands with manuscript bundle and household items.
Style/medium: photoreal documentary reenactment, human and natural.
Composition/framing: medium-wide vertical shot, market items foreground, faces and gestures central.
Lighting/mood: warm late afternoon, neighborly and everyday.
Constraints: no readable text, no speech bubbles, no logo, no watermark, no modern objects.
```

### 26.12 Name Evolves Across Generations

```text
Use case: historical-scene
Asset type: vertical 9:16 symbolic still for a Nepali genealogy short video
Primary request: A realistic generational storytelling scene symbolizing a spoken place-name or title becoming a family surname over time, without showing written words.
Scene/backdrop: traditional hill home interior with old manuscript, red thread, brass oil lamp, and younger family members listening.
Subject: an elderly villager speaking to a younger adult while a child listens, with the family's wrapped manuscript between them.
Style/medium: photoreal documentary reenactment, no fantasy, no literal typography.
Composition/framing: medium vertical shot, elder's speaking gesture and listener's attentive face central, manuscript foreground.
Lighting/mood: warm evening lamp light, intimate oral-history feeling.
Constraints: no readable text, no speech bubbles, no logo, no watermark, no modern objects.
```

### 26.13 Nepal-Wide Spread

```text
Use case: historical-scene
Asset type: vertical 9:16 symbolic genealogy still for a Nepali surname-history video
Primary request: A tactile handmade representation of a lineage spreading across Nepal without readable labels.
Scene/backdrop: low wooden table with handmade Nepal-shaped map-like paper, old manuscript, family photos blurred, cloth pouches of soil, brass diya.
Subject: family hands placing small stones, red thread, or brass pins from the origin region toward several parts of Nepal.
Style/medium: photoreal documentary still, not a digital graphic.
Composition/framing: top-down or oblique vertical composition, map and hands central.
Lighting/mood: warm indoor light, reflective and historical.
Constraints: no readable labels, no digital UI, no arrows with text, no logo, no watermark.
```

### 26.14 Modern Family Sharing CTA

```text
Use case: photorealistic-natural
Asset type: vertical 9:16 closing still for a Nepali genealogy short video
Primary request: A candid modern Nepali family scene where a young adult shares a surname-history video or genealogy note on a phone with a friend or relative while elders sit nearby.
Scene/backdrop: warm living room with brass puja shelf, old family notebook, framed family photo blurred, low wooden table.
Subject: natural multi-generation family interaction around a phone; phone screen dark or blurred and unreadable.
Style/medium: candid documentary photography, realistic skin and hands, not a staged influencer pose.
Composition/framing: medium vertical shot, phone and family notebook central, space for later CTA overlay.
Lighting/mood: warm indoor window light, familiar and conversational.
Constraints: no visible phone text, no app branding, no logo, no watermark, no distorted hands.
```

### 26.15 Digital Bamsawali Preservation

```text
Use case: photorealistic-natural
Asset type: vertical 9:16 closing still for a Nepali genealogy short video
Primary request: A realistic modern scene of a Nepali family preserving old genealogy records digitally, without visible app branding or readable text.
Scene/backdrop: clean but lived-in Nepali home, low wooden table, old handwritten family notebook, brass diya, framed ancestors blurred, smartphone and laptop used naturally.
Subject: young adult photographing an old family record while an elder points to a family branch; another person arranges printed family photos.
Style/medium: candid documentary photography, warm realistic natural imperfections, not a stock photo.
Composition/framing: medium vertical shot around the table, old paper and phone camera central, space for final CTA overlay.
Lighting/mood: warm evening indoor light, practical and hopeful.
Constraints: no readable screen text, no visible brand logos, no watermark, no artificial studio look, no plastic clutter.
```

### 26.16 Generic Horizontal Blog Cover

```text
Use case: photorealistic-natural
Asset type: horizontal 16:9 landscape blog cover for Bamsawali
Primary request: A Nepali multi-generation family quietly examines an old vansawali manuscript beside an ancestral hill shrine.
Scene/backdrop: terraced hills, stone village path, small shrine under old trees, mountain haze behind.
Subject: elder opening the manuscript, younger family members listening, brass puja vessels and marigold petals in the foreground.
Style/medium: photoreal documentary cover photo, realistic skin, cloth, architecture, and weather.
Composition/framing: wide cinematic composition, family on the right third, clean negative space on the left for blog title overlay.
Lighting/mood: warm dawn light, calm ancestral mood.
Color palette: stone grey, off-white cotton, muted red, brass gold, soft green hills, blue-grey mountains.
Constraints: no readable text, no logo, no watermark, no UI, no poster typography, no fantasy effects.
```

---

## 27. Embedded Prior Bamsawali Pack References

These are the prior reference patterns used to create the master file. They are included here so the intern does not need the original `poudel-image-pack`, `neupane-image-pack`, `kafle-image-pack`, or blog-cover files.

### 27.1 Paudel / Paudyal / Paudal Reference Arc

Core context:

- Surname forms: Paudel, Paudyal, Paudal.
- Sacred root: Atri Rishi and Atreya lineage.
- Historical geography: Paudi in Tehri Garhwal, Doti/Ajayameru, Jumla, Bajhang Paudi, Kalikot Chilkhaya, Dailekh, Pokhara, Kathmandu.
- Narrative turn: migration under insecurity, Udaya Bhatta descendants, Vansharaj Bhatta in Doti/Jumla power history.
- Naming: people from Paudi called "Paudiwala"; oral change becomes Paudel/Paudyal.
- Closing: spread across Nepal, notable lineage memory, family sharing.

Recommended Paudel 35-beat pack:

| # | Filename idea | Visual beat |
| --- | --- | --- |
| 01 | `01-opening-hook.png` | Old genealogy manuscript close-up for Paudel hook. |
| 02 | `02-atri-rishi-root.png` | Atri-like rishi teaching disciples in Himalayan ashram. |
| 03 | `03-atreya-lineage-recorded.png` | Atreya lineage recorded beside sacred fire. |
| 04 | `04-paudi-tehri-garhwal.png` | Peaceful Paudi hill settlement in Tehri Garhwal. |
| 05 | `05-forced-migration.png` | Families leaving ancestral home under distant insecurity. |
| 06 | `06-ajayameru-doti-arrival.png` | Migrants enter Doti/Ajayameru stone gateway. |
| 07 | `07-vansharaj-doti-army.png` | Young Vansharaj accepted into Doti military court. |
| 08 | `08-jumla-campaign.png` | Non-graphic mountain campaign toward Jumla. |
| 09 | `09-bajhang-paudi-capital.png` | Paudi of Bajhang as western hill royal settlement. |
| 10 | `10-paudiwala-to-paudel.png` | Oral naming scene: locals identify family from Paudi. |
| 11 | `11-spread-across-nepal.png` | Handmade Nepal map with red threads spreading. |
| 12 | `12-legacy-to-nepal.png` | Symbolic legacy scene with books, state papers, manuscripts, no exact living likeness. |
| 13 | `13-family-sharing-cta.png` | Modern family sharing surname video. |
| 14 | `14-thar-yatra-opening.png` | Generic Thar Yatra manuscript table. |
| 15 | `15-saptarishi-sky-memory.png` | Realistic night ashram sky, seven stars as subtle memory, no fantasy. |
| 16 | `16-atri-dharmashastra.png` | Atri-like elder writing or teaching dharma manuscript. |
| 17 | `17-atreya-tripravar-memory.png` | Three stones, red thread, manuscript, ritual triangle. |
| 18 | `18-time-passing-lineage.png` | Manuscript wrapped for journey through generations. |
| 19 | `19-paudi-family-shrine.png` | Domestic shrine in Paudi hill home. |
| 20 | `20-growing-insecurity.png` | Family watches distant smoke, gathers sacred items. |
| 21 | `21-atreya-families-disperse.png` | Mountain crossroads, related families parting. |
| 22 | `22-udaya-bhatta-descendants.png` | Dignified migrating Brahmin family line. |
| 23 | `23-doti-royal-shelter.png` | Doti court receiving learned migrant family. |
| 24 | `24-vansharaj-birth-naming.png` | Newborn naming-sanskar scene. |
| 25 | `25-elder-council-advice.png` | Elders advise young Vansharaj over handmade map. |
| 26 | `26-vansharaj-coronation.png` | Restrained western Nepal hill coronation. |
| 27 | `27-descendants-grow-paudi.png` | Children learning in Paudi palace-village courtyard. |
| 28 | `28-kingdom-division-map.png` | Elders divide routes/settlements over terrain map. |
| 29 | `29-four-directions-dispersal.png` | Family groups move toward Jumla, Dailekh, Kalikot. |
| 30 | `30-shriram-settles-chilkhaya.png` | Shriram's family begins life in Chilkhaya. |
| 31 | `31-chilkhaya-village-market.png` | Locals greet newly settled family at village market. |
| 32 | `32-name-evolves-generations.png` | Spoken Paudi identity becomes surname across generations. |
| 33 | `33-dailekh-migration.png` | Family migration toward Dailekh via mountain stream crossing. |
| 34 | `34-pokhara-migration.png` | Migration stop near Pokhara valley, no modern city. |
| 35 | `35-digital-bamsawali-preservation.png` | Modern digitization of old family records. |

Paudel-specific prompt insert:

```text
Culture and setting: Nepali / western Himalayan Hindu lineage context, Atreya gotra memory, Paudi of Tehri Garhwal and Bajhang, Doti-Ajayameru court, Jumla/Kalikot migration, stone hill settlements, terraced fields, brass puja objects, red tika, janai, handmade manuscripts.
```

### 27.2 Neupane / Nyaupane Reference Arc

Core context:

- Surname: Neupane / Nyaupane.
- Sacred root: Kaudinya Rishi, Kaudinya gotra.
- Wider memory: Asia-wide Kaudinya tradition, Angkor Wat reference, Lumbini/Mahasthavir Kaudinya memory.
- Migration: Kanyakubja to Darchula route into Nepal.
- Defining event: two Kaudinya Bhatta brothers, Satchidananda and Sadananda, reach Jumla court during prince's vratabandha.
- Ritual challenge: purity of water and fire.
- Sacred episode: Sadananda brings water through Varuna mantra; Satchidananda lights sacred fire through Agni mantra.
- Naming: Sadananda receives "Navpaniya" title, changing orally to Neupane/Nyaupane.
- Origin settlement: Dhulagoh of Jumla.

Recommended Neupane 35-beat pack:

| # | Filename idea | Visual beat |
| --- | --- | --- |
| 01 | `01-neupane-opening-hook.png` | Old manuscript close-up for Neupane hook. |
| 02 | `02-nepal-only-surname.png` | Handmade Nepal-only symbolic map, no labels. |
| 03 | `03-ancient-migration-context.png` | Ancient migration across South Asian/Himalayan route. |
| 04 | `04-thar-yatra-manuscript.png` | Generic Thar Yatra manuscript. |
| 05 | `05-kaudinya-rishi-root.png` | Kaudinya-like rishi teaching disciples. |
| 06 | `06-kaudinya-gotra-adopted.png` | Disciples adopting Kaudinya gotra. |
| 07 | `07-ancient-asia-spread.png` | Handmade Asia map-like spread, no labels. |
| 08 | `08-angkor-wat-inscription.png` | Angkor-like stone corridor, unreadable inscription texture. |
| 09 | `09-lumbini-kaudinya-memory.png` | Ancient Lumbini monk memory, respectful Buddhist tone. |
| 10 | `10-time-passing-history.png` | Manuscripts and doorway to mountain path. |
| 11 | `11-kanyakubja-scholar-home.png` | Scholar household in medieval Kanyakubja preparing to leave. |
| 12 | `12-protecting-dharma-migration.png` | Migration to protect dharma, no attackers shown. |
| 13 | `13-two-bhatta-brothers.png` | Satchidananda and Sadananda walking with manuscripts. |
| 14 | `14-darchula-route-entry.png` | Darchula-like steep river gorge crossing. |
| 15 | `15-nepali-land-arrival.png` | Migrant scholars touch Nepali soil respectfully. |
| 16 | `16-jumla-royal-court.png` | Two brothers arrive at Jumla court. |
| 17 | `17-prince-vratabandha-prep.png` | Crown prince's vratabandha preparation. |
| 18 | `18-arani-fire-preparation.png` | Brahmins rubbing arani sticks for ritual fire. |
| 19 | `19-purity-question.png` | Brothers respectfully question ritual purity. |
| 20 | `20-king-asks-solution.png` | King asks how pure water and fire should be produced. |
| 21 | `21-sadananda-varun-water.png` | Sadananda recites Varuna mantra before water emerges. |
| 22 | `22-sacred-water-spring.png` | Clean water spring emerges naturally in courtyard. |
| 23 | `23-satchidananda-agni-fire.png` | Satchidananda lights sacred yajna fire, natural flame. |
| 24 | `24-king-amazed.png` | King and courtiers amazed and pleased. |
| 25 | `25-satchidananda-acharya.png` | King honors Satchidananda as acharya. |
| 26 | `26-acharya-lineage-begins.png` | Satchidananda teaches descendants, Acharya branch begins. |
| 27 | `27-sadananda-navpaniya-title.png` | King honors Sadananda with water-vessel symbolism. |
| 28 | `28-birta-grant-dhaulagoh.png` | Land grant / settlement near Dhulagoh. |
| 29 | `29-name-evolves-orally.png` | Navpaniya title changes through speech across generations. |
| 30 | `30-neupane-name-birth.png` | Water vessel, red thread, manuscript, younger hands. |
| 31 | `31-sadananda-adipurush.png` | Sadananda as dignified original ancestor near spring. |
| 32 | `32-dhaulagoh-origin-settlement.png` | Dhulagoh-like Jumla settlement. |
| 33 | `33-nepal-wide-spread.png` | Nepal map with threads from Jumla to Gulmi, Kathmandu, beyond, no labels. |
| 34 | `34-family-sharing-cta.png` | Modern sharing with Neupane friend/family. |
| 35 | `35-digital-bamsawali-preservation.png` | Digital preservation closing frame. |

Neupane-specific prompt insert:

```text
Culture and setting: Nepali / western Himalayan Hindu lineage context, Kaudinya gotra memory, Kanyakubja migration, Darchula route, Jumla royal court, sacred water and fire ritual, Dhulagoh origin, stone hill settlements, brass lota, red tika, janai, handmade manuscripts.
```

Neupane sacred water correction if model gets too magical:

```text
Make the water physically plausible, like a clear spring emerging from a small stone opening in the ground. No glowing blue light, no levitation, no fantasy beams.
```

### 27.3 Kafle Reference Arc

Core context:

- Surname: Kafle.
- Ecological root: Kafal fruit, red clustered hill berry, Kafal-covered hill.
- Sacred root: Marichi Rishi lineage and Shandilya Rishi / Shandilya gotra.
- Scriptural-cultural memory: Shandilya associated with Krishna and Balaram vratabandha; Asit and Deval lineage memory.
- Migration: Kannauj upheaval, Mahakali crossing, arrival in Sinja kingdom.
- Settlement: Bajhang Kafal forests, khoriya clearing, crops, homestead.
- Naming: "people from Kafal hill" becomes Kafle.
- Living memory: Kafalseri, Shandil Kot, Shandeli Triveni.
- Spread: Bajhang to Jumla, Dailekh, Kathmandu, eastward to Ilam/Jhapa.
- Branch hook: Saji or Basi Kafle.

Recommended Kafle 35-beat pack:

| # | Filename idea | Visual beat |
| --- | --- | --- |
| 01 | `01-kafle-opening-hook.png` | Generic surname manuscript hook. |
| 02 | `02-kafal-fruit-closeup.png` | Macro of ripe Kafal berries in dense red clusters. |
| 03 | `03-kafal-hill-daada.png` | Kafal-covered Nepali hill ridge. |
| 04 | `04-brahmin-family-kafal-hill.png` | Brahmin family settles on Kafal-covered hillside. |
| 05 | `05-thar-yatra-manuscript.png` | Generic Thar Yatra manuscript. |
| 06 | `06-marichi-rishi-root.png` | Marichi-like rishi root in ancient ashram. |
| 07 | `07-shandilya-rishi-ashram.png` | Shandilya rishi teaching disciples. |
| 08 | `08-krishna-balaram-vratabandha.png` | Respectful ancient sacred-thread ceremony for two royal boys, no deity fantasy. |
| 09 | `09-asit-deval-lineage.png` | Asit and Deval lineage memory by riverbank ashram. |
| 10 | `10-time-passing-history.png` | Time-passing manuscript transition. |
| 11 | `11-shandilya-gotra-adoption.png` | Shandilya disciples adopt gotra tradition. |
| 12 | `12-kannauj-preserving-teachings.png` | Kannauj scholarly household copying manuscripts. |
| 13 | `13-kannauj-upheaval-bs1250.png` | Families leave Kannauj under unrest, no battle. |
| 14 | `14-mahakali-crossing.png` | Migrants cross Mahakali river with manuscripts. |
| 15 | `15-sinja-kingdom-arrival.png` | Arrival at medieval Sinja hill kingdom. |
| 16 | `16-sinja-royal-shelter.png` | Sinja officials receive learned Brahmins. |
| 17 | `17-bajhang-kafal-forest.png` | Bajhang Kafal forest cliffs and slopes. |
| 18 | `18-khoriya-clearing.png` | Ancestors clear khoriya land on Kafal slope. |
| 19 | `19-crops-and-settlement.png` | First crops planted, small hill field. |
| 20 | `20-homestead-among-kafal.png` | New homestead among Kafal trees. |
| 21 | `21-locals-ask-origin.png` | Local villagers ask where family came from. |
| 22 | `22-kafal-daada-oral-name.png` | Elders under Kafal tree gesture toward ridge. |
| 23 | `23-name-evolves-kafle.png` | Generations near Kafal tree, surname identity forms. |
| 24 | `24-kafalseri-memory.png` | Remote Bajhang hamlet beside Kafal groves. |
| 25 | `25-shandil-kot-memory.png` | Ancient hill fort ruin, Shandil Kot memory. |
| 26 | `26-shandeli-triveni.png` | Three streams meeting, ritual offering, Kafal branches. |
| 27 | `27-bajhang-to-jumla-spread.png` | Kafle family migration from Bajhang toward Jumla. |
| 28 | `28-dailekh-kathmandu-eastward.png` | Generational movement through Dailekh/Kathmandu eastward. |
| 29 | `29-nepal-wide-kafle-spread.png` | Terrain-like Nepal spread, no graphic labels. |
| 30 | `30-ilam-jhapa-eastern-kafles.png` | Present-day eastern Nepal family memory in Ilam/Jhapa context. |
| 31 | `31-old-kafle-bamsawali-records.png` | Old Kafle family records with Kafal berries as symbol. |
| 32 | `32-saji-basi-kafle-branches.png` | Saji/Basi branch question shown respectfully, no conflict. |
| 33 | `33-kafle-friend-sharing-cta.png` | Modern friend-sharing CTA. |
| 34 | `34-comment-next-thar.png` | Family asks which surname journey next, no readable phone text. |
| 35 | `35-digital-bamsawali-preservation.png` | Digital preservation closing frame. |

Kafle-specific prompt insert:

```text
Culture and setting: Nepali / western Himalayan Hindu lineage context, Shandilya gotra memory, Kafal fruit and Kafal-covered Bajhang hills, khoriya clearing, Sinja kingdom, Mahakali crossing, stone hill settlements, terraced fields, brass puja objects, red tika, janai, handmade manuscripts, wool and cotton textiles, mountain light.
```

Kafal fruit correction if model gets wrong fruit:

```text
The fruit must be small uneven red Kafal berries growing in dense clusters on hill branches, not apples, cherries, coffee berries, or glossy plastic fruit.
```

---

## 28. Embedded Blog Cover Reference Library

Use these for Bamsawali blog articles. Each prompt is horizontal `16:9`, text-free, title-safe, and photoreal.

### 28.1 Kul Devata Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Nepali family-history article about Kul Devata. A multi-generation Nepali family stands quietly beside an ancestral hill shrine at dawn, with an elder opening an old handwritten family genealogy notebook on a low stone ledge. Brass puja vessels, marigold petals, a small oil lamp, and a temple bell sit in the foreground. Behind them are terraced hills, a narrow village path, and a small stone shrine shaded by old trees. The image should feel like a real documentary photograph from rural Nepal, culturally respectful, Hindu family ritual context, warm but natural light, subtle depth of field, believable faces, realistic clothing, no staged fantasy look. Leave clean negative space on the left side for a blog title overlay. No readable text, no logo, no watermark.
```

### 28.2 Same Gotra Marriage Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Nepali cultural article about why same-gotra marriage is avoided. Two Nepali families sit respectfully in a traditional home courtyard during a marriage discussion; an elderly priest and senior family members look over a blank family tree chart and old vansawali manuscript on a low wooden table. A brass oil lamp, tika plate, and simple tea glasses are nearby. The mood is thoughtful and calm, not dramatic, not romantic. Visual theme: gotra as ancestral lineage, family branches, ritual caution, inherited memory. Realistic Nepali home, natural window light, documentary realism, detailed but not cluttered, leave clean negative space for title overlay. No readable text, no logo, no watermark.
```

### 28.3 Tamang Heritage Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Tamang clan and kul history article. A Tamang hill village in the Himalayan mid-hills, stone houses, prayer flags, carved wooden windows, terraced fields, and distant snow peaks. A multi-generation Tamang family in realistic traditional clothing gathers near an elder holding an old lineage notebook, with Buddhist-Tamang cultural details such as prayer wheels and mani stones in the background. The scene should feel grounded, living, and modern-historical at once, not costume drama. Natural mountain light, photoreal documentary style, believable faces and fabric textures, wide cinematic composition, leave clean negative space for a title overlay. No readable text, no logo, no watermark.
```

### 28.4 Gurung Heritage Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Gurung kul history article. A Gurung village on a green ridge, stone houses with slate roofs, rhododendron trees, terraced fields, and an Annapurna-like mountain horizon under soft morning light. Gurung elders and younger family members in realistic traditional attire sit together outside a home, looking at an old family-history notebook and a small wooden chest of ancestral objects. The image should feel authentic to Nepali hill culture, calm, respectful, and editorial. Photorealistic documentary style, natural imperfections, realistic skin and textiles, wide composition with room for a blog title. No readable text, no logo, no watermark.
```

### 28.5 Magar Heritage Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Magar clan and kul history article. A Magar hill settlement with stone houses, terraced fields, forested slopes, and a community courtyard. A family group with elders in realistic Magar traditional clothing gathers around an old genealogy notebook and ancestral household objects; a madal drum and woven baskets appear subtly near the edge of the frame. The scene should suggest oral history, clan memory, and migration through Nepal's hills. Natural daylight, documentary realism, believable expressions, no theatrical poses, wide blog-cover composition with clean negative space for title overlay. No readable text, no logo, no watermark.
```

### 28.6 Dahal Surname History Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Nepali Brahmin surname-history article about Dahal lineage. An old hill village courtyard with terraced fields beyond, an elderly Brahmin scholar and family members opening a worn vansawali manuscript near a small brass lamp and ritual plate. The atmosphere hints at gotra, ancestral migration, and preserved family memory without showing literal text. White cotton clothing, shawls, tika, wooden beams, mud-plastered walls, and mountain light. Realistic Nepali documentary photograph, no fantasy, no palace, no modern city. Wide cinematic composition, calm negative space for title overlay. No readable text, no logo, no watermark.
```

### 28.7 Kafle Surname History Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Kafle surname-history article. A Bajhang-style hill slope with kafal berry trees in the foreground, small red kafal fruits clustered on branches, a stone village and terraced fields in the middle distance. A Brahmin family stands near a newly cut hillside farm plot, with an elder holding an old genealogy manuscript and ritual cloth, suggesting Shandilya gotra memory and settlement on a kafal-covered ridge. Natural Himalayan daylight, photoreal documentary realism, realistic Nepali faces and clothing, earthy colors, no fantasy. Wide composition with clean space for title overlay. No readable text, no logo, no watermark.
```

### 28.8 Neupane Surname History Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Neupane surname-history article. A Jumla mountain settlement with dry stone houses, terraced fields, and a ritual courtyard where a clear spring emerges from the earth beside a brass lota and puja plate. Two learned Brahmin brothers and family elders gather respectfully near an old manuscript, suggesting Kaudinya gotra, sacred water, and the origin of the name Navapaniya to Neupane. Realistic historical-cultural Nepali atmosphere, not mythological, with natural cold mountain light, believable fabric and architecture. Wide blog-cover composition with clean negative space for title overlay. No readable text, no logo, no watermark.
```

### 28.9 Paudel Surname History Blog Cover

```text
Horizontal 16:9 landscape blog cover photo for a Paudel surname-history article. A remote Paudi/Bajhang hill settlement on a ridge, stone houses, terraced valleys, and a winding migration path through the mountains. A Brahmin elder and younger family members examine an old vansawali manuscript beside a brass lamp, with subtle Hindu ritual objects and a sense of Atreya lineage memory. The mood is ancestral, realistic, and documentary, as if photographed during a family-history journey in western Nepal. Natural light, believable clothing, no fantasy battle scene, wide cinematic composition, clean negative space for blog title overlay. No readable text, no logo, no watermark.
```

---

## 29. Self-Contained Delegation Instruction

When handing this file to an intern or another AI agent, give this instruction:

```text
Use `master_prompt_image_generation_file.md` as the only required reference. Do not ask for older Paudel, Neupane, Kafle, blog-cover, imagegen, or prompting files. They are already embedded in the master file. Follow its workflow exactly: translate, analyze, break into beats, write prompts, generate images, save files, verify dimensions, spot-check visuals, reroll failed images, and report final paths.
```

If the intern has access to extra local files, they may use them only as optional supporting context. The master file remains the complete source of operating instructions and visual references.
