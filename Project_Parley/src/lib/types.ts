export type UserType = "founder" | "investor" | "casual";

export type Profile = {
  id: string;
  user_type: UserType;
  name: string;
  username?: string | null;
  avatar?: string | null;
  company?: string | null;
  bio?: string | null;
  stage?: string | null;
  sector?: string | null;
  funding_goal?: string | null;
  traction?: string | null;
  location?: string | null;
  fit_answers?: Record<string, unknown> | null;
  compatibility_vector?: unknown[] | null;
  preferred_stages?: string[] | null;
  preferred_sectors?: string[] | null;
  check_size?: string | null;
  board_style?: string | null;
  investor_vector?: unknown[] | null;
  verified?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Intent = "invest_now" | "hiring" | "open_to_talk";

export const INTENT_LABELS: Record<Intent, string> = {
  invest_now: "Invest Now",
  hiring: "Hiring",
  open_to_talk: "Open to talk",
};

export const USER_TYPE_LABELS: Record<UserType, string> = {
  founder: "Founder",
  investor: "Investor",
  casual: "Casual",
};

export type Video = {
  id: string;
  user_id: string;
  url: string;
  poster?: string | null;
  title: string;
  description?: string;
  tags?: string[] | null;
  intent?: string[] | null;
  traction?: Record<string, unknown> | null;
  stage?: string | null;
  sector?: string | null;
  location?: string | null;
  likes_count?: number;
  is_sample?: boolean;
  created_at?: string;
};

export type Like = { user_id: string; video_id: string; created_at?: string };

export type MatchStatus = "suggested" | "requested" | "accepted" | "declined";

export type Match = {
  id: string;
  founder_id: string;
  investor_id: string;
  score: number;
  reason?: string;
  status: MatchStatus;
  is_sample?: boolean;
  created_at?: string;
};

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  nda_required?: boolean;
  is_sample?: boolean;
  created_at?: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at?: string;
};

export type Intro = {
  id: string;
  investor_id: string;
  founder_id: string;
  video_id?: string | null;
  match_id?: string | null;
  note?: string;
  status: "pending" | "accepted" | "declined";
  created_at?: string;
};

export type VideoInsert = Omit<Video, "id" | "created_at" | "likes_count" | "is_sample"> & {
  id?: string;
  likes_count?: number;
  is_sample?: boolean;
};
