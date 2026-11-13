import ast
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter
import pypdfium2 as pdfium

ROOT = Path(__file__).resolve().parents[2]
TMP = ROOT / 'tmp/pdfs'
SOURCE = ROOT / 'output/pdf/마음이_머무는_곳_대화방과_시스템프롬프트_통합본.pdf'
OUT = ROOT / 'output/pdf/마음이_머무는_곳_대화방과_시스템프롬프트_통합본_수정.pdf'
def read_value(filename, name):
    tree = ast.parse((TMP / filename).read_text(encoding='utf-8'))
    return next(ast.literal_eval(node.value) for node in tree.body if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == name for t in node.targets))
rooms = read_value('create_concepts.py', 'rooms')
common = read_value('combine_concepts.py', 'common')
traits = [
    '호기심 많고 장난스러운 다람쥐. 경쾌한 반말과 의성어로 작은 즐거움을 나눈다.',
    '자유롭고 속 깊은 갈매기. 시원시원한 반말과 질문으로 새로운 시선을 열어준다.',
    '친근하고 현실적인 친구. 고민을 차분히 정리하고 작은 실천을 함께 찾는다.',
    '온화하고 느긋한 스님. 절제된 존댓말과 비유로 생각을 내려놓도록 돕는다.',
    '섬세하고 다정한 장미나무. 꽃과 계절에 빗댄 질문으로 속마음을 살핀다.',
    '따뜻하고 진중한 신부님. 후회를 경청하고 사과와 관계 회복을 돕는다.',
]
pdfmetrics.registerFont(TTFont('Korean','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold','C:/Windows/Fonts/malgunbd.ttf'))
c = canvas.Canvas(str(TMP/'replacement_pages.pdf'), pagesize=(595.28,841.89))
def paragraph(text, top, size=11, bold=False, x=42, width=511, color='#26382E'):
    style = ParagraphStyle('body',fontName='KoreanBold' if bold else 'Korean',fontSize=size,leading=size*1.6,wordWrap='CJK',textColor=HexColor(color))
    item=Paragraph(text,style)
    _,height=item.wrap(width,800)
    item.drawOn(c,x,top-height)
    return top-height
def page(number,title,header,footer):
    c.setFillColor(HexColor('#FAF8F2'));c.rect(0,0,595.28,841.89,fill=1,stroke=0)
    paragraph(header,805,10,True)
    paragraph(title,774,22,True)
    c.setStrokeColor(HexColor('#D8DED2'));c.line(42,51,553,51)
    paragraph(footer,40,8,color='#687168')
    paragraph(str(number),40,8,x=530,width=25)
page(1,'대화방 컨셉과 캐릭터','마음이 머무는 곳','대화방 컨셉 · 캐릭터 · 대화 예시')
y=paragraph('감정을 알아주고 그에 맞게 대화하는 것은 모든 대화방의 공통 원칙입니다. 각 공간은 말투와 대화 방식으로 서로 다른 경험을 제공합니다.',725)
style=ParagraphStyle('cell',fontName='Korean',fontSize=9.5,leading=15,wordWrap='CJK',textColor=HexColor('#26382E'))
def cell(text): return Paragraph(text,style)
rows=[[cell('<b>'+title+'</b>') for title in ['대화방 / 캐릭터','핵심 컨셉 / 앱 표시 문구','캐릭터 특징']]]
for room,trait in zip(rooms,traits):
    name,concept,copy,char,_,_=room
    rows.append([cell(name+'<br/>'+char),cell('<b>'+concept+'</b><br/>'+copy),cell(trait)])
table=Table(rows,colWidths=[105,215,191],rowHeights=[35]+[76]*6)
table.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),HexColor('#E4EBDF')),('VALIGN',(0,0),(-1,-1),'MIDDLE'),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('LINEBELOW',(0,0),(-1,-1),0.5,HexColor('#D8DED2'))]))
_,height=table.wrap(511,650)
table.drawOn(c,42,y-24-height)
paragraph('이후 페이지에는 캐릭터별 말투와 3턴 대화 예시를 담았습니다. 사용자 발화와 캐릭터 답변 한 쌍을 1턴으로 구성했습니다.',y-24-height-24,10,color='#687168')
c.showPage()
page(5,'시스템 프롬프트 적용 안내','마음이 머무는 곳 · 시스템 프롬프트','대화방 컨셉과 시스템 프롬프트 통합본')
y=paragraph('예시 구성',716,14,True)
y=paragraph('각 캐릭터당 3턴짜리 대화 2개, 총 6턴으로 구성했습니다. 첫 번째 예시는 평소의 개성과 대화 흐름을, 두 번째 예시는 사용자가 힘들어하거나 캐릭터의 접근을 부담스러워할 때의 반응을 보여줍니다.',y-12)
y=paragraph('각 예시는 독립된 상황입니다. 아래 공통 지침과 해당 캐릭터의 적용 지침, 두 대화 예시를 시스템 프롬프트에 함께 넣으면 됩니다.',y-14)
y=paragraph('모든 캐릭터의 공통 지침',y-32,14,True)
paragraph(common,y-12)
c.showPage();c.save()
original=PdfReader(SOURCE)
replacements=PdfReader(TMP/'replacement_pages.pdf')
writer=PdfWriter()
for i,old_page in enumerate(original.pages):
    writer.add_page(replacements.pages[0] if i==0 else replacements.pages[1] if i==4 else old_page)
writer.add_metadata({'/Title':'마음이 머무는 곳 · 대화방 컨셉과 시스템 프롬프트 통합본','/Author':'마음이 머무는 곳'})
writer.write(OUT)
result=PdfReader(OUT)
assert len(result.pages)==11
assert '문서 구성' not in result.pages[4].extract_text()
assert '캐릭터 특징' in result.pages[0].extract_text()
for i in range(11):
    if i not in (0,4): assert result.pages[i].extract_text()==original.pages[i].extract_text()
for trait in traits:
    assert ''.join(trait.split()) in ''.join(result.pages[0].extract_text().split())
document=pdfium.PdfDocument(str(OUT))
for i in (0,4): document[i].render(scale=1.5).to_pil().save(TMP/f'revised-{i+1}.png')
print(OUT)
print('Verified both edits, 11 pages, and text preservation on all other pages.')
