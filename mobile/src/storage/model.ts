import type { AppState } from "../types";
export function initialState(): AppState {
  return {
    version: 1,
    settings: {
      nickname: "",
      selectedPlaceId: "forest",
      volume: 0.5,
      audioEnabled: false,
      audioMuted: false,
      audioLoop: true,
      glowEnabled: true,
      glowIntensity: 0.85,
      glowSpeed: 2.5,
    },
    sessions: [],
    diaries: [],
    posts: [],
    links: {},
    blockedAliases: [],
  };
}
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const strings = (x: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof x[k] === "string");
const list = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((v) => typeof v === "string");
const place = (x: unknown) =>
  ["forest", "ocean", "cafe", "temple", "garden", "cathedral"].includes(
    String(x),
  );
export function restore(raw: string | null): {
  state: AppState;
  recovered: boolean;
} {
  if (!raw) return { state: initialState(), recovered: false };
  try {
    const x: unknown = JSON.parse(raw);
    if (
      !object(x) ||
      x.version !== 1 ||
      !object(x.settings) ||
      !strings(x.settings, ["nickname"]) ||
      !place(x.settings.selectedPlaceId) ||
      typeof x.settings.volume !== "number" ||
      x.settings.volume < 0 ||
      x.settings.volume > 1 ||
      !list(x.blockedAliases) ||
      !object(x.links) ||
      !Object.values(x.links).every((v) => typeof v === "string")
    )
      throw Error();
    if (
      !Array.isArray(x.sessions) ||
      !x.sessions.every(
        (s) =>
          object(s) &&
          strings(s, ["id", "createdAt", "updatedAt"]) &&
          place(s.placeId) &&
          Array.isArray(s.messages) &&
          s.messages.every(
            (m) =>
              object(m) &&
              strings(m, ["id", "text", "createdAt"]) &&
              ["user", "assistant"].includes(String(m.role)) &&
              ["sent", "pending", "failed"].includes(String(m.status)),
          ),
      )
    )
      throw Error();
    if (
      !Array.isArray(x.diaries) ||
      !x.diaries.every(
        (d) =>
          object(d) &&
          strings(d, [
            "id",
            "sessionId",
            "title",
            "poem",
            "summary",
            "interpretation",
            "createdAt",
            "updatedAt",
          ]) &&
          d.imageKey === "demo-art" &&
          list(d.userConfirmedEmotions) &&
          ["private", "shared"].includes(String(d.visibility)),
      )
    )
      throw Error();
    if (
      !Array.isArray(x.posts) ||
      !x.posts.every(
        (p) =>
          object(p) &&
          strings(p, ["id", "alias", "title", "poem", "createdAt"]) &&
          p.imageKey === "demo-art" &&
          typeof p.reactions === "number" &&
          typeof p.reacted === "boolean" &&
          list(p.comments),
      )
    )
      throw Error();
    const state = x as unknown as AppState;
    state.settings.audioEnabled = false;
    // Version 1 records predating real playback have neither field.
    state.settings.audioMuted = x.settings.audioMuted === true;
    state.settings.audioLoop = x.settings.audioLoop !== false;
    state.settings.glowEnabled = x.settings.glowEnabled !== false;
    state.settings.glowIntensity =
      typeof x.settings.glowIntensity === "number" &&
      Number.isFinite(x.settings.glowIntensity)
        ? Math.max(0.2, Math.min(1, x.settings.glowIntensity))
        : 0.85;
    state.settings.glowSpeed =
      typeof x.settings.glowSpeed === "number" &&
      Number.isFinite(x.settings.glowSpeed)
        ? Math.max(0.5, Math.min(3, x.settings.glowSpeed))
        : 2.5;
    state.sessions.forEach((s) =>
      s.messages.forEach((m) => {
        if (m.status === "pending") m.status = "failed";
      }),
    );
    return { state, recovered: false };
  } catch {
    return { state: initialState(), recovered: true };
  }
}
