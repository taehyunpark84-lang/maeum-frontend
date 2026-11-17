import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  type ScrollViewInstance,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Copy, IconButton, Sheet, styles } from "../../components/ui";
import Slider from "@react-native-community/slider";
import { Sound } from "../../components/Sound";
import { AmbientGlow } from "../../components/AmbientGlow";
import { places } from "../../config/assets";
import { useStore } from "../../storage/store";
import {
  api,
  requestId,
  streamChat,
  type OnlineMessage,
  type OnlineSession,
} from "../../services/api";

export default function OnlineChat({
  session,
  onBack,
  onDiary,
  generationBusy,
  mock,
}: {
  session: OnlineSession;
  onBack: () => void;
  onDiary: () => void;
  generationBusy: boolean;
  mock: boolean;
}) {
  const [messages, setMessages] = useState<OnlineMessage[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState<{ text: string; id: string } | null>(
    null,
  );
  const [status, setStatus] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scenery, setScenery] = useState(false);
  const locked = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);
  const { state, update } = useStore();
  const place = places[session.place_id];
  async function reload() {
    const next = await api<OnlineMessage[]>(`/sessions/${session.id}/messages`);
    if (mounted.current) setMessages(next);
  }
  useEffect(() => {
    mounted.current = true;
    reload()
      .catch(() =>
        setError("대화를 불러오지 못했습니다. 뒤로 갔다가 다시 열어주세요."),
      )
      .finally(() => setLoading(false));
    return () => {
      mounted.current = false;
    };
    // 세션별로 컴포넌트를 새로 마운트합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (scenery) setScenery(false);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, scenery]);
  async function send() {
    if (locked.current || loading) return;
    const pending = failed || { text: input.trim(), id: requestId() };
    if (!pending.text) return;
    locked.current = true;
    setSending(true);
    setError("");
    setDraft("");
    setStatus("답변을 기다리고 있어요…");
    if (!failed) {
      setMessages((current) => [
        ...current,
        {
          id: -Date.now(),
          role: "user",
          text: pending.text,
          created: Date.now() / 1000,
        },
      ]);
      setInput("");
    }
    atBottom.current = true;
    try {
      await streamChat(session.id, pending.text, pending.id, (event) => {
        if (!mounted.current) return;
        if (event.type === "delta") {
          setStatus("");
          setDraft((text) => text + event.text);
        }
        if (event.type === "stage") setStatus(event.text || "");
      });
      await reload();
      if (mounted.current) {
        setDraft("");
        setFailed(null);
      }
    } catch (e) {
      if (mounted.current) {
        setFailed(pending);
        setError(e instanceof Error ? e.message : "응답 실패");
        setDraft("");
      }
    } finally {
      locked.current = false;
      if (mounted.current) {
        setSending(false);
        setStatus("");
      }
    }
  }
  return (
    <ImageBackground source={place.background} style={styles.screen}>
      <AmbientGlow
        placeId={session.place_id}
        enabled={state.settings.glowEnabled}
        intensity={state.settings.glowIntensity}
        speed={state.settings.glowSpeed}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[styles.row, { padding: 12, backgroundColor: "#19302480" }]}
          >
            <IconButton
              name="chevron-back"
              label="공간으로 돌아가기"
              light
              onPress={onBack}
            />
            <Image
              source={place.avatar}
              style={{ width: 36, height: 36, borderRadius: 18 }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                numberOfLines={1}
                style={{ color: "white", fontSize: 18, fontWeight: "700" }}
              >
                {place.name}
              </Text>
              <Text numberOfLines={1} style={{ color: "white", fontSize: 12 }}>
                {place.character} · AI
              </Text>
            </View>
            <IconButton
              name={generationBusy ? "hourglass-outline" : "image-outline"}
              label={generationBusy ? "그림일기 생성 중" : "그림일기 만들기"}
              light
              disabled={
                generationBusy ||
                sending ||
                loading ||
                !messages.some((m) => m.role === "user")
              }
              onPress={onDiary}
            />
            <IconButton
              name="options-outline"
              label="소리와 빛 설정"
              light
              onPress={() => setSettingsOpen(true)}
            />
          </View>
          {scenery ? (
            <View style={{ flex: 1, justifyContent: "flex-end", padding: 24 }}>
              <Button
                label="대화로 돌아가기"
                onPress={() => setScenery(false)}
              />
            </View>
          ) : (
            <>
              <ScrollView
                ref={scroll}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{
                  padding: 16,
                  gap: 14,
                  flexGrow: 1,
                  justifyContent: "flex-end",
                }}
                onScroll={(event) => {
                  const { contentOffset, contentSize, layoutMeasurement } =
                    event.nativeEvent;
                  atBottom.current =
                    contentSize.height -
                      contentOffset.y -
                      layoutMeasurement.height <
                    80;
                }}
                scrollEventThrottle={100}
                onContentSizeChange={() => {
                  if (atBottom.current)
                    scroll.current?.scrollToEnd({ animated: true });
                }}
              >
                {!messages.length && !loading && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "90%",
                      backgroundColor: "#FFFCF0D9",
                      borderRadius: 22,
                      padding: 12,
                    }}
                  >
                    <Copy>{place.greeting}</Copy>
                  </View>
                )}
                {messages.map((message) => (
                  <View
                    key={message.id}
                    style={{
                      alignSelf:
                        message.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "90%",
                      backgroundColor:
                        message.role === "user" ? "#E7EEDBD9" : "#FFFCF0D9",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 22,
                    }}
                  >
                    <Copy>{message.text}</Copy>
                  </View>
                ))}
                {(draft || status || loading) && (
                  <View
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "90%",
                      backgroundColor: "#FFFCF0D9",
                      borderRadius: 22,
                      padding: 12,
                    }}
                  >
                    <Copy>{draft || status || "기록을 불러오고 있어요…"}</Copy>
                  </View>
                )}
              </ScrollView>
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  gap: 4,
                }}
              >
                {error ? (
                  <Text
                    accessibilityRole="button"
                    accessibilityLabel={`오류 상세 보기: ${error}`}
                    numberOfLines={1}
                    onPress={() => Alert.alert("대화 연결 안내", error)}
                    style={{
                      color: "white",
                      backgroundColor: "#412B27CC",
                      borderRadius: 10,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      fontSize: 12,
                    }}
                  >
                    {error} · 자세히 보기
                  </Text>
                ) : null}
                <View style={styles.row}>
                  <TextInput
                    accessibilityLabel="메시지"
                    placeholder="마음을 이야기해 주세요"
                    value={input}
                    onChangeText={setInput}
                    multiline
                    maxLength={3000}
                    editable={!failed}
                    style={[
                      styles.input,
                      {
                        flex: 1,
                        maxHeight: 100,
                        backgroundColor: "#FFFCF0E0",
                        borderColor: "#FFFFFF99",
                        borderRadius: 28,
                      },
                    ]}
                  />
                  <IconButton
                    name={failed ? "refresh" : "send"}
                    label={failed ? "같은 메시지 재시도" : "메시지 전송"}
                    disabled={sending || loading || (!failed && !input.trim())}
                    light
                    onPress={() => void send()}
                  />
                </View>
                <Text
                  style={{
                    color: "white",
                    textShadowColor: "#000000",
                    textShadowRadius: 3,
                    textAlign: "center",
                    fontSize: 11,
                  }}
                >
                  {mock
                    ? "AI 시연 모드 · 실제 생성 아님"
                    : "AI 캐릭터 · 대화는 비공개로 보관됩니다"}
                </Text>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
      {settingsOpen && (
        <Sheet title="공간의 소리와 빛" onClose={() => setSettingsOpen(false)}>
          <Sound placeId={session.place_id} />
          <View style={styles.row}>
            <Copy>배경 빛 효과</Copy>
            <Switch
              accessibilityLabel="빛 효과 켜기"
              value={state.settings.glowEnabled}
              onValueChange={(glowEnabled) =>
                update((current) => ({
                  ...current,
                  settings: { ...current.settings, glowEnabled },
                }))
              }
            />
          </View>
          <Copy>
            빛 강도 · {Math.round(state.settings.glowIntensity * 100)}%
          </Copy>
          <Slider
            accessibilityLabel="빛 강도"
            minimumValue={0.2}
            maximumValue={1}
            step={0.05}
            value={state.settings.glowIntensity}
            onValueChange={(glowIntensity) =>
              update((current) => ({
                ...current,
                settings: { ...current.settings, glowIntensity },
              }))
            }
          />
          <Copy>변화 속도 · {state.settings.glowSpeed.toFixed(1)}배</Copy>
          <Slider
            accessibilityLabel="빛 변화 속도"
            minimumValue={0.5}
            maximumValue={3}
            step={0.1}
            value={state.settings.glowSpeed}
            onValueChange={(glowSpeed) =>
              update((current) => ({
                ...current,
                settings: { ...current.settings, glowSpeed },
              }))
            }
          />
          <Button
            label="배경만 보기"
            secondary
            onPress={() => {
              setScenery(true);
              setSettingsOpen(false);
            }}
          />
        </Sheet>
      )}
    </ImageBackground>
  );
}
