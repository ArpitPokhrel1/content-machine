# Examples

Text-only copies of finished jobs: the files that *made* the images, not the images themselves
(those live in `Outputs/` on the studio machine and are not committed).

- `sati-bhim-malla-image-pack/`: a 70-frame, 14-chunk Nepali history pack (Malla-era Kantipur
  plus Tibet), finished 2026-09-24. `script.txt` is the source, `canon.mjs` the locked Canon, and
  `build-refs.mjs` / `build-frames.mjs` the builders. `prompt-pack.md` records the decisions and
  the reroll log. It predates the generic `asset-generation/image-pack/build-frames.mjs` (its builders hold
  the shots inline), so new packs should use `asset-generation/image-pack/templates/canon.template.mjs` and
  `shots/*.json` instead. The Canon writing is the part to copy.
