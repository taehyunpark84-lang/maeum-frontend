# maeum-2nd — 새 노트북 독립 프로젝트 이전 지침

개정: 2026-11-19. 확인 기준 커밋: d8a7a8b (로그인 화면과 소리·빛 설정 화면 디자인 정리). 갤러리/대화 이미지 미리보기·캐시 개선을 포함한 현재 소스와 설정을 다시 확인했습니다. 복사 시점의 추가 변경도 새 노트북에서 점검하세요.

## 목적과 단계

원본 maeum-frontend를 유지하면서 maeum-2nd에서 추가 기능을 개발하기 위한 분리입니다. 최종 목표는 백엔드 API와 그림 작업자를 Google Cloud VM에서 실행하고 Google Cloud에 설치된 MySQL에 연결하는 것입니다.

**이번 단계는 새 노트북으로 이전하여 빈 데이터로 로컬 실행을 확인하는 것까지입니다.** API·작업자·SQLite를 새 노트북에서 실행합니다. VM 배포, MySQL 접속, 클라우드 자원 생성/변경, 추가 기능 개발은 이후 요청에서 진행합니다. MySQL이 Cloud SQL인지 VM 설치형인지는 아직 가정하지 않습니다.

## 이름과 폴더 기준

| 항목 | 새 프로젝트 기준 |
|---|---|
| Codex 프로젝트명 / 루트 폴더명 | maeum-2nd (예: C:\projects\maeum-2nd) |
| 향후 GitHub 저장소명 | maeum-2nd, 원본과 별도 새 저장소 |
| 앱 표시 이름 | 마음이 머무는 곳 2nd |
| Expo slug / scheme | maeum-2nd / maeum2nd |
| npm 패키지 이름 | maeum-2nd-mobile |
| Android package / iOS bundleIdentifier | com.taehyun.park.maeum2nd |
| 로컬 DB 파일 | backend/storage/maeum-2nd.db |
| 앱 저장 키 / 토큰 키 | maeum2nd.local.v1 / maeum2nd.api.token |
| 새 실행 안내 파일 | MAEUM_2ND_RUNBOOK.md |
| 이후 클라우드 계획 파일 | docs/MAEUM_2ND_CLOUD_PLAN.md |

위 변경은 새 노트북의 복사본에서만 적용합니다. mobile/, backend/, app.json, package.json, AGENTS.md, 소스 모듈명 등 도구와 import가 사용하는 표준 이름은 유지합니다. 모든 파일을 일괄 변경하지 않고 루트·식별자·DB·전용 안내 파일명으로 구분합니다.

복사 직전에는 진행 중인 코드 수정 작업을 마친 뒤 일관된 한 시점의 파일을 복사하세요. 복사본 루트와 Codex 프로젝트 이름을 모두 maeum-2nd로 지정하세요.
## 1. 복사 준비

가능합니다. 복사한 폴더를 새 노트북 Codex 프로젝트의 작업 폴더로 선택하고 개발 환경을 재설치한 뒤 빈 DB를 만들면 됩니다. 원본 폴더를 지우거나 초기화하지 마세요. 제외 작업은 별도 복사본에서만 합니다.

### 복사하지 않을 것

- `backend/storage/` 전체: 계정·대화·공통 기억·일기·작업 큐 DB, 생성 이미지·썸네일·로그.
- `tmp/`, `output/`, `docs/screenshots/` 전체: DB 백업, 임시 검증 데이터, 산출물, 실제 대화/작품이 찍힌 화면이 있을 수 있습니다.
- 모든 위치의 `.git/`: 루트와 `mobile/.git/` 모두 해당. 이전 이력과 GitHub 연결을 제외합니다.
- 실제 `.env` 파일 전부: `.env`, `.env.local`, `.env.development` 등. **`.env.example`은 유지합니다.**
- `node_modules/`, `.venv/`, `.expo/`, `dist/`, `build/`, `web-build/`, `__pycache__/`, `.pytest_cache/`, `.sdk-upgrade-backup/` 등 설치·캐시·빌드 폴더.
- `.claude/`, `.codex/`, `.agents/`, `.vscode/` 등 로컬 도구 설정/기록 폴더. 일반 파일인 `AGENTS.md`는 유지합니다.
- 별도로 발견되는 DB·WAL·SHM·DB 백업·로그·대화 내보내기·생성 작품 사본·인증서·서명 키. 확장자만 보지 말고 용도를 확인하세요.

### 복사할 것

- `mobile/src/`, `mobile/assets/`, `mobile/tests/`, 설정과 스크립트.
- `mobile/package.json`, **`mobile/package-lock.json`**, `mobile/.env.example`.
- `backend/app/`, `backend/migrations/`, `backend/tests/`, `backend/alembic.ini`, **`backend/requirements.lock.txt`**, `backend/.env.example`, README.
- 원본 `assets/`, `mock-data/`, `references/`, `docs/` 지침, 루트 `AGENTS.md` 등 소스·기획 자료. 위 제외 목록이 우선합니다.
- 이 파일 `MAEUM_2ND_MIGRATION_GUIDE.md`.

기본 풍경·프로필·로고·음원·폰트·고정 예시 그림은 앱 구성 자산이므로 유지합니다. 사용하면서 생성된 작품과 구분하세요. 기획 목업·가상 예시·고정 테스트 데이터도 유지하되 새 DB에 자동 입력하지 않습니다. 소스/기획 폴더에 별도로 저장한 실제 개인 기록이 있다면 제외하세요.

미커밋 수정 코드도 포함하려는 이전이므로 GitHub ZIP만으로 대체하지 마세요. 복사 후 새 노트북 Codex에서 프로젝트를 만들고 복사한 루트 폴더를 선택합니다. 아래 프롬프트 전체를 입력하세요.

## 2. 새 노트북 Codex에 입력할 프롬프트

```text
현재 선택된 폴더는 다른 노트북에서 복사해 온 '마음이 머무는 곳' 프로젝트입니다.
원본 maeum-frontend를 유지하고 복사본 maeum-2nd를 독립 프로젝트로 실행할 준비를 완료해 주세요.
목적은 추가 기능 개발 및 향후 Google Cloud VM에서 API/그림 작업자를 실행하고 Google Cloud MySQL에 연결하는 것입니다. 이번에는 로컬 이전과 빈 데이터 실행만 진행하세요. 클라우드 배포, MySQL 접속/마이그레이션, 자원 생성, 새 기능 개발은 이후 요청에서 진행합니다. MySQL이 Cloud SQL인지 VM 설치형인지 가정하지 마세요.

명명 규칙: 루트/Codex 프로젝트 maeum-2nd, 앱 표시 이름 마음이 머무는 곳 2nd, Expo slug maeum-2nd, scheme maeum2nd, npm 이름 maeum-2nd-mobile, Android package 및 iOS bundleIdentifier com.taehyun.park.maeum2nd, DB 파일 backend/storage/maeum-2nd.db, AsyncStorage 키 maeum2nd.local.v1, 로그인 토큰 키 maeum2nd.api.token을 사용하세요. 현재 폴더가 원본인지 복사본인지 먼저 확인하고 복사본에서만 적용하세요. 루트 이름 변경이 필요하면 Codex 작업 폴더 재연결 절차를 안내하세요.
package.json 이름을 변경할 때 package-lock.json의 루트 이름도 맞추되 의존성 버전은 유지하세요. mobile/backend와 표준 설정 파일 및 소스 모듈 파일명을 일괄 변경하지 마세요.

최우선 요구사항
- 기존 계정·비밀번호 해시·토큰·대화·공통 기억·요약·감정·일기·시·생성 이미지·썸네일·공유 기록·작업 큐·로그·백업은 이전하지 않습니다.
- 새 DB에는 스키마와 마이그레이션 메타데이터만 있고 사용자 데이터는 0건이어야 합니다. 테스트 계정이나 데모 기록을 초기 실행용 DB에 넣지 마세요.
- 기본 풍경·프로필·음원·폰트·로고·고정 예시 그림과 가상 테스트 데이터는 유지합니다. 앱 시작 시 예시를 사용자 기록으로 자동 저장하지 마세요.
- 현재 mobile/backend 코드를 사용하세요. 새 템플릿으로 덮어쓰거나 앱을 재구현하지 마세요. 새 기능 개발은 나중에 합니다.
- 초기화는 이번 최초 설정에만 합니다. 실행할 때마다 DB/기록을 지우는 코드를 넣지 마세요.
- 원본 노트북·원본 GitHub·원본 Expo/EAS 프로젝트에 쓰기 작업을 하지 마세요.

1. 폴더와 지침 확인
실제 작업 경로와 OS를 확인하고 AGENTS.md와 프로젝트 문서를 읽으세요. 초기 기획에는 앱/서버가 없다는 옛 설명이 있습니다. 이번 요청은 이미 있는 모바일 앱과 FastAPI 서버를 실행하는 작업입니다. 서버 기능을 제거하지 마세요. 현재 소스, mobile/README.md, backend/README.md, 최신 docs/PROGRESS.md를 함께 대조하세요.

2. 기존 데이터 제외 확인
MAEUM_2ND_MIGRATION_GUIDE.md의 제외 목록을 확인하세요. backend/storage, tmp, output, docs/screenshots, 실제 .env, DB/WAL/SHM/백업, 로그, 생성 작품 사본, 중첩 .git을 점검하세요. 비밀값과 대화 원문은 터미널/채팅에 출력하지 마세요.
기존 생성 데이터가 남았다면 절대 경로가 이 복사본 내부인지 검증한 뒤 복사본에서만 제거하세요. 원본이나 외부 DB에 접근해 삭제하지 마세요. 소스·기본 자산·기획 자료를 확장자 규칙으로 일괄 삭제하지 마세요. 용도가 불명확한 파일은 삭제 전 경로만 보고하세요.

3. Git 분리
원본 GitHub로 push하지 마세요. .git이 없으면 새 로컬 저장소로 초기화하고 원격은 미설정으로 두세요. 원본 원격이 남아 있으면 복사본에서만 연결을 해제하세요. 향후 전용 새 GitHub 저장소 maeum-2nd에 별도로 저장할 예정입니다. 이번에는 로컬 저장소와 ignore 설정까지만 준비하고 새 저장소 생성/push는 별도 요청에서 진행하세요. 이후 사용자가 제공한 새 저장소 URL을 확인해 origin으로 연결하며 원본 URL을 재사용하지 마세요. .env, storage, 백업, 로그, 생성 파일이 ignore되는지 확인하세요.

4. 개발 환경 설치
Node/npm/Python/Git 설치 상태와 lockfile을 확인하세요. 이전 README의 검증 기록은 Node 24.21.0/npm 11.19.0이며 Python은 3.12 이상입니다. 참고값이므로 실제 lockfile과 버전별 공식 Expo 문서의 호환성을 확인하세요. 가능하면 기존 검증 버전을 맞추고 Expo/React Native를 임의 업그레이드하거나 lockfile을 재생성하지 마세요.
도구가 없으면 공식 설치 경로로 설치를 진행하고, 권한이나 사용자 설치 조작이 필요할 때만 구체적으로 안내하세요. 이전 PC의 절대 PATH는 사용하지 마세요.
Windows에서는 mobile에서 npm.cmd ci를 실행하세요. backend/.venv는 새로 만들고 그 가상환경의 Python으로 requirements.lock.txt를 설치하세요. 복사된 node_modules/.venv는 재사용하지 마세요. 다른 OS는 해당 명령으로 조정하세요.

5. 새 백엔드 설정과 빈 DB
backend/.env.example을 바탕으로 backend/.env를 새로 작성하세요. AI_MODE=mock, OPENAI_API_KEY는 빈 값으로 시작하세요. 이전 키나 DATABASE_URL/DATA_DIR는 복사하지 마세요.
DATA_DIR은 이 복사본 backend/storage 내부, DATABASE_URL은 그 안의 maeum-2nd.db를 가리키는 SQLite URL로 명시 설정하세요. 실제 경로와 외부 환경변수를 확인하세요. 공유/원본 DB에 연결하지 마세요.
backend에서 .venv\Scripts\python.exe -m alembic upgrade head를 실행하세요. 모든 업무 데이터 테이블이 0건인지, 생성 이미지/썸네일이 없는지 확인하세요. alembic_version 같은 메타데이터와 새 빈 DB 파일은 허용합니다. 계정/데모 데이터를 seed하지 마세요.

6. 모바일 서버 주소
mobile/.env.example로 mobile/.env를 새로 작성하세요.
EXPO_PUBLIC_APP_MODE=api를 사용하세요. 모바일 mock 모드와 서버 AI_MODE=mock은 다릅니다. 로그인·DB·작업자 흐름은 유지하고 AI만 시연하려는 것입니다.
EXPO_PUBLIC_API_URL은 새 노트북의 연결 가능한 LAN IPv4와 8000 포트로 설정하세요. 실제 휴대폰에서는 localhost/127.0.0.1이 PC를 뜻하지 않습니다. Android 에뮬레이터에서는 10.0.2.2를 사용할 수 있습니다.
이전 PC IP를 사용하지 마세요. EXPO_PUBLIC_ 변수에 AI 키를 넣지 마세요.

7. Expo 프로젝트와 기기 저장소 분리
mobile/app.json의 원본 extra.eas.projectId 연결을 복사본에서 해제하세요. 앞서 지정한 새 표시 이름, slug/scheme 및 Android package를 적용하세요. 원본 Android package는 com.taehyun.park.maeummobile입니다. iOS 네이티브 빌드를 준비하면 bundleIdentifier도 분리하세요. 실제 사용할 수 있는 식별자를 정해 문서화하세요. 버전별 공식 Expo 문서를 확인하세요.
원본 EAS에 build/update/submit하지 말고 새 클라우드 프로젝트도 임의 생성하지 마세요. 로컬 Expo 실행부터 준비하세요.
같은 휴대폰/에뮬레이터에서 원본 앱을 썼다면 AsyncStorage/SecureStore가 남을 수 있습니다. 복사본의 앱 전용 저장 키와 로그인 토큰 키를 앞서 지정한 이름으로 변경해 새 저장 공간을 사용하게 하세요. 최신 ArtworkImage/artworkImages의 서버·세션별 이미지 캐시 분리와 로그아웃 정리 동작도 보존하고 이전 이미지가 새 프로젝트에 표시되지 않는지 확인하세요. 자동 초기화 코드를 넣지 마세요. 가능하면 새 에뮬레이터/새 앱 설치로 검증하세요. Expo Go 전체 데이터 삭제는 다른 프로젝트에 영향을 주므로 자동 수행하지 마세요. 예전 계정으로 자동 로그인되어서는 안 됩니다.

8. 검증과 실행
mobile의 typecheck/lint/test와 Expo 의존성 호환성을 확인하세요. backend의 pytest/alembic check를 실행하세요. 테스트는 격리된 임시 DB/이미지 경로에서 수행해 초기 실행용 DB에 기록을 남기지 마세요.
backend API: .venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
별도 작업자: .venv\Scripts\python.exe -m app.worker
mobile: npm.cmd start -- --clear
프로세스 작업 경로와 DB를 확인하고 중복 실행하지 마세요. /health와 모바일 로그인/회원가입 첫 화면을 확인하세요. 새 노트북과 휴대폰의 Wi-Fi, LAN IP, VPN/네트워크 격리, 방화벽을 점검하되 방화벽 전체를 끄지 마세요.
실제 모바일 실행이 불가능하면 완료로 표시하지 말고 기기 확인 절차를 안내하세요.

9. 최종 인도 상태
기존 데이터도 테스트 데이터도 없는 상태여야 합니다. 기능 확인용 계정/대화/작품은 별도 임시 DB에서 만드세요. 기본 DB에 검증 데이터를 만들었다면 이번 설정에서 만든 것인지 확인하고 API/작업자를 종료한 뒤 복사본의 검증 데이터만 정리하고 빈 스키마를 다시 만드세요. 이후 사용자의 정상 데이터에는 적용하지 마세요. 기기 저장소에도 검증 로그인/기록을 남기지 마세요.
AI_MODE=mock은 실제 AI 답변/맞춤 그림 생성과 다르다고 설명하세요. 처음에는 키 없이 검증하세요. 실제 AI를 원할 때 사용자가 backend/.env에 키를 직접 입력하도록 안내하고 채팅으로 키를 요청하지 마세요. 모델 사용 가능 여부와 설정을 확인하는 전환 절차를 알려 주세요. 초기 검증에서 유료 호출을 하지 마세요.

10. 기록과 결과 보고
docs/PROGRESS.md에 이번 PC에서 실제 수행한 작업을 기록하고 MAEUM_2ND_RUNBOOK.md에 새 이름과 실제 경로를 사용한 실행 안내를 작성하세요. docs/MAEUM_2ND_CLOUD_PLAN.md에는 이후 API/작업자의 VM 이전, MySQL 종류 확인과 새 전용 DB/계정, API·작업자의 동일 DB 및 이미지 저장 경로, 비밀 설정, HTTPS/API 주소, 이미지 영속 저장과 백업, MySQL 마이그레이션/동시성 검증이 필요하다는 계획만 기록하세요. SQLite 파일이 MySQL로 자동 이전되지 않는다는 점과 향후 데이터 이관 여부를 그 시점에 정해야 한다는 점도 적으세요. 이번에는 클라우드 접속 정보나 키를 요청하거나 연결을 실행하지 마세요. 과거 PC의 성공 기록을 이번 PC에서 검증한 것으로 쓰지 마세요.
한국어로 작업 폴더/도구 버전/독립 식별자/저장 키, 원본 GitHub·EAS·서버 연결 분리 결과, 업무 데이터 0건 및 이미지 없음 확인 결과, API·작업자·Expo 각각의 시작/종료 명령, 실제 서버 주소, 통과/실패/미검증 항목, 휴대폰에서 할 일, 실제 AI 전환 시 설정을 보고하세요.
통상적인 설치/로컬 설정 선택은 직접 진행하고 독립 프로젝트 실행 준비를 끝내 주세요.
```

## 3. 기대 결과와 현재 검증 범위

- 회원가입/로그인 첫 화면에서 시작하며 기존 계정·대화·작품은 없습니다.
- 기본 이미지와 음원은 유지되고, 가입과 사용 이후 새 데이터가 생깁니다.
- 초기에는 AI 시연 모드이며 실제 AI 사용에는 새 백엔드 키 설정이 필요합니다.
- 원본 노트북 대신 새 노트북의 API·작업자·Expo를 실행합니다.

이 문서는 현재 소스와 저장 경로를 확인해 작성한 지침입니다. 복사본 제작이나 새 노트북 설치·실기기 검증은 아직 수행하지 않았습니다. 현재 노트북의 데이터와 앱 소스는 변경하지 않았습니다.
