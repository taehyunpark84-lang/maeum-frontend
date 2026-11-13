# 마음이 머무는 곳 — 모바일 MVP

React Native + Expo + TypeScript로 만든 로컬 mock 앱입니다. WebView를 사용하지 않습니다. 실제 AI/API 키/로그인/서버 없이 핵심 흐름을 실행합니다.

## 시작하기 (PowerShell)

```powershell
cd 'C:\최종프로젝트1\maeum-frontend\mobile'
npm.cmd ci
npm.cmd start
```

이 PC의 기본 nvm shim에서는 활성 Node를 찾지 못했습니다. 같은 오류가 나면 **현재 터미널에만** 아래 PATH를 지정한 뒤 실행합니다(시스템 환경변수 변경 없음).

```powershell
$env:Path = 'C:\Users\smhrd1\AppData\Local\Author Software\nvm\installs\v24.21.0;' + $env:Path
npm.cmd start
```

- 확인한 런타임: Node 24.21.0, npm 11.19.0. 의존성은 package-lock.json에 고정됩니다.
- Expo SDK 58 / React Native 0.88.1 / React 19.3.0 / TypeScript 6.0.3.
- 최초 SDK 57 템플릿에서 시작했으나, 2026-11-06 실제 Android Expo Go가 SDK 58임을 확인해 [공식 업그레이드 절차](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)에 따라 SDK 58로 변경했습니다.
- 휴대폰과 PC를 같은 Wi-Fi에 연결하고, SDK 58을 지원하는 Expo Go로 Metro QR을 엽니다. Expo Go 지원 버전은 배포 시점에 달라질 수 있으니 [공식 다운로드](https://expo.dev/go)를 확인하세요.
- Android: Android Studio SDK·에뮬레이터 또는 USB 디버깅 기기를 준비한 뒤 `npm.cmd run android`. 에뮬레이터 없이도 Expo Go로 QR 실행 가능.
- iOS: Windows에서 iOS 시뮬레이터·네이티브 빌드는 불가. iPhone Expo Go 또는 macOS에서 `npm run ios` 사용.
- `npm.cmd run web`은 보조 미리보기이며 모바일 검증을 대신하지 않습니다.
- 최초 패키지 설치와 Expo Go 설치에는 인터넷이 필요합니다. 앱의 대화·일기·피드 시연은 외부 API를 호출하지 않습니다.

## 구현한 흐름

1. 닉네임으로 로컬 시작 → 네 공간 선택 → 장소 소개 → 새 대화.
2. 장소에 맞는 풍경/작은 프로필/강조색, 입력·전송·시연 답변, 실패 재시도, 배경만 보기와 Android 뒤로가기 복귀.
3. 대화는 자동 보관. 다른 장소 진입 시 새 sessionId 생성. 내 기록이나 공간의 지난 대화 버튼에서 같은 대화 재개.
4. 사용자 발화 이후 그림일기 버튼 → 요약·감정 직접 확인/수정 → 예시 작품 생성 → 제목·본문 수정 → 비공개 보관.
5. 공유 미리보기에서 명시적으로 확인한 그림·제목·본문만 익명 로컬 게시물에 복사. 기존 게시물은 일기 편집만으로 변경되지 않음.
6. 공유 취소, 피드 공감 토글, 댓글 저장, 신고 시연, 별칭 차단/해제, 게시물 삭제.
7. 일기·대화 삭제 확인, 공유한 일기 삭제 시 게시물 유지/동시 삭제 선택, 전체 데이터 초기화.

공간 화면의 **제공된 대화로 그림일기 체험**으로 원본 demo.json의 가상 대화와 작품을 빠르게 확인할 수 있습니다.

## 시연과 개인정보

- AI 답변은 고정된 예시 응답입니다. 요약은 사용자 발화 모음 또는 제공된 데모 요약이며 감정은 직접 수정 가능한 시연 값입니다.
- 그림과 시는 제공된 예시를 재사용하며 모든 화면에 예시 작품임을 표시합니다. 실제 맞춤 생성이 아닙니다.
- 6개 공간 모두 `assets/audio/*-loop-small.mp3` 음원 연결. 재생·일시정지·정지·반복·볼륨·음소거를 실제 구현했습니다. 각 공간에 맞는 사용자 제공 반복 음원이 앱에 포함됩니다. 추가 음원 등록과 재생 정책은 [음원 안내](../docs/AUDIO.md)를 참고하세요.
- AsyncStorage는 개발용 평문 저장소입니다. 실제 민감정보를 넣지 마세요. 버전 필드·구조 검증·손상 복구·저장 실패 안내가 있습니다.
- 앱을 강제 종료할 때 아직 쓰기 중이던 최신 변경은 저장되지 않을 수 있습니다. 제품 출시 전 암호화·보존·동기화 정책이 필요합니다.
- 공개 Post는 Session/실명/감정/요약을 포함하지 않습니다. 사용자가 본문에 직접 적은 이름까지 자동 삭제하지는 않으므로 미리보기에서 검토합니다.
- 원본 assets/docs/references 유지. 앱은 mobile/assets 복사본만 정적 require로 사용합니다. 목업은 화면으로 사용하지 않습니다.

## 실패/취소 확인

공간 우측 설정 → `다음 서비스 요청 1회 실패시키기` 또는 지연 4초 설정. 다음 답변/요약/그림/공유 호출에 적용됩니다. 실패 플래그는 한 번 소모되므로 재시도는 정상입니다. 생성 중 취소하거나 편집 화면을 나가면 진행 중 작업을 취소합니다. 재생성은 편집 덮어쓰기를 확인합니다.

## 검증 명령

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npx.cmd expo install --check
npx.cmd expo-doctor
npx.cmd expo export --platform all
```

타입·린트·단위 테스트, SDK 호환성, Expo 진단, Android/iOS Hermes 번들을 확인합니다. export 성공은 APK 설치나 실기기 화면 검증을 뜻하지 않습니다. 실제 결과·미검증 항목은 `../docs/PROGRESS.md`에 기록합니다.

## 기기에서 남은 확인

- 360~430dp 화면에서 4개 장소의 풍경·프로필·큰 글씨·버튼 터치 확인.
- Android/iOS 키보드가 입력창을 가리지 않는지, 위로 스크롤 중 새 답변이 강제 이동하지 않는지 확인.
- 배경 보기에서 Android 뒤로가기 → 채팅, 다시 뒤로가기 → 공간.
- 메시지 보내기 → 앱 재시작 → 닉네임/대화/볼륨 복원, 장소 변경 후 기존 세션 유지.
- 일기 생성 취소/실패/재시도, 본문 수정·보관·재시작 복원.
- 공유 취소/확인/삭제, 원문 대화가 피드에 없는지 확인.
- 화면 캡처를 `../docs/screenshots/`에 저장. 현재 실기기 스크린샷은 없습니다.

## 향후 서버 연결 위치

| 파일 | 역할 / 교체할 부분 |
|---|---|
| src/services/mock.ts | ChatService.send, DiaryService.summarize/generate, FeedService.publish를 FastAPI 어댑터로 교체. UI 직접 모델 호출 금지. AbortSignal 취소 계약 유지 |
| src/types.ts | 서버 요청/응답과 개인 Session·Diary / 공개 ApprovedSnapshot·Post 계약 |
| src/storage/store.tsx, model.ts | 로컬 저장, 검증/버전 이전, 추후 인증·DB 동기화 연결 |
| src/config/assets.ts | 정적 이미지와 audioSources. 6개 장소 반복 MP3를 정적 require로 등록 |
| src/features/Chat.tsx, DiaryEditor.tsx | 서비스 호출·오류·재시도·취소 처리 |

실기기에서 FastAPI 주소는 `localhost`가 아니라 **개발 PC의 LAN IP**(예: `http://192.168.0.10:8000`)를 사용합니다. 운영은 HTTPS·인증을 구성합니다. AI 키는 서버 환경변수에만 두고 앱과 EXPO_PUBLIC 변수에 넣지 않습니다. 서버 응답 검증·타임아웃·중복 요청 방지 키·운영 신고 체계는 백엔드 연동 시 추가합니다.

감정통/양파, 타로, 치료·진단, 결제, 실제 로그인/커뮤니티/AI 생성은 범위 밖입니다. 위험 단어 횟수에 따른 강제 종료는 구현하지 않았습니다. 실제 서비스의 안전 대응·위기 상황 안내·개인정보 정책은 별도 검토가 필요합니다.


## Expo Go 버전 오류 후 다시 실행

SDK 58로 업데이트된 현재 폴더에서는 기존 Metro 터미널을 Ctrl+C로 종료하고 아래 명령을 실행한 뒤 새 QR을 스캔하세요.

```powershell
npm.cmd start -- --clear
```

2026-11-06 설치 시 electron-to-chromium 1.5.478 다운로드가 npm에서 404를 반환하여 1.5.477로 고정했습니다. 정상 배포 확인 후 package.json overrides 해제 여부를 검토합니다.
