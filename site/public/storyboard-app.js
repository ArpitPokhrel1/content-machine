const questions=[
  ["What are you making?","Film, reel, explainer, comic, cartoon, or something else?"],
  ["Who is it for?","Audience, platform, and viewing context."],
  ["What is the emotional arc?","Where should it begin and where should it land?"],
  ["What is the final image?","Describe the last frame you want the viewer to remember."],
  ["What is the visual motif?","An object, shape, color, or recurring detail."],
  ["Who or what must recur?","Characters, products, creatures, or anchor objects."],
  ["Where and when does it happen?","Region, era, architecture, season, and spaces."],
  ["How literal should it be?","Literal, symbolic, or a mix? Name any symbolic moments."],
  ["What visual style should it use?","Photography, illustration, ink, cel animation, etc."],
  ["What frame shape do you need?","9:16, 16:9, 1:1, page, or another aspect."],
  ["What must be avoided?","Cultural errors, sensitive imagery, text, brands, and past failures."],
  ["Which beats need motion?","What could become video later, and what should remain a still?"]
];
const ids=["title","format","script","characters","environments","style","constraints"];
const key="tarjun-storyboard-v1";
const state={title:"",format:"Storyboard",script:"",characters:"",environments:"",style:"",constraints:"",answers:Array(12).fill(""),frames:[]};
try{const saved=JSON.parse(localStorage.getItem(key)||"null");if(saved&&typeof saved==="object"){for(const k of ids)if(typeof saved[k]==="string")state[k]=saved[k];if(Array.isArray(saved.answers))state.answers=saved.answers.slice(0,12).map(v=>String(v??""));if(Array.isArray(saved.frames))state.frames=saved.frames.filter(f=>f&&typeof f==="object").map(f=>({...f}));}}catch{}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function save(){localStorage.setItem(key,JSON.stringify(state));$("#save-status").textContent="Saved in this browser";}
for(const id of ids){const el=$("#"+id);el.value=state[id];el.addEventListener("input",()=>{state[id]=el.value;save();if(id==="script")countWords();if(id==="title"||id==="script")preview();});}
$("#questions").innerHTML=questions.map(([title,hint],i)=>`<label class="field"><span><b>${String(i+1).padStart(2,"0")}</b> ${esc(title)}</span><small>${esc(hint)}</small><input data-answer="${i}" value="${esc(state.answers[i]||"")}" placeholder="Your answer"></label>`).join("");
document.querySelectorAll("[data-answer]").forEach(el=>el.addEventListener("input",()=>{state.answers[Number(el.dataset.answer)]=el.value;save();preview();}));
function countWords(){const count=state.script.trim()?state.script.trim().split(/\s+/u).length:0;$("#word-count").textContent=`${count} words`;}
countWords();
function tab(name){document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));document.querySelectorAll("[data-panel]").forEach(x=>x.classList.toggle("active",x.dataset.panel===name));if(name==="frames")renderFrames();if(name==="export")preview();window.scrollTo({top:0,behavior:"smooth"});}
document.querySelectorAll("[data-tab]").forEach(x=>x.addEventListener("click",()=>tab(x.dataset.tab)));
document.querySelectorAll("[data-next]").forEach(x=>x.addEventListener("click",()=>{if(x.dataset.next==="brief"&&!state.script.trim()){alert("Add your story first.");$("#script").focus();return;}tab(x.dataset.next);}));
function splitWords(script){return script.trim().split(/\s+/u).filter(Boolean);}
function draftFrames(){const words=splitWords(state.script);if(!words.length){alert("Add a story before building frames.");tab("story");return;}state.frames=[];for(let i=0;i<words.length;i+=4){const chunk=Math.floor(i/20)+1;const frame=Math.floor((i%20)/4)+1;const excerpt=words.slice(i,i+4).join(" ");const context=words.slice(Math.floor(i/20)*20,Math.floor(i/20)*20+20).join(" ");state.frames.push({id:`c${String(chunk).padStart(2,"0")}-${frame}`,excerpt,context,shot:"Medium",function:"Reveal",direction:""});}save();renderFrames();tab("frames");}
$("#make-frames").addEventListener("click",draftFrames);
$("#rebuild-frames").addEventListener("click",()=>{if(state.frames.some(f=>f.direction?.trim())&&!confirm("Rebuilding replaces your frame edits. Continue?"))return;draftFrames();});
function renderFrames(){const list=$("#frames-list");$("#frame-count").textContent=`${state.frames.length} frame${state.frames.length===1?"":"s"}`;if(!state.frames.length){list.innerHTML='<p class="empty-state">Build frames from the Canon tab to begin.</p>';return;}list.innerHTML=state.frames.map((f,i)=>`<article class="frame-card" data-frame="${i}"><header><span>FRAME ${esc(f.id)}</span><span>CHUNK ${String(Math.floor(i/5)+1).padStart(2,"0")}</span></header><blockquote lang="auto">“${esc(f.excerpt)}”</blockquote><p class="context">Context: ${esc(f.context)}</p><div class="frame-controls"><label class="field"><span>Shot</span><select data-field="shot">${["Wide","Medium","Close","Detail","Overhead","Point of view"].map(v=>`<option ${f.shot===v?"selected":""}>${v}</option>`).join("")}</select></label><label class="field"><span>Beat</span><select data-field="function">${["Establish","Reveal","Power","Pressure","Detail","Reaction","Shift","Impact","Aftermath","Exit"].map(v=>`<option ${f.function===v?"selected":""}>${v}</option>`).join("")}</select></label></div><label class="field"><span>Direct this frame</span><textarea data-field="direction" placeholder="Subject, action, foreground / middle / background, camera, light. Leave open if this beat needs a human decision.">${esc(f.direction||"")}</textarea></label></article>`).join("");list.querySelectorAll("[data-frame]").forEach(card=>card.querySelectorAll("[data-field]").forEach(el=>el.addEventListener("input",()=>{state.frames[Number(card.dataset.frame)][el.dataset.field]=el.value;save();preview();})));}
function master(){const brief=questions.map(([q],i)=>state.answers[i]?.trim()?`${q} ${state.answers[i].trim()}`:"").filter(Boolean).join("\n");return `TARJUN — MASTER IMAGE GENERATION PROMPT
Read the complete script before planning the images. Preserve asserted facts; list uncertain or implied visual details before accepting them. Never invent historical claims, named people, or cultural markers. Build one coherent visual sequence for a ${state.format.toLowerCase()}.

STORY
${state.script.trim()||"[Add a story]"}

VISUAL BRIEF
${brief||"[Brief not yet answered]"}

LOCKED CANON — paste these blocks verbatim into every relevant frame
SUBJECTS: ${state.characters.trim()||"[Define subjects and permanent features]"}
ENVIRONMENTS: ${state.environments.trim()||"[Define locations and period]"}
STYLE / GRADE: ${state.style.trim()||"[Define medium, palette and lighting]"}
CONTEXT / CONSTRAINTS: ${state.constraints.trim()||"[Add story constraints]"}

FRAME RULES
Each frame visualizes its own four-word excerpt inside its twenty-word context. Use the locked canon without rephrasing. State subject, action, foreground, middle ground, background, shot size and light. Let every beat change the emotion, advance action, or raise pressure. Fill the selected aspect edge to edge. No readable text, digits, captions, signage, lettering or logos unless explicitly requested. Review reference subjects and environments before full generation. Inspect every result; repair one visible defect per edit. These frames may be used as video keyframes, but video generation requires its own approval.`;}
function framePrompt(f){return `FRAME ${f.id} — ${f.function.toUpperCase()}
Excerpt: ${f.excerpt}
Twenty-word story context: ${f.context}
Shot: ${f.shot}
Subject canon: ${state.characters.trim()||"[Director must define recurring subjects]"}
Environment canon: ${state.environments.trim()||"[Director must define the location]"}
Visual style: ${state.style.trim()||"[Director must define the style]"}
Constraints: ${state.constraints.trim()||"Preserve stated facts; invent no historical or cultural details."}
Visual direction: ${f.direction?.trim()||"Interpret the excerpt in this context. Show one concrete action or image. For abstract language, use the recurring motif. Do not invent a new story event."}
Render one ${state.format.toLowerCase()} image for this frame only. State foreground, middle ground, background, and light. Maintain visual continuity. Fill the selected aspect edge to edge. No readable text, numbers, captions, signs, lettering, or logos unless requested.`;}
function pack(){return `# ${state.title.trim()||"Untitled storyboard"}

${master()}

## Frame prompts

${state.frames.map(f=>`### ${f.id} · ${f.function}

\`\`\`text
${framePrompt(f)}
\`\`\`
`).join("\n")}

## Local operator

Install Content Machine from https://tarjun.com/assets#install. Give this prompt pack to Codex or Claude Code in the local Content Machine repository and ask it to use the create-image-packs skill. Images need no video approval. Check all references and final frames visually. Paid video uses separate approval gates.
`;}
function preview(){const p=master();$("#prompt-preview").textContent=p;$("#prompt-status").textContent=`${state.frames.length} frames · ${state.frames.filter(f=>!f.direction?.trim()).length} need direction`;}
function download(name,body,type){const a=document.createElement("a");const url=URL.createObjectURL(new Blob([body],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function slug(){return (state.title.trim()||"storyboard").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"storyboard";}
function readyFrames(){if(!state.frames.length){alert("Build frames before exporting.");tab("canon");return false;}const long=state.frames.filter(f=>framePrompt(f).length>4000);if(long.length){alert(`${long.length} frame prompts exceed the local image operator's 4000-character limit. Shorten the canon or constraints.`);tab("canon");return false;}return true;}
$("#download-md").addEventListener("click",()=>{if(!readyFrames())return;download(`${slug()}-prompt-pack.md`,pack(),"text/markdown;charset=utf-8");});
$("#download-json").addEventListener("click",()=>download(`${slug()}-project.json`,JSON.stringify({version:1,...state},null,2),"application/json;charset=utf-8"));
$("#import-json").addEventListener("change",async e=>{const file=e.target.files?.[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(incoming.version!==1||typeof incoming.script!=="string"||!Array.isArray(incoming.frames))throw new Error("This is not a Tarjun project file.");if(state.script.trim()&&!confirm("Replace the current storyboard with this project?"))return;for(const id of ids){state[id]=typeof incoming[id]==="string"?incoming[id]:"";$("#"+id).value=state[id];}state.answers=Array.from({length:12},(_,i)=>String(incoming.answers?.[i]??""));document.querySelectorAll("[data-answer]").forEach(el=>el.value=state.answers[Number(el.dataset.answer)]);state.frames=incoming.frames.filter(f=>f&&typeof f.id==="string"&&typeof f.excerpt==="string").map(f=>({id:f.id,excerpt:f.excerpt,context:String(f.context??""),shot:String(f.shot??"Medium"),function:String(f.function??"Reveal"),direction:String(f.direction??"")}));save();countWords();renderFrames();preview();tab("frames");}catch(err){alert(err.message)}finally{e.target.value="";}});
$("#download-jobs").addEventListener("click",()=>{if(!readyFrames())return;const aspect=(state.answers[9]||"9:16").match(/9:16|16:9|1:1|4:5/)?.[0]||"9:16";const jobs=state.frames.map(f=>({id:f.id,aspect,prompt:framePrompt(f)}));download(`${slug()}-jobs.json`,JSON.stringify(jobs,null,2),"application/json;charset=utf-8");});
renderFrames();preview();
