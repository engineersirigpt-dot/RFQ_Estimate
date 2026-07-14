# Polish Excel ที่ parse_consensus.js สร้าง (community xlsx ตัด style ทิ้ง) ให้อ่านง่าย
#   wrap text ทุกเซลล์ + header ตัวหนา/พื้นฟ้า + freeze header + ระบาย FAIL แดงอ่อน
# python bench/polish_xlsx.py [ไฟล์.xlsx]  (default bench/parse_consensus.xlsx)
import sys, openpyxl
from openpyxl.styles import Alignment, Font, PatternFill

path = sys.argv[1] if len(sys.argv) > 1 else 'bench/parse_consensus.xlsx'
wb = openpyxl.load_workbook(path)
ws = wb['ByCase'] if 'ByCase' in wb.sheetnames else wb.worksheets[0]
head = Font(bold=True); headfill = PatternFill('solid', fgColor='DDEBF7')
red = PatternFill('solid', fgColor='FCE4E4')
for c in ws[1]:
    c.font = head; c.fill = headfill
for row in ws.iter_rows(min_row=2):
    for c in row:
        c.alignment = Alignment(wrap_text=True, vertical='top')
ws.freeze_panes = 'A2'
# หา column "ผล" แล้วระบายแถว FAIL
res_col = next((i for i, c in enumerate(ws[1], 1) if str(c.value).strip() == 'ผล'), 5)
for r in range(2, ws.max_row + 1):
    if ws.cell(r, res_col).value == 'FAIL':
        for c in range(1, ws.max_column + 1):
            ws.cell(r, c).fill = red
wb.save(path)
print(f'polished {path}: wrap on, header freeze, FAIL ระบายแดง')
