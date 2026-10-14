// Swept segment/AABB intersection shared by navigation, attacks and projectiles.
export function clearSegment(a,b,obstacles,radius=0){
  return !obstacles.some(box=>{
    let lo=0,hi=1;
    for(const axis of ['x','z']){
      const min=box[axis==='x'?'minX':'minZ']-radius,max=box[axis==='x'?'maxX':'maxZ']+radius;
      const delta=b[axis]-a[axis];
      if(Math.abs(delta)<1e-9){if(a[axis]<min||a[axis]>max)return false;continue;}
      let t0=(min-a[axis])/delta,t1=(max-a[axis])/delta;if(t0>t1)[t0,t1]=[t1,t0];
      lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return false;
    }
    return true;
  });
}
export function validPoint(p,bounds,obstacles,radius=.65){
  return p.x>bounds.minX+radius&&p.x<bounds.maxX-radius&&p.z>bounds.minZ+radius&&p.z<bounds.maxZ-radius&&clearSegment(p,p,obstacles,radius);
}
// Visibility graph routes around corners instead of pushing into the same wall.
export class EnemyNavigation{
  constructor(bounds,obstacles,coverPoints=[]){
    this.bounds=bounds;this.obstacles=obstacles;
    this.corners=obstacles.flatMap(b=>[b.minX-.85,b.maxX+.85].flatMap(x=>[b.minZ-.85,b.maxZ+.85].map(z=>({x,z})))).filter(p=>validPoint(p,bounds,obstacles));
    this.edges=this.corners.map((p,i)=>this.corners.flatMap((q,j)=>j!==i&&clearSegment(p,q,obstacles,.65)?[{index:j,cost:Math.hypot(p.x-q.x,p.z-q.z)}]:[]));
    this.cover=coverPoints.filter(p=>validPoint(p,bounds,obstacles));if(!this.cover.length)this.cover=this.corners;
  }
  route(start,goal){
    if(clearSegment(start,goal,this.obstacles,.65))return [goal];
    const n=this.corners.length,dist=Array(n).fill(Infinity),prev=Array(n).fill(-1),done=new Set();
    for(let i=0;i<n;i++)if(clearSegment(start,this.corners[i],this.obstacles,.65))dist[i]=Math.hypot(start.x-this.corners[i].x,start.z-this.corners[i].z);
    let best=-1,bestCost=Infinity;
    for(let count=0;count<n;count++){
      let i=-1;for(let j=0;j<n;j++)if(!done.has(j)&&(i<0||dist[j]<dist[i]))i=j;
      if(i<0||!Number.isFinite(dist[i])||dist[i]>bestCost)break;done.add(i);
      const p=this.corners[i];if(clearSegment(p,goal,this.obstacles,.65)){const cost=dist[i]+Math.hypot(p.x-goal.x,p.z-goal.z);if(cost<bestCost){best=i;bestCost=cost;}}
      for(const edge of this.edges[i])if(dist[i]+edge.cost<dist[edge.index]){dist[edge.index]=dist[i]+edge.cost;prev[edge.index]=i;}
    }
    if(best<0)return [];
    const result=[goal];for(let i=best;i>=0;i=prev[i])result.unshift(this.corners[i]);return result;
  }
}
