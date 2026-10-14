#!/usr/bin/env python3
"""Decode Unity 3.4 iOS assets without modifying original serialized files.
Requires UnityPy 1.25.4, TypeTreeGeneratorAPI 0.0.10, Pillow.
References retain file/path IDs and external-file tables, not invented Unity GUIDs.
"""
import collections,json,re
from pathlib import Path
import UnityPy
from UnityPy.helpers.TypeTreeGenerator import TypeTreeGenerator
ROOT=Path(__file__).resolve().parents[1]
TARGET=ROOT/'recovered/ios-2.0'
DATA=TARGET/'ipa/Payload/Puppet War.app/Data'
OUT=TARGET/'decoded-assets'
def safe(s):return re.sub(r'[^\w .@-]','_',s).strip()[:100] or 'unnamed'
def serial(v):
 if isinstance(v,(bytes,bytearray)):return {'encoding':'hex','data':v.hex()}
 raise TypeError(type(v).__name__)
def dump(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,default=serial,separators=(',',':')))
def main():
 OUT.mkdir(parents=True,exist_ok=True)
 generator=TypeTreeGenerator('3.4.0f5',generator='AssetRipper');generator.load_local_dll_folder(str(DATA/'Managed'))
 inventory=[];errors=[];files=[];scenes=[]
 paths=sorted(p for p in DATA.iterdir() if p.is_file() and (p.name in ['mainData','resources.assets','unity default resources'] or re.fullmatch(r'level\d+|sharedassets\d+\.assets',p.name)))
 for path in paths:
  env=UnityPy.load(str(path));env.typetree_generator=generator
  # Only this file's objects; referenced files can be loaded lazily during Mono decoding.
  objects=list(env.objects)
  sf=next(iter(env.files.values()))
  external=[getattr(x,'path','') for x in getattr(sf,'externals',[])]
  files.append({'name':path.name,'version':str(getattr(sf,'unity_version','')),'objects':len(objects),'externals':external})
  for o in objects:
   kind=o.type.name;entry={'file':path.name,'path_id':o.path_id,'type':kind};data=None
   try:
    if kind=='MonoBehaviour':
     head=o.parse_monobehaviour_head();script=head.m_Script.deref_parse_as_object();entry['script']=script.m_ClassName
     data=o.read_typetree(nodes=o.generate_monobehaviour_node())
    else:data=o.read_typetree()
    entry['name']=data.get('m_Name','')
    if kind=='BuildSettings':scenes=data['levels'];data.pop('m_AuthToken',None)
    stem=f'{o.path_id}_{safe(entry.get("name") or entry.get("script",kind))}'
    dest=OUT/path.name/kind/(stem+'.json');dump(dest,data);entry['json']=str(dest.relative_to(OUT))
    if kind=='Texture2D':
     texture=o.read();entry['format']=texture.m_TextureFormat;entry['width']=texture.m_Width;entry['height']=texture.m_Height
     image=texture.image;dest=dest.with_suffix('.png');image.save(dest);entry['image']=str(dest.relative_to(OUT))
    elif kind=='AudioClip':
     for n,raw in o.read().samples.items():
      audio=dest.parent/(stem+'_'+safe(n));audio.write_bytes(raw);entry.setdefault('audio',[]).append(str(audio.relative_to(OUT)))
    elif kind=='Mesh' and data.get('m_Vertices'):
     dest=dest.with_suffix('.obj');dest.write_text(o.read().export());entry['mesh']=str(dest.relative_to(OUT))
   except Exception as exc:
    entry['error']=str(exc);errors.append({**entry});dest=OUT/path.name/'raw'/f'{o.path_id}_{safe(kind)}.bin';dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(o.get_raw_data());entry['raw']=str(dest.relative_to(OUT))
   inventory.append(entry)
  print(path.name,len(objects),'objects;',len(errors),'issues so far',flush=True)
 result={'unity_version':'3.4.0f5','scene_paths':scenes,'files':files,'counts':dict(collections.Counter(e['type'] for e in inventory)),'objects':inventory,'issues':errors}
 dump(OUT/'inventory.json',result)
 print('TOTAL',len(inventory),'objects;',len(errors),'issues;',sum('image' in e for e in inventory),'images',flush=True)
if __name__=='__main__':main()
