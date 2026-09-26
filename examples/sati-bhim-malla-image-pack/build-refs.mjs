import { writeFileSync } from "node:fs";
import { GRADE, KANTIPUR, TIBET, NEG, C } from "./canon.mjs";

const ref = (id, who) => ({ id: `ref-${id}`, prompt: `Create a vertical 9:16 full-body character reference photograph of one person standing in a relaxed neutral pose, turned three-quarters to the camera, the whole figure visible from head to feet, against a plain seamless warm-grey studio backdrop in soft even light. Only this one person in the frame. ${who} ${GRADE} ${KANTIPUR} ${NEG}` });
const env = (id, scene, anchor) => ({ id: `env-${id}`, prompt: `Create a vertical 9:16 establishing photograph with no people in it: ${scene} Tall vertical portrait composition that fills the frame edge to edge. ${GRADE} ${anchor} ${NEG}` });

const jobs = [
  ...Object.entries(C).map(([k, v]) => ref(k, v)),
  env("durbar-courtyard", "the royal palace courtyard of Kantipur at mid-morning, a stone-paved square enclosed by three-storey red brick palace wings with rows of carved dark wooden windows, a tall three-tiered pagoda temple with gilded copper roof finials rising behind, and on the near side the palace main gateway: a deep brick arch with heavy carved wooden doors studded with brass, flanked by two stone lions. Soft hazy sunlight from the left.", KANTIPUR),
  env("throne-hall", "the interior of the palace audience hall of Kantipur at night, a long dim room of carved dark sal-wood pillars and beams, a low raised dais at the far end with a carved wooden throne seat, red and gold cushions and a canopy, brass oil lamps on tall stands throwing warm pools of amber light, carved lattice windows black against the night.", KANTIPUR),
  env("arrest-chamber", "a small bare upper-floor room inside the palace, old red brick walls, a low wooden ceiling, a single straw mat and a brass water pot on a packed-earth floor, one carved wooden lattice window casting a pattern of thin light bars across the floor, dust in the air.", KANTIPUR),
  env("valley", "the Kathmandu valley in the 1600s seen from a hillside at dawn: green terraced rice fields stepping down into morning mist, a dense brick town of pagoda temple roofs rising from the mist in the middle distance, and far beyond, a line of white Himalayan snow peaks along the top of the frame.", KANTIPUR),
  env("tibet", "the edge of Lhasa on the high Tibetan plateau under hard midday light: whitewashed stone buildings with inward-sloping walls and black trapezoid window frames, flat roofs, a dusty open square, bare brown mountains close behind, thin dry air.", TIBET),
  env("pass", "a narrow stone trail climbing through a high Himalayan pass between Tibet and Nepal, rocky slopes, patches of old snow, stunted juniper, low cloud drifting over a ridge, the trail winding down toward distant green hills.", "Specifically the Nepal-Tibet Himalaya, NOT the Alps, NOT the Andes, NOT a paved road."),
  env("ghat", "a riverside stone cremation ghat in the Kathmandu valley at dusk: wide worn stone steps descending to a shallow grey river, a raised stone platform on the bank with a neatly stacked unlit pyre of split wood logs, a small brick shrine with a pagoda roof behind, smoke haze over the water, the sky dim orange.", KANTIPUR)
];

writeFileSync("jobs-refs.json", JSON.stringify(jobs, null, 2));
console.log(jobs.length, "jobs; max prompt chars", Math.max(...jobs.map(j => j.prompt.length)));
