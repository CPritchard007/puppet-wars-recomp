import * as THREE from 'three';
// A floor's bounding box includes empty space around bent corridors. Test the
// actual triangles, including clearance for the puppet's feet at floor edges.
export function floorSupportsSpawn(meshes,floorY){
 const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
 return (x,z)=>[[0,0],[1,0],[-1,0],[0,1],[0,-1]].every(([dx,dz])=>{
  origin.set(x+dx,floorY+1,z+dz);ray.set(origin,down);ray.far=2;
  return ray.intersectObjects(meshes,false).some(hit=>Math.abs(hit.point.y-floorY)<.5);
 });
}
