// Voice provider abstraction + SLOTS. v1 wires NOTHING paid: it only reports
// slot definitions and merges in whatever the local config has saved, so later
// wiring (self-hosted Swar/Kriti, or a TTS API) is drop-in — implement synth()/
// transcribe() against this contract and the UI already fits.
import { loadConfig } from "./config.mjs";

export const SLOTS = [
  {
    id: "swar",
    name: "Swar — स्वर",
    vendor: "Naamche Labs",
    kind: "voice-clone",
    languages: ["Nepali", "English", "Nepali+English"],
    summary:
      "Voice cloning from ~20–30s of a speaker. #1 on the Nepali voice-cloning benchmark. Open-weight — run it yourself (no hosted API).",
    setup: {
      type: "self-host",
      links: [
        { label: "Model card (Hugging Face)", url: "https://huggingface.co/Aarjan/swar" },
        { label: "Naamche Labs — Models", url: "https://naamchelabs.com/models" }
      ],
      steps: [
        "Open the Hugging Face model (Aarjan/swar) or the Colab notebook.",
        "Run it locally or in Colab to expose an inference endpoint.",
        "Paste that endpoint URL below. The Studio will POST text + a reference clip to it."
      ]
    }
  },
  {
    id: "kriti",
    name: "Kriti V1",
    vendor: "Naamche Labs",
    kind: "speech-to-text",
    languages: ["Nepali"],
    summary:
      "Nepali ASR, 119M params, runs on CPU. #1 on the Nepali ASR benchmark. Open-weight — run it yourself. (A telephony variant exists for 8kHz call audio.)",
    setup: {
      type: "self-host",
      links: [
        { label: "Model card (Hugging Face)", url: "https://huggingface.co/harrrshall/kriti" },
        { label: "Kriti Telephony", url: "https://huggingface.co/Aarjan/kriti-telephony" }
      ],
      steps: [
        "Run Kriti locally (it is small enough for CPU) or in Colab.",
        "Expose it as an endpoint and paste the URL below.",
        "Note: the subtitle tool already has a separate Cloudflare Whisper path for Nepali."
      ]
    }
  },
  {
    id: "tts",
    name: "Text-to-Speech (Hindi / English)",
    vendor: "Bring your own",
    kind: "text-to-speech",
    languages: ["Hindi", "English", "Nepali*"],
    summary:
      "Naamche's models cover Nepali/English only, not Hindi. Use a commercial TTS (ElevenLabs, Google Cloud TTS, Azure) for Hindi narration and multilingual voiceover.",
    setup: {
      type: "api-key",
      links: [
        { label: "ElevenLabs", url: "https://elevenlabs.io" },
        { label: "Google Cloud TTS", url: "https://cloud.google.com/text-to-speech" }
      ],
      steps: [
        "Pick a provider and get an API key.",
        "Choose the provider and paste the key in Settings → it is stored locally, gitignored.",
        "Later: the Studio's synth() will call the provider with your key."
      ]
    }
  }
];

export async function voiceStatus() {
  const cfg = await loadConfig();
  return SLOTS.map((slot) => {
    const saved = cfg.providers?.[slot.id] || {};
    const connected = slot.setup.type === "api-key"
      ? Boolean(saved.apiKey)
      : Boolean(saved.endpoint);
    return {
      ...slot,
      connected,
      saved: {
        endpoint: saved.endpoint || "",
        provider: saved.provider || "",
        hasKey: Boolean(saved.apiKey),
        note: saved.note || ""
      }
    };
  });
}

// --- Future wiring stubs (kept intentionally explicit) -----------------------
// Implement these against a connected slot's config. They throw today so no one
// accidentally believes voice is live.
export async function synth(/* { text, lang, voiceRef } */) {
  throw new Error("Voice synthesis is not wired in v1. Connect a provider slot first.");
}
export async function transcribe(/* { audioPath, lang } */) {
  throw new Error("Transcription is not wired in v1. Connect Kriti (or use the subtitle tool).");
}
