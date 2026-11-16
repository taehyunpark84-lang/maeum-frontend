import test from "node:test";
import assert from "node:assert/strict";
import {
  AmbientAudio,
  type AmbientPlayer,
  type PlaybackStatus,
} from "../src/services/ambientAudio";
import { initialState, restore } from "../src/storage/model";

class Player implements AmbientPlayer {
  volume = 0.5;
  muted = false;
  loop = false;
  removed = false;
  plays = 0;
  currentStatus: PlaybackStatus = {
    isLoaded: true,
    playing: false,
    isBuffering: false,
    currentTime: 0,
    duration: 24,
    didJustFinish: false,
    error: null,
  };
  listener: ((s: PlaybackStatus) => void) | null = null;
  emit(patch: Partial<PlaybackStatus>) {
    this.currentStatus = { ...this.currentStatus, ...patch };
    this.listener?.(this.currentStatus);
  }
  play() {
    this.plays++;
    this.emit({ playing: true });
  }
  pause() {
    this.emit({ playing: false });
  }
  async seekTo(seconds: number) {
    this.emit({ currentTime: seconds, didJustFinish: false });
  }
  remove() {
    this.removed = true;
  }
  addListener(_event: string, listener: (s: PlaybackStatus) => void) {
    this.listener = listener;
    return {
      remove: () => {
        this.listener = null;
      },
    };
  }
}
function setup(configure = async () => {}) {
  const players: Player[] = [];
  const audio = new AmbientAudio(() => {
    const p = new Player();
    players.push(p);
    return p;
  }, configure);
  return { audio, players };
}
test("room replacement releases the previous player; missing audio creates none", async () => {
  const { audio, players } = setup();
  audio.select("forest", 1);
  await audio.play();
  const stale = players[0].listener!;
  audio.select("ocean", 2);
  assert.equal(players[0].removed, true);
  assert.equal(players[0].currentStatus.playing, false);
  assert.equal(players[1].plays, 0);
  stale({ ...players[0].currentStatus, playing: true });
  assert.equal(audio.getSnapshot().playing, false);
  audio.select("temple", null);
  await audio.play();
  assert.equal(players[1].removed, true);
  assert.equal(players.length, 2);
  assert.equal(audio.getSnapshot().available, false);
  audio.dispose();
});
test("same room preview-to-chat preserves player; pause resumes, stop resets", async () => {
  const { audio, players } = setup();
  audio.select("forest", 1);
  await audio.play();
  players[0].emit({ currentTime: 8 });
  audio.select("forest", 1);
  assert.equal(players.length, 1);
  audio.pause();
  assert.equal(audio.getSnapshot().currentTime, 8);
  await audio.play();
  assert.equal(audio.getSnapshot().currentTime, 8);
  await audio.stop();
  assert.equal(audio.getSnapshot().currentTime, 0);
  assert.equal(audio.getSnapshot().playing, false);
  audio.dispose();
});
test("late audio setup cannot play an old room or start after backgrounding", async () => {
  let finish!: () => void;
  const { audio, players } = setup(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  audio.select("forest", 1);
  const play = audio.play();
  audio.select("ocean", 2);
  finish();
  await play;
  assert.equal(players[0].plays, 0);
  const second = audio.play();
  audio.setForeground(false);
  finish();
  await second;
  audio.setForeground(true);
  assert.equal(players[1].plays, 0);
  assert.equal(audio.getSnapshot().starting, false);
  audio.dispose();
});
test("volume, mute, loop apply to current and future players without starting them", () => {
  const { audio, players } = setup();
  audio.setPreferences({ volume: 0.7, muted: true, loop: false });
  audio.select("forest", 1);
  assert.equal(players[0].volume, 0.7);
  assert.equal(players[0].muted, true);
  assert.equal(players[0].loop, false);
  audio.setPreferences({ volume: 0.7, muted: false, loop: true });
  assert.equal(players[0].volume, 0.7);
  assert.equal(players[0].muted, false);
  assert.equal(players[0].loop, true);
  assert.equal(players[0].plays, 0);
  audio.dispose();
});
test("non-looping completion can replay from zero; native errors allow retry", async () => {
  const { audio, players } = setup();
  audio.select("forest", 1);
  players[0].emit({ didJustFinish: true, currentTime: 24 });
  await audio.play();
  assert.equal(players[0].currentStatus.currentTime, 0);
  players[0].emit({ error: "decode failed" });
  assert.equal(players[0].removed, true);
  assert.ok(audio.getSnapshot().error);
  audio.retry();
  assert.equal(players.length, 2);
  assert.equal(audio.getSnapshot().error, null);
  await audio.play();
  assert.equal(players[1].plays, 1);
  audio.dispose();
});
test("existing saved data receives playback defaults; preferences survive restart", () => {
  const old = JSON.parse(JSON.stringify(initialState()));
  delete old.settings.audioMuted;
  delete old.settings.audioLoop;
  const migrated = restore(JSON.stringify(old));
  assert.equal(migrated.recovered, false);
  assert.equal(migrated.state.settings.audioLoop, true);
  assert.equal(migrated.state.settings.audioMuted, false);
  migrated.state.settings.audioLoop = false;
  migrated.state.settings.audioMuted = true;
  migrated.state.settings.volume = 0.65;
  const next = restore(JSON.stringify(migrated.state));
  assert.equal(next.state.settings.audioMuted, true);
  assert.equal(next.state.settings.audioLoop, false);
  assert.equal(next.state.settings.volume, 0.65);
  assert.equal(next.state.settings.audioEnabled, false);
});

test("light settings migrate older saves, persist, and clamp invalid ranges", () => {
  const old = JSON.parse(JSON.stringify(initialState()));
  delete old.settings.glowEnabled;
  delete old.settings.glowIntensity;
  delete old.settings.glowSpeed;
  const migrated = restore(JSON.stringify(old));
  assert.equal(migrated.recovered, false);
  assert.equal(migrated.state.settings.glowEnabled, true);
  assert.equal(migrated.state.settings.glowIntensity, 0.85);
  assert.equal(migrated.state.settings.glowSpeed, 2.5);
  Object.assign(migrated.state.settings, {
    glowEnabled: false,
    glowIntensity: 0.4,
    glowSpeed: 1.2,
  });
  const restored = restore(JSON.stringify(migrated.state)).state.settings;
  assert.equal(restored.glowEnabled, false);
  assert.equal(restored.glowIntensity, 0.4);
  assert.equal(restored.glowSpeed, 1.2);
  Object.assign(old.settings, { glowIntensity: 12, glowSpeed: -3 });
  const clamped = restore(JSON.stringify(old)).state.settings;
  assert.equal(clamped.glowIntensity, 1);
  assert.equal(clamped.glowSpeed, 0.5);
});
