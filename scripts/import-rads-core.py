from pathlib import Path
import pymupdf,json,hashlib,shutil,re,argparse
parser=argparse.ArgumentParser();parser.add_argument("--source",default=r"R:\Downloads\501 Rads (3).pdf");parser.add_argument("--revision",default="core-1");args=parser.parse_args()
src=Path(args.source); pdf=pymupdf.open(src); pages=[]
for i,p in enumerate(pdf):
 blocks=[]; previous_heading=None
 tables=[]
 for detected in p.find_tables(strategy='lines_strict').tables:
  rows=[[' '.join((cell or '').replace('\u200b','').replace('\ufffd',"'").split()) for cell in row] for row in detected.extract()]
  rows=[row for row in rows if any(row)]
  if rows and detected.col_count>=2:
   tables.append({'box':detected.bbox,'block':{'kind':'table','text':' '.join(cell for row in rows for cell in row),'rows':rows},'inserted':False})
 # The two skill-list pages use aligned text without drawn grid lines.
 if i in (58,59) and not tables:
  words=p.get_text('words'); lines={}
  for word in words: lines.setdefault(round(word[1],1),[]).append(word)
  rows=[]
  for words_in_line in lines.values():
   words_in_line.sort(key=lambda w:w[0])
   cells=[' '.join(w[4] for w in words_in_line if w[0]<250),' '.join(w[4] for w in words_in_line if w[0]>=250)]
   if all(cells): rows.append(cells)
  if rows:
   blocks.append({'kind':'table','text':' '.join(cell for row in rows for cell in row),'rows':rows})
   pages.append({'number':i+1,'category':'rules','blocks':blocks})
   continue
 for b in p.get_text('dict',sort=False)['blocks']:
  if 'lines' not in b: continue
  for l in b['lines']:
   spans=l['spans'];t=''.join(s['text'] for s in spans).strip().replace('\u200b','').replace('\ufffd',"'")
   if not t:continue
   table=next((table for table in tables if table['box'][0]-1<=l['bbox'][0] and l['bbox'][2]<=table['box'][2]+1 and table['box'][1]-1<=(l['bbox'][1]+l['bbox'][3])/2<=table['box'][3]+1),None)
   if table:
    if not table['inserted']: blocks.append(table['block']);table['inserted']=True
    previous_heading=None
    continue
   kind='heading' if any('AtomicAge' in s['font'] for s in spans) or re.match(r'^\d{2,3}\. ',t) else 'paragraph'
   atomic=any('AtomicAge' in span['font'] for span in spans)
   size=max(span['size'] for span in spans)
   box=l['bbox']
   wrapped=(kind=='heading' and atomic and previous_heading is not None
            and abs(size-previous_heading['size'])<0.5
            and abs(box[0]-previous_heading['box'][0])<2
            and 0<=box[1]-previous_heading['box'][3]<=size*0.4)
   if wrapped:
    blocks[-1]['text']+=' '+t
   elif blocks and kind=='paragraph' and blocks[-1]['kind']==kind: blocks[-1]['text']+=' '+t
   else: blocks.append({'kind':kind,'text':t})
   previous_heading={'size':size,'box':box} if kind=='heading' and atomic else None
 pages.append({'number':i+1,'category':'lore' if i<57 else 'rules','blocks':blocks})
# A page can end lore and begin rules: classify its continuation blocks separately.
category='lore'
for page in pages:
 for block in page['blocks']:
  if block['kind']=='heading' and block['text']=='Skills': category='rules'
  if category!=page['category']: block['category']=category

# Numbered mutations remain readable subheadings, not 200 navigation sections.
in_mutations=False; table=0
for page in pages:
 grouped=[]
 for block in page['blocks']:
  if block['kind']=='heading' and block['text']=='Mutations': in_mutations=True
  if in_mutations and block['kind']=='heading' and re.match(r'^\d{2,3}\. ',block['text']):
   if re.match(r'^0?1\. ',block['text']):
    table+=1
    grouped.append({'kind':'heading','text':'Positive Mutations' if table==1 else 'Negative Mutations'})
   block={**block,'kind':'subheading'}
  grouped.append(block)
 page['blocks']=grouped
root=Path('public/systems/501-rads'); shutil.copyfile(src,root/('501-rads-'+args.revision+'.pdf'))
(root/(args.revision+'.json')).write_text(json.dumps({'title':'501 Rads','revision':args.revision,'sourceFile':'501-rads-'+args.revision+'.pdf','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'pageCount':len(pdf),'pages':pages},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Preserve source text separately for definition audits and regression checks.
Path('.codex-tmp/rads-core-source.json').write_text(json.dumps([p.get_text(sort=False) for p in pdf]),encoding='utf-8')
print('Imported',len(pdf),'pages')
