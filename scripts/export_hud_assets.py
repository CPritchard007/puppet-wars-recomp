"""Recover Episode 2 HUD PackedSprites, preserving the original RGBA4444 channels."""
import re,json
from pathlib import Path
import UnityPy
from PIL import Image
from legacy_texture import decode_rgba4444
from vr_assets import docs
root=Path(__file__).resolve().parents[1]
base=root/'recovered/episode-2/unity-project/ExportedProject/Assets'
refs={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in base.rglob('*.meta')}
d=docs(base/'Scenes/21_Level_Corridor.unity')
out=root/'web/public/assets/hud';out.mkdir(exist_ok=True)
cache={}
def export(sprite,name,uv=None):
 go=sprite['m_GameObject'];mr=next(v for k,v in d.values() if k=='MeshRenderer' and v['m_GameObject']==go)
 mat=next(iter(docs(refs[mr['m_Materials'][0]['guid']]).values()))[1]
 tex=next(v['second']['m_Texture']['guid'] for v in mat['m_SavedProperties']['m_TexEnvs']['data'] if v['first']['name']=='_MainTex');source_name=refs[tex].stem
 if source_name not in cache:
  catalog=json.loads((root/'recovered/episode-2/unity-project/AuxiliaryFiles/path_id_map.json').read_text())
  container=next(f['Name'] for f in catalog['Files'] if any(a['Type']=='Texture2D' and a['Name']==source_name for a in f['Assets']))
  textures=[o.read() for o in UnityPy.load(str(root/'recovered/episode-2/apk/assets/bin/Data'/container)).objects if o.type.name=='Texture2D']
  texture=next(t for t in textures if t.m_Name==source_name)
  cache[source_name]=decode_rgba4444(bytes(texture.image_data),texture.m_Width,texture.m_Height) if texture.m_TextureFormat==2 else texture.image
 im=cache[source_name];uv=uv or sprite['_ser_uvs'];x,y,w,h=[uv[k] for k in ['x','y','width','height']]
 if w<=0 or h<=0:return
 im.crop((round(x*im.width),round((1-y-h)*im.height),round((x+w)*im.width),round((1-y)*im.height))).save(out/(name+'.png'))
for fid,name in [(3113,'pause'),(3373,'health-top'),(3374,'health-fill'),(3375,'health-highlight'),(3376,'health-back'),(3107,'slot'),(3223,'ammo'),(3102,'crosshair')]:export(d[fid][1],name)
for fid,prefix in [(3110,'weapon'),(3047,'extra')]:
 sprite=d[fid][1]
 for i,anim in enumerate(sprite['textureAnimations']):export(sprite,f'{prefix}-{i}',anim['frameUVs'][0])
