import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Copy, IconButton } from "../../components/ui";
import { type Artwork } from "../../services/api";
import ArtworkImage, { type ImageViewport } from "./ArtworkImage";

export default function ChatArtwork({
  artwork,
  imageScope,
  viewport,
  poemFont,
}: {
  artwork: Artwork;
  imageScope: string;
  viewport: ImageViewport;
  poemFont?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const fullView = useRef<ScrollViewInstance>(null);
  return (
    <>
      <View style={{ width: 180, maxWidth: "100%", gap: 10 }}>
        <Copy>{artwork.title}</Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${artwork.title} 크게 보기`}
          onPress={() => setExpanded(true)}
        >
          <ArtworkImage
            id={artwork.id}
            scope={imageScope}
            preview
            viewport={viewport}
            style={{
              width: 160,
              maxWidth: "100%",
              aspectRatio: 2 / 3,
              borderRadius: 12,
            }}
          />
          <Text style={{ fontSize: 11, color: "#526047", marginTop: 4 }}>
            그림을 누르면 크게 볼 수 있어요
          </Text>
        </Pressable>
        <Text
          numberOfLines={3}
          selectable
          style={{
            fontFamily: poemFont,
            fontSize: 17,
            lineHeight: 29,
            color: "#423C33",
          }}
        >
          {artwork.poem}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="시 전문 보기"
          onPress={() => setExpanded(true)}
        >
          <Text style={{ fontSize: 12, color: "#526047" }}>
            그림과 시 전체 보기
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={expanded}
        animationType="fade"
        onShow={() => fullView.current?.scrollTo({ y: 0, animated: false })}
        onRequestClose={() => setExpanded(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F8F5ED" }}>
          <View style={{ alignItems: "flex-end", padding: 8 }}>
            <IconButton
              name="close"
              label="큰 그림 닫기"
              onPress={() => setExpanded(false)}
            />
          </View>
          <ScrollView
            ref={fullView}
            contentContainerStyle={{ padding: 16, gap: 16 }}
            maximumZoomScale={3}
          >
            {expanded && (
              <ArtworkImage
                id={artwork.id}
                scope={imageScope}
                style={{ width: "100%", aspectRatio: 2 / 3 }}
              />
            )}
            <Copy>{artwork.title}</Copy>
            <Text
              selectable
              style={{
                fontFamily: poemFont,
                fontSize: 21,
                lineHeight: 37,
                textAlign: "center",
                color: "#423C33",
              }}
            >
              {artwork.poem}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
