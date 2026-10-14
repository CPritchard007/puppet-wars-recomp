"""Original player camera death and per-character victory audio."""
import json,sys,shutil
from pathlib import Path
import export_enemy_roster as r
from vr_assets import docs
from export_puppet_rig import sample_curve
r.documents=docs
out=r.OUT/'defeat';out.mkdir(exist_ok=True)
audio={}
def copy(key,p):
 target=out/p.name;shutil.copyfile(p,target);audio[key]='assets/defeat/'+target.name
for key,spec in r.ROSTER.items():
 d,o,t,g,root,nodes,paths,ids=r.hierarchy(*spec[:2])
 refs=[v['LaughSound'] for k,v in d.values() if k=='MonoBehaviour' and g.get(v.get('m_GameObject',{}).get('fileID')) in ids and v.get('LaughSound',{}).get('guid')]
 if refs:copy(key+'Laugh',r.REFS[refs[0]['guid']])
base=r.ROOT/'recovered/episode-2/unity-project/ExportedProject/Assets'
copy('vampireLaugh',base/'Resources/sound/vampiresounds/vampire_laugh.wav')
copy('clownLaugh',base/'Resources/sound/soundsclown/clown_winning.wav')
# These forms have no separate WinJoy voice; retain the original crowd track.
d=r.doc(r.BASE/'Scenes'/r.STUDIO)
player=next(v for k,v in d.values() if k=='MonoBehaviour' and v.get('EnemyWinSound',{}).get('guid'))
copy('playerDeath',r.REFS[player['DieSound']['guid']]);copy('crowdLaugh',r.REFS[player['EnemyWinSound']['guid']])
for key in ['bat','kart']:audio[key+'Laugh']=audio['crowdLaugh']
(out/'audio.json').write_text(json.dumps(audio,indent=2))
clip=next(iter(docs(base/'AnimationClip/Default.anim').values()))[1]
pos=clip['m_PositionCurves'][0]['curve']['m_Curve'];rot=clip['m_RotationCurves'][0]['curve']['m_Curve'];duration=max(pos[-1]['time'],rot[-1]['time']);initial=sample_curve(pos,0,'xyz')
frames=[]
for time in [i/60 for i in range(int(duration*60)+1)]+[duration]:
 p=sample_curve(pos,time,'xyz');q=sample_curve(rot,time,'xyzw');frames.append({'time':time,'position':[p[i]-initial[i] for i in range(3)],'rotation':q})
(out/'camera.json').write_text(json.dumps({'source':'Player.ApplyDamageToPlayer → Default.anim','duration':duration,'frames':frames},separators=(',',':')))
