// Loudness / pitch / pause analysis and chunking for voice-aligned subtitles, in plain JS.
// This is the browser-side twin of subtitles/audio/src/nepali_subtitles/audio.py: the website has
// no numpy, scipy or soundfile, so the same measurements are computed here from a Float32Array.
// Pure functions over samples — no DOM, no network — so Node can test them (see decodeToMono16k
// for the one browser-only helper).

export const RATE = 16000;

/** numpy-style linear-interpolated percentile over an unsorted array of finite numbers. */
export function percentile(values, p) {
  const sorted = Float64Array.from(values).sort();
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * p / 100;
  const low = Math.floor(pos), high = Math.ceil(pos);
  return sorted[low] + (sorted[high] - sorted[low]) * (pos - low);
}

const hann = n => Float64Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));

/**
 * Median fundamental frequency of one 40 ms frame by normalized autocorrelation, or null when the
 * frame carries no confident periodic voice.
 *
 * The frame is decimated 2:1 before correlating (speech f0 of interest is 65–420 Hz, far below the
 * 8 kHz Nyquist that leaves) because a full-rate direct correlation over every frame of a long
 * recording is too slow in a browser. A parabolic fit on the winning peak restores the lag
 * precision the decimation costs.
 */
function pitchOf(frame, window, sr, energy) {
  // Matches audio.py: an unvoiced or near-silent frame is reported as no pitch at all.
  if (energy <= 0.007) return null;
  let mean = 0;
  for (let i = 0; i < frame.length; i++) mean += frame[i];
  mean /= frame.length;
  const half = frame.length >> 1;
  const x = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    // Average the pair being dropped: a cheap anti-alias filter ahead of the 2:1 decimation.
    const a = frame[2 * i] - mean, b = frame[2 * i + 1] - mean;
    x[i] = (a + b) / 2 * window[i];
  }
  const rate = sr / 2;
  const lo = Math.round(rate / 420), hi = Math.min(half - 2, Math.round(rate / 65));
  if (hi <= lo + 1) return null;
  let zero = 0;
  for (let i = 0; i < half; i++) zero += x[i] * x[i];
  if (!(zero > 1e-8)) return null;
  const ac = new Float64Array(hi + 2);
  for (let lag = lo - 1 > 0 ? lo - 1 : 1; lag <= hi + 1; lag++) {
    let sum = 0;
    for (let i = 0, n = half - lag; i < n; i++) sum += x[i] * x[i + lag];
    ac[lag] = sum;
  }
  // Strongest local maximum in the voice range, as scipy.signal.find_peaks + argmax would pick.
  let best = -1, bestValue = -Infinity;
  for (let lag = lo; lag <= hi; lag++) {
    if (ac[lag] > ac[lag - 1] && ac[lag] > ac[lag + 1] && ac[lag] > bestValue) { bestValue = ac[lag]; best = lag; }
  }
  if (best < 0 || bestValue / zero <= 0.55) return null;
  const curve = ac[best - 1] - 2 * ac[best] + ac[best + 1];
  const lag = curve < 0 ? best + (ac[best - 1] - ac[best + 1]) / (2 * curve) : best;
  return rate / lag;
}

/**
 * 10 ms loudness and pitch track, plus the pauses between phrases.
 * @param {Float32Array} y mono samples
 * @param {number} sr sample rate
 * @returns {{duration:number, sample_rate:number, frame_hop_seconds:number,
 *   silence_rms_threshold:number, times:number[], rms:number[], pitch_hz:(number|null)[],
 *   pauses:{start:number,end:number}[], method:string}}
 *   Loudness and pitch are descriptive acoustic proxies, not emotion labels.
 */
export function analyse(y, sr = RATE) {
  const hop = Math.round(sr * 0.01), frame = Math.round(sr * 0.04);
  const window = hann(frame >> 1);
  const times = [], rms = [], pitch = [];
  for (let i = 0; i < Math.max(1, y.length - frame + 1); i += hop) {
    const x = y.subarray(i, i + frame);
    let sum = 0;
    for (let k = 0; k < x.length; k++) sum += x[k] * x[k];
    const energy = Math.sqrt(sum / Math.max(1, x.length) + 1e-12);
    times.push(i / sr);
    rms.push(energy);
    pitch.push(x.length === frame ? pitchOf(x, window, sr, energy) : null);
  }
  const duration = y.length / sr;
  const threshold = Math.max(0.0025, Math.min(0.018, percentile(rms, 15) * 2));
  const pauses = [];
  let start = null;
  for (let i = 0; i <= rms.length; i++) {
    const quiet = i < rms.length && rms[i] < threshold;
    if (quiet && start === null) start = i;
    if (!quiet && start !== null) {
      if ((i - start) * 0.01 >= 0.16) {
        pauses.push({ start: round(times[start], 3), end: round(Math.min(duration, i * 0.01 + 0.02), 3) });
      }
      start = null;
    }
  }
  return {
    duration, sample_rate: sr, frame_hop_seconds: 0.01, silence_rms_threshold: threshold,
    times, rms, pitch_hz: pitch, pauses,
    method: "RMS + normalized autocorrelation; pause/energy/pitch proxies, not validated emotion classification"
  };
}

const round = (n, places) => { const f = 10 ** places; return Math.round(n * f) / f; };

/**
 * Cut the recording into recognition-sized pieces, preferring a real pause near each target so a
 * word is never sliced in half. Every sample lands in exactly one piece.
 * @returns {{start:number,end:number,seconds:number,wav:Uint8Array}[]}
 */
export function chunks(y, sr, features, target = 20) {
  const duration = y.length / sr;
  const boundaries = [0];
  while (duration - boundaries.at(-1) > target + 3) {
    const ideal = boundaries.at(-1) + target;
    const candidates = features.pauses
      .map(p => (p.start + p.end) / 2)
      .filter(mid => Math.abs(mid - ideal) <= 3 && mid > boundaries.at(-1) + 1);
    boundaries.push(candidates.length ? candidates.reduce((a, b) => Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a) : ideal);
  }
  boundaries.push(duration);
  return boundaries.slice(0, -1).map((a, i) => {
    const b = boundaries[i + 1];
    return { start: a, end: b, seconds: b - a, wav: wavBytes(y.subarray(Math.round(a * sr), Math.round(b * sr)), sr) };
  });
}

/** Wrap mono float samples as a 16-bit PCM WAV file. */
export function wavBytes(y, sr) {
  const out = new Uint8Array(44 + y.length * 2);
  const view = new DataView(out.buffer);
  const ascii = (at, text) => { for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i); };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + y.length * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sr, true);
  view.setUint32(28, sr * 2, true);     // byte rate
  view.setUint16(32, 2, true);          // block align
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, y.length * 2, true);
  for (let i = 0; i < y.length; i++) {
    const s = Math.max(-1, Math.min(1, y[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return out;
}

/**
 * Browser only: decode any audio or video file the browser can play into mono 16 kHz samples.
 * Decoding and resampling happen in the user's browser, so no original media file is uploaded —
 * only the small 16 kHz mono pieces that recognition actually needs.
 * @param {ArrayBuffer} data the file's bytes
 * @returns {Promise<Float32Array>}
 */
export async function decodeToMono16k(data) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  const Offline = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  if (!Ctx || !Offline) throw new Error("This browser can't decode audio. Try Chrome, Edge, Firefox or Safari.");
  const context = new Ctx();
  let buffer;
  try {
    buffer = await context.decodeAudioData(data);
  } catch {
    throw new Error("That file's audio couldn't be decoded. Try exporting it as WAV, MP3 or M4A.");
  } finally {
    context.close?.();
  }
  // Resampling through an OfflineAudioContext keeps the browser's own high-quality filter.
  const frames = Math.max(1, Math.ceil(buffer.duration * RATE));
  const offline = new Offline(1, frames, RATE);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  return (await offline.startRendering()).getChannelData(0);
}
