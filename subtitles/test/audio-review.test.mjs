import test from "node:test";
import assert from "node:assert/strict";
import { parseAudioReview, buildAss } from "../lib/audio-review.mjs";
import { buildFile, parseFile, shift } from "../lib/subtitles.mjs";
const fixture = () => ({format:"content-machine-audio-review",version:1,script:"दानवीर कर्ण\nस्वर्ग पुगे।",model:"@cf/openai/whisper-large-v3-turbo",
  audio:{name:"test.wav",duration:4},defaultStrategy:"portrait",cost:{successful_list_estimate_usd:.0000342},
  strategies:{portrait:{cues:[{start:.66,end:1.76,text:"दानवीर कर्ण"},{start:2.14,end:3.5,text:"स्वर्ग पुगे।",needs_review:true,reason:["audible pause"],onset_adjustment_ms:340}]}}});

test("review import preserves script, exact onset corrections and review flags", () => {
  const data=parseAudioReview(JSON.stringify(fixture()));
  assert.equal(data.strategies.portrait.cues[1].start,2.14);
  assert.equal(data.strategies.portrait.cues[1].needs_review,true);
  assert.equal(data.script,"दानवीर कर्ण\nस्वर्ग पुगे।");
  assert.equal(data.cost,.0000342);
});

test("reject corrupt bundles before editor state can be replaced", () => {
  const bad = [
    f=>f.version=2,
    f=>f.audio.duration=Infinity,
    f=>f.strategies.portrait.cues[1].start=1,
    f=>f.strategies.portrait.cues[0].text="changed words",
    f=>f.strategies.portrait.cues[0].end=NaN,
    f=>f.strategies.portrait.cues[1].end=5,
    f=>f.defaultStrategy="missing",
    f=>f.strategies.constructor=f.strategies.portrait
  ];
  for (const change of bad) {const f=fixture();change(f);assert.throws(()=>parseAudioReview(f));}
});

test("editing shift survives Unicode/Preeti SRT and ASS exports", () => {
  const cues=shift(parseAudioReview(fixture()).strategies.portrait.cues,.1);
  for (const encoding of ["unicode","preeti"]) {
    const parsed=parseFile(buildFile(cues,{encoding}),{encoding});
    assert.equal(parsed[1].start,2.24);
    assert.equal(parsed[1].text,"स्वर्ग पुगे।");
  }
  const ass=buildAss(cues);
  assert.match(ass,/PlayResX: 1080\nPlayResY: 1920/);
  assert.match(ass,/0:00:02\.24/);
  assert.match(ass,/,96,140,350,1/);
});

test("ASS sanitizes style injection and respects size, color, position and shape", () => {
  const ass=buildAss([{start:59.999,end:61,text:"कर्ण {\\pos(1,1)}\nपुगे।"}],{aspect:"16:9",font:"Noto\nBad,Font",size:56,color:"#123456",position:"top"});
  assert.match(ass,/PlayResX: 1920\nPlayResY: 1080/);
  assert.match(ass,/Default,Noto Bad Font,56,&H00563412/);
  assert.match(ass,/Dialogue: 0,0:01:00\.00/);
  assert.ok(!ass.includes("{\\pos"));
});
