import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Button,
  Copy,
  Field,
  IconButton,
  Sheet,
  styles,
  Title,
} from "../components/ui";
import { diaryArt } from "../config/assets";
import { DiaryService, FeedService, id, now } from "../services/mock";
import { useStore } from "../storage/store";
import type { Diary, Session } from "../types";

export default function DiaryEditor({
  existing,
  session,
  onBack,
}: {
  existing?: Diary;
  session?: Session;
  onBack: () => void;
}) {
  const { state, update } = useStore();
  const [draft, setDraft] = useState<Diary>(
    existing ?? {
      id: id(),
      sessionId: session!.id,
      title: "",
      poem: "",
      imageKey: "demo-art",
      summary: "",
      userConfirmedEmotions: [],
      interpretation: "",
      createdAt: now(),
      updatedAt: now(),
      visibility: "private",
    },
  );
  const [stage, setStage] = useState<"review" | "edit">(
    existing ? "edit" : "review",
  );
  const [busy, setBusy] = useState(existing ? "" : "대화 내용을 모으고 있어요");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"share" | "leave" | "regenerate" | null>(
    null,
  );
  const [dirty, setDirty] = useState(false);
  const [summaryAttempt, setSummaryAttempt] = useState(0);
  const control = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const locked = useRef(false);
  const linkedPost = state.links[draft.id];
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      control.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (existing || !session) return;
    const controller = new AbortController();
    control.current = controller;
    DiaryService.summarize(session.id, session, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setDraft((d) => ({
            ...d,
            summary: result.summary,
            userConfirmedEmotions: result.emotions,
          }));
          setBusy("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(String(e.message));
          setBusy("");
        }
      });
    return () => controller.abort();
  }, [existing, session, summaryAttempt]);
  function leave() {
    if (dirty || busy) setModal("leave");
    else onBack();
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });
    return () => sub.remove();
  });
  function change(fields: Partial<Diary>) {
    setDraft((d) => ({ ...d, ...fields }));
    setDirty(true);
    setNotice("");
  }
  async function generate() {
    if (locked.current || !draft.summary.trim()) return;
    locked.current = true;
    setModal(null);
    setBusy("예시 그림일기를 준비하고 있어요");
    setError("");
    const controller = new AbortController();
    control.current = controller;
    try {
      const result = await DiaryService.generate(
        draft.summary,
        controller.signal,
      );
      if (!controller.signal.aborted && mounted.current) {
        setDraft((d) => ({ ...d, ...result }));
        setStage("edit");
        setDirty(true);
      }
    } catch (e) {
      if (!controller.signal.aborted && mounted.current)
        setError((e as Error).message);
    } finally {
      locked.current = false;
      if (mounted.current && !controller.signal.aborted) setBusy("");
    }
  }
  function cancel() {
    control.current?.abort();
    locked.current = false;
    setBusy("");
    setNotice("생성을 취소했습니다. 새 일기는 저장되지 않았습니다.");
  }
  function save() {
    const saved = {
      ...draft,
      title: draft.title.trim(),
      poem: draft.poem.trim(),
      updatedAt: now(),
      visibility: linkedPost ? ("shared" as const) : ("private" as const),
    };
    update((s) => ({
      ...s,
      diaries: [saved, ...s.diaries.filter((d) => d.id !== saved.id)],
    }));
    setDraft(saved);
    setDirty(false);
    setNotice("내 기록에 보관했습니다. 기존 공유본은 자동으로 바뀌지 않아요.");
  }
  async function publish() {
    if (locked.current) return;
    locked.current = true;
    setBusy("로컬 피드에 게시하고 있어요");
    setError("");
    const controller = new AbortController();
    control.current = controller;
    try {
      const post = await FeedService.publish(
        {
          title: draft.title.trim(),
          poem: draft.poem.trim(),
          imageKey: draft.imageKey,
        },
        controller.signal,
      );
      if (!mounted.current || controller.signal.aborted) return;
      const saved = {
        ...draft,
        updatedAt: now(),
        visibility: "shared" as const,
      };
      update((s) => ({
        ...s,
        diaries: [saved, ...s.diaries.filter((d) => d.id !== saved.id)],
        posts: [post, ...s.posts.filter((p) => p.id !== s.links[saved.id])],
        links: { ...s.links, [saved.id]: post.id },
      }));
      if (mounted.current) {
        setDraft(saved);
        setDirty(false);
        setModal(null);
        setNotice(
          "로컬 시연 피드에 게시했습니다. 다른 사람에게 전송되지 않았어요.",
        );
      }
    } catch (e) {
      if (mounted.current && !controller.signal.aborted)
        setError((e as Error).message);
    } finally {
      locked.current = false;
      if (mounted.current) setBusy("");
    }
  }
  function unshare() {
    update((s) => {
      const links = { ...s.links };
      delete links[draft.id];
      return {
        ...s,
        links,
        posts: s.posts.filter((p) => p.id !== linkedPost),
        diaries: s.diaries.map((d) =>
          d.id === draft.id ? { ...d, visibility: "private" } : d,
        ),
      };
    });
    setDraft((d) => ({ ...d, visibility: "private" }));
    setNotice("공유를 취소했습니다. 일기는 비공개로 보관됩니다.");
  }
  const valid = !!draft.title.trim() && !!draft.poem.trim();
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.row, { padding: 16 }]}>
          <IconButton
            name="chevron-back"
            label="그림일기 나가기"
            onPress={leave}
          />
          <Title>
            {stage === "review" ? "오늘의 마음 살펴보기" : "나의 그림일기"}
          </Title>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <Text style={styles.badge}>그림·본문·감정 해석 모두 AI 시연</Text>
          <Copy muted>
            일기는 기본 비공개예요. 마음의 해석은 정답이 아니며 직접 고칠 수
            있어요.
          </Copy>
          {busy ? (
            <View style={styles.card}>
              <ActivityIndicator color="#526E46" />
              <Copy>{busy}</Copy>
              <Button label="생성 취소" secondary onPress={cancel} />
            </View>
          ) : null}
          {error ? (
            <Copy>{error} 아래 생성 버튼으로 다시 시도할 수 있어요.</Copy>
          ) : null}
          {notice ? <Copy>{notice}</Copy> : null}
          <Field
            label="공유하지 않는 대화 요약 · 직접 확인하고 수정해 주세요"
            value={draft.summary}
            onChangeText={(summary) => change({ summary })}
            multiline
            editable={!busy}
            maxLength={6000}
          />
          <Field
            label="내가 확인한 감정 (쉼표로 구분)"
            value={draft.userConfirmedEmotions.join(",")}
            onChangeText={(value) =>
              change({ userConfirmedEmotions: value.split(",") })
            }
            editable={!busy}
            maxLength={200}
          />
          {stage === "review" ? (
            <>
              {error && !draft.summary.trim() && (
                <Button
                  label="대화 요약 다시 불러오기"
                  secondary
                  disabled={!!busy}
                  onPress={() => {
                    setError("");
                    setBusy("대화 내용을 모으고 있어요");
                    setSummaryAttempt((n) => n + 1);
                  }}
                />
              )}
              <Copy muted>
                실제 맞춤 이미지 생성은 아직 연결되지 않았어요. 제공된 예시
                작품과 시로 시작해 직접 수정합니다.
              </Copy>
              <Button
                label={error ? "다시 생성하기" : "확인한 내용으로 시연 생성"}
                disabled={!!busy || !draft.summary.trim()}
                onPress={() => void generate()}
                icon="sparkles-outline"
              />
            </>
          ) : (
            <>
              <Image
                source={diaryArt}
                resizeMode="contain"
                style={{ width: "100%", aspectRatio: 1, borderRadius: 20 }}
              />
              <Text style={styles.badge}>예시 작품 · 실제 맞춤 생성 아님</Text>
              <Field
                label="일기 제목"
                value={draft.title}
                onChangeText={(title) => change({ title })}
                editable={!busy}
                maxLength={120}
              />
              <Field
                label="내가 다듬는 시적 일기"
                value={draft.poem}
                onChangeText={(poem) => change({ poem })}
                editable={!busy}
                multiline
                maxLength={6000}
              />
              <Copy muted>{draft.interpretation}</Copy>
              <Button
                label="내 기록에 보관"
                disabled={!!busy || !valid}
                onPress={save}
                icon="bookmark-outline"
              />
              <Button
                label={
                  linkedPost
                    ? "수정한 내용 공유 미리보기"
                    : "익명 공유 미리보기"
                }
                secondary
                disabled={!!busy || !valid}
                onPress={() => setModal("share")}
                icon="share-outline"
              />
              {linkedPost && (
                <Button
                  label="공유 취소 · 비공개로"
                  secondary
                  disabled={!!busy}
                  onPress={unshare}
                />
              )}
              <Button
                label="시연 다시 생성"
                secondary
                disabled={!!busy}
                onPress={() => setModal("regenerate")}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {modal === "share" && (
        <Sheet
          title="공유 전 마지막 확인"
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          <Copy>
            아래 그림·제목·본문만 익명의 산책자로 게시돼요. 이름이나 개인적인
            내용이 있는지 직접 확인해 주세요. 대화·요약·감정·세션 ID는 게시하지
            않아요.
          </Copy>
          <Image
            source={diaryArt}
            style={{ width: "100%", aspectRatio: 1 }}
            resizeMode="contain"
          />
          <Title>{draft.title}</Title>
          <Copy>{draft.poem}</Copy>
          <Copy muted>이 기기에만 저장되는 시연이며 외부 전송은 없습니다.</Copy>
          {error && <Copy>{error}</Copy>}
          <Button
            label={busy ? "게시 중…" : "이 내용으로 게시 확인"}
            disabled={!!busy}
            onPress={() => void publish()}
          />
          <Button
            label="게시 취소"
            secondary
            disabled={!!busy}
            onPress={() => setModal(null)}
          />
        </Sheet>
      )}
      {modal === "leave" && (
        <Sheet title="그림일기를 나갈까요?" onClose={() => setModal(null)}>
          <Copy>
            저장하지 않은 수정은 사라지고 진행 중인 생성은 취소됩니다. 이미
            보관한 일기는 유지됩니다.
          </Copy>
          <Button label="편집 계속하기" onPress={() => setModal(null)} />
          <Button
            label="생성 취소하고 나가기"
            secondary
            onPress={() => {
              cancel();
              onBack();
            }}
          />
        </Sheet>
      )}
      {modal === "regenerate" && (
        <Sheet title="예시로 다시 만들까요?" onClose={() => setModal(null)}>
          <Copy>
            현재 편집 중인 제목과 본문을 제공된 예시로 덮어씁니다. 저장된 일기는
            다시 보관하기 전까지 유지돼요.
          </Copy>
          <Button label="덮어쓰고 다시 생성" onPress={() => void generate()} />
          <Button label="편집 유지" secondary onPress={() => setModal(null)} />
        </Sheet>
      )}
    </SafeAreaView>
  );
}
