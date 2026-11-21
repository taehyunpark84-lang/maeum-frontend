import type { OnlineMessage } from "./api";

// 서버 기록과 AI 기억은 그대로 두고, 이번 입장 시점의 화면 범위만 나눕니다.
export function splitChatDisplay(
  messages: OnlineMessage[],
  entryThrough: number,
  showHistory: boolean,
) {
  const visible = messages.filter(
    (m) => showHistory || m.id < 0 || m.id > entryThrough,
  );
  let start = visible.length;
  for (let i = visible.length - 1; i >= 0; i--) {
    if (visible[i].id > 0 && visible[i].id <= entryThrough) break;
    start = i;
    if (visible[i].role === "user") break;
  }
  return { previous: visible.slice(0, start), current: visible.slice(start) };
}
