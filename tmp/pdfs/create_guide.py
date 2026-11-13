from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pypdf import PdfReader

out = Path('output/pdf/apk-build-download-run-guide.pdf')
out.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Korean', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold', 'C:/Windows/Fonts/malgunbd.ttf'))
c = canvas.Canvas(str(out), pagesize=(595.28,841.89))
c.setTitle('마음이 머무는 곳 - APK 업데이트 안내')
c.setAuthor('마음이 머무는 곳')
def text(x,y,s,size=10,font='Korean',color='#293D38'):
    c.setFillColor(HexColor(color)); c.setFont(font,size); c.drawString(x,y,s)
def step(y,num,title,lines):
    c.setFillColor(HexColor('#386356')); c.roundRect(42,y-5,27,27,7,fill=1,stroke=0)
    text(50,y+3,str(num),12,'KoreanBold','#FFFFFF')
    text(82,y+5,title,13,'KoreanBold')
    for i,line in enumerate(lines): text(82,y-17-i*18,line)

c.setFillColor(HexColor('#FAF8F2')); c.rect(0,0,595.28,841.89,fill=1,stroke=0)
text(42,793,'마음이 머무는 곳  |  팀 공유 안내',10,'KoreanBold','#59746A')
text(42,756,'APK 업데이트 및 배포 절차',24,'KoreanBold')
text(42,728,'소스코드 수정 후 새 APK를 만들어 팀원에게 전달하는 방법입니다.',10)
c.setFillColor(HexColor('#E6EEE8')); c.roundRect(42,669,511,39,9,fill=1,stroke=0)
text(57,684,'코드 수정·저장 → 빌드 실행 → 빌드 성공 → 다운로드 → 전달·설치',11,'KoreanBold')
step(632,1,'코드 수정 및 저장',['화면이나 기능을 수정한 뒤 관련 파일을 모두 저장합니다.', '최초 EAS 프로젝트 연결과 eas.json의 preview 설정을 마친 상태여야 합니다.'])
step(548,2,'APK 빌드 실행',['PowerShell에서 mobile 폴더로 이동한 뒤 아래 명령을 실행합니다.'])
c.setFillColor(HexColor('#EDEFEA')); c.roundRect(82,459,471,53,6,fill=1,stroke=0)
text(94,491,r'cd C:\최종프로젝트1\maeum-frontend\mobile',9)
text(94,472,'npx eas-cli@latest build --platform android --profile preview',9)
step(424,3,'빌드 성공 확인',['터미널에 표시되는 EAS 빌드 페이지에서 완료 여부를 확인합니다.', '실패했다면 오류를 수정하고 다시 빌드합니다.'])
step(347,4,'새 APK 다운로드',['성공한 빌드의 결과 페이지에서 .apk 파일을 다운로드합니다.', '이전에 다운로드한 파일과 혼동하지 않도록 빌드 날짜를 기록합니다.'])
step(270,5,'팀원에게 전달 및 설치',['새 APK를 전달하고 기존 앱 위에 업데이트 설치하도록 안내합니다.', '개발 서버를 끈 상태에서도 실행되는지 확인한 뒤 공유합니다.'])
c.setStrokeColor(HexColor('#CBD7CE')); c.line(42,213,553,213)
text(42,190,'업데이트할 때 기억하세요',12,'KoreanBold')
for i,line in enumerate([
'• 기존 APK는 자동으로 바뀌지 않습니다. 팀원도 새 APK를 설치해야 합니다.',
'• 앱 식별자와 서명 키를 유지하세요. 기존 앱 삭제 시 로컬 데이터가 사라질 수 있습니다.',
'• preview 설정은 보통 재사용합니다. 배포할 버전이 준비되었을 때 빌드하세요.',
'• APK는 Android용입니다. Windows에서는 에뮬레이터가 필요하며 iPhone에는 설치할 수 없습니다.'
]): text(42,168-i*19,line,9)
text(42,63,'공식 참고: docs.expo.dev/build-reference/apk/',8,color='#66796F')
c.linkURL('https://docs.expo.dev/build-reference/apk/',(42,60,350,73),relative=0)
text(42,43,'전제: preview는 developmentClient: false 및 android.buildType: apk로 설정',8,color='#66796F')
text(536,43,'1 / 2',8,color='#66796F')
c.showPage()
c.setFillColor(HexColor('#FAF8F2')); c.rect(0,0,595.28,841.89,fill=1,stroke=0)
text(42,793,'마음이 머무는 곳  |  다운로드 및 실행 안내',10,'KoreanBold','#59746A')
text(42,756,'APK 다운로드와 실행 방법',24,'KoreanBold')
text(42,728,'EAS 클라우드에서 만든 APK를 내려받아 Android 환경에 설치합니다.',10)
step(680,1,'APK는 어디에 생성되나요?',[
'APK는 Expo 클라우드 서버에서 생성되며, 프로젝트 폴더에 자동 저장되지 않습니다.',
'빌드 성공 후 터미널의 결과 링크를 열고 APK 다운로드 버튼을 누릅니다.',
'터미널을 닫았다면 expo.dev 로그인 → 프로젝트 → Builds → 성공한 Android 빌드.',
'파일은 보통 PC의 다운로드 폴더 또는 브라우저에서 지정한 위치에 저장됩니다.'
])
step(558,2,'PC의 가상 스마트폰에서 실행',[
'① 각 PC에 Android Studio를 설치하고 가상 기기를 생성합니다.',
'② Device Manager에서 가상 기기 옆 ▶ 버튼을 눌러 홈 화면까지 실행합니다.',
'③ 다운로드한 .apk 파일을 가상 스마트폰 화면 위로 끌어다 놓습니다.',
'④ 설치가 끝나면 앱 목록에서 ‘마음이 머무는 곳’ 아이콘을 누릅니다.',
'APK는 Windows 실행파일이 아니므로 PC에서 더블클릭만으로 실행되지 않습니다.'
])
step(418,3,'실제 안드로이드폰에서 실행',[
'① APK 파일이나 다운로드 링크를 휴대폰으로 전달합니다.',
'② 휴대폰에서 APK를 다운로드한 뒤 파일을 엽니다.',
'③ 요청되면 해당 브라우저·파일 앱의 ‘알 수 없는 앱 설치’를 허용합니다.',
'④ 설치를 완료하고 앱 아이콘을 눌러 실행합니다.',
'실제 안드로이드폰에는 Android Studio나 Expo Go를 설치할 필요가 없습니다.'
])
c.setFillColor(HexColor('#E6EEE8')); c.roundRect(42,171,511,113,9,fill=1,stroke=0)
text(57,260,'실행 환경을 구분하세요',12,'KoreanBold')
for i,line in enumerate([
'• APK 생성: EAS 클라우드 빌드이므로 Android Studio가 필요하지 않습니다.',
'• PC 실행: 이 안내에서는 Android Studio의 Android 에뮬레이터를 사용합니다.',
'• 휴대폰 실행: Android는 APK 직접 설치, iPhone은 APK 설치 불가입니다.',
'• 독립 실행형 preview APK: Expo Go·Expo 계정·개발 서버 없이 실행합니다.'
]): text(57,238-i*18,line,9)
text(42,143,'팀원 공유 전 확인',11,'KoreanBold')
text(42,122,'개발 서버를 끄고 앱 실행과 주요 기능을 확인하세요. 이후 AI·백엔드를 연결한다면',9)
text(42,105,'해당 기능에 필요한 백엔드 서버와 네트워크 연결은 별도로 유지해야 합니다.',9)
text(42,65,'공식 안내: docs.expo.dev/build-reference/apk/',8,color='#66796F')
c.linkURL('https://docs.expo.dev/build-reference/apk/',(42,62,350,76),relative=0)
text(42,45,'가상 기기 설정: developer.android.com/studio/run/managing-avds',8,color='#66796F')
c.linkURL('https://developer.android.com/studio/run/managing-avds',(42,42,480,55),relative=0)
text(536,43,'2 / 2',8,color='#66796F')
c.save()
r=PdfReader(out)
assert len(r.pages)==2
assert 'APK' in r.pages[0].extract_text()
print(out.resolve())
