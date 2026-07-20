import { useEffect, useRef, useState } from "react";
import { supabase, VIDEOS_BUCKET } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { VideoInsert } from "../lib/types";

type Props = { open: boolean; onClose: () => void; onPublished: () => void };

const PITCH_RATIO_MAX = 1.05; // width/height — portrait or square only

export default function UploadModal({ open, onClose, onPublished }: Props) {
  const { user } = useAuth();
  const [recording, setRecording] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingDims, setRecordingDims] = useState<{ w: number; h: number } | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState("");
  const [sector, setSector] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    return () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  async function startRecording() {
    setError(null);
    try {
      // Prefer a portrait (9:16) capture constraint; fall back to default if unsupported.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } },
          audio: true,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setRecording(blob);
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        const url = URL.createObjectURL(blob);
        setRecordingUrl(url);
        // Measure dimensions
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.src = url;
        probe.onloadedmetadata = () => {
          setRecordingDims({ w: probe.videoWidth, h: probe.videoHeight });
        };
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRef.current = rec;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not access camera/mic");
    }
  }

  function stopRecording() { mediaRef.current?.stop(); }

  const isPitch = recordingDims ? recordingDims.w / recordingDims.h <= PITCH_RATIO_MAX : false;

  async function onFileSelected(file: File) {
    setError(null);
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    const url = URL.createObjectURL(file);
    setRecording(file);
    setRecordingUrl(url);
    setRecordingDims(null);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    probe.onloadedmetadata = () => {
      setRecordingDims({ w: probe.videoWidth, h: probe.videoHeight });
    };
    probe.onerror = () => setError("Could not read that video file.");
  }

  async function publish() {
    if (!user || !recording) return;
    if (!isPitch) {
      setError("Please record in portrait (9:16). Pitches only — no landscape videos.");
      return;
    }
    setBusy(true); setError(null);
    try {
      const ext = (recording as Blob).type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "mp4";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(VIDEOS_BUCKET).upload(path, recording, { contentType: (recording as Blob).type || "video/mp4", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(VIDEOS_BUCKET).getPublicUrl(path);
      const payload: VideoInsert = { user_id: user.id, url: pub.publicUrl, title: title.trim() || "Untitled pitch", description: description.trim(), stage: stage.trim() || null, sector: sector.trim() || null, tags: [], intent: ["fundraising"] };
      const { error: insErr } = await supabase.from("videos").insert(payload);
      if (insErr) throw insErr;
      onPublished(); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="eyebrow">Record</div>
            <h2 className="mt-0.5 text-base font-semibold">Record your pitch</h2>
          </div>
          <button className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-muted hover:text-white" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l16 16M20 4 4 20" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Body: side-by-side on sm+ */}
        <div className="grid gap-5 p-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start">
          {/* Video column */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted">Portrait (9:16) only</p>
            <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-control bg-black object-cover" style={{ height: "200px" }} />
            {recordingUrl && <video src={recordingUrl} controls className="w-full rounded-control bg-black object-cover" style={{ height: "200px" }} />}
            {recordingDims && (
              <p className={`text-center text-[11px] ${isPitch ? "text-emerald-400" : "text-amber-400"}`}>
                {isPitch ? `Format OK (${recordingDims.w}×${recordingDims.h})` : `Not portrait — please re-record.`}
              </p>
            )}
            <div className="flex gap-2">
              {!mediaRef.current?.state || mediaRef.current.state === "inactive" ? (
                <button className="btn-accent w-full" onClick={startRecording} disabled={busy}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>Record
                </button>
              ) : (
                <button className="btn-dark w-full" onClick={stopRecording}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>Stop
                </button>
              )}
              <label className="btn-ghost w-full cursor-pointer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M5 11l7-7 7 7" /><path d="M5 20h14" /></svg>
                Upload
                <input type="file" accept="video/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.currentTarget.value = ""; }} />
              </label>
            </div>
          </div>

          {/* Form column */}
          <div className="grid gap-3">
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input" placeholder="Description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Stage (e.g. Seed)" value={stage} onChange={(e) => setStage(e.target.value)} />
              <input className="input" placeholder="Sector (e.g. AI)" value={sector} onChange={(e) => setSector(e.target.value)} />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={publish} disabled={!recording || busy || !isPitch}>{busy ? "Publishing…" : "Publish pitch"}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
