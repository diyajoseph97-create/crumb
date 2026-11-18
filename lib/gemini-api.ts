// A tiny client for the few Gemini web API calls Crumb makes.
// (Replaces Google's 430 KB SDK, which Crumb was downloading on every visit.)

const BASE = "https://generativelanguage.googleapis.com";

export type Part = { text?: string; inlineData?: { mimeType: string; data: string }; fileData?: { fileUri: string; mimeType?: string } };

/** Errors keep the status and Google's JSON body, so callers can spot 429 / 404 / quota details. */
async function call(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(BASE + path, { ...init, headers: { "x-goog-api-key": apiKey, ...(init.headers || {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 2000)}`);
  }
  return res;
}

/** Names of the models this key can use for generateContent. */
export async function listModels(apiKey: string): Promise<string[]> {
  const names: string[] = [];
  let token = "";
  for (let page = 0; page < 5; page++) {
    const res = await call(apiKey, `/v1beta/models?pageSize=200${token ? `&pageToken=${encodeURIComponent(token)}` : ""}`);
    const j = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[]; nextPageToken?: string };
    for (const m of j.models ?? []) {
      if (!m.supportedGenerationMethods || m.supportedGenerationMethods.includes("generateContent")) names.push(m.name.replace(/^models\//, ""));
    }
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return names;
}

export async function generateContent(
  apiKey: string,
  model: string,
  body: { parts: Part[]; system: string; schema: unknown; mediaResolution?: string },
): Promise<string> {
  const res = await call(apiKey, `/v1beta/models/${model}:generateContent`, {
    method: "POST",
    // Long YouTube videos can take a while, but never wait forever.
    signal: typeof AbortSignal.timeout === "function" ? AbortSignal.timeout(4 * 60_000) : undefined,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: body.parts }],
      systemInstruction: { parts: [{ text: body.system }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: body.schema,
        temperature: 0,
        ...(body.mediaResolution ? { mediaResolution: body.mediaResolution } : {}),
      },
    }),
  });
  const j = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
}

type GeminiFile = { name: string; uri: string; mimeType: string; state?: string };

/** Upload a large video, wait until Gemini has processed it, and return a part pointing to it. */
export async function uploadVideo(apiKey: string, file: File): Promise<Part> {
  const mimeType = file.type || "video/mp4";
  const start = await call(apiKey, "/upload/v1beta/files", {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(file.size),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "content-type": "application/json",
    },
    body: JSON.stringify({ file: { displayName: file.name || "reel" } }),
  });
  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("the video couldn't be processed (no upload address)");
  const done = await fetch(uploadUrl, {
    method: "POST",
    headers: { "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" },
    body: file,
  });
  if (!done.ok) throw new Error(`HTTP ${done.status}: ${await done.text().catch(() => "")}`);
  let f = ((await done.json()) as { file: GeminiFile }).file;
  for (let i = 0; i < 60 && f.state === "PROCESSING"; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    f = (await (await call(apiKey, `/v1beta/${f.name}`)).json()) as GeminiFile;
  }
  if (f.state && f.state !== "ACTIVE") throw new Error("the video couldn't be processed");
  return { fileData: { fileUri: f.uri, mimeType: f.mimeType || mimeType } };
}
