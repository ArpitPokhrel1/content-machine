// Optional audio runtime smoke test. No credentials, uploads or paid requests.
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const directory = mkdtempSync(path.join(tmpdir(), "content-audio-test-"));
const wav = Buffer.alloc(44+32000);
wav.write("RIFF",0);wav.writeUInt32LE(wav.length-8,4);wav.write("WAVEfmt ",8);
wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);
wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);
wav.write("data",36);wav.writeUInt32LE(32000,40);
const media = path.join(directory,"test.wav");writeFileSync(media,wav);
const client = new Client({name:"audio-selftest",version:"1.0.0"});
try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL("./server.mjs",import.meta.url))],env:{...process.env,CONTENT_MACHINE_OUTPUTS:directory}}));
  const result=await client.callTool({name:"recognize_subtitles",arguments:{script:"दानवीर कर्ण",media_path:media}});
  assert.ok(!result.isError,JSON.stringify(result));
  const estimate=JSON.parse(result.content.find(c=>c.type==="text").text);
  assert.equal(estimate.models[0].model,"@cf/openai/whisper-large-v3-turbo");
  assert.equal(estimate.models[0].estimated_usd,.000513/60);
  assert.match(estimate.note,/No upload made/);
  const legacy=await client.callTool({name:"make_subtitles",arguments:{script:"दानवीर कर्ण",duration_seconds:2}});
  assert.ok(!legacy.isError,JSON.stringify(legacy));
  console.log("MCP audio estimate and original make_subtitles: passed (no cloud calls)");
} finally {await client.close();rmSync(directory,{recursive:true,force:true});}
