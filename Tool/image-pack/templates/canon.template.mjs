// canon.mjs — the single source of visual truth for one image pack.
// Written ONCE by the lead agent after analysing the whole script, approved, then never
// rephrased. Parallel chunk writers read it but never edit it; build-refs.mjs and
// build-frames.mjs paste these strings verbatim into every prompt.
//
// Copy this file to <pack>/canon.mjs and replace every value. The example content is a trimmed
// version of the Sati / Bhim Malla pack (Malla-era Kathmandu, 1600s).

// Output aspect for every frame: "9:16" | "16:9" | "1:1".
export const ASPECT = "9:16";

// One grade per project: medium, optics, palette WITH HEX, contrast, texture, skin.
export const GRADE = "Photoreal cinematic historical reenactment film still. Shallow depth of field with the background falling soft. Palette: fired-brick red #8a3b26, aged sal-wood brown #4a2f1f, oil-lamp amber #d9902f, gilded copper #b8862b, smoke grey #6e6a64, lime-washed off-white #e6dfd0. Deep shadows, warm amber highlights, fine natural film grain, realistic skin with visible pores and texture rather than smoothed plastic.";

// Standard constraint block, always last. Never write "watermark" (hard safety block).
export const NEG = "No text, no captions, no signage, no lettering and no logos anywhere in the frame. No flags, no banners, no pennants and no national flags of any kind. Period-true objects only: no glass windows, no electric light, no plastic, no modern objects. Natural anatomy, correct hands with five fingers, no cloned faces.";

// Culture anchors: "Specifically X, and specifically NOT <the neighbours the model drifts to>".
// A shot uses its environment's anchor, or DEFAULT_ANCHOR. Use anchor "none" for heaven,
// abstract or pure-landscape shots, where an anchor's buildings and objects would leak in.
export const ANCHORS = {
  kantipur: "Specifically Malla-era Newar Kathmandu (the kingdom of Kantipur) in the 1600s, and specifically NOT a Mughal Delhi court, NOT a Rajasthani palace, NOT a Tibetan monastery, NOT Chinese, NOT modern Nepal: exposed red brick buildings with intricately carved dark sal-wood windows, multi-tiered pagoda temples with sloping clay-tiled roofs and gilded copper finials, stone-paved courtyards, brass oil lamps; noblemen in the long pleated jama robe with a patuka sash over churidar trousers and a wrapped turban.",
  tibet: "Specifically 1600s Tibet near Lhasa, and specifically NOT Nepal, NOT Chinese, NOT Mongolian: whitewashed stone buildings with inward-sloping walls, black trapezoid window frames and flat roofs, a barren brown plateau under hard blue sky; officials in maroon and gold brocade chuba robes with fur-trimmed hats."
};
export const DEFAULT_ANCHOR = "kantipur";

// Characters. Key = short code the chunk writers use in shots ("K", "B" …).
// canon: identity, 2–3 permanent marks, a distinct colour, a Never: line. Pasted verbatim.
// ref: defaults to refs/ref-<key>.png; point it at a fixed version (e.g. a crop) when you make one.
export const CHARS = {
  K: {
    name: "king",
    canon: "PRATAP MALLA, the Newar king of Kantipur: early thirties, lean and upright, warm wheat-brown skin, oval face with high cheekbones, dark almond eyes under straight heavy brows, a thin neatly curled black moustache and no beard. He wears a long pleated ivory-white jama robe with gold-embroidered cuffs, a crimson patuka sash, and a tall wrapped ivory turban set with a gold jewelled crest. Large gold hoop earrings, a three-strand pearl necklace, a red vermilion tika. Proud bearing, chin raised. Never bearded, never a Mughal emperor, never a Western crown."
  },
  B: {
    name: "bhim",
    canon: "KAJI BHIM MALLA, loyal minister and general of Kantipur: mid-forties, broad-shouldered and sturdy, weathered bronze-brown skin with sun lines at the eyes, square face, a full thick black moustache touched with grey, a small old scar through the right eyebrow. He wears a knee-length saffron-ochre jama coat over churidar trousers, a dark indigo patuka sash with a sheathed khukuri at the front, a plain maroon wrapped turban without jewels, a single silver ring on the right thumb. Straight-backed and open-faced. Never young, never lean, never jewelled like a king."
  }
};

// Groups of 3+ characters who appear together: one ffmpeg hstack lineup strip = one ref slot.
//   ffmpeg -i refs/ref-a.png -i refs/ref-b.png -i refs/ref-c.png -filter_complex hstack=3 refs/lineup-x.png
export const GROUPS = {
  // L: { members: ["J", "N", "M"], ref: "refs/lineup-courtiers.png" }
};

// Environments. plate: the establishing-plate description (no people). anchor: key in ANCHORS.
// ref: defaults to refs/env-<key>.png.
export const ENVS = {
  court: { anchor: "kantipur", plate: "the royal palace courtyard of Kantipur at mid-morning, a stone-paved square enclosed by three-storey red brick palace wings with rows of carved dark wooden windows, a tall three-tiered pagoda temple with gilded roof finials rising behind, the palace gateway a deep brick arch with brass-studded wooden doors flanked by two stone lions. Soft hazy sunlight from the left." },
  hall: { anchor: "kantipur", plate: "the interior of the palace audience hall of Kantipur at night, carved dark sal-wood pillars and beams, a low raised dais with a carved wooden throne, red and gold cushions, brass oil lamps on tall stands throwing warm pools of amber light." },
  tibet: { anchor: "tibet", plate: "the edge of Lhasa on the high Tibetan plateau under hard midday light: whitewashed stone buildings with inward-sloping walls and black trapezoid window frames, a dusty open square, bare brown mountains close behind." }
};

// Recurring phrases chunk writers can drop into a scene as {{KEY}}, so props stay identical.
export const MOTIFS = {
  FEATHER: "a single long hawk feather, cream at the base and banded brown and grey toward the tip",
  GUARDS: "palace guards in plain white jama robes and white cloth turbans carrying long spears"
};
