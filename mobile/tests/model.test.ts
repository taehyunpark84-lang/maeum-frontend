import test from "node:test";
import assert from "node:assert/strict";
import { initialState, restore } from "../src/storage/model";
import {
  ChatService,
  DiaryService,
  FeedService,
  mockConfig,
  newSession,
} from "../src/services/mock";

test("new places receive distinct sessions and preserve earlier conversation", () => {
  const forest = newSession("forest", "숲 인사");
  const ocean = newSession("ocean", "바다 인사");
  assert.notEqual(forest.id, ocean.id);
  assert.equal(forest.messages[0].text, "숲 인사");
  assert.equal(ocean.placeId, "ocean");
});

test("new room selections and conversations survive storage restore", () => {
  for (const placeId of ["garden", "cathedral"] as const) {
    const state = initialState();
    state.settings.selectedPlaceId = placeId;
    state.sessions = [
      newSession("forest", "기존 대화"),
      newSession(placeId, "새 대화"),
    ];
    const restored = restore(JSON.stringify(state));
    assert.equal(restored.recovered, false);
    assert.equal(restored.state.settings.selectedPlaceId, placeId);
    assert.deepEqual(restored.state.sessions, state.sessions);
  }
});
test("versioned restore retains nickname, volume, edited diary and recovers pending message", () => {
  const state = initialState();
  state.settings.nickname = "산책";
  state.settings.volume = 0.75;
  const session = newSession("forest", "안녕");
  session.messages[0].status = "pending";
  state.sessions.push(session);
  state.diaries.push({
    id: "diary",
    sessionId: session.id,
    title: "수정한 제목",
    poem: "수정한 본문",
    imageKey: "demo-art",
    summary: "개인 요약",
    userConfirmedEmotions: ["안도"],
    interpretation: "시연",
    createdAt: "2026-11-06",
    updatedAt: "2026-11-06",
    visibility: "private",
  });
  const restored = restore(JSON.stringify(state));
  assert.equal(restored.recovered, false);
  assert.equal(restored.state.settings.nickname, "산책");
  assert.equal(restored.state.settings.volume, 0.75);
  assert.equal(restored.state.diaries[0].poem, "수정한 본문");
  assert.equal(restored.state.sessions[0].messages[0].status, "failed");
});
test("malformed, partial and future storage recover without crashing", () => {
  for (const raw of [
    "{",
    '{"version":2}',
    JSON.stringify({ ...initialState(), sessions: [{ id: "bad" }] }),
  ])
    assert.equal(restore(raw).recovered, true);
  assert.equal(restore(null).recovered, false);
});
test("publication allowlist excludes private data even with extra runtime properties", async () => {
  mockConfig.delayMs = 1;
  const source = {
    title: "제목",
    poem: "승인 본문",
    imageKey: "demo-art" as const,
    sessionId: "secret",
    nickname: "실명",
    summary: "개인 요약",
    messages: ["비밀"],
    userConfirmedEmotions: ["슬픔"],
  };
  const post = await FeedService.publish(source);
  assert.deepEqual(
    Object.keys(post).sort(),
    [
      "id",
      "alias",
      "title",
      "poem",
      "imageKey",
      "reactions",
      "reacted",
      "createdAt",
      "comments",
    ].sort(),
  );
  assert.equal(JSON.stringify(post).includes("secret"), false);
  assert.equal(post.poem, "승인 본문");
});
test("mock failure is one-shot and retry succeeds", async () => {
  mockConfig.delayMs = 1;
  mockConfig.failNext = true;
  await assert.rejects(ChatService.send("session", "안녕", []), /시연 실패/);
  assert.equal((await ChatService.send("session", "안녕", [])).status, "sent");
});
test("generation cancellation produces no completed artifact", async () => {
  mockConfig.delayMs = 100;
  const controller = new AbortController();
  const promise = DiaryService.generate("승인 요약", controller.signal);
  controller.abort();
  await assert.rejects(promise, /취소됨/);
});

test("cancelled publication does not produce a public snapshot", async () => {
  mockConfig.delayMs = 100;
  const controller = new AbortController();
  const promise = FeedService.publish(
    { title: "제목", poem: "본문", imageKey: "demo-art" },
    controller.signal,
  );
  controller.abort();
  await assert.rejects(promise, /취소됨/);
});
