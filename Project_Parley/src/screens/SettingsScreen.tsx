import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { UserType } from "../lib/types";

type DeleteStep = "idle" | "confirm" | "code" | "done";

export default function SettingsScreen() {
  const { user, profile, signOut, updateUserType, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
  const [deleteType, setDeleteType] = useState("");
  const [code, setCode] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(6).fill(""));
  const codeRefs = useRef<Array<HTMLInputElement | null>>([]);

  async function handleSwitchType(t: UserType) {
    if (!user || profile?.user_type === t) return;
    setBusy(true); setError(null);
    try {
      await updateUserType(t);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch account type");
    } finally { setBusy(false); }
  }

  async function sendDeletionCode() {
    if (!user?.email) return;
    setBusy(true); setError(null); setInfo(null);
    try {
      const { error: err } = await supabase.auth.reauthenticate();
      if (err) throw err;
      setInfo(`A 6-digit verification code was sent to ${user.email}. Enter it below to confirm deletion.`);
      setDeleteStep("code");
      setTimeout(() => codeRefs.current[0]?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send verification code");
    } finally { setBusy(false); }
  }

  function setDigit(i: number, v: string) {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...codeDigits];
    next[i] = ch;
    setCodeDigits(next);
    setCode(next.join(""));
    if (ch && i < 5) codeRefs.current[i + 1]?.focus();
  }

  function onCodeKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !codeDigits[i] && i > 0) {
      codeRefs.current[i - 1]?.focus();
    }
  }

  function onCodePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array(6).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setCodeDigits(next);
    setCode(text);
    const focusIdx = Math.min(text.length, 5);
    codeRefs.current[focusIdx]?.focus();
  }

  async function handleDelete() {
    if (deleteType !== "DELETE") return;
    if (code.length !== 6) {
      setError("Enter the 6-digit code sent to your email.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const email = user!.email;
      if (!email) throw new Error("No email on file for this account.");
      const { error: verifyErr } = await supabase.auth.verifyOtp({ email, token: code, type: "reauthentication" });
      if (verifyErr) throw new Error("Invalid or expired code. Request a new one.");
      await deleteAccount();
      setDeleteStep("done");
      navigate("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete account");
      setBusy(false);
    }
  }

  function resetDelete() {
    setDeleteStep("idle");
    setDeleteType("");
    setCode("");
    setCodeDigits(Array(6).fill(""));
    setError(null);
    setInfo(null);
  }

  if (!user) return null;

  return (
    <div className="shell px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="eyebrow">Settings</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Account settings</h1>
        </div>

        {/* Account type */}
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Account type</h2>
          <p className="mt-1 text-sm text-muted">Switch between founder and investor. This changes how you appear in matches.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {(["founder", "investor"] as const).map((t) => {
              const active = profile?.user_type === t;
              return (
                <button
                  key={t}
                  onClick={() => handleSwitchType(t)}
                  disabled={busy || active}
                  className={`btn py-3 capitalize ${active ? "bg-white text-ink" : "bg-surface-2 text-muted ring-1 ring-line hover:text-white"}`}
                >
                  {active && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  {t}
                </button>
              );
            })}
          </div>
        </section>

        {/* Edit profile shortcut */}
        <section className="card p-6">
          <h2 className="text-lg font-semibold">Profile details</h2>
          <p className="mt-1 text-sm text-muted">Update your name, company, bio, stage, sector, and location.</p>
          <div className="mt-4 flex gap-2">
            <button className="btn-ghost" onClick={() => navigate("/profile")}>Edit profile</button>
            <button className="btn-ghost" onClick={async () => { await signOut(); navigate("/"); }}>Sign out</button>
          </div>
        </section>

        {/* Danger zone */}
        <section className="card-ink p-6 ring-1 ring-red-500/30">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-red-300">Danger zone</h2>
            <span className="chip-danger">Irreversible</span>
          </div>
          <p className="mt-1 text-sm text-muted">Deleting your account removes your pitches, matches, conversations, and profile. For security, a 6-digit verification code is sent to your email and must be entered to confirm.</p>

          {deleteStep === "idle" && (
            <button className="btn-danger mt-4" onClick={() => setDeleteStep("confirm")}>Delete account</button>
          )}

          {deleteStep === "confirm" && (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-muted-soft">Type DELETE to continue. We'll then email a verification code to <span className="text-white">{user.email}</span>.</p>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Type DELETE to confirm</label>
                <input className="input" placeholder="DELETE" value={deleteType} onChange={(e) => setDeleteType(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={resetDelete}>Cancel</button>
                <button className="btn-danger" disabled={busy || deleteType !== "DELETE"} onClick={sendDeletionCode}>
                  {busy ? "Sending code…" : "Send verification code"}
                </button>
              </div>
            </div>
          )}

          {deleteStep === "code" && (
            <div className="mt-4 grid gap-3">
              {info && <p className="text-sm text-emerald-400">{info}</p>}
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-[0.15em] text-muted">Enter 6-digit code</label>
                <div className="flex gap-2" onPaste={onCodePaste}>
                  {codeDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { codeRefs.current[i] = el; }}
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => onCodeKeyDown(i, e)}
                      className="h-12 w-12 rounded-control border border-line bg-surface-2 text-center text-lg font-semibold text-white outline-none focus:border-accent"
                    />
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={resetDelete} disabled={busy}>Cancel</button>
                <button className="btn-ghost" onClick={sendDeletionCode} disabled={busy}>Resend code</button>
                <button className="btn-danger" disabled={busy || code.length !== 6} onClick={handleDelete}>
                  {busy ? "Deleting…" : "Permanently delete account"}
                </button>
              </div>
            </div>
          )}

          {deleteStep === "done" && (
            <p className="mt-4 text-sm text-emerald-400">Your account has been deleted.</p>
          )}
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
