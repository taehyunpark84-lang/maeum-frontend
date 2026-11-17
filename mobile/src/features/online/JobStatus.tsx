import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Button, Copy, styles } from "../../components/ui";
import type { GenerationJob } from "../../services/api";

const labels: Record<string, string> = {
  queued: "작업 순서를 기다려요",
  writing: "시와 작품의 이야기를 구상해요",
  drawing: "마음을 그림으로 표현하고 있어요",
  explaining: "그림과 시를 소개할 이야기를 준비해요",
  saving: "작품을 보관하고 있어요",
  completed: "작품을 완성했어요",
  failed: "생성을 마치지 못했어요",
};
export default function JobStatus({
  job,
  onRetry,
  retryDisabled,
  compact = false,
}: {
  job: GenerationJob;
  onRetry: () => void;
  retryDisabled: boolean;
  compact?: boolean;
}) {
  const [pulse] = useState(() => new Animated.Value(0.25));
  const active = ["queued", "running"].includes(job.status);
  useEffect(() => {
    if (!active) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.25,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [active, pulse]);
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <Copy>{labels[job.stage] || "작품을 준비하고 있어요"}</Copy>
      {active && (
        <>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={labels[job.stage]}
            style={{
              height: 7,
              backgroundColor: "#E6E0D3",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={{
                height: 7,
                width: "100%",
                backgroundColor: "#718460",
                opacity: pulse,
              }}
            />
          </View>
          {!compact && (
            <Text style={{ color: "#687168", fontSize: 12 }}>
              대기 → 구상·시 → 그림 → 보관 · 정확한 완료율은 제공되지 않아요
            </Text>
          )}
          {!compact && (
            <Copy muted>
              다른 공간에서 대화를 계속해도 괜찮아요. 완료되면 갤러리에 자동
              보관됩니다.
            </Copy>
          )}
        </>
      )}
      {job.status === "failed" && (
        <>
          <Copy>{job.error}</Copy>
          {job.attempts < 3 && (
            <Button
              label="생성 다시 시도"
              secondary
              disabled={retryDisabled}
              onPress={onRetry}
            />
          )}
        </>
      )}
    </View>
  );
}
