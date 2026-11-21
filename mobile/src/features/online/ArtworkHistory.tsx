import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Copy, IconButton, Title, styles } from "../../components/ui";
import { places } from "../../config/assets";
import { api, type Artwork, type OnlineMessage } from "../../services/api";

export default function ArtworkHistory({
  artwork,
  onClose,
}: {
  artwork: Artwork;
  onClose: () => void;
}) {
  const [result, setResult] = useState<{
    available: boolean;
    messages: OnlineMessage[];
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ available: boolean; messages: OnlineMessage[] }>(
      `/diaries/${artwork.id}/messages`,
    )
      .then((value) => {
        if (alive) setResult(value);
      })
      .catch(() => {
        if (alive) setError("대화를 불러오지 못했습니다. 다시 시도해 주세요.");
      });
    return () => {
      alive = false;
    };
  }, [artwork.id, attempt]);
  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={[styles.row, { padding: 16 }]}>
          <View style={{ flex: 1 }}>
            <Title>작품에 담긴 대화</Title>
          </View>
          <IconButton name="close" label="대화 내역 닫기" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <Copy>{artwork.title}</Copy>
          {error ? (
            <>
              <Copy>{error}</Copy>
              <Button
                label="다시 불러오기"
                onPress={() => {
                  setError("");
                  setAttempt((n) => n + 1);
                }}
              />
            </>
          ) : !result ? (
            <ActivityIndicator />
          ) : !result.available ? (
            <Copy muted>연결된 대화 범위를 확인할 수 없습니다.</Copy>
          ) : !result.messages.length ? (
            <Copy muted>표시할 대화가 없습니다.</Copy>
          ) : (
            result.messages.map((message) => {
              const place = message.place_id ? places[message.place_id] : null;
              const mine = message.role === "user";
              return (
                <View
                  key={message.id}
                  style={{
                    alignSelf: mine ? "flex-end" : "flex-start",
                    maxWidth: "92%",
                    gap: 6,
                  }}
                >
                  <View style={styles.row}>
                    {!mine && place && (
                      <Image
                        source={place.avatar}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: 2,
                          borderColor: "#FFF9E8",
                        }}
                      />
                    )}
                    <Text style={{ color: "#687168", fontSize: 13 }}>
                      {mine
                        ? "나"
                        : `${place?.character ?? "AI"} · ${place?.name ?? ""}`}
                    </Text>
                  </View>
                  <View
                    style={{
                      padding: 14,
                      borderRadius: 20,
                      backgroundColor: mine ? "#E7EEDB" : "#FFFFFF",
                    }}
                  >
                    <Copy>{message.text}</Copy>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
