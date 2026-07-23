import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Intent, Video, Profile } from "../lib/types";
import { INTENT_LABELS } from "../lib/types";
import Avatar from "./Avatar";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

type Props = {
  video: Video;
  profile?: Profile | null;
  liked?: boolean;
  onLike?: () => void;
  onDelete?: () => void;
  active?: boolean;
};

export default function PitchItem({ video, profile, liked, onLike, onDelete, active }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [wrongAspect, setWrongAspect] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [active]);

  function handleLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    const w = el.videoWidth || 0;
    const h = el.videoHeight || 0;
    if (w && h) setWrongAspect(w / h > 1.05);
  }

  const isOwn = !!user && user.id === video.user_id;
  const intentList = (video.intent ?? []) as Intent[];
  const ctaList = intentList.length > 0 ? intentList : (["open_to_talk"] as Intent[]);

  async function handleConnect(key: Intent) {
    if (!user || isOwn) return;
    setConnecting(key);
    try {
      const [a, b] = [user.id, video.user_id].sort();
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_a", a)
        .eq("user_b", b)
        .maybeSingle();
      let conversationId = (existing as { id: string } | null)?.id;
      if (!conversationId) {
        const { data: created, error } = await supabase
          .from("conversations")
          .insert({ user_a: a, user_b: b })
          .select("id")
          .single();
        if (error) throw error;
        conversationId = (created as { id: string }).id;
      }
      navigate("/messages", { state: { conversationId } });
    } finally {
      setConnecting(null);
    }
  }

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative aspect-[9/16] h-full max-h-full max-w-full overflow-hidden">
          <video
            ref={videoRef}
            src={video.url}
            poster={video.poster ?? undefined}
            loop
            playsInline
            muted={false}
            controls={false}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) el.play().catch(() => {});
              else el.pause();
            }}
            className="absolute inset-0 h-full w-full object-contain"
          />
        </div>
      </div>

      {wrongAspect && (
        <div className="absolute inset-x-0 top-0 z-20 bg-amber-500/90 px-3 py-1.5 text-center text-[11px] font-medium text-black">
          This video is not in pitch (9:16) format. Please re-record in portrait.
        </div>
      )}

      {/* Tap hint when paused */}
      <TapHint videoRef={videoRef} />

      {/* Right action rail */}
      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5">
        <button
          onClick={onLike}
          className="flex flex-col items-center gap-1 transition-transform hover:scale-110 active:scale-95"
          aria-label="Like"
        >
          <span className={`grid h-12 w-12 place-items-center rounded-full bg-white/10 backdrop-blur-md ring-1 ring-white/15 ${liked ? "text-accent" : "text-white"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xs font-medium text-white drop-shadow">{video.likes_count ?? 0}</span>
        </button>
        <div className="flex flex-col items-center gap-1">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md ring-1 ring-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-xs font-medium text-white drop-shadow">Reply</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md ring-1 ring-white/15">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="text-xs font-medium text-white drop-shadow">Share</span>
        </div>
        {isOwn && onDelete && (
          <button
            onClick={() => {
              if (confirm("Delete this pitch? This cannot be undone.")) onDelete();
            }}
            className="flex flex-col items-center gap-1 transition-transform hover:scale-110 active:scale-95"
            aria-label="Delete"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-red-400 backdrop-blur-md ring-1 ring-white/15">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-xs font-medium text-white drop-shadow">Delete</span>
          </button>
        )}
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-6 left-0 right-16 z-20 px-4">
        <div className="mb-3 flex items-center gap-3">
          {profile && <Avatar name={profile.name} src={profile.avatar} size={40} ring />}
          <div className="min-w-0">
            <p className="truncate font-semibold text-white drop-shadow">{profile?.name ?? "Unknown"}</p>
            <p className="truncate text-xs text-white/80 drop-shadow">{profile?.company ?? ""}</p>
          </div>
          {profile?.verified && <span className="chip-success">Verified</span>}
        </div>
        <h3 className="font-semibold leading-tight text-white drop-shadow">{video.title}</h3>
        {video.description && (
          <p className={`mt-1.5 text-sm text-white/90 drop-shadow ${expanded ? "" : "line-clamp-2"}`}>{video.description}</p>
        )}
        {video.description && video.description.length > 120 && (
          <button className="mt-0.5 text-xs text-white/70 hover:text-white" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Show more"}</button>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {video.stage && <span className="chip-accent">{video.stage}</span>}
          {video.sector && <span className="chip">{video.sector}</span>}
          {(video.tags ?? []).map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
        {!isOwn && (
          <div className="mt-3 flex flex-wrap gap-2">
            {ctaList.map((key) => (
              <button
                key={key}
                onClick={() => handleConnect(key)}
                disabled={connecting !== null}
                className="btn-accent px-4 py-2 text-xs"
              >
                {connecting === key ? "Opening…" : INTENT_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TapHint({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement> }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(true);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [videoRef]);

  if (!paused) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm ring-1 ring-white/20">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </div>
    </div>
  );
}
