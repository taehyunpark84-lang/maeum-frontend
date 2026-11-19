import { Image, Switch, View } from "react-native";
import Slider from "@react-native-community/slider";
import { places, audioSources } from "../config/assets";
import { useStore } from "../storage/store";
import type { PlaceId, Settings } from "../types";
import { Button, Copy, IconButton, styles } from "./ui";
import { useAmbientAudio } from "./AmbientAudioProvider";
export function Sound({ placeId }: { placeId: PlaceId }) {
  const { state, update } = useStore();
  const { audio, status } = useAmbientAudio();
  const p = places[placeId];
  const { volume, audioMuted, audioLoop } = state.settings;
  const available = audioSources[placeId] !== null;
  const current = status.placeId === placeId;
  const ready = current && status.isLoaded && !status.error;
  const muted = audioMuted || volume === 0;
  const playing = current && status.playing;
  function preferences(
    patch: Partial<Pick<Settings, "volume" | "audioMuted" | "audioLoop">>,
  ) {
    const next = { ...state.settings, ...patch };
    audio.setPreferences({
      volume: next.volume,
      muted: next.audioMuted,
      loop: next.audioLoop,
    });
    update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }
  const description = !available
    ? "음원 준비 중"
    : current && status.error
      ? "음원을 불러오지 못했어요"
      : !ready
        ? "음원 불러오는 중…"
        : status.starting
          ? "재생 준비 중…"
          : status.isBuffering
            ? "음원 버퍼링 중…"
            : playing
              ? muted
                ? "재생 중 · 음소거"
                : "재생 중"
              : status.didJustFinish
                ? "재생 완료"
                : status.currentTime > 0
                  ? "일시정지"
                  : "재생 버튼을 눌러주세요";
  return (
    <View
      style={{
        backgroundColor: "#EEEDE5",
        borderRadius: 20,
        padding: 12,
        gap: 10,
      }}
    >
      <View style={styles.row}>
        <Image
          source={p.background}
          style={{ width: 36, height: 36, borderRadius: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Copy>{p.sound}</Copy>
          <Copy muted>{description}</Copy>
        </View>
        <IconButton
          name={playing || (status.starting && current) ? "pause" : "play"}
          label={
            !available
              ? "음원 준비 중: 재생 불가"
              : playing || (status.starting && current)
                ? "배경음 일시정지"
                : "배경음 재생"
          }
          disabled={!ready}
          onPress={() =>
            playing || status.starting ? audio.pause() : void audio.play()
          }
        />
      </View>
      {current && status.error && (
        <>
          <Copy>{status.error}</Copy>
          <Button
            label="음원 다시 불러오기"
            secondary
            onPress={() => audio.retry()}
          />
        </>
      )}
      <View style={styles.row}>
        <IconButton
          name={muted ? "volume-mute" : "volume-low"}
          label={muted ? "배경음 음소거 해제" : "배경음 음소거"}
          onPress={() =>
            preferences(
              muted
                ? {
                    audioMuted: false,
                    ...(volume === 0 ? { volume: 0.5 } : {}),
                  }
                : { audioMuted: true },
            )
          }
        />
        <Slider
          accessibilityLabel="배경음 볼륨"
          style={{ flex: 1, height: 44 }}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={volume}
          onValueChange={(value) =>
            preferences({ volume: value, audioMuted: false })
          }
          minimumTrackTintColor={p.color}
          thumbTintColor={p.color}
        />
        <Copy muted>{Math.round(volume * 100)}%</Copy>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Copy>반복 재생</Copy>
        </View>
        <Switch
          accessibilityLabel="배경음 반복 재생"
          value={audioLoop}
          trackColor={{ true: p.color }}
          onValueChange={(value) => preferences({ audioLoop: value })}
        />
      </View>
      {!available && (
        <Copy muted>
          이 공간의 음원은 아직 준비 중이에요. 볼륨과 반복 설정은 저장돼요.
        </Copy>
      )}
    </View>
  );
}
