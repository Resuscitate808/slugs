const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,f);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { updateTraffic, spawnVehicle } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const { vehicleCenter, vehicleExtent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
const sx=36/3800, sz=sx/(25/Math.hypot(25,24));
const shapes={};
for(const [kind,length] of [['jeep',660],['pink',220],['ordinary',396]]) {
 const shape={halfX:length*sx/2,halfZ:143*sz/2,offsetX:0,offsetZ:0};
 shapes[kind]={xPositive:shape,xNegative:shape,zPositive:shape,zNegative:shape};
}
const config={levelTable:true,unitsPerPixel:sx,depthPerPixel:sz,laneWidths:Array(5).fill(220*sz),laneOffsetZ:3.5,vehicleOffsetZ:0,zombieCount:10,queueGap:55*sx,vehicleShapes:shapes,driverExitEnabled:false,maxVehicles:100,vehicleProfiles:{jeep:{speed:330*sx,firstLevel:1,weight:1},pink:{speed:990*sx,firstLevel:1,weight:1},ordinary:{speed:572*sx,firstLevel:5,weight:1}}};
const Module=require('node:module'), originalLoad=Module._load;
Module._load=function(name,...args){if(name==='cc')return {_decorator:{ccclass:()=>c=>c,property:()=>()=>{}},CCFloat:Number,Component:class{constructor(){this.enabled=true;}}};return originalLoad.call(this,name,...args);};
const {LevelSettings}=require('../assets/Scripts/game/presentation/LevelSettings.ts');
Module._load=originalLoad;
const component=new LevelSettings();const actual=component.configure({});
assert.equal(actual.unitsPerPixel,sx);assert.equal(actual.depthPerPixel,sz);assert.deepEqual(actual.laneWidths,config.laneWidths);
const serialized=JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene','utf8')).find(c=>c._id==='level-table-settings');assert(serialized && serialized._enabled);assert.equal(serialized.flightSpeedPixels,1760);
const catalog=parseLevelCatalog(JSON.parse(fs.readFileSync('../assets/resources/levels.json','utf8')));
const kinds=[['jeep','pink'],['jeep','pink'],['jeep','pink','jeep'],['jeep','pink','jeep','pink'],['jeep','pink','ordinary','jeep','pink']];
const totals=[4,5,6,8,10], goals=[3,4,5,6,7];
const pauses=[[4,5],[3,4],[3,4],[5,7],[6,8]], entryGaps=[0,0,0,1.3,1.5];
for(let level=1;level<=5;level++) {
 const w=new World(level,42,config,{},catalog.levels[level-1]);
 assert.equal(w.layout.laneCenters.length,kinds[level-1].length);
 assert.deepEqual([...w.layout.laneDirections].reverse(),kinds[level-1].map((_,i)=>i%2===0?1:-1));
 assert(Math.abs(w.layout.roadHalf*2/sz-220*kinds[level-1].length)<1e-8);
 w.trafficBounds={left:-18,right:18};
 const levelKinds=[...new Set(kinds[level-1])];
 const seen=new Set(), previous=new Map(), tails=new Map(), first=new Set(), previousKind=new Map(), laneKinds=new Map();
 for(let frame=0;frame<60*30;frame++) {
  const time=(frame+1)/60;
  updateTraffic(w,1/60,false);
  for(const car of w.vehicles) {
   const lane=w.layout.laneCenters.indexOf(car.lane);
   assert(kinds[level-1].includes(car.kind));
   assert.equal(car.z,car.lane); assert.equal(car.targetLane,car.lane); assert(!car.overtake);
   if(!seen.has(car.id)) {
    seen.add(car.id);
    if(!first.has(lane)){ assert(time<=2+lane*entryGaps[level-1]+0.02);first.add(lane); }
    else { const elapsed=time-tails.get(previous.get(lane));assert(elapsed>=pauses[level-1][0]-0.02 && elapsed<=pauses[level-1][1]+0.06,`gap ${elapsed}`); }
    assert.notEqual(car.kind,previousKind.get(lane),'lane must alternate kinds');
    previousKind.set(lane,car.kind);
    if(!laneKinds.has(lane)) laneKinds.set(lane,new Set());
    laneKinds.get(lane).add(car.kind);
    previous.set(lane,car.id);
   }
   const tail=vehicleCenter(car,'x')-car.direction*vehicleExtent(car,'x');
   if(!tails.has(car.id) && (tail-(car.direction>0?-18:18))*car.direction>=0)tails.set(car.id,time);
  }
 }
 assert.equal(first.size,kinds[level-1].length);
 for(const lane of laneKinds.keys()) assert.equal(laneKinds.get(lane).size,levelKinds.length,`lane ${lane} must cycle all level kinds`);
 const p=new Progress({getItem:()=>null,setItem:()=>{}});
 const flow=new GameFlow(p,config,42,level,undefined,3);
 assert.equal(flow.partyLimit,totals[level-1]);assert.equal(flow.target,goals[level-1]);assert.equal(flow.world.zombies.length,totals[level-1]);
 for(let n=goals[level-1]-1;n<=goals[level-1];n++){
  const resultWorld=new World(level,42,config);resultWorld.zombies.forEach((z,i)=>z.state=i<n?'saved':'dead');assert.equal(resultWorld.finish().won,n>=goals[level-1]);
 }
 console.log(`PASS level ${level}: lanes, kinds, directions, entry timers, no overtaking, party and victory goal`);
}
for(const direction of [-1,1]) {
 const w=new World(1,42,config);w.layout.laneDirections=[direction,direction];
 const leader=spawnVehicle(w,'jeep',0);leader.x=0;leader.stopped=100;
 const follower=spawnVehicle(w,'pink',0);assert(follower);follower.x=-direction*10;
 for(let i=0;i<180;i++)updateTraffic(w,1/60,false);
 const gap=(vehicleCenter(leader,'x')-vehicleCenter(follower,'x'))*direction-vehicleExtent(leader,'x')-vehicleExtent(follower,'x');
 assert(Math.abs(gap-55*sx)<0.002,`queue gap ${gap}`);assert.equal(follower.z,leader.z);
 console.log(`PASS queue ${direction}: 55px and no lane change`);
}
for(const lanes of [2,3,4,5]) {
 const w=new World(lanes===2?1:lanes,42,{...config,flightMaxPixels:1760});w.vehicles=[];w.layout.obstacles=[];w.layout.finishZ=-100;
 const z=w.zombies[0];z.x=0;z.z=0;
 assert(w.launch(z.id,{x:0,z:-1760*sz}));
 const seconds=lanes*220/1760;
 updateZombies(w,seconds);
 assert(Math.abs(z.z+lanes*220*sz)<1e-8);
 console.log(`PASS flight ${lanes} lanes: ${seconds}s`);
}
for(const [x,y] of [[0,1],[0,10000],[100,100]]) {
 const w=new World(1,42,config);w.layout.obstacles=[];w.layout.finishZ=-100;
 const z=w.zombies[0];z.x=z.z=0;
 const pull={x:x*sx,z:-y*sz};
 if(y===1)pull.z=-0.3;
 assert(w.launch(z.id,pull));
 const pixels=Math.max(110,Math.min(220,Math.hypot(pull.x/sx,pull.z/sz)));
 const flight={...z.flight};assert(Math.abs(flight.remaining/flight.speed-pixels/1760)<1e-8);
 updateZombies(w,pixels/1760);
 assert(!z.flight);assert(Math.abs(Math.hypot(z.x/sx,z.z/sz)-pixels)<1e-6);
}
const persisted=new Progress({getItem:()=>null,setItem:()=>{}});
persisted.data.party=Array.from({length:10},(_,i)=>persisted.createMember(i%3));persisted.data.collection=[];
const allIds=persisted.party.map(m=>m.id);
const limited=new GameFlow(persisted,config,42,1,undefined,3);
assert.equal(persisted.party.length,4);assert.equal(persisted.collection.length,6);
assert.deepEqual([...persisted.party,...persisted.collection].map(m=>m.id),allIds);
for(const pull of [{x:0,z:-0.3},{x:10,z:-100}]) {
 const w=new World(1,42,config), z=w.zombies[0];const end=w.launchVector(pull);w.launch(z.id,pull);
 assert(Math.abs(Math.hypot(end.x,end.z)-z.flight.remaining)<1e-8);
}
console.log('PASS flight range clamps, diagonal metric, landing, aim endpoint, lossless overflow migration; valid authored JSON');
