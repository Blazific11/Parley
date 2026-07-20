import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { sampleProfiles } from "../lib/sampleData";
import type { Profile, Video } from "../lib/types";
import PitchItem from "../components/PitchItem";
import UploadModal from "../components/UploadModal";
import EmptyState from "../components/EmptyState";

export default function FeedScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Video[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: v }, { data: p }, { data: l }] = await Promise.all([
      supabase.from("videos").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*"),
      user ? supabase.from("likes").select("video_id").eq("user_id", user.id) : Promise.resolve({ data: null }),
    ]);
    const vList = (v ?? []) as Video[];
    const pList = (p ?? []) as Profile[];
    setVideos(vList);
    setProfiles(Object.fromEntries(pList.map((x) => [x.id, x as Profile])));
    if (user) {
      const lList = (l ?? []) as { video_id: string }[];
      setLiked(new Set(lList.map((x) => x.video_id)));
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  const profileMap = useMemo(() => {
    const merged: Record<string, Profile> = { ...profiles };
    for (const p of sampleProfiles) if (!merged[p.id]) merged[p.id] = p;
    return merged;
  }, [profiles]);

  // Track which pitch is in view to autoplay it.
  useEffect(() => {
    const root = containerRef.current;
    if (!root || videos.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.index ?? 0);
            setActiveIndex(idx);
          }
        }
      },
      { root, threshold: [0.6] },
    );
    const items = root.querySelectorAll<HTMLElement>("[data-index]");
    items.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [videos.length]);

  async function toggleLike(video: Video) {
    if (!user) return;
    const isLiked = liked.has(video.id);
    setLiked((prev) => { const n = new Set(prev); if (isLiked) n.delete(video.id); else n.add(video.id); return n; });
    setVideos((prev) => prev.map((v) => v.id === video.id ? { ...v, likes_count: Math.max(0, (v.likes_count ?? 0) + (isLiked ? -1 : 1)) } : v));
    if (isLiked) await supabase.from("likes").delete().eq("user_id", user.id).eq("video_id", video.id);
    else await supabase.from("likes").insert({ user_id: user.id, video_id: video.id });
  }

  return (
    <div className="relative h-[calc(100vh-65px)] w-full overflow-hidden bg-black">
      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-4">
        <div className="pointer-events-auto">
          <div className="eyebrow text-white/80">Pitches</div>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-white drop-shadow">For you</h1>
        </div>
        <button
          className="btn-accent pointer-events-auto"
          onClick={() => setUploadOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>New pitch
        </button>
      </div>

      {loading ? (
        <div className="grid h-full place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        </div>
      ) : videos.length === 0 ? (
        <div className="grid h-full place-items-center px-5">
          <EmptyState
            title="No pitches yet"
            hint="Be the first to share your story. Record a vertical pitch (9:16) and get it in front of investors."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button className="btn-accent" onClick={() => setUploadOpen(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>Create your own pitch
                </button>
                <button className="btn-ghost" onClick={() => navigate("/create")}>Open pitch studio</button>
              </div>
            }
          />
        </div>
      ) : (
        <div
          ref={containerRef}
          className="h-full w-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {videos.map((v, i) => (
            <div key={v.id} data-index={i} className="h-full w-full snap-start snap-always">
              <PitchItem
                video={v}
                profile={profileMap[v.user_id]}
                liked={liked.has(v.id)}
                onLike={() => toggleLike(v)}
                active={i === activeIndex}
              />
            </div>
          ))}
        </div>
      )}

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onPublished={load} />
    </div>
  );
}
