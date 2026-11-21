import assert from "node:assert/strict";
import test from "node:test";
import { splitChatDisplay } from "../src/services/chatDisplay";
import type { OnlineMessage } from "../src/services/api";

const message = (id: number, role: OnlineMessage["role"]): OnlineMessage => ({
  id,
  role,
  text: "test",
  created: 1,
});
test("entry hides past messages but keeps them scrollable when enabled", () => {
  const rows = [message(1, "user"), message(2, "assistant")];
  assert.deepEqual(splitChatDisplay(rows, 2, false), {
    previous: [],
    current: [],
  });
  assert.deepEqual(splitChatDisplay(rows, 2, true), {
    previous: rows,
    current: [],
  });
  assert.equal(rows.length, 2);
});
test("only latest turn and following artwork remain at bottom; earlier turns scroll", () => {
  const rows = [
    message(1, "user"),
    message(2, "assistant"),
    message(3, "user"),
    message(4, "assistant"),
    message(5, "assistant"),
  ];
  let result = splitChatDisplay(rows, 0, false);
  assert.deepEqual(
    result.previous.map((m) => m.id),
    [1, 2],
  );
  assert.deepEqual(
    result.current.map((m) => m.id),
    [3, 4, 5],
  );
  result = splitChatDisplay([...rows, message(-123, "user")], 2, false);
  assert.deepEqual(
    result.current.map((m) => m.id),
    [-123],
  );
  assert.deepEqual(
    result.previous.map((m) => m.id),
    [3, 4, 5],
  );
});
