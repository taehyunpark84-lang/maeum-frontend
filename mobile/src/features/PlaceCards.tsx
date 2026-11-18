import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { places } from "../config/assets";
import { colors } from "../components/ui";
import type { PlaceId } from "../types";

export default function PlaceCards({
  selectedId,
  onSelect,
}: {
  selectedId: PlaceId;
  onSelect: (id: PlaceId) => void;
}) {
  return (
    <View style={local.grid}>
      {(Object.keys(places) as PlaceId[]).map((id) => {
        const place = places[id];
        const selected = id === selectedId;
        return (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityLabel={`${place.name}, ${place.concept}, ${place.character}. ${place.description}`}
            accessibilityHint="대화방 소개를 엽니다"
            accessibilityState={{ selected }}
            onPress={() => onSelect(id)}
            style={({ pressed }) => [
              local.card,
              {
                width: "100%",
                borderColor: selected ? place.color : colors.line,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <ImageBackground source={place.background} style={local.landscape}>
              <LinearGradient
                colors={["transparent", "#172318B8"]}
                style={local.gradient}
              >
                <Text style={local.name}>{place.name}</Text>
              </LinearGradient>
              {selected && (
                <View style={[local.check, { backgroundColor: place.color }]}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
              )}
            </ImageBackground>
            <View style={local.body}>
              <Text style={[local.concept, { color: place.color }]}>
                {place.concept}
              </Text>
              <Text style={local.description}>{place.description}</Text>
              <View style={local.character}>
                <Image source={place.avatar} style={local.avatar} />
                <Text style={local.characterName}>{place.character}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.muted}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const local = StyleSheet.create({
  grid: {
    gap: 12,
    alignItems: "stretch",
  },
  card: {
    flexGrow: 1,
    borderWidth: 1.5,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.panel,
  },
  // 풍경은 넓게, 이미지 높이는 최대 220dp로 제한합니다.
  landscape: { width: "100%", aspectRatio: 1.85, maxHeight: 220 },
  gradient: { flex: 1, justifyContent: "flex-end", padding: 12 },
  name: { color: "#fff", fontSize: 19, fontWeight: "700" },
  check: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 12, gap: 4 },
  concept: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  character: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  characterName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
});
