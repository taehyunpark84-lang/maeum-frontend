import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollViewInstance,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { places } from "../config/assets";
import { Button, Copy, IconButton, styles } from "../components/ui";
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
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <StatusBar style="light" />
      <ImageBackground source={p.background} style={{ flex: 1 }}>
        <LinearGradient
          colors={["#142019B0", "transparent"]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 180,
          }}
        />
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <View
            style={[styles.row, { paddingHorizontal: 16, paddingVertical: 8 }]}
          >
            <IconButton
              name="chevron-back"
              label="대화 보관 후 공간으로"
              light
              onPress={onBack}
            />
            <Text
              style={{
                fontSize: 21,
                fontWeight: "700",
                color: "white",
                flex: 1,
              }}
            >
              {p.name}
            </Text>
            <IconButton
              name="map-outline"
              label="장소 변경: 현재 대화 보관"
              light
              onPress={onBack}
            />
          </View>
          <View
            style={{
              flex: scenery ? 1 : keyboard ? 0.1 : 0.3,
              justifyContent: "flex-end",
              alignItems: "flex-end",
              padding: 16,
            }}
          >
            <Button
              label={scenery ? "대화로 돌아가기" : "배경만 보기"}
              icon={scenery ? "chatbubble-outline" : "image-outline"}
              onPress={() => {
                Keyboard.dismiss();
                setScenery(!scenery);
              }}
              color="#34482DE0"
            />
          </View>
          {!scenery && (
            <SafeAreaView
              edges={["bottom"]}
              style={{
                flex: keyboard ? 0.9 : 0.7,
                backgroundColor: "#FFFCF7",
                borderTopLeftRadius: 30,
                borderTopRightRadius: 30,
                padding: 16,
                gap: 8,
              }}
            >
              <View style={styles.row}>
                <Image source={p.avatar} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 20, fontWeight: "700" }}>
                    {p.character}
                  </Text>
                  <Text style={styles.badge}>AI 캐릭터 · 정해진 답변 시연</Text>
                  <Text style={{ color: p.color, fontSize: 13, marginTop: 4 }}>
                    {p.concept}
                  </Text>
                </View>
                <IconButton
                  name="book-outline"
                  label="그림일기 만들기"
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
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ gap: 16, paddingVertical: 16 }}
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
              >
                {session.messages.map((m) => (
                  <View
                    key={m.id}
                    style={{
                      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "94%",
                      flexDirection: "row",
                      gap: 8,
                    }}
                  >
                    {m.role === "assistant" && (
                      <Image
                        source={p.avatar}
                        style={{ width: 34, height: 34, borderRadius: 17 }}
                      />
                    )}
                    <View style={{ flexShrink: 1, gap: 4 }}>
                      <View
                        style={{
                          backgroundColor:
                            m.role === "user" ? `${p.color}25` : "#F0EFE9",
                          borderRadius: 22,
                          padding: 14,
                        }}
                      >
                        <Copy>{m.text}</Copy>
                      </View>
                      <Text style={{ color: "#687168", fontSize: 12 }}>
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
              {!keyboard && <Sound placeId={session.placeId} />}
              <View style={styles.row}>
                <TextInput
                  accessibilityLabel="메시지"
                  placeholder="마음을 이야기해 주세요"
                  placeholderTextColor="#687168"
                  multiline
                  maxLength={3000}
                  value={text}
                  onChangeText={setText}
                  style={[styles.input, { flex: 1, maxHeight: 100 }]}
                />
                <IconButton
                  name="send"
                  label="메시지 전송"
                  disabled={pending || failed || !text.trim()}
                  onPress={() => void send()}
                />
              </View>
            </SafeAreaView>
          )}
        </SafeAreaView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}
