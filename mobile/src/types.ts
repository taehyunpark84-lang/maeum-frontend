export type PlaceId =
  "forest" | "ocean" | "cafe" | "temple" | "garden" | "cathedral";
export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  status: "sent" | "pending" | "failed";
};
export type Session = {
  id: string;
  placeId: PlaceId;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  isDemo?: boolean;
};
export type Diary = {
  id: string;
  sessionId: string;
  title: string;
  poem: string;
  imageKey: "demo-art";
  summary: string;
  userConfirmedEmotions: string[];
  interpretation: string;
  createdAt: string;
  updatedAt: string;
  visibility: "private" | "shared";
};
export type ApprovedSnapshot = Pick<Diary, "title" | "poem" | "imageKey">;
export type Post = ApprovedSnapshot & {
  id: string;
  alias: string;
  reactions: number;
  reacted: boolean;
  createdAt: string;
  comments: string[];
};
export type Settings = {
  nickname: string;
  selectedPlaceId: PlaceId;
  volume: number;
  audioEnabled: false;
  audioMuted: boolean;
  audioLoop: boolean;
  glowEnabled: boolean;
  glowIntensity: number;
  glowSpeed: number;
};
export type AppState = {
  version: 1;
  settings: Settings;
  sessions: Session[];
  diaries: Diary[];
  posts: Post[];
  links: Record<string, string>;
  blockedAliases: string[];
};
