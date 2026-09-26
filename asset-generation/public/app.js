const $ = selector => document.querySelector(selector);
let projectId = null;
let plan = null;
let pollTimer = null;

function showError(selector, message) {
  const box = $(selector); box.textContent = message; box.hidden = !message;
}

function activate(step) {
  document.querySelectorAll(".step").forEach((item, index) => {
    item.classList.toggle("active", index + 1 === step);
    if (index + 1 <= step) item.disabled = false;
  });
}

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function health() {
  try {
    const data = await request("/api/health");
    const el = $("#apiState");
    el.className = `api-state ${data.ready ? "ready" : "bad"}`;
    el.querySelector("span").textContent = data.ready ? "API configured" : "API key missing";
  } catch { $("#apiState").className = "api-state bad"; $("#apiState span").textContent = "Server unavailable"; }
}

$("#sourceForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  showError("#sourceError", "");
  button.disabled = true; button.firstChild.textContent = "Drafting prompts ";
  try {
    const data = await request("/api/prompts", { method: "POST", body: JSON.stringify({
      context: $("#context").value, script: $("#script").value, instructions: $("#instructions").value,
      aspectRatio: $("#aspectRatio").value, duration: Number($("#duration").value),
      maxScenes: Number($("#maxScenes").value), audio: $("#audio").checked
    }) });
    projectId = data.projectId; plan = data.plan; renderReview();
  } catch (error) { showError("#sourceError", error.message); }
  finally { button.disabled = false; button.firstChild.textContent = "Draft video prompts "; }
});

function renderReview() {
  $("#sourceForm").hidden = true; $("#reviewPanel").hidden = false; activate(2);
  $("#bible").innerHTML = `<h3>Visual bible</h3><p>${escapeHtml(plan.visual_bible)}</p>`;
  $("#sceneList").innerHTML = plan.scenes.map(scene => `<article class="scene">
    <input type="checkbox" data-approve="${scene.scene_id}" checked aria-label="Approve ${scene.scene_id}">
    <div><div class="scene-top"><h3>${scene.scene_id}</h3><p>${scene.duration_seconds}s · ${scene.aspect_ratio} · ${scene.audio ? "audio" : "silent"}</p></div>
    <textarea data-prompt="${scene.scene_id}" aria-label="Prompt for ${scene.scene_id}">${escapeHtml(scene.prompt)}</textarea>
    <small>${escapeHtml(scene.source_excerpt)}</small>
    <div class="asset-box" data-assets-for="${scene.scene_id}" data-duration="${scene.duration_seconds}">
      <div class="asset-head"><div><b>Reference subject assets</b><small>Optional · PNG/JPEG · up to 3 views of the same subject</small></div><label class="asset-pick">Add images<input type="file" accept="image/png,image/jpeg" multiple></label></div>
      <p>References control identity across the clip. Timing describes approximately when the subject should appear; it is not frame-exact.</p>
      <div class="asset-rows"></div>
    </div></div></article>`).join("");
  document.querySelectorAll("[data-approve]").forEach(el => el.addEventListener("change", updateCount));
  document.querySelectorAll(".asset-box input[type=file]").forEach(input => input.addEventListener("change", renderAssetRows));
  updateCount(); window.scrollTo({ top: $("#reviewPanel").offsetTop, behavior: "smooth" });
}

function updateCount() {
  const count = document.querySelectorAll("[data-approve]:checked").length;
  $("#approvalCount").textContent = `${count} scene${count === 1 ? "" : "s"} selected. Each selection creates one paid Veo request.`;
  $("#generateButton").disabled = count === 0;
}

$("#generateButton").addEventListener("click", async () => {
  showError("#reviewError", "");
  const ids = [...document.querySelectorAll("[data-approve]:checked")].map(el => el.dataset.approve);
  plan.scenes.forEach(scene => { scene.prompt = document.querySelector(`[data-prompt="${scene.scene_id}"]`).value.trim(); });
  const prompts = Object.fromEntries(plan.scenes.filter(scene => ids.includes(scene.scene_id)).map(scene => [scene.scene_id, scene.prompt]));
  let assets;
  try { assets = await collectAssets(ids); }
  catch (error) { showError("#reviewError", error.message); return; }
  const assetCount = Object.values(assets).reduce((total, items) => total + items.length, 0);
  if (!confirm(`Generate ${ids.length} video${ids.length === 1 ? "" : "s"} with ${assetCount} reference asset${assetCount === 1 ? "" : "s"}? This will use paid Veo credits and cannot be undone.`)) return;
  $("#generateButton").disabled = true;
  try {
    const status = await request(`/api/projects/${projectId}/generate`, { method: "POST", body: JSON.stringify({ sceneIds: ids, prompts, assets }) });
    $("#reviewPanel").hidden = true; $("#progressPanel").hidden = false; activate(3); renderProgress(status); poll();
  } catch (error) { showError("#reviewError", error.message); $("#generateButton").disabled = false; }
});

function renderAssetRows(event) {
  const box = event.target.closest(".asset-box");
  const files = [...event.target.files].slice(0, 3);
  if (event.target.files.length > 3) showError("#reviewError", "Only the first three reference images will be used.");
  box.querySelector(".asset-rows").innerHTML = files.map((file, index) => `<div class="asset-row" data-asset-index="${index}">
    <div class="asset-name"><b>${escapeHtml(file.name)}</b><small>${(file.size / 1048576).toFixed(1)} MB</small></div>
    <label><span>Use as</span><select data-mode><option value="subject_reference">Subject reference</option><option value="logo_start_frame">Logo/source first frame</option></select></label>
    <label><span>Story role</span><input data-role value="Preserve this subject's exact appearance when visible."></label>
    <label><span>From second</span><input data-start type="number" min="0" max="${box.dataset.duration}" step="0.5" value="0"></label>
    <label><span>To second</span><input data-end type="number" min="0" max="${box.dataset.duration}" step="0.5" value="${box.dataset.duration}"></label>
  </div>`).join("");
}

async function collectAssets(sceneIds) {
  const result = {};
  for (const id of sceneIds) {
    const box = document.querySelector(`[data-assets-for="${id}"]`);
    const files = [...box.querySelector("input[type=file]").files].slice(0, 3);
    if (!files.length) continue;
    result[id] = [];
    for (const [index, file] of files.entries()) {
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error(`${file.name} must be a PNG or JPEG no larger than 10 MB.`);
      const row = box.querySelector(`[data-asset-index="${index}"]`);
      result[id].push({
        name: file.name, mimeType: file.type, base64: await fileToBase64(file),
        mode: row.querySelector("[data-mode]").value,
        role: row.querySelector("[data-role]").value,
        startSecond: Number(row.querySelector("[data-start]").value),
        endSecond: Number(row.querySelector("[data-end]").value)
      });
    }
  }
  return result;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function renderProgress(status) {
  $("#progressList").innerHTML = Object.entries(status.scenes).map(([id, item]) => `<div class="progress-item ${item.status}">
    <b>${id}</b><div><div class="bar"><i></i></div><div class="status">${escapeHtml(item.error || item.status)}</div></div>
    ${item.status === "completed" ? `<a class="download" href="/api/projects/${projectId}/files/${id}">Open MP4</a>` : ""}</div>`).join("");
  $("#outputPath").textContent = `Saved in: output/${projectId}/`;
}

async function poll() {
  try {
    const status = await request(`/api/projects/${projectId}`); renderProgress(status);
    if (["completed", "completed_with_errors"].includes(status.state)) return;
    pollTimer = setTimeout(poll, 5000);
  } catch { pollTimer = setTimeout(poll, 8000); }
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

health();
