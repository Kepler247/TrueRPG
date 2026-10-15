import json,re,unicodedata
from pathlib import Path
pages=json.loads(Path('.codex-tmp/rads-core-source.json').read_text());full=unicodedata.normalize('NFKC','\n'.join(pages)).replace('\u200b','')
classes=['Gunslinger','Psycho','Hacker','Medic','Soldier','Prophet']
names={
'Gunslinger':[(1,'Lucky Strike',1),(1,'Stroke of Genius',3),(2,'Fan the Hammer',2),(4,'Distraction',2),(4,'Pickpocket',2),(5,'Deadeye',5),(6,'Shrouded Attack',None),(6,'Fantastic Story',4),(7,'No One Walks Away',7),(8,'Master Gambler',None),(8,'Old Friend',5),(9,'Bending Bullets',None),(9,'Wild Plan',8),(10,'Super Deadeye',11),(11,'Unbelievable Luck',10),(12,'Divine Intervention',15)],
'Psycho':[(1,'Ibuprofen',1),(1,'Cocaine',3),(2,'Heroin',2),(4,'Meth',2),(4,'IntelliBoostPro',2),(5,'Bromo-Dragonfly',5),(6,'Incredible Intimidation',None),(6,'DMT',4),(7,'SuperSoldier',7),(8,'Chemical Immunity',None),(8,'OmegaMax',5),(9,'Rage',None),(9,'Jericho',8),(10,'UltraSoldier',11),(11,'Wrecking Ball',10),(12,'UltraCocaMethMorphine',15)],
'Hacker':[(1,'Have You Tried Turning It Off and On Again?',1),(1,'Administrator Privileges',3),(2,'Remote Access',2),(4,'Backdoor',2),(4,'Deepfake',2),(5,'Ghost in the Machine',5),(6,'Technological Intuition',None),(6,'Digital Archaeology',4),(7,'System Override',7),(8,'Walking Encyclopedia',None),(8,'Identity Theft',5),(9,'Wireless Menace',None),(9,'Skeleton Key',8),(10,'Total System Failure',11),(11,'I Know a Guy Who Knows a Guy',10),(12,'Root Access',15)],
'Medic':[(1,'Second Opinion',1),(1,'Clinical Trial',3),(2,'Questionable Prescription',2),(4,'Performance Enhancing Drugs',2),(4,'Medical Examination',2),(5,'Organ Donation',5),(6,'Anatomical Expertise',None),(6,'Unlicensed Experimentation',4),(7,'Hippocratic Suggestion',7),(8,"Doctor's Orders",None),(8,'Biological Sabotage',5),(9,'Mutational Medicine',0),(9,'Experimental Evolution',8),(10,'Catastrophic Diagnosis',11),(11,'Medical Miracle',10),(12,'God Complex',15)],
'Soldier':[(1,'Second Attempt, Soldier!',1),(1,'Military Precision',3),(2,'Follow My Lead',2),(4,'Suppressing Fire',2),(4,'Command Presence',2),(5,'Coordinated Assault',5),(6,"Veteran's Instinct",None),(6,'Emergency Requisition',4),(7,'Hold the Line',7),(8,'Drill Sergeant',0),(8,'Chain of Command',5),(9,'Perfect Formation',None),(9,'Tactical Genius',8),(10,'Total Mobilization',11),(11,'Military Intelligence',10),(12,'Supreme Commander',15)],
'Prophet':[(1,'Divine Guidance',1),(1,'The Lord Provides',3),(2,'Mark of the Heretic',2),(4,'Blessed Ammunition',2),(4,'Street Preacher',2),(5,'The Lord Works in Mysterious Ways',5),(6,'Eye of Providence',None),(6,'Confession',4),(7,'Judgment Day',7),(8,'Unshakable Conviction',None),(8,'Pilgrimage',5),(9,'The Gospel According to Ballistics',None),(9,'Divine Retribution',8),(10,'Thou Shalt Not Miss',11),(11,'Prophet of the Wasteland',10),(12,'And God Said, Let There Be Lead',15)]}
class_start=full.index('Classes',full.index('Action Economy'));positions=[class_start+re.search(r'(?m)^\s*'+c+r'\s*$',full[class_start:]).start() for c in classes];end=full.index('Weaponry and Armor',positions[-1]);out=[]
for ci,c in enumerate(classes):
 raw=full[positions[ci]:positions[ci+1] if ci<5 else end];text=re.sub(r'\s+',' ',raw)
 for level,name,cost in names[c]:
  pattern=re.escape(name).replace(r'\ ',r'\s+')+r'(?:\s*[;:]|(?=\s+For\b))';m=re.search(pattern,text,re.I)
  assert m,(c,name)
  # Stop at the next named feature or level header; all text is retained in the source reference.
  ends=[len(text)];n=re.search(r'Level\s+\d+\s*:',text[m.end():],re.I)
  if n:ends.append(m.end()+n.start())
  for _,other,_ in names[c]:
   n=re.search(re.escape(other).replace(r'\ ',r'\s+')+r'(?:\s*[;:]|(?=\s+For\b))',text[m.end():],re.I)
   if n:ends.append(m.end()+n.start())
  desc=text[m.end():min(ends)].strip();out.append({'id':f'501-{c.lower()}-{level}-'+re.sub('[^a-z0-9]+','-',name.lower()),'class':c,'level':level,'name':name,'cost':cost,'description':desc})
 # Level 3 training has no named heading in this source.
 m=re.search(r'Level 3:',text,re.I);n=re.search(r'Level 4:',text,re.I)
 out.append({'id':f'501-{c.lower()}-3-'+('dual-wield' if c=='Gunslinger' else 'training'),'class':c,'level':3,'name':'Dual Wield' if c=='Gunslinger' else f'{c} training','cost':0 if c=='Prophet' else None,'description':text[m.end():n.start()].strip(),'usesMax':1 if c=='Prophet' else None})
passives={
'Gunslinger':('Pistol Training','+1 to checks and damage rolls done with pistols.'),
'Psycho':('Melee Training','+1 to checks and damage rolls done with melee weaponry.'),
'Hacker':('Technical Training','+1 to checks involving hacking, repairing or modifying electronic devices.'),
'Medic':('Medical Training','+1 to checks involving medicine, surgery, diagnosis and administration of biological treatments.'),
'Soldier':('Weapons Training','+1 to checks and damage rolls made with rifles and heavy weapons.'),
'Prophet':('Precision Training','+1 to attacks with precision rifles and +1 to Wisdom checks involving observation or religious knowledge.'),
}
for c,(name,desc) in passives.items():out.append({'id':f'501-{c.lower()}-1-'+re.sub('[^a-z0-9]+','-',name.lower()),'class':c,'level':1,'name':name,'cost':None,'description':desc})
Path('src/app/core/systems/rads-features.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Imported',len(out),'class features')

triggers={}
for ci,c in enumerate(classes):
 text=re.sub(r'\s+',' ',full[positions[ci]:positions[ci+1] if ci<5 else end])
 start=text.index('extra points at will:')+len('extra points at will:')
 stop=text.index('As the character levels up',start)
 triggers[c]=text[start:stop].strip()
Path('src/app/core/systems/rads-resource-triggers.json').write_text(json.dumps(triggers,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
