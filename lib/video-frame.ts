import { drawFrame } from "./image";

// Grabs one frame from a video file as a small photo, used as the recipe photo
// (the AI picks the moment that best shows the finished dish).
export async function captureFrame(file: File, seconds: number): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res();
      video.onerror = () => rej(new Error("video"));
      setTimeout(() => rej(new Error("timeout")), 15000);
    });
    const t = Math.min(Math.max(0, seconds), Math.max(0, (video.duration || 0) - 0.1));
    video.currentTime = t;
    await new Promise<void>((res, rej) => {
      video.onseeked = () => res();
      setTimeout(() => rej(new Error("timeout")), 15000);
    });
    return drawFrame(video);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
