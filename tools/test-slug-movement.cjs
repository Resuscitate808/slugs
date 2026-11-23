const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, f);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { attachIdleMovement } = require('../assets/Scripts/game/domain/IdleMovement.ts');
const p = { mode: 1, speed: 66 / 40, walkMin: 2, walkMax: 4, restMin: 0.8, restMax: 1.5, jumpMin: 132 / 40, jumpMax: 220 / 40, jumpDuration: 0.25, jumpsMin: 1, jumpsMax: 2, jumpPause: 0.15, jumpHeight: 0.45 };
function fixture(profile) { const w = new World(1, 42, { zombieCount: 1, maxVehicles: 0 }); w.layout.obstacles = []; const z = w.zombies[0]; z.x = 0; z.z = 8; attachIdleMovement(z, profile, w.random); return { w, z }; }
function close(a,b) { assert(Math.abs(a-b)<1e-7, `${a} != ${b}`); }
function launch(w,z) { assert(w.launch(z.id,{x:0,z:-1})); }
{
 const a=fixture(p), b=fixture(p); delete b.z.idleMotion;
 for(let i=0;i<120;i++) { a.w.update(1/60); b.w.update(1/60); close(a.z.x,b.z.x); close(a.z.z,b.z.z); }
 assert.equal(a.z.idleMotion.duration,0);
}
{
 const {w,z}=fixture({...p,walkMin:2,walkMax:2,restMin:1,restMax:1}); launch(w,z);
 const depth=z.z; updateZombies(w,1); close(depth-z.z,p.speed);
 updateZombies(w,1); assert.equal(z.idleMotion.phase,'rest');
 const rest=z.z; updateZombies(w,0.9); close(z.z,rest);
 updateZombies(w,0.1); assert.equal(z.idleMotion.phase,'move');
 updateZombies(w,0.1); assert(z.z<rest);
}
{
 const {w,z}=fixture({...p,mode:3,speed:132/40}); launch(w,z);
 const depth=z.z; updateZombies(w,1); close(depth-z.z,3.3);
 for(let i=0;i<1000 && z.state!=='saved';i++) updateZombies(w,1/60);
 assert.equal(z.state,'saved');
}
{
 const {w,z}=fixture({...p,mode:2,jumpsMin:2,jumpsMax:2,restMin:1,restMax:2.5}); launch(w,z);
 const start={x:z.x,z:z.z}; updateZombies(w,0.125); const m=z.idleMotion;
 assert(m.distance>=132/40 && m.distance<=220/40); assert(m.height>0);
 close(Math.hypot(z.x-start.x,z.z-start.z),m.distance/2); assert(z.z<start.z);
 const side=m.side; updateZombies(w,0.125); close(m.height,0); assert.equal(m.phase,'gap');
 const gap={x:z.x,z:z.z}; updateZombies(w,0.15); close(z.x,gap.x); close(z.z,gap.z); assert.equal(m.side,side);
 updateZombies(w,0.25); assert.equal(m.phase,'rest'); assert(m.remaining>=1 && m.remaining<=2.5);
 for(let i=0;i<10000 && z.state!=='saved';i++) { updateZombies(w,1/60); assert(Math.abs(z.x)<w.layout.halfWidth); }
 assert.equal(z.state,'saved');
}
{
 const {w,z}=fixture(p); launch(w,z); w.paused=true; const before=JSON.stringify(z);
 w.update(0.2); assert.equal(JSON.stringify(z),before); w.paused=false;
 assert.equal(w.launch(z.id,{x:0,z:-1}),false);
 z.state='stuck'; z.timer=10; const motion=JSON.stringify(z.idleMotion); updateZombies(w,1);
 assert.equal(JSON.stringify(z.idleMotion),motion); close(z.timer,9);
}
{
 const {w,z}=fixture({...p,mode:3}); launch(w,z); z.x=0;z.z=0.8;z.goalX=0;
 w.vehicles=[{id:99,x:0,z:0,axis:'x',direction:1}];
 updateZombies(w,1); assert(z.z>0.6); const waiting=z.z; updateZombies(w,1); close(z.z,waiting);
 w.vehicles=[]; updateZombies(w,0.1); assert(z.z<waiting);
}
{
 const {w,z}=fixture({...p,mode:2,jumpsMin:2,jumpsMax:2});
 z.z=w.layout.spawnZ; const depth=z.z;
 updateZombies(w,0.125); assert.equal(z.state,'idle'); assert(z.idleMotion.height>0); close(z.z,depth);
 const before=JSON.stringify(z); w.paused=true; w.update(0.2); assert.equal(JSON.stringify(z),before); w.paused=false;
 for(let i=0;i<3600;i++) { updateZombies(w,1/60); assert(Math.abs(z.x)<=13.1); close(z.z,depth); assert.equal(z.state,'idle'); }
 while(z.idleMotion.height<0.1) updateZombies(w,1/60);
 const height=z.idleMotion.height; launch(w,z); close(z.idleMotion.height,height);
 for(let i=0;i<10000 && z.state!=='saved';i++) updateZombies(w,1/60);
 assert.equal(z.state,'saved');
 console.log('PASS green spawn: jumping, reflected bounds, pause, airborne launch and finish');
}
const scene=JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene','utf8'));
const component=scene.find(x=>x._id==='slug-movement-settings'); assert(component);
const skins=scene.find(x=>x.skins).skins.map(r=>scene[r.__id__]);
const authoredProfiles = component.profiles.map(r => scene[r.__id__]);
assert.deepEqual(authoredProfiles.map(p => [p.mode, p.speedPixels, p.restMin, p.restMax]), [[1,120,0.5,1],[2,66,0.5,1],[3,180,0.8,1.5]]);
assert.deepEqual(authoredProfiles.map(p => [p.walkMin,p.walkMax,p.jumpMinPixels,p.jumpMaxPixels,p.jumpDuration,p.jumpsMin,p.jumpsMax,p.jumpPause]), Array.from({length:3}, () => [2,4,132,220,0.25,1,2,0.15]));
component.profiles.forEach((r,i)=>{
 const profile=scene[r.__id__]; assert.equal(profile.skinIndex,i);
 const meta=JSON.parse(fs.readFileSync(`../assets/Sprites/Slugs/${['pink','green','yellow'][i]}.png.meta`,'utf8'));
 assert(skins[i].frame.__uuid__.startsWith(meta.uuid+'@'));
});
const Module = require('node:module'), originalLoad = Module._load;
Module._load = function(name, ...args) {
 if(name === 'cc') return {
  _decorator: { ccclass: () => c => c, property: (...args) => args.length >= 2 ? undefined : () => {} },
  CCFloat: Number, CCInteger: Number, Enum: x => x, Component: class { constructor() { this.enabled = true; } }
 };
 return originalLoad.call(this, name, ...args);
};
const { LevelSettings } = require('../assets/Scripts/game/presentation/LevelSettings.ts');
const { ZombieMovementSettings, SlugMovementProfile } = require('../assets/Scripts/game/presentation/ZombieMovementSettings.ts');
Module._load = originalLoad;
const levelSettings = Object.assign(new LevelSettings(), scene.find(c => c._id === 'level-table-settings'));
const movementSettings = new ZombieMovementSettings();
for (const level of [1,2,3,4,5]) {
 const config = levelSettings.configure({ zombieCount: 1, maxVehicles: 0 });
 for (const [skin, pixels] of [[0,120],[2,180]]) {
  const settings = new ZombieMovementSettings();
  settings.profiles = authoredProfiles.map(p => Object.assign(new SlugMovementProfile(), p));
  const w = new World(level, 42, config);
  w.layout.obstacles = []; w.layout.finishZ = -100;
  const z = w.zombies[0]; z.x = 0; z.z = w.layout.spawnZ;
  settings.apply(w, [skin], 3, 1/40);
  close(z.idleMotion.profile.speed / config.unitsPerPixel, pixels);
  z.state = 'walking'; z.direction = { x: 0, z: -1 }; z.goalX = 0;
  const start = z.z; updateZombies(w, 0.5);
  close((start - z.z) / config.unitsPerPixel, pixels * 0.5);
 }
}
console.log('PASS authored pink/yellow speeds: 120/180 px/s applied and simulated on all five levels');
const green = Object.assign(new SlugMovementProfile(), scene[component.profiles[1].__id__]);
movementSettings.profiles = [green];
for(const roadLength of [36, 72]) for(const level of [1,2,3,4,5]) for(const pixels of [132,220]) for(const frame of [1/60,0.125,0.25]) {
 levelSettings.roadWorldLength = roadLength;
 green.jumpMinPixels = green.jumpMaxPixels = pixels;
 green.jumpsMin = green.jumpsMax = 1;
 const config = levelSettings.configure({ zombieCount: 1, maxVehicles: 0 });
 const w = new World(level, 42, config);
 w.layout.obstacles = []; w.layout.finishZ = -100;
 const z = w.zombies[0]; z.x = 0; z.z = w.layout.spawnZ;
 movementSettings.apply(w, [1], 3, 1/40);
 close(z.idleMotion.profile.jumpMax, pixels * roadLength / 3800);
 const spawnZ = z.z;
 updateZombies(w, 0.25);
 close(Math.abs(z.x) / config.unitsPerPixel, pixels); close(z.z, spawnZ);
 assert.equal(z.state, 'idle');
 z.x = 0;
 const m = z.idleMotion; m.duration = 0;
 assert(w.launch(z.id, { x: 0, z: -110 * config.depthPerPixel }));
 updateZombies(w, 110 / 1760);
 assert(!z.flight); close(spawnZ - z.z, 110 * config.depthPerPixel);
 const start = { x: z.x, z: z.z };
 for(let t = 0; t < 0.25 - 1e-9; t += frame) updateZombies(w, Math.min(frame, 0.25 - t));
 const dx = (z.x - start.x) / config.unitsPerPixel;
 const dy = (z.z - start.z) / config.depthPerPixel;
 close(Math.hypot(dx, dy), pixels);
 close(Math.abs(dx), Math.abs(dy)); assert(dy < 0);
 close(m.height, 0); assert.equal(m.phase, 'rest');
 const end = { x: z.x, z: z.z }; updateZombies(w, 0.15);
 close(z.x, end.x); close(z.z, end.z);
}
console.log('PASS projected green jumps: 132/220px, five levels, two map scales, three frame steps, unchanged spawn and launch flight');
console.log('PASS slug movement: unchanged spawn, post-launch speeds/rests/diagonal jumps, finish, pause, obstacle timer, vehicle waiting, skin mapping');
