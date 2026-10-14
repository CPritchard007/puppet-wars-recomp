"""Recover the three missing original day/night scenes; provide a relit parking day variant."""
import json,copy
from functools import lru_cache
import export_web_assets as old
from vr_assets import docs
old.documents=docs
ROOT=old.ROOT;OUT=old.OUT
SPECS=[('studio','night','12 Level_Night.unity'),('lobby','night','22_Level_Lobby_Night.unity'),('town','day','13 Level_Street.unity')]
def world_positions(data):
 nodes={n['id']:n for n in data['nodes']}
 @lru_cache(None)
 def matrix(i):
  n=nodes[i];x,y,z,w=n['rotation'];m=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),0],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),0],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),0],[0,0,0,1]]
  for r in range(3):
   for c in range(3):m[r][c]*=n['scale'][c]
   m[r][3]=n['position'][r]
  if n['parent'] in nodes:
   p=matrix(n['parent']);return [[sum(p[r][k]*m[k][c] for k in range(4)) for c in range(4)] for r in range(4)]
  return m
 return lambda i:[matrix(i)[r][3] for r in range(3)]
def main():
 for arena,period,filename in SPECS:
  key=f'variants/{arena}-{period}';old.export(2 if arena=='lobby' else 1,filename,key);target=OUT/key/'scene.json';d=json.loads(target.read_text());base=json.loads((OUT/f'vr/{arena}/scene.json').read_text());position=world_positions(base)
  # VR destinations/spawners are positioned in the same original set coordinates.
  d.update(teleports=[],spawnPoints=[],trashSpawnPoints=[],enemyTypes=base['enemyTypes'],lighting=period,sourcePackage='episode-2' if arena=='lobby' else 'episode-1')
  ids=set(base['spawnPoints']+base.get('trashSpawnPoints',[])+[t['destination'] for t in base['teleports']]);mapping={i:900000+i for i in ids}
  for i in ids:d['nodes'].append({'id':mapping[i],'parent':0,'name':'VR anchor '+str(i),'active':True,'layer':0,'position':position(i),'rotation':[0,0,0,1],'scale':[1,1,1]})
  d['spawnPoints']=[mapping[i] for i in base['spawnPoints']];d['trashSpawnPoints']=[mapping[i] for i in base.get('trashSpawnPoints',[])];d['teleports']=[dict(t,destination=mapping[t['destination']]) for t in base['teleports']]
  # Retain source damage-state metadata where the prop is shared between variants.
  byname={n['name']:n for n in base['nodes'] if n.get('destructible')}
  for n in d['nodes']:
   if n['name'] in byname:n['destructible']=copy.deepcopy(byname[n['name']]['destructible'])
  target.write_text(json.dumps(d,separators=(',',':')))
 # No parking day scene or day lightmap is present in the supplied releases.
 # Use its original geometry/albedo with neutral daylight in place of baked night lighting.
 d=json.loads((OUT/'vr/parking/scene.json').read_text());d['lighting']='day';d['sourcePackage']='vr-2.0.1';d['variantNote']='Web daylight relighting; no original parking day scene recovered.'
 for m in d['materials'].values():m['lightmap']=None;m['daylightGain']=1.5
 target=OUT/'variants/parking-day';target.mkdir(parents=True,exist_ok=True);(target/'scene.json').write_text(json.dumps(d,separators=(',',':')))
if __name__=='__main__':main()
