"""Export original PackedSprite rectangles and untrimmed placement for web weapons."""
import json,re,shutil
from export_web_assets import ROOT,OUT,documents

def export_weapons():
    base=ROOT/'recovered/episode-1/unity-project/ExportedProject/Assets'
    refs={}
    for p in base.rglob('*.meta'):
        match=re.search(r'^guid: (\w+)',p.read_text(),re.M)
        if match:refs[match[1]]=p.with_suffix('')
    target=OUT/'weapons';target.mkdir(exist_ok=True)
    for source,target_name in [('07ShotSound.wav','mop-hit.wav'),('07ReloadSound.wav','mop-miss.wav')]:
        shutil.copyfile(base/'Resources/sound'/source,target/target_name)
    weapons=[]
    for prefab in ['01 GunDE.prefab','03 ShootGun.prefab','07 MOP.prefab']:
        docs=documents(base/'Resources/wprefabs'/prefab);clips={}
        for _,(kind,v) in docs.items():
            if kind!='MonoBehaviour' or not v.get('textureAnimations'):continue
            go=v['m_GameObject']['fileID'];name=docs[go][1]['m_Name']
            renderer=next(d for k,d in docs.values() if k=='MeshRenderer' and d['m_GameObject']['fileID']==go)
            mat=next(iter(documents(refs[renderer['m_Materials'][0]['guid']]).values()))[1]
            tex=next(t['second']['m_Texture']['guid'] for t in mat['m_SavedProperties']['m_TexEnvs']['data'] if t['first']['name']=='_MainTex')
            path=refs[tex];shutil.copyfile(path,target/path.name)
            a=v['textureAnimations'][0]
            frames=[{'uv':[r[x] for x in ['x','y','width','height']], 'bounds':[tl['x'],tl['y'],br['x'],br['y']], 'texture':path.name} for r,tl,br in zip(a['frameUVs'],a['topLeftOffsets'],a['bottomRightOffsets'])]
            clips[name]={'fps':a['framerate'],'frames':frames,'loopReverse':bool(a.get('loopReverse'))}
        result={}
        for state in ['idle','fire','reload','switch']:
            selected=[c for name,c in sorted(clips.items()) if state in name.lower() and 'afterfire' not in name.lower()]
            if state=='fire':selected += [c for name,c in clips.items() if 'afterfire' in name.lower()]
            result[state]=[dict(frame,duration=1/c['fps']) for c in selected for frame in c['frames']]
        result['idleLoopReverse']=any(c['loopReverse'] for name,c in clips.items() if 'idle' in name.lower())
        weapons.append(result)
    (target/'animations.json').write_text(json.dumps(weapons,separators=(',',':')))
    print('Exported weapon frames:',[{k:len(v) for k,v in w.items() if isinstance(v,list)} for w in weapons])
if __name__=='__main__':export_weapons()
