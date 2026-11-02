const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const router = import(pathToFileURL(path.join(__dirname, '../renderer/wire-router.js')).href);
const a = { x: 0, y: 0, side: 'right', owner: 'A' };
const b = { x: 300, y: 100, side: 'left', owner: 'B' };
const bodyBoxes = boxes => boxes.map(o => ({left:o.x,right:o.x+o.width,top:o.y,bottom:o.y+o.height}));
function checkRoute(r, start, end, boxes, api) {
  assert.equal(r.blocked, false);
  assert.deepEqual(r.points[0], {x:start.x,y:start.y});
  assert.deepEqual(r.points.at(-1), {x:end.x,y:end.y});
  for(let i=1;i<r.points.length;i++) {
    const p=r.points[i-1],q=r.points[i];
    assert(p.x===q.x||p.y===q.y,'모든 선분이 수평 또는 수직');
    assert(!api.segmentBlocked(p,q,bodyBoxes(boxes)),'부품 몸체를 관통하지 않음');
    assert(Number.isFinite(p.x)&&Number.isFinite(p.y));
  }
}

test('마주 보는 같은 높이 핀은 짧은 직선',async()=>{
  const api=await router,end={...b,y:0};
  const r=api.routeWire(a,end);checkRoute(r,a,end,[],api);assert.equal(r.points.length,2);
  assert.equal(api.pointsToPath(r.points),'M0 0 L300 0');
});
test('다른 높이 핀은 큰 곡선 없이 두 번만 꺾음',async()=>{
  const api=await router,r=api.routeWire(a,b);checkRoute(r,a,b,[],api);
  assert(r.points.length<=4);assert(!api.pointsToPath(r.points).includes('C'));
});
test('중간 부품을 여백까지 피해 우회',async()=>{
  const api=await router,end={...b,y:0};
  const boxes=[{id:'C',x:100,y:-40,width:80,height:80}];
  const r=api.routeWire(a,end,boxes);checkRoute(r,a,end,boxes,api);
  const padded=bodyBoxes(boxes).map(x=>({left:x.left-12,right:x.right+12,top:x.top-12,bottom:x.bottom+12}));
  for(let i=1;i<r.points.length;i++)assert(!api.segmentBlocked(r.points[i-1],r.points[i],padded));
});
test('같은 부품의 같은 면 핀은 바깥에서 연결',async()=>{
  const api=await router,box={id:'A',x:0,y:0,width:100,height:100};
  const start={x:0,y:25,side:'left',owner:'A'},end={x:0,y:75,side:'left',owner:'A'};
  const r=api.routeWire(start,end,[box]);checkRoute(r,start,end,[box],api);
  assert(r.points.some(p=>p.x<=-12));
});
test('위쪽·아래쪽 핀 방향과 소수 좌표 유지',async()=>{
  const api=await router;
  const start={x:33.3,y:0,side:'top',owner:'A'},end={x:210.5,y:-140,side:'bottom',owner:'B'};
  const boxes=[{id:'A',x:0,y:0,width:80,height:60},{id:'B',x:180,y:-210,width:80,height:70}];
  const r=api.routeWire(start,end,boxes);checkRoute(r,start,end,boxes,api);
  assert(r.points[1].y<start.y);assert(r.points.at(-2).y>end.y);
});
test('출발·도착 네 방향의 16가지 조합',async()=>{
  const api=await router,dirs={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]};
  const boxes=[{id:'A',x:0,y:0,width:100,height:100},{id:'B',x:300,y:200,width:100,height:100}];
  const port=(box,side)=>({owner:box.id,side,x:box.x+(side==='left'?0:side==='right'?100:50),y:box.y+(side==='top'?0:side==='bottom'?100:50)});
  for(const first of Object.keys(dirs))for(const last of Object.keys(dirs)){
    const start=port(boxes[0],first),end=port(boxes[1],last),r=api.routeWire(start,end,boxes);
    checkRoute(r,start,end,boxes,api);
    const p=r.points[1],q=r.points.at(-2);
    assert((p.x-start.x)*dirs[first][0]+(p.y-start.y)*dirs[first][1]>0,'출발 핀 바깥으로 진행');
    assert((q.x-end.x)*dirs[last][0]+(q.y-end.y)*dirs[last][1]>0,'도착 핀 바깥에서 접근');
  }
});
test('좁아도 마주 보는 핀의 직선 연결은 유지',async()=>{
  const api=await router,start={x:100,y:50,side:'right',owner:'A'},end={x:130,y:50,side:'left',owner:'B'};
  const boxes=[{id:'A',x:0,y:0,width:100,height:100},{id:'B',x:130,y:0,width:100,height:100}];
  const r=api.routeWire(start,end,boxes);checkRoute(r,start,end,boxes,api);assert.equal(r.points.length,2);
});
test('겹친 부품은 연결을 지우지 않고 우회 실패를 알림',async()=>{
  const api=await router,boxes=[{id:'C',x:-10,y:-10,width:40,height:40}];
  const r=api.routeWire(a,b,boxes);assert.equal(r.blocked,true);
  assert.deepEqual(r.points[0],{x:0,y:0});assert.deepEqual(r.points.at(-1),{x:300,y:100});
});
test('탐색 한도 초과 시에도 유한한 경로와 경고 반환',async()=>{
  const api=await router,r=api.routeWire(a,b,[],[],{maxVisited:0});
  assert.equal(r.blocked,true);assert(r.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('같은 위치 핀과 잘못된 좌표 처리',async()=>{
  const api=await router;assert.deepEqual(api.routeWire(a,a).points,[{x:0,y:0}]);
  assert.throws(()=>api.routeWire({...a,x:NaN},b),TypeError);
});
test('중복점·직선 중간점 제거 및 짧은 코너 반경 제한',async()=>{
  const api=await router;
  assert.deepEqual(api.simplifyPoints([{x:0,y:0},{x:0,y:0},{x:10,y:0},{x:20,y:0}]),[{x:0,y:0},{x:20,y:0}]);
  const d=api.pointsToPath([{x:0,y:0},{x:2,y:0},{x:2,y:2}],20);
  assert.equal(d,'M0 0 L1 0 Q2 0 2 1 L2 2');
});
test('여러 선은 일정한 순서로 계산하고 긴 중복 구간을 줄임',async()=>{
  const api=await router,end={...b,y:0},items=[{id:'w2',start:a,end},{id:'w1',start:a,end}];
  const routes=api.routeWires(items,[]),reverse=api.routeWires([...items].reverse(),[]);
  assert.deepEqual([...routes],[...reverse]);
  assert.notDeepEqual(routes.get('w1').points,routes.get('w2').points);
  checkRoute(routes.get('w2'),a,end,[],api);
});
test('입력 연결·부품 데이터는 수정하지 않음',async()=>{
  const api=await router,items=[{id:'w1',start:a,end:b}],boxes=[{id:'C',x:90,y:10,width:50,height:50}];
  const snapshot=JSON.stringify([items,boxes]);api.routeWires(items,boxes);assert.equal(JSON.stringify([items,boxes]),snapshot);
});
test('재현 가능한 60가지 장애물 배치에서 몸체 회피',async()=>{
  const api=await router;let seed=4731;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const end={x:600,y:400,side:'left',owner:'B'};
  for(let i=0;i<60;i++){
    const boxes=Array.from({length:5},(_,j)=>({id:'C'+j,x:60+Math.floor(random()*390),y:40+Math.floor(random()*280),width:40+Math.floor(random()*40),height:40+Math.floor(random()*40)}));
    const r=api.routeWire(a,end,boxes);checkRoute(r,a,end,boxes,api);
  }
});
