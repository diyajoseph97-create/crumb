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
    window.location.hash = "";
  };

  if (store && settings) {
    return (
      <CrumbApp
        key={`${settings.owner}/${settings.repo}`}
        store={store}
        geminiKey={settings.geminiKey || null}
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

  return <Setup onConnect={connect} onDemo={() => setDemo(true)} />;
}

createRoot(document.getElementById("root")!).render(<Root />);
