import { useRef, useState } from "react";
import type { Video, Profile } from "../lib/types";
import Avatar from "./Avatar";

type Props = { video: Video; profile?: Profile | null; liked?: boolean; onLike?: () => void; onDelete?: () => void; };

export default function VideoCard({ video, profile, liked, onLike, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [wrongAspect, setWrongAspect] = useState(false);

  function handleLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    const w = el.videoWidth || 0;
    const h = el.videoHeight || 0;
    if (w && h) {
      const ratio = w / h;
      // Pitch/portrait: height should be >= width. Flag if clearly landscape.
      setWrongAspect(ratio > 1.05);
    }
  }

  return (
    <article className="card-ink group overflow-hidden transition-transform duration-500 hover:-translate-y-1">
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[420px] overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={video.url}
          poster={video.poster ?? undefined}
          controls
          loop
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {wrongAspect && (
          <div className="absolute inset-x-0 top-0 bg-amber-500/90 px-3 py-1.5 text-center text-[11px] font-medium text-black">
            This video is not in pitch (9:16) format. Please re-record in portrait.
          </div>
        )}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <div className="flex items-center gap-2">
            {profile && <Avatar name={profile.name} src={profile.avatar} size={28} />}
            <p className="truncate text-xs text-white/90">{profile?.name ?? "Unknown"}{profile?.company ? ` · ${profile.company}` : ""}</p>
          </div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="truncate font-semibold leading-tight">{video.title}</h3>
          <div className="flex items-center gap-2">
            <button className={`btn shrink-0 px-3 py-2 ${liked ? "bg-accent text-white" : "bg-surface-2 text-muted-soft ring-1 ring-line hover:text-white"}`} onClick={onLike} aria-label="Like">
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="tabular-nums">{video.likes_count ?? 0}</span>
            </button>
            {onDelete && (
              confirming ? (
                <div className="flex items-center gap-1">
                  <button className="btn-danger px-3 py-2 text-xs" onClick={onDelete}>Confirm</button>
                  <button className="btn-ghost px-3 py-2 text-xs" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn shrink-0 bg-surface-2 px-3 py-2 text-red-400 ring-1 ring-line hover:bg-red-500/10" onClick={() => setConfirming(true)} aria-label="Delete pitch">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              )
            )}
          </div>
        </div>
        {video.description && <p className={`mt-2 text-sm text-muted-soft ${expanded ? "" : "line-clamp-2"}`}>{video.description}</p>}
        {video.description && video.description.length > 120 && (
          <button className="mt-1 text-xs text-accent-from hover:text-accent" onClick={() => setExpanded((v) => !v)}>{expanded ? "Show less" : "Show more"}</button>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {video.stage && <span className="chip-accent">{video.stage}</span>}
          {video.sector && <span className="chip">{video.sector}</span>}
          {(video.tags ?? []).map((t) => <span key={t} className="chip">#{t}</span>)}
        </div>
      </div>
    </article>
  );
}
