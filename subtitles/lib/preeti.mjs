// Unicode Devanagari ⇄ Preeti (the legacy Nepali keyboard encoding shared by Preeti, Kantipur,
// Himalb and ~75 other "Preeti-type" fonts). Preeti text is plain Latin characters; it only looks
// like Nepali once a Preeti-type font is applied.
//
// Written for Content Machine. The character table was checked against the open mappings in
// casualsnek/npttf2utf (map.json), globalpolicy/UnicodeToPreeti (MIT) and
// RkJaiswal3/PreetiConverter (MIT); where they disagreed, npttf2utf's table was used.
//
// Rules that make Preeti different from a simple character swap:
//   ि (short i)      is typed BEFORE the whole consonant cluster:     स्थिति → l:ylt
//   र् (reph)        is typed AFTER the syllable and its vowel signs:  गर्नु  → ug'{
//   half consonants  have their own keys:                              न्त    → Gt
//   common conjuncts have single keys:                                 क्ष त्र ज्ञ श्र द्ध …

const VIRAMA = "्", I_MATRA = "ि", RA = "र", NUKTA = "़";

const FULL = {
  "क": "s", "ख": "v", "ग": "u", "घ": "3", "ङ": "ª", "च": "r", "छ": "5", "ज": "h", "झ": "´", "ञ": "`",
  "ट": "6", "ठ": "7", "ड": "8", "ढ": "9", "ण": "0f", "त": "t", "थ": "y", "द": "b", "ध": "w", "न": "g",
  "प": "k", "फ": "km", "ब": "a", "भ": "e", "म": "d", "य": "o", "र": "/", "ल": "n", "व": "j",
  "श": "z", "ष": "if", "स": ";", "ह": "x"
};
// Half (dead) forms that have their own key. Anything else is written full form + ्.
const HALF = {
  "क": "S", "ख": "V", "ग": "U", "घ": "£", "च": "R", "ज": "H", "झ": "‰", "ञ": "~", "ण": "0", "त": "T",
  "थ": "Y", "ध": "W", "न": "G", "प": "K", "फ": "ˆ", "ब": "A", "भ": "E", "म": "D", "ल": "N", "व": "J",
  "श": "Z", "ष": "i", "स": ":", "ह": "X"
};
// Consonant clusters with a single Preeti key (full form, and half form where one exists).
const CONJUNCT = [
  ["क्ष", "If", "I"], ["त्र", "q", null], ["त्त", "Q", "Œ"], ["ज्ञ", "1", "¡"], ["श्र", ">", null],
  ["द्द", "2", null], ["द्ध", "4", null], ["द्य", "B", null], ["द्व", "å", null], ["द्म", "ß", null],
  ["द्र", "›", null], ["ट्ट", "§", null], ["ट्ठ", "Ý", null], ["ठ्ठ", "¶", null], ["ड्ड", "•", null],
  ["ङ्क", "Í", null], ["ङ्ग", "Ë", null], ["ङ्ख", "Î", null], ["ङ्घ", "‹", null], ["न्न", "Ì", null],
  ["ह्र", "x|", null]
].sort((a, b) => b[0].length - a[0].length);
// Letters without a vertical stem take the "foot" rakar « instead of |.
const FOOT_RAKAR = new Set(["ट", "ठ", "ड", "ढ", "ङ", "छ"]);

const MATRA = { "ा": "f", "ी": "L", "ु": "'", "ू": '"', "ृ": "[", "े": "]", "ै": "}", "ो": "f]", "ौ": "f}", "ॅ": "‘" };
const MARK = { "ं": "+", "ँ": "F", "ः": "M" };
const VOWEL = { "अ": "c", "आ": "cf", "इ": "O", "ई": "O{", "उ": "p", "ऊ": "pm", "ऋ": "C", "ए": "P", "ऐ": "P]", "ओ": "cf]", "औ": "cf}" };
const OTHER = {
  "।": ".", "॥": "..", "ऽ": "˜", "ॐ": "ç",
  "०": ")", "१": "!", "२": "@", "३": "#", "४": "$", "५": "%", "६": "^", "७": "&", "८": "*", "९": "(",
  // ASCII digits in a Nepali script can only be shown as Nepali digits in a Preeti font.
  "0": ")", "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(",
  "(": "-", ")": "_", ".": "=", "?": "<", ",": ",", ":": "M", ";": "Ù", "!": "Û", "%": "Ü", "+": "±",
  "=": "Ö", "/": "÷", "×": "×", "“": "æ", "”": "Æ", "‘": "…", "’": "Ú", "-": " ", "–": " ", "—": " ",
  "‌": "", "‍": "", "﻿": ""
};

const isConsonant = ch => ch in FULL;
const isMatra = ch => ch in MATRA || ch === I_MATRA;

// Split a run of consonants (joined by virama) into Preeti pieces, left to right.
function renderCluster(cons, finalHalant) {
  let out = "";
  let i = 0;
  while (i < cons.length) {
    const last = i === cons.length - 1;
    // Rakar: consonant followed by र (as a subscript) → | or «.
    if (!last && cons[i + 1] === RA && i + 1 === cons.length - 1) {
      const pair = cons[i] + VIRAMA + RA;
      const c = CONJUNCT.find(([u]) => u === pair);
      if (c) { out += c[1]; i += 2; continue; }
      if (i > 0 || cons.length === 2) {
        out += FULL[cons[i]] + (FOOT_RAKAR.has(cons[i]) ? "«" : "|");
        i += 2;
        continue;
      }
    }
    // Longest single-key conjunct starting here.
    let matched = false;
    for (const [u, full, half] of CONJUNCT) {
      const parts = u.split(VIRAMA);
      if (parts.every((p, k) => cons[i + k] === p)) {
        const endsCluster = i + parts.length === cons.length;
        if (endsCluster) out += finalHalant && half ? half : full + (finalHalant ? "\\" : "");
        else out += half ?? full + "\\";
        i += parts.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const ch = cons[i];
    if (last) out += finalHalant ? (HALF[ch] ? FULL[ch] + "\\" : FULL[ch] + "\\") : FULL[ch];
    // ya-phala after a letter with no half form: full + Ø
    else if (cons[i + 1] === "य" && i + 1 === cons.length - 1 && !HALF[ch]) { out += FULL[ch] + "Ø"; i += 2; continue; }
    else out += HALF[ch] ?? FULL[ch] + "\\";
    i++;
  }
  return out;
}

export function unicodeToPreeti(input) {
  const s = [...String(input).normalize("NFC").replaceAll(NUKTA, "")];
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    // Reph: र + ् before a consonant belongs to the NEXT syllable, written after it.
    let reph = false;
    if (ch === RA && s[i + 1] === VIRAMA && isConsonant(s[i + 2] ?? "")) { reph = true; i += 2; }
    if (isConsonant(s[i] ?? "")) {
      const cons = [s[i]];
      let j = i + 1;
      while (s[j] === VIRAMA && isConsonant(s[j + 1] ?? "")) { cons.push(s[j + 1]); j += 2; }
      let finalHalant = false;
      if (s[j] === VIRAMA) { finalHalant = true; j++; }
      const signs = [];
      while (j < s.length && (isMatra(s[j]) || s[j] in MARK)) signs.push(s[j++]);
      let body;
      // रु / रू have their own keys.
      if (cons.length === 1 && cons[0] === RA && (signs[0] === "ु" || signs[0] === "ू")) {
        body = signs.shift() === "ु" ? "?" : "¿";
      } else body = renderCluster(cons, finalHalant);
      const iMatra = signs.includes(I_MATRA);
      const rest = signs.filter(m => m !== I_MATRA).map(m => MATRA[m] ?? MARK[m]).join("");
      out += (iMatra ? "l" : "") + body + rest + (reph ? "{" : "");
      i = j;
      continue;
    }
    if (reph) { out += "{"; continue; }
    if (ch in VOWEL) {
      out += VOWEL[ch];
      i++;
      while (s[i] in MARK) out += MARK[s[i++]];
      continue;
    }
    if (ch in MATRA) out += MATRA[ch];
    else if (ch === I_MATRA) out += "l";
    else if (ch in MARK) out += MARK[ch];
    else if (ch === VIRAMA) out += "\\";
    else if (ch in OTHER) out += OTHER[ch];
    else out += ch;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Preeti → Unicode: map every key, then repair the three reorderings (ि, reph, m-combinations).
const P2U = {
  "0": "ण्", "1": "ज्ञ", "2": "द्द", "3": "घ", "4": "द्ध", "5": "छ", "6": "ट", "7": "ठ", "8": "ड", "9": "ढ",
  "~": "ञ्", "!": "१", "@": "२", "#": "३", "$": "४", "%": "५", "^": "६", "&": "७", "*": "८", "(": "९", ")": "०",
  "_": ")", "+": "ं", "`": "ञ", "-": "(", "=": ".", "Q": "त्त", "W": "ध्", "E": "भ्", "R": "च्", "T": "त्",
  "Y": "थ्", "U": "ग्", "I": "क्ष्", "O": "इ", "P": "ए", "}": "ै", "|": "्र", "q": "त्र", "w": "ध", "e": "भ",
  "r": "च", "t": "त", "y": "थ", "u": "ग", "i": "ष्", "o": "य", "p": "उ", "[": "ृ", "]": "े", "\\": "्",
  "A": "ब्", "S": "क्", "D": "म्", "F": "ँ", "G": "न्", "H": "ज्", "J": "व्", "K": "प्", "L": "ी", ":": "स्",
  "\"": "ू", "a": "ब", "s": "क", "d": "म", "f": "ा", "g": "न", "h": "ज", "j": "व", "k": "प", "l": "ि",
  ";": "स", "'": "ु", "Z": "श्", "X": "ह्", "C": "ऋ", "V": "ख्", "B": "द्य", "N": "ल्", "M": "ः", "<": "?",
  ">": "श्र", "?": "रु", "z": "श", "x": "ह", "c": "अ", "v": "ख", "b": "द", "n": "ल", ",": ",", ".": "।",
  "/": "र", "{": "{", "m": "m", "„": "ध्र", "…": "‘", "ˆ": "फ्", "‰": "झ्", "‹": "ङ्घ", "‘": "ॅ", "•": "ड्ड",
  "˜": "ऽ", "›": "द्र", "¡": "ज्ञ्", "¢": "द्घ", "£": "घ्", "¤": "झ्", "¥": "्र", "§": "ट्ट", "©": "र",
  "ª": "ङ", "«": "्र", "°": "ङ्ढ", "±": "+", "´": "झ", "¶": "ठ्ठ", "¿": "रू", "Å": "हृ", "Æ": "”", "Ë": "ङ्ग",
  "Ì": "न्न", "Í": "ङ्क", "Î": "ङ्ख", "Ò": "¨", "Ö": "=", "×": "×", "Ø": "्य", "Ù": ";", "Ú": "’", "Û": "!",
  "Ü": "%", "Ý": "ट्ठ", "ß": "द्म", "å": "द्व", "æ": "“", "ç": "ॐ", "÷": "/", "Œ": "त्त्"
};
const SIGNS = "ािीुूृेैोौंःँॅ";

export function preetiToUnicode(input) {
  let u = [...String(input)].map(ch => P2U[ch] ?? ch).join("");
  // The ा stroke after a half letter completes it (0f = ण, if = ष, If = क्ष), it is not a matra.
  u = u.replace(/्ा/g, "");
  // m after a letter makes a different letter (प+m=फ, उ+m=ऊ, भ+m=झ, त्र+m=क्र, त्त+m=क्त).
  u = u.replace(/त्रm/g, "क्र").replace(/त्तm/g, "क्त").replace(/उm/g, "ऊ").replace(/भm/g, "झ").replace(/पm/g, "फ");
  u = u.replace(/इ\{/g, "ई").replace(/अा/g, "आ").replace(/आे/g, "ओ").replace(/आै/g, "औ").replace(/एे/g, "ऐ");
  // ि was typed before its cluster: move it after the cluster.
  u = u.replace(new RegExp(`ि((?:[क-ह]्)*[क-ह](?:्र)?)`, "g"), "$1ि");
  // Reph { was typed after the syllable and its signs: move र् in front of the syllable.
  u = u.replace(new RegExp(`((?:[क-ह]्)*[क-ह](?:्र)?[${SIGNS}ि]*)\\{`, "g"), "र्$1");
  u = u.replace(/\{/g, "र्");
  u = u.replace(/ाे/g, "ो").replace(/ाै/g, "ौ");
  u = u.replace(/m/g, "");
  return u.normalize("NFC");
}

// Latin letters can't be shown by a Preeti font: flag them so the editor can warn.
export function preetiUnsafe(unicodeText) {
  return /[A-Za-z]/.test(unicodeText);
}
