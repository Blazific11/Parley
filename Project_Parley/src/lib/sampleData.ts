import type { Profile } from "./types";

export const sampleFounders: Profile[] = [
  { id: "f1", user_type: "founder", name: "Avery Chen", avatar: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=200", company: "Nimbus AI", bio: "On-device inference for mobile apps.", stage: "Seed", sector: "AI", funding_goal: "$1.5M", traction: "12k DAU, $8k MRR", location: "San Francisco, CA", verified: false },
  { id: "f2", user_type: "founder", name: "Marcus Patel", avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200", company: "Tidewell", bio: "Smart water meters for multifamily housing.", stage: "Pre-seed", sector: "Climate", funding_goal: "$600k", traction: "3 pilots live", location: "Austin, TX", verified: false },
  { id: "f3", user_type: "founder", name: "Priya Okonkwo", avatar: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=200", company: "Cartograph Health", bio: "Care navigation for rare disease patients.", stage: "Series A", sector: "Healthcare", funding_goal: "$8M", traction: "$1.2M ARR, 18 health systems", location: "Boston, MA", verified: false },
];

export const sampleInvestors: Profile[] = [
  { id: "i1", user_type: "investor", name: "Dana Whitfield", avatar: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200", company: "Northwind Capital", bio: "Early-stage AI and developer tools.", preferred_stages: ["Pre-seed", "Seed"], preferred_sectors: ["AI", "DevTools"], check_size: "$250k–$1M", board_style: "Active partner", verified: true },
  { id: "i2", user_type: "investor", name: "Hiro Tanaka", avatar: "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=200", company: "Sapporo Ventures", bio: "Climate and industrial tech.", preferred_stages: ["Seed", "Series A"], preferred_sectors: ["Climate", "Industrial"], check_size: "$500k–$2M", board_style: "Hands-off", verified: true },
];

export const sampleProfiles: Profile[] = [...sampleFounders, ...sampleInvestors];
export const sampleVideos: any[] = [];
