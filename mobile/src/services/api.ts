import { fetch as streamingFetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { PlaceId } from "../types";

// 주소만 공개 설정입니다. OpenAI 키는 backend/.env에서만 읽습니다.
export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
export type Account = { id: string; nickname: string; ai_mode: string };
export type OnlineSession = { id: string; place_id: PlaceId; created: number };
export type OnlineMessage = {
  place_id?: PlaceId;
  artwork?: Artwork | null;
  id: number;
  role: "user" | "assistant";
  text: string;
  created: number;
};
export type GenerationJob = {
  id: string;
  session_id: string;
  status: string;
  stage: string;
  error: string;
  attempts: number;
  created: number;
};
export type Artwork = {
  id: string;
  job_id: string;
  title: string;
  poem: string;
  interpretation: string;
  created: number;
};
export type Metric = {
  kind: string;
  model: string;
  seconds: number;
  first_token_seconds: number | null;
  usage: Record<string, unknown>;
  settings: Record<string, unknown>;
};

const TOKEN_KEY = "maeum.api.token";
let token = "";
export const authHeaders = (): Record<string, string> =>
  token ? { Authorization: `Bearer ${token}` } : {};
export async function restoreToken() {
  // 웹 미리보기에서는 메모리만 사용합니다. 네이티브에서는 OS 보안 저장소를 사용합니다.
  token =
    Platform.OS === "web"
      ? ""
      : (await SecureStore.getItemAsync(TOKEN_KEY)) || "";
  return !!token;
}
export async function saveToken(value: string) {
  if (Platform.OS !== "web") {
    if (value) await SecureStore.setItemAsync(TOKEN_KEY, value);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  token = value;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    path.endsWith("/preview") ? 180000 : 20000,
  );
  try {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof result.detail === "string"
          ? result.detail
          : "입력값을 확인해 주세요.",
      );
    return result as T;
  } finally {
    clearTimeout(timeout);
  }
}
export function requestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
export type ChatEvent = {
  type: "delta" | "stage" | "error" | "done";
  text?: string;
  message?: OnlineMessage;
};
export async function streamChat(
  sessionId: string,
  text: string,
  id: string,
  onEvent: (event: ChatEvent) => void,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 150000);
  try {
    const response = await streamingFetch(
      `${API_URL}/sessions/${sessionId}/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ text, request_id: id }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new ApiError(
        response.status,
        error.detail || "채팅 요청에 실패했습니다.",
      );
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("스트리밍을 시작할 수 없습니다.");
    const decoder = new TextDecoder();
    let pending = "";
    let completed = false;
    while (true) {
      const { value, done } = await reader.read();
      pending += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === "error") throw new Error(event.text);
        if (event.type === "done") completed = true;
        onEvent(event);
      }
      if (done) break;
    }
    if (!completed)
      throw new Error("연결이 끊겼습니다. 같은 메시지로 재시도해 주세요.");
  } finally {
    clearTimeout(timeout);
  }
}
