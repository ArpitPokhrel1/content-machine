# Sati le Sarapeko Desh — Kaji Bhim Malla (Vayupankhi)

Status 2026-09-24: **all 70 frames done** and each one checked by eye, in `frames/cNN-F.png` (768x1344, 9:16). No video has been generated or approved.

User decisions: Kathmandu setting, with Tibet only for the Tibet visit (chunks 5 and 7–8) · no blade shown at the execution (the arrest, then the fallen turban) · the sati shown as the historical custom, non-graphic (shrouded body on the pyre, widow seated beside it, flames hide everything once lit) · chunk 13 stays in the historical setting · 9:16.

Re-rolls, one fix each; the old versions are in `superseded/`:
- c01-3: rooftop water tank → "nothing standing on any rooftop"
- c03-1: stiff reference pose → "facing each other in profile"
- c05-4: a second king appeared → "the only king in the frame; exactly two people"
- c07-4: cowboy-like hats → "round fur-trimmed Tibetan caps"
- c12-3: a modern white building → "only old red brick buildings"
- c13-1: modern rooftops → the rooftop clause
- c13-3: letterboxed → three stacked vertical bands
- c14-2: letterboxed, plus a stray person → "no person in the frame, a tall vertical close-up"

Generation: about 90 calls in total. Most failures were 429 quota rejections, which generated and billed nothing; see `logs/`. `sheets/` holds one contact sheet per chunk. `sheets/review/` holds the review sheets used during the session.

- Script: `script.txt` (279 words), `words.txt` (one word per line)
- Canon text: `canon.mjs` (GRADE, KANTIPUR and TIBET culture anchors, NEG, 7 character blocks)
- References: `refs/` (ref-* characters, env-* environments); superseded in `refs/superseded/`
- Runner: `node gen.mjs <jobs.json> <outDir> 5 90` (5 parallel calls, 90 s between batches, no retries)

## Classification
Historical/heritage explainer · reenactment · elegiac, with a curse as the hook · Malla-era Kantipur (Kathmandu) in the 1600s, plus Tibet near Lhasa · vertical 9:16 short · mostly literal, with symbolic handling of the execution and the sati.

## Budget
279 words → 14 chunks of 20 words → 5 images per chunk of 4 words each = 70 images (the last chunk has 19 words).
Every frame carries its chunk's full context, not only its 4 words.

## Chunk plan (5 frames each, generated in parallel)
| # | Words | Story | Frames |
|---|---|---|---|
| 01 | 1–20 | The curse, cried from the burning pyre | wife's face lit by fire · her hand raised in the curse · pyre flames close · sparks over Kantipur roofs at night · valley today at dawn |
| 02 | 21–40 | "The land cursed by a sati"; the story begins | valley under a brooding sky · Vayupankhi wind motif (a feather riding the wind over the rooftops) · ash drifting over the palace · empty palace gate at dusk · Pratap Malla and Bhim Malla together |
| 03 | 41–60 | With Bhim's help, the old king is put under arrest | Bhim and the king conferring · the old king on the throne · the old king led away by guards · the old king alone at a lattice window · Pratap Malla now on the throne |
| 04 | 61–80 | Bhim rises; the courtiers envy him; the Tibet mission | Bhim honoured in court · three courtiers whispering behind a pillar · envious sidelong looks · Bhim setting out · his caravan leaving Kantipur |
| 05 | 81–100 | Mahadev Ojha, Naradev and Maya Singh go to the king | Mahadev Ojha close-up · Naradev and Maya Singh · all three bowing before the king · Ojha gesturing north · Bhim on the won Tibetan land |
| 06 | 101–120 | "He means to be king there"; the king flares in rage | Ojha whispering at the king's ear · the king's face darkening · whisper close-up · the king rising from the throne · his fist clenched as a lamp flares |
| 07 | 121–140 | Recall ordered; Bhim meanwhile in Tibet | the king commanding · a messenger riding out of the gate · the messenger on the pass · Bhim with Tibetan officials · a Newar trading house going up in Lhasa |
| 08 | 141–160 | Treaty done; Bhim thinks the king is pleased and heads home | a seal pressed onto the treaty (unreadable) · the messenger kneeling before Bhim · Bhim reading, smiling · his hopeful face · Bhim riding home over the pass |
| 09 | 161–180 | Skips his own home, goes straight to the palace | Bhim entering the valley · passing his own door · striding through the palace gate · the king cold on the throne · the king's raised hand, refusing to listen |
| 10 | 181–200 | Execution at the main gate (non-graphic); innocence discovered | guards seizing Bhim at the gate · a raised blade in silhouette · his turban fallen on the stone steps · the empty gate · the king alone, learning the truth |
| 11 | 201–220 | Repentance, too late; the widow prepares for sati | the king's realisation · the king kneeling at a lamp · a guttering lamp · the widow in mourning · the widow walking to the ghat |
| 12 | 221–240 | The curse on the kingdom; she enters the pyre | at the pyre, turned toward the palace · her hand raised in the curse · onlookers recoil · her silhouette against the firelight · flames only |
| 13 | 241–260 | Remembered today in every disaster | (awaiting user decision: stay in period or show modern Nepal) |
| 14 | 261–279 | Call to action: follow Vayupankhi | listeners remembering · old manuscript pages (unreadable) · the wind feather · the valley at sunrise · the feather flying off into light |

## Open risks
- Both ghat plates (env-ghat, env-ghat-v2) have modern buildings, so neither was used as a reference; the ghat is described in text instead. Faint modern rooftops remain far in the background of c01-1, c01-3 and c13-1.
- The character references have a Durbar Square behind them. Ojha's has been cropped (`ref-ojha-crop.png`), and the three courtiers share a lineup strip (`ref-courtiers-lineup.png`).
- c06-4 ("the king's face darkening") and c06-5 ("rising in fury") read calmer than scripted.
- `gen.mjs` here is this session's original runner. The reusable version is `Tool/image-pack/gen-parallel.mjs`.
- Historical note for the user: Pratap Malla reigned in the 17th century (1641–1674); the script says the 16th. Most accounts name Laxmi Narasimha Malla, not Pratap Malla, as the king who ordered the execution. The frames follow the script as written.
