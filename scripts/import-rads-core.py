from pathlib import Path
import pymupdf,json,hashlib,shutil,re
src=Path(r'R:\Downloads\501 Rads (3).pdf'); pdf=pymupdf.open(src); pages=[]
for i,p in enumerate(pdf):
 blocks=[]
 for b in p.get_text('dict',sort=False)['blocks']:
  if 'lines' not in b: continue
  for l in b['lines']:
   spans=l['spans'];t=''.join(s['text'] for s in spans).strip().replace('\u200b','').replace('\ufffd',"'")
   if not t:continue
   kind='heading' if any('AtomicAge' in s['font'] for s in spans) or re.match(r'^\d{2,3}\. ',t) else 'paragraph'
   if blocks and kind=='paragraph' and blocks[-1]['kind']==kind: blocks[-1]['text']+=' '+t
   else: blocks.append({'kind':kind,'text':t})
 pages.append({'number':i+1,'category':'lore' if i<57 else 'rules','blocks':blocks})
root=Path('public/systems/501-rads'); shutil.copyfile(src,root/'501-rads-core-1.pdf')
(root/'core-1.json').write_text(json.dumps({'title':'501 Rads','revision':'core-1','sourceFile':'501-rads-core-1.pdf','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pageCount':len(pdf),'pages':pages},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Preserve source text separately for definition audits and regression checks.
Path('.codex-tmp/rads-core-source.json').write_text(json.dumps([p.get_text(sort=False) for p in pdf]),encoding='utf-8')
print('Imported',len(pdf),'pages')
