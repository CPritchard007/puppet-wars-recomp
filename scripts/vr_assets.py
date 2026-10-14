"""Shared, cached readers for recovered VR Unity 5.6 YAML."""
import re,json,struct
from functools import lru_cache
from pathlib import Path
import yaml
from export_web_assets import ROOT,OUT,unity_mapping
BASE=ROOT/'recovered/vr-2.0.1/unity-project/ExportedProject/Assets'
class Loader(yaml.CSafeLoader):pass
Loader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,unity_mapping)
@lru_cache(None)
def docs(path):
 text=Path(path).read_text();text=re.sub(r'(m_IndexBuffer:|_typelessdata:) ([0-9a-f]+)',r'\1 "\2"',text)
 return {int(i):next(iter(yaml.load(body,Loader=Loader).items())) for i,body in re.findall(r'--- !u!\d+ &(-?\d+)\n(.*?)(?=--- !u!|\Z)',text,re.S)}
REFS={re.search(r'^guid: (\w+)',p.read_text(),re.M)[1]:p.with_suffix('') for p in BASE.rglob('*.meta') if re.search(r'^guid: (\w+)',p.read_text(),re.M)}
def script(v):return REFS.get(v.get('m_Script',{}).get('guid'),Path('unknown')).stem
def scene(name):return docs(BASE/'Scenes'/name)
if __name__=='__main__':
 result={}
 for p in (BASE/'Scenes').glob('*.unity'):
  d=docs(p);gos={i:v for i,(k,v) in d.items() if k=='GameObject'};selected=[]
  for i,(k,v) in d.items():
   if k=='MonoBehaviour':
    s=script(v)
    if any(x in s.lower() for x in ['gun','weapon','melle','enemyai','enemyspawn','vrtel','vrmenu','playerweapons','survival','mainchapter','playerprefs']):selected.append({'id':i,'gameObject':gos.get(v['m_GameObject']['fileID'],{}).get('m_Name'),'script':s,'fields':v})
  result[p.name]=selected
 (ROOT/'recovered/vr-2.0.1/content-audit.json').write_text(json.dumps(result,indent=2));print({k:len(v) for k,v in result.items()})

@lru_cache(None)
def mesh(path):
 m=next(iter(docs(path).values()))[1];v=m['m_VertexData'];channels=v['m_Channels'];count=v['m_VertexCount'];raw=bytes.fromhex(v['_typelessdata']);sizes={0:4,1:2,2:1,3:1,4:4}
 if m['m_MeshCompression']:raise ValueError('Compressed mesh: '+str(path))
 streams={}
 for c in channels:
  if c['dimension']:streams[c['stream']]=max(streams.get(c['stream'],0),c['offset']+c['dimension']*sizes[c['format']])
 offsets={};off=0
 for i,stride in sorted(streams.items()):offsets[i]=off;off=(off+count*stride+15)//16*16
 def channel(i,dim):
  c=channels[i]
  if not c['dimension']:return [0]*(count*dim)
  fmt=c['format'];out=[]
  for n in range(count):
   pos=offsets[c['stream']]+n*streams[c['stream']]+c['offset'];values=struct.unpack_from('<'+{0:'f',1:'e',2:'B',3:'B',4:'I'}[fmt]*c['dimension'],raw,pos)
   if i==2:values=[round(x*255) if fmt in (0,1) else x for x in values]
   out.extend(values[:dim])
  return out
 idxraw=bytes.fromhex(m['m_IndexBuffer']);indices=[];groups=[]
 for sub in m['m_SubMeshes']:
  if sub['topology']!=0:raise ValueError('Unsupported topology')
  idx=struct.unpack_from('<'+'H'*sub['indexCount'],idxraw,sub['firstByte']);groups.append([len(indices),len(idx)]);indices.extend(idx)
 return {'positions':channel(0,3),'uv':channel(3,2),'uv1':channel(4,2) if channels[4]['dimension'] else channel(3,2),'colors':channel(2,4) if channels[2]['dimension'] else [],'indices':indices,'groups':groups}
