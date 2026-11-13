import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewInstance,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { places } from "../config/assets";
import { Button, Copy, IconButton, Sheet, styles } from "../components/ui";
import { Sound } from "../components/Sound";
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
  const { update } = useStore();
  const p = places[session.placeId];
  const [text, setText] = useState("");
  const [scenery, setScenery] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
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
                    <Button
                      label="소리 설정"
                      icon="volume-medium-outline"
                      color="#23382BBF"
                      onPress={() => setSoundOpen(true)}
                    />
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
                  AI 캐릭터 · 정해진 답변 시연 · 음원 준비 중
                </Text>
              </View>
            </>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  placeName: { flex: 1, fontSize: 21, fontWeight: "700", color: "#fff" },
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
    justifyContent: "space-between",
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
