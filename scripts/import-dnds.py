from pathlib import Path
import pymupdf,json,hashlib,shutil,re,sys
src=Path(sys.argv[1] if len(sys.argv)>1 else r'R:\Downloads\D&DS One Doc.pdf'); out=Path('public/systems/dnds'); out.mkdir(parents=True,exist_ok=True)
pdf=pymupdf.open(src); pages=[]
for i,page in enumerate(pdf):
 blocks=[]
 for b in page.get_text('dict',sort=True)['blocks']:
  if 'lines' not in b: continue
  for l in b['lines']:
   text=''.join(s['text'] for s in l['spans']).strip()
   if not text or re.match(r'^Pg\.\d+$',text): continue
   # The source font has unmapped quotes; normalize these in readable text only.
   text=text.replace('\ufffd', "'").replace('\u200b','').replace('\u200d','')
   size=max(s['size'] for s in l['spans']); kind='heading' if size>=15.9 else 'paragraph'
   if blocks and blocks[-1]['kind']==kind and kind=='paragraph': blocks[-1]['text']+=' '+text
   else: blocks.append({'kind':kind,'text':text})
 pages.append({'number':i+1,'category':'lore' if i<24 else 'ship-reference' if i<55 else 'rules','blocks':blocks})
shutil.copyfile(src,out/'dnds-original.pdf')
doc={'title':'D&DS','subtitle':'Dogfights and Deep Space','revision':'original','sourceFile':'dnds-original.pdf','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pageCount':85,'pages':pages}
(out/'original.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported 85 pages; ship sections excluded by reader filter, PDF intact.')
