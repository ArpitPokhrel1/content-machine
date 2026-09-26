import { readFileSync, writeFileSync } from "node:fs";
import { GRADE, KANTIPUR, TIBET, NEG, C } from "./canon.mjs";

const words = readFileSync("words.txt", "utf8").trim().split(/\r?\n/);

// Character keys -> canon text and reference image
const R = {
  K: ["refs/ref-king.png", C.king], B: ["refs/ref-bhim.png", C.bhim], O: ["refs/ref-oldking.png", C.oldking],
  W: ["refs/ref-wife.png", C.wife], J: ["refs/ref-ojha-crop.png", C.ojha], N: ["refs/ref-naradev.png", C.naradev],
  M: ["refs/ref-maya-v2.png", C.maya]
};
const LINEUP = "refs/ref-courtiers-lineup.png";
const ENV = {
  court: "refs/env-durbar-courtyard.png", hall: "refs/env-throne-hall.png", arrest: "refs/env-arrest-chamber.png",
  valley: "refs/env-valley-v2.png", tibet: "refs/env-tibet.png", pass: "refs/env-pass.png"
};
const GHAT = "a riverside stone cremation ghat of the Kathmandu valley: wide worn stone steps down to a shallow grey river, a raised stone pyre platform, a small two-tiered pagoda shrine and only low old red brick houses beyond, no tall buildings";
const FEATHER = "a single long hawk feather, cream at the base and banded brown and grey toward the tip";
const GUARDS = "palace guards in plain white jama robes and white cloth turbans carrying long spears";
const SHROUD = "the body of Kaji Bhim Malla fully wrapped head to foot in a white cloth shroud strewn with orange marigolds, no face or skin visible";
const PYRE = "a tall funeral pyre of stacked split wood logs";

// [chars, env, framing+action]. chars: string of keys; "L" = the three courtiers via lineup ref.
const S = [
  // 01 — the curse from the burning pyre
  ["W", null, `medium close-up at dusk: the widow seated high on ${PYRE} at ${GHAT}, beside ${SHROUD}, her face lit orange from below by the first flames catching the base of the pyre, eyes fixed on the distant city, lips parted mid-word, right hand raised palm outward. Smoke drifts across the frame.`],
  ["W", null, `close-up of the widow's raised right hand, stacked gold bangles catching firelight, pointing out toward the city through rising smoke and orange glow; her face soft and out of focus behind it, the pagoda roofs of Kantipur a blur far beyond.`],
  ["", null, `wide shot from across the river at dusk: ${PYRE} ablaze on ${GHAT}, tall flames and a column of smoke rising into a darkening sky, a small red-clad seated figure barely visible through the smoke atop it; silhouettes of onlookers standing on the stone steps; the fire reflected in the water.`],
  ["", null, `night: sparks and ash from a distant funeral fire rising in a long plume over the tiered pagoda rooftops and carved brick palace of Kantipur, the sky deep blue-black, a faint orange glow at the bottom of the frame. No people.`],
  ["", "valley", `the Kathmandu valley at dawn: mist lying over terraced rice fields, a brick town of pagoda roofs in the middle distance, white Himalayan peaks at the top of the frame, a thin trail of old grey smoke hanging low over the town. No people.`],
  // 02 — the story begins
  ["", "valley", `the Kathmandu valley under a heavy brooding storm sky, dark clouds pressing down over the brick town, a single shaft of pale light falling on the gilded roofs of the palace temples. No people.`],
  ["", null, `${FEATHER} carried on the wind in sharp focus in the foreground, drifting over the brick rooftops, carved windows and gilded pagoda finials of Kantipur at golden hour, the town soft behind it. No people.`],
  ["", null, `close-up at dawn on a worn stone step of ${GHAT}: cold grey ash, a single broken gold bangle and a scatter of wilted orange marigold petals, the river blurred beyond. No people.`],
  ["", "court", `the palace main gateway of Kantipur at dusk: heavy carved wooden doors studded with brass standing half open, two stone lions flanking the arch, long shadows across the empty stone-paved courtyard, a cold wind stirring dust.`],
  ["KB", "court", `medium-wide shot in the palace courtyard at mid-morning: King Pratap Malla standing in front, chin raised, and Kaji Bhim Malla a half step behind at his right shoulder, both looking out across the courtyard as allies, the tiered pagoda temple behind them.`],
  // 03 — the father placed under arrest
  ["KB", null, `night, medium two-shot in a dim carved-wood palace corridor lit by one brass oil lamp: King Pratap Malla and Kaji Bhim Malla standing close, conferring in low voices, Bhim's hand resting on the hilt of his khukuri, both faces half in shadow.`],
  ["O", null, `the deposed old king Laxmi Narasimha Malla being escorted up a narrow red brick staircase inside the palace by two ${GUARDS}, his head bowed, one hand on the wall, lamplight from above.`],
  ["O", "arrest", `the deposed old king Laxmi Narasimha Malla sitting alone on a straw mat in a small bare brick room, gazing out through a carved wooden lattice window, thin bars of daylight falling across his face and beard.`],
  ["K", "hall", `King Pratap Malla seated on the carved wooden throne in the lamp-lit audience hall, one hand gripping the carved armrest, the other resting on his knee, courtiers bowing at the edges of the frame, holding power.`],
  ["B", "court", `Kaji Bhim Malla striding across the palace courtyard in the morning, soldiers and servants on either side stopping to bow as he passes, his bearing confident and open.`],
  // 04 — envy in the court; the Tibet mission
  ["KB", "hall", `in the lamp-lit audience hall, King Pratap Malla placing a gold-embroidered shawl of honour over the shoulders of Kaji Bhim Malla, who bows his head; a row of courtiers watches from the side.`],
  ["L", "hall", `three courtiers half hidden behind a carved sal-wood pillar in the lamp-lit audience hall, leaning together and whispering, their eyes turned toward the throne: Mahadev Ojha in white, Naradev in green, Maya Singh in indigo.`],
  ["JM", null, `close-up in lamplight: Mahadev Ojha's narrowed watchful eyes looking sideways, and Maya Singh just behind his shoulder with a tight clenched jaw, both staring at someone out of frame with envy.`],
  ["B", "court", `dawn: Kaji Bhim Malla on horseback at the head of a column of soldiers and porters with loads on their backs, riding out through the palace main gateway between the stone lions, heading north.`],
  ["L", null, `from inside a carved wooden window on an upper floor of the palace, three courtiers look down at a caravan leaving the courtyard below at dawn: Mahadev Ojha, Naradev and Maya Singh, their faces cold.`],
  // 05 — the three courtiers go to the king
  ["J", null, `Mahadev Ojha walking toward camera down a lamp-lit carved-wood palace corridor at night, rosary beads moving through his fingers, face set with purpose.`],
  ["NM", null, `Naradev and Maya Singh following side by side down a lamp-lit carved-wood palace corridor at night, Maya Singh's hand on his sword hilt, Naradev's thin face tense.`],
  ["LK", "hall", `the three courtiers Mahadev Ojha, Naradev and Maya Singh bowing low before King Pratap Malla, who sits on the carved throne in the lamp-lit audience hall looking down at them.`],
  ["JK", "hall", `Mahadev Ojha standing before the throne, speaking earnestly and gesturing northward with an open palm, while King Pratap Malla leans forward on the throne, listening.`],
  ["B", "tibet", `Kaji Bhim Malla on horseback on a rise above the barren brown Tibetan plateau, his soldiers around him, looking out over the conquered land and the whitewashed stone buildings below, hard midday light.`],
  // 06 — the lie; the king's rage
  ["B", null, `a hazy, smoke-veiled vision: Kaji Bhim Malla seated on a carved throne in a dim Tibetan hall with painted thangka scrolls and butter lamps, the whole image soft and dreamlike as if seen through incense smoke, an imagined scene.`],
  ["NMK", "hall", `Naradev and Maya Singh leaning in toward King Pratap Malla on the throne, nodding gravely as they add their words, the king's eyes moving between them, lamplight.`],
  ["JK", null, `extreme close-up: Mahadev Ojha's lips at King Pratap Malla's ear, whispering, the king's gold hoop earring and the side of his face in sharp focus, lamplight flickering.`],
  ["K", null, `close-up of King Pratap Malla's face darkening with suspicion, jaw tightening, eyes hardening, a brass oil lamp flame glowing behind him in the dark hall.`],
  ["K", "hall", `King Pratap Malla rising from his throne in fury, a red cushion knocked aside, a brass oil lamp flaring bright beside him, courtiers shrinking back at the edges of the frame.`],
  // 07 — the recall; Bhim in Tibet
  ["K", "hall", `King Pratap Malla standing and pointing sharply toward the doors of the audience hall, commanding, while a royal messenger in a dusty brown jama and cloth turban kneels before him.`],
  ["", null, `close-up of a scribe's hands in a lamp-lit palace room rolling a paper letter and tying it with red cord, a lump of red sealing wax and a brass seal beside it on a low wooden desk; the paper shows only faint decorative ink marks, unreadable.`],
  ["", "court", `a royal messenger in a dusty brown jama and cloth turban galloping on horseback out through the palace main gateway at dawn, dust rising behind the hooves, the stone lions on either side.`],
  ["B", "tibet", `Kaji Bhim Malla standing in a dusty Tibetan courtyard among whitewashed stone buildings, speaking with two senior Tibetan officials in maroon and gold brocade chuba robes and fur-trimmed hats, hard midday light.`],
  ["", "tibet", `Newar craftsmen in cloth turbans raising a red brick and carved timber trading house among the whitewashed Tibetan stone buildings of Lhasa, one team lifting a carved wooden window frame into place, bare brown mountains behind.`],
  // 08 — the treaty; the message; the happy return
  ["B", null, `inside a Tibetan hall lit by yak-butter lamps and hung with painted thangka scrolls, Kaji Bhim Malla and a senior Tibetan official in a maroon brocade chuba seated at a low carved table, pressing seals onto a paper treaty covered in faint unreadable ink marks.`],
  ["B", "tibet", `a dusty royal messenger in a brown jama kneeling in a Tibetan courtyard, holding up a rolled letter tied with red cord to Kaji Bhim Malla, who reaches for it.`],
  ["B", null, `medium close-up: Kaji Bhim Malla holding an unrolled letter, reading it, a warm smile beginning under his moustache; the page shows only faint unreadable ink marks; whitewashed Tibetan walls soft behind him.`],
  ["B", null, `close-up of Kaji Bhim Malla's proud, hopeful face turned south toward home, golden afternoon light on his skin, the bare Tibetan mountains out of focus behind him.`],
  ["B", "pass", `Kaji Bhim Malla riding at the head of his party down a narrow stone trail through a high Himalayan pass, patches of old snow, low cloud, his posture light and cheerful, heading home.`],
  // 09 — straight to the palace
  ["B", "valley", `Kaji Bhim Malla on horseback on a hillside trail at dusk, looking down at the Kathmandu valley and the brick town of pagoda roofs ahead, his party behind him.`],
  ["BW", null, `a narrow red brick lane in Kantipur at dusk: Kaji Bhim Malla riding straight past his own house without turning his head, while his wife watches him from a carved wooden window on the upper floor above, one hand on the lattice.`],
  ["B", "court", `Kaji Bhim Malla, still in his travelling shawl, striding eagerly through the palace main gateway between the two stone lions at dusk, a rolled treaty in his hand.`],
  ["K", "hall", `King Pratap Malla sitting cold and rigid on the carved throne in the lamp-lit audience hall, not looking up, his face hard, the hall emptied around him.`],
  ["KB", "hall", `Kaji Bhim Malla bowing before the throne and beginning to speak, holding out a rolled treaty, while King Pratap Malla raises one flat palm to silence him without listening.`],
  // 10 — the order at the gate (no blade shown); innocence discovered
  ["K", "hall", `King Pratap Malla's arm outstretched, pointing toward the palace gate in a cold command, ${GUARDS} stepping forward out of the shadows.`],
  ["B", "court", `two ${GUARDS} seizing Kaji Bhim Malla by both arms and marching him toward the palace main gateway at dusk, his face shocked and bewildered, his rolled treaty falling from his hand.`],
  ["", "court", `the palace main gateway at dusk with no people: a plain maroon cloth turban lying fallen and unwound on the stone threshold between the two stone lions, a rolled paper treaty beside it, long shadows.`],
  ["", "court", `the palace main gateway at night, empty and silent, a single brass oil lamp on the stone threshold guttering in the wind, the stone lions dark, the heavy doors shut.`],
  ["K", "hall", `King Pratap Malla alone in the dim audience hall at night, holding an unrolled treaty paper covered in faint unreadable ink marks, staring at it, his face draining as he realises.`],
  // 11 — remorse too late; the widow
  ["K", null, `close-up of King Pratap Malla's face in shock and dawning horror, eyes wide and wet, lit by a single oil lamp in the darkness.`],
  ["K", null, `King Pratap Malla kneeling alone before a small brass oil lamp in a dim palace shrine room, head bowed, palms pressed together, his jewelled turban set aside on the floor, in remorse.`],
  ["", null, `close-up of a single brass oil lamp in a dark palace hall, its flame shrinking to a last blue ember, a thin thread of smoke rising. No people.`],
  ["W", null, `in the brick courtyard of her home at dawn, the widow sits in mourning beside ${SHROUD} laid on a bamboo bier, her head covered, one hand resting on the shroud, women's hands at the edge of the frame.`],
  ["W", null, `a funeral procession at dusk moving toward ${GHAT}: men carrying ${SHROUD} on a bamboo bier on their shoulders, and the widow in her red sari walking steadily behind it, head covered.`],
  // 12 — the curse; she mounts the pyre
  ["W", null, `the widow standing at the foot of ${PYRE} on ${GHAT} at dusk, ${SHROUD} laid on top of it, her body turned toward the distant palace roofs of Kantipur, onlookers crowding the stone steps behind.`],
  ["W", null, `medium close-up of the widow at the pyre at dusk, her right arm raised and pointing toward the city, face fierce and unafraid, pronouncing a curse, her red sari lifting in the wind.`],
  ["", null, `onlookers in period Newar dress on the stone steps of ${GHAT} at dusk recoiling and covering their mouths in shock, faces lit by warm firelight from out of frame.`],
  ["W", null, `close-up of the widow's face at dusk, calm now, eyes closed, a single tear on her cheek, lit warm orange by firelight from below, smoke drifting past.`],
  ["W", null, `the widow climbing onto ${PYRE} on ${GHAT} at dusk and seated beside ${SHROUD}, gently lifting the shrouded head into her lap, the pyre not yet burning, onlookers blurred below.`],
  // 13 — she enters the fire; the story remembered in hard times
  ["", null, `wide shot from across the river at dusk: ${PYRE} fully ablaze on ${GHAT}, flames and thick smoke hiding everything on top of it, the glow reflected in the river, onlookers as silhouettes on the steps.`],
  ["", null, `a Kantipur street in the 1600s after an earthquake: a brick temple with its tiled roof collapsed, dust in the air, townspeople in period Newar dress clearing rubble with bare hands.`],
  ["", null, `the Kathmandu valley in the 1600s under a monsoon storm: flooded rice terraces, villagers in period dress carrying bundles on their backs along a muddy path, dark clouds low over the brick town.`],
  ["", "court", `the palace main gateway under a dark overcast sky, a garland of withered marigolds lying on the stone threshold between the stone lions, no people, a feeling of old injustice.`],
  ["", null, `night in a brick courtyard of Kantipur: an old man in period Newar dress telling a story to a group of children sitting close around a single clay oil lamp, their faces lit warm, listening intently.`],
  // 14 — call to action
  ["", null, `evening at a small stone shrine in a Kantipur courtyard: women in period Newar dress lighting rows of small clay oil lamps in remembrance, the flames warm against the dusk.`],
  ["", null, `close-up of stacked old manuscripts bound in faded red cloth on a carved wooden stand, some pages open showing only faded decorative ink marks, unreadable, warm lamplight.`],
  ["", null, `${FEATHER} lifting off an open old manuscript on a breeze and floating toward a carved wooden lattice window full of warm light.`],
  ["", null, `${FEATHER} riding the wind high over the tiered pagoda roofs and gilded finials of Kantipur at golden hour, sharp in the foreground, the town soft below.`],
  ["", "valley", `${FEATHER} small against the sky, flying toward the sunrise over the white Himalayan peaks above the misty Kathmandu valley, the brick town far below. Hopeful, open ending.`]
];

if (S.length !== 70) throw new Error(`expected 70 shots, got ${S.length}`);

const jobs = S.map(([chars, env, scene], i) => {
  const chunk = Math.floor(i / 5) + 1, part = (i % 5) + 1;
  const id = `c${String(chunk).padStart(2, "0")}-${part}`;
  const window = words.slice(i * 4, i * 4 + 4).join(" ");
  const keys = chars.split("");
  const refs = [], canon = [];
  for (const k of keys) {
    if (k === "L") { refs.push(LINEUP); canon.push(C.ojha, C.naradev, C.maya); }
    else { refs.push(R[k][0]); canon.push(R[k][1]); }
  }
  if (env && refs.length < 3) refs.push(ENV[env]);
  const tibetan = env === "tibet" || /Tibetan/.test(scene);
  const refLine = refs.length
    ? `Match the faces, builds and costumes of the named characters to the attached character reference photographs${env && refs.includes(ENV[env]) ? ", and the architecture to the attached location photograph" : ""}; take nothing else from them, not their poses or backgrounds.`
    : "";
  const prompt = `Create a vertical 9:16 cinematic frame, tall portrait composition filling the frame edge to edge: ${scene} ${refLine} ${GRADE} ${canon.join(" ")} ${tibetan ? TIBET : KANTIPUR} ${NEG}`.replace(/\s+/g, " ").trim();
  return { id, window, refs: refs.slice(0, 3), prompt };
});

writeFileSync("jobs-frames.json", JSON.stringify(jobs, null, 2));
console.log(jobs.length, "jobs; max prompt chars", Math.max(...jobs.map(j => j.prompt.length)), "; max refs", Math.max(...jobs.map(j => j.refs.length)));
