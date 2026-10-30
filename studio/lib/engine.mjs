// Bridges the cockpit to the three pipelines.
//   - subtitles: run in-process (free, deterministic) via the shared subtitle lib.
//   - images / video / maps: COMPOSE the exact Claude Code prompt + CLI line.
//     Video and map RENDER cost money / are irreversible, so the Studio never
//     triggers them — it hands the user a ready prompt and flags the gate.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SUBTITLES_DIR } from "./paths.mjs";
import { findPreset } from "./presets.mjs";

const ASPECTS = {
  "9:16": "vertical 9:16 (reel / short)",
  "4:5": "portrait 4:5 (feed)",
  "1:1": "square 1:1",
  "16:9": "wide 16:9 (landscape)"
};
const LANGS = { ne: "Nepali", hi: "Hindi", en: "English" };

export async function composePrompt({ pipeline, script = "", aspect = "9:16", language = "ne", seconds = 6, sensitive = "", styleId = "", motionId = "" } = {}) {
  const aspectLabel = ASPECTS[aspect] || aspect;
  const langLabel = LANGS[language] || language;
  const s = script.trim();
  const scriptBlock = s ? `\n\nSCRIPT:\n"""\n${s}\n"""` : "";
  const sens = sensitive.trim() ? `\n\nSensitive-content note: ${sensitive.trim()}` : "";
  const style = styleId ? await findPreset(styleId) : null;
  const motion = motionId ? await findPreset(motionId) : null;
  const styleLine = style ? `\n\nVisual style — ${style.name}: ${style.template}` : "";
  const motionLine = motion ? `\n\nCamera / motion — ${motion.name}: ${motion.template}` : "";

  if (pipeline === "subtitles") {
    return {
      gated: false,
      paid: false,
      claudePrompt: `Use content-machine make_subtitles for this ${langLabel} script, ${aspectLabel}. Time it to the voice-over length I give.${scriptBlock}`,
      cli: `node subtitles/cli.mjs script.txt --duration 1:35 --format srt -o episode.srt`,
      notes: ["Free and local. The Studio can build this SRT right here — see the Subtitles tab, or use the button below."]
    };
  }

  if (pipeline === "images") {
    return {
      gated: false,
      paid: true, // image generation bills Google a few cents/frame, but needs no explicit confirm gate
      claudePrompt: `Use content-machine to make a ${aspectLabel} image pack from this ${langLabel} script. Keep every character and location consistent across all frames (one frame per ~4 words). Pictures must contain no text, signs or numbers.${styleLine}${sens}${scriptBlock}`,
      cli: `# driven through Claude Code + the content-machine MCP (asset-generation/)`,
      notes: [
        "Images need no approval gate, but Google bills a few cents per frame.",
        "Paste the prompt into Claude Code; it reads the whole script, locks the cast, then generates in parallel."
      ]
    };
  }

  if (pipeline === "video") {
    return {
      gated: true,
      paid: true,
      claudePrompt: `Use content-machine to turn the approved frames of this ${langLabel} story into ${seconds}-second ${aspectLabel} video clips. Show me the exact clips, lengths and estimated cost first and wait for my yes. Generate one pilot clip, then the rest in parallel after it passes.${styleLine}${motionLine}${sens}${scriptBlock}`,
      cli: `# Veo render — gated: generate_videos needs confirm_paid_generation:true AFTER your explicit approval`,
      notes: [
        "⚠ Video costs real money and is gated. The Studio will NOT start it.",
        "In Claude Code you approve the exact clips, seconds and cost before anything renders."
      ]
    };
  }

  if (pipeline === "map") {
    return {
      gated: true,
      paid: false,
      claudePrompt: `Use content-machine to make an animated map for this story (real boundary data, not a generative model). Ask me the map scoping questions in one batch, then show the plan. Do not render until I approve the regions, admin levels, data sources and render time.${scriptBlock}`,
      cli: `node map-animation/agent-map.mjs   # map_render is gated: confirm_render:true only after approval`,
      notes: [
        "Maps are drawn from Natural Earth + geoBoundaries — deterministic, never AI-guessed.",
        "⚠ Render is gated. The Studio composes the plan prompt only."
      ]
    };
  }

  return { gated: false, paid: false, claudePrompt: "", cli: "", notes: ["Pick a pipeline."] };
}

// Run the free, deterministic subtitle builder in-process.
export async function makeSubtitlesLocal({ script = "", durationSeconds, format = "srt", encoding = "unicode", maxChars = 42, maxLines = 2 } = {}) {
  const s = String(script || "").trim();
  if (!s) throw new Error("Script is empty.");
  const total = Number(durationSeconds);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Give a valid length (seconds).");

  const mod = await import(pathToFileURL(path.join(SUBTITLES_DIR, "lib", "subtitles.mjs")).href);
  const cues = mod.makeCues(s, total, { maxChars: Number(maxChars), maxLines: Number(maxLines) });
  const text = mod.buildFile(cues, { format, encoding });
  return { text, cueCount: cues.length, format, encoding };
}
