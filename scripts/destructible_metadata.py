"""Read damage states from each prop's own scene components, never from its name."""
from collections import defaultdict

def attach_destructibles(data, documents):
    components = defaultdict(list)
    for kind, value in documents.values():
        if kind == 'MonoBehaviour' and 'm_GameObject' in value:
            components[value['m_GameObject']['fileID']].append(value)
    for node in data['nodes']:
        transform = documents.get(node['id'])
        if not transform or transform[0] != 'Transform':
            continue
        scripts = components[transform[1]['m_GameObject']['fileID']]
        damage = next((s for s in scripts if all(k in s for k in ('LefthitPoints', 'MiddlehitPoints', 'RighthitPoints'))), None)
        if damage is None or not damage.get('m_Enabled', 1):
            continue
        sprite = next((s for s in scripts if s.get('textureAnimations')), None)
        if sprite:
            node['destructible'] = {
                'health': [damage[k] for k in ('LefthitPoints', 'MiddlehitPoints', 'RighthitPoints')],
                'uv': [[a['frameUVs'][0][k] for k in ('x', 'y', 'width', 'height')] for a in sprite['textureAnimations']],
            }
