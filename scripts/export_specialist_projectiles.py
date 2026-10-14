"""Recover elf snowballs, soldier bombs and the clown's flaming gift projectile."""
import json
import export_enemy_roster as roster
from vr_assets import docs
roster.documents=docs
SPECS=[('fishSplat',roster.STUDIO,'01EXplosion_FishScreenEffect'),('bomberBlast',roster.STUDIO,'Ehit_Sprite RPG'),('tomato','31_Level_ParkingLot_Night.unity','GrenadeTomatoLobby'),('snowball','27 Level_Xmas.unity','GrenadeSnowBall'),('grenade',roster.ALL,'GrenadeBomb'),('fireball',roster.ALL,'ClownGiftFlameBall')]
def main():
 path=roster.TARGET/'manifest.json';manifest=json.loads(path.read_text())
 for key,scene,name in SPECS:manifest['projectiles'][key]=roster.export_projectile(key,scene,name)
 path.write_text(json.dumps(manifest,indent=2))
if __name__=='__main__':main()
