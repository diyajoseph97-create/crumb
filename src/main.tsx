// Crumb starts here: a welcome screen the first time (Gemini key, or skip),
// then your cookbook, saved in this browser.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CrumbApp } from "@/components/CrumbApp";
import { SettingsPanel, Welcome } from "@/components/Setup";
import { getGeminiKey, LocalStore, requestPersistence } from "@/lib/local-store";

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
      renderSettings={(close) => (
        <SettingsPanel onClose={close} onKeyChange={setKey} onRestored={() => setReloadKey((n) => n + 1)} />
      )}
    />
  );
}

requestPersistence();
createRoot(document.getElementById("root")!).render(<Root />);
