"""Recover the original fuzzy movement pad and fire button artwork."""
import re,shutil,json
import UnityPy
from legacy_texture import decode_rgba4444
from pathlib import Path
from PIL import Image
from vr_assets import docs
root=Path(__file__).resolve().parents[1];base=root/'recovered/episode-2/unity-project/ExportedProject/Assets';out=root/'web/public/assets/touch';out.mkdir(exist_ok=True)
refs={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in base.rglob('*.meta')}
d=docs(base/'Scenes/21_Level_Corridor.unity');f=next(v for k,v in d.values() if 'moveTouchPad' in v)
for name,key in [('pad','JoystickBk'),('fire','FireButtonBK')]:
 sprite=d[f[key]['fileID']][1];go=sprite['m_GameObject'];mr=next(v for k,v in d.values() if k=='MeshRenderer' and v['m_GameObject']==go)
 mat=next(iter(docs(refs[mr['m_Materials'][0]['guid']]).values()))[1];tex=next(v['second']['m_Texture']['guid'] for v in mat['m_SavedProperties']['m_TexEnvs']['data'] if v['first']['name']=='_MainTex')
 source_name=refs[tex].stem
 catalog=json.loads((root/'recovered/episode-2/unity-project/AuxiliaryFiles/path_id_map.json').read_text())
 container=next(file['Name'] for file in catalog['Files'] if any(a['Type']=='Texture2D' and a['Name']==source_name for a in file['Assets']))
 texture=next(o.read() for o in UnityPy.load(str(root/'recovered/episode-2/apk/assets/bin/Data'/container)).objects if o.type.name=='Texture2D')
 im=decode_rgba4444(bytes(texture.image_data),texture.m_Width,texture.m_Height) if texture.m_TextureFormat==2 else texture.image
 uv=sprite['_ser_uvs'];x,y,w,h=[uv[k] for k in ['x','y','width','height']];im.crop((round(x*im.width),round((1-y-h)*im.height),round((x+w)*im.width),round((1-y)*im.height))).save(out/(name+'.png'))
gui=d[f['moveTouchPadTexture']['fileID']][1];shutil.copyfile(refs[gui['m_Texture']['guid']],out/'nose.png')
