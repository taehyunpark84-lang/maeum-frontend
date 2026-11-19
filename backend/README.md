# 마음이 머무는 곳 — API와 그림일기 작업자

Python 3.12 이상. 기본 DB는 설치가 필요 없는 **파일형 SQLite**이며 `storage/maeum.db`에 저장됩니다.
앱을 닫거나 서버를 재시작해도 계정·대화·작품·작업 상태가 유지됩니다.

## 처음 실행 (PowerShell, backend 폴더)

**Python은 Codex 내부 실행 파일이 아닌 별도로 설치된 Python을 사용하세요.**
Codex 내부 `WindowsApps/OpenAI.CodexPrimaryRuntime...` 경로는 앱 업데이트 때 바뀝니다.
그 경로로 만든 가상환경은 업데이트 후 서버가 시작되지 않을 수 있습니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

현재 작업 폴더에는 가상환경과 개발 DB가 준비되어 있습니다. 다른 PC에서는 위 설치부터 실행하세요.
Windows Store의 python 실행 별칭이 실패하면 설치된 Python의 절대 경로나 `py -3.12`를 사용하세요.

## 매일 실행 및 Python recovery

현재 PC는 `backend/.runtime/python312`에 독립 보관된 Python 3.12를 사용합니다.
`.venv`의 기본 Python이 이 폴더를 참조하므로 Codex 업데이트에 의존하지 않습니다.
`.runtime`과 `.venv`는 Git에 업로드하지 않습니다. 다른 PC는 별도 설치한 Python으로 위의 처음 실행 절차를 수행하세요.

서버 터미널:

```powershell
cd C:\최종프로젝트1\maeum-frontend\backend
.\run-server.cmd
```

작업자 터미널:

```powershell
cd C:\최종프로젝트1\maeum-frontend\backend
.\run-worker.cmd
```

모바일 터미널:

```powershell
cd C:\최종프로젝트1\maeum-frontend\mobile
npm start
```

세 터미널을 열어 두세요. `npm start`는 백엔드를 시작하지 않습니다.
로그인 전 PC 브라우저에서 `http://localhost:8000/health`의 `status: ok`를 확인하세요.
API 실행 창에 `Application startup complete`가 없거나 오류가 있으면 먼저 그 오류를 확인하세요.

현재 PC에서 `.venv`의 기본 경로만 복구할 때:

```powershell
cd C:\최종프로젝트1\maeum-frontend\backend
.\.runtime\python312\python.exe -m venv --upgrade --without-pip .venv
.\.venv\Scripts\python.exe -c "import sys; print(sys.base_prefix)"
```

프로젝트 폴더를 옮기거나 `.runtime`을 삭제하면 경로 복구가 필요합니다.
`.runtime`도 없다면 독립 설치된 Python 3.12로 가상환경을 새로 만들고 잠금 파일의 패키지를 설치하세요.
`storage`와 `.env`는 삭제하지 마세요. 계정·대화·이미지와 API 설정이 들어 있습니다.

별도 터미널에서 작업자를 실행해야 그림일기가 생성됩니다.

```powershell
cd C:\최종프로젝트1\maeum-frontend\backend
.\.venv\Scripts\python.exe -m app.worker
```

- 상태: `http://localhost:8000/health`
- API 문서: `http://localhost:8000/docs`
- `AI_MODE=mock`: 실제 API 호출 없이 고정 시연 답변/예시 그림. UI에 시연으로 표시.
- API와 작업자 둘 다 같은 `.env`와 DB를 사용합니다. 설정을 바꾸면 둘 다 재시작하세요.

## 실제 OpenAI 키 설정

`C:\최종프로젝트1\maeum-frontend\backend\.env`에만 다음 값을 설정합니다.

```dotenv
AI_MODE=openai
OPENAI_API_KEY=직접_발급한_API_키
TEXT_MODEL=gpt-6.1-terra
IMAGE_MODEL=gpt-image-2.6-flare
```

키를 모바일 코드, EXPO_PUBLIC_ 변수, 스크린샷, Git, 채팅에 넣지 마세요. `.env`는 Git 제외 대상입니다.
설정은 `backend/.env`를 우선합니다. 터미널/IDE에 등록된 이전 키가 새 키를 가리지 않도록 명시적으로 덮어 읽습니다.
운영에서 환경변수만 주입하려면 `.env` 파일을 배포하지 마세요. 변경 후 API와 작업자를 모두 재시작합니다.
실제 호출은 OpenAI API 과금과 계정별 모델 접근 권한의 영향을 받습니다. 모델에 접근할 수 없으면
호환 모델 ID를 설정하되 `app/tuning.py`의 지원 인자도 함께 확인해야 합니다.
2026-11-17 실제 키로 텍스트·이미지 모델 조회와 짧은 한국어 채팅 스트리밍 완료를 확인했습니다.
장문 대화 품질·실제 이미지 생성 품질·운영 부하는 별도 검증이 필요합니다.

## 모바일 연결

mobile/.env.example을 mobile/.env로 복사하고 `EXPO_PUBLIC_API_URL`을 PC의 Wi-Fi IPv4 주소로 변경합니다.
휴대폰과 PC는 같은 네트워크에 있어야 합니다. 휴대폰에서 localhost는 PC가 아닙니다.
Android 에뮬레이터는 `http://10.0.2.2:8000`을 사용할 수 있습니다.

```powershell
cd ..\mobile
npm start -- --port 8083
```

앱 설정 변경 후 Metro 재시작이 필요합니다. 사진첩/보안 저장소의 네이티브 설정이 바뀌었으므로
기존 설치 앱에서는 새 development build가 필요할 수 있습니다. Expo Go 지원 여부도 기기에서 확인하세요.
서버 없는 기존 로컬 앱은 `EXPO_PUBLIC_APP_MODE=mock`으로 실행할 수 있습니다.
기존 로컬 시연 기록은 서버 계정으로 자동 업로드하지 않습니다.

## 구조와 수정 위치

| 파일 | 역할 |
| --- | --- |
| app/main.py | 회원가입/로그인, 대화 API, 스트리밍, 요약 미리보기, 생성 작업 접수, 비공개 파일 조회 |
| app/security.py | scrypt 비밀번호 해시, 해시로 보관하는 만료형 로그인 토큰 |
| app/db.py | SQLite/MySQL 공통 ORM 모델 |
| app/limits.py | DB 기반 사용자/IP별 요청 제한 |
| app/ai.py | OpenAI 호출, 요약, 시·미술 기획, 이미지 생성 |
| app/tuning.py | 모델, 추론 수준, 답변 길이, 요약 기준, 이미지 크기·품질 등 실험 설정 |
| app/prompts/*.txt | PDF 5~11쪽의 공통 지침과 6개 캐릭터별 지침·예시 A/B |
| app/worker.py | DB 큐에서 작업 가져오기, 시/그림 생성, 결과 저장, 재시작 복구 |

요약은 원문을 삭제하지 않습니다. 그림일기는 사용자가 수정·확인한 요약의 스냅샷으로 생성하며
이후 채팅은 해당 작품의 내용을 바꾸지 않습니다. 작품은 항상 비공개입니다.
시와 이미지 연출 지시를 같은 응답에서 기획하고, 이미지는 별도 API 요청으로 생성합니다.
API 호출 시 `store=False`는 서비스 DB 저장과 별개이며, 외부 제공자의 모든 보관을 금지한다는 의미는 아닙니다.

## 비동기 작업과 동시 사용자

- API 서버와 작업자는 별도 프로세스입니다. SQLite로도 별도 프로그램 없이 실행할 수 있도록 DB를 지속성 작업 큐로 사용합니다.
- `active_jobs.user_id` 기본 키 제약으로 여러 API 프로세스에서도 사용자당 생성 1개를 제한합니다.
- 작업자는 조건부 UPDATE로 소유권을 획득하고 heartbeat/lease로 장애 후 복구합니다.
- 한 작업자는 한 번에 1개를 처리합니다. 작업자 수를 늘리면 서로 다른 사용자의 작업을 병렬 처리합니다.
- 작업의 완료/실패 시 사용자 잠금을 해제합니다. 실패 재시도는 기존 시·기획이 있으면 재사용합니다.
- 외부 API 호출 직후 프로세스 장애가 나면 생성 중복 과금 가능성은 남습니다. 외부 API까지 exactly-once를 보장하지 않습니다.
- API가 이미지 내부 완료율을 제공하지 않으므로 UI는 실제 단계와 불확정 로딩바를 사용합니다.
- 시를 그림에 합성하지 않습니다. 앱에서 나눔명조 서체로 별도 표시합니다.
- 원본 그림: `storage/images/`. 공개 정적 URL을 만들지 않고 본인 인증 후 내려줍니다.
- 로그인 토큰은 7일 뒤 만료됩니다. 비밀번호 초기화/이메일 인증/소셜 로그인은 이번 구현에 포함하지 않았습니다.

## 설정 실험과 관측

그림의 밝기·정서적 방향과 화풍 목록은 `app/art_direction.py`에서 조절합니다.
최근 5개 작품의 화풍을 피해 선택하고, 구상 시 최근 소재·구도를 참고합니다.
완성 이미지는 텍스트 모델에도 전달해 시와 함께 캐릭터 말투의 설명을 작성합니다(`art_explanation` 측정값).
작품·설명은 대화 턴이 끝난 뒤 한 번만 채팅에 저장됩니다. 실패한 채팅은 재시도해 턴을 마쳐야 전달됩니다.
채팅에서는 그림과 시 미리보기, 터치하면 큰 그림과 시 전문을 볼 수 있습니다.

`app/tuning.py`를 수정한 뒤 두 프로세스를 재시작합니다. 한 번에 한 항목을 바꿔 같은 입력을 반복 비교하세요.
개발 앱의 설정 → 최근 AI 호출 측정값에서 모델·인자·전체 호출 시간·채팅 첫 텍스트 도착 시간·토큰을 확인합니다.
측정값은 서버의 API 호출 시간이며, 휴대폰 렌더링이나 작업 큐 대기 시간까지 포함한 수치는 아닙니다.
전체 작업 대기/완료 시간은 `jobs.created`, `jobs.updated`로 확인할 수 있습니다.
기록에 대화 원문이나 API 키를 로그로 남기지 않습니다. 작업 구상에 사용한 요약은 개인 DB 데이터입니다.
이미지 형식은 현재 PNG로 보관합니다. 형식을 변경하려면 worker 파일 확장자, 응답 MIME, 모바일 저장 확장자도 함께 바꾸세요.

## 테스트

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m alembic check
```

외부 AI는 시연으로 대체하되 실제 파일형 SQLite와 API/작업자를 실행하는 통합 테스트입니다.
사용자 격리, 스트리밍/재전송, 동시 생성 접수, 생성 중 채팅, 작업 소유권 복구,
실패 재시도, 이미지 접근 권한, 프롬프트 포함 여부를 검증합니다.

## MySQL 전환과 운영 배포

`DATABASE_URL=mysql+pymysql://user:password@host/maeum?charset=utf8mb4`로 설정한 후
MySQL의 빈 DB에 `alembic upgrade head`를 실행합니다. SQLite 파일 안의 데이터는 자동 이전되지 않습니다.
데이터를 유지하려면 별도 이전 스크립트와 건수/관계 검증이 필요합니다.

운영 공개 전에 별도로 확인할 항목:

- 실제 MySQL에서 동시 요청/잠금/마이그레이션 테스트, 실제 모델 접근·품질·부하 테스트
- HTTPS, 비밀 관리, 백업, 개인정보 보관·삭제 정책, 계정 복구
- API/작업자 프로세스 재시작 관리와 모니터링
- 여러 호스트를 사용할 경우 공유 파일 스토리지 또는 비공개 객체 저장소 어댑터
- 프록시 IP 신뢰 설정과 회원가입 남용 방지: 현재 IP 제한은 연결 주소 기준
- 위기 상황 대응 정책 검토. 위험 단어 횟수에 따른 강제 종료는 구현하지 않음

현재 코드는 로컬 실행과 운영 확장을 위한 기반이며, 위 운영 검증까지 완료했다는 뜻은 아닙니다.

모바일 사진첩 저장은 Android Expo Go의 미디어 권한 제한 때문에 개발 빌드가 필요합니다.
`mobile`에서 `npx.cmd expo run:android`로 설치한 앱에서 권한 허용·앨범 생성·실제 파일 저장을 확인하세요.
현재 Android Expo Go에서 작품 이미지와 별도 시 텍스트 표시는 확인했고, 사진첩 저장 성공은 미검증입니다.
