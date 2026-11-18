from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
import json

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/pdf'
pdfmetrics.registerFont(TTFont('K','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KB','C:/Windows/Fonts/malgunbd.ttf'))
W,H=960,540
INK='#243C36'; GREEN='#476B55'; MUTED='#68766D'; BG='#F8F6F0'; LINE='#D7DED3'; GOLD='#C69548'
class Book:
 def __init__(self,name,label):
  self.c=canvas.Canvas(str(OUT/name),pagesize=(W,H));self.c.setTitle(label);self.c.setAuthor('마음이 머무는 곳 프로젝트');self.n=0;self.label=label;self.notes=[]
 def text(self,x,y,s,size=20,color=INK,bold=False):
  self.c.setFillColor(HexColor(color));self.c.setFont('KB' if bold else 'K',size)
  for i,line in enumerate(s.split('\n')):
   assert pdfmetrics.stringWidth(line,'KB' if bold else 'K',size)<W-x-30,(self.n,line)
   self.c.drawString(x,H-y-i*size*1.45,line)
 def page(self,title,sub='',source=''):
  if self.n:self.c.showPage()
  self.n+=1; self.c.setFillColor(HexColor(BG));self.c.rect(0,0,W,H,fill=1,stroke=0)
  self.text(44,38,self.label,12,GREEN,True);self.text(44,91,title,32,bold=True)
  if sub:self.text(44,127,sub,17,MUTED)
  self.c.setStrokeColor(HexColor(LINE));self.c.line(44,46,916,46)
  self.text(44,514,source or '현재 저장소 코드 기준 · 2026.11.18',10,MUTED)
  self.text(884,514,f'{self.n:02}',12,GREEN)
  self.notes.append({'title':title,'subtitle':sub,'source':source})
 def lines(self,items,y=180):
  for i,(head,body) in enumerate(items):
   yy=y+i*92;self.text(48,yy,f'{i+1:02}',24,GOLD,True);self.text(108,yy,head,23,bold=True);self.text(108,yy+33,body,18,MUTED)
 def table(self,heads,rows,widths,y=176,rowh=65):
  xs=[44]
  for w in widths:xs.append(xs[-1]+w)
  for i,h in enumerate(heads):self.text(xs[i]+9,y,h,16,GREEN,True)
  self.c.setStrokeColor(HexColor(GREEN));self.c.line(44,H-y-14,916,H-y-14)
  for r,row in enumerate(rows):
   yy=y+47+r*rowh
   for i,v in enumerate(row):self.text(xs[i]+9,yy,v,17,INK,i==0)
   self.c.setStrokeColor(HexColor(LINE));self.c.line(44,H-yy-rowh+32,916,H-yy-rowh+32)
 def flow(self,labels,y=220):
  n=len(labels);gap=24;bw=(872-gap*(n-1))/n
  for i,(title,body) in enumerate(labels):
   x=44+i*(bw+gap)
   self.c.setFillColor(HexColor('#E7EDE3'));self.c.roundRect(x,H-y-96,bw,96,8,fill=1,stroke=0)
   self.text(x+14,y+28,title,20,GREEN,True);self.text(x+14,y+61,body,15)
   if i<n-1:
    xx=x+bw+4; yy=H-y-48;self.c.setStrokeColor(HexColor(GREEN));self.c.line(xx,yy,xx+16,yy);self.c.line(xx+16,yy,xx+11,yy+4);self.c.line(xx+16,yy,xx+11,yy-4)
 def note(self,head,body,y=378):
  self.text(44,y,head,23,GREEN,True);self.text(44,y+38,body,19)
 def cover(self,title,subtitle,bg):
  self.page(title,subtitle)
  path=ROOT/'mobile/assets/backgrounds'/bg
  self.c.drawImage(str(path),585,74,331,298,mask='auto',preserveAspectRatio=True,anchor='c')
  self.text(48,210,'마음이 머무는 곳',28,GREEN,True)
  self.text(48,267,'대화가 기억으로 이어지고,\n기억이 그림과 시가 되는 앱',23)
  self.text(48,390,'비전공 팀원을 위한 코드 읽기 안내\n먼저 전체 그림을 보고, 필요한 파일을 찾아보세요.',16,MUTED)
 def save(self):self.c.save()

b=Book('01_프로젝트_구조_안내.pdf','01 / 프로젝트 구조 안내')
b.cover('프로젝트 구조 안내','앱 화면 · 서버 · AI · 데이터의 역할','forest.png')
b.page('전체 구조','API는 앱과 서버가 요청과 결과를 주고받는 통로입니다.','근거: mobile/src/services/api.ts · backend/app/main.py · worker.py')
b.flow([('휴대폰 앱','화면 표시 / 사용자 입력'),('API 서버','로그인 / 대화 처리'),('OpenAI API','텍스트 / 이미지 생성')],190)
b.flow([('데이터베이스','계정 / 대화 / 작업 기록'),('별도 작업자','그림일기 제작'),('이미지 파일','완성된 PNG 보관')],330)
b.text(44,464,'위: 사용자의 요청 흐름    아래: 서버와 작업자가 함께 사용하는 저장·제작 영역',15,MUTED)
b.page('기술스택: 화면을 만드는 도구','프론트엔드는 사용자가 보고 누르는 부분입니다.','근거: mobile/package.json · src/services/api.ts · saveArtwork.ts')
b.table(['기술','쉬운 설명','프로젝트에서 하는 일'],[
 ('React Native','휴대폰 화면을 만드는 도구','채팅·갤러리·설정 화면'),('Expo / Expo Router','실행 도구 / 화면 이동 도구','기기 실행, 앱 진입과 이동'),('TypeScript','자료의 모양을 확인하는 언어','메시지·작품 데이터의 실수 줄이기'),('SecureStore / MediaLibrary','보안 보관 / 사진첩 접근','로그인 토큰 보관, 그림 다운로드')],[258,300,314],rowh=68)
b.page('기술스택: 서버를 만드는 도구','백엔드는 요청을 처리하고 데이터를 보관하는 부분입니다.','근거: backend/requirements.lock.txt · app/db.py · app/ai.py')
b.table(['기술','쉬운 설명','프로젝트에서 하는 일'],[
 ('Python / FastAPI','서버 언어 / API 도구','회원가입·대화·작품 요청 처리'),('OpenAI 공식 SDK','OpenAI와 연결하는 도구','텍스트·이미지 모델 호출'),('SQLAlchemy / Alembic','DB 접근 / DB 구조 변경 도구','자료 읽기·저장, 변경 이력 적용'),('SQLite → MySQL','현재 파일 DB → 향후 서버 DB','개발은 SQLite, MySQL 전환은 검증 필요')],[258,300,314],rowh=65)
b.text(44,475,'현재 Spring Boot·LangChain·Redis는 사용하지 않습니다.',16,GREEN)
b.page('코드 폴더 지도','수정할 기능에 맞는 폴더부터 찾아보세요.','근거: 저장소 폴더 구조')
b.table(['위치','역할','먼저 볼 파일'],[
 ('mobile/src/features/online','실제 서버와 연결된 앱 화면','OnlineApp.tsx / OnlineChat.tsx'),('mobile/src/services','서버 연결·사진첩 저장','api.ts / saveArtwork.ts'),('backend/app','API·AI·DB·작업자','main.py / ai.py / db.py / worker.py'),('backend/app/prompts','공간별 캐릭터 지침','common.txt / 공간별 .txt'),('backend/migrations · tests','DB 변경 이력·자동 검사','versions/ / test_*.py')],[305,270,297],rowh=53)
b.page('백엔드의 핵심 파일','파일 하나가 모든 일을 맡지 않도록 역할을 나눴습니다.','근거: backend/app/ 아래 각 파일')
b.table(['파일','담당 업무'],[
 ('main.py / security.py','요청 접수·응답 / 로그인 검증'),('shared_history.py / chat_text.py','공통 대화 조회·잠금 / 내부 출처 표기 분리'),('art_story.py / art_direction.py','최근 작품 소재 선택 / 화풍·구도·색감 방향'),('ai.py / tuning.py','모델 호출·기능별 지침 / 모델·길이·품질 설정'),('worker.py / db.py','장시간 작품 제작 / 저장할 데이터의 구조')],[370,502],rowh=53)
b.page('기능별 GPT 모델','모델은 처리 엔진입니다. 기능별 지침과 입력은 따로 전달합니다.','근거: backend/app/tuning.py · ai.py · 현재 모델 설정 확인')
b.table(['모델','담당 기능','현재 설계의 이유'],[
 ('gpt-6.1-terra','채팅·누적 요약·최근 소재 판단','텍스트 기능의 설정·평가를 통일'),('같은 텍스트 모델','시·작품 구상·완성 그림 설명','서로 맞는 시와 그림을 기획'),('gpt-image-2.6-flare','구상을 실제 이미지로 생성','문장 생성과 이미지 제작을 분리')],[260,315,297],rowh=76)
b.text(44,455,'이는 설계상 이유입니다. 다른 모델보다 우수하다는 비교 실험 결론은 아닙니다.',16,MUTED)
b.page('같은 모델, 다른 작업 설정','캐릭터마다 별도 모델을 학습하거나 복제하지 않습니다.','근거: backend/app/tuning.py · ai.py')
b.table(['작업 설정','현재 값','의도'],[
 ('채팅','추론 low / 출력 한도 2,200','빠른 대화와 짧은 답변 지향'),('요약·소재 판단','추론 low / 출력 한도 2,600','기억 정리와 최근 주제 선별'),('시·구상·작품 설명','추론 low / 출력 한도 4,000','여러 항목을 함께 만들 공간 확보'),('이미지','1024 × 1536 / medium / PNG','휴대폰용 세로 2:3, 품질·시간 절충')],[260,335,277],rowh=64)
b.text(44,472,'토큰은 모델의 처리 단위입니다. 출력 한도에는 추론 토큰도 포함됩니다.',15,MUTED)
b.page('데이터의 관계','사용자별로 기록을 모으되, 어느 공간에서 나온 말인지는 남깁니다.','근거: backend/app/db.py · shared_history.py')
b.flow([('users','사용자 계정'),('conversations','발화 당시 공간'),('messages','사용자와 AI의 말')],175)
b.flow([('art_previews','확인한 이야기·시점'),('jobs','작품 제작 작업'),('diaries','제목·시·설명·파일명')],320)
b.text(44,302,'user_memories: 사용자 한 명의 공통 요약    logins: 로그인 상태',18,GREEN)
b.text(44,462,'사용자 ID로 소유권을 확인합니다. 다른 사용자의 기록은 섞지 않습니다.',18)
b.page('데이터는 어디에 있나요?','DB는 목록과 내용을, 파일 저장소는 그림 자체를 보관합니다.','근거: backend/app/config.py · worker.py · mobile/src/services/saveArtwork.ts')
b.table(['보관 위치','저장 내용'],[
 ('backend/storage/maeum.db','개발용 SQLite 파일: 계정·대화·시·작업·공통 요약'),('backend/storage/images/','서버에 생성된 그림 파일: 작업 ID.png'),('휴대폰 보안 저장소','앱 로그인 토큰. OpenAI API 키는 아님'),('휴대폰 사진첩','사용자가 저장 버튼을 누른 그림. 시는 합성하지 않음')],[375,497],rowh=67)
b.page('팀원이 먼저 알아야 할 경계','현재 개발 구조와 향후 운영 준비를 구분합니다.','근거: backend/README.md · config.py · worker.py · docs/PROGRESS.md')
b.lines([('키와 실제 사용자 자료는 공유하지 않기','OpenAI 키는 backend/.env에만 둡니다. 팀원은 테스트 자료를 사용합니다.'),('실행에는 앱·API·작업자가 필요','작업자가 꺼져 있으면 그림 제작이 진행되지 않습니다.'),('MySQL·운영 배포는 별도 검증','DB 전환, 공유 파일 저장소, HTTPS, 부하·복구 검증이 필요합니다.')])
b.text(44,469,'질문 예시: “코드를 수정하지 말고 main.py에서 채팅이 처리되는 순서를 설명해줘.”',15,MUTED)
b.page('팀 작업과 서비스의 약속','코드를 내려받는 것과 실제 사용자 자료를 공유하는 것은 다릅니다.','근거: backend/app/ai.py · security.py · README.md / 협업 권장 사항')
b.lines([('대화에 필요한 자료는 OpenAI API로 전달','앱에서 비공개라는 말은 외부 AI 처리가 없다는 뜻이 아닙니다.'),('AI는 진단·치료를 제공하는 전문가가 아님','캐릭터는 가상 대화 상대입니다. 답변의 사실과 표현을 검토합니다.'),('팀원별 브랜치에서 수정하고 함께 검토','실제 키·DB·이미지를 Git에 올리지 않습니다. 테스트 후 PR로 합칩니다.')])
b.text(44,470,'PR은 수정 내용을 팀원이 확인한 뒤 합치기 위한 검토 요청입니다.',16,MUTED)
b.save()

b=Book('02_기능_흐름_안내.pdf','02 / 기능 흐름 안내')
b.cover('기능 흐름 안내','로그인부터 대화·그림·시·갤러리까지','ocean.png')
b.page('사용자가 경험하는 순서','앱을 닫아도 서버에 저장된 기록은 남습니다.','근거: mobile/src/features/online/OnlineApp.tsx · backend/app/main.py')
b.flow([('로그인','내 기록 확인'),('공간 선택','캐릭터 선택'),('대화','공통 기억 사용'),('작품 생성','그림 + 시'),('갤러리','감상·다운로드')],215)
b.note('공간이 바뀌어도 대화는 이어집니다','숲에서 나눈 이야기와 작품을 산사에서도 볼 수 있습니다.')
b.page('회원가입과 로그인','로그인 토큰은 매 요청에 제시하는 임시 출입증과 같습니다.','근거: backend/app/security.py · main.py · mobile/src/services/api.ts')
b.flow([('아이디·비밀번호','앱에서 입력'),('서버에서 확인','저장된 해시와 비교'),('로그인 토큰','휴대폰에 안전 보관')],205)
b.note('비밀번호 원문을 DB에 저장하지 않습니다','해시는 되돌려 읽는 암호문이 아니라, 비밀번호를 확인하는 값입니다.')
b.text(44,470,'후속 요청: 토큰 검증 → 사용자 확인 → 그 사용자의 기록만 조회',17,GREEN)
b.page('채팅 한 번의 처리','스트리밍은 답변을 조금씩 받아 화면에 바로 보여주는 방식입니다.','근거: backend/app/main.py · ai.py · chat_text.py')
b.flow([('질문 저장','사용자 ID 확인'),('기억 준비','요약 + 최근 대화'),('모델 호출','현재 공간 지침'),('답변 표시','조각별 전달·저장')],205)
b.note('모델이 스스로 사용자를 영구 기억하는 것은 아닙니다','서버가 매 요청에 필요한 과거 기록을 골라 전달합니다.')
b.text(44,470,'내부 출처 표기는 답변과 분리합니다. 스트리밍에서도 해당 표기를 제거합니다.',16,MUTED)
b.page('공간별 캐릭터와 대화 방향','공통 기억은 같아도 말투와 대화를 이끄는 방식은 달라집니다.','근거: backend/app/prompts/ · mobile 공간 정보')
b.table(['공간','캐릭터','대화의 중심'],[
 ('숲속 쉼터','다람쥐 토리','활기와 작은 즐거움'),('노을 바닷가','갈매기 나루','환기와 새로운 시선'),('비 오는 카페','친구 지우','고민 정리와 작은 실천'),('고요한 산사','도담 스님','마음 비우기와 내려놓기'),('비밀정원','장미나무 로지','자기 발견과 속마음 탐색'),('성당','온유 신부님','고백과 화해')],[260,270,342],y=166,rowh=44)
b.page('프롬프트가 맡는 역할','프롬프트는 AI에게 주는 업무 지침입니다. 기능마다 따로 구성합니다.','근거: backend/app/prompts/ · ai.py · art_direction.py')
b.table(['기능','지침의 구성'],[
 ('채팅','공통 안전 기준 + 캐릭터·말투·공간 컨셉 + 대화 기억'),('기억 요약','사용자 사실·감정·정정 보존, AI 제안과 사실 구분'),('최근 소재 판단','최근 주제와 새 감정 선택, 무관한 과거 내용 제외'),('그림·시 구상','핵심 대상 유지, 다양한 표현, 같은 정서의 시 작성'),('완성 작품 설명','실제 이미지와 시를 보고 해당 캐릭터의 말투로 설명')],[235,637],rowh=53)
b.page('대화 기억과 작품 소재는 다릅니다','한 사람을 이해하는 기억과, 한 작품에 담을 이야기를 구분합니다.','근거: backend/app/main.py · art_story.py · tuning.py')
b.table(['구분','대화의 공통 기억','이번 작품의 이야기'],[
 ('목적','맥락을 이어서 대화','최근 주제 하나를 작품으로'),('입력','누적 요약 + 최근 대화','마지막 완성 이후 최근 대화 중심'),('과거 기록','관련 맥락을 함께 사용','이름·관계 등 필요한 배경만 참고'),('보관','원문 + 사용자 공통 요약','확인한 이야기 + 확인 시점')],[150,355,367],rowh=64)
b.text(44,473,'대화가 길어지면 오래된 구간을 요약합니다. 원문 메시지는 삭제하지 않습니다.',16,GREEN)
b.page('짧은 새 대화도 의미로 판단','메시지 개수보다 새 사건·감정이 있는지가 중요합니다.','근거: backend/app/art_story.py · ai.py의 select_art_story')
b.table(['최근 대화 예시','AI 판단 방향','이어서 할 일'],[
 ('“두부가 퇴원해서 안심했어”','새 사건과 감정','퇴원의 안도감을 중심으로 제작'),('“어제보다 덜 외로워”','새 감정 변화','달라진 마음을 중심으로 제작'),('“응, 고마워” 또는 반복','새 소재가 부족함','직전 작품 이야기로 다른 작품 제작')],[340,230,302],rowh=76)
b.text(44,457,'새 대화가 전혀 없으면 직전 이야기를 재사용합니다. AI 판단은 항상 완벽하지 않습니다.',16,MUTED)
b.page('미리보기에서 제작 요청까지','사용자가 확인 화면에서 고친 이야기가 실제 제작에 반영됩니다.','근거: backend/app/main.py · art_story.py · OnlineApp.tsx')
b.flow([('최근 이야기 선별','AI가 의미 분석'),('내용 확인·수정','사용자가 이야기 조정'),('작업 접수','DB에 jobs 저장')],195)
b.note('확인 시점의 대화 범위도 함께 저장합니다','그 이후 새로 나눈 대화는 다음 작품에 남습니다.')
b.text(44,450,'완성한 작업만 기준을 갱신합니다. 실패한 작업은 새 대화 범위를 소비하지 않습니다.',17)
b.page('그림을 만드는 동안에도 채팅','작업자는 API와 별도로 실행되는 제작 담당 프로그램입니다.','근거: backend/app/worker.py · main.py · OnlineChat.tsx')
b.flow([('API 서버','채팅 요청 처리'),('텍스트 모델','새 답변 생성'),('휴대폰','대화 계속')],170)
b.flow([('DB 작업 대기열','그림 요청 보관'),('별도 작업자','구상 → 그림 → 설명'),('완성 저장','이미지 + 시 + 설명')],320)
b.text(44,304,'동시에 진행되는 두 흐름',18,GREEN,True)
b.text(44,465,'사용자 한 명당 제작 중인 그림일기는 1개입니다. 다른 사용자 요청은 별도로 관리합니다.',16)
b.page('그림과 시가 만들어지는 순서','시를 이미지에 합성하지 않습니다. 화면에서 그림 아래에 표시합니다.','근거: backend/app/ai.py · worker.py · art_direction.py')
b.flow([('텍스트 모델','제목·시·미술 구상'),('이미지 모델','PNG 그림 생성'),('텍스트 모델','실제 그림·시 설명')],195)
b.lines([('그림: 대화의 핵심 대상과 감정을 유지','인물·동물을 무조건 추상 도형으로 바꾸지 않습니다.'),('표현: 화풍·색채·구도를 다양하게','슬픔은 존중하되, 위협적이거나 어둠을 강조하는 장면은 피합니다.')],y=356)
b.page('완성 작품의 전달과 보관','제작이 끝나면 진행 중인 대화 턴이 끝난 뒤 연결합니다.','근거: OnlineChat.tsx · ChatArtwork.tsx · JobStatus.tsx · main.py')
b.flow([('완성 확인','앱이 주기적으로 조회'),('채팅에 연결','그림·시·설명 표시'),('갤러리·사진첩','확대 감상·그림 저장')],190)
b.note('제작 중에는 버튼을 비활성화합니다','채팅 안내와 회전 표시로 진행 중임을 알립니다.')
b.text(44,462,'상태 표시는 구상·그리기·설명·저장 단계입니다. 정확한 완료율(%)은 아닙니다.',16,MUTED)
b.page('팀원이 확인할 기준','기능이 달라졌을 때, 어느 구간을 살펴볼지 알아두세요.','근거: backend/README.md · docs/PROGRESS.md · 각 기능 코드')
b.table(['증상·질문','먼저 볼 위치'],[
 ('로그인이 안 돼요','서버 실행·휴대폰의 API 주소 → security.py'),('기억이나 캐릭터가 이상해요','shared_history.py → prompts/ → ai.py'),('최근 이야기 대신 옛 내용이 나와요','art_story.py → 미리보기 내용 → ai.py'),('그림이 대기 중이거나 실패했어요','작업자 실행 → jobs 상태 → worker.py'),('시연 예시가 나와요','AI_MODE와 앱 모드 확인. 시연은 실제 맞춤 생성이 아님')],[395,477],rowh=53)
b.save()
print('Created both PDFs')
