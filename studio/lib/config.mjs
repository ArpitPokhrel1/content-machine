// Local, gitignored studio config: provider choices and API keys.
// Lives at studio/studio.config.local.json. Never committed.
import { readFile, writeFile } from "node:fs/promises";
import { CONFIG_FILE } from "./paths.mjs";

const DEFAULTS = {
  version: 1,
  providers: {
    // Naamche Labs — open-weight, self-hosted (HF / Colab). No hosted API.
    swar: { connected: false, endpoint: "", note: "" }, // NE/EN voice cloning
    kriti: { connected: false, endpoint: "", note: "" }, // NE speech-to-text
    // Generic TTS slot for Hindi/English (e.g. ElevenLabs, Google TTS, Azure).
    tts: { connected: false, provider: "", apiKey: "", note: "" }
  }
};

export async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULTS), parsed);
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export async function saveConfig(patch) {
  const current = await loadConfig();
  const next = deepMerge(current, patch || {});
  await writeFile(CONFIG_FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

// Redact secrets before sending config to the browser.
export function redact(config) {
  const copy = structuredClone(config);
  const tts = copy.providers?.tts;
  if (tts && tts.apiKey) tts.apiKey = "••••" + String(tts.apiKey).slice(-4);
  return copy;
}

function deepMerge(base, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      base[k] = deepMerge(base[k] && typeof base[k] === "object" ? base[k] : {}, v);
    } else {
      base[k] = v;
    }
  }
  return base;
}
