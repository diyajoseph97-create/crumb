// Crumb starts here.
// - Device already connected → open your cookbook (private GitHub repo).
// - Not connected → setup screen (with an option to try sample recipes).
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CrumbApp } from "@/components/CrumbApp";
import { Setup } from "@/components/Setup";
import { setImageResolver } from "@/components/RecipeImage";
import { clearSettings, createGitHubStore, loadSettings, saveSettings, type Settings } from "@/lib/github";
import { DemoStore } from "@/lib/store";
import type { Recipe } from "@/lib/types";
import { readAddHash } from "@/lib/bookmarklet";

// Read (and then hide) anything passed in the address: a recipe from the bookmark
// button (#add=…) or an "Add another device" link (#join=…).
const startHash = window.location.hash;
const startAdd = readAddHash(startHash);
const startJoin = startHash.startsWith("#join=") ? startHash.slice(6) : null;
if (startAdd || startJoin) history.replaceState(null, "", window.location.pathname + window.location.search);

function downloadBackup(recipes: Recipe[]) {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), count: recipes.length, recipes }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `crumb-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function Root() {
  const [settings, setSettings] = useState<Settings | null>(() => loadSettings());
  const [demo, setDemo] = useState(false);
  const [pendingAdd] = useState(startAdd);

  const store = useMemo(() => {
    if (!settings) return null;
    const s = createGitHubStore(settings);
    setImageResolver((u) => s.resolveImage(u));
    return s;
  }, [settings]);

  const connect = (s: Settings) => {
    saveSettings(s);
    setDemo(false);
    setSettings(s);
  };

  if (store && settings) {
    return (
      <CrumbApp
        key={`${settings.owner}/${settings.repo}`}
        store={store}
        geminiKey={settings.geminiKey || null}
        initialAdd={pendingAdd}
        renderSettings={(close, recipes) => (
          <Setup
            inApp
            initial={settings}
            onConnect={(s) => { connect(s); close(); }}
            onExport={() => downloadBackup(recipes)}
            onDisconnect={() => {
              if (!window.confirm("Disconnect this device? Your recipes stay safe in GitHub. You'll need the token to reconnect.")) return;
              clearSettings();
              setImageResolver(null);
              setSettings(null);
            }}
            onCancel={close}
          />
        )}
      />
    );
  }

  if (demo) {
    return (
      <CrumbApp
        key="demo"
        store={DemoStore}
        geminiKey={null}
        renderSettings={(close) => <Setup inApp onConnect={(s) => { connect(s); close(); }} onCancel={close} />}
      />
    );
  }

  return <Setup joinPayload={startJoin} onConnect={connect} onDemo={() => setDemo(true)} />;
}

createRoot(document.getElementById("root")!).render(<Root />);
