import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { places, audioSources } from "../config/assets";
import { Button, Copy, IconButton, Sheet, styles } from "../components/ui";
import { Sound } from "../components/Sound";
import { AmbientGlow, type GlowStatus } from "../components/AmbientGlow";
import { useStore } from "../storage/store";
import { ChatService, id, now } from "../services/mock";
import type { Message, Session } from "../types";

export default function Chat({
  session,
  onBack,
  onDiary,
}: {
  session: Session;
  onBack: () => void;
  onDiary: () => void;
}) {
  const { state, update } = useStore();
  const p = places[session.placeId];
  const [text, setText] = useState("");
  const [scenery, setScenery] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const [glowOpen, setGlowOpen] = useState(false);
  const { glowEnabled, glowIntensity, glowSpeed } = state.settings;
  const setLight = (
    patch: Partial<
      Pick<typeof state.settings, "glowEnabled" | "glowIntensity" | "glowSpeed">
    >,
  ) =>
    update((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  const [glowStatus, setGlowStatus] = useState<GlowStatus>("loading");
  const scroll = useRef<ScrollViewInstance>(null);
  const atBottom = useRef(true);
  const sending = useRef(false);
  const pending = session.messages.some((m) => m.status === "pending");
  const failed = session.messages.some((m) => m.status === "failed");
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboard(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (scenery) setScenery(false);
      else onBack();
      return true;
    });
    return () => sub.remove();
  }, [scenery, onBack]);
  function changeMessages(fn: (messages: Message[]) => Message[]) {
    update((s) => ({
      ...s,
      sessions: s.sessions.map((v) =>
        v.id === session.id
          ? { ...v, messages: fn(v.messages), updatedAt: now() }
          : v,
      ),
    }));
  }
  async function send(retry?: Message) {
    if (sending.current || pending || (!retry && (failed || !text.trim())))
      return;
    sending.current = true;
    const message: Message = retry
      ? { ...retry, status: "pending" }
      : {
          id: id(),
          role: "user",
          text: text.trim(),
          createdAt: now(),
          status: "pending",
        };
    changeMessages((ms) =>
      retry
        ? ms.map((m) => (m.id === retry.id ? message : m))
        : [...ms, message],
    );
    if (!retry) setText("");
    atBottom.current = true;
    try {
      const reply = await ChatService.send(
        session.id,
        message.text,
        session.messages,
        session.placeId,
      );
      changeMessages((ms) => [
        ...ms.map((m) =>
          m.id === message.id ? { ...m, status: "sent" as const } : m,
        ),
        reply,
      ]);
    } catch {
      changeMessages((ms) =>
        ms.map((m) => (m.id === message.id ? { ...m, status: "failed" } : m)),
      );
    } finally {
      sending.current = false;
    }
  }
  return (
    <ImageBackground source={p.background} style={styles.screen}>
      <AmbientGlow
        key={session.placeId}
        placeId={session.placeId}
        enabled={glowEnabled}
        intensity={glowIntensity}
        speed={glowSpeed}
        onStatus={setGlowStatus}
      />
      <StatusBar style="light" />
      <LinearGradient
        pointerEvents="none"
        colors={["#101E18C7", "#101E1800"]}
        style={chatStyles.headerShade}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["#101E1800", "#101E1866"]}
        style={chatStyles.footerShade}
      />
      <KeyboardAvoidingView
        style={chatStyles.fill}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={chatStyles.fill} edges={["top", "bottom"]}>
          <View style={chatStyles.toolbar}>
            <IconButton
              name="chevron-back"
              label="대화 보관 후 공간으로"
              light
              onPress={onBack}
            />
            <Text style={chatStyles.placeName}>{p.name}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="소리 설정 열기"
              onPress={() => {
                Keyboard.dismiss();
                setSoundOpen(true);
              }}
              style={chatStyles.quickButton}
            >
              <Ionicons name="volume-medium-outline" size={17} color="#fff" />
              <Text style={chatStyles.quickLabel}>소리</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="빛 강도와 속도 설정 열기"
              onPress={() => {
                Keyboard.dismiss();
                setGlowOpen(true);
              }}
              style={chatStyles.quickButton}
            >
              <Ionicons name="sunny-outline" size={17} color="#fff" />
              <Text style={chatStyles.quickLabel}>빛</Text>
            </Pressable>
            <IconButton
              name="map-outline"
              label="장소 변경: 현재 대화 보관"
              light
              onPress={onBack}
            />
          </View>
          {scenery ? (
            <View style={chatStyles.sceneryActions}>
              <Button
                label="대화로 돌아가기"
                icon="chatbubble-outline"
                color="#23382BCC"
                onPress={() => setScenery(false)}
              />
            </View>
          ) : (
            <>
              <View style={chatStyles.profile}>
                <Image source={p.avatar} style={styles.avatar} />
                <View style={chatStyles.fill}>
                  <Text style={chatStyles.characterName}>{p.character}</Text>
                  {!keyboard && (
                    <Text style={chatStyles.concept}>{p.concept}</Text>
                  )}
                </View>
                <IconButton
                  name="book-outline"
                  label="그림일기 만들기"
                  light
                  disabled={
                    pending ||
                    failed ||
                    !session.messages.some((m) => m.role === "user")
                  }
                  onPress={onDiary}
                />
              </View>
              <ScrollView
                ref={scroll}
                style={chatStyles.fill}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={chatStyles.messages}
                scrollEventThrottle={100}
                onScroll={(e) => {
                  const { layoutMeasurement, contentOffset, contentSize } =
                    e.nativeEvent;
                  atBottom.current =
                    layoutMeasurement.height + contentOffset.y >=
                    contentSize.height - 70;
                }}
                onContentSizeChange={() => {
                  if (atBottom.current)
                    scroll.current?.scrollToEnd({ animated: true });
                }}
                onLayout={() => {
                  if (atBottom.current)
                    scroll.current?.scrollToEnd({ animated: false });
                }}
              >
                {session.messages.map((m) => (
                  <View
                    key={m.id}
                    style={[
                      chatStyles.messageRow,
                      {
                        alignSelf:
                          m.role === "user" ? "flex-end" : "flex-start",
                      },
                    ]}
                  >
                    {m.role === "assistant" && (
                      <Image
                        source={p.avatar}
                        style={chatStyles.messageAvatar}
                      />
                    )}
                    <View style={chatStyles.messageContent}>
                      <View
                        style={[
                          chatStyles.bubble,
                          m.role === "user" && chatStyles.userBubble,
                        ]}
                      >
                        <Copy>{m.text}</Copy>
                      </View>
                      <Text style={chatStyles.time}>
                        {new Date(m.createdAt).toLocaleTimeString("ko-KR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {m.status === "pending"
                          ? " · 시연 답변을 준비해요…"
                          : ""}
                      </Text>
                      {m.status === "failed" && (
                        <Button
                          label="응답 실패 · 재시도"
                          secondary
                          onPress={() => void send(m)}
                        />
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={chatStyles.footer}>
                {!keyboard && (
                  <View style={chatStyles.actions}>
                    <IconButton
                      name="image-outline"
                      label="배경만 보기"
                      light
                      onPress={() => {
                        Keyboard.dismiss();
                        setScenery(true);
                      }}
                    />
                  </View>
                )}
                <View style={styles.row}>
                  <TextInput
                    accessibilityLabel="메시지"
                    placeholder="마음을 이야기해 주세요"
                    placeholderTextColor="#586257"
                    multiline
                    maxLength={3000}
                    value={text}
                    onChangeText={setText}
                    style={[styles.input, chatStyles.input]}
                  />
                  <IconButton
                    name="send"
                    label="메시지 전송"
                    disabled={pending || failed || !text.trim()}
                    onPress={() => void send()}
                  />
                </View>
                <Text style={chatStyles.demoNotice}>
                  AI 캐릭터 · 정해진 답변 시연
                  {audioSources[session.placeId] === null
                    ? " · 음원 준비 중"
                    : ""}
                </Text>
              </View>
            </>
          )}
          {glowOpen && (
            <Sheet title="빛 설정" onClose={() => setGlowOpen(false)}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Copy>배경 빛 효과</Copy>
                </View>
                <Switch
                  accessibilityLabel="배경 빛 효과 켜기"
                  value={glowEnabled}
                  onValueChange={(value) => setLight({ glowEnabled: value })}
                />
              </View>
              <Copy muted>
                {!glowEnabled
                  ? "빛 효과가 꺼져 있어요."
                  : glowStatus === "reduced-motion"
                    ? "휴대폰의 동작 줄이기가 켜져 있어 효과가 멈춰 있어요."
                    : glowStatus === "unavailable"
                      ? "휴대폰의 동작 설정을 확인하지 못했어요."
                      : glowStatus === "loading"
                        ? "빛 효과를 준비하고 있어요."
                        : "배경에 빛이 피어났다 사라져요."}
              </Copy>
              <Copy>빛 강도 · {Math.round(glowIntensity * 100)}%</Copy>
              <Slider
                accessibilityLabel="빛 강도"
                minimumValue={0.2}
                maximumValue={1}
                step={0.05}
                value={glowIntensity}
                minimumTrackTintColor={p.color}
                thumbTintColor={p.color}
                onValueChange={(value) => setLight({ glowIntensity: value })}
              />
              <Copy muted>은은하게 ← → 선명하게</Copy>
              <Copy>변화 속도 · {glowSpeed.toFixed(1)}배</Copy>
              <Slider
                accessibilityLabel="빛 변화 속도"
                minimumValue={0.5}
                maximumValue={3}
                step={0.1}
                value={glowSpeed}
                minimumTrackTintColor={p.color}
                thumbTintColor={p.color}
                onValueChange={(value) => setLight({ glowSpeed: value })}
              />
              <Copy muted>
                천천히 ← → 빠르게 · 모든 공간에 적용되고 저장돼요.
              </Copy>
              <Button
                label="기본값으로"
                secondary
                onPress={() =>
                  setLight({
                    glowEnabled: true,
                    glowIntensity: 0.85,
                    glowSpeed: 2.5,
                  })
                }
              />
              <Button
                label="완료"
                color={p.color}
                onPress={() => setGlowOpen(false)}
              />
            </Sheet>
          )}
          {soundOpen && (
            <Sheet title="소리 설정" onClose={() => setSoundOpen(false)}>
              <Copy>{p.name}의 배경 소리</Copy>
              <Sound placeId={session.placeId} />
              <Button
                label="완료"
                color={p.color}
                onPress={() => setSoundOpen(false)}
              />
            </Sheet>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const chatStyles = StyleSheet.create({
  fill: { flex: 1 },
  headerShade: { position: "absolute", top: 0, left: 0, right: 0, height: 270 },
  footerShade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  placeName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 19,
    fontWeight: "700",
    color: "#fff",
  },
  quickButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    borderRadius: 22,
    backgroundColor: "#233025B3",
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { color: "#fff", fontSize: 13, fontWeight: "600" },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  characterName: { fontSize: 20, fontWeight: "700", color: "#fff" },
  concept: { fontSize: 14, lineHeight: 22, color: "#F6F5ED", marginTop: 3 },
  messages: {
    flexGrow: 1,
    justifyContent: "flex-end",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 16,
  },
  messageRow: { maxWidth: "92%", flexDirection: "row", gap: 8 },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginTop: 4 },
  messageContent: { flexShrink: 1, gap: 4 },
  bubble: {
    backgroundColor: "#FFFCF0D9",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: { backgroundColor: "#E7EEDBD9" },
  time: {
    color: "#fff",
    fontSize: 11,
    paddingHorizontal: 8,
    textShadowColor: "#142019",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  footer: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderRadius: 28,
    backgroundColor: "#FFFCF0E0",
    borderColor: "#FFFFFF99",
  },
  demoNotice: {
    fontSize: 11,
    lineHeight: 17,
    color: "#fff",
    textAlign: "center",
    textShadowColor: "#142019",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sceneryActions: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 20,
  },
});
