import {
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
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
  const { width, fontScale } = useWindowDimensions();
  const singleColumn = width < 360 || fontScale > 1.2;
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
                width: singleColumn ? "100%" : "48%",
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
    flexDirection: "row",
    flexWrap: "wrap",
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
  landscape: { width: "100%", aspectRatio: 1.15 },
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
  body: { padding: 12, gap: 8, flex: 1 },
  concept: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, flex: 1 },
  character: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
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
