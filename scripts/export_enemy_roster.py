"""Recover each enemy's actual hierarchy, skins, materials and behavior clips."""
import json,math,re,shutil,sys
from functools import lru_cache
from export_web_assets import ROOT,OUT,documents,mesh
from export_puppet_rig import sample_curve,vector
BASE=ROOT/'recovered/episode-1/unity-project/ExportedProject/Assets'
TARGET=OUT/'enemies'
REFS={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in BASE.rglob('*.meta')}
@lru_cache(None)
def doc(path):return documents(path)
COMMON={'run':'run1','attack':'attack1','hit':'hit1','death':'death1','celebrate':'winningJoy','cover':'duck'}
STUDIO='05 Levels.unity';ALL='28_ThreeBosses_LobbyNightSet.unity'
ROSTER={
 'grunt':(STUDIO,'Enemy00_Defult',{}),
 'fast':(STUDIO,'Enemy01_Fast02',{'run':'jumper'}),
 'chicken':(STUDIO,'Enemy04_ThrowChicken02',{'throw':'throw_1'}),
 'fish':(STUDIO,'Enemy02_ThrowFish02',{'throw':'throw_short'}),
 'bomber':(STUDIO,'Enemy03_Suicidel',{'run':'runSuicide','fuse':'hit1','death':'death_flyup'}),
 'strong':(STUDIO,'Enemy05_Strongest',{'run':'strong_walk','attack':'strong_attack'}),
 'ninja':(ALL,'Enemy06_Ninja',{'run':'Ninja_RunShort','attack':'Ninja_attack','jump':'Ninja_JumpShort','cover':'Ninja_crouch'}),
 'zombie':(ALL,'Enemy07_Zombie',{'run':'Zombie_walk','attack':'Zombie_attack','knockdown':'Zombie_fallGetup','recover':'Zombie_SitGetup'}),
 'soldier':(ALL,'Enemy09_SoldierShooter',{'run':'ShooterSoldier_Run','throw':'ShooterSoldier_ShootRoll','roll':'ShooterSoldier_Roll'}),
 'trash':(ALL,'Enemy08_TrashShoot',{'run':'Shootertrash_shoot','attack':'Shootertrash_shoot','throw':'Shootertrash_shoot','death':'Shootertrash_Die','hit':'Shootertrash_shoot','celebrate':'Shootertrash_shoot','cover':'Shootertrash_shoot'}),
 'magician':('31_Level_ParkingLot_Night.unity','Enemy09_Magic',{'run':'VampireWalk','magic':'MagicWand','teleport':'VampireDissapear'}),
 'vampire':(ALL,'Enemy11_Vampire',{'run':'Vampire_walk','attack':'Vampire_attack','hit':'Vampire_walk_hurt','transform':'Vampire_scream'}),
 'bat':(ALL,'Enemy11_Bat',{'run':'Bat_FlyUp','attack':'Bat_attack','hit':'Bat_attack','death':'Bat_Die','celebrate':'Bat_FlyUp','cover':'Bat_FlyUp'}),
 'boss':(ALL,'BossLite',{'run':'Walk','attack':'Punch','hit':'Hurt','death':'Death','celebrate':'Angry','cover':'Angry','throw':'Throw','charge':'BullRun'}),
 'clown':(ALL,'ClownBoss',{'run':'Skate','attack':'attack01','hit':'Hit','death':'Death_0','celebrate':'winning','cover':'Protect','throw':'Throw_0','defend':'Protect','firebreath':'BlowFire','charge':'SkateFire'}),
 'kart':('31_Level_ParkingLot_Night.unity','KartingPuppet@',{'run':'MoveToPlayer','attack':'Skeed','hit':'SkeedRight','death':'Take 001','celebrate':'Idle','cover':'Idle','idle':'Idle'}),
 'elf':('27 Level_Xmas.unity','Enemy06_Elf',{'throw':'throw_1'})
}
def material(guid,include_sprite=False):
 m=next(iter(doc(REFS[guid]).values()))[1]
 if not include_sprite and m['m_Name'].lower().startswith('sprite'):return {'name':m['m_Name']}
 entries=m.get('m_SavedProperties',{}).get('m_TexEnvs',{}).get('data',[])
 tex=next((e['second']['m_Texture'].get('guid') for e in entries if e['first']['name']=='_MainTex'),None)
 if not tex:raise ValueError(f'Missing texture for {m["m_Name"]}')
 p=REFS[tex];name=tex+'.png'
 # Other-episode scenes can reference 32px placeholder atlases. Prefer the full original.
 from PIL import Image
 candidates=[p]+[ROOT/f'recovered/{release}/unity-project/ExportedProject/Assets/Texture2D'/p.name for release in ['episode-2','vr-2.0.1']]
 p=max((q for q in candidates if q.exists()),key=lambda q:Image.open(q).width*Image.open(q).height)
 if p.stem=='puppetClown_UV_01':
  from legacy_texture import export_legacy_texture
  export_legacy_texture(ROOT,'sharedassets24.assets',p.stem,TARGET/name)
 else:shutil.copyfile(p,TARGET/name)
 return {'name':m['m_Name'],'texture':'assets/enemies/'+name,'sourceTexture':p.name}
def hierarchy(scene,rootname):
 docs=doc(BASE/'Scenes'/scene);objects={i:v for i,(k,v) in docs.items() if k=='GameObject'};transforms={i:v for i,(k,v) in docs.items() if k=='Transform'}
 gt={v['m_GameObject']['fileID']:i for i,v in transforms.items()};root=next(i for i,t in transforms.items() if objects[t['m_GameObject']['fileID']]['m_Name']==rootname)
 nodes=[];paths={};ids={}
 def visit(i,path,parent):
  t=transforms[i];idx=len(nodes);ids[i]=idx;paths[path]=idx
  nodes.append({'name':objects[t['m_GameObject']['fileID']]['m_Name'],'path':path,'parent':parent,'position':vector(t['m_LocalPosition'],'xyz') if parent>=0 else [0,0,0],'rotation':vector(t['m_LocalRotation'],'xyzw') if parent>=0 else [0,0,0,1],'scale':vector(t['m_LocalScale'],'xyz') if parent>=0 else [1,1,1]})
  for c in t['m_Children']:
   ci=c['fileID'];name=objects[transforms[ci]['m_GameObject']['fileID']]['m_Name'];visit(ci,path+'/'+name if path else name,idx)
 visit(root,'',-1)
 return docs,objects,transforms,gt,root,nodes,paths,ids

def animation(path,paths,prefix=''):
 clip=next(iter(doc(path).values()))[1];tracks=[];duration=0;unbound=[]
 if clip['m_Compressed'] or clip.get('m_CompressedRotationCurves'):raise ValueError(f'Compressed clip {path}')
 for source,prop,axes in [('m_PositionCurves','position','xyz'),('m_RotationCurves','quaternion','xyzw'),('m_ScaleCurves','scale','xyz')]:
  for curve in clip[source]:
   pathkey='/'.join(p for p in [prefix,curve['path']] if p)
   if pathkey not in paths:
    unbound.append(pathkey);continue
   keys=curve['curve']['m_Curve']
   if not keys:continue
   end=keys[-1]['time'];duration=max(duration,end)
   times=sorted({0,end,*(k['time'] for k in keys),*(i/30 for i in range(math.ceil(end*30)) if i/30<end)})
   values=[];previous=None
   for time in times:
    value=sample_curve(keys,time,axes)
    if prop=='quaternion':
     length=math.sqrt(sum(x*x for x in value));value=[v/length for v in value]
     if previous and sum(a*b for a,b in zip(value,previous))<0:value=[-v for v in value]
     previous=value
    values.extend(round(v,7) for v in value)
   tracks.append({'node':paths[pathkey],'property':prop,'times':times,'values':values})
 if not tracks or len(unbound)>len(tracks)*.4:raise ValueError(f'Animation has too many unbound tracks: {path.name}: {unbound}')
 return {'source':path.stem,'duration':max(duration,.01),'tracks':tracks,'unusedSourcePaths':sorted(set(unbound))}

def export_character(key,spec):
 scene,rootname,overrides=spec;docs,objects,transforms,gt,root,nodes,paths,ids=hierarchy(scene,rootname)
 parts=[];attached={}
 for kind,c in docs.values():
  tid=gt.get(c.get('m_GameObject',{}).get('fileID'));idx=ids.get(tid)
  if idx is None:continue
  node=nodes[idx]
  if key=='vampire' and 'Enemy11_Bat' in node['path']:continue
  if kind=='Animation':
   for a in c['m_Animations']:
    if a.get('guid'):attached[REFS[a['guid']].stem]=(REFS[a['guid']],node['path'])
  if kind not in ('SkinnedMeshRenderer','MeshRenderer'):continue
  mats=[material(m['guid']) for m in c['m_Materials'] if m.get('guid')]
  if not mats or any(m['name'].lower().startswith('sprite') for m in mats):continue
  if kind=='MeshRenderer':
   mf=next((v for k,v in docs.values() if k=='MeshFilter' and v['m_GameObject']==c['m_GameObject']),None)
   if not mf or not mf['m_Mesh'].get('guid'):continue
   mesh_path=REFS[mf['m_Mesh']['guid']]
  else:mesh_path=REFS[c['m_Mesh']['guid']]
  source=next(iter(doc(mesh_path).values()))[1];geo=mesh(mesh_path)
  part={'node':idx,'name':node['name'],'geometry':geo,'materials':mats,'sourceMesh':mesh_path.name,'role':'umbrella' if 'Umbrella' in node['path'] else 'body'}
  if kind=='SkinnedMeshRenderer':
   geo['skinWeights']=[float(v[f'weight[{i}]']) for v in source['m_Skin'] for i in range(4)]
   geo['skinIndices']=[int(v[f'boneIndex[{i}]']) for v in source['m_Skin'] for i in range(4)]
   part['bones']=[ids[b['fileID']] for b in c['m_Bones']]
   part['bindPoses']=[[m[f'e{r}{col}'] for r in range(4) for col in range(4)] for m in source['m_BindPose']]
  parts.append(part)
 if not parts:raise ValueError('No character mesh: '+rootname)
 clips={}
 for state,name in {**COMMON,**overrides}.items():
  if name not in attached:raise ValueError(f'{key}: missing clip {name}; available {list(attached)}')
  path,prefix=attached[name];clips[state]={**animation(path,paths,prefix),'loop':state in ['run','idle','celebrate','cover','defend','charge']}
 if key=='clown' and 'OpenState' in attached:
  path,prefix=attached['OpenState'];clips['defend']['tracks']+=animation(path,paths,prefix)['tracks']
 if 'idle' not in clips:
  source=clips['run'] if key in ['trash','bat'] else clips['attack']
  clips['idle']={'source':source['source']+' (ready pose)','duration':1,'loop':True,'tracks':[{**t,'times':[0,1],'values':t['values'][:4 if t['property']=='quaternion' else 3]*2} for t in source['tracks']]}
 # Nested kart transform compensates for a nonuniform CarAi parent scale.
 def world_axis(axis):
  v=[float(i==axis) for i in range(3)];tid=root
  while tid:
   t=transforms[tid];v=[a*b for a,b in zip(v,vector(t['m_LocalScale'],'xyz'))];x,y,z,w=vector(t['m_LocalRotation'],'xyzw');vx,vy,vz=v
   tx,ty,tz=2*(y*vz-z*vy),2*(z*vx-x*vz),2*(x*vy-y*vx)
   v=[vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];tid=t['m_Father']['fileID']
  return math.sqrt(sum(a*a for a in v))
 scale=[world_axis(i) for i in range(3)] if key=='kart' else vector(transforms[root]['m_LocalScale'],'xyz')
 primary=next((p for p in parts if 'bones' in p and p['role']=='body'),parts[0])
 heights={'boss':6,'clown':4.5,'bat':1.6,'kart':3.2}
 rig={'version':2,'sourceScene':scene,'sourceRoot':rootname,'sourceScale':scale,'nodes':nodes,'parts':parts,'clips':clips,'height':heights.get(key,3.3*scale[1]/8),'proportions':[scale[0]/scale[1],1,scale[2]/scale[1]],'primaryPart':parts.index(primary)}
 (TARGET/(key+'.json')).write_text(json.dumps(rig,separators=(',',':'),allow_nan=False))
 print(key,rootname,'parts',len(parts),'textures',[m['sourceTexture'] for p in parts for m in p['materials']],'clips',len(clips),flush=True)
 return {'url':'assets/enemies/'+key+'.json','sourceRoot':rootname,'height':rig['height']}

def export_projectile(key,scene,rootname):
 docs,objects,transforms,gt,root,nodes,paths,ids=hierarchy(scene,rootname)
 sprite=next(v for k,v in docs.values() if k=='MonoBehaviour' and gt.get(v.get('m_GameObject',{}).get('fileID')) in ids and v.get('textureAnimations'))
 renderer=next(v for k,v in docs.values() if k=='MeshRenderer' and v['m_GameObject']==sprite['m_GameObject'])
 mat=material(renderer['m_Materials'][0]['guid'],True);a=sprite['textureAnimations'][0]
 frames=[{'uv':[r[x] for x in ['x','y','width','height']],'bounds':[tl['x'],tl['y'],br['x'],br['y']]} for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]
 result={'sourceRoot':rootname,'material':mat,'fps':a['framerate'],'frames':frames}
 (TARGET/(key+'-projectile.json')).write_text(json.dumps(result,separators=(',',':')))
 print('Projectile',key,mat['sourceTexture'],len(frames),'original sprite frames',flush=True)
 return 'assets/enemies/'+key+'-projectile.json'

def export_roster():
 TARGET.mkdir(parents=True,exist_ok=True);manifest={'characters':{},'projectiles':{}}
 for key,spec in ROSTER.items():
  existing=TARGET/(key+'.json')
  if '--resume' in sys.argv and existing.exists():
   rig=json.loads(existing.read_text());manifest['characters'][key]={'url':'assets/enemies/'+key+'.json','sourceRoot':rig['sourceRoot'],'height':rig['height']};continue
  manifest['characters'][key]=export_character(key,spec)
 for key,scene,name in [('fish',STUDIO,'GrenadeFish'),('chicken',STUDIO,'grenade Chicken'),('tomato','31_Level_ParkingLot_Night.unity','GrenadeTomatoLobby'),('snowball','27 Level_Xmas.unity','GrenadeSnowBall'),('grenade',ALL,'GrenadeBomb'),('fireball',ALL,'ClownGiftFlameBall')]:manifest['projectiles'][key]=export_projectile(key,scene,name)
 (TARGET/'manifest.json').write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':export_roster()
