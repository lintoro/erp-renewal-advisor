import sys, os, zipfile, xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')

fpath = 'D:/Github/ReactApp/ERP_dateclean/rowdate/樹德企業股份有限公司 專櫃結帳彙總表_20261111.xlsx'
with zipfile.ZipFile(fpath, 'r') as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            text = ''.join([t.text or '' for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')])
            shared_strings.append(text)
    
    sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    rows = sheet_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
    print('Total rows:', len(rows))
    for r in rows[:12]:
        cells = []
        for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            val = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            t = c.attrib.get('t')
            ref = c.attrib.get('r')
            content = ''
            if val is not None and val.text:
                if t == 's' and int(val.text) < len(shared_strings):
                    content = shared_strings[int(val.text)]
                else:
                    content = val.text
            if content.strip():
                cells.append(f'{ref}:{content.strip()}')
        r_num = r.attrib.get('r')
        print(f'Row {r_num}:', ' | '.join(cells[:15]))
