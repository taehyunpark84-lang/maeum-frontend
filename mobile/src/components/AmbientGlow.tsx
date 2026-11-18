import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  StyleSheet,
  View,
} from "react-native";
import type { PlaceId } from "../types";

// Pale highlights, separate from the darker button/accent colors.
const lightColors: Record<PlaceId, string> = {
  forest: "#C8F59B",
  ocean: "#FFD7AD",
  cafe: "#FFE1B2",
  temple: "#E2EBC2",
  garden: "#F7CEE1",
  cathedral: "#F8E8B9",
};
// 빛의 중심을 바깥 테두리에 배치해 말풍선 사이의 여백에서도 보이게 합니다.
// 가장자리 폭은 기존 0.28의 2.5배. 색상·강도·재생 주기는 유지합니다.
const edgePatches = [
  {
    x: 0.98,
    y: 0.24,
    w: 0.7,
    h: 0.46,
    angle: 0,
    peak: 0.46,
    delay: 0,
    rise: 3600,
    fall: 6200,
  },
  {
    x: 0.02,
    y: 0.39,
    w: 0.7,
    h: 0.38,
    angle: 0,
    peak: 0.36,
    delay: 2300,
    rise: 5400,
    fall: 7100,
  },
  {
    x: 0.02,
    y: 0.58,
    w: 0.7,
    h: 0.4,
    angle: 0,
    peak: 0.4,
    delay: 4900,
    rise: 6200,
    fall: 6800,
  },
  {
    x: 0.98,
    y: 0.53,
    w: 0.7,
    h: 0.32,
    angle: 0,
    peak: 0.3,
    delay: 3600,
    rise: 5800,
    fall: 7900,
  },
  {
    x: 0.98,
    y: 0.73,
    w: 0.7,
    h: 0.34,
    angle: 0,
    peak: 0.32,
    delay: 6800,
    rise: 5100,
    fall: 7300,
  },
];

// 배경만 보기에서도 풍경 안쪽의 빛을 느낄 수 있도록 기존 사선 군집 복원.
const diagonalPositions = [
  { x: 0.79, y: 0.24, w: 0.54, h: 0.46, angle: 32 },
  { x: 0.48, y: 0.39, w: 0.42, h: 0.38, angle: 39 },
  { x: 0.24, y: 0.58, w: 0.48, h: 0.4, angle: 27 },
  { x: 0.84, y: 0.53, w: 0.36, h: 0.32, angle: 35 },
  { x: 0.52, y: 0.73, w: 0.42, h: 0.34, angle: 42 },
];
const patches = [
  ...edgePatches,
  ...diagonalPositions.map((position, i) => ({
    ...edgePatches[i],
    ...position,
  })),
];

/** Decorative layer behind all chat controls; never changes image exposure. */
export type GlowStatus =
  | "loading"
  | "playing"
  | "off"
  | "reduced-motion"
  | "background"
  | "unavailable";

export function AmbientGlow({
  placeId,
  enabled = true,
  intensity = 0.85,
  speed = 2.5,
  onStatus,
}: {
  placeId: PlaceId;
  enabled?: boolean;
  intensity?: number;
  speed?: number;
  onStatus?: (status: GlowStatus) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [values] = useState(() => patches.map(() => new Animated.Value(0)));
  // Wait for the system preference before starting any motion.
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [preferenceError, setPreferenceError] = useState(false);
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    let alive = true;
    let changed = false;
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        changed = true;
        setPreferenceError(false);
        setReduceMotion(value);
      },
    );
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive && !changed) setReduceMotion(value);
      })
      .catch(() => {
        if (alive) setPreferenceError(true);
      });
    const state = AppState.addEventListener("change", (value) =>
      setActive(value === "active"),
    );
    return () => {
      alive = false;
      motion?.remove();
      state?.remove();
    };
  }, []);

  useEffect(() => {
    onStatus?.(
      !enabled
        ? "off"
        : preferenceError
          ? "unavailable"
          : reduceMotion === null
            ? "loading"
            : reduceMotion
              ? "reduced-motion"
              : !active
                ? "background"
                : "playing",
    );
  }, [active, enabled, onStatus, preferenceError, reduceMotion]);

  useEffect(() => {
    values.forEach((value) => value.setValue(0));
    if (!enabled || reduceMotion !== false || preferenceError || !active)
      return;
    const animations = patches.map((patch, i) => {
      const timing = (toValue: number, duration: number) =>
        Animated.timing(values[i], {
          toValue,
          duration: duration / speed,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        });
      return Animated.sequence([
        Animated.delay(patch.delay / speed),
        Animated.loop(
          Animated.sequence([
            timing(Math.min(0.9, patch.peak * 1.9 * intensity), patch.rise),
            timing(0, patch.fall),
            Animated.delay((1700 + i * 430) / speed),
          ]),
        ),
      ]);
    });
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      values.forEach((value) => value.setValue(0));
    };
  }, [
    active,
    enabled,
    intensity,
    speed,
    preferenceError,
    reduceMotion,
    placeId,
    values,
  ]);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.layer}
      onLayout={({ nativeEvent: { layout } }) => {
        setSize((old) =>
          old.width === layout.width && old.height === layout.height
            ? old
            : { width: layout.width, height: layout.height },
        );
      }}
    >
      {patches.map((patch, i) => (
        <Animated.Image
          key={i}
          source={require("../../assets/effects/soft-glow.png")}
          resizeMode="stretch"
          style={{
            position: "absolute",
            width: size.width * patch.w,
            height: size.height * patch.h,
            left: size.width * (patch.x - patch.w / 2),
            top: size.height * (patch.y - patch.h / 2),
            tintColor: lightColors[placeId],
            opacity: values[i],
            transform: [{ rotate: `${patch.angle}deg` }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
