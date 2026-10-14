"""Recover the six weapons actually selected by VR loadlevel.ButtonPress."""
import json,shutil
from vr_assets import *
SPECS=[('ak47','20 AK47.prefab'),('flamethrower','18 FlameThrower.prefab'),('katana','09 KATANA.prefab'),('leafblower','25 LeafBlower.prefab'),('cake','27 DynamitCake.prefab'),('redbutton','28 RedButton.prefab')]
def main():
 target=OUT/'vr/weapons';target.mkdir(parents=True,exist_ok=True);result={}
 for key,prefab in SPECS:
  d=docs(BASE/'Resources/wprefabs'/prefab);clips={};idle_reverse=False
  for kind,v in d.values():
   if kind!='MonoBehaviour' or not v.get('textureAnimations'):continue
   go=v['m_GameObject']['fileID'];name=d[go][1]['m_Name'];renderer=next(x for k,x in d.values() if k=='MeshRenderer' and x['m_GameObject']['fileID']==go);mat=next(iter(docs(REFS[renderer['m_Materials'][0]['guid']]).values()))[1];tex=mat['m_SavedProperties']['m_TexEnvs']['_MainTex']['m_Texture']['guid'];p=REFS[tex];dest=target/(tex+p.suffix);shutil.copyfile(p,dest);a=v['textureAnimations'][0]
   if 'idle' in name.lower():idle_reverse=bool(a.get('loopReverse'))
   clips[name]=[{'uv':[r[x] for x in ['x','y','width','height']],'bounds':[tl['x'],tl['y'],br['x'],br['y']],'texture':str(dest.relative_to(OUT.parent)),'duration':1/a['framerate']} for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]
  states={state:[f for name,frames in sorted(clips.items()) if (state in name.lower().replace('_','') if state in ['beforefire','afterfire'] else state in name.lower() and 'before' not in name.lower() and 'after' not in name.lower()) for f in frames] for state in ['idle','fire','reload','switch','beforefire','afterfire']}
  if key=='katana':
   strikes=[frames for name,frames in sorted(clips.items()) if 'fire' in name.lower()]
   if len(strikes)>1:states['fire']=strikes[0];states['fireAlt']=strikes[1]
  # Perk animations start with their ready pose; the source has no idle clip.
  if not states['idle']:states['idle']=[dict(states['fire'][0],duration=1)]
  result[key]={'sourcePrefab':prefab,'idleLoopReverse':idle_reverse,**states}
  print(key,{s:len(f) for s,f in states.items()},flush=True)
 (target/'animations.json').write_text(json.dumps(result,separators=(',',':')))
 # Original audio for these six weapons and the town/parking music.
 sounds={'ak47':'20_AK47_Fire01','flamethrower':'18_FlameThrower_FlamesLoop02','leafblower':'25_Blower_FireLoop','katana':'09ShotSound','cake':'27 DynamitCake throw01','redbutton':'28_3_RedButton_Press'};audio={}
 for k,name in sounds.items():
  matches=[p for p in BASE.rglob('*') if p.is_file() and p.stem==name and p.suffix in ['.wav','.ogg','.mp3']]
  if matches:
   p=matches[0];dest=target/(k+p.suffix);shutil.copyfile(p,dest);audio[k]=str(dest.relative_to(OUT.parent))
 for name in ['Game0','Game1','Game2','MusicNight','MainMenu1']:
  p=BASE/'Resources/Music'/(name+'.ogg');dest=target/(name+'.ogg');shutil.copyfile(p,dest);audio[name]=str(dest.relative_to(OUT.parent))
 firemat=next(iter(docs(BASE/'Material/fire.mat').values()))[1];firetex=REFS[firemat['m_SavedProperties']['m_TexEnvs']['_MainTex']['m_Texture']['guid']];shutil.copyfile(firetex,target/'flame.png')
 (target/'audio.json').write_text(json.dumps(audio,indent=2))
 d=docs(BASE/'GameObject/grenade Cake.prefab');v=next(v for k,v in d.values() if k=='MonoBehaviour' and v.get('textureAnimations'));mr=next(v for k,v in d.values() if k=='MeshRenderer');mat=next(iter(docs(REFS[mr['m_Materials'][0]['guid']]).values()))[1];p=REFS[mat['m_SavedProperties']['m_TexEnvs']['_MainTex']['m_Texture']['guid']];shutil.copyfile(p,target/'cake-projectile.png');a=v['textureAnimations'][0]
 (target/'cake-projectile.json').write_text(json.dumps({'material':{'texture':'assets/vr/weapons/cake-projectile.png'},'fps':a['framerate'],'frames':[{'uv':[r[x] for x in ['x','y','width','height']],'bounds':[tl['x'],tl['y'],br['x'],br['y']]} for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]}))

if __name__=='__main__':main()
