"""Recover both Uzi hands and additional episode-one firearms/melee weapons."""
import json,re,shutil
from pathlib import Path
from PIL import Image
from vr_assets import docs
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'web/public/assets/extra-weapons';OUT.mkdir(exist_ok=True)
SPECS=[('sniper',2,'22 SniperRifle.prefab',None,'sound/newsound/22_SniperRifle_Fire01','sound/01ReloadSound'),('dualuzis',2,'21 UZI.prefab','21 UZI Left.prefab','sound/newsound/21_Uzi_Fire','sound/newsound/21_Uzi_Reload'),('smg',1,'02 SubMG.prefab',None,'sound/02ShotSound','sound/02ReloadSound'),('m60',1,'04 LmachineGun M60.prefab',None,'sound/04ShotSound','sound/04ReloadSound'),('bat',1,'08 BaseBat.prefab',None,'sound/08ShotSound','sound/08ReloadSound'),('axe',1,'10 Axe.prefab',None,'sound/10ShotSound','sound/10ReloadSound')]
result={};audio={}
for key,episode,prefab,left,shot,reload in SPECS:
 base=ROOT/f'recovered/episode-{episode}/unity-project/ExportedProject/Assets';refs={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in base.rglob('*.meta')}
 def export(prefab):
  d=docs(base/'Resources/wprefabs'/prefab);clips={};reverse=False
  for k,v in d.values():
   if k!='MonoBehaviour' or not v.get('textureAnimations'):continue
   go=v['m_GameObject']['fileID'];name=d[go][1]['m_Name'];a=v['textureAnimations'][0]
   mr=next(x for k,x in d.values() if k=='MeshRenderer' and x['m_GameObject']['fileID']==go);mat=next(iter(docs(refs[mr['m_Materials'][0]['guid']]).values()))[1]
   tex=next(e['second']['m_Texture']['guid'] for e in mat['m_SavedProperties']['m_TexEnvs']['data'] if e['first']['name']=='_MainTex');p=refs[tex]
   candidates=[ROOT/f'recovered/{release}/unity-project/ExportedProject/Assets/Texture2D'/p.name for release in ['episode-1','episode-2','vr-2.0.1']];p=max((p for p in candidates if p.exists()),key=lambda p:Image.open(p).width*Image.open(p).height)
   dest=OUT/(tex+'.png');shutil.copyfile(p,dest)
   if 'idle' in name.lower():reverse=bool(a.get('loopReverse'))
   clips[name]=[dict(uv=[r[x] for x in ['x','y','width','height']],bounds=[tl['x'],tl['y'],br['x'],br['y']],texture='assets/extra-weapons/'+dest.name,duration=1/a['framerate']) for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]
  states={s:[f for n,frames in sorted(clips.items()) if s in n.lower() and 'afterfire' not in n.lower() for f in frames] for s in ['idle','fire','reload','switch']}
  states['scope']=[f for n,frames in sorted(clips.items()) if 'scope' in n.lower() and 'aim' not in n.lower() for f in frames]
  states['scopeAim']=[f for n,frames in sorted(clips.items()) if 'scopeaim' in n.lower() for f in frames]
  states['fire'] += [f for n,frames in sorted(clips.items()) if 'afterfire' in n.lower() for f in frames]
  states.update(idleLoopReverse=reverse,sourcePrefab=prefab);return states
 result[key]=export(prefab)
 if left:result[key]['left']=export(left)
 for suffix,name in [('',shot),('Reload',reload)]:
  p=base/'Resources'/(name+'.wav');dest=OUT/(key+suffix+'.wav');shutil.copyfile(p,dest);audio[key+suffix]='assets/extra-weapons/'+dest.name
 print(key,{k:len(v) for k,v in result[key].items() if isinstance(v,list)},flush=True)
(OUT/'animations.json').write_text(json.dumps(result,separators=(',',':')));(OUT/'audio.json').write_text(json.dumps(audio,indent=2))
