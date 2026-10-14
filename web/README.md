# Puppet War browser rewrite

A playable, browser-native **first slice**, using Three.js and assets recovered
from the original APKs and VR 2.0.1. This is not a Unity WebGL recompile or a complete campaign port.

## Run

From the repository root:

```sh
npm --prefix web ci
npm --prefix web run dev
```

Open http://127.0.0.1:5173. No Unity editor or Android emulator is required.
The app uses local assets; it does not need a CDN or a service account.

For a production build:

```sh
npm --prefix web run build
npm --prefix web run preview
```

Preview: http://127.0.0.1:4173. `web/dist/` is the deployable static directory.
The relative build base supports hosting under a subdirectory. Use HTTPS for
remote hosting so the browser's Gamepad API is available. Localhost is supported.
Nothing has been published to an external website.

## Play and controllers

- Keyboard: WASD/arrows move, mouse looks, left-click/Ctrl fires, right-click aims,
  R reloads, Q switches weapons, T teleports to a targeted cyan marker, Space jumps, Esc/P pauses.
- Generic standard gamepad: left stick moves, right stick looks, right trigger
  fires, left trigger aims, button 2 reloads, button 3 switches, button 0 jumps,
  button 9/Start pauses. D-pad navigates menus; button 0 confirms. In settings,
  left/right adjusts a focused select or slider, up/down moves between controls.
- Touch: two independent sticks and fire, aim, reload, switch, teleport and jump buttons.
  Automatically shown on coarse-pointer devices; can be forced on in Settings.
- Settings offers remapping of every gamepad action and movement/look axis,
  sensitivity, invert Y, and a deadzone slider. Bindings are saved locally.
- The Legacy Unity profile retains joystick buttons 0/1/2/3 for Fire1/Fire2/Fire3/
  Jump from the recovered InputManager. Fire2 -> aim and Fire3 -> reload are web
  interpretations. The APK's FirstPersonControl gameplay actually consumed its
  custom touch controls, so these settings alone do not prove physical-controller
  support in the original shipping app.
- Press a controller button after opening the page. Detection depends on what
  the browser and OS expose. Custom devices may need remapping. Optional vibration
  failure does not interrupt play. Disconnecting a controller pauses the game.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API

## Visible errors

The **Diagnostics** button is always available. Exceptions, console errors, and unhandled promise
rejections automatically open a report containing the time, message, stack,
current game phase, episode, and relevant asset URL/operation. Gameplay pauses.
Copy the report or download JSON to share it. Duplicate errors are counted, and
history is capped at 50 unique errors so a broken frame cannot grow memory forever.

Asset HTTP errors, texture/image timeouts, audio decode failures, blocked controller
access, WebGL initialization/context loss, and local storage failures are handled.
An optional unavailable vibration actuator is intentionally nonfatal.

For a deliberate diagnostic check, run this in the browser console:

```js
window.puppetDiagnostics.test()
```

`window.puppetDebug.getState()` returns a read-only snapshot for bug reports.
Production builds retain readable function names and source maps for debugging.
Reports are kept in memory only; nothing is uploaded automatically. Copy/download
before reloading, since reloading starts a fresh diagnostic session.

## Implemented

Four arenas with selectable day/night variants, nine weapons, the recovered enemy roster and skeletal
animations, fish/chicken/cake sprite projectiles, distinct enemy AI, animated
first-person attacks and reloads, scenery damage, music, original VR survival
and expanded survival, generic controls, local best score and diagnostics.

Choose Full arsenal or Original VR random trio in the menu. Enter VR becomes
available in compatible WebXR headset browsers. Desktop play remains available.

See [VR content, controls, source references and fidelity limits](../docs/vr-port.md).
The browser implementation uses simplified collision, particles, pickup art and
navigation; complete campaigns, original saves and physical headset behavior
are not verified.

## Asset conversion

```sh
.tools/asset-env/bin/python scripts/export_web_assets.py
.tools/asset-env/bin/python scripts/export_vr_worlds.py
.tools/asset-env/bin/python scripts/export_arena_variants.py
.tools/asset-env/bin/python scripts/export_vr_weapons.py
.tools/asset-env/bin/python scripts/export_pickups.py
```

To regenerate only the character rig and clips:

```sh
.tools/asset-env/bin/python scripts/export_puppet_rig.py
```

The rig exporter uses the normal enemy's actual Animation/SkinnedMeshRenderer
references, preserves bone order, weights and mesh-relative bind matrices, and
resolves every clip path against that hierarchy. Quaternion, position and scale
curves are resampled with the original Hermite slopes at 60 Hz, including exact
source key times. Each character gets an independent skeleton/mixer, animation
crossfades, current-pose raycast bounds, and explicit resource cleanup. Missing clips
or invalid bindings throw into the visible Diagnostics panel. Pause freezes bones
and death timers as well as gameplay. First-person sprite clips are exported separately from the original weapon prefabs.

The converter uses PyYAML from the project-local environment established during
recovery. It preserves duplicate Unity `data` mapping entries, decodes Unity 3.5
uncompressed interleaved vertex streams, UV0/UV1, and triangle strips, and exports
selected active world layers. It deliberately does not execute recovered scripts.
Unsupported mesh layouts fail visibly or appear in the JSON warnings array.

Sources remain unchanged under `recovered/episode-{1,2}/` and `recovered/vr-2.0.1/`. Converted files in
`web/public/assets/` come from those APKs, not newly generated substitute art.
Original game content ownership is unchanged by this technical conversion.

## Verify

```sh
npm --prefix web test
npm --prefix web run build
# Keep production preview running in another terminal, then:
node web/tests/browser-integration.mjs
node web/tests/browser-animation.mjs
```

The browser checks require installed Google Chrome, use an isolated headless
profile, and test both scenes, simulated gamepad inputs and an aimed combat kill, pause/disconnect, keyboard,
touch, animated combat, frozen pause poses, visible rejected promises, report downloads, and failed initial asset loads.
Screenshots go to `artifacts/`. Controller hardware itself has not been tested.

Code boundaries: `input.js` normalizes controls; `simulation.js` owns gameplay state;
`world.js` loads recovered assets; `puppet-animation.js` skins and animates puppets; `main.js` coordinates rendering/UI/audio;
`diagnostics.js` owns error reporting and persistence fallbacks.
