// Name resolution + data-quality registry for region highlighting.
//
// A highlight video states "this shape is X" on screen, so a wrong label is a
// factual error. Two things are handled here: (1) friendly/alias names so a
// script can say "Koshi" instead of geoBoundaries' "Province 1", and (2) known,
// *measured* defects in specific upstream layers, which are refused rather than
// silently rendered.

export function normName(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(province|district|municipality|rural|metropolitan|sub-metropolitan)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

// Nepal's provinces (from OCHA's COD-AB, the current default source — see
// sceneBuilder.mjs) already carry their proper names (adm1_name: "Koshi",
// "Madhesh", ...), unlike geoBoundaries' NPL ADM1 which still has the
// pre-2018 placeholders "Province 1"/"Province 2". This table is now purely
// an *input* alias map — accepting old/alternate spellings a user or script
// might type — not a display-label override; the raw name is used as-is.
const NEPAL_ADM1_ALIASES = {
  Koshi: ["Province 1", "Koshi Pradesh", "Province No. 1", "Eastern"],
  Madhesh: ["Province 2", "Madhesh Pradesh", "Province No. 2", "Madhes"],
  Sudurpashchim: ["Sudurpaschim", "Far Western", "Sudur Paschim"]
};

// Historical note, kept for reference: geoBoundaries' NPL ADM2 was the
// pre-2017 75-district file (Nepal has 77), with duplicate "Bara"/"Saptari"
// labels (really Parsa/Siraha), no separate Rupandehi polygon, and Dailekh
// labelled Jajarkot. sceneBuilder.mjs no longer uses that source for Nepal —
// it routes ADM0-ADM3 through OCHA's COD-AB, which was verified (see
// MEMORY.md) to have exactly 77 correctly-labelled districts. This constant
// stays only in case a caller ever points loadGeoBoundaries at NPL ADM2
// directly, bypassing sceneBuilder's routing.
export const NEPAL_ADM2_ISSUE =
  "geoBoundaries' Nepal ADM2 layer is the pre-2017 75-district file (Nepal has 77) with mislabelled features: duplicate 'Bara' and 'Saptari' names (really Parsa and Siraha), no separate Rupandehi polygon, and Dailekh labelled Jajarkot. Use OCHA's COD-AB (sceneBuilder.mjs's default for Nepal) instead.";

export function applyDisplayNames(features, { iso3, level }) {
  return features.map((f) => {
    // NAME first: level-0 features get a display NAME stamped by the
    // builder. Then OCHA's adm{level}_name (Nepal), then geoBoundaries'
    // shapeName (other countries' ADM2/3, or Nepal via the legacy path),
    // then Natural Earth's name (ADM1 for non-Nepal countries).
    const raw = f.properties.NAME ?? f.properties[`adm${level}_name`] ?? f.properties.shapeName ?? f.properties.name ?? "";
    const aliases = iso3 === "NPL" && level === 1 ? NEPAL_ADM1_ALIASES[raw] || [] : [];
    // Only Nepal's units are provinces; other countries' level-1 units are states, regions, etc.
    const suffix = iso3 === "NPL" && level === 1 ? " Province" : "";
    const label = `${raw}${raw.endsWith("Province") ? "" : suffix}`;
    return { ...f, properties: { ...f.properties, __label: label, __rawName: raw, __aliases: [raw, label, ...aliases] } };
  });
}

// Resolve user-supplied names to feature indexes. Exact (normalised) match
// against label/raw/alias only — never substring, because "Bara" must not
// quietly match "Barahathawa". Ambiguous or unknown names throw with the
// available list so the caller can fix the manifest instead of getting a
// silently wrong highlight.
export function resolveNames(names, features) {
  const out = [];
  for (const name of names) {
    const key = normName(name);
    const hits = [];
    features.forEach((f, i) => {
      if (f.properties.__aliases.some((a) => normName(a) === key)) hits.push(i);
    });
    if (hits.length === 1) out.push(hits[0]);
    else {
      const available = features.map((f) => f.properties.__label).sort();
      const shown = available.length > 40 ? `${available.slice(0, 40).join(", ")} … (${available.length} total)` : available.join(", ");
      throw new Error(
        hits.length === 0 ? `Highlight name "${name}" matched no region. Available: ${shown}` : `Highlight name "${name}" matches ${hits.length} regions (ambiguous data). Available: ${shown}`
      );
    }
  }
  return out;
}
