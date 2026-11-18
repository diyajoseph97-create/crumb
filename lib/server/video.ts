// "Watching" a Reel: many creators put the recipe only in the video (spoken,
// or as on-screen text). Claude can't take video, so this step uses Gemini to
// produce a faithful transcript of what is SAID and SHOWN. Claude then turns that
// transcript into the structured recipe, with the same no-guessing rules.
import { GoogleGenAI, createPartFromUri } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_VIDEO_BYTES = 90 * 1024 * 1024;
const INLINE_LIMIT = 15 * 1024 * 1024; // smaller videos are sent directly; bigger ones are uploaded first

export function videoConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const PROMPT = `This is a cooking video from Instagram. Write a faithful record of it for someone who wants to cook the recipe without watching. Use these sections:

SPOKEN: Everything said that relates to the recipe, in order (translate to English if needed; keep every number, quantity, unit, time, temperature and serving count exactly as said).
ON-SCREEN TEXT: All recipe-related text shown on screen (ingredient lists, quantities, steps, times, servings), exactly as shown.
WHAT HAPPENS: The cooking steps as they are shown, in order, including which ingredients are added when. If an amount is visible (e.g. "a full cup", "2 eggs") note it; if not, say "amount not shown".
STATED DETAILS: Any prep time, cooking time, total time or serving count that is said or shown. Write "not stated" for any that aren't.

Rules: Do not guess or add anything that isn't said or shown. If the video has no recipe, say so.`;

async function download(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0 Safari/537.36" },
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Couldn't download the video (HTTP ${res.status})`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_VIDEO_BYTES) throw new Error("The video is too long to process.");
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_VIDEO_BYTES) throw new Error("The video is too long to process.");
  const type = (res.headers.get("content-type") ?? "video/mp4").split(";")[0];
  return { bytes, type: type.startsWith("video/") ? type : "video/mp4" };
}

/** Returns a text record of the video, or throws with a friendly message. */
export async function transcribeVideo(videoUrl: string): Promise<string> {
  if (!videoConfigured()) throw new Error("Video reading isn't set up (GEMINI_API_KEY missing).");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const video = await download(videoUrl);
  if (!video) throw new Error("Couldn't download the video.");

  let videoPart: any;
  let uploadedName: string | undefined;
  if (video.bytes.byteLength <= INLINE_LIMIT) {
    videoPart = { inlineData: { mimeType: video.type, data: Buffer.from(video.bytes).toString("base64") } };
  } else {
    const file = await ai.files.upload({ file: new Blob([video.bytes as Uint8Array<ArrayBuffer>], { type: video.type }), config: { mimeType: video.type } });
    uploadedName = file.name;
    // Large uploads need a moment to be processed before use.
    let current = file;
    for (let i = 0; i < 30 && current.state === "PROCESSING"; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      current = await ai.files.get({ name: file.name! });
    }
    if (current.state !== "ACTIVE") throw new Error("The video couldn't be processed.");
    videoPart = createPartFromUri(current.uri!, current.mimeType ?? video.type);
  }

  try {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [videoPart, { text: PROMPT }] }],
      config: { temperature: 0 },
    });
    const text = res.text?.trim();
    if (!text) throw new Error("The video reader returned nothing.");
    return text.slice(0, 20000);
  } finally {
    if (uploadedName) ai.files.delete({ name: uploadedName }).catch(() => {});
  }
}
