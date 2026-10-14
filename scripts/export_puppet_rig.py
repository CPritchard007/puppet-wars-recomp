#!/usr/bin/env python3
"""Recover the normal puppet's original skin, bone order, bind matrices and clips.
Animation paths are resolved against the Animation component's actual hierarchy.
Unity's Hermite curves are sampled at 60 Hz, including exact source key times.
"""
import bisect
import json
import math
import re
from export_web_assets import ROOT, OUT, documents, mesh

CLIPS = {'run': 'run1', 'attack': 'attack1', 'hit': 'hit1',
         'death': 'death1', 'celebrate': 'winningJoy'}

def vector(value, axes):
    return [float(value[axis]) for axis in axes]

def sample_curve(keys, time, axes):
    times = [key['time'] for key in keys]
    i = bisect.bisect_right(times, time) - 1
    if i < 0:
        return vector(keys[0]['value'], axes)
    if i >= len(keys) - 1:
        return vector(keys[-1]['value'], axes)
    a, b = keys[i:i+2]
    span = b['time'] - a['time']
    t = (time - a['time']) / span
    result = []
    for axis in axes:
        av, bv = a['value'][axis], b['value'][axis]
        out_slope, in_slope = a['outSlope'][axis], b['inSlope'][axis]
        if not math.isfinite(out_slope) or not math.isfinite(in_slope):
            result.append(av)
        else:
            result.append((2*t**3-3*t*t+1)*av + (t**3-2*t*t+t)*span*out_slope
                          + (-2*t**3+3*t*t)*bv + (t**3-t*t)*span*in_slope)
    return result

def export_rig():
    base = ROOT/'recovered/episode-1/unity-project/ExportedProject/Assets'
    refs = {re.search(r'^guid: (\w+)', p.read_text(), re.M)[1]: p.with_suffix('')
            for p in base.rglob('*.meta')}
    docs = documents(base/'Scenes/05 Levels.unity')
    objects = {i: d for i, (kind, d) in docs.items() if kind == 'GameObject'}
    transforms = {i: d for i, (kind, d) in docs.items() if kind == 'Transform'}
    by_object = {d['m_GameObject']['fileID']: i for i, d in transforms.items()}
    root_id = next(i for i, t in transforms.items()
                   if objects[t['m_GameObject']['fileID']]['m_Name'] == 'Enemy00_Defult')
    nodes = []
    paths = {}
    def visit(i, path, parent):
        t = transforms[i]
        index = len(nodes)
        paths[path] = index
        nodes.append({'sourceId': i, 'name': objects[t['m_GameObject']['fileID']]['m_Name'],
                      'path': path, 'parent': parent,
                      'position': vector(t['m_LocalPosition'], 'xyz') if parent >= 0 else [0, 0, 0],
                      'rotation': vector(t['m_LocalRotation'], 'xyzw') if parent >= 0 else [0, 0, 0, 1],
                      'scale': vector(t['m_LocalScale'], 'xyz') if parent >= 0 else [1, 1, 1]})
        for child in t['m_Children']:
            ci = child['fileID']
            name = objects[transforms[ci]['m_GameObject']['fileID']]['m_Name']
            visit(ci, f'{path}/{name}' if path else name, index)
    visit(root_id, '', -1)
    id_to_index = {n['sourceId']: i for i, n in enumerate(nodes)}
    skins = [d for kind, d in docs.values() if kind == 'SkinnedMeshRenderer'
             and by_object[d['m_GameObject']['fileID']] in id_to_index]
    if len(skins) != 1:
        raise ValueError(f'Expected one normal puppet skin, found {len(skins)}')
    skin = skins[0]
    mesh_path = refs[skin['m_Mesh']['guid']]
    source_mesh = next(iter(documents(mesh_path).values()))[1]
    geometry = mesh(mesh_path)
    weights, indices = [], []
    bone_count = len(skin['m_Bones'])
    for vertex in source_mesh['m_Skin']:
        w = [float(vertex[f'weight[{i}]']) for i in range(4)]
        ids = [int(vertex[f'boneIndex[{i}]']) for i in range(4)]
        if abs(sum(w)-1) > 0.001 or any(i < 0 or i >= bone_count for i in ids):
            raise ValueError('Invalid skin weights or bone indices')
        weights.extend(w)
        indices.extend(ids)
    geometry['skinWeights'] = weights
    geometry['skinIndices'] = indices
    if len(weights) != len(geometry['positions'])//3*4:
        raise ValueError('Skin vertex count does not match geometry')
    # Unity bind poses transform mesh-local positions into each bone's local space.
    # Matrices are serialized row-major here; the runtime explicitly uses Matrix4.set.
    bind_poses = [[matrix[f'e{r}{c}'] for r in range(4) for c in range(4)]
                  for matrix in source_mesh['m_BindPose']]
    if len(bind_poses) != bone_count:
        raise ValueError('Bone/bind-pose count mismatch')
    rig = {'version': 1, 'sourceScene': 'episode-1/05 Levels.unity',
           'sourceRoot': 'Enemy00_Defult', 'sourceMesh': mesh_path.name,
           'nodes': nodes, 'geometry': geometry,
           'meshNode': id_to_index[by_object[skin['m_GameObject']['fileID']]],
           'bones': [id_to_index[b['fileID']] for b in skin['m_Bones']],
           'bindPoses': bind_poses, 'clips': {}}
    animation = next(d for kind, d in docs.values() if kind == 'Animation'
                     and d['m_GameObject']['fileID'] == transforms[root_id]['m_GameObject']['fileID'])
    attached = {refs[ref['guid']].stem for ref in animation['m_Animations']}
    for state, name in CLIPS.items():
        if name not in attached:
            raise ValueError(f'{name} is not attached to the recovered rig')
        clip = next(iter(documents(base/f'AnimationClip/{name}.anim').values()))[1]
        if clip['m_Compressed'] or clip.get('m_CompressedRotationCurves'):
            raise ValueError(f'Compressed animation is not supported: {name}')
        tracks = []
        duration = 0
        for source_key, prop, axes in [('m_PositionCurves', 'position', 'xyz'),
                                       ('m_RotationCurves', 'quaternion', 'xyzw'),
                                       ('m_ScaleCurves', 'scale', 'xyz')]:
            for curve in clip[source_key]:
                if curve['path'] not in paths:
                    raise ValueError(f'Unbound animation path in {name}: {curve["path"]}')
                keys = curve['curve']['m_Curve']
                end = keys[-1]['time']
                duration = max(duration, end)
                times = sorted({0, end, *(k['time'] for k in keys),
                                *(i/60 for i in range(math.ceil(end*60)) if i/60 < end)})
                values = []
                previous = None
                for time in times:
                    value = sample_curve(keys, time, axes)
                    if prop == 'quaternion':
                        length = math.sqrt(sum(x*x for x in value))
                        if length < 1e-8:
                            raise ValueError(f'Zero quaternion in {name}')
                        value = [v/length for v in value]
                        if previous and sum(a*b for a, b in zip(value, previous)) < 0:
                            value = [-v for v in value]
                        previous = value
                    if not all(math.isfinite(v) for v in value):
                        raise ValueError(f'Non-finite animation value in {name}')
                    values.extend(round(v, 9) for v in value)
                tracks.append({'node': paths[curve['path']], 'property': prop,
                               'times': times, 'values': values})
        rig['clips'][state] = {'source': name, 'duration': duration,
                              'loop': state in ('run', 'attack', 'celebrate'), 'tracks': tracks}
    # This character has no attached idle clip. Hold the original attack ready pose,
    # rather than borrow the unrelated vehicle "Idle" clip or show the bind pose.
    rig['clips']['idle'] = {'source': 'attack1 (ready pose)', 'duration': 1, 'loop': True,
                           'tracks': [{**t, 'times': [0, 1],
                                       'values': t['values'][:4 if t['property']=='quaternion' else 3]*2}
                                      for t in rig['clips']['attack']['tracks']]}
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT/'puppet-rig.json'
    path.write_text(json.dumps(rig, separators=(',', ':'), allow_nan=False))
    print(f'Exported {bone_count} weighted bones, {len(nodes)} transforms, '
          f'{len(rig["clips"])} animation states to {path.relative_to(ROOT)}')
    return rig

if __name__ == '__main__':
    export_rig()
