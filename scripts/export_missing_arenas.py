"""Recover Christmas and corridor sets with their own original spawn anchors."""
import json
import export_web_assets as old
from vr_assets import docs
old.documents=docs
SPECS=[(1,'snow','day','27 Level_Xmas.unity'),(2,'corridor','day','21_Level_Corridor.unity'),(2,'corridor','night','23_Level_Corridor_Night.unity')]
for episode,key,period,filename in SPECS:
 target=f'legacy/{key}-{period}';old.export(episode,filename,target)
 path=old.OUT/target/'scene.json';data=json.loads(path.read_text());d=docs(old.ROOT/f'recovered/episode-{episode}/unity-project/ExportedProject/Assets/Scenes'/filename)
 gos={i:v for i,(k,v) in d.items() if k=='GameObject'};transforms={i:v for i,(k,v) in d.items() if k=='Transform'};gt={v['m_GameObject']['fileID']:i for i,v in transforms.items()}
 spawners=[v for k,v in d.values() if k=='MonoBehaviour' and v.get('SpawnPoints') and v.get('Enemys')]
 data.update(spawnPoints=list(dict.fromkeys(p['fileID'] for v in spawners for p in v['SpawnPoints'])),enemyTypes=list(dict.fromkeys(gos[e['fileID']]['m_Name'] for v in spawners for e in v['Enemys'])),trashSpawnPoints=[],lighting=period,sourcePackage=f'episode-{episode}')
 # These pre-VR scenes have no teleport components. Reuse recovered floor spawn
 # anchors as web VR destinations, without copying coordinates from another set.
 data['teleports']=[{'destination':i,'rotation':0} for i in data['spawnPoints']]
 path.write_text(json.dumps(data,separators=(',',':')))
 print(key,period,'spawn points',len(data['spawnPoints']),data['enemyTypes'],flush=True)
