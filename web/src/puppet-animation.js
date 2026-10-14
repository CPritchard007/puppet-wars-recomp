import * as THREE from 'three';

/** A template shares only immutable geometry/clips; every actor owns its skeleton. */
export function createPuppetTemplate(rig, geometry, materials) {
  rig={...rig,clips:{...rig.clips}};
  if (rig.version !== 1 || rig.bones.length !== rig.bindPoses.length) {
    throw new Error('Recovered puppet rig has invalid bone/bind-pose data');
  }
  const vertexCount = geometry.getAttribute('position').count;
  if (rig.geometry.skinIndices.length !== vertexCount * 4 || rig.geometry.skinWeights.length !== vertexCount * 4) {
    throw new Error('Recovered puppet skin does not match its mesh vertices');
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(rig.geometry.skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(rig.geometry.skinWeights, 4));
  const clips = {};
  for (const [state, clip] of Object.entries(rig.clips)) {
    const tracks = clip.tracks.map(track => {
      if (!rig.nodes[track.node]) throw new Error(`Unbound puppet animation: ${state}, node ${track.node}`);
      const Track = track.property === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
      return new Track(`rig_${track.node}.${track.property}`, track.times, track.values);
    });
    clips[state] = new THREE.AnimationClip(state, clip.duration, tracks);
  }
  // Reversible fall poses keep a zombie's temporary knockdown separate from death.
  clips.knockdown=clips.death.clone();clips.knockdown.name='knockdown';
  clips.recover=clips.death.clone();clips.recover.name='recover';
  for(const track of clips.recover.tracks){
    const size=track.getValueSize(),times=Array.from(track.times),values=Array.from(track.values);
    track.times=Float32Array.from(times.map(t=>clips.death.duration-t).reverse());
    track.values=Float32Array.from(times.flatMap((_,i)=>values.slice((times.length-1-i)*size,(times.length-i)*size)));
  }
  rig.clips.knockdown={source:'death1 (temporary fall)',loop:false};rig.clips.recover={source:'death1 (reverse recovery)',loop:false};
  for (const state of ['idle', 'run', 'attack', 'hit', 'death', 'celebrate']) {
    if (!clips[state]) throw new Error(`Required puppet animation is missing: ${state}`);
  }
  return { rig, geometry, materials, clips, create: variant => new PuppetActor(rig, geometry, materials[variant], clips) };
}

export class PuppetActor extends THREE.Group {
  constructor(rig, geometry, material, clips) {
    super();
    this.name = 'Animated puppet';
    this.rig = rig;
    this.disposed = false;
    this.state = null;
    this.hitVersion = 0;
    this.oneShotComplete = false;
    this.display = new THREE.Group();
    this.add(this.display);
    this.nodes = rig.nodes.map((node, index) => {
      const bone = new THREE.Bone();
      bone.name = `rig_${index}`; // Stable path-safe bindings, independent of legacy spaces.
      bone.position.fromArray(node.position);
      bone.quaternion.fromArray(node.rotation);
      bone.scale.fromArray(node.scale);
      return bone;
    });
    rig.nodes.forEach((node, index) => {
      (node.parent < 0 ? this.display : this.nodes[node.parent]).add(this.nodes[index]);
    });
    this.mesh = new THREE.SkinnedMesh(geometry, material.clone());
    this.mesh.name = 'Puppet skin';
    this.mesh.frustumCulled = false;
    this.nodes[rig.meshNode].add(this.mesh);
    this.updateMatrixWorld(true);
    const meshBind = this.mesh.matrixWorld.clone();
    const meshBindInverse = meshBind.clone().invert();
    // Unity stores inverse(boneBindWorld) * meshBindWorld. Three expects only
    // inverse(boneBindWorld); pass meshBind separately to preserve the original rig.
    const inverses = rig.bindPoses.map(values => new THREE.Matrix4().set(...values).multiply(meshBindInverse));
    this.skeleton = new THREE.Skeleton(rig.bones.map(index => this.nodes[index]), inverses);
    this.mesh.bind(this.skeleton, meshBind);
    this.mesh.normalizeSkinWeights();
    this.mixer = new THREE.AnimationMixer(this.display);
    this.actions = {};
    for (const [state, clip] of Object.entries(clips)) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(rig.clips[state].loop ? THREE.LoopRepeat : THREE.LoopOnce,
        rig.clips[state].loop ? Infinity : 1);
      action.clampWhenFinished = !rig.clips[state].loop;
      this.actions[state] = action;
    }
    this.onFinished = event => {
      if (event.action === this.actions[this.state]) this.oneShotComplete = true;
    };
    this.mixer.addEventListener('finished', this.onFinished);
    this.play('idle', 0);
    this.mixer.update(0);
    this.updateMatrixWorld(true);
    this.skeleton.update();
    // Normalize the *skinned ready pose*, not the T-pose mesh, exactly once.
    this.mesh.computeBoundingBox();
    const bounds = this.mesh.boundingBox.clone().applyMatrix4(this.mesh.matrixWorld);
    const height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height < 0.001) throw new Error('Recovered puppet rig produced invalid skinned bounds');
    const scale = 3.3 / height;
    this.display.scale.setScalar(scale);
    this.display.position.set(-(bounds.min.x + bounds.max.x) * scale / 2,
      -bounds.min.y * scale, -(bounds.min.z + bounds.max.z) * scale / 2);
    this.update(0);
  }

  play(state, fade = 0.12) {
    if (this.disposed || this.state === state || this.state === 'death') return;
    if (!this.actions[state]) throw new Error(`Unknown puppet animation state: ${state}`);
    if (this.state === 'hit' && !this.oneShotComplete && state !== 'death') return;
    const previous = this.actions[this.state];
    const next = this.actions[state];
    this.state = state;
    this.oneShotComplete = false;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (previous && fade > 0) next.crossFadeFrom(previous, fade, false);
    else previous?.stop();
    // Apply a valid pose immediately; newly spawned actors never render in bind pose.
    this.mixer.update(0);
  }

  update(dt, state = this.state, hitVersion = this.hitVersion) {
    if (this.disposed) return;
    if (state === 'death') this.play('death', 0.08);
    else if (hitVersion !== this.hitVersion) {
      this.hitVersion = hitVersion;
      // A new hit can restart the reaction, but can never interrupt a death.
      if (this.state === 'hit') {
        this.actions.hit.reset().play();
        this.oneShotComplete = false;
      } else this.play('hit', 0.06);
    } else this.play(state);
    this.mixer.update(Math.max(0, dt));
    this.updateMatrixWorld(true);
    this.skeleton.update();
    // Raycasts must use the current deformed vertices, not stale bind-pose bounds.
    this.mesh.boundingBox = null;
    this.mesh.boundingSphere = null;
  }

  setEnemyId(id) { this.userData.enemyId = id; this.mesh.userData.enemyId = id; }

  snapshot() {
    const action = this.actions[this.state];
    return { state: this.state, source: this.rig.clips[this.state].source,
      time: action.time, bones: this.skeleton.bones.length,
      pose: this.nodes.map(node => node.quaternion.toArray()) };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.removeEventListener('finished', this.onFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.display);
    this.skeleton.dispose();
    this.mesh.material.dispose();
    this.removeFromParent();
  }
}
