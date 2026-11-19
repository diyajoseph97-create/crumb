// Crumb starts here: a welcome screen the first time (Gemini key, or skip),
// then your cookbook, saved in this browser.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CrumbApp } from "@/components/CrumbApp";
import { SettingsPanel, Welcome } from "@/components/Setup";
import { getGeminiKey, LocalStore, requestPersistence } from "@/lib/local-store";
import { registerServiceWorker } from "@/lib/share";
import { applySetupCode, takeSessionFromUrl, takeSignInErrorFromUrl } from "@/lib/cloud";
import { startSync } from "@/lib/sync";
import { SharedView } from "@/components/SharedView";

const WELCOMED = "crumb-welcomed";

function Root() {
  const [key, setKey] = useState(getGeminiKey());
  const [welcomed, setWelcomed] = useState(() => {
    try {
      return Boolean(localStorage.getItem(WELCOMED)) || Boolean(getGeminiKey());
    } catch {
      return true;
    }
  });
  const [reloadKey, setReloadKey] = useState(0);
  // A key shared from your other devices arrives through sync.
  useEffect(() => {
    const on = (e: Event) => setKey((e as CustomEvent<string>).detail);
    window.addEventListener("crumb-key-changed", on);
    return () => window.removeEventListener("crumb-key-changed", on);
  }, []);

  if (!welcomed) {
    return (
      <Welcome
        onDone={() => {
          try {
            localStorage.setItem(WELCOMED, "1");
          } catch {}
          requestPersistence();
          setKey(getGeminiKey());
          setWelcomed(true);
        }}
      />
    );
  }

  return (
    <CrumbApp
      reloadToken={reloadKey}
      store={LocalStore}
      geminiKey={key || null}
      renderSettings={(close, recipes) => (
        <SettingsPanel onClose={close} onKeyChange={setKey} onRestored={() => setReloadKey((n) => n + 1)} recipes={recipes} />
      )}
    />
  );
}

requestPersistence();
registerServiceWorker();

// Someone opened a view-only link (?s=…): show that cookbook, nothing else.
const sharedCode = new URLSearchParams(location.search).get("s");

if (!sharedCode) {
  // Arriving from a sync set-up link (#connect=…) or a sign-in email (#access_token=…).
  function takeLinks(): boolean {
    let took = false;
    const setup = location.hash.match(/^#connect=([A-Za-z0-9+/=_-]+)/);
    if (setup) {
      if (applySetupCode(setup[1])) sessionStorage.setItem("crumb-just-connected", "1");
      history.replaceState(null, "", location.pathname + location.search);
      took = true;
    }
    if (takeSessionFromUrl()) {
      sessionStorage.setItem("crumb-just-signed-in", "1");
      took = true;
    }
    const signInError = takeSignInErrorFromUrl();
    if (signInError) {
      sessionStorage.setItem("crumb-sign-in-error", signInError);
      took = true;
    }
    return took;
  }
  takeLinks();
  // Same links opened while Crumb is already open: apply them and start fresh.
  window.addEventListener("hashchange", () => takeLinks() && location.reload());
  startSync();

}

createRoot(document.getElementById("root")!).render(sharedCode ? <SharedView code={sharedCode} /> : <Root />);
