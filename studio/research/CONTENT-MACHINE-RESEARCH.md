# Content Machine — Potential Research & "What to Build" Report

**Prepared:** 2026-10-30
**Scope:** Turning Content Machine (Nepali/Hindi/English AI content studio) into a complete content machine, focused on (a) a library/system of visual styles + prompting presets and (b) the marketing elements that make short-form content perform.

> **How to read this.** Each section separates **FACT** (sourced, with URL) from **RECOMMENDATION** (my judgment for this product). Many sources in this space are vendor/affiliate blogs with self-reported numbers — those are flagged as directional, not proven. The highest-trust sources are first-party docs (Higgsfield help center, Boson AI GitHub/blog, Hugging Face model cards) and are cited as such.

---

## Section 1 — Higgsfield (disambiguated)

The owner said "opensource higgsfield." There are **two unrelated things** both carrying the "Higgs" name. They are not the same company or product.

### 1a. Higgsfield AI (higgsfield.ai) — the video/image content platform *(NOT open source)*

This is the **model for a preset library**. It is a closed, paid SaaS, not open source. Its core idea is that cinematic results come from **named, one-click presets** layered on top of a generative model, rather than from freeform prompting.

**FACT — Building blocks catalogued:**

| Block type | What it is | Named examples (sourced) |
|---|---|---|
| **Camera motion presets** | One-click cinematic camera moves applied to image→video | Dolly (Slow Dolly-In Reveal), 360 orbit (Orbital 360 Hero Shot), FPV (FPV Drone Flythrough), Crane Up to Wide Establishing, Handheld Follow Walk ([techpresso prompt library](https://academy.techpresso.co/prompts/higgsfield-prompts)) |
| **Action / VFX presets** | Impact and effect moves | Crash Zoom Impact, Bullet Time Freeze, Explosion Walk-Away, Whip Pan Transition, Slow-Mo Shatter ([techpresso](https://academy.techpresso.co/prompts/higgsfield-prompts)) |
| **Soul image styles** | Photoreal image generator with curated "moodboard" presets | Y2K Studio, Digital Camera, Retro BW, Warm Ambient, Editorial Street Style, Flash Editorial ([Higgsfield help center](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-soul-to-generate-images); [Soul 2.0 blog](https://higgsfield.ai/blog/SOUL-2.0-Realistic-AI-Image-Generator-for-Creative-Direction)) |
| **Preset categories (original Soul)** | Presets grouped by use-case | General, TikTok Core, Instagram Aesthetics, Beauty, Mood, Camera Photo, Graphic Art ([search of Higgsfield material](https://higgsfield.ai/blog/SOUL-2.0-Realistic-AI-Image-Generator-for-Creative-Direction)) |

**FACT — How the preset/prompt system is structured** ([techpresso prompt library](https://academy.techpresso.co/prompts/higgsfield-prompts)):
- Presets are organized into **categories of ~5 each** (e.g. Cinematic Camera Moves, Action & VFX, Product spins, Loops, Glitch cuts, One-take tracking).
- Each preset entry = **title + "what it does" one-liner + copy-paste prompt text with placeholders** (`[SUBJECT]`, `[PRODUCT]`, `[LOCATION]`, `[UPLOADED IMAGE]`) + a pro tip.
- Workflow guidance: **select the matching preset in-app, then write a prompt describing subject/scene**; use **one dominant camera move per clip** (multiple moves cause distortion).
- Soul 2.0 offers two preset types: **Curated Moodboards** (built-in named presets) and **Personal Moodboards** (user-created reusable styles) ([Higgsfield help center](https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-soul-to-generate-images)).

**FACT — caveats:** Preset counts differ by source (20+ vs 50+). Higgsfield's own pages say Soul launched with **20+ curated presets**; press cited 50+ ([BGR](https://bgr.com/tech/everyones-flipping-out-over-a-crazy-new-ai-image-generator-called-soul)). Treat exact totals as unverified; the live in-app picker is authoritative.

**RECOMMENDATION:** This is the template to copy. The winning pattern = **(named preset) × (placeholder prompt template) × (one dominant move rule) × (category grouping by use-case, not by technique)**. Content Machine should mirror the *structure* (title + one-liner + templated prompt + pro tip + category), not the brand.

### 1b. Higgs Audio v2 / v3 (Boson AI) — open-source TTS / voice cloning

This is almost certainly what the owner meant by "opensource higgsfield" — it is the open-weight voice model.

**FACT:**
- **Higgs Audio v2** released July 2025 by Boson AI; **license Apache-2.0** (commercial use allowed) ([Boson blog via HN reader](https://hn.jakechampion.name/reader/https://www.boson.ai/blog/higgs-audio-v2); [brightcoding writeup](https://blog.brightcoding.dev/2025/09/17/higgs-audio-v2-the-first-open-source-foundation-model-for-expressive-speech-and-voice-cloning)).
- Code: `github.com/boson-ai/higgs-audio`; weights: `bosonai/higgs-audio-v2-generation-3B-base` on Hugging Face ([GitHub](https://github.com/boson-ai/higgs-audio)).
- Architecture: **3.6B LLM + 2.2B audio adapter**; **zero-shot voice cloning** from a short reference clip; multi-speaker dialogue; can generate speech + background music together ([GitHub README notes](https://github.com/boson-ai/higgs-audio)).
- **Hardware: recommends a GPU with ≥24GB VRAM**; falls back to CPU (slow) ([README_V2 via fetch](https://github.com/boson-ai/higgs-audio)). A condensed **v2.5 (~1B)** exists; smaller models reportedly run on Jetson Orin Nano.
- **Higgs Audio v3** (4B) exists but is under a **Research / Non-Commercial license** — commercial use requires a separate paid license. v3 claims **"conversational TTS across 100+ languages"** and API-based zero-shot cloning ([GitHub](https://github.com/boson-ai/higgs-audio)).

**FACT — the critical gap:** **Neither the v2 GitHub README nor the v2 blog lists specific supported languages, and Nepali/Hindi are NOT named.** v2 marketing mentions only generic "multilingual" dialogue and a translation demo. The 100+ language claim belongs to **v3, which is non-commercial.** So: v2 = commercial-friendly but **unproven for Nepali/Hindi**; v3 = multilingual but **not free for commercial use** ([GitHub](https://github.com/boson-ai/higgs-audio)).

**RECOMMENDATION — voice engine:** For this project's **Nepali** need, Higgs Audio v2 is a weak fit (no confirmed Nepali, needs a 24GB GPU, and the multilingual version is non-commercial). The **Naamche Labs Swar** model is the stronger Nepali choice (see Section 5 / voice). Keep Higgs Audio v2 as a candidate only for **English/Hindi** narration if a quick A/B test confirms acceptable quality; do not assume Nepali support without testing.

---

## Section 2 — AI Visual Styles Catalogue & How to Prompt Each

**FACT — general principle:** Style keywords layer, and the same style word pairs with different modifiers to change the result (e.g. "cinematic" + "film noir" sets mood; "watercolor" + "loose" vs "detailed" diverges) ([Runway, 42 AI image styles](https://runway.com/resources/ai-image-styles)). Vendor keyword lists overlap heavily and must be tested per model — results differ by generator ([Runway](https://runway.com/resources/ai-image-styles); [LTX](https://ltx.io/blog/ai-video-styles)).

Keywords below are drawn from Runway's catalogue ([runway.com/resources/ai-image-styles](https://runway.com/resources/ai-image-styles)), LTX ([ltx.io/blog/ai-video-styles](https://ltx.io/blog/ai-video-styles)), LetsEnhance ([letsenhance.io](https://letsenhance.io/blog/all/ai-editing-styles/amp/)), and zsky ([zsky.ai](https://zsky.ai/blog/ai-art-styles-visual-guide.html)).

| Style | Description | Key prompt keywords / structure |
|---|---|---|
| **Cinematic** | Film-like frame, dramatic light, narrative mood | `cinematic shot, dramatic side lighting, volumetric lighting, shallow depth of field, epic scale, anamorphic` + reference a genre |
| **Film noir** | Moody high-contrast B&W detective look | `film noir, high contrast black and white, venetian-blind shadows, rain-soaked alley, dramatic side lighting` |
| **Documentary** | Unposed journalistic realism | `documentary style, natural lighting, candid unposed moment, photojournalistic, handheld camera aesthetic` |
| **Hyperrealism / Photoreal** | Indistinguishable from a photo | `photorealistic, shallow depth of field, golden hour, professional photography, 85mm, skin texture detail` |
| **Anime** | Japanese animation look | `anime, cel shading, bold outlines, vibrant colors, screentone shading, Studio Ghibli style / shonen anime` |
| **3D / Pixar** | Smooth polished CG characters | `3D render, smooth surfaces, expressive eyes, Pixar style, soft global illumination, subsurface scattering` |
| **Claymation** | Stop-motion clay | Must state clay behavior explicitly: `claymation, stop-motion, visible fingerprints in clay, matte clay surface, slight asymmetry, miniature set` (otherwise models default to shiny plastic 3D) ([LetsEnhance](https://letsenhance.io/blog/all/ai-editing-styles/amp/)) |
| **Analog / film** | Emulated film stock | `35mm film grain, faded colors, halation, light leaks, 1970s Polaroid / 1950s Kodachrome, vignetting` |
| **Vintage** | Aged period photo | `vintage sepia-tone photograph, aged texture, warm nostalgic tones, 1880s style` |
| **Vaporwave** | Retro neon digital | `vaporwave, neon pink and cyan, retro grid, chrome, 80s aesthetic, glitch` |
| **Watercolor** | Soft translucent washes | `watercolor painting, loose brushstrokes, gentle color bleeds, wet-on-wet, paper texture` |
| **Line-art** | Clean outlines | `line art, clean linework, single-weight contour, minimal, ink on white` (Runway's nearest: pencil/charcoal sketch, technical illustration) |
| **UGC / iPhone-candid** | Authentic phone-shot feel | `shot on iPhone, candid, available light only, slight motion blur, unposed, amateur snapshot, direct flash` |
| **Product shot** | Clean commercial studio | `product photography, white seamless background, three-point / softbox lighting, macro lens, studio` |
| **Oil painting** | Classical painterly | `oil painting, visible brushstrokes, thick impasto, glazing, chiaroscuro` |
| **Concept/digital art** | Game/film concept | `concept art, matte painting, ArtStation, dramatic lighting, epic environment` |
| **Comic book** | Inked panels | `comic book, bold inks, halftone shading, action lines, dynamic panel` |
| **Gothic / cinematic dark** | Candlelit drama | `gothic, candlelit cathedral, moody chiaroscuro, velvet textures` |

**RECOMMENDATION — styles that suit historical/mythological/cultural Nepali content** (prioritize building these as named presets):
1. **Epic Cinematic / Mythic** — for gods, kings, battles: `cinematic, volumetric god-rays, epic scale, dramatic rim light, atmospheric haze, ornate detail`.
2. **Illuminated Manuscript / Thangka-inspired** — map Runway's "medieval illuminated manuscript, gold leaf, vellum texture" onto Nepali paubha/thangka aesthetics (gold leaf, flat symbolic composition, deity iconography). *Note: test culturally — generic models may render Tibetan-Buddhist or Indian temple motifs; curate reference images.*
3. **Documentary / Golden-hour realism** — Himalayan landscapes, village life: `documentary, golden hour, natural light, 35mm`.
4. **Vintage film** — recreating historical Nepal (Rana era, old Kathmandu): `1950s Kodachrome, faded, grain, archival`.
5. **Hyperreal portrait** — historical figures, warriors, sadhus: `photorealistic, 85mm, dramatic side light, weathered skin detail`.
6. **Oil painting / fresco** — mythological epics in painterly form.

---

## Section 3 — Marketing Elements That Make Short-Form Perform

*Most numbers here are vendor/creator self-reported — flagged as directional.*

### Hooks (first 3 seconds) — FACT
- The **first 3 seconds are the dominant battleground**; this is the single most consistent theme across all sources ([Opus.pro](https://www.opus.pro/blog/youtube-shorts-hook-formulas); [dev.to hook engineering](https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9)).
- Common hook archetypes: **curiosity gap, pattern interrupt, bold claim, relatable pain point, visual shock** ([Opus.pro](https://www.opus.pro/blog/tiktok-hook-formulas); [CapCut](https://www.capcut.com/create/short-form-video-hooks)).
- One creator's 120-video test reported **curiosity-gap hooks held best (~68% 3-sec retention)** — anecdotal, single creator ([dev.to](https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9)).
- Caution: **shock/pattern-interrupt must stay coherent** with the content or viewers bounce ([CapCut pattern interrupt](https://www.capcut.com/create/pattern-interrupt-technique-short-form-video)).

### Captions / subtitles — FACT
- **Word-by-word "karaoke" highlight is the dominant short-form format** (vendor-asserted, not independently measured) ([videocaptions.ai karaoke](https://www.videocaptions.ai/caption-styles/karaoke); [OpenClip](https://openclip.app/use-cases/karaoke-captions)).
- **Placement: middle of frame beats bottom-third** (bottom gets cropped/covered by UI); **~2–3 sec or 6–10 words per caption segment** ([subclip playbook](https://subclip.app/blogs/subtitle-styles-that-convert); [OpenClip styling](https://openclip.app/learn/caption-styling)).
- Clips with **2–3 caption updates in the first 3 sec outperform** one static caption ([Opus.pro](https://www.opus.pro/blog/youtube-shorts-hook-formulas)).
- Captions matter because **most feed viewing starts sound-off** ("68%"/"86.6% use captions" cited but unverified) ([revid.ai](https://www.revid.ai/blog/the-anatomy-of-a-viral-short-2026)).

### Thumbnails — FACT ([1of10](https://1of10.com/blog/the-psychology-behind-high-ctr-thumbnails); [entreresource](https://entreresource.com/youtube-thumbnail-best-practices/))
- **Contrast** is the most-cited CTR factor; high-contrast beats "pretty" low-contrast.
- **A face with exaggerated-but-matching emotion** beats neutral; larger faces tested higher (anecdotal).
- **Short text: ~2–6 words, bold sans-serif, outline/shadow**; common layout = face one side, text other side.

### CTAs, pacing, aspect ratio — FACT
- **CTA at the end / last 3–5 sec** (follow, save, comment, link in bio) ([CapCut](https://www.capcut.com/create/short-form-video-hooks)).
- **9:16 vertical is standard** (~75% of viewing on phones; one tool reported 77.9% of its exports were 9:16) ([cropink](https://cropink.com/9x16-aspect-ratio); [thesparkhouse](https://www.thesparkhouse.com/blog/comprehensive-guide-to-vertical-videos)).
- **Spec 1080×1920.** Length guidance (varies, check platform): Shorts ≤60s (15–60 recommended), Reels ≤90s, TikTok ≤10min (≈3min recommended) ([trycloudflare specs comparison](https://systematic-hugo-scanner-critical.trycloudflare.com/blog-video-specs)).
- **Repurpose one 9:16 master** across TikTok/Reels/Shorts ([blitzcutai](https://blitzcutai.com/blog/vertical-vs-horizontal-video)).

**RECOMMENDATION:** Ship a **Hook template library** (10–15 named patterns with fill-in text) and a **caption-style preset set** (karaoke word-highlight, mid-frame placement, bold outline, Nepali Devanagari + Preeti font support — this is a real differentiator since Western tools render Devanagari poorly). Default every video project to a **9:16 master** with one-click reframes.

---

## Section 4 — Competitor / Landscape Scan

| Tool | Category | Exposed building blocks (FACT, sourced) | What Content Machine can borrow |
|---|---|---|---|
| **Higgsfield AI** | Image+video presets | Named camera/VFX presets, Soul moodboards, placeholder prompt templates, categories ([techpresso](https://academy.techpresso.co/prompts/higgsfield-prompts)) | The whole preset-library model |
| **Runway** | Gen video + editing | Gen-4.5 model + built-in editing; published 42-style catalogue ([Runway](https://runway.com/resources/ai-image-styles); [HeyGen compare](https://www.heygen.com/blog/kling-vs-runway-vs-veo)) | Style catalogue as content; in-app editing |
| **Kling** | Gen video | Meme/style presets added in 2.0; value pick ([HeyGen compare](https://www.heygen.com/blog/kling-vs-runway-vs-veo)) | Preset packs |
| **Sora** | Gen video | Strong narrative-prompt interpretation, ChatGPT distribution ([eesel](https://www.eesel.ai/blog/sora-2-alternatives)) | Narrative prompt structuring |
| **Pika** | Gen video | PikaFrames (frame morphing), PikaAdditions (object insert), aspect-ratio presets ([eesel](https://www.eesel.ai/blog/sora-2-alternatives)) | Transition/effect presets |
| **Veo (Google)** | Gen video | Cinematic + **synchronized audio**, 8-sec clip cap ([HeyGen compare](https://www.heygen.com/blog/kling-vs-runway-vs-veo)) | **This project already uses Veo** — build Veo-specific motion presets |
| **Captions** | Short-form editor | AI Edit (apply one style to whole video), **100+ stylizable caption templates**, AI avatars, translation/dubbing, eye-contact correction, **100+ languages** ([captions.ai](https://captions.ai/features/ai-video-maker); [llms.txt](https://captions.ai/llms.txt)) | Caption template library; whole-video style apply |
| **Opus Clip** | Repurposing | Long-form → short clips (not generative) ([eesel](https://www.eesel.ai/blog/sora-2-alternatives)) | Auto-clip long content |
| **InVideo** | Text→video templates | Prompt-to-video with template library ([nextool](https://nextool.ai/compare/invideo-ai-vs-captions-ai)) | Template packs |
| **Argil** | AI avatars/UGC | Avatar creation, article-to-video, voice transformation, captions, now Veo 3 + Hailuo ([argil.ai](https://www.argil.ai/ai-influencers-avatar-v1)) | UGC-ad presets, article→video |
| **HeyGen** | Avatar presenter | Presenter-led multilingual video running Veo/Kling inside ([HeyGen](https://www.heygen.com/blog/kling-vs-runway-vs-veo)) | Multilingual presenter |
| **Freepik** | Aggregator | Text/Image→video + Storyboard mode, multi-model (Veo/Runway/Kling) ([directory](https://www.eesel.ai/blog/sora-2-alternatives)) | Storyboard mode; multi-model routing |

**RECOMMENDATION — gaps Content Machine uniquely fills:** None of these handle **Nepali/Hindi end-to-end** (Devanagari + Preeti subtitles, Nepali voice, culturally-correct visual styles) and none combine **real-data map animations** with gen video. The competitive wedge is *localized, story-consistent, factual+generative pipeline* — not beating Veo/Runway on raw model quality.

---

## Section 5 — Synthesis: What to Build for Content Machine Studio

Prioritized by **Impact × Effort**. Effort = rough build cost given the existing MCP server.

| # | Feature | What it is | Impact | Effort | Priority |
|---|---|---|---|---|---|
| 1 | **Style Library (named presets + prompt templates)** | JSON-backed catalogue: each preset = name, one-line desc, templated prompt with `[SUBJECT]/[LOCATION]` placeholders, category, pro-tip. Mirrors Higgsfield's structure. Seed with the 20 presets in the appendix. | High | Low–Med | **P0** |
| 2 | **Nepali/Devanagari + Preeti caption-style presets** | Karaoke word-highlight, mid-frame, bold outline; render Devanagari & Preeti correctly (existing `make_subtitles` already does Preeti). Package as named caption styles. | High | Low | **P0** |
| 3 | **Veo Motion/Camera preset packs** | Named camera moves (dolly-in, 360 orbit, crane-up, crash zoom, handheld follow) as reusable prompt fragments appended to `generate_videos` prompts; enforce one-dominant-move rule. | High | Low–Med | **P0** |
| 4 | **Hook + Caption + CTA template library** | 10–15 hook patterns, CTA templates, text-overlay styles as fill-in templates feeding the script step. | High | Low | **P1** |
| 5 | **Prompt-builder UI in Studio** | Pick style preset + camera preset + subject → composes final prompt; shows preview; saves as reusable "Personal Moodboard." | High | Med | **P1** |
| 6 | **Voice engine: Naamche Swar (Nepali) + English/Hindi fallback** | Integrate Swar (F5-TTS based, 20–30s cloning, Nepali+English) for Nepali; test Higgs Audio v2 for English/Hindi. | High | Med | **P1** |
| 7 | **9:16 master + multi-platform reframe/export** | Default vertical 1080×1920 project, one-click length/ratio variants per platform. | Med | Low | **P2** |
| 8 | **Brand kits (Bamsawali / Biopunki)** | Saved color/font/logo/caption-style/voice bundles applied across a project. | Med | Med | **P2** |
| 9 | **Auto-clip long content (Opus-style)** | Turn a long master into short clips with hook detection. | Med | High | **P3** |
| 10 | **Story-consistency "character sheet"** | Reusable character/style reference (like Soul ID) to keep image packs consistent. | Med | Med | **P2** |

**Top-level recommendation:** Build #1–#3 first. They are low-effort, high-impact, and turn the existing MCP pipeline into a *preset-driven* studio — the single highest-leverage change. The style/motion presets are just structured data + prompt composition; most of the hard generation plumbing already exists.

**Voice decision (consolidated):** Use **Naamche Swar** for Nepali (purpose-built, Nepali+English+code-mix, 20–30s cloning, F5-TTS/IndicF5 base, bundled Kriti recognizer) — verify its weight license on the repo before commercial use ([HF Aarjan/swar](https://huggingface.co/Aarjan/swar)). Do **not** rely on Higgs Audio v2 for Nepali (unconfirmed); Higgs Audio v3 is multilingual but **non-commercial** ([Boson GitHub](https://github.com/boson-ai/higgs-audio)).

---

## Appendix — Prompt Preset Starter Library (drop-in for Studio)

Each preset: **Name** — one-line description — **prompt template** (placeholders in `[BRACKETS]`). Visual-style presets assume an image model; motion presets are appended to a Veo/image→video prompt. Tune per model.

### A. Visual-style presets (image)

1. **Mythic Epic** — Godly/heroic scenes for mythology. `Cinematic wide shot of [SUBJECT], epic mythological scale, volumetric god-rays, dramatic rim lighting, atmospheric haze, ornate ancient detail, 35mm anamorphic, photoreal` 
2. **Paubha / Thangka Mythic** — Nepali sacred-art look (curate references). `[DEITY/SUBJECT] in traditional Nepali paubha style, gold leaf, flat symbolic composition, intricate iconographic detail, mineral pigments, ornate halo` 
3. **Himalayan Documentary** — Real landscapes/village life. `Documentary photo of [SUBJECT], Himalayan setting, golden hour natural light, candid unposed, 35mm, photojournalistic` 
4. **Rana-Era Archive** — Historical Nepal (1900s–50s). `Vintage archival photograph of [SUBJECT], 1950s Kodachrome, faded colors, film grain, vignetting, period-accurate clothing` 
5. **Weathered Hero Portrait** — Warriors, sadhus, elders. `Hyperreal portrait of [SUBJECT], 85mm, dramatic side light, weathered skin texture detail, shallow depth of field, moody` 
6. **Fresco Myth** — Painterly epic. `Oil painting of [SCENE], visible brushstrokes, chiaroscuro, classical fresco composition, warm earth tones` 
7. **Kathmandu Noir** — Moody urban drama. `Film noir, [SUBJECT] in rain-soaked Kathmandu alley, high contrast black and white, venetian-blind shadows, dramatic side lighting` 
8. **Festival Vibrance** — Dashain/Tihar/Holi energy. `Vibrant festive scene of [SUBJECT], saturated colors, bokeh lights, celebratory atmosphere, dynamic motion, photoreal` 
9. **Anime Legend** — Mythology for younger audiences. `Anime style, [SUBJECT], cel shading, bold outlines, vibrant colors, dramatic lighting, Ghibli-inspired landscape` 
10. **Pixar Folktale** — Kid-friendly 3D. `3D render, [SUBJECT], Pixar style, expressive eyes, smooth surfaces, soft global illumination, warm storybook lighting` 
11. **Claymation Folk** — Stop-motion charm. `Claymation stop-motion, [SUBJECT], visible fingerprints in matte clay, slight asymmetry, miniature handcrafted set` 
12. **UGC iPhone Candid** — Authentic brand/UGC. `Shot on iPhone, candid photo of [SUBJECT/PRODUCT], direct flash, available light, slight motion blur, unposed, amateur snapshot` 
13. **Clean Product Hero** — Bamsawali/Biopunki product shots. `Product photography of [PRODUCT], white seamless background, three-point softbox lighting, macro lens, crisp studio` 
14. **Editorial Flash** — Fashion/lifestyle. `Editorial flash photography of [SUBJECT], hard direct flash, high fashion, Y2K studio aesthetic, bold` 
15. **Watercolor Story** — Soft narrative illustration. `Watercolor painting of [SCENE], loose brushstrokes, gentle color bleeds, wet-on-wet, paper texture` 
16. **Concept Vista** — Epic environment establishing. `Concept art matte painting of [LOCATION], epic scale, dramatic lighting, atmospheric depth, ArtStation` 
17. **Vaporwave Retro** — Stylized/youth. `Vaporwave, [SUBJECT], neon pink and cyan, retro grid, chrome, 80s aesthetic, glitch`

### B. Motion / camera presets (append to video prompt; one per clip)

18. **Slow Dolly-In Reveal** — Builds tension toward subject. `Slow dolly-in toward [SUBJECT], steady forward creep, background softening as camera approaches, cinematic` 
19. **Orbital 360 Hero** — Heroic reveal around subject. `Smooth 360-degree orbital shot around [SUBJECT], hero framing, consistent speed` 
20. **Crane Up to Wide** — Grand establishing. `Crane up from [SUBJECT] to a wide establishing shot of [LOCATION], rising reveal` 
21. **Crash Zoom Impact** — Punchy hook moment. `Explosive crash zoom from wide to extreme close-up on [SUBJECT], shockwave impact` 
22. **FPV Drone Flythrough** — Kinetic energy. `Fast FPV drone dive toward [SUBJECT] through [LOCATION], ending in a banking turn` 
23. **Handheld Follow Walk** — Documentary intimacy. `Handheld camera following [SUBJECT] walking, natural sway, documentary feel` 
24. **Bullet Time Freeze** — Dramatic stop. `Bullet-time orbit around [SUBJECT] frozen mid-action, dramatic` 
25. **Whip Pan Transition** — Scene-to-scene cut. `Fast whip pan from [SCENE A] to [SCENE B], motion-blur transition`

### C. Hook / caption / CTA templates (text)

- **Curiosity-gap hook:** "Most people don't know [SURPRISING FACT about TOPIC]…"
- **Bold-claim hook:** "This is why [COMMON BELIEF] is completely wrong."
- **Pain-point hook:** "If you've ever [RELATABLE STRUGGLE], watch this."
- **Visual-shock hook:** open on the most dramatic frame; text overlay "[SHOCKING RESULT]".
- **Caption style default:** karaoke word-by-word highlight, mid-frame, bold sans-serif/Devanagari, white text + dark outline, 6–10 words/segment.
- **CTA (end, 3–5s):** "Follow for more [NICHE] / Save this / Comment [WORD]."

---

### Source list (primary & most-cited)
- Higgsfield presets structure — https://academy.techpresso.co/prompts/higgsfield-prompts
- Higgsfield Soul 2.0 — https://higgsfield.ai/blog/SOUL-2.0-Realistic-AI-Image-Generator-for-Creative-Direction ; help center — https://higgsfield.ai/creator-hub/help-center/ai-models/how-do-i-use-soul-to-generate-images
- Boson Higgs Audio — https://github.com/boson-ai/higgs-audio ; blog — https://hn.jakechampion.name/reader/https://www.boson.ai/blog/higgs-audio-v2
- Naamche Swar — https://huggingface.co/Aarjan/swar ; Kriti — https://huggingface.co/Aarjan/kriti-telephony
- Runway 42 styles — https://runway.com/resources/ai-image-styles ; LTX — https://ltx.io/blog/ai-video-styles ; LetsEnhance — https://letsenhance.io/blog/all/ai-editing-styles/amp/ ; zsky — https://zsky.ai/blog/ai-art-styles-visual-guide.html
- Hooks — https://www.opus.pro/blog/tiktok-hook-formulas ; https://dev.to/bulkdl/hook-engineering-the-science-of-the-first-3-seconds-in-short-form-video-2026-2jp9 ; https://www.capcut.com/create/pattern-interrupt-technique-short-form-video
- Captions — https://www.videocaptions.ai/caption-styles/karaoke ; https://openclip.app/learn/caption-styling ; https://subclip.app/blogs/subtitle-styles-that-convert
- Thumbnails — https://1of10.com/blog/the-psychology-behind-high-ctr-thumbnails ; https://entreresource.com/youtube-thumbnail-best-practices/
- Aspect ratio/specs — https://cropink.com/9x16-aspect-ratio ; https://systematic-hugo-scanner-critical.trycloudflare.com/blog-video-specs
- Competitors — https://www.heygen.com/blog/kling-vs-runway-vs-veo ; https://www.eesel.ai/blog/sora-2-alternatives ; https://captions.ai/features/ai-video-maker ; https://www.argil.ai/ai-influencers-avatar-v1
