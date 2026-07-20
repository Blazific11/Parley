import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import type { Conversation, Message, Profile } from "../lib/types";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data: c } = await supabase.from("conversations").select("*").or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order("created_at", { ascending: false });
    const cList = (c ?? []) as Conversation[];
    setConversations(cList);
    const otherIds = cList.map((x) => (x.user_a === user.id ? x.user_b : x.user_a));
    if (otherIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("*").in("id", otherIds);
      const pList = (p ?? []) as Profile[];
      setProfiles(Object.fromEntries(pList.map((x) => [x.id, x])));
    }
    setLoading(false);
  }

  async function loadMessages(c: Conversation) {
    setActive(c);
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", c.id).order("created_at");
    setMessages((data ?? []) as Message[]);
  }

  async function send() {
    if (!user || !active || !draft.trim()) return;
    const { data } = await supabase.from("messages").insert({ conversation_id: active.id, sender_id: user.id, content: draft.trim() }).select("*").single();
    if (data) setMessages((prev) => [...prev, data as Message]);
    setDraft("");
  }

  useEffect(() => { load(); }, [user?.id]);

  if (loading) return <p className="px-5 py-8 text-muted sm:px-8">Loading…</p>;
  if (conversations.length === 0) return (<div className="shell px-5 py-8 sm:px-8"><EmptyState title="No conversations yet" hint="Accept a match to start messaging." /></div>);

  return (
    <div className="shell px-5 py-8 sm:px-8">
      <div className="mb-8">
        <div className="eyebrow">Messages</div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">Conversations</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card divide-y divide-line">
          {conversations.map((c) => {
            const otherId = c.user_a === user?.id ? c.user_b : c.user_a;
            const other = profiles[otherId];
            return (
              <button key={c.id} className={`flex w-full items-center gap-3 p-4 text-left transition-colors ${active?.id === c.id ? "bg-surface-2" : "hover:bg-surface-2/50"}`} onClick={() => loadMessages(c)}>
                <Avatar name={other?.name ?? "Unknown"} src={other?.avatar} size={40} />
                <div className="min-w-0"><p className="truncate font-medium">{other?.name ?? "Unknown"}</p><p className="truncate text-xs text-muted">{other?.company ?? ""}</p></div>
              </button>
            );
          })}
        </div>
        <div className="card flex flex-col md:col-span-2">
          {active ? (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto p-5" style={{ maxHeight: "60vh" }}>
                {messages.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.sender_id === user?.id ? "ml-auto bg-gradient-to-br from-accent-from to-accent-to text-white" : "bg-surface-2 text-white ring-1 ring-line"}`}>{m.content}</div>
                ))}
              </div>
              <div className="flex gap-2 border-t border-line p-4">
                <input className="input" placeholder="Type a message…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
                <button className="btn-accent shrink-0" onClick={send}>Send</button>
              </div>
            </>
          ) : (<div className="grid h-full place-items-center p-6 text-muted">Select a conversation</div>)}
        </div>
      </div>
    </div>
  );
}
