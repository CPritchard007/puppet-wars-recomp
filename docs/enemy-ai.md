# Enemy behavior reconstruction

The web survival mode previously created three texture variants of one chase-only enemy. `web/src/enemy-ai.js` now gives enemies explicit types, independently timed states, damage reactions and attack phases. The behavior references below are in `recovered/episode-1/source/Assembly-UnityScript`; episode 2 includes the same AI families. Obsolete `Original`, `Test`, menu-only and duplicate versions are not separate enemy types.

| Web type | Recovered source | Behavior implemented |
| --- | --- | --- |
| Puppet | EnemyAI.cs: Patrol, StopCover, MoveTowardsPlayer, fight | Cover advance, pause at cover, close pursuit, 0.5-second attack windup, 1-second recovery, hit stagger |
| Runner | EnemyAI02Fast01.cs | Faster cover advance, acceleration after a hit, close attacks |
| Chicken/fish throwers | EnemyAI03Shoter.cs and scene Enemy04_ThrowChicken02 / Enemy02_ThrowFish02 | Stop to throw, different 3-/1-second shooting delays, move to another cover position, melee when approached |
| Soldier | EnemyAI03Shoter.cs: EnemySoldier branch | Two-shot attack, shorter initial windup, roll on hit, relocate |
| Bomber | EnemyAI04Suicidel.cs: fight | Approach, fuse/attack warning, close-range blast, self-removal; lethal hits interrupt detonation |
| Strong puppet | EnemyAI05Strong1.cs | Slow movement, larger body, higher durability and melee damage, cover pauses |
| Ninja | EnemyAI06NINJA.cs: Patrol, StopCover | Fast cover movement, jump transition, close attacks |
| Zombie | EnemyAI07Zombie.cs: ZombieFake; DamageReciver-Zombie.cs: DelayedDetonate | Slow direct advance, first lethal body hit causes a temporary fall/get-up, faster return, final death awards score |
| Trash thrower | EnemyAI8Trash.cs: Patrol, Shoot, InVisible | Stationary concealed/exposed shooting cycle, tomato projectile; designated StreetSet/LobbySet anchors only |
| Magician | EnemyAI10Magicion.cs: Magic, Dissapear, SuprisePlayer | Temporary protected size-changing cast, teleport to a valid nearby position, close attack, size expiration |
| Vampire | EnemyAI11Vempire.cs: TurnToBat, TurnToVampire | Alternating ground/flying form, transformation pause, faster elevated bat movement, attacks |
| Brute boss | EnemyAI08BossLite.cs: Shoot, MoveTowardsPlayer | Throws, shielded charge, punch, recovery/cover phases |
| Clown boss | EnemyAI11BossCLOWN-02.cs: Shoot, Defend, BlowFireBall, ChargePlayer | Double throws, timed shield, fireball windup, fast charge, recovery |
| Elf | EnemyAI03Shoter.cs / Enemy06_Elf | Ranged tomato throw and close melee |
| Kart driver | Enemy12CarSimplePath.cs: Patrol, fight, EscapeTowardsPatrol | Fast patrol, contact attack windup, disengagement to a patrol point before returning |

## Web adaptations

This reconstructs the principal combat patterns for the current survival arenas, not a byte-for-byte execution of Unity coroutines. The original campaign's spawners, difficulty tables, scene exits, scripted entrances and inventory power-up responses are not part of this survival simulation. Health, speed, reach and special-phase schedules are explicit web tuning; original scripts used differently scaled characters and per-level difficulty overrides.

Original `CoverPosition*` transforms are taken from the recovered scene and converted to world coordinates. A visibility graph around collider corners supplies collision-safe paths; it replaces the native navigation component. Invalid or unreachable cover points are rejected. Melee impact rechecks current distance and line of sight, allowing the player to dodge during the windup. Ranged projectiles lock a target at release, travel visibly, hit scenery, and apply damage at impact. Pause freezes AI, animations and projectiles. Reset disposes labels/effects and clears pending attacks.

Presentation now uses 17 original character models, including the separate vampire bat, with each AI type mapped to its original skin and dedicated animation clips. The yellow runner retains its smaller scale; the bomber uses the original blue bomb vest. Fish uses `throw_short`, chicken uses `throw_1`; fish finishes its throw before taking cover. Projectiles use the original transparent animated fish/chicken PackedSprite atlases, with a held sprite attached to the throwing hand and the flying sprite after release. Tomato artwork is also recovered; grenade/fireball/blast effects remain simplified geometry.

`scripts/export_enemy_roster.py` exports the original hierarchies, meshes, bind poses, material textures and animation curves. Optional animation tracks for absent source bones are recorded in `unusedSourcePaths`. The kart's scale accounts for its nonuniform parent; the clown's legacy RGBA4444 texture is decoded from the APK to preserve its original colors. Zombie uses its dedicated fall/get-up clips; vampire swaps to the original bat model. Type labels remain for clarity.

## Availability and verification

Wave 1 introduces the six studio roles. Wave 2 adds ninja/zombie/soldier; wave 3 expands the pool with magician/vampire/kart/elf. Trash uses a separate encounter trigger after 12 kills in either survival mode, only in arenas with designated anchors. Trash never uses random floor positions; only one is alive at a time, and hits/cake lures cannot move it. A source anchor is randomly selected; the recovered skeletal animation supplies the ducking motion, and a stationary trash encounter does not block expanded-wave progression. The increasing wave size brings the full pool into encounters. Every fourth wave includes a brute boss and every fifth includes a clown boss.

- `npm --prefix web test`: deterministic state transitions, windup dodge, cover routing, projectile collision/impact, bomber interruption, zombie revival, special phases, full roster availability, reset, animation, weapon and input regressions.
- `node web/tests/browser-enemies.mjs`: six live first-wave types, projectiles and pause in Chrome.
- `node web/tests/browser-integration.mjs`: both arenas, controller combat, keyboard/touch, animation, pause and diagnostics.

Mop combat correction: the original episode-1 `Melee-1.Start` gives the
unupgraded mop 50 damage, 5-unit reach, and a 0.6-second attack interval.
`FireOneShot` checks an overlap sphere with a forward dot threshold of 0.9,
then applies damage after the 0.1 + 0.2 second windup. The web mop now uses
that forward sweep and delayed impact instead of a single instant mesh ray.
It can hit multiple puppets, retains wall occlusion, and uses the recovered
07ShotSound/07ReloadSound hit/miss recordings. The existing Fire/AfterFire
sprite sequence remains intact. No upgrade stage is silently granted.

Fish hits now render the recovered `01EXplosion_FishScreenEffect` PackedSprite
(34 frames, original green tint) over the weapon canvas. This canvas is also
used by the VR weapon display. The splat is randomly rotated, retriggered on
another successful fish hit, and cleared after two seconds, matching
`PlayAnimationFishBK`. Misses and blocked throws do not trigger it.
Bomber detonation follows `Enemy03_Suicidel.ccExplode` →
`CentralController12 Explosion` → `Ehit_Sprite RPG`, using its 18-frame
`SpriteExplodeEffects` animation instead of the generic sphere. The effect
plays once and is removed after the source controller's one-second lifetime.

Gunner roll continuity: `ShooterSoldier_Roll` and `ShooterSoldier_ShootRoll`
contain sideways pelvis translation followed by a return to their starting
position. Runtime clips now use only the first 1.1-second roll and 1.5-second
shooting segment, with horizontal pelvis translation removed. The AI performs
a collision-aware four-unit roll over 1.1 seconds, keeps its facing fixed, and
continues from the resulting world position. Shooting bursts enter the same
roll state. Repeated hits damage the gunner without restarting its current roll.
Recovered animation JSON remains unchanged.

Expanded wave spawning now follows the APK `EnemySpawn.Spawn` coroutine's
one-at-a-time scheduling: wait between spawns, stop at the live-enemy cap,
and consume a pending entry only after a successful spawn. The coroutine
starts with a three-second wait; `GameManager` supplies stage-specific
`SpawnTime01..04` and `MaxEnemysOnScreen01..04` values. Its campaign values
vary by level, so this web survival adaptation retains the expanded wave
rosters/counts and uses the recovered survival cadence 3/2/2/1 seconds and
live caps 4/5/8/10 as waves advance. It does not claim campaign-wave parity.
Source spawn anchors are tried before valid random arena positions. Failed
placement retries after half a second without consuming the queued enemy.
The next wave waits for both the queue and active mobile enemies to clear;
the independent stationary trash encounter still cannot hold up a wave.
HUD counts distinguish active and incoming enemies. Pause freezes scheduling,
and restart clears the queue. Original VR survival keeps its existing source
progression and staggered spawner.


Trash recreation: `EnemyAI8Trash` starts patrol after 0.2 seconds, latches proximity at
100 units (serialized scene value), and plays the complete 4.566667-second
`Shootertrash_shoot` clip. `EnemyShootGrenade` releases four tomatoes at 1.0,
1.3, 1.8 and 2.3 seconds. Facing and distance-based launch speed/lift are selected
at attack start; projectiles use gravity, scenery collision and a three-second
lifetime. The launch position comes from the recovered `enemyPosition` bone.
`DamageReciver08Trash` supplies 100 base health and the original death animation;
nonlethal hits no longer restart shooting. The web survival health multiplier and
4-point damage remain web balancing, rather than campaign difficulty parity.

The renderer preserves this model's original root scale and origin instead of
normalizing its crouched pose to a standing puppet. Bin elevation is retained,
including on death. Town uses the three regional sets of bin coordinates from
`StreetSet.DefultCoverPoints/MoveCoverPoints`; lobby uses recovered scene anchors.
The existing 12-kill web survival trigger remains. Original attack, hit and death
sounds are exported with `scripts/export_trash_audio.py`. These changes do not
claim a complete port of campaign head damage, dismemberment or Unity physics.

Player defeat now mirrors `Player.ApplyDamageToPlayer` and `EnemysWinBroadcast`:
play the recovered `Default` camera collapse, hide the weapon, and broadcast victory
to surviving puppets with the source's randomized 0–1 second start delay. Victory
animation/audio continue after combat stops; no further attacks or spawns occur.
`LaughSound` assignments come from each serialized enemy; vampire/clown use their
script-loaded clips. Bat/kart forms, which lack a separate victory voice, use the
original crowd victory recording. Specialized rigs retain their recovered celebration
clips rather than receiving an invented humanoid rig. Victory audio stops on restart
or arena/menu changes. Corpse lifetime follows the actual death-clip duration.
