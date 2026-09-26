import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";
import { STUDIO_ROOT } from "./studioRoot.mjs";

const CACHE_DIR = path.join(STUDIO_ROOT, "data", "cache");
const USER_AGENT = "map-animation-studio/1.0 (internal tool; contact: internal@brihatech.com)";

// Sources are chosen for accuracy + a license that allows redistribution in
// rendered video output. GADM is deliberately NOT used here: its license
// forbids redistribution of derived products without permission.
export const SOURCES = {
  admin0: {
    url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson",
    attribution: "Natural Earth (public domain), ne_50m_admin_0_countries",
    cacheFile: "ne_50m_admin_0_countries.geojson"
  },
  admin1: {
    url: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson",
    attribution: "Natural Earth (public domain), ne_50m_admin_1_states_provinces",
    cacheFile: "ne_50m_admin_1_states_provinces.geojson"
  }
};

const CACHE_TTL_DAYS = 30;
let lastNominatimCallAt = 0;

async function ensureCacheDir() {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function isFresh(filePath, ttlDays) {
  try {
    const info = await stat(filePath);
    const ageDays = (Date.now() - info.mtimeMs) / 86_400_000;
    return ageDays < ttlDays;
  } catch {
    return false;
  }
}

async function fetchJsonCached(url, cacheFileName, { ttlDays = CACHE_TTL_DAYS } = {}) {
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, cacheFileName);
  if (await isFresh(cachePath, ttlDays)) {
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    // Fall back to a stale cache rather than failing outright, so a flaky
    // network doesn't block a render of data we already fetched once.
    try {
      return JSON.parse(await readFile(cachePath, "utf8"));
    } catch {
      throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }
  }
  const text = await response.text();
  await writeFile(cachePath, text, "utf8");
  return JSON.parse(text);
}

export async function loadAdmin0() {
  return fetchJsonCached(SOURCES.admin0.url, SOURCES.admin0.cacheFile);
}

export async function loadAdmin1() {
  return fetchJsonCached(SOURCES.admin1.url, SOURCES.admin1.cacheFile);
}

// geoBoundaries per-country, per-level (ADM1/ADM2/ADM3). Used when a request
// needs finer subdivisions (districts/counties) than Natural Earth ships.
export async function loadGeoBoundaries(iso3, level = "ADM2") {
  const upperIso3 = iso3.toUpperCase();
  const upperLevel = level.toUpperCase();
  const cacheFileName = `gb_${upperIso3}_${upperLevel}.geojson`;
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, cacheFileName);
  if (await isFresh(cachePath, CACHE_TTL_DAYS)) {
    return { geojson: JSON.parse(await readFile(cachePath, "utf8")), attribution: `geoBoundaries.org (${upperIso3} ${upperLevel})` };
  }
  const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${upperIso3}/${upperLevel}/`;
  const metaResponse = await fetch(metaUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!metaResponse.ok) throw new Error(`geoBoundaries has no ${upperLevel} data for ${upperIso3} (HTTP ${metaResponse.status}).`);
  const meta = await metaResponse.json();
  const downloadUrl = meta.gjDownloadURL;
  if (!downloadUrl) throw new Error(`geoBoundaries metadata for ${upperIso3} ${upperLevel} did not include a download URL.`);
  const gjResponse = await fetch(downloadUrl, { headers: { "User-Agent": USER_AGENT } });
  if (!gjResponse.ok) throw new Error(`Failed to download geoBoundaries geometry for ${upperIso3} ${upperLevel}.`);
  const text = await gjResponse.text();
  await writeFile(cachePath, text, "utf8");
  return {
    geojson: JSON.parse(text),
    attribution: `geoBoundaries.org (${upperIso3} ${upperLevel}), license: ${meta.boundaryLicense || "see geoBoundaries.org"}`
  };
}

// UN OCHA's Common Operational Dataset for Nepal — verified by direct
// inspection (see MEMORY.md) to be the correct, current, internally
// consistent source across ADM0-ADM3: exactly 77 districts with no
// duplicate/mislabelled names (unlike geoBoundaries' NPL ADM2, which is a
// pre-2017 75-district file with real defects — duplicate "Bara"/"Saptari",
// no Rupandehi polygon, Dailekh labelled Jajarkot), every level carries its
// parent pcode/name (adm1_name, adm2_name, ...), and it does not include
// Nepal's 2020 claimed Kalapani-Lipulekh-Limpiyadhura extension — it follows
// the boundary neutral/UN sources use, which is why it is internally
// consistent (no seam) where geoBoundaries' ADM0 (which does include the
// claim) disagreed with its own ADM1 by ~30km in that one corner.
const OCHA_NPL = {
  zipUrl:
    "https://data.humdata.org/dataset/07db728a-4f0f-4e98-8eb0-8fa9df61f01c/resource/dea34e50-37d5-4e36-98ae-2b7b1b4c43de/download/npl_admin_boundaries.geojson.zip",
  attribution: "OCHA Nepal Common Operational Dataset (cod-ab-npl, data.humdata.org), CC BY-IGO",
  entries: { 0: "npl_admin0.geojson", 1: "npl_admin1.geojson", 2: "npl_admin2.geojson", 3: "npl_admin3.geojson" }
};

// Reads one named entry out of a zip into memory and returns its bytes —
// deliberately not "extract to disk at the entry's own path", which is
// exactly the operation behind the symlink/path-traversal CVEs in common
// zip-extraction wrappers (e.g. extract-zip, GHSA-jmr9-qjv8-65gv). The
// caller writes the bytes to a cache path *it* chooses, so a crafted zip
// entry name/symlink can never influence what gets written where.
function readZipEntry(zipPath, entryName) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      let found = false;
      zipfile.on("error", reject);
      zipfile.on("entry", (entry) => {
        if (entry.fileName !== entryName) {
          zipfile.readEntry();
          return;
        }
        found = true;
        zipfile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr) return reject(streamErr);
          const chunks = [];
          readStream.on("data", (chunk) => chunks.push(chunk));
          readStream.on("error", reject);
          readStream.on("end", () => {
            zipfile.close();
            resolve(Buffer.concat(chunks));
          });
        });
      });
      zipfile.on("end", () => {
        if (!found) reject(new Error(`Zip entry "${entryName}" not found in ${zipPath}.`));
      });
      zipfile.readEntry();
    });
  });
}

// Nepal administrative boundaries (0=country, 1=province, 2=district,
// 3=municipality) from OCHA's COD-AB. All four levels ship in one zip, so
// the zip itself is cached once and each level is cached individually after
// being read out of it.
export async function loadNepalOcha(level) {
  const entryName = OCHA_NPL.entries[level];
  if (!entryName) throw new Error(`No OCHA Nepal boundary level ${level}. Use 0 (country), 1 (province), 2 (district), or 3 (municipality).`);
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `ocha_npl_admin${level}.geojson`);
  if (await isFresh(cachePath, CACHE_TTL_DAYS)) {
    return { geojson: JSON.parse(await readFile(cachePath, "utf8")), attribution: OCHA_NPL.attribution };
  }
  const zipCachePath = path.join(CACHE_DIR, "ocha_npl_admin_boundaries.zip");
  if (!(await isFresh(zipCachePath, CACHE_TTL_DAYS))) {
    const response = await fetch(OCHA_NPL.zipUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Failed to download OCHA Nepal boundaries: HTTP ${response.status}`);
    await writeFile(zipCachePath, Buffer.from(await response.arrayBuffer()));
  }
  const buffer = await readZipEntry(zipCachePath, entryName);
  await writeFile(cachePath, buffer);
  return { geojson: JSON.parse(buffer.toString("utf8")), attribution: OCHA_NPL.attribution };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// Natural Earth flags contested geometry via ADM0 fields. We surface it as a
// simple boolean rather than silently rendering a fully solid border, per the
// project's disputed-territory policy (see PROMPT_MAP_ANIMATION.md).
export function isDisputedFeature(properties) {
  const type = normalize(properties.TYPE);
  return type.includes("disputed") || type.includes("indeterminate") || normalize(properties.BRK_NAME) !== normalize(properties.NAME);
}

export async function findCountry(query) {
  const q = normalize(query);
  const data = await loadAdmin0();
  // Exact matches on name/ISO fields always win. Substring matching is only
  // a fallback for partial names, and it must run as its own pass — a
  // single combined predicate lets an unrelated feature whose name merely
  // *contains* the query (e.g. "Br. Indian Ocean Ter." contains "india")
  // shadow the real exact match if it happens to sit earlier in the array.
  const exact = data.features.find((feature) => {
    const properties = feature.properties;
    return (
      normalize(properties.NAME) === q ||
      normalize(properties.NAME_LONG) === q ||
      normalize(properties.ADM0_A3) === q ||
      normalize(properties.ISO_A3) === q ||
      normalize(properties.ISO_A2) === q
    );
  });
  const match = exact || data.features.find((feature) => normalize(feature.properties.NAME).includes(q) || normalize(feature.properties.NAME_LONG).includes(q));
  if (!match) throw new Error(`No country matched "${query}" in Natural Earth admin-0 data.`);
  return {
    feature: match,
    iso3: match.properties.ADM0_A3 || match.properties.ISO_A3,
    name: match.properties.NAME,
    disputed: isDisputedFeature(match.properties)
  };
}

export async function findAdmin1(query, iso3) {
  const q = normalize(query);
  const data = await loadAdmin1();
  const candidates = iso3 ? data.features.filter((f) => normalize(f.properties.adm0_a3) === normalize(iso3)) : data.features;
  const match = candidates.find((feature) => {
    const properties = feature.properties;
    return normalize(properties.name) === q || normalize(properties.name).includes(q) || normalize(properties.name_alt).includes(q);
  });
  if (!match) throw new Error(`No admin-1 region matched "${query}"${iso3 ? ` within ${iso3}` : ""}.`);
  return { feature: match, name: match.properties.name };
}

// Nominatim usage policy requires a descriptive User-Agent and caps at
// roughly 1 request/second. We cache every lookup to disk so a re-run of the
// same project never re-hits the network for a name we already resolved.
export async function geocode(query) {
  await ensureCacheDir();
  const cacheFileName = `geocode_${normalize(query).replace(/[^a-z0-9]+/g, "_")}.json`;
  const cachePath = path.join(CACHE_DIR, cacheFileName);
  if (await isFresh(cachePath, 180)) {
    return JSON.parse(await readFile(cachePath, "utf8"));
  }
  const wait = 1100 - (Date.now() - lastNominatimCallAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimCallAt = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: "geojson", limit: "1" })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Nominatim lookup failed for "${query}": HTTP ${response.status}`);
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) throw new Error(`No geocoding result for "${query}".`);
  const result = { query, lon: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1], displayName: feature.properties.display_name };
  await writeFile(cachePath, JSON.stringify(result), "utf8");
  return result;
}

export { CACHE_DIR };
