"""Export the original animated money star, medkit and ammunition pickups."""
import json,shutil
from vr_assets import *
def main():
 d=scene('05 Levels.unity');target=OUT/'pickups';target.mkdir(parents=True,exist_ok=True);result={}
 for kind,gid in [('money',818),('health',742),('ammo',698)]:
  components=[v for _,v in d.values() if v.get('m_GameObject',{}).get('fileID')==gid]
  sprite=next(v for v in components if v.get('textureAnimations'));renderer=next(v for v in components if v.get('m_Materials'));pickup=next(v for v in components if 'pickupType' in v)
  mat=next(iter(docs(REFS[renderer['m_Materials'][0]['guid']]).values()))[1];p=REFS[mat['m_SavedProperties']['m_TexEnvs']['_MainTex']['m_Texture']['guid']];shutil.copyfile(p,target/'atlas.png');a=sprite['textureAnimations'][0]
  result[kind]={'texture':'assets/pickups/atlas.png','amount':pickup['amount'],'fps':a['framerate'],'frames':[{'uv':[r[k] for k in ['x','y','width','height']],'bounds':[tl['x'],tl['y'],br['x'],br['y']]} for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]}
 (target/'pickups.json').write_text(json.dumps(result,separators=(',',':')))
if __name__=='__main__':main()
