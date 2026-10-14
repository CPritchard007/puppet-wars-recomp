# VR 2.0.1 recovery and web integration

Source: `Puppet_War_VR_2.0.1_Android_4.4.apk`, Unity 5.6.1f1.
Extraction hashes and assembly counts are in `recovered/vr-2.0.1/manifest.json`.
Standalone decompilation recovered 430 C# files across four game assemblies.
AssetRipper exported the Unity project under `recovered/vr-2.0.1/unity-project/ExportedProject`.
The supplied APK is unchanged.

## Playable content found

The build settings contain seven scenes: splash, VR menu, survival statistics,
and four playable arenas. The town is `14 Level_StreetNIGHT`, not another lobby.

| Web arena | Original scene | Recovered teleport destinations |
| --- | --- | --- |
| Studio | `05 Levels` | 9 |
| Lobby | `20_Level_Lobby` | 10 |
| Town at night | `14 Level_StreetNIGHT` | 11 |
| Parking lot at night | `31_Level_ParkingLot_Night` | 11 |

World geometry, UVs, textures, baked lightmaps, transform hierarchies, box
colliders, enemy spawn points and teleport positions come from these scenes.
Some teleport destinations may be filtered if they overlap the web collision bounds.

`loadlevel.ButtonPress` selects six weapons, arranged as a three-slot loadout:
AK-47 (60%) or flamethrower (40%); katana or leaf blower (50/50); dynamite cake
or red button (50/50). Those six resource prefabs and their animation atlases
are shipped. Other legacy weapon classes are retained in the assemblies, but
that does not establish that their corresponding art or gameplay is available
in this VR release.

The menu supports both that random trio and all nine web weapons (the original
web pistol, shotgun and mop remain available). The six additions use recovered
idle, attack, reload where supplied, windup and release frames and weapon audio.
Katana alternates the two original strikes. Cake uses the original projectile
sprite, delayed release, lure, fuse and blast. The red button has delayed
activation and independent recharge. Original game/night/death music is included.

## Encounters and controls

Original VR survival follows `GameManager.SurvivalLevel` and
`SurvivalLevelChapterTwo`: spawn thresholds 10, 40 and 90, stage-specific live
caps, intervals and enemy pools. Studio uses the first six enemies; town adds
ninja and zombie; lobby adds magician and soldier; parking adds vampire.
Trash throwers use the separate StreetSet/LobbySet spawn lists, not the roaming enemy pool. Their fixed bin/ambush anchors are preserved. No additional enemy AI class was found beyond the already recovered roster.
Expanded survival retains the web build's wider roster and wave rules.

The modern WebXR path replaces the obsolete Android VR SDK. It includes stereo
rendering, tracked head/controller aim, trigger fire, automatic target fire,
gaze dwell actions, source-position teleporting, six-second teleport cooldown,
headset weapon/HUD rendering and pause/resume/restart/exit actions. A supported
headset browser enables Enter VR. HTTPS is required for remote immersive use;
localhost supports development. Desktop play works when WebXR is unavailable.

Aim at a cyan destination and press T, mapped gamepad teleport (default button
4), or touch TELEPORT. In VR, dwell for one second. HUD actions use approximately
0.67-second dwell. Generic gamepad remapping, keyboard/mouse, touch, diagnostics,
and pause on controller disconnect remain available.

## Fidelity boundaries

This is a browser-native gameplay port, not execution of the recovered Unity
assemblies. It does not establish complete pixel or physics parity:

- World box collision uses axis-aligned bounds. Destructible props use the eight
  recovered damage sprites; collision is removed after full destruction, rather
  than reproducing every partial collider and detached debris effect.
- AI is the existing source-informed browser reconstruction. Damage effects, lighting, blast visuals and navigation use web equivalents. Pickups use the original animated atlas: yellow money star, cream/red-cross medkit and green ammunition box.
- The original VR menu/statistics are represented by the web menu and run summary.
  Legacy campaign/store/upgrade code is not a newly playable campaign in this APK
  and has not been presented as one. Original save files are not imported.
- WebXR session plumbing and gaze rules are implemented, but physical headset
  tracking, controller layout, comfort and performance require hardware testing.
  Automated gamepad tests use a simulated standard controller.

## Reproduce

```sh
python3 scripts/decompile_vr.py
# Use AssetRipper to load recovered/vr-2.0.1/apk and export into the path above.
.tools/asset-env/bin/python scripts/vr_assets.py
.tools/asset-env/bin/python scripts/export_vr_worlds.py
.tools/asset-env/bin/python scripts/export_vr_weapons.py
npm --prefix web test
npm --prefix web run build
```

The legacy exporters remain prerequisites for the existing character roster and
three original web weapons. Exporters fail on unsupported mesh layouts instead
of silently replacing them with placeholder geometry.

With preview running on port 4173, from `web/`:

```sh
node tests/browser-vr-content.mjs
node tests/browser-vr-weapons.mjs
node tests/browser-integration.mjs
```

These check all four worlds, six new weapon animations/ammo/special recharge,
original VR spawning, random loadout, prior controller/combat behavior, and
visible error reporting. Screenshots are saved in `web/artifacts/`.

Weapon effects: accepted shots emit a world-space flame stream using the recovered `fire.mat` texture, bullet tracers, or leaf-blower particles. Effects stop at scenery, freeze while paused, expire after release and are disposed on restart. Bullet trails are a browser visibility aid; the source machine gun resolves damage by raycast.

## Day and night selection

All four locations now expose Day/Night in the menu. Studio night (`12 Level_Night`),
lobby night (`22_Level_Lobby_Night`) and town day (`13 Level_Street`) are exported
from their owning packages (episode 1 for studio/town, episode 2 for lobby), including original geometry, materials and baked lighting. VR teleport/spawn anchors are carried across in set coordinates.
Cross-episode 32×32 placeholder textures are rejected; the full-resolution originals are used.
Parking day is a web reconstruction: the supplied packages contain only
`31_Level_ParkingLot_Night`, so its original geometry/albedo is rendered without
night lightmaps under a neutral daylight treatment. It is not a recovered day scene.

Regenerate these additions after the VR world export:
`.tools/asset-env/bin/python scripts/export_arena_variants.py`.
`node tests/browser-arena-variants.mjs` checks all eight variants.

Pickup assets are regenerated with `.tools/asset-env/bin/python scripts/export_pickups.py`. Money stars award 35 points (60 for strong puppets); medkits restore 20 health up to 100. Existing periodic ammo/health supplies remain in addition to money drops.

Specialist projectiles use recovered snowball (elf), tomato (soldier/gunner), bomb (brute) and animated gift (clown) atlases. Missing projectile registrations report an error rather than rendering an untextured substitute. Regenerate with `scripts/export_specialist_projectiles.py` or the full enemy exporter.

Weapon idle playback preserves the original PackedSprite `loopReverse` flag.
All seven animated weapon idles play forward and backward without repeating
endpoints; cake and red button retain their single ready frame. Both weapon
exporters retain this setting, and the shared desktop/VR frame sampler uses it.

The large Leaf Blower no longer emits the web-added white particle clouds.
Recovered `Vulcangun.FireOneShot` uses the blower sprite and hit logic, not a
smoke emitter. Its original firing animation, damage and push remain intact;
AK-47 tracers and flamethrower particles stay separate.
