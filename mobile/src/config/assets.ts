import type { PlaceId } from "../types";

export const places = {
  forest: {
    name: "숲속 쉼터",
    character: "다람쥐 토리",
    concept: "활기와 작은 즐거움",
    description: "활기가 필요한 날, 작은 즐거움을 함께 찾아요.",
    personality:
      "호기심 많고 장난스러운 다람쥐. 경쾌한 반말과 작은 농담으로 일상에 재미를 더해요.",
    sound: "봄 숲의 새소리",
    color: "#526E46",
    greeting:
      "쪼르르, 토리 왔어! 오늘은 어떤 하루였어? 작은 이야기부터 들려줘.",
    background: require("../../assets/backgrounds/forest.png"),
    avatar: require("../../assets/avatars/tori.png"),
  },
  ocean: {
    name: "노을 바닷가",
    character: "갈매기 나루",
    concept: "환기와 새로운 시선",
    description: "마음을 환기하고, 새로운 시선으로 바라봐요.",
    personality:
      "자유롭고 속 깊은 갈매기. 시원시원한 반말로 이야기를 듣고, 다른 가능성을 함께 찾아요.",
    sound: "파도 · 바닷바람",
    color: "#267481",
    greeting:
      "여기 바람 좋다. 잠깐 쉬어 갈래? 요즘 네 마음에 머무는 이야기가 궁금해.",
    background: require("../../assets/backgrounds/ocean.png"),
    avatar: require("../../assets/avatars/naru.png"),
  },
  cafe: {
    name: "비 오는 카페",
    character: "친구 지우",
    concept: "고민 정리와 작은 실천",
    description: "고민을 정리하고, 작은 실천을 함께 찾아요.",
    personality:
      "친근하고 현실적인 친구. 편하게 이야기를 듣고, 원할 때 고민과 선택지를 함께 정리해요.",
    sound: "빗소리 · 카페 소음",
    color: "#785139",
    greeting: "따뜻한 커피처럼 편하게 이야기하자.",
    background: require("../../assets/backgrounds/cafe.png"),
    avatar: require("../../assets/avatars/jiu.png"),
  },
  temple: {
    name: "고요한 산사",
    character: "도담 스님",
    concept: "마음 비우기와 내려놓기",
    description: "마음 비우기, 붙잡고 있던 생각을 잠시 내려놓아요.",
    personality:
      "온화하고 느긋한 스님. 차분한 존댓말과 짧은 비유로 생각을 한 걸음 떨어져 바라보게 해요.",
    sound: "풍경 소리 · 산바람",
    color: "#697961",
    greeting: "서두르지 않고 마음을 살펴볼까요?",
    background: require("../../assets/backgrounds/temple.png"),
    avatar: require("../../assets/avatars/dodam.png"),
  },
  garden: {
    name: "비밀정원",
    character: "장미나무 로지",
    concept: "자기 발견과 속마음 탐색",
    description: "자기 발견, 내가 바라는 마음을 천천히 알아가요.",
    personality:
      "섬세하고 다정한 장미나무. 꽃과 계절에 빗댄 질문으로 아직 이름 붙이지 못한 바람을 함께 살펴요.",
    sound: "잎사귀 · 정원의 바람",
    color: "#855C68",
    greeting:
      "비밀정원에 잘 오셨어요. 저는 로지예요. 오늘 마음에 머물렀던 작은 순간이 있나요?",
    background: require("../../assets/backgrounds/garden.png"),
    avatar: require("../../assets/avatars/roji.png"),
  },
  cathedral: {
    name: "성당",
    character: "온유 신부님",
    concept: "고백과 화해",
    description: "고백과 화해, 후회를 꺼내고 다시 다가가요.",
    personality:
      "따뜻하고 진중한 신부님. 후회를 차분히 듣고, 사과와 관계 회복을 위한 작은 걸음을 함께 찾아요.",
    sound: "종소리 · 고요한 울림",
    color: "#796447",
    greeting:
      "잘 오셨습니다. 저는 온유입니다. 마음에 남아 있는 이야기를 편안한 만큼 들려주시겠어요?",
    background: require("../../assets/backgrounds/cathedral.png"),
    avatar: require("../../assets/avatars/onyu.png"),
  },
} as const;
export const diaryArt = require("../../assets/diary/demo-art.png");
// Bundled loop edits of the user-provided recordings for all six rooms.
// Other synthetic drafts in assets/audio are intentionally not bundled/referenced.
export const audioSources: Record<PlaceId, number | null> = {
  forest: require("../../assets/audio/forest-loop-small.mp3"),
  ocean: require("../../assets/audio/ocean-loop-small.mp3"),
  cafe: require("../../assets/audio/cafe-loop-small.mp3"),
  temple: require("../../assets/audio/temple-loop-small.mp3"),
  garden: require("../../assets/audio/garden-loop-small.mp3"),
  cathedral: require("../../assets/audio/cathedral-loop-small.mp3"),
};
