// Single-call image and video generation shared by server.mjs and the image-pack runners.
// Nothing in here loops on failure; callers decide (with the user) whether to call again.
import { spawn } from "node:child_process";
import { access, writeFile } from "node:fs/promises";
import { config, genai } from "./config.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Veo only supports 1080p on 16:9; every other aspect ratio is capped at 720p.
export function resolutionFor(aspectRatio, override) {
  const requested = override || config.videoResolution;
  if (requested === "1080p" && aspectRatio !== "16:9") return "720p";
  return requested;
}

// Returns { data } with base64 image bytes, or { data: null, finishReason, promptFeedback } when
// the model answered without an image, so a safety block (promptFeedback.blockReason) can be told
// apart from a transient empty response.
export async function generateImage(ai, { model = config.imageModel, prompt, aspectRatio = "9:16", referenceImages = [] }) {
  if (model.startsWith("imagen")) {
    const response = await ai.models.generateImages({ model, prompt, config: { numberOfImages: 1, aspectRatio } });
    return { data: response.generatedImages?.[0]?.image?.imageBytes || null, finishReason: response.generatedImages?.[0]?.raiFilteredReason };
  }
  const parts = [{ text: prompt }, ...referenceImages.slice(0, 3).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.base64 } }))];
  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } }
  });
  const candidate = response.candidates?.[0];
  const image = candidate?.content?.parts?.find(part => part.inlineData);
  return { data: image?.inlineData.data || null, finishReason: candidate?.finishReason, promptFeedback: response.promptFeedback };
}

async function downloadFromGcs(uri, target) {
  if (!/^gs:\/\/[a-z0-9._-]+\/[A-Za-z0-9._/-]+$/.test(uri || "")) throw new Error("Veo returned an invalid Cloud Storage URI.");
  await new Promise((resolve, reject) => {
    // On Windows spawn runs through a shell, which re-splits arguments on spaces.
    // Quote both operands so paths like "Content Machine\output" survive intact.
    const useShell = process.platform === "win32";
    const args = useShell ? ["storage", "cp", `"${uri}"`, `"${target}"`] : ["storage", "cp", uri, target];
    const copy = spawn(config.gcloud, args, { windowsHide: true, shell: useShell });
    let stderr = "";
    copy.stderr.on("data", chunk => { stderr += chunk.toString(); });
    copy.on("error", reject);
    copy.on("close", code => code === 0 ? resolve() : reject(new Error(`Cloud Storage download failed: ${stderr.slice(0, 300)}`)));
  });
}

const asImage = img => img ? { imageBytes: img.base64, mimeType: img.mimeType } : undefined;

// Generate one clip and save it to `target`. `gcsPath` names the clip's folder in the bucket.
export async function generateVideoFile({
  prompt, image, lastFrame, referenceImages = [], duration = 6, aspectRatio = "16:9", audio = false,
  resolution, model = config.videoModel, gcsPath, target, onOperation
}) {
  if (lastFrame && !image) throw new Error("An end frame requires a start frame too.");
  const ai = genai();
  const useBucket = config.mode === "vertex" && Boolean(config.bucket);
  let operation = await ai.models.generateVideos({
    model,
    prompt,
    ...(image ? { image: asImage(image) } : {}),
    config: {
      numberOfVideos: 1,
      durationSeconds: duration,
      aspectRatio,
      resolution: resolutionFor(aspectRatio, resolution),
      ...(useBucket ? { outputGcsUri: `gs://${config.bucket}/${gcsPath}/` } : {}),
      ...(lastFrame ? { lastFrame: asImage(lastFrame) } : {}),
      ...(referenceImages.length ? { referenceImages: referenceImages.map(img => ({ image: asImage(img), referenceType: "ASSET" })) } : {}),
      // generateAudio is a Vertex parameter; the Gemini API decides audio per model.
      ...(config.mode === "vertex" ? { generateAudio: audio } : {})
    }
  });
  onOperation?.(operation.name);
  while (!operation.done) {
    await sleep(10000);
    operation = await ai.operations.get({ operation });
  }
  if (operation.error) throw new Error(JSON.stringify(operation.error));
  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) {
    const filtered = operation.response?.raiMediaFilteredReasons;
    throw new Error(`Veo completed without a downloadable video.${filtered ? ` Filtered: ${JSON.stringify(filtered)}` : ""}`);
  }
  if (video.videoBytes) await writeFile(target, Buffer.from(video.videoBytes, "base64"));
  else if (video.uri?.startsWith("gs://")) await downloadFromGcs(video.uri, target);
  else await ai.files.download({ file: video, downloadPath: target });
  await access(target);
  return target;
}
