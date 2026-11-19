import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFonts,
  NanumMyeongjo_400Regular,
} from "@expo-google-fonts/nanum-myeongjo";
import {
  Button,
  Copy,
  Field,
  IconButton,
  Sheet,
  Title,
  styles,
} from "../../components/ui";
import { useAudioController } from "../../components/AmbientAudioProvider";
import { audioSources } from "../../config/assets";
import {
  api,
  ApiError,
  API_URL,
  restoreToken,
  saveToken,
  requestId,
  type Account,
  type Artwork,
  type GenerationJob,
  type Metric,
  type OnlineSession,
} from "../../services/api";
import { saveArtwork } from "../../services/saveArtwork";
import PlaceCards from "../PlaceCards";
import AuthScreen from "./AuthScreen";
import OnlineChat from "./OnlineChat";
import JobStatus from "./JobStatus";
import ArtworkImage, { useImageViewport } from "./ArtworkImage";
import type { PlaceId } from "../../types";

export default function OnlineApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const galleryScroll = useRef<ScrollViewInstance>(null);
  const imageViewport = useImageViewport(galleryScroll);
  const [imageScope, setImageScope] = useState("");
  useEffect(
    () => () => {
      void Image.clearMemoryCache().catch(() => {});
      void Image.clearDiskCache().catch(() => {});
    },
    [account],
  );
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"places" | "gallery">("places");
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [selected, setSelected] = useState<PlaceId>("forest");
  const [chat, setChat] = useState<OnlineSession | null>(null);
  const [art, setArt] = useState<Artwork | null>(null);
  const [preview, setPreview] = useState<{
    sessionId: string;
    previewId: string;
    summary: string;
    requestId: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [settings, setSettings] = useState(false);
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [fontsLoaded] = useFonts({ PoemFont: NanumMyeongjo_400Regular });
  const actionLock = useRef(false);
  const epoch = useRef(0);
  const audio = useAudioController();
  const activeJob = jobs.find((job) =>
    ["queued", "running"].includes(job.status),
  );
  const generationBusy = !!activeJob || busy;

  const refresh = useCallback(async () => {
    const version = epoch.current;
    const [nextArtworks, nextJobs] = await Promise.all([
      api<Artwork[]>("/diaries"),
      api<GenerationJob[]>("/jobs"),
    ]);
    if (version !== epoch.current) return;
    setArtworks(nextArtworks);
    setJobs(nextJobs);
  }, []);
  const authenticate = useCallback(async () => {
    const user = await api<Account>("/me");
    await refresh();
    // 이미지 캐시만 로그인마다 분리합니다. 인증 처리 자체는 그대로입니다.
    setImageScope(`${user.id}-${Date.now()}-${Math.random()}`);
    setAccount(user);
  }, [refresh]);
  useEffect(() => {
    restoreToken()
      .then(async (exists) => {
        if (exists) await authenticate();
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "연결 실패");
      })
      .finally(() => setReady(true));
  }, [authenticate]);
  useEffect(() => {
    if (!account) return;
    let running = false;
    let alive = true;
    async function poll() {
      if (running || AppState.currentState === "background") return;
      running = true;
      try {
        await refresh();
      } catch (e) {
        if (alive && e instanceof ApiError && e.status === 401) {
          epoch.current++;
          setAccount(null);
          setChat(null);
          setArt(null);
          setPreview(null);
          setArtworks([]);
          setJobs([]);
          setMetrics(null);
          await saveToken("");
        } else if (alive)
          setError("서버 상태를 확인하지 못했어요. 자동으로 다시 연결합니다.");
      } finally {
        running = false;
      }
    }
    const interval = setInterval(() => void poll(), 4000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void poll();
    });
    return () => {
      alive = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [account, refresh]);
  useEffect(() => {
    const id = chat?.place_id ?? null;
    audio.select(id, id ? audioSources[id] : null);
  }, [audio, chat]);
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (art) {
        setArt(null);
        return true;
      }
      if (tab !== "places" && !chat) {
        setTab("places");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [art, tab, chat]);

  async function perform(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  async function enter(id: PlaceId) {
    await perform(async () => {
      const session = await api<OnlineSession>("/sessions", "POST", {
        place_id: id,
      });
      setSelected(id);
      setChat(session);
      await refresh();
    });
  }
  async function prepareDiary() {
    if (!chat || generationBusy) return;
    const id = chat.id;
    setReviewing(true);
    await perform(async () => {
      const result = await api<{ summary: string; preview_id: string }>(
        `/sessions/${id}/preview`,
        "POST",
      );
      setPreview({
        sessionId: id,
        previewId: result.preview_id,
        summary: result.summary,
        requestId: requestId(),
      });
    });
    setReviewing(false);
  }
  async function generate() {
    if (!preview || activeJob) return;
    await perform(async () => {
      const job = await api<GenerationJob>("/jobs", "POST", {
        session_id: preview.sessionId,
        approved_summary: preview.summary,
        preview_id: preview.previewId,
        request_id: preview.requestId,
      });
      setJobs((current) => [job, ...current.filter((j) => j.id !== job.id)]);
      setPreview(null);
    });
  }
  async function logout() {
    await perform(async () => {
      await api("/auth/logout", "POST");
      await saveToken("");
      epoch.current++;
      setAccount(null);
      setChat(null);
      setArt(null);
      setPreview(null);
      setSettings(false);
      setArtworks([]);
      setJobs([]);
      setMetrics(null);
    });
  }
  const poemStyle = {
    fontFamily: fontsLoaded ? "PoemFont" : undefined,
    fontSize: 21,
    lineHeight: 37,
    color: "#423C33",
    textAlign: "center" as const,
  };

  if (!ready)
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: "center" }]}>
        <ActivityIndicator />
        <Copy>보관함을 열고 있어요…</Copy>
      </SafeAreaView>
    );
  if (!account)
    return (
      <AuthScreen
        onLogin={authenticate}
        logoFont={fontsLoaded ? "PoemFont" : undefined}
      />
    );
  return (
    <View style={{ flex: 1 }}>
      {chat ? (
        <OnlineChat
          key={chat.id}
          imageScope={imageScope}
          session={chat}
          onBack={() => setChat(null)}
          onDiary={() => void prepareDiary()}
          generationBusy={generationBusy}
          activeJob={activeJob}
          reviewing={reviewing}
          poemFont={fontsLoaded ? "PoemFont" : undefined}
          mock={account.ai_mode === "mock"}
        />
      ) : (
        <SafeAreaView style={styles.screen}>
          <View style={[styles.row, { padding: 16 }]}>
            {!art && <View style={{ width: 46 }} />}
            <View
              style={{ flex: 1, alignItems: art ? "flex-start" : "center" }}
            >
              {art ? (
                <Title>마음의 작품</Title>
              ) : (
                <>
                  <Ionicons name="leaf-outline" size={20} color="#526E45" />
                  <Text
                    style={{
                      fontFamily: fontsLoaded ? "PoemFont" : undefined,
                      fontSize: 24,
                      lineHeight: 34,
                      color: "#263D2D",
                      textAlign: "center",
                    }}
                  >
                    마음이 머무는 곳
                  </Text>
                </>
              )}
            </View>
            <IconButton
              name={art ? "close" : "settings-outline"}
              label={art ? "작품 닫기" : "설정"}
              onPress={() => (art ? setArt(null) : setSettings(true))}
            />
          </View>
          <ScrollView
            ref={galleryScroll}
            onLayout={imageViewport.refresh}
            onContentSizeChange={imageViewport.refresh}
            onScroll={imageViewport.refresh}
            scrollEventThrottle={100}
            contentContainerStyle={[
              styles.content,
              tab === "gallery" && !art && { backgroundColor: "#E8E1D5" },
            ]}
          >
            {account.ai_mode === "mock" && (
              <Text style={styles.badge}>
                서버 시연 모드 · 실제 AI 생성 아님
              </Text>
            )}
            {error ? (
              <View style={styles.card}>
                <Copy>{error}</Copy>
                <Button
                  label="다시 불러오기"
                  secondary
                  disabled={busy}
                  onPress={() => void perform(refresh)}
                />
              </View>
            ) : null}
            {art ? (
              <>
                <View
                  style={{
                    backgroundColor: "#4E3D2D",
                    padding: 10,
                    borderWidth: 2,
                    borderColor: "#9D805D",
                  }}
                >
                  <View style={{ padding: 15, backgroundColor: "#FFFCF5" }}>
                    <ArtworkImage
                      key={art.id}
                      id={art.id}
                      scope={imageScope}
                      style={{ width: "100%", aspectRatio: 2 / 3 }}
                    />
                  </View>
                </View>
                <Title>{art.title}</Title>
                <Text selectable style={poemStyle}>
                  {art.poem}
                </Text>
                <Copy muted>{art.interpretation}</Copy>
                <Button
                  label={busy ? "저장 중…" : "사진첩에 그림 저장"}
                  disabled={busy}
                  onPress={() =>
                    void perform(async () => {
                      const result = await saveArtwork(art.id);
                      Alert.alert("저장 완료", result);
                    })
                  }
                />
                <Copy muted>
                  시는 사진에 합성하지 않습니다. 사진첩에는 그림만 저장됩니다.
                </Copy>
              </>
            ) : (
              <>
                {(activeJob || (jobs[0] && jobs[0].status !== "completed")) && (
                  <JobStatus
                    job={activeJob || jobs[0]}
                    retryDisabled={generationBusy}
                    onRetry={() =>
                      void perform(async () => {
                        await api(`/jobs/${jobs[0].id}/retry`, "POST");
                        await refresh();
                      })
                    }
                  />
                )}
                {tab === "places" && (
                  <>
                    <Copy muted>
                      {account.nickname}님, 오늘은 어떤 공간에 머물까요?
                    </Copy>
                    <PlaceCards
                      selectedId={selected}
                      onSelect={(id) => {
                        if (!busy) void enter(id);
                      }}
                    />
                    {busy && <ActivityIndicator />}
                  </>
                )}
                {tab === "gallery" && (
                  <>
                    <View
                      style={{
                        alignItems: "center",
                        paddingVertical: 22,
                        borderBottomWidth: 1,
                        borderColor: "#B5A58B",
                      }}
                    >
                      <Text
                        style={{
                          letterSpacing: 4,
                          fontSize: 12,
                          color: "#77664F",
                        }}
                      >
                        MY PRIVATE GALLERY
                      </Text>
                      <Title>마음의 전시실</Title>
                      <Copy muted>당신의 이야기가 머무는 작은 미술관</Copy>
                    </View>
                    {!artworks.length && (
                      <View style={[styles.card, { padding: 36 }]}>
                        <Copy>
                          아직 걸린 작품이 없어요. 대화를 나눈 뒤 첫 그림일기를
                          만들어 보세요.
                        </Copy>
                      </View>
                    )}
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 20,
                        justifyContent: "space-between",
                      }}
                    >
                      {artworks.map((item) => (
                        <Pressable
                          key={item.id}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.title} 작품 열기`}
                          onPress={() => setArt(item)}
                          style={{ width: "46%", paddingVertical: 16 }}
                        >
                          <View
                            style={{
                              backgroundColor: "#68513B",
                              padding: 7,
                              borderWidth: 2,
                              borderColor: "#AD8A60",
                              boxShadow: "3px 8px 12px #3C302A40",
                            }}
                          >
                            <View
                              style={{
                                padding: 10,
                                backgroundColor: "#FFFCF5",
                              }}
                            >
                              <ArtworkImage
                                id={item.id}
                                scope={imageScope}
                                preview
                                viewport={imageViewport}
                                style={{ width: "100%", aspectRatio: 2 / 3 }}
                              />
                            </View>
                          </View>
                          <View
                            style={{
                              marginTop: 14,
                              padding: 8,
                              backgroundColor: "#F8F5ED",
                              alignSelf: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: "#4C4032",
                                textAlign: "center",
                                fontSize: 14,
                              }}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={{
                                color: "#8C7E6F",
                                fontSize: 10,
                                textAlign: "center",
                                marginTop: 4,
                              }}
                            >
                              {new Date(item.created * 1000).toLocaleDateString(
                                "ko-KR",
                              )}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
          {!art && (
            <View
              style={[styles.row, { padding: 12, backgroundColor: "#FFFCF7" }]}
            >
              {(["places", "gallery"] as const).map((value, index) => (
                <View key={value} style={{ flex: 1 }}>
                  <Button
                    label={["공간", "갤러리"][index]}
                    secondary={tab !== value}
                    onPress={() => setTab(value)}
                  />
                </View>
              ))}
            </View>
          )}
        </SafeAreaView>
      )}
      {chat && error ? (
        <View style={{ padding: 10, backgroundColor: "#FFFCF7" }}>
          <Copy>{error}</Copy>
          <Button label="닫기" secondary onPress={() => setError("")} />
        </View>
      ) : null}
      {reviewing && !chat && (
        <View style={{ padding: 12, backgroundColor: "#FFFCF7" }}>
          <ActivityIndicator />
          <Copy>그림일기를 위한 대화 요약을 준비하고 있어요…</Copy>
        </View>
      )}
      {preview && (
        <Sheet
          title="그림으로 남길 마음"
          onClose={() => {
            if (!busy) setPreview(null);
          }}
        >
          <Copy>
            이 내용을 확인하고 수정해 주세요. 확인한 내용이 작품의 기준이 되며
            이후 대화는 이번 작품에 포함되지 않습니다.
          </Copy>
          <Field
            label="나의 이야기 · 비공개"
            value={preview.summary}
            onChangeText={(summary) =>
              setPreview((current) =>
                current ? { ...current, summary } : null,
              )
            }
            multiline
            maxLength={6000}
            editable={!busy}
          />
          <Copy muted>
            사건을 그대로 그리지 않고 분위기와 감정을 상징·색·구도로 자유롭게
            재해석합니다.
          </Copy>
          {error ? <Copy>{error}</Copy> : null}
          <Button
            label={busy ? "접수 중…" : "확인한 내용으로 작품 만들기"}
            disabled={generationBusy || !preview.summary.trim()}
            onPress={() => void generate()}
          />
        </Sheet>
      )}
      {settings && (
        <Sheet title="계정과 테스트" onClose={() => setSettings(false)}>
          <Copy>{account.nickname}님의 비공개 보관함</Copy>
          <Button
            label="로그아웃"
            secondary
            disabled={busy}
            onPress={() => void logout()}
          />
          {__DEV__ && (
            <>
              <Copy muted>서버: {API_URL}</Copy>
              <Button
                label="최근 AI 호출 측정값 보기"
                secondary
                disabled={busy}
                onPress={() =>
                  void perform(async () =>
                    setMetrics(await api<Metric[]>("/metrics")),
                  )
                }
              />
              {metrics?.length === 0 && <Copy>아직 측정 기록이 없습니다.</Copy>}
              {metrics?.map((metric, index) => (
                <View key={index} style={styles.card}>
                  <Copy>
                    {metric.kind} · {metric.model}
                  </Copy>
                  <Copy>
                    전체 {metric.seconds.toFixed(2)}초 · 첫 글자{" "}
                    {metric.first_token_seconds?.toFixed(2) ?? "-"}초
                  </Copy>
                  <Text selectable>
                    {JSON.stringify(metric.settings, null, 2)}
                  </Text>
                  <Text selectable>
                    {JSON.stringify(metric.usage, null, 2)}
                  </Text>
                </View>
              ))}
            </>
          )}
        </Sheet>
      )}
    </View>
  );
}
