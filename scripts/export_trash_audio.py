"""Recover EnemyAI8Trash and DamageReciver08Trash audio assignments."""
import json,shutil
import export_enemy_roster as roster
from vr_assets import docs
roster.documents=docs
source,objects,transforms,gt,root,nodes,paths,ids=roster.hierarchy(*roster.ROSTER['trash'][:2])
components=[v for k,v in source.values() if k=='MonoBehaviour' and gt.get(v.get('m_GameObject',{}).get('fileID'))==root]
ai=next(v for v in components if 'attackRange' in v)
damage=next(v for v in components if 'HitSounds' in v)
out=roster.TARGET/'trash-audio';out.mkdir(exist_ok=True)
manifest={}
for key,ref in [('trashAttack',ai['hitSound']),('trashDeath',damage['DieFall']),*[(f'trashHit{i}',v) for i,v in enumerate(damage['HitSounds'])]]:
 path=roster.REFS[ref['guid']];shutil.copyfile(path,out/(key+'.wav'));manifest[key]='assets/enemies/trash-audio/'+key+'.wav'
(out/'audio.json').write_text(json.dumps(manifest,indent=2))

manifest_path=roster.TARGET/'manifest.json'
manifest=json.loads(manifest_path.read_text())
manifest['projectiles']['tomatoImpact']=roster.export_projectile('tomatoImpact',roster.ALL,'EXplosion_Tomato')
manifest_path.write_text(json.dumps(manifest,indent=2))
