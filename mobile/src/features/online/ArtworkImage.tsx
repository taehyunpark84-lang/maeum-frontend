import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type ComponentRef,
} from "react";
import {
  View,
  StyleSheet,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { API_URL, authHeaders } from "../../services/api";
import {
  artworkSource,
  imageIsNearViewport,
} from "../../services/artworkImages";

type Check = (top: number, height: number) => void;
export type ImageViewport = {
  refresh: () => void;
  enable: () => void;
  subscribe: (check: Check) => () => void;
};

// 기존 ScrollView의 레이아웃은 유지하고 이미지 요청 여부만 결정합니다.
export function useImageViewport(
  scroll: RefObject<ScrollViewInstance | null>,
  waitForInitialScroll = false,
): ImageViewport {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const enabled = useRef(!waitForInitialScroll);
  const tracker = useMemo(() => {
    const checks = new Set<Check>();
    const refresh = () => {
      clearTimeout(timer.current);
      // 초기 채팅의 scrollToEnd 및 레이아웃 계산이 끝난 뒤 위치를 판단합니다.
      timer.current = setTimeout(() => {
        if (!enabled.current) return;
        scroll.current?.measureInWindow((_x, top, _width, height) => {
          for (const check of checks) check(top, height);
        });
      }, 60);
    };
    return {
      refresh,
      enable() {
        enabled.current = true;
        refresh();
      },
      subscribe(check: Check) {
        checks.add(check);
        refresh();
        return () => {
          checks.delete(check);
        };
      },
      dispose() {
        clearTimeout(timer.current);
        checks.clear();
      },
    };
  }, [scroll]);
  useEffect(() => () => tracker.dispose(), [tracker]);
  return tracker;
}

export default function ArtworkImage({
  id,
  scope,
  preview = false,
  viewport,
  style,
}: {
  id: string;
  scope: string;
  preview?: boolean;
  viewport?: ImageViewport;
  style: StyleProp<ViewStyle>;
}) {
  const container = useRef<ComponentRef<typeof View>>(null);
  const [visible, setVisible] = useState(!viewport);
  const [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (!viewport) return;
    let alive = true;
    const unsubscribe = viewport.subscribe((top, height) => {
      container.current?.measureInWindow((_x, y, _w, h) => {
        if (alive) setVisible(imageIsNearViewport(y, h, top, height));
      });
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [viewport]);
  const source = useMemo(
    () =>
      artworkSource(API_URL, scope, id, preview && !fallback, authHeaders()),
    [scope, id, preview, fallback],
  );
  return (
    <View
      ref={container}
      collapsable={false}
      style={[style, { overflow: "hidden" }]}
      onLayout={() => viewport?.refresh()}
    >
      {visible && (
        <Image
          source={source}
          cachePolicy="memory-disk"
          contentFit="contain"
          priority="high"
          recyclingKey={source.cacheKey}
          style={StyleSheet.absoluteFill}
          onError={() => {
            if (preview && !fallback) setFallback(true);
          }}
        />
      )}
    </View>
  );
}
