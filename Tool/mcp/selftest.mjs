// Free end-to-end check of the MCP server over stdio: lists tools and runs the non-billing ones
// against a throwaway outputs folder. Usage: node mcp/selftest.mjs [outputsDir]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outputs = process.argv[2] || mkdtempSync(path.join(os.tmpdir(), "cm-selftest-"));
const client = new Client({ name: "selftest", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, "server.mjs")], env: { ...process.env, CONTENT_MACHINE_OUTPUTS: outputs } }));
const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.find(c => c.type === "text")?.text || "";
  if (r.isError) throw new Error(`${name}: ${t}`);
  return t;
};
const { tools } = await client.listTools();
console.log("tools:", tools.map(t => t.name).join(", "));
console.log("health:", JSON.parse(await call("health")).note);
console.log("guide bytes:", (await call("read_guide", { name: "mcp-workflow" })).length);
const created = JSON.parse(await call("create_pack", { title: "Selftest Pack", script: Array.from({ length: 12 }, (_, i) => `word${i + 1}`).join(" ") }));
const pack = created.pack;
console.log("pack:", pack);
await call("write_pack_file", { pack, file: "canon.mjs", content: readFileSync(path.join(here, "..", "image-pack", "templates", "canon.template.mjs"), "utf8") });
await call("write_pack_file", { pack, file: "shots/c01.json", content: JSON.stringify([1, 2, 3].map(n => ({ id: `c01-${n}`, chars: ["K"], env: "court", scene: "medium shot of King Pratap Malla crossing the courtyard at mid-morning, guards bowing at the edges" }))) });
console.log("check:", await call("build_prompts", { pack, stage: "frames", check: true }));
console.log("refs:", await call("build_prompts", { pack, stage: "refs" }));
for (const bad of [["write_pack_file", { pack, file: "../evil.txt", content: "x" }], ["read_pack_file", { pack, file: "../../x" }], ["generate_videos", { pack, confirm_paid_generation: false }]]) {
  const r = await client.callTool({ name: bad[0], arguments: bad[1] });
  console.log(`refused ${bad[0]}:`, Boolean(r.isError));
}
await client.close();
console.log("selftest OK →", outputs);
