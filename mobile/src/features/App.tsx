import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  Button,
  Copy,
  Field,
  IconButton,
  Sheet,
  styles,
  Title,
  colors,
} from "../components/ui";
import { Sound } from "../components/Sound";
import { places, diaryArt, audioSources } from "../config/assets";
import { useAudioController } from "../components/AmbientAudioProvider";
import { useStore } from "../storage/store";
import { initialState } from "../storage/model";
import { mockConfig, newSession } from "../services/mock";
import type { Diary, Post } from "../types";
import Chat from "./Chat";
import PlaceCards from "./PlaceCards";
import DiaryEditor from "./DiaryEditor";

type Tab = "places" | "records" | "feed";
type Modal =
  | { type: "intro" | "settings" | "reset" }
  | { type: "deleteDiary"; diary: Diary }
  | { type: "deleteSession"; id: string }
  | {
      type: "post";
      post: Post;
      action: "comment" | "report" | "block" | "remove";
    }
  | null;
const date = (value: string) => new Date(value).toLocaleDateString("ko-KR");
export default function App() {
  const { state, update, ready, error, retry } = useStore();
  const [tab, setTab] = useState<Tab>("places");
  const [recordsTab, setRecordsTab] = useState<"diaries" | "sessions">(
    "diaries",
  );
  const [nickname, setNickname] = useState("");
  const [active, setActive] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    diaryId?: string;
    sessionId?: string;
  } | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const placeId = state.settings.selectedPlaceId;
  const p = places[placeId];
  const session = state.sessions.find((s) => s.id === active);
  const audio = useAudioController();
  const audioPlace =
    !ready || !state.settings.nickname || editor
      ? null
      : (session?.placeId ??
        (modal?.type === "intro" || modal?.type === "settings"
          ? placeId
          : null));
  useEffect(() => {
    audio.select(audioPlace, audioPlace ? audioSources[audioPlace] : null);
  }, [audio, audioPlace]);
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    if (active || editor) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (tab !== "places") {
          setTab("places");
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [tab, active, editor]);
  function enter(useDemo = false) {
    const target = useDemo ? "forest" : placeId;
    const s = newSession(target, places[target].greeting, useDemo);
    update((v) => ({ ...v, sessions: [s, ...v.sessions] }));
    setModal(null);
    setActive(s.id);
  }
  function removeDiary(diary: Diary, removePost: boolean) {
    update((s) => {
      const links = { ...s.links };
      const postId = links[diary.id];
      delete links[diary.id];
      return {
        ...s,
        links,
        diaries: s.diaries.filter((d) => d.id !== diary.id),
        posts: removePost
          ? s.posts.filter((post) => post.id !== postId)
          : s.posts,
      };
    });
    setModal(null);
  }
  if (!ready)
    return (
      <SafeAreaView
        style={[styles.screen, { justifyContent: "center", padding: 24 }]}
      >
        {error ? (
          <Copy>{error}</Copy>
        ) : (
          <>
            <ActivityIndicator color={colors.green} />
            <Copy>기록을 불러오고 있어요…</Copy>
          </>
        )}
      </SafeAreaView>
    );
  if (!state.settings.nickname)
    return (
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ImageBackground source={places.forest.background} style={{ flex: 1 }}>
          <LinearGradient
            colors={["transparent", "#14201999"]}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <SafeAreaView
              edges={["bottom"]}
              style={{
                backgroundColor: colors.panel,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                maxHeight: "85%",
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.content, { padding: 28 }]}
              >
                <Ionicons name="leaf-outline" size={32} color={colors.green} />
                <Title>마음이 머무는 곳</Title>
                <Copy>
                  잠시 쉬어가도 괜찮아요.{"\n"}당신의 하루를 들려주세요.
                </Copy>
                <Field
                  label="이곳에서 사용할 닉네임"
                  value={nickname}
                  onChangeText={setNickname}
                  maxLength={20}
                  placeholder="예: 느린 산책"
                />
                <Copy muted>
                  로그인 없는 로컬 시연입니다. 대화와 일기는 이 기기에 평문으로
                  저장됩니다. 실제 민감정보는 입력하지 마세요.
                </Copy>
                {error && <Copy>{error}</Copy>}
                <Button
                  label="나만의 공간으로"
                  icon="arrow-forward"
                  disabled={!nickname.trim()}
                  onPress={() =>
                    update((s) => ({
                      ...s,
                      settings: { ...s.settings, nickname: nickname.trim() },
                    }))
                  }
                />
              </ScrollView>
            </SafeAreaView>
          </LinearGradient>
        </ImageBackground>
      </KeyboardAvoidingView>
    );
  if (editor)
    return (
      <DiaryEditor
        key={editor.diaryId ?? editor.sessionId}
        existing={state.diaries.find((d) => d.id === editor.diaryId)}
        session={state.sessions.find((s) => s.id === editor.sessionId)}
        onBack={() => {
          setEditor(null);
          if (!active) setTab("records");
        }}
      />
    );
  if (session)
    return (
      <Chat
        session={session}
        onBack={() => {
          setActive(null);
          setTab("places");
        }}
        onDiary={() => setEditor({ sessionId: session.id })}
      />
    );
  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={[styles.row, { paddingHorizontal: 20, paddingVertical: 8 }]}>
        <Ionicons name="leaf-outline" size={24} color={colors.green} />
        <Text
          style={{
            flex: 1,
            color: colors.green,
            fontWeight: "600",
            fontSize: 18,
          }}
        >
          마음이 머무는 곳
        </Text>
        <IconButton
          name="settings-outline"
          label="로컬 설정"
          onPress={() => setModal({ type: "settings" })}
        />
      </View>
      {error ? (
        <View style={{ padding: 12 }}>
          <Copy>{error}</Copy>
          <Button label="저장 다시 시도" secondary onPress={retry} />
        </View>
      ) : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        {tab === "places" && (
          <>
            <View style={{ gap: 8 }}>
              <Copy muted>{state.settings.nickname}님, 오늘도 잘 오셨어요</Copy>
              <Title>어디에서 이야기할까요?</Title>
              <Copy muted>오늘 나에게 필요한 대화를 골라보세요.</Copy>
            </View>
            <PlaceCards
              selectedId={placeId}
              onSelect={(key) => {
                update((s) => ({
                  ...s,
                  settings: { ...s.settings, selectedPlaceId: key },
                }));
                setModal({ type: "intro" });
              }}
            />
            <Copy muted>AI 캐릭터와의 시연 대화 · 공간별 소리 설정</Copy>
            <Button
              label={`${p.name} 들어가기`}
              color={p.color}
              icon="arrow-forward"
              onPress={() => setModal({ type: "intro" })}
            />
            <Button
              label="제공된 대화로 그림일기 체험"
              secondary
              onPress={() => enter(true)}
            />
            <Button
              label={`지난 대화 이어하기 · ${state.sessions.length}개`}
              secondary
              onPress={() => {
                setRecordsTab("sessions");
                setTab("records");
              }}
            />
          </>
        )}
        {tab === "records" && (
          <>
            <Title>차곡차곡, 나의 기록</Title>
            <Copy muted>이곳에 담긴 이야기는 기본 비공개예요.</Copy>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button
                  label={`그림일기 ${state.diaries.length}`}
                  secondary={recordsTab !== "diaries"}
                  onPress={() => setRecordsTab("diaries")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={`대화 ${state.sessions.length}`}
                  secondary={recordsTab !== "sessions"}
                  onPress={() => setRecordsTab("sessions")}
                />
              </View>
            </View>
            {recordsTab === "diaries" ? (
              state.diaries.length ? (
                state.diaries.map((d) => (
                  <View style={styles.card} key={d.id}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${d.title} 열기`}
                      onPress={() => setEditor({ diaryId: d.id })}
                    >
                      <Image
                        source={diaryArt}
                        resizeMode="contain"
                        style={{
                          width: "100%",
                          aspectRatio: 1.6,
                          backgroundColor: "#F0EDE4",
                          borderRadius: 16,
                        }}
                      />
                      <Title>{d.title}</Title>
                      <Copy muted>
                        {date(d.updatedAt)} ·{" "}
                        {state.links[d.id] ? "로컬 공유 중" : "비공개"}
                      </Copy>
                    </Pressable>
                    <Button
                      label="일기 삭제"
                      secondary
                      icon="trash-outline"
                      onPress={() =>
                        setModal({ type: "deleteDiary", diary: d })
                      }
                    />
                  </View>
                ))
              ) : (
                <Empty
                  text="아직 보관한 그림일기가 없어요."
                  action={() => setTab("places")}
                />
              )
            ) : state.sessions.length ? (
              state.sessions.map((s) => (
                <View key={s.id} style={styles.card}>
                  <View style={styles.row}>
                    <Image
                      source={places[s.placeId].avatar}
                      style={styles.avatar}
                    />
                    <View style={{ flex: 1 }}>
                      <Title>{places[s.placeId].name}</Title>
                      <Copy muted>
                        {date(s.updatedAt)} · {s.messages.length}개 메시지
                      </Copy>
                    </View>
                  </View>
                  <Copy>
                    {s.messages
                      .filter((m) => m.role === "user")
                      .at(-1)
                      ?.text.slice(0, 100) ??
                      "아직 나누지 못한 이야기를 기다려요."}
                  </Copy>
                  <Button
                    label="이 대화 이어하기"
                    onPress={() => setActive(s.id)}
                  />
                  <Button
                    label="대화 삭제"
                    secondary
                    onPress={() =>
                      setModal({ type: "deleteSession", id: s.id })
                    }
                  />
                </View>
              ))
            ) : (
              <Empty
                text="아직 대화 기록이 없어요."
                action={() => setTab("places")}
              />
            )}
          </>
        )}
        {tab === "feed" && (
          <>
            <Title>서로에게 작은 온기</Title>
            <Text style={styles.badge}>로컬 공감 피드 · 공유 시연</Text>
            <Copy muted>
              이 기기에서만 보입니다. 실제 커뮤니티가 아니며 다른 사람에게
              전송되지 않아요.
            </Copy>
            {notice && <Copy>{notice}</Copy>}
            {state.posts.filter(
              (post) => !state.blockedAliases.includes(post.alias),
            ).length === 0 && (
              <Empty
                text="아직 공개된 그림일기가 없어요. 내 기록에서 미리보기 후 공유할 수 있어요."
                action={() => {
                  setRecordsTab("diaries");
                  setTab("records");
                }}
                label="내 기록 보기"
              />
            )}
            {state.posts
              .filter((post) => !state.blockedAliases.includes(post.alias))
              .map((post) => (
                <View style={styles.card} key={post.id}>
                  <Copy muted>
                    {post.alias} · {date(post.createdAt)}
                  </Copy>
                  <Image
                    source={diaryArt}
                    resizeMode="contain"
                    style={{ width: "100%", aspectRatio: 1, borderRadius: 16 }}
                  />
                  <Text style={styles.badge}>예시 작품</Text>
                  <Title>{post.title}</Title>
                  <Copy>{post.poem}</Copy>
                  <Button
                    label={`${post.reacted ? "공감 취소" : "마음이 닿았어요"} · ${post.reactions}`}
                    secondary
                    icon={post.reacted ? "heart" : "heart-outline"}
                    onPress={() =>
                      update((s) => ({
                        ...s,
                        posts: s.posts.map((v) =>
                          v.id === post.id
                            ? {
                                ...v,
                                reacted: !v.reacted,
                                reactions: v.reactions + (v.reacted ? -1 : 1),
                              }
                            : v,
                        ),
                      }))
                    }
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    {(["comment", "report", "block", "remove"] as const).map(
                      (action, i) => (
                        <IconButton
                          key={action}
                          name={
                            (
                              [
                                "chatbubble-outline",
                                "flag-outline",
                                "ban-outline",
                                "trash-outline",
                              ] as const
                            )[i]
                          }
                          label={
                            [
                              "댓글 시연",
                              "신고 시연",
                              "차단 시연",
                              "공유 게시물 삭제",
                            ][i]
                          }
                          onPress={() => {
                            setComment("");
                            setModal({ type: "post", post, action });
                          }}
                        />
                      ),
                    )}
                  </View>
                </View>
              ))}
          </>
        )}
      </ScrollView>
      <View
        style={{
          flexDirection: "row",
          borderTopWidth: 1,
          borderColor: colors.line,
          paddingTop: 8,
          backgroundColor: colors.panel,
        }}
      >
        {(["places", "records", "feed"] as const).map((key, i) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
            accessibilityLabel={["공간", "내 기록", "공감 피드"][i]}
            onPress={() => {
              setTab(key);
              setNotice("");
            }}
            style={{
              flex: 1,
              alignItems: "center",
              padding: 8,
              minHeight: 56,
              gap: 4,
            }}
          >
            <Ionicons
              name={
                (["leaf-outline", "book-outline", "heart-outline"] as const)[i]
              }
              size={22}
              color={tab === key ? colors.green : colors.muted}
            />
            <Text
              style={{
                color: tab === key ? colors.green : colors.muted,
                fontSize: 12,
              }}
            >
              {["공간", "내 기록", "공감 피드"][i]}
            </Text>
          </Pressable>
        ))}
      </View>
      {modal && (
        <Sheet
          title={
            modal.type === "intro"
              ? p.name
              : modal.type === "settings"
                ? "나의 로컬 설정"
                : modal.type === "reset"
                  ? "모든 기록을 지울까요?"
                  : modal.type === "post"
                    ? {
                        comment: "댓글 시연",
                        report: "신고 시연",
                        block: "차단 시연",
                        remove: "공유를 취소할까요?",
                      }[modal.action]
                    : "기록을 삭제할까요?"
          }
          onClose={() => setModal(null)}
          footer={
            modal.type === "intro" ? (
              <Button
                label="대화 시작하기"
                color={p.color}
                icon="chatbubble-outline"
                onPress={() => enter()}
              />
            ) : undefined
          }
        >
          {modal.type === "intro" && (
            <>
              <Image
                source={p.background}
                style={{ width: "100%", height: 220, borderRadius: 20 }}
              />
              <View style={styles.row}>
                <Image source={p.avatar} style={styles.avatar} />
                <Title>{p.character}</Title>
              </View>
              <Text style={[styles.badge, { color: p.color }]}>
                {p.concept}
              </Text>
              <Copy>{p.description}</Copy>
              <Copy muted>{p.personality}</Copy>
              <View style={[styles.card, { backgroundColor: "#F1F0E8" }]}>
                <Copy>{p.greeting}</Copy>
              </View>
              <Text style={styles.badge}>AI 캐릭터 · 시연 대화</Text>
              <Sound placeId={placeId} />
              <Button
                label="다른 장소 둘러보기"
                secondary
                onPress={() => setModal(null)}
              />
            </>
          )}
          {modal.type === "settings" && (
            <>
              <Copy>닉네임: {state.settings.nickname}</Copy>
              <Copy muted>
                인증 없는 개발용 mock 모드입니다. 저장소는 암호화되지 않았으므로
                실제 민감정보를 입력하지 마세요. AI 답변·감정 해석·그림 생성은
                시연입니다.
              </Copy>
              <Sound placeId={placeId} />
              <Button
                label="다음 서비스 요청 1회 실패시키기"
                secondary
                onPress={() => {
                  mockConfig.failNext = true;
                  setNotice(
                    "다음 AI/공유 시연 요청이 한 번 실패합니다. 재시도하면 정상 동작해요.",
                  );
                }}
              />
              <Button
                label={`시연 지연 ${mockConfig.delayMs / 1000}초 · 변경`}
                secondary
                onPress={() => {
                  mockConfig.delayMs = mockConfig.delayMs === 800 ? 4000 : 800;
                  setNotice(
                    `시연 지연을 ${mockConfig.delayMs / 1000}초로 변경했습니다.`,
                  );
                }}
              />
              {notice && <Copy>{notice}</Copy>}
              {state.blockedAliases.length > 0 && (
                <Button
                  label="로컬 차단 모두 해제"
                  secondary
                  onPress={() => {
                    update((s) => ({ ...s, blockedAliases: [] }));
                    setNotice("차단을 해제했습니다.");
                  }}
                />
              )}
              <Button
                label="전체 로컬 기록 삭제"
                secondary
                icon="trash-outline"
                onPress={() => setModal({ type: "reset" })}
              />
            </>
          )}
          {modal.type === "reset" && (
            <>
              <Copy>
                닉네임, 대화, 일기, 공유 게시물, 설정을 이 기기에서 모두
                지웁니다. 되돌릴 수 없습니다.
              </Copy>
              <Button
                label="모든 로컬 데이터 삭제"
                onPress={() => {
                  update(() => initialState());
                  setNickname("");
                  setTab("places");
                  setModal(null);
                  setNotice("");
                  mockConfig.failNext = false;
                }}
              />
              <Button label="취소" secondary onPress={() => setModal(null)} />
            </>
          )}
          {modal.type === "deleteSession" && (
            <>
              <Copy>
                이 대화를 삭제합니다. 연결된 그림일기는 그대로 보관됩니다.
              </Copy>
              <Button
                label="대화 삭제 확인"
                onPress={() => {
                  const target = modal.id;
                  update((s) => ({
                    ...s,
                    sessions: s.sessions.filter((v) => v.id !== target),
                  }));
                  setModal(null);
                }}
              />
              <Button label="취소" secondary onPress={() => setModal(null)} />
            </>
          )}
          {modal.type === "deleteDiary" && (
            <>
              <Copy>
                「{modal.diary.title}」을 삭제합니다. 원본 대화는 유지됩니다.
              </Copy>
              {state.links[modal.diary.id] ? (
                <>
                  <Button
                    label="일기와 로컬 게시물 모두 삭제"
                    onPress={() => removeDiary(modal.diary, true)}
                  />
                  <Button
                    label="일기만 삭제 · 게시물 유지"
                    secondary
                    onPress={() => removeDiary(modal.diary, false)}
                  />
                </>
              ) : (
                <Button
                  label="일기 삭제 확인"
                  onPress={() => removeDiary(modal.diary, false)}
                />
              )}
              <Button label="취소" secondary onPress={() => setModal(null)} />
            </>
          )}
          {modal.type === "post" &&
            (modal.action === "comment" ? (
              <>
                <Copy muted>댓글은 이 기기에만 저장됩니다.</Copy>
                {state.posts
                  .find((v) => v.id === modal.post.id)
                  ?.comments.map((c, i) => (
                    <View key={i} style={styles.card}>
                      <Copy>익명의 산책자: {c}</Copy>
                    </View>
                  ))}
                <Field
                  label="댓글 내용"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={500}
                />
                <Button
                  label="로컬 댓글 등록"
                  disabled={!comment.trim()}
                  onPress={() => {
                    const postId = modal.post.id;
                    update((s) => ({
                      ...s,
                      posts: s.posts.map((v) =>
                        v.id === postId
                          ? { ...v, comments: [...v.comments, comment.trim()] }
                          : v,
                      ),
                    }));
                    setComment("");
                  }}
                />
              </>
            ) : modal.action === "report" ? (
              <>
                <Copy>
                  실제 신고 접수나 운영자 전송은 연결되지 않았습니다. 사유를
                  입력해 시연을 확인할 수 있어요.
                </Copy>
                <Field
                  label="신고 사유"
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={500}
                />
                <Button
                  label="신고 시연 확인 (전송 없음)"
                  disabled={!comment.trim()}
                  onPress={() => {
                    setNotice(
                      "신고 시연을 확인했습니다. 운영자에게 전송되거나 접수되지 않았습니다.",
                    );
                    setModal(null);
                  }}
                />
              </>
            ) : modal.action === "remove" ? (
              <>
                <Copy>
                  이 로컬 게시물을 삭제합니다. 보관 중인 일기는 비공개로
                  유지됩니다.
                </Copy>
                <Button
                  label="게시물 삭제 확인"
                  onPress={() => {
                    const postId = modal.post.id;
                    update((s) => {
                      const links = { ...s.links };
                      const diaryIds = Object.keys(links).filter(
                        (key) => links[key] === postId,
                      );
                      diaryIds.forEach((key) => delete links[key]);
                      return {
                        ...s,
                        links,
                        posts: s.posts.filter((post) => post.id !== postId),
                        diaries: s.diaries.map((d) =>
                          diaryIds.includes(d.id)
                            ? { ...d, visibility: "private" }
                            : d,
                        ),
                      };
                    });
                    setModal(null);
                  }}
                />
                <Button label="취소" secondary onPress={() => setModal(null)} />
              </>
            ) : (
              <>
                <Copy>
                  이 익명 별칭의 게시물을 이 기기에서 숨깁니다. 실제 계정 차단이
                  아니며 설정에서 해제할 수 있습니다.
                </Copy>
                <Button
                  label="이 기기에서 숨기기"
                  onPress={() => {
                    const alias = modal.post.alias;
                    update((s) => ({
                      ...s,
                      blockedAliases: [...s.blockedAliases, alias],
                    }));
                    setModal(null);
                  }}
                />
              </>
            ))}
        </Sheet>
      )}
    </SafeAreaView>
  );
}
function Empty({
  text,
  action,
  label = "공간 둘러보기",
}: {
  text: string;
  action: () => void;
  label?: string;
}) {
  return (
    <View style={[styles.card, { paddingVertical: 32 }]}>
      <Ionicons name="leaf-outline" size={36} color={colors.green} />
      <Copy muted>{text}</Copy>
      <Button label={label} secondary onPress={action} />
    </View>
  );
}
