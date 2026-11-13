# 4. 개발 방법
## 프로젝트 위치와 도구
앱 루트는 mobile/. 먼저 폴더 존재 여부를 확인한다. 없으면 Expo 공식 create-project 문서를 확인하여 TypeScript·Expo Router 기본 템플릿으로 mobile/을 만든다. Expo Go와 SDK 전환기 호환성을 확인하고 실제 기기에서 실행할 수 있는 버전을 선택한다. 설치된 Node.js LTS와 패키지 매니저 버전을 기록한다. npm과 하나의 lockfile을 기본으로 사용한다.
원본 assets/를 mobile/assets/에 복사한다. 앱은 mobile 내부의 복사본만 참조한다. Metro가 저장소 밖을 찾게 하지 않는다. Expo 기본 AGENTS.md가 생기면 상위 지침과 충돌하지 않게 통합한다.

## 권장 코드 구분
mobile/src/app 또는 템플릿의 app: 라우트. components: 공통 UI. features: chat/diary/places/feed. services: mock/API 교체 지점. storage: 로컬 저장. theme: 색·간격·장소 설정. types: 공유 타입. config/assets.ts: 정적 require 맵.
JSON의 문자열 파일 경로를 require(variable)로 전달하지 않는다. 장소 ID별 정적인 require('./...png')를 코드에 명시한다.
기본 state는 React Context/useReducer 등 간단한 도구를 사용한다. 로컬 저장은 AsyncStorage 등 SDK 호환 수단을 사용하되 개발용 평문 저장임을 명시하고 실제 민감정보를 입력하지 않도록 안내한다. 버전 필드, 손상 데이터 복구, 전체 로컬 기록 삭제 기능을 둔다.

## 서비스 경계
ChatService.send(sessionId, message, history) → assistantMessage.
DiaryService.summarize(sessionId) → summary, emotions, symbols.
DiaryService.generate(approvedSummary) → title, poem, imageReference, interpretation.
FeedService.publish(approvedDiarySnapshot) → localPost.
UI가 모델 API를 직접 호출하지 않고 이 경계만 사용한다. mock은 지연·실패를 개발 설정으로 재현할 수 있게 한다. 기본 정상 흐름은 네트워크 없이 동작한다.

## 저장 모델
Session: id, placeId, createdAt, updatedAt, messages.
Message: id, role(user/assistant), text, createdAt, status.
Diary: id, sessionId, title, poem, imageKey/uri, summary, userConfirmedEmotions, createdAt, updatedAt, visibility(private 기본).
Post: id, alias, title, poem, imageKey/uri, reactions, createdAt. 공개 데이터와 개인 Session을 분리한다.
Settings: nickname, selectedPlaceId, volume(0~1), audioEnabled(false 기본).
일기와 연결된 대화를 삭제해도 일기는 남는 정책을 안내한다. 공유한 일기 삭제 시 로컬 게시물도 제거할지 확인한다.

## 사운드
assets/audio/README.md 참조. 현재 파일이 없으므로 source=null 상태로 정상 실행되어야 한다. 재생 버튼은 비활성화하고 '음원 준비 중' 표시. 볼륨 UI는 설정값 저장이 가능하나 '재생 중'으로 표시하지 않는다.
음원이 추가되면 expo-audio의 선택 SDK 문서를 확인하여 연결한다. 루프, 사용자 시작, 볼륨, 장소 변경 시 이전 플레이어 해제, 앱 비활성 시 정지 구현. 백그라운드 재생·녹음·마이크 권한은 요청하지 않는다.

## 구현 순서
1. 환경·라우팅·자산 확인 → 2. 장소 선택/소개와 4가지 테마 → 3. 채팅·로컬 저장 → 4. 그림일기·내 기록 → 5. 로컬 공유 피드·설정 → 6. 기기 검증.
완료 후 mobile/README.md에 정확한 설치·시작·Android 실행 명령과 iOS 실행 제약, 서버 연결 지점을 적는다. 실기기에서 향후 FastAPI를 붙일 때 localhost 대신 개발 PC LAN 주소를 사용하도록 설명한다.

공식 문서(2026-11-06 확인, 실제 설치 시 재확인):
- https://docs.expo.dev/get-started/create-a-project/
- https://docs.expo.dev/versions/latest/sdk/audio/
