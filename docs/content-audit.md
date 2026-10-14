# Recovered content audit

Compared the episode-1 and episode-2 `Assets/Scenes`, weapon prefabs and
`Assembly-UnityScript` sources with the web arena/weapon registries. The VR
package contains only four arena scenes and six selectable weapon prefabs;
it is not a complete inventory of the mobile releases.

## Added in this pass

| Content | Original source | Web behavior |
| --- | --- | --- |
| Snow / Christmas set | Episode 1, `27 Level_Xmas.unity` | Original scene, textures, seven spawn anchors; Christmas roster includes elf immediately |
| Corridor, day | Episode 2, `21_Level_Corridor.unity` | Original scene and twelve spawn anchors |
| Corridor, night | Episode 2, `23_Level_Corridor_Night.unity` | Separate original night scene and lighting |
| Sniper rifle | Episode 2, `22 SniperRifle.prefab` and `PistolGun-Sniper.cs` | 10-round magazine, base damage 150, 0.8-second shot interval, original sprites/audio and 10° scope on aim; hold right mouse/LT rather than the mobile toggle |
| Dual Uzis | Episode 2, `21 UZI.prefab` and `21 UZI Left.prefab` | Both hands, two hit rays/tracers per accepted burst, original fire/reload/idle sprites and sounds |
| Submachine gun | Episode 1, `02 SubMG.prefab` | Automatic fire, original four reload segments and audio |
| M60 | Episode 1, `04 LmachineGun M60.prefab` | Automatic fire, original five reload segments and audio |
| Baseball bat | Episode 1, `08 BaseBat.prefab` | Delayed forward sweep, original swing/recovery and hit/miss sounds |
| Axe | Episode 1, `10 Axe.prefab` | Delayed forward sweep with narrower angle and higher damage; original sprites/audio |

New weapons use base upgrade damage/range/fire-rate settings from
`machinegun.Start`, `machinegun-UZIs.Start`, and `Melee-1.Start`; magazines and
reload time use the original script defaults. The upgrade/shop system is not
ported. Dual Uzis consume one shared magazine unit per pair, as the original
script does. Both original sprite prefabs are recovered; left-hand placement
is mirrored in the web overlay. Source idle reverse-loop settings are retained.
The original VR random trio stays unchanged; choose **Full arsenal** for the
new weapons, using Starting weapon or the existing switch control.

No separate Christmas night scene was found. Snow therefore exposes only its
original lighting, rather than inventing a night variant. Corridor exposes
both original variants. Pre-VR scenes have no VR teleport components; their
source spawn anchors also provide web teleport destinations.

## Character findings

Snow's source roster is grunt, small yellow runner, elf, fish thrower, bomber,
chicken thrower and strong puppet. All seven already have distinct recovered
models/AI in the web roster, but the elf was not connected to a snow arena.
Both web encounter modes now include it in the Christmas roster.

The corridor adds no confirmed unique enemy archetype to the existing roster.
Its scene includes ninja, zombie, magician, soldier and vampire in addition to
the basic cast. Numbering/spelling differs between scenes: SoldierShooter is
09 or 10, magician appears as Magic/Magicion, and vampire as Vempire/Vampire.
Do not count these aliases as newly discovered character types. BossLite02 and
ClownBoss02 are additional scene instances; their separate encounter scripts
have not been fully reproduced. This audit does not claim exact campaign or
boss-encounter parity.

## Confirmed content still unported

Weapon prefabs include Vulcan/minigun, RPG, chainsaw, light sword, nose pincers,
crossbow, frag and laughing grenades, laser gun, grenade launcher,
boxing gloves, taser, spray, energy drink, sentry gun and cape. Some names are
special abilities rather than guns. Their assets are recovered, but they need
individual combat/effect implementations; they are not exposed as working weapons.

Dedicated boss encounter scenes (`24_BossLite_StudioSet`,
`25_BossLite_LobbySet`, `26_BossClown_CorridorSet`, and
`28_ThreeBosses_LobbyNightSet`) reuse existing environments but have encounter
logic beyond the current survival modes. Store, cutscenes, campaign progression
and complete upgrades remain outside the playable survival port.

Export reproducibly with `scripts/export_missing_arenas.py` and
`scripts/export_extra_weapons.py` using `.tools/asset-env/bin/python`.
