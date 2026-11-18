"use client";
import { useState } from "react";
import { Doodle, Logo } from "@/components/ui";

export default function Unlock() {
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passphrase: pass }) });
    if (res.ok) {
      window.location.href = "/";
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error ?? "Couldn't unlock.");
    setBusy(false);
  }

  return (
    <main className="unlock">
      <form className="unlock-card" onSubmit={submit}>
        <Logo />
        <Doodle name="pot" className="add-doodle" />
        <h1 className="h-display h-md">Welcome back to the kitchen</h1>
        <p className="muted">Enter your passphrase. This device will stay unlocked for 6 months.</p>
        <input className="input input-lg" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passphrase" autoFocus aria-label="Passphrase" />
        {error && <p className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</p>}
        <button className="btn btn-primary btn-lg block" style={{ marginTop: 14 }} disabled={busy || !pass}>
          {busy ? "Checking…" : "Open my cookbook"}
        </button>
      </form>
    </main>
  );
}
