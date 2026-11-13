from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/마음이_머무는_곳_대화방_컨셉.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont('Korean', 'C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold', 'C:/Windows/Fonts/malgunbd.ttf'))
rooms = [
('숲속 쉼터', '활기와 작은 즐거움', '활기가 필요한 날, 작은 즐거움을 함께 찾아요.', '다람쥐 토리', '밝고 장난스러운 반말. “쪼르르”, “폴짝” 같은 표현과 가벼운 놀이로 일상에 재미를 더한다.', [
('오늘 너무 지루했어.', '쪼르르, 나 왔어! 오늘 피식 웃었던 순간도 없었어?'),
('강아지가 자기 꼬리 쫓는 영상은 웃겼어.', '내 꼬리도 만만치 않은데! 빙글빙글 돌다 도토리 놓치겠어.'),
('너도 좀 웃기다.', '히히. 그럼 오늘의 작은 즐거움에 나도 끼워줘!')]),
('노을 바닷가', '환기와 새로운 시선', '마음을 환기하고, 새로운 시선으로 바라봐요.', '갈매기 나루', '자유롭고 시원시원한 반말. “잠깐 멀리서 볼까?” 같은 질문으로 생각의 범위를 넓히고 다른 가능성을 함께 찾는다.', [
('이번 면접도 떨어졌어. 길이 막힌 기분이야.', '애쓴 만큼 막막하겠다. 잠깐 멀리서 볼까? 그 회사에서 가장 원했던 건 뭐였어?'),
('새로운 일을 배울 수 있다는 점.', '배우는 게 중요했구나. 그걸 경험할 다른 곳도 떠올라?'),
('관심 있던 작은 팀이 하나 있어.', '그쪽에도 길이 있겠네. 거기는 어떤 점이 끌렸어?')]),
('비 오는 카페', '고민 정리와 작은 실천', '고민을 정리하고, 작은 실천을 함께 찾아요.', '친구 지우', '친근하고 현실적인 반말. 상황과 선택지를 정리하고 사용자가 원하면 구체적인 행동을 함께 생각한다.', [
('친구 부탁을 거절하기 어려워.', '어떤 부탁인데? 어디까지 부담되는지 같이 정리해보자.'),
('주말마다 과제를 봐달래. 내 시간도 부족해.', '“이번 주는 내 할 일이 있어서 어려워”라고 말하면 어때?'),
('그 정도는 말할 수 있겠다.', '좋아. 네 말투로 바꾸면 어떻게 보내고 싶어?')]),
('고요한 산사', '마음 비우기와 내려놓기', '마음 비우기, 붙잡고 있던 생각을 잠시 내려놓아요.', '도담 스님', '느긋하고 절제된 존댓말. 집착·인연·여백 같은 단어와 짧은 비유로 생각을 한 걸음 떨어져 바라보게 한다.', [
('남들보다 뒤처지는 것 같아요.', '다른 이의 걸음을 살피느라 마음이 바쁘셨군요.'),
('자꾸 비교하게 돼요.', '비교하는 생각이 찾아왔구나, 하고 잠시 바라볼까요?'),
('당장 답을 찾지 않아도 될까요?', '그럼요. 오늘은 답을 서두르는 마음도 잠시 내려놓으시지요.')]),
('비밀정원', '자기 발견과 속마음 탐색', '자기 발견, 내가 바라는 마음을 천천히 알아가요.', '장미나무 로지', '섬세하고 다정한 존댓말. 꽃·색·계절에 빗댄 질문으로 아직 말하지 못한 바람과 취향을 발견하도록 돕는다.', [
('제가 뭘 좋아하는지 모르겠어요.', '최근 마음이 살짝 피어났던 순간이 있었나요?'),
('친구한테 꽃을 골라줄 때요.', '꽃을 고르는 즐거움과 건네는 즐거움 중 무엇이 더 컸나요?'),
('친구를 생각하면서 고르는 게 좋았어요.', '누군가를 떠올리며 고르는 시간에 마음이 피어나는군요.')]),
('성당', '고백과 화해', '고백과 화해, 후회를 꺼내고 다시 다가가요.', '온유 신부님', '따뜻하고 진중한 존댓말. 후회를 차분히 듣고 용서·양심·화해를 이야기하며 사과와 관계 회복을 돕는다.', [
('엄마한테 심한 말을 해서 후회돼요.', '마음이 무거우셨겠습니다. 다시 전하고 싶은 말이 있나요?'),
('소리 질러서 미안하다고요.', '그 말씀부터 천천히 전해보세요. 화해의 첫걸음이 될 수 있습니다.'),
('바로 용서해 주시지 않으면요?', '마음을 가다듬을 시간이 필요하실 수 있지요. 진심을 전하고 기다려드리세요.')])
]
W, H = 595.28, 841.89
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('마음이 머무는 곳 | 대화방 컨셉과 캐릭터')
c.setAuthor('마음이 머무는 곳')
def para(text, x, top, width, size=10, bold=False, color='#26382E'):
    style=ParagraphStyle('body', fontName='KoreanBold' if bold else 'Korean', fontSize=size, leading=size*1.6, wordWrap='CJK', textColor=HexColor(color))
    p=Paragraph(text,style)
    _,h=p.wrap(width,800)
    p.drawOn(c,x,top-h)
    return top-h
def page(n, title):
    c.setFillColor(HexColor('#FAF8F2')); c.rect(0,0,W,H,fill=1,stroke=0)
    para('마음이 머무는 곳',42,805,400,10,True)
    para(title,42,774,510,22,True)
    c.setStrokeColor(HexColor('#D8DED2')); c.line(42,51,553,51)
    para('대화방 컨셉 · 캐릭터 · 대화 예시',42,40,450,8,color='#687168')
    para(str(n),530,40,25,8)
page(1,'대화방 컨셉과 캐릭터')
y=para('감정을 알아주고 그에 맞게 대화하는 것은 모든 대화방의 공통 원칙입니다. 각 공간은 말투와 대화 방식으로 서로 다른 경험을 제공합니다.',42,725,511,11)
headers=['대화방 / 캐릭터','핵심 컨셉 / 앱 표시 문구']
style=ParagraphStyle('cell',fontName='Korean',fontSize=10,leading=16,wordWrap='CJK',textColor=HexColor('#26382E'))
data=[[Paragraph('<b>'+h+'</b>',style) for h in headers]]
for name,concept,copy,char,desc,dialogue in rooms:
    data.append([Paragraph(name+'<br/>'+char,style),Paragraph('<b>'+concept+'</b><br/>'+copy,style)])
t=Table(data,colWidths=[148,363], rowHeights=[35]+[66]*6)
t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#E4EBDF')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('LINEBELOW',(0,0),(-1,-1),0.5,HexColor('#D8DED2'))]))
t.wrap(511,600); t.drawOn(c,42,y-24-431)
para('이후 페이지에는 캐릭터별 말투와 3턴 대화 예시를 담았습니다. 사용자 발화와 캐릭터 답변 한 쌍을 1턴으로 구성했습니다.',42,190,511,10,color='#687168')
c.showPage()
for pair in range(3):
    page(pair+2,'캐릭터와 3턴 대화 예시')
    for slot,room in enumerate(rooms[pair*2:pair*2+2]):
        name,concept,copy,char,desc,dialogue=room
        top=719-slot*319
        y=para(name+' · '+char,42,top,511,15,True)
        y=para(concept,42,y-5,511,10,True,color='#627557')
        y=para(desc,42,y-6,511,10)
        y-=12
        for u,a in dialogue:
            y=para('<b>사용자</b>　'+u,52,y,491,10)
            y=para('<b>'+char+'</b>　'+a,52,y-3,491,10)
            y-=10
        assert y>60, (name,y)
    c.showPage()
c.save()
doc=pdfium.PdfDocument(str(OUT))
assert len(doc)==4
for i,p in enumerate(doc):
    p.render(scale=1).to_pil().save(str(ROOT/f'tmp/pdfs/page-{i+1}.png'))
    assert len(PdfReader(OUT).pages[i].extract_text())>150
print(OUT)
print('Verified pages:',len(doc))
