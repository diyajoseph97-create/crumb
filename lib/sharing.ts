// Making and sending view-only links (see lib/cloud.ts for how they're stored).
import { createShare, getSession, shareUrl } from "./cloud";
import { syncNow } from "./sync";

const TITLE = "crumb-share-title";
export const getShareTitle = () => {
  try {
    return localStorage.getItem(TITLE) || "crumbs";
  } catch {
    return "crumbs";
  }
};
export const setShareTitle = (t: string) => {
  try {
    localStorage.setItem(TITLE, t.trim() || "crumbs");
  } catch {}
};

export const canShare = () => Boolean(getSession());

/** Creates a view-only link for the whole cookbook (recipeId null) or one recipe. */
export async function makeShareLink(recipeId: string | null): Promise<string> {
  await syncNow(); // make sure what they'll see is up to date
  const share = await createShare(recipeId, getShareTitle());
  return shareUrl(share.token, recipeId);
}

/** Opens the phone's share sheet, or copies the link on a laptop. */
export async function sendLink(url: string, title: string): Promise<"shared" | "copied" | "cancelled" | "failed"> {
  const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (nav.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await nav.share({ title, text: title, url });
      return "shared";
    } catch {
      return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
