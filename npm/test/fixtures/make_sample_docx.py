import sys
from docx import Document
from docx.shared import Pt, RGBColor, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX, WD_BREAK
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from PIL import Image
out = sys.argv[1]; img = sys.argv[2]
Image.new('RGB', (300, 150), (30, 90, 200)).save(img)
d = Document()
sec = d.sections[0]
sec.page_width, sec.page_height = Cm(21), Cm(29.7)
sec.left_margin = sec.right_margin = Cm(3); sec.top_margin = Cm(2.5); sec.bottom_margin = Cm(2)
st = d.styles['Normal']; st.font.name = '맑은 고딕'; st.font.size = Pt(10.5)
st.element.rPr.rFonts.set(qn('w:eastAsia'), '맑은 고딕')
sec.header.paragraphs[0].text = '머리말: 2026년 업무보고'
fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = fp.add_run(); 
for t, txt in (('begin', None), (None, 'PAGE'), ('end', None)):
    if t:
        e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), t); r._r.append(e)
    else:
        e = OxmlElement('w:instrText'); e.set(qn('xml:space'), 'preserve'); e.text = txt; r._r.append(e)
d.add_heading('1. 제목 수준 1 업무보고', level=1)
d.add_heading('1.1 제목 수준 2', level=2)
p = d.add_paragraph('기본 문단입니다. ')
p.add_run('굵게').bold = True; p.add_run(' / ')
p.add_run('기울임').italic = True; p.add_run(' / ')
p.add_run('밑줄').underline = True; p.add_run(' / ')
r = p.add_run('빨간 16pt'); r.font.color.rgb = RGBColor(0xC0, 0, 0); r.font.size = Pt(16); p.add_run(' / ')
r = p.add_run('형광펜'); r.font.highlight_color = WD_COLOR_INDEX.YELLOW; p.add_run(' / ')
r = p.add_run('궁서체'); r.font.name = '궁서'; r._r.rPr.rFonts.set(qn('w:eastAsia'), '궁서'); p.add_run(' / ')
r = p.add_run('취소선'); r.font.strike = True; p.add_run(' / H')
r = p.add_run('2'); r.font.subscript = True; p.add_run('O, x'); r = p.add_run('2'); r.font.superscript = True
p = d.add_paragraph('가운데 정렬 문단'); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p = d.add_paragraph('오른쪽 정렬 문단'); p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
p = d.add_paragraph('양쪽 정렬, 왼쪽 들여쓰기 2cm, 첫 줄 1cm, 줄간격 1.6, 문단 뒤 12pt 간격이 있는 긴 문단입니다. ' * 3)
p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY; pf = p.paragraph_format
pf.left_indent = Cm(2); pf.first_line_indent = Cm(1); pf.line_spacing = 1.6; pf.space_after = Pt(12)
d.add_paragraph('글머리 기호 항목 1', style='List Bullet'); d.add_paragraph('글머리 기호 항목 2', style='List Bullet')
d.add_paragraph('번호 항목 1', style='List Number'); d.add_paragraph('번호 항목 2', style='List Number')
t = d.add_table(rows=4, cols=3); t.style = 'Table Grid'
hdr = ['구분', '2025년', '2026년']
for i, h in enumerate(hdr):
    c = t.cell(0, i); c.text = h; c.paragraphs[0].runs[0].bold = True
    sh = OxmlElement('w:shd'); sh.set(qn('w:val'), 'clear'); sh.set(qn('w:fill'), 'D9E2F3'); c._tc.get_or_add_tcPr().append(sh)
data = [['매출', '1,200', '1,450'], ['영업이익', '300', '410']]
for r_i, row in enumerate(data, 1):
    for c_i, v in enumerate(row):
        t.cell(r_i, c_i).text = v
        if c_i: t.cell(r_i, c_i).paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
m = t.cell(3, 0).merge(t.cell(3, 2)); m.text = '병합된 셀(가로 3칸)'
for i, w in enumerate([Cm(4), Cm(5), Cm(6)]):
    for row in t.rows: row.cells[i].width = w
d.add_paragraph('그림 아래 캡션 앞 문단')
d.add_picture(img, width=Cm(8))
p = d.add_paragraph('각주가 있는 문장입니다.')
p = d.add_paragraph(); p.add_run('다음 쪽으로').add_break(WD_BREAK.PAGE)
d.add_heading('2. 둘째 쪽', level=1)
d.add_paragraph('쪽 나누기 뒤의 문단입니다.')
d.save(out)
