import type { PlaceId } from "../types";

export type PlaybackStatus = {
  isLoaded: boolean;
  playing: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  didJustFinish: boolean;
  error?: string | null;
};
export type AmbientPlayer = {
  volume: number;
  muted: boolean;
  loop: boolean;
  currentStatus: PlaybackStatus;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  remove(): void;
  addListener(
    event: "playbackStatusUpdate",
    listener: (s: PlaybackStatus) => void,
  ): { remove(): void };
};
export type AudioPreferences = {
  volume: number;
  muted: boolean;
  loop: boolean;
};
export type AmbientSnapshot = PlaybackStatus & {
  placeId: PlaceId | null;
  available: boolean;
  starting: boolean;
  error: string | null;
};
const empty = (): AmbientSnapshot => ({
  placeId: null,
  available: false,
  starting: false,
  error: null,
  isLoaded: false,
  playing: false,
  isBuffering: false,
  currentTime: 0,
  duration: 0,
  didJustFinish: false,
});

/** One owner for native resources; UI sheets never own the player's lifecycle. */
export class AmbientAudio {
  private player: AmbientPlayer | null = null;
  private subscription: { remove(): void } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private source: number | null = null;
  private request = 0;
  private foreground = true;
  private preferences: AudioPreferences = {
    volume: 0.5,
    muted: false,
    loop: true,
  };
  private snapshot = empty();
  private listeners = new Set<() => void>();

  constructor(
    private create: (source: number) => AmbientPlayer,
    private configure: () => Promise<void>,
  ) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(patch: Partial<AmbientSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  private release() {
    this.request++;
    this.clearTimer();
    this.subscription?.remove();
    this.subscription = null;
    const old = this.player;
    this.player = null;
    if (old) {
      // A reset native service may already have invalidated the old handle.
      try {
        old.pause();
      } catch {
        /* Still release the resource below. */
      }
      try {
        old.remove();
      } catch {
        /* Already released by the native service. */
      }
    }
  }
  select(placeId: PlaceId | null, source: number | null, force = false) {
    if (!force && this.snapshot.placeId === placeId && this.source === source)
      return;
    this.release();
    this.source = source;
    this.publish({ ...empty(), placeId, available: source !== null });
    if (source === null) return;
    try {
      const player = this.create(source);
      this.player = player;
      this.applyPreferences();
      const receive = (s: PlaybackStatus) => {
        if (this.player !== player) return;
        if (s.error) {
          this.fail();
          return;
        }
        if (s.isLoaded) this.clearTimer();
        // Ignore a late native play event after leaving the foreground.
        if (!this.foreground && s.playing) player.pause();
        this.publish({
          ...s,
          playing: this.foreground && s.playing,
          error: null,
        });
      };
      this.subscription = player.addListener("playbackStatusUpdate", receive);
      receive(player.currentStatus);
      if (!this.snapshot.isLoaded && !this.snapshot.error) {
        this.timer = setTimeout(() => {
          if (this.player === player && !this.snapshot.isLoaded) this.fail();
        }, 12000);
      }
    } catch {
      this.fail();
    }
  }
  private fail() {
    this.release();
    this.publish({
      playing: false,
      starting: false,
      isLoaded: false,
      error: "음원을 재생하지 못했어요. 다시 불러와 주세요.",
    });
  }
  retry() {
    this.select(this.snapshot.placeId, this.source, true);
  }
  setPreferences(preferences: AudioPreferences) {
    this.preferences = {
      ...preferences,
      volume: Math.max(0, Math.min(1, preferences.volume)),
    };
    try {
      this.applyPreferences();
    } catch {
      this.fail();
    }
  }
  private applyPreferences() {
    if (!this.player) return;
    this.player.volume = this.preferences.volume;
    this.player.muted = this.preferences.muted;
    this.player.loop = this.preferences.loop;
  }
  async play() {
    const player = this.player;
    if (
      !player ||
      !this.foreground ||
      !this.snapshot.isLoaded ||
      this.snapshot.starting
    )
      return;
    const request = ++this.request;
    this.publish({ starting: true });
    try {
      await this.configure();
      if (
        request !== this.request ||
        this.player !== player ||
        !this.foreground
      )
        return;
      if (
        this.snapshot.didJustFinish ||
        (this.snapshot.duration > 0 &&
          this.snapshot.currentTime >= this.snapshot.duration - 0.05)
      ) {
        await player.seekTo(0);
      }
      if (
        request !== this.request ||
        this.player !== player ||
        !this.foreground
      )
        return;
      player.play();
    } catch {
      if (request === this.request) this.fail();
    } finally {
      if (request === this.request) this.publish({ starting: false });
    }
  }
  pause() {
    this.request++;
    try {
      this.player?.pause();
      this.publish({ playing: false, starting: false });
    } catch {
      this.fail();
    }
  }
  async stop() {
    this.pause();
    const player = this.player;
    const request = this.request;
    if (!player || !this.snapshot.isLoaded) return;
    try {
      await player.seekTo(0);
      if (this.player === player && request === this.request)
        this.publish({ currentTime: 0, didJustFinish: false });
    } catch {
      if (this.player === player && request === this.request) this.fail();
    }
  }
  setForeground(active: boolean) {
    this.foreground = active;
    if (!active) this.pause();
    // Returning to the app does not unexpectedly restart the sound.
  }
  dispose() {
    this.release();
    this.source = null;
    this.publish(empty());
  }
}
