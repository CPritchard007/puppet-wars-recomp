# Puppet War FPS recovery

The playable browser build now includes the VR 2.0.1 release's four arenas
(studio, lobby, town at night and parking), six additional weapons/specials,
original VR survival progression and a WebXR entry point. Generic remappable
gamepads, keyboard/mouse, touch and visible error diagnostics remain supported.

Run `npm --prefix web run dev` and open http://127.0.0.1:5173.
See [web instructions](web/README.md) and the [VR recovery and fidelity notes](docs/vr-port.md).
Physical headset testing and full original campaign parity are not established.

## Recovered files

For each episode under `recovered/episode-1` and `recovered/episode-2`:

- `apk/`: extracted original APK, including the original managed DLLs and Unity data.
- `source/`: ILSpy C# output for the four `Assembly-*.dll` game assemblies, with logs.
- `unity-project/ExportedProject/`: AssetRipper reconstruction of scenes, assets,
  scripts, and project settings. Open this directory as the project, not the APK folder.
- `unity-project/AuxiliaryFiles/`: additional recovery output where provided by AssetRipper.

The original APKs are unchanged. `recovered/manifest.json` records their SHA-256
checksums and decompilation counts. `recovered/asset-recovery.log` records the asset
export, including errors; a completed export does not establish a working Unity project.

## Tools and reproduction

Local tools are in `.tools/` (not application dependencies): ILSpy CLI 8.2.0.7535
and AssetRipper 2.0.0 for macOS ARM64. ILSpy uses the installed .NET runtime.

To install ILSpy into the workspace:

```sh
DOTNET_CLI_HOME="$PWD/.tools/dotnet-home" NUGET_PACKAGES="$PWD/.tools/nuget" dotnet tool install ilspycmd --version 8.2.0.7535 --tool-path .tools/bin
```

To repeat extraction and standalone C# decompilation:

```sh
python3 scripts/decompile.py
```

This rewrites recovery output; preserve any manual edits first.

To reproduce the Unity asset export, run:

```sh
.tools/assetripper/AssetRipper.GUI.Free --headless --port 57432 --log-path .tools/assetripper-recovery.log
```

Open `http://127.0.0.1:57432`, load one episode's `apk/` folder, and export a Unity
project to a new empty directory. Reset before loading the other episode.
AssetRipper: https://github.com/AssetRipper/AssetRipper

## Alternative: compiling the original Unity projects for WebGL

Both packages identify Unity **3.5.2f2** and contain Android ARMv7 native Unity/Mono
libraries. Those native binaries cannot be served as a browser application.
The reconstructed project must be repaired and migrated to a Unity version with
WebGL support, then built with that editor's WebGL module.

No Unity editor or WebGL build module was found in `/Applications` during recovery.
A compatible installed and licensed editor is needed to compile, inspect scene
migration, and test gameplay. Installing only the .NET SDK is insufficient.

Known source issues to address during migration:

- Decompiled UnityScript is C# output, not guaranteed compilable source. For example,
  `FireButton` contains a field also named `FireButton`, which is illegal in C#.
  Renaming serialized members requires preserving scene/prefab bindings.
- Scripts use legacy `GUITexture`, `Application.LoadLevel`, and other older Unity APIs.
- Touch-driven controls need browser-compatible mouse/keyboard and touch handling.
- Store/purchase and mobile service integration must be audited for WebGL support.
- AssetRipper used dummy shader export; original shader behavior was not recovered.
  Shaders must be replaced or reconstructed. Materials, serialized scenes, and
  script references require editor validation.
- AssetRipper reported a metadata-stream error during script export. Independent
  ILSpy outputs in `source/` completed successfully and are retained for comparison.

Next validation gates: compile the migrated scripts; verify every enabled scene in
`EditorBuildSettings.asset`; test menus, movement, firing, enemies, progression,
audio, and saves; then produce and serve an actual WebGL build for browser testing.

Unity WebGL build documentation:
https://docs.unity3d.com/560/Documentation/Manual/webgl-building.html

Weapon sprites now use recovered PackedSprite UVs and frame placement: pistol fire/three reload stages, shotgun fire/pump/four reload stages, and mop swing/recovery. Q or the mapped controller switch button cycles pistol → shotgun → mop. Mop is unlimited melee and has no reload. Regenerate with `.tools/asset-env/bin/python scripts/export_weapon_sprites.py`; browser check: `node web/tests/browser-weapons.mjs`.

Scenery texture recovery: the original Unity 3.5 Android `Sprite RainBow` payload uses RGBA4444 nibble order despite format ID 2. Modern readers decode it as ARGB4444, shifting colors and alpha (purple sun/yellow transparent regions). `scripts/legacy_texture.py` decodes its original APK bytes during asset export; no chroma key or artwork recoloring is used. Asset export now additionally requires `UnityPy==1.25.4` and Pillow in `.tools/asset-env`. Check the decoder with `.tools/asset-env/bin/python scripts/test_legacy_texture.py`.

Enemy AI now uses distinct archetypes and recovered cover points, with ranged attacks, bombers, hit reactions, zombie revival and specialist/boss phases. See [behavior sources, adaptations and checks](docs/enemy-ai.md). All 16 combat archetypes now have their original models, skins and behavior clips, plus the vampire’s separate bat model. Fish/chicken throws use the original animated transparent sprite artwork. Full original campaign scripting is still separate work.
