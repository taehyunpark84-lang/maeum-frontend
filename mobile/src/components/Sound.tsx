import { Image, View } from "react-native";
import Slider from "@react-native-community/slider";
import { places } from "../config/assets";
import { useStore } from "../storage/store";
import type { PlaceId } from "../types";
import { Copy, IconButton, styles } from "./ui";
export function Sound({ placeId }: { placeId: PlaceId }) {
  const { state, update } = useStore();
  const p = places[placeId];
  const volume = state.settings.volume;
  const setVolume = (value: number) =>
    update((s) => ({ ...s, settings: { ...s.settings, volume: value } }));
  return (
    <View style={{ backgroundColor: "#EEEDE5", borderRadius: 20, padding: 10 }}>
      <View style={styles.row}>
        <Image
          source={p.background}
          style={{ width: 36, height: 36, borderRadius: 10 }}
        />
        <View style={{ flex: 1 }}>
          <Copy>{p.sound}</Copy>
          <Copy muted>음원 준비 중</Copy>
        </View>
        <IconButton
          name="play"
          label="음원 준비 중: 재생 불가"
          disabled
          onPress={() => {}}
        />
      </View>
      <View style={styles.row}>
        <IconButton
          name={volume === 0 ? "volume-mute" : "volume-low"}
          label={volume === 0 ? "볼륨 50%로 복원" : "볼륨 설정 음소거"}
          onPress={() => setVolume(volume === 0 ? 0.5 : 0)}
        />
        <Slider
          accessibilityLabel="볼륨 설정 (음원 준비 중)"
          style={{ flex: 1, height: 44 }}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={volume}
          onSlidingComplete={setVolume}
          minimumTrackTintColor={p.color}
          thumbTintColor={p.color}
        />
        <Copy muted>{Math.round(volume * 100)}%</Copy>
      </View>
    </View>
  );
}
