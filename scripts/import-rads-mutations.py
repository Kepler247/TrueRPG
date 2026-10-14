from pathlib import Path
import pymupdf,re,json,shutil,hashlib,sys
src=Path(sys.argv[1] if len(sys.argv)>1 else r'R:\Downloads\501 Rads.pdf')
pdf=pymupdf.open(src); pages=[]; text=[]
for i,page in enumerate(pdf):
 text.append(page.get_text(sort=True))
 blocks=[]
 for block in page.get_text('dict',sort=True)['blocks']:
  if 'lines' not in block: continue
  for line in block['lines']:
   spans=line['spans']; value=''.join(s['text'] for s in spans).strip().replace('\u200b','').replace('\ufffd',"'")
   if not value: continue
   kind='heading' if any('AtomicAge' in s['font'] for s in spans) or re.match(r'^\d{2,3}\.\s',value) else 'paragraph'
   if blocks and kind=='paragraph' and blocks[-1]['kind']=='paragraph': blocks[-1]['text']+=' '+value
   else: blocks.append({'kind':kind,'text':value})
 pages.append({'number':i+1,'category':'lore' if i<57 else 'rules','blocks':blocks})
root=Path('public/systems/501-rads'); shutil.copyfile(src,root/'501-rads-mutations-1.pdf')
(root/'mutations-1.json').write_text(json.dumps({'title':'501 Rads','revision':'mutations-1','sourceFile':'501-rads-mutations-1.pdf','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pageCount':len(pdf),'pages':pages},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
s='\n'.join(text); s=s[s.index('Mutations\n'):]; matches=list(re.finditer(r'(?m)^(\d{2,3})\. (.+)$',s)); entries=[]
assert len(matches)==200
for i,m in enumerate(matches):
 polarity='positive' if i<100 else 'negative'; number=int(m.group(1)); assert number==i%100+1
 desc=' '.join(s[m.end():matches[i+1].start() if i+1<len(matches) else len(s)].split())
 if number==100: desc=desc.split('Well, there you have it!')[0].split('Well, dear reader,')[0].strip()
 entries.append({'id':f'rads-{polarity}-{number:03}','number':number,'polarity':polarity,'name':m.group(2).strip(),'description':desc})
Path('src/app/core/systems/rads-mutations.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Imported {len(pdf)} reference pages and {len(entries)} mutations')
