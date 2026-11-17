import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import { Album, Asset, requestPermissionsAsync } from "expo-media-library";
import { API_URL, authHeaders } from "./api";

export async function saveArtwork(id: string): Promise<string> {
  if (Platform.OS === "web")
    throw new Error("사진첩 저장은 Android/iOS 앱에서 사용할 수 있습니다.");
  const permission = await requestPermissionsAsync(false, ["photo"]).catch(
    () => {
      throw new Error(
        "이 실행 환경에서는 사진첩 권한을 사용할 수 없습니다. Android Expo Go에서는 사진첩 기능이 제한되므로 개발 빌드로 설치한 앱에서 저장해 주세요.",
      );
    },
  );
  if (!permission.granted)
    throw new Error(
      "사진첩 저장 권한이 필요합니다. 휴대폰 설정에서 권한을 허용해 주세요.",
    );
  const file = new File(Paths.cache, `maeum-${id}.png`);
  try {
    await File.downloadFileAsync(`${API_URL}/diaries/${id}/image`, file, {
      headers: authHeaders(),
      idempotent: true,
    });
    const album = await Album.get("마음이 머무는 곳");
    if (album) {
      await Asset.create(file.uri, album);
    } else {
      const asset = await Asset.create(file.uri);
      try {
        await Album.create("마음이 머무는 곳", [asset]);
      } catch {
        return "사진첩에 저장했습니다. 기기의 권한 설정으로 전용 앨범에는 넣지 못했습니다.";
      }
    }
    return "사진첩의 ‘마음이 머무는 곳’ 앨범에 그림을 저장했습니다.";
  } finally {
    if (file.exists) file.delete();
  }
}
