"""Import the editable reference structure, retaining the PDF as visual/page reference.
Run after import-rads-core.py. Requires only Python's standard library.
"""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET
import json, re, hashlib, shutil, bisect, sys

dnds = "--dnds" in sys.argv
source = Path(r"R:\Downloads\D&DS One Doc.docx" if dnds else r"R:\Downloads\501 Rads.docx")
root = Path('public/systems/dnds' if dnds else 'public/systems/501-rads')
target = root / ('original.json' if dnds else 'core-1.json')
doc = json.loads(target.read_text(encoding='utf-8'))
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
w = '{' + ns['w'] + '}'
def text(node):
    # Word line breaks are author content; rendered page breaks are not.
    return ''.join(n.text or '' if n.tag == w+'t' else '\n' if n.tag == w+'br' and n.get(w+'type') != 'page' else '\t' if n.tag == w+'tab' else '' for n in node.iter()).replace('\u200b', '').strip()
def normalized(value):
    return ' '.join(re.findall(r"\w+", value.lower()))
# Map structural blocks to their approximate source PDF page without splitting them.
pdf_text = [' '.join(b['text'] for b in page['blocks']) for page in doc['pages']] if dnds else json.loads(Path('.codex-tmp/rads-core-source.json').read_text(encoding='utf-8'))
page_starts=[]; full=''
for page in pdf_text:
    page_starts.append(len(full));full+=normalized(page)+' '
for page in doc['pages']: page['blocks']=[]
with ZipFile(source) as archive:
    body=ET.fromstring(archive.read('word/document.xml')).find('w:body',ns)
    category='lore';mutation_table=0;in_mutations=False;position=0
    for node in body:
        if node.tag==w+'p':
            value=text(node)
            if not value:continue
            style=node.find('w:pPr/w:pStyle',ns)
            styled=style is not None and style.get(w+'val','').startswith('Heading')
            kind='heading' if styled or value=='501 RADS' or (dnds and value.startswith('CHAPTER ')) else 'paragraph'
            if dnds and value.startswith('CHAPTER TWO:'):category='ship-reference'
            if dnds and value.startswith('CHAPTER THREE:'):category='rules'
            if not dnds and value=='Skills':category='rules'
            if value=='Mutations':in_mutations=True
            block={'kind':kind,'text':value,'category':category}
            if kind=='paragraph':block['paragraphBoundary']=True
            if in_mutations and re.match(r'^\d{2,3}\. ',value):block['kind']='subheading'
        elif node.tag==w+'tbl':
            rows=[]
            for row in node.findall('w:tr',ns):
                cells=[]
                for cell in row.findall('w:tc',ns):
                    value='\n'.join(text(p) for p in cell.findall('w:p',ns) if text(p))
                    span=cell.find('w:tcPr/w:gridSpan',ns)
                    cells.append(value)
                    if span is not None:cells.extend(['']*(int(span.get(w+'val','1'))-1))
                rows.append(cells)
            block={'kind':'table','text':' '.join(cell for row in rows for cell in row),'rows':rows,'category':category}
            value=block['text']
        else:continue
        prefix=' '.join(normalized(value).split()[:7])
        found=full.find(prefix,position) if prefix else -1
        if found>=0:position=found
        page_index=min(len(doc['pages'])-1,max(0,bisect.bisect_right(page_starts,position)-1))
        page=doc['pages'][page_index]
        if in_mutations and block['kind']=='subheading' and re.match(r'^0?1\. ',value):
            mutation_table+=1
            page['blocks'].append({'kind':'heading','text':'Positive Mutations' if mutation_table==1 else 'Negative Mutations','category':category})
        page['blocks'].append(block)
# Preserve an exact copy and hash so future revisions have an auditable import source.
source_name='dnds-original.docx' if dnds else '501-rads-core-1.docx'
shutil.copyfile(source,root/source_name)
doc['textSourceFile']=source_name
doc['textSourceSha256']=hashlib.sha256(source.read_bytes()).hexdigest()
target.write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported DOCX:',sum(b['kind']=='table' for p in doc['pages'] for b in p['blocks']),'tables;',sum(b['kind']=='subheading' for p in doc['pages'] for b in p['blocks']),'mutation titles')
