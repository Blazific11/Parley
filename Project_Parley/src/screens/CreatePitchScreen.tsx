import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, VIDEOS_BUCKET } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { VideoInsert } from "../lib/types";

const PITCH_RATIO_MAX = 1.05;

export default function CreatePitchScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  async function startRecording() {
    setError(null);
    try {
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
      navigate("/feed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally { setBusy(false); }
  }

  return (
    <div className="shell px-5 py-6 sm:px-8 sm:py-8">
      <div className="card mx-auto grid max-w-3xl gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
        <div className="md:sticky md:top-24">
          <div className="eyebrow">Pitch studio</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Record your pitch</h1>
          <p className="mt-1 text-sm text-muted">Portrait (9:16) only — vertical pitch videos for investors. Landscape videos are rejected.</p>
          <div className="mx-auto mt-4 w-full max-w-[260px]">
            <video ref={videoRef} autoPlay muted playsInline className="aspect-[9/16] w-full rounded-control bg-black object-cover" />
            {recordingUrl && <video src={recordingUrl} controls className="mt-3 aspect-[9/16] w-full rounded-control bg-black object-cover" />}
          </div>
          {recordingDims && (
            <p className={`mt-3 text-center text-xs ${isPitch ? "text-emerald-400" : "text-amber-400"}`}>
              {isPitch ? `Pitch format OK (${recordingDims.w}×${recordingDims.h})` : `Not a pitch — ${recordingDims.w}×${recordingDims.h}. Please re-record in portrait.`}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!mediaRef.current?.state || mediaRef.current.state === "inactive" ? (
              <button className="btn-accent" onClick={startRecording} disabled={busy}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>Record
              </button>
            ) : (
              <button className="btn-dark" onClick={stopRecording}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>Stop
              </button>
            )}
            <label className="btn-ghost cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4M5 11l7-7 7 7" /><path d="M5 20h14" /></svg>
              Upload video
              <input type="file" accept="video/*" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelected(f); e.currentTarget.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="grid gap-3">
          <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea className="input" placeholder="Description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Stage (e.g. Seed)" value={stage} onChange={(e) => setStage(e.target.value)} />
            <input className="input" placeholder="Sector (e.g. AI)" value={sector} onChange={(e) => setSector(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="mt-1 flex flex-wrap justify-end gap-2">
            <button className="btn-ghost" onClick={() => navigate("/feed")} disabled={busy}>Cancel</button>
            <button className="btn-primary" onClick={publish} disabled={!recording || busy || !isPitch}>{busy ? "Publishing…" : "Publish pitch"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
