#!/usr/bin/env python3
"""Convert Unity 3.5 uncompressed mesh streams and static scene hierarchy for the web slice.
Requires PyYAML. Does not convert MonoBehaviour logic or shaders. Puppet skin animation is exported separately.
"""
import json, re, shutil, struct
from pathlib import Path
import yaml
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'web/public/assets'
class UnityLoader(yaml.SafeLoader):
    pass

def unity_mapping(loader,node):
    result={}
    for key,value in node.value:
        k=loader.construct_object(key,deep=True);v=loader.construct_object(value,deep=True)
        if k=='data':result.setdefault(k,[]).append(v)
        else:result[k]=v
    return result
UnityLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,unity_mapping)

def documents(path):
    text=path.read_text()
    text=re.sub(r'(m_IndexBuffer:|_typelessdata:) ([0-9a-f]+)',r'\1 "\2"',text)
    return {int(i):next(iter(yaml.load(body,Loader=UnityLoader).items())) for i,body in re.findall(r'--- !u!\d+ &(\d+)\n(.*?)(?=--- !u!|\Z)',text,re.S)}

def mesh(path):
    m=next(iter(documents(path).values()))[1]
    v=m['m_VertexData']; stream=v['m_Streams[0]']; mask=stream['channelMask']
    if m['m_MeshCompression']!=0 or not mask&1:raise ValueError(f'Unsupported mesh {path}')
    raw=bytes.fromhex(v['_typelessdata']); stride=stream['stride']; offset=stream['offset']
    # Unity 3.5 channel order: position, normal, color, uv0, uv1, tangent.
    uv_offset=12+(12 if mask&2 else 0)+(4 if mask&4 else 0)
    positions=[];uv=[];uv1=[];colors=[]
    for i in range(v['m_VertexCount']):
        start=offset+i*stride
        positions.extend(struct.unpack_from('<3f',raw,start))
        if mask&4:colors.extend(raw[start+12+(12 if mask&2 else 0):start+16+(12 if mask&2 else 0)])
        uv.extend(struct.unpack_from('<2f',raw,start+uv_offset) if mask&8 else (0,0))
        uv1.extend(struct.unpack_from('<2f',raw,start+uv_offset+(8 if mask&8 else 0)) if mask&16 else (0,0))
    index_raw=bytes.fromhex(m['m_IndexBuffer']);indices=[];groups=[]
    for sub in m['m_SubMeshes']:
        idx=struct.unpack_from('<'+'H'*sub['indexCount'],index_raw,sub['firstByte']);begin=len(indices)
        if sub.get('isTriStrip',0):
            for i in range(len(idx)-2):
                a,b,c=idx[i:i+3]
                if len({a,b,c})==3:indices.extend((b,a,c) if i%2 else (a,b,c))
        else:indices.extend(idx)
        groups.append([begin,len(indices)-begin])
    assert not indices or max(indices)<v['m_VertexCount']
    return dict(positions=positions,uv=uv,uv1=uv1,colors=colors,indices=indices,groups=groups)

def export(episode, scene_name, target_key=None):
    base=ROOT/f'recovered/episode-{episode}/unity-project/ExportedProject/Assets'
    target=OUT/(target_key or f'episode-{episode}');target.mkdir(parents=True,exist_ok=True)
    refs={}
    for p in base.rglob('*.meta'):
        match=re.search(r'^guid: (\w+)',p.read_text(),re.M)
        if match:refs[match[1]]=p.with_suffix('')
    data={'sourceScene':scene_name,'nodes':[],'meshes':{},'materials':{},'warnings':[]}
    def texture(guid):
        p=refs.get(guid)
        if not p or p.suffix.lower()!='.png':return None
        name=guid+'.png'
        if episode==1 and p.stem=='Sprite RainBow':
            from legacy_texture import export_rainbow
            export_rainbow(ROOT,target/name)
        else:shutil.copyfile(p,target/name)
        return str((target/name).relative_to(OUT.parent))
    def material(guid):
        if guid in data['materials']:return guid
        p=refs.get(guid)
        if not p:return None
        m=next(iter(documents(p).values()))[1];props=m.get('m_SavedProperties',{})
        tex=None;lightmap=None;scale=[1,1];offset=[0,0]
        for t in props.get('m_TexEnvs',{}).get('data',[]):
            # Legacy Unity uses first/second pairs, newer exports use property keys.
            name=t.get('first',{});name=name.get('name') if isinstance(name,dict) else name
            name=name or next(iter(t))
            val=t.get('second',t.get(name,{}))
            if name=='_LightMap':lightmap=texture(val.get('m_Texture',{}).get('guid'))
            if name=='_MainTex':
                tex=texture(val.get('m_Texture',{}).get('guid'))
                scale=[val.get('m_Scale',{}).get(a,1) for a in ['x','y']]
                offset=[val.get('m_Offset',{}).get(a,0) for a in ['x','y']]
        shader_path=refs.get(m.get('m_Shader',{}).get('guid'))
        shader=shader_path.read_text() if shader_path else ''
        vertex_blend='Shader "Transparent/Vertex Colored"' in shader
        tint=[1,1,1,1]
        if vertex_blend:
            for c in props.get('m_Colors',{}).get('data',[]):
                if c.get('first',{}).get('name')=='_Color':
                    tint=[c['second'][a]*(2 if a!='a' else 1) for a in ['r','g','b','a']]
        data['materials'][guid]={'vertexBlend':vertex_blend,'tint':tint,'name':m.get('m_Name'),'texture':tex,'lightmap':lightmap,'scale':scale,'offset':offset}
        return guid
    def export_mesh(guid):
        if guid not in data['meshes']:
            p=refs.get(guid)
            if not p:return None
            data['meshes'][guid]=mesh(p)
        return guid
    docs=documents(base/'Scenes'/scene_name)
    objects={i:d for i,(k,d) in docs.items() if k=='GameObject'}
    transforms={i:d for i,(k,d) in docs.items() if k=='Transform'}
    bygo={}
    for i,(k,d) in docs.items():
        if 'm_GameObject' in d:bygo.setdefault(d['m_GameObject']['fileID'],{})[k]=d
    def active(i):
        t=transforms[i];parent=t['m_Father']['fileID']
        return bool(objects[t['m_GameObject']['fileID']]['m_IsActive']) and (not parent or active(parent))
    for i,t in transforms.items():
        go=objects[t['m_GameObject']['fileID']];comps=bygo.get(t['m_GameObject']['fileID'],{})
        n=dict(id=i,name=go['m_Name'],parent=t['m_Father']['fileID'],active=active(i),layer=go['m_Layer'],
            position=list(t['m_LocalPosition'].values()),rotation=list(t['m_LocalRotation'].values()),scale=list(t['m_LocalScale'].values()))
        mr=comps.get('MeshRenderer');mf=comps.get('MeshFilter')
        if n['active'] and go['m_Layer'] in (0,12,13,14) and mr and mf and mr['m_Enabled']:
            guid=mf['m_Mesh'].get('guid')
            if guid:
                try:n['mesh']=export_mesh(guid);n['materials']=[material(m.get('guid')) for m in mr['m_Materials']]
                except (ValueError,KeyError) as e:data['warnings'].append(str(e))
        bc=comps.get('BoxCollider')
        if n['active'] and bc and bc['m_Enabled'] and not bc['m_IsTrigger'] and go['m_Layer'] in (0,12,13,14):
            n['collider']={'size':list(bc['m_Size'].values()),'center':list(bc['m_Center'].values())}
        data['nodes'].append(n)
    # Puppet skin and animations are shared via assets/puppet-rig.json.
    for name in ['puppetkid_UV_01.png','puppetkid_UV_01pink.png','puppetkid_UV_01green.png','01_Gun Idle.png','01_Gun Fire.png','01_Gun Reload 01.png','03sG_Gun Idle.png','03sG_Gun Fire.png','03sG_Gun Reload 01.png']:
        shutil.copyfile(base/'Texture2D'/name,target/name)
    for name,path in {'shot.wav':'Resources/sound/01ShotSound.wav','reload.wav':'Resources/sound/01ReloadSound.wav','shotgun.wav':'Resources/sound/03ShotSound.wav','hurt.wav':'AudioClip/hero_hurt01.wav','hit.wav':'AudioClip/puppet_hit10_good.wav','pickup.wav':'AudioClip/pickup_Ammo.wav'}.items():
        shutil.copyfile(base/path,target/name)
    (target/'scene.json').write_text(json.dumps(data,separators=(',',':')))
    print(f'Episode {episode}: {len(data["meshes"])} meshes, {len(data["materials"])} materials, {sum(bool(m["texture"]) for m in data["materials"].values())} textures, warnings: {data["warnings"]}',flush=True)

if __name__=='__main__':
    export(1,'05 Levels.unity')
    export(2,'20_Level_Lobby.unity')

    from export_puppet_rig import export_rig
    export_rig()

    from export_weapon_sprites import export_weapons
    export_weapons()

    from export_enemy_roster import export_roster
    export_roster()
