import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unicodeToPreeti, preetiToUnicode } from "../lib/preeti.mjs";

// Preeti spellings as typed on the Preeti keyboard.
const KNOWN = [
  ["नेपाल", "g]kfn"], ["नमस्ते", "gd:t]"], ["स्थिति", "l:ylt"], ["गर्नु", "ug'{"], ["वार्ता", "jftf{"],
  ["क्रम", "s|d"], ["प्रधानमन्त्री", "k|wfgdGqL"], ["ट्रक", "6«s"], ["विद्यालय", "ljBfno"], ["शिक्षा", "lzIff"],
  ["ज्ञान", "1fg"], ["श्री", ">L"], ["कार्यक्रम", "sfo{s|d"], ["धर्म", "wd{"], ["रुख", "?v"], ["रूप", "¿k"],
  ["राष्ट्र", "/fi6«"], ["सरकार", ";/sf/"], ["ऊर्जा", "pmhf{"], ["हिमाल", "lxdfn"], ["छैन", "5}g"],
  ["पुस्तक", "k':ts"], ["सत्य", ";To"], ["ईश्वर", "O{Zj/"], ["कीर्ति", "sLlt{"], ["उद्देश्य", "p2]Zo"],
  ["फूल", "km\"n"], ["झण्डा", "´08f"], ["कोठा", "sf]7f"], ["औषधि", "cf}ifl w".replace(" ", "")],
  ["१२३।", "!@#."], ["अँध्यारो", "cFWof/f]"], ["ओम", "cf]d"], ["ऐना", "P]gf"], ["गणेश", "u0f]z"]
];

test("known Unicode → Preeti spellings", () => {
  for (const [u, p] of KNOWN) assert.equal(unicodeToPreeti(u), p, u);
});

test("known Preeti → Unicode spellings", () => {
  for (const [u, p] of KNOWN) assert.equal(preetiToUnicode(p), u, p);
});

// Every Nepali word in the studio's real scripts must survive Unicode → Preeti → Unicode.
test("round-trip on real script vocabulary", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const outputs = path.resolve(here, "..", "..", "Outputs");
  const words = new Set();
  const collect = f => {
    for (const w of readFileSync(f, "utf8").split(/[\s।॥,.?!"“”‘’()\-–—:;'…]+/)) {
      if (/^[ऀ-ॿ]+$/.test(w) && !/[ऑॉॐ़ॠऌ]/.test(w)) words.add(w.normalize("NFC"));
    }
  };
  if (existsSync(outputs)) {
    for (const d of readdirSync(outputs)) {
      const f = path.join(outputs, d, "script.txt");
      if (existsSync(f)) collect(f);
    }
  }
  collect(path.join(here, "fixtures", "sample-ne.txt"));
  const failures = [...words].filter(w => preetiToUnicode(unicodeToPreeti(w)) !== w);
  assert.ok(words.size > 50, `too few words collected (${words.size})`);
  assert.deepEqual(failures.slice(0, 25).map(w => `${w} → ${unicodeToPreeti(w)} → ${preetiToUnicode(unicodeToPreeti(w))}`), []);
});
