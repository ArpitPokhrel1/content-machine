import { GoogleGenAI } from "@google/genai";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const ai = new GoogleGenAI({ vertexai: true, project: "auto-504509", location: "us-central1" });
const dir = "kiratarjuniya-pashupatastra-image-pack/images";
await mkdir(dir, { recursive: true });

const R = {
  ar: `${dir}/ref-arjuna-ascetic.png`,   // the single warrior Arjuna look used throughout
  ki: `${dir}/ref-kirata-hunter.png`,
  sh: `${dir}/ref-shiva-true-form.png`,
  bo: `${dir}/ref-muka-boar.png`
};

const AR = "Arjuna the great warrior: powerful athletic warrior's physique with broad shoulders, a strong muscular chest and thick muscular arms, warm brown skin, strong noble clean-shaven face, long dark hair pulled up into a high neat warrior's topknot tied with a cord, wearing a deep saffron and gold warrior's dhoti wrapped tightly for movement, gold armlets on both upper arms, a gold torque necklace, a thin sacred thread across the chest, a red tilak on the forehead, carrying his great longbow and a quiver of arrows. UNMISTAKABLY A GREAT WARRIOR, never an ascetic or sage: not gaunt, not frail, not skinny, no visible ribs, no matted dreadlocks, no bark loincloth, no ash-smeared body.";
const KI = "the Kirata hunter of the eastern Nepali Himalaya: strong athletic build, warm brown skin, Himalayan Kirati facial features of the indigenous Rai and Limbu peoples of eastern Nepal with broad cheekbones and almond eyes, long dark hair tied back with a beaded woven headband, a knee-length handwoven wrapped garment of undyed cream wool with bold red and black Kirati embroidered geometric borders, a patterned patuka sash at the waist, a large silver pendant and silver hoop earrings, a khukuri sheathed at the belt, a bamboo longbow and a woven quiver of feathered arrows. Specifically Himalayan Nepali Kirati, not generic tribal.";
const SH = "a powerful ancient deity figure of Indian tradition: warm sun-browned skin dusted with grey sacred ash, a deep blue tinge at the throat, long matted dark hair piled high in a heavy coil with a crescent moon in it and a thin stream of water flowing from the hair, three horizontal ash lines and a third eye on the forehead, heavy rudraksha bead necklaces, a tiger-skin garment at the waist, a living serpent across the shoulders, a weathered iron trident, serene majestic expression, soft restrained warm radiance.";
const BO = "an enormous menacing wild boar with coarse bristling dark fur, powerful shoulders, large curved tusks, fierce eyes, a dark smoky aura suggesting a demon in animal form, realistic animal anatomy.";

const LOOK = "Vertical 9:16 cinematic film still, single coherent frame. CONSISTENT FILM LOOK across the whole production: photoreal painterly epic rendering in the visual language of classic Indian mythological cinema, muted naturalistic colour grade of warm earth tones against cool misty blues, soft diffused Himalayan daylight, fine atmospheric haze, shallow cinematic depth of field, rich physical texture and natural imperfections. No flat poster illustration, no over-polished CGI sheen.";
const FULL = "CRITICAL FRAMING: full-bleed vertical 9:16 image in which the scenery fills every pixel from the very top edge to the very bottom edge. NO black bars, NO letterbox, NO borders, NO margins of any colour.";
const NEG = "Constraints: no readable text, no numbers, no digits, no logos, no watermark, no subtitles, no gore, no blood, no wounds, no distorted hands, no extra fingers, no melted or cloned faces, no Western medieval plate armor, no fantasy horns, no glowing red eyes, no laser beams, no superhero posing, no modern objects.";
const HIM = "High Himalayan wilderness of Nepal: pine and rhododendron forest, mossy boulders, drifting mist, distant snow peaks.";
const EDIT = "Edit the supplied reference image to show the SAME scene a moment later. Keep the identical camera angle, identical framing and scale, identical background, identical characters and clothing, and identical colour grade. The ONLY change is: ";

const beats = [
  { id: "01-hook-kirata-appears",
    start: `${LOOK} ${FULL} A lone figure stands half hidden in drifting Himalayan forest mist, backlit by pale morning light so he reads almost as a silhouette, a bamboo longbow held at his side: ${KI} ${HIM} Composition: medium-wide vertical, figure centered in the mist. Lighting: cool backlit mist with a thin rim of golden light. ${NEG}`,
    startRefs: [R.ki],
    end: `${EDIT} he steps forward out of the mist so his face and clothing become clearly visible, the warm morning light now catching his silver pendant and the red and black embroidered borders of his garment. ${FULL} ${NEG}`, endRefs: [] },

  { id: "02-divine-weapons",
    start: `${LOOK} ${FULL} Ancient Mahabharata-era Indian warriors in gold ornaments and rich silks stand in formation on a vast dusty plain at dusk, drawing their great longbows in unison, the arrowheads beginning to gather a restrained golden divine light. Composition: wide vertical, warriors across the lower half, immense stormy sky filling the upper half. Lighting: dramatic dusk storm light with a restrained golden glow on the arrowheads. ${NEG}`,
    startRefs: [],
    end: `${EDIT} the warriors have released their arrows together and streaks of restrained golden divine light arc upward across the stormy sky above them. ${FULL} ${NEG}`, endRefs: [] },

  { id: "03-kaurava-maharathis",
    start: `${LOOK} ${FULL} Three formidable and dignified Mahabharata-era great warriors stand together in a war camp at dusk: an elderly grand-patriarch warrior with a flowing white beard in silver and white silk armour, a stern older warrior-teacher with a grey beard in ochre robes holding a longbow, and a powerful golden-armoured warrior with radiant golden earrings and breastplate. Noble and imposing, never villainous or caricatured. Composition: medium-wide vertical, the three arranged naturally, war banners behind. Lighting: warm torchlight against a darkening sky. ${NEG}`,
    startRefs: [],
    end: `${EDIT} the three warriors raise their weapons in readiness together, expressions resolute, the war banners behind them lifting in a gust of wind. ${FULL} ${NEG}`, endRefs: [] },

  { id: "04-arjuna-to-himalaya",
    start: `${LOOK} ${FULL} ${AR} He walks alone up a narrow stone mountain trail, seen from behind and slightly to the side, heading toward towering snow peaks. ${HIM} Composition: wide vertical, the solitary figure low in the frame, immense mountains filling the upper two thirds. Lighting: cold clear morning light. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} the walking figure has moved further up the trail and is now smaller and higher in the frame, deeper into the mountains, with thin cloud drifting across the slopes behind him. ${FULL} ${NEG}`, endRefs: [] },

  { id: "05-tapasya-one-arm",
    start: `${LOOK} ${FULL} ${AR} He stands in severe penance upon a flat mossy boulder, balanced on ONE LEG with the other foot tucked against his thigh and ONE ARM RAISED STRAIGHT UP ABOVE HIS HEAD, eyes closed in total concentration, his powerful warrior's frame held perfectly still. His longbow rests against the boulder beside him. ${HIM} Composition: medium-wide vertical, figure centered on the boulder. Lighting: soft cold dawn light with drifting mist. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} much time has passed — snow now falls and settles on his shoulders, topknot and the boulder, and dry autumn leaves drift through the air past him. He holds the exact same standing one-leg, one-arm-raised pose without moving. ${FULL} ${NEG}`, endRefs: [] },

  { id: "06-muka-boar-charges",
    start: `${LOOK} ${FULL} ${BO} It emerges from dense dark forest undergrowth, head low, eyes fixed ahead, dark smoke curling from its bristling back. ${HIM} Composition: medium vertical, boar emerging from shadowed foliage toward the viewer. Lighting: dim green forest shadow cut by a shaft of cold light. ${NEG}`,
    startRefs: [R.bo],
    end: `${EDIT} the boar is now in a full thundering charge toward the viewer, much closer and larger in frame, earth and dry leaves flung up behind it, dark smoke trailing from its back. ${FULL} ${NEG}`, endRefs: [] },

  { id: "07-two-arrows",
    start: `${LOOK} ${FULL} ${AR} He snaps out of his penance, seizes his great longbow and looses an arrow toward a charging boar, his powerful warrior's body taut and explosive with sudden motion. ${HIM} Composition: medium-wide vertical, the warrior large in the foreground drawing his bow, the dark charging shape of the boar beyond him. Lighting: dim forest light with dust in the air. ${NEG}`,
    startRefs: [R.ar, R.bo],
    end: `${EDIT} the boar now lies fallen and completely still on the forest floor in the midground with TWO separate arrows resting in its thick shoulder fur, arriving from two different directions, while the warrior lowers his bow and stares at it. Absolutely no blood, no injury detail, no gore. ${FULL} ${NEG}`, endRefs: [R.bo] },

  { id: "08-kirata-steps-out",
    start: `${LOOK} ${FULL} ${KI} He emerges from between mossy pine trunks at the edge of a forest clearing, his bamboo longbow lowered after taking a shot, mist and pale light behind him. In the near foreground the dark shape of a fallen boar lies still on the ground. ${HIM} Composition: medium-wide vertical, the hunter framed between the trees. Lighting: soft misty backlight. ${NEG}`,
    startRefs: [R.ki],
    end: `${EDIT} the hunter has walked further forward into the clearing toward the fallen boar, now fully lit so his Kirati embroidery, silver pendant and khukuri are clearly visible, his expression calm and confident. ${FULL} ${NEG}`, endRefs: [R.ki] },

  { id: "09-the-dispute",
    start: `${LOOK} ${FULL} ${AR} and ${KI} stand facing each other across a fallen boar in a Himalayan forest clearing, each gesturing down at it, each claiming the kill. Composition: medium-wide vertical, the two men on either side of frame, the boar on the ground between them. Lighting: dappled forest light. ${NEG}`,
    startRefs: [R.ar, R.ki],
    end: `${EDIT} the tension rises sharply — the warrior's hand moves to his bow and his jaw sets in anger, while the Kirata hunter stands utterly calm and unmoved, meeting his eyes levelly. ${FULL} ${NEG}`, endRefs: [] },

  { id: "10-the-duel",
    start: `${LOOK} ${FULL} A fierce archery duel in a Himalayan forest clearing between two men standing CLOSE together, only a few paces apart, both large in frame: on the left ${AR} draws his great longbow and looses an arrow at close range, his powerful warrior's body straining with effort; on the right ${KI} calmly deflects the incoming arrow with his bamboo longbow, utterly unshaken. Dust and dry leaves kick up around their feet. A contest of skill only, no injuries. ${HIM} Composition: dynamic medium vertical. Lighting: dappled forest light with swirling dust. ${NEG}`,
    startRefs: [R.ar, R.ki],
    end: `${EDIT} the warrior on the left has lost the exchange and is doubled over and spent, breathing hard with his longbow drooping loose in his hand and his knees buckling, while the Kirata hunter on the right stands calm and completely unmoved in exactly the same spot. Do not widen the shot, do not separate them, do not add a wooden staff. ${FULL} ${NEG}`, endRefs: [] },

  { id: "11-arjuna-defeated",
    start: `${LOOK} ${FULL} Close on a straight warrior's sword snapping cleanly in two in a dusty Himalayan forest clearing, the broken blade tumbling away through the air, a strong muscular hand wearing a gold armlet still gripping the useless hilt. No blood, no injury. Composition: close-medium vertical, the breaking sword central and large in frame. Lighting: a dusty shaft of forest light. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} pull back to reveal ${AR} kneeling spent on one knee on the churned forest floor, head lowered and chest heaving, the broken sword and his useless longbow lying beside him, while ${KI} stands calmly a few paces behind him, untouched. No blood, no injury. ${FULL} ${NEG}`, endRefs: [R.ar, R.ki] },

  { id: "12-clay-shivalinga",
    start: `${LOOK} ${FULL} Close on the strong muscular hands of ${AR}, gold armlet visible, working wet river clay upon a flat stone and shaping it into a smooth rounded sacred stone form, his lowered face visible above in complete concentration. ${HIM} Composition: close-medium vertical, hands and clay dominant, shallow depth of field. Lighting: soft overcast forest light. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} the clay form is now finished and smooth upon the flat stone, and the warrior has drawn back and knelt with palms joined in quiet prayer before it, with wild forest flowers and fallen leaves scattered around its base. ${FULL} ${NEG}`, endRefs: [R.ar] },

  { id: "13-garland-vanishes",
    start: `${LOOK} ${FULL} Close on the strong muscular hands of ${AR}, gold armlet visible, gently lowering a garland of orange marigolds and wild mountain flowers onto a smooth clay sacred stone form set on a flat rock in a forest clearing. Composition: close vertical, the garland and clay form dominant in frame. Lighting: soft warm forest light. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} the flower garland has completely vanished and the clay sacred stone form now sits entirely bare on the rock, while the hands remain outstretched just above it, frozen in confusion. Identical framing. ${FULL} ${NEG}`, endRefs: [] },

  { id: "14-garland-on-kirata",
    start: `${LOOK} ${FULL} ${AR} turns sharply to look back over his shoulder, his strong warrior's face caught mid-turn with a questioning expression, the misty Himalayan forest clearing behind him. ${HIM} Composition: close-medium vertical, over-the-shoulder framing. Lighting: soft forest light. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} reveal beyond his shoulder ${KI} standing calmly among the pines, and around the hunter's neck now hangs a garland of orange marigolds and wild mountain flowers catching a warm shaft of light, while the warrior's face in the foreground fills with dawning recognition and awe. ${FULL} ${NEG}`, endRefs: [R.ki, R.ar] },

  { id: "15-shiva-revealed",
    start: `${LOOK} ${FULL} ${KI} He stands among Himalayan pines wearing a garland of orange marigolds, and a soft warm radiance is beginning to gather and bloom around his outline, his form starting to shimmer as something greater emerges. ${HIM} Composition: medium-wide vertical, figure centered in the gathering light. Lighting: warm building radiance against forest shadow. ${NEG}`,
    startRefs: [R.ki],
    end: `${EDIT} the hunter's form has resolved into ${SH}, standing fully revealed in his true form in exactly the same spot with the marigold garland still about his neck, calm and immense, while ${AR} kneels prostrate on the forest floor before him with head bowed and palms joined. ${FULL} ${NEG}`, endRefs: [R.sh, R.ar] },

  { id: "16-pashupatastra-granted",
    start: `${LOOK} ${FULL} ${SH} He stands in a misty Himalayan forest clearing and extends one open hand toward ${AR}, who kneels before him, and above the deity's open palm a concentrated point of brilliant white-gold energy begins to form and coalesce. ${HIM} Composition: medium-wide vertical, the deity standing and the forming light central, the kneeling warrior below. Lighting: warm restrained divine radiance with a brilliant focal point. ${NEG}`,
    startRefs: [R.sh, R.ar],
    end: `${EDIT} the brilliant white-gold light has passed downward into the cupped raised hands of the kneeling warrior, who gazes up at it with awe on his upturned face, while the deity watches over him with a serene blessing expression. ${FULL} ${NEG}`, endRefs: [R.ar] },

  { id: "17-arjuna-wields-astra",
    start: `${LOOK} ${FULL} ${AR} He rises to his feet on a high Himalayan ridge at dawn, holding a newly granted divine weapon as a contained sphere of brilliant white-gold light in his cupped hands, his strong warrior's face lit from below by its radiance. ${HIM} Composition: medium-wide vertical, the rising figure central, snow peaks behind. Lighting: cold dawn with a brilliant warm light source in his hands. ${NEG}`,
    startRefs: [R.ar],
    end: `${EDIT} he now stands fully upright and resolute with the divine weapon blazing brilliantly in one raised hand, its light spilling across the snow peaks behind him, the dawn sky brighter and more golden, his face set with quiet power. ${FULL} ${NEG}`, endRefs: [] }
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
import { access } from "node:fs/promises";
async function exists(p){ try { await access(p); return true; } catch { return false; } }

async function gen(id, prompt, refPaths) {
  const parts = [{ text: prompt }];
  for (const p of refPaths) {
    const b = await readFile(p);
    parts.push({ inlineData: { mimeType: "image/png", data: b.toString("base64") } });
  }
  for (let a = 0; a < 8; a++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } }
      });
      const img = res.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      if (!img) { console.log(id, "NO IMAGE", JSON.stringify(res.promptFeedback || "unknown")); return false; }
      await writeFile(path.join(dir, `${id}.png`), Buffer.from(img.inlineData.data, "base64"));
      console.log(id, "OK");
      return true;
    } catch (e) {
      if (e.message.includes("RESOURCE_EXHAUSTED") && a < 7) { console.log(id, "rate limited, waiting..."); await sleep(45000); continue; }
      console.log(id, "FAIL", e.message.slice(0, 150));
      return false;
    }
  }
  return false;
}

for (const b of beats) {
  const startId = `${b.id}_start`;
  const startPath = path.join(dir, `${startId}.png`);
  if (await exists(startPath)) { console.log(startId, "skip (exists)"); }
  else { await gen(startId, b.start, b.startRefs); await sleep(12000); }
  const endPath = path.join(dir, `${b.id}_end.png`);
  if (await exists(endPath)) { console.log(`${b.id}_end`, "skip (exists)"); continue; }
  const endRefs = (await exists(startPath)) ? [startPath, ...b.endRefs] : b.endRefs;
  await gen(`${b.id}_end`, b.end, endRefs.slice(0, 3));
  await sleep(12000);
}
console.log("=== RESUME COMPLETE ===");
