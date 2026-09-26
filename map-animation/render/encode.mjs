import { spawn } from "node:child_process";
import path from "node:path";

// Always invoked with an argv array (never a shell string) so no frame path,
// project id, or title can be interpreted as a shell command.
export function encodeFramesToMp4({ framesDir, fps, outFile, crf = 18 }) {
  const args = [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(framesDir, "frame_%06d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    String(crf),
    "-movflags",
    "+faststart",
    outFile
  ];
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { windowsHide: true });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    proc.on("error", (err) => reject(new Error(`Failed to start ffmpeg (is it on PATH?): ${err.message}`)));
    proc.on("close", (code) => {
      if (code === 0) resolve({ outFile });
      else reject(new Error(`ffmpeg exited with code ${code}:\n${stderr.slice(-2000)}`));
    });
  });
}

export function checkFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-version"], { windowsHide: true });
    proc.on("error", () => resolve(false));
    proc.on("close", (code) => resolve(code === 0));
  });
}
