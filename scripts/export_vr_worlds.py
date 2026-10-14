"""Export all four VR arenas, source collision, spawn and teleport locations."""
import json,shutil,collections
from vr_assets import *
ARENAS={1:('studio','05 Levels.unity'),2:('lobby','20_Level_Lobby.unity'),3:('town','14 Level_StreetNIGHT.unity'),4:('parking','31_Level_ParkingLot_Night.unity')}
def export(key,name,filename):
 target=OUT/'vr'/name;target.mkdir(parents=True,exist_ok=True);d=scene(filename);gos={i:v for i,(k,v) in d.items() if k=='GameObject'};ts={i:v for i,(k,v) in d.items() if k in ('Transform','RectTransform')};gt={t['m_GameObject']['fileID']:i for i,t in ts.items()};comps=collections.defaultdict(dict);scripts=collections.defaultdict(list)
 for k,v in d.values():
  if 'm_GameObject' in v:
   comps[v['m_GameObject']['fileID']][k]=v
   if k=='MonoBehaviour':scripts[v['m_GameObject']['fileID']].append((script(v),v))
 data={'sourceScene':filename,'nodes':[],'meshes':{},'materials':{},'warnings':[],'teleports':[],'spawnPoints':[],'enemyTypes':[],'trashSpawnPoints':[]}
 def tex(guid):
  p=REFS.get(guid)
  if not p:return None
  dst=target/(guid+p.suffix);shutil.copyfile(p,dst);return str(dst.relative_to(OUT.parent))
 def mat(guid):
  if guid in data['materials']:return guid
  m=next(iter(docs(REFS[guid]).values()))[1];props=m['m_SavedProperties'];textures=props['m_TexEnvs'];main=textures.get('_MainTex',{});light=textures.get('_LightMap',{});shader=REFS.get(m['m_Shader'].get('guid'));sh=shader.read_text() if shader else '';blend='Vertex Colored' in sh or 'Particles/Alpha Blended' in sh
  data['materials'][guid]={'name':m['m_Name'],'texture':tex(main.get('m_Texture',{}).get('guid')),'lightmap':tex(light.get('m_Texture',{}).get('guid')),'scale':list(main.get('m_Scale',{'x':1,'y':1}).values()),'offset':list(main.get('m_Offset',{'x':0,'y':0}).values()),'vertexBlend':blend,'tint':[1,1,1,1]};return guid
 @lru_cache(None)
 def active(i):return bool(gos[ts[i]['m_GameObject']['fileID']]['m_IsActive']) and (not ts[i]['m_Father']['fileID'] or active(ts[i]['m_Father']['fileID']))
 for i,t in ts.items():
  gid=t['m_GameObject']['fileID'];go=gos[gid];c=comps[gid];n={'id':i,'name':go['m_Name'],'parent':t['m_Father']['fileID'],'active':active(i),'layer':go['m_Layer'],'position':list(t['m_LocalPosition'].values()),'rotation':list(t['m_LocalRotation'].values()),'scale':list(t['m_LocalScale'].values())}
  mr=c.get('MeshRenderer');mf=c.get('MeshFilter')
  if n['active'] and go['m_Layer'] in (0,12,13,14) and mr and mf and mr['m_Enabled']:
   ref=mf['m_Mesh'];guid=ref.get('guid')
   if guid and guid in REFS:
    if guid not in data['meshes']:data['meshes'][guid]=mesh(REFS[guid])
    n['mesh']=guid;n['materials']=[mat(m['guid']) for m in mr['m_Materials']]
  bc=c.get('BoxCollider')
  if n['active'] and bc and bc['m_Enabled'] and not bc['m_IsTrigger'] and go['m_Layer'] in (0,12,13,14):n['collider']={'size':list(bc['m_Size'].values()),'center':list(bc['m_Center'].values())}
  for s,v in scripts[gid]:
   if s=='VRTeleport':data['teleports'].append({'node':i,'destination':gt[v['TeleportPos']['fileID']],'rotation':v['TeleportRot']})
   if s=='StreetSet' or s=='LobbySet' and not v.get('ParkingLevel'):data['trashSpawnPoints'] += [p['fileID'] for p in v['SpawnPoints']]
   if s=='EnemySpawn':data['spawnPoints']+=[p['fileID'] for p in v['SpawnPoints']];data['enemyTypes']+=[gos[e['fileID']]['m_Name'] for e in v['Enemys']]
   if s.startswith('SpriteDestruct'):
    sprite=next((x for sn,x in scripts[gid] if x.get('textureAnimations')),None)
    if sprite:n['destructible']={'health':[v.get(k,50) for k in ['LefthitPoints','MiddlehitPoints','RighthitPoints']],'uv':[[a['frameUVs'][0][k] for k in ['x','y','width','height']] for a in sprite['textureAnimations']] }
  data['nodes'].append(n)
 (target/'scene.json').write_text(json.dumps(data,separators=(',',':')));print(name,len(data['meshes']),'meshes',len(data['teleports']),'teleports',data['enemyTypes'],flush=True)
 return {'id':key,'key':name,'name':{'studio':'The studio','lobby':'The lobby','town':'Town at night','parking':'Parking lot at night'}[name],'scene':str((target/'scene.json').relative_to(OUT.parent)),'sourceScene':filename}
if __name__=='__main__':
 result=[export(key,*v) for key,v in ARENAS.items()];(OUT/'vr/arenas.json').write_text(json.dumps(result,indent=2))
