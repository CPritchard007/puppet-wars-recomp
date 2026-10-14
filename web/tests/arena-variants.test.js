import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {ARENAS,arenaScene} from '../src/arenas.js';
test('all eight arena variants contain renderable assets and encounter metadata',()=>{
 for(const arena of ARENAS)for(const period of (arena.periods||['day','night'])){const data=JSON.parse(readFileSync(new URL('../public/'+arenaScene(arena,period),import.meta.url)));assert.ok(data.nodes.some(n=>n.mesh));assert.ok(data.spawnPoints.length);assert.ok(data.teleports.length);assert.deepEqual(data.warnings,[]);for(const m of Object.values(data.materials))for(const url of [m.texture,m.lightmap].filter(Boolean)){const path=new URL('../public/'+url,import.meta.url);assert.ok(existsSync(path),url);const png=readFileSync(path);assert.ok(png.readUInt32BE(16)>32&&png.readUInt32BE(20)>32,`Placeholder texture: ${url}`);}}
});

test('studio trees retain their own eight damage states in both lighting variants',()=>{
 const studio=ARENAS.find(a=>a.key==='studio');
 for(const period of ['day','night']){
  const data=JSON.parse(readFileSync(new URL('../public/'+arenaScene(studio,period),import.meta.url)));
  const trees=data.nodes.filter(n=>n.mesh&&/^Tree/.test(n.name)&&!n.name.includes('Shadow'));
  assert.equal(trees.length,6,period);
  for(const tree of trees){
   assert.ok(tree.destructible,`${period}: ${tree.name} must be destructible`);
   assert.equal(tree.destructible.uv.length,8);
   assert.ok(tree.destructible.health.every(h=>h>0));
   assert.ok(tree.destructible.uv.every(rect=>rect.length===4&&rect.every(Number.isFinite)));
   assert.notDeepEqual(tree.destructible.uv[0],tree.destructible.uv[6]);
  }
 }
});
