// Grabs one frame from a video file as a JPEG, used as the recipe photo
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
    const max = 1600;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
