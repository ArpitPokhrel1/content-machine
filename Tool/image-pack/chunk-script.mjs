// Split a script into 20-word chunks of five 4-word frame windows.
// Usage: node chunk-script.mjs <script.txt> [outDir]
// Writes <outDir>/words.txt (one word per line) and <outDir>/chunks.md (the chunk table to analyse).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const [scriptPath, outDir = path.dirname(scriptPath)] = process.argv.slice(2);
if (!scriptPath) { console.error("Usage: node chunk-script.mjs <script.txt> [outDir]"); process.exit(1); }

const words = readFileSync(scriptPath, "utf8").split(/\s+/).filter(Boolean);
const CHUNK = 20, WINDOW = 4;
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "words.txt"), words.join("\n") + "\n");

const lines = [`# Chunks\n`, `${words.length} words → ${Math.ceil(words.length / CHUNK)} chunks → ${Math.ceil(words.length / WINDOW)} frames\n`];
for (let c = 0; c * CHUNK < words.length; c++) {
  const chunk = words.slice(c * CHUNK, (c + 1) * CHUNK);
  lines.push(`\n## c${String(c + 1).padStart(2, "0")} (words ${c * CHUNK + 1}–${c * CHUNK + chunk.length})\n`, `${chunk.join(" ")}\n`);
  for (let f = 0; f * WINDOW < chunk.length; f++) {
    lines.push(`- c${String(c + 1).padStart(2, "0")}-${f + 1}: ${chunk.slice(f * WINDOW, (f + 1) * WINDOW).join(" ")}`);
  }
}
writeFileSync(path.join(outDir, "chunks.md"), lines.join("\n") + "\n");
console.log(`${words.length} words, ${Math.ceil(words.length / CHUNK)} chunks, ${Math.ceil(words.length / WINDOW)} frames → ${path.join(outDir, "chunks.md")}`);
