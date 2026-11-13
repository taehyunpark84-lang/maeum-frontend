# 작업 상태
현재: mobile/에 로컬 mock MVP 구현. 타입·린트·모델 테스트 통과. 모바일 기기 화면 검증은 미완료.
- [x] 환경 확인과 Expo 프로젝트 생성
- [x] 장소 선택/소개와 이미지 적용
- [x] 채팅/로컬 저장/기록 복원 구현 (기기 재시작 수동 확인은 남음)
- [x] 그림일기/보관/수정 구현
- [x] 로컬 공유 피드/설정 구현
- [x] 타입·린트 확인
- [ ] 모바일 실행·화면 확인

## 결정과 미확정
확정: React Native, 4개 장소, 작은 프로필, 그림·시적 일기, 감정통 제외.
구현 기본안: Expo/TypeScript, 6화면, 로컬 mock, 앱 경로 mobile/.
미확정: 실제 백엔드 계약·인증·음원·스토어 아이콘·운영 안전정책.
## 구현자가 기록할 내용
버전 / 실행 명령 / 검증 결과 / 남은 작업 / 변경한 판단과 이유.

## 2026-11-06 환경·설계 확인
- AGENTS.md, START_HERE.md, docs 01~05 및 목업 9장을 직접 확인.
- 원본 자산 유지. 앱은 mobile/에 생성, 이미지 복사본을 정적 참조.
- 설치된 Node v24.21.0 / npm 11.19.0 발견. 기본 nvm shim이 활성화되지 않아 명령별 PATH로 기존 설치본 사용(시스템 설정 변경 없음).
- 공식 Expo 생성 문서에서 전환기 Expo Go 권장 SDK 57 확인. default@sdk-57 템플릿 생성 시도 중.
- adb / Android SDK는 기본 경로에서 발견되지 않음. 모바일 실행 여부는 검증 단계에 별도 기록.
- 기본 6개 화면, 로컬 상태/AsyncStorage, 승인된 일기 스냅샷만 공개 모델에 복사하는 방식 채택.

## 2026-11-06 구현 및 검증 결과

### 구현 결정과 완료 코드
- Expo default@sdk-57 기반 생성. React Native 0.86.3, React 19.2.3, TypeScript 6.0.3. npm package-lock.json 유지.
- 실기기 Expo Go를 우선해 공식 생성 문서의 전환기 권장 SDK 57 선택: https://docs.expo.dev/get-started/create-a-project/
- Router 루트 + 6종 화면(시작/공간/채팅/일기/기록/피드), 세부 동작은 모달. 미사용 템플릿 예제 소스 제거.
- 원본 assets/의 풍경 4장·프로필 4장·일기 1장을 mobile/assets/에 복사. 9개 원본의 manifest SHA256 및 복사본 일치 확인. docs 지침과 references 원본은 보존.
- 원본 목업 9장을 직접 열어 구도 확인. 풍경 중심/아이보리 패널/작은 원형 프로필/장소별 색 적용. 화면·텍스트·입력·버튼·슬라이더는 실제 RN 컴포넌트.
- AsyncStorage 2.2.0, slider 5.2.0, expo-linear-gradient와 아이콘을 SDK 호환 버전으로 설치. eslint-config-expo는 ~57.0.2로 맞춤.
- 로컬 저장은 버전 1. 구조 검증, 손상/알 수 없는 버전 초기화 안내, 중단된 pending 메시지를 failed로 복원, 쓰기 순서 직렬화, 실패 시 재시도 안내.
- 장소 변경은 새 세션. 기존 대화 보관/재개, 공백·중복 전송 방지, 실패 재시도, 배경만 보기, Android back 처리, 스크롤 위치 보존 구현.
- 일기 요약·감정·제목·본문 편집, 예시 생성/실패/재시도/취소, 재생성 덮어쓰기 확인, 비공개 저장 구현.
- 승인된 title/poem/imageKey만 FeedService에 전달하고 서비스도 명시적 필드 복사. 로컬 공유 확인/취소, 공감 토글·댓글·신고(미접수 명시)·차단 시연 구현.
- 원본 대화 삭제 후 일기 유지. 공유된 일기 삭제는 게시물 유지/동시 삭제를 선택. 유지한 게시물도 피드에서 개별 삭제 가능.
- 실제 음원은 없음. 재생 비활성화 + '음원 준비 중', 볼륨/음소거 설정 저장만 구현. 음원 재생 모듈·권한 요청 없음.
- AI/이미지/공유는 모두 시연임을 표시. 실제 API 키·외부 모델 호출·감정통·양파·진단·타로·결제 없음.

### 실제 실행한 검증
- `npm.cmd run typecheck`: 최종 성공. 초기 템플릿 CSS 선언 및 테스트 Node 타입 오류를 정리한 후 통과.
- `npm.cmd run lint`: 최종 성공, 경고 0. 초기 effect 내 동기 상태 변경을 초기 상태로 옮겨 수정.
- `npm.cmd test`: 최종 7/7 성공. 세션 분리, 수정 일기/설정 복원, 손상 복구, 공개 데이터 allowlist, mock 실패 재시도, 생성 취소, 게시 취소 검증.
- `npx.cmd expo install --check`: Dependencies are up to date.
- `npx.cmd expo-doctor`: 21/21 checks passed.
- `npx.cmd expo export --platform all`: Android·iOS Hermes 및 웹 번들 생성 성공. 처음 샌드박스 임시 경로의 Hermes 파일 쓰기 permission denied로 실패했으며, 승인된 권한으로 재실행해 성공.
- `npm.cmd audit`: 14개(중간 11, 높음 3) 보고. 호환 범위 내 `npm audit fix`로 해소되지 않음. glob/minimatch 및 Router의 query-string/decode-uri-component 등 전이 의존성. SDK 하향/주 버전 변경을 요구하는 강제 fix는 적용하지 않음. 운영 배포 전 호환 SDK 패치/업데이트 검토 필요.
- `npx.cmd expo start --web --port 8081`: Metro 대기 상태 확인. 연결된 브라우저의 localhost 접근은 ERR_CONNECTION_TIMED_OUT. 브라우저 화면 확인 성공으로 기록하지 않음.
- adb/emulator 명령과 통상 Android SDK 경로에 설치 확인되지 않음. Windows에서 iOS 시뮬레이터 실행 불가.

### 미검증·남은 작업
- Android/iOS 실기기 또는 에뮬레이터 설치 실행, 화면 캡처, 360~430dp/큰 글자, 터치, 키보드 겹침, 실제 OS 뒤로가기, 앱 재시작 복원은 수동 검증 필요.
- 번들 성공은 네이티브 빌드/APK 설치/모바일 화면 검증과 다름. docs/screenshots에 실기기 캡처 없음.
- 실제 인증·DB·FastAPI·AI 생성/감정 분석·공유/신고 처리·라이선스 음원·스토어 배포는 범위 밖이며 미구현.
- 개발용 평문 저장 안내 제공. 암호화/보존 정책 및 서버 중복 요청 방지·인증 정책은 실제 서비스 전 필요.
- 위험 단어 5회 강제 종료는 구현하지 않음. 운영 안전 대응/위기 안내는 별도 검토 항목.

### 실행·연결 안내
- 정확한 설치/시작/Android/iOS 제약 및 PC의 nvm PATH 복구 예시는 mobile/README.md에 기재.
- `cd mobile`, `npm.cmd ci`, `npm.cmd start` → SDK 57 호환 Expo Go로 QR 실행.
- 서버 교체 경계: mobile/src/services/mock.ts의 ChatService / DiaryService / FeedService. 모델 계약: mobile/src/types.ts. 저장: mobile/src/storage/. 음원 맵: mobile/src/config/assets.ts.
- 실기기 FastAPI 연결 시 localhost 대신 PC LAN IP 사용. AI 비밀키는 서버에만 배치.

## 2026-11-06 Expo Go SDK 불일치 대응 (진행 중)
- 사용자의 Android 오류 화면에서 Expo Go SDK 58 / 프로젝트 SDK 57 불일치 확인.
- 휴대폰에 설치된 Expo Go에 맞춰 SDK 58로 한 단계 업그레이드. 공식 upgrade 가이드 및 SDK 58 변경사항 확인.
- expo install --fix가 기존 node_modules의 peer dependency 충돌로 실패하여 기존 설치 파일을 mobile/.sdk-upgrade-backup에 보관 후 새 설치 진행.
- 원본 자산·앱 기능·AsyncStorage 키/스키마는 변경하지 않음.

### SDK 58 전환 완료
- expo ~58.0.23, React Native 0.88.1, React 19.3.0 및 Expo 권장 라이브러리 버전으로 package.json/package-lock.json 갱신.
- npm 레지스트리의 electron-to-chromium 1.5.478 tarball이 404를 반환하여 직전 설치 확인 버전 1.5.477로 overrides 고정. 향후 정상 배포 확인 후 고정 해제 검토.
- 새 설치 성공 후 임시 .sdk-upgrade-backup 정리. 원본 자산과 로컬 저장 키 유지.
- RN 0.88의 ScrollView ref 타입을 ScrollViewInstance로 수정.
- expo install --check: 정상. expo-doctor: 20/20 통과. 단위 테스트 7/7 통과. Android/iOS Hermes 및 웹 export 성공.
- 설치 감사 결과: 높음 0개, 중간 12개. 이전 14개 감사 기록은 SDK 57 시점 결과이며 현재 수치로 대체해 해석.
- 휴대폰에서 앱 화면이 표시되는지는 아직 확인하지 않음. 사용자 터미널에서 Ctrl+C 후 npm.cmd start -- --clear 실행, 새 QR 스캔 필요.
- 근거: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/ 및 https://expo.dev/changelog/sdk-58
- SDK 58 최종 npm.cmd run typecheck 및 npm.cmd run lint 모두 종료 코드 0으로 통과.

## 2026-11-13 대화방 컨셉을 실제 앱 화면에 적용

### 구현
- 최신 사용자 지시에 따라 6개 공간으로 확장. 숲속 쉼터·노을 바닷가·비 오는 카페·고요한 산사·비밀정원·성당을 표시.
- 공간 카드에 풍경, 컨셉, 앱 설명 문구, 작은 캐릭터 프로필을 배치. 카드 터치로 소개 시트를 열고 선택 상태 저장.
- 소개 시트에 캐릭터 특징과 첫인사를 표시하고 대화 시작 버튼을 하단에 고정. 큰 글자 또는 좁은 화면은 카드 1열로 전환하도록 구현.
- 채팅 헤더에 컨셉 표시. 캐릭터별 첫인사와 정해진 시연 답변 적용. 실제 시스템 프롬프트 기반 AI 모델 연결은 미구현이며 시연 표시 유지.
- garden/cathedral 타입과 저장 복원 허용 목록, 음원 준비 상태를 추가. 신규 공간의 저장 복원 회귀 테스트 추가.
- 내장 이미지 생성 도구로 새 배경 2장과 프로필 2장을 생성하여 mobile/assets/backgrounds/garden.png, cathedral.png 및 mobile/assets/avatars/roji.png, onyu.png에 저장.
- 이미지 프롬프트 요지: 아침빛·장미·담쟁이 석조 아치가 있는 비밀정원, 스테인드글라스·목재 의자·따뜻한 햇빛의 성당, 분홍 장미가 둘러싼 온화한 의인화 장미나무, 로만 칼라를 착용한 다정한 가상 한국인 신부. 풍경에는 인물을 넣지 않고 프로필은 중앙 얼굴 구도로 생성. 텍스트·UI 제외.

### 검증
- 번들 Node 실행 파일로 `node_modules/typescript/bin/tsc --noEmit` 성공.
- `node_modules/eslint/bin/eslint.js src tests --max-warnings=0` 최종 성공. 미사용 타입 import 경고 수정 후 재검증.
- `node --import tsx --test tests/*.test.ts` 8/8 성공. 기존 장소와 신규 장소의 저장·복원 포함.
- Android 에뮬레이터 emulator-5554의 Expo Go에서 네이티브 실행. `node node_modules/expo/bin/cli start --port 8083 --offline` 및 `adb reverse tcp:8083 tcp:8083`, `exp://127.0.0.1:8083`로 연결. Android 번들 1558개 모듈 생성 성공.
- 6개 카드 스크롤 표시, 숲속 쉼터 소개, 비밀정원·성당 소개 및 채팅 진입, 비밀정원 메시지 전송과 로지 시연 응답, 장소 선택 복귀 확인.
- Expo Go 강제 종료·재실행 후 성당 및 비밀정원 대화 기록 복원 확인. 테스트 입력 `hello`가 비밀정원 기록에 남아 있음.
- docs/screenshots/places-2026-11-13.png, places-garden-cathedral-2026-11-13.png, garden-chat-2026-11-13.png, cathedral-intro-2026-11-13.png, cathedral-chat-2026-11-13.png에 실제 Android 화면 저장. 일부 캡처의 회색 Tools 아이콘은 Expo Go 개발 도구 오버레이.
- 8081은 다른 프로젝트 서버여서 이 앱 전용 8083 사용. 샌드박스 안에서 시작한 8082 서버는 외부 로컬 요청이 시간 초과하여 접근 가능한 권한으로 8083 실행.
- iOS, 실제 휴대폰, 모든 글자 크기·화면 폭 조합은 이번 작업에서 미검증. 실제 AI·감정 분석·음원 재생은 미연결.

### 실행
- mobile 폴더에서 `npm.cmd start -- --port 8083` 실행. Android 에뮬레이터는 `a`로 열기. 실제 휴대폰은 같은 네트워크에서 새 QR 스캔.
- 이번 작업은 기존 설치된 Expo SDK 58 및 라이브러리를 사용했으며 의존성 설치 변경 없음.
