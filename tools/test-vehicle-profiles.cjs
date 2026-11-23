const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText,f);
const load=Module._load;
class Vec3 { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} static transformQuat(out,v){return Object.assign(out,v);} }
const property=(...args)=>args.length>=2?undefined:()=>{};
Module._load=function(id,...args){if(id==='cc')return {_decorator:{ccclass:()=>x=>x,property},Component:class {},CCFloat:Number,CCInteger:Number,Vec3};return load.call(this,id,...args);};
const {VehicleMovementSettings}=require('../assets/Scripts/game/presentation/VehicleMovementSettings.ts');
Module._load=load;
const {World}=require('../assets/Scripts/game/domain/World.ts');
const {spawnVehicle,updateTraffic}=require('../assets/Scripts/game/domain/TrafficSystem.ts');
const scene=JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene','utf8'));
const component=scene.find(x=>x._id==='vehicle-movement-settings');assert(component);
const settings=new VehicleMovementSettings();settings.enabled=true;
for(const key of ['trailer','courier','van'])Object.assign(settings[key],scene[component[key].__id__]);
for(const scale of [1/40,1/60])for(let level=1;level<=5;level++){
 const w=new World(level,42,{zombieCount:0});
 const styles={};for(const k of ['jeep','pink','ordinary'])styles[k]={frame:{originalSize:{width:100,height:100},rect:{width:100,height:100},offset:{x:0,y:0}},billboard:true,bottomAnchor:false,flipWithDirection:true,rotation:0,lift:0};
 settings.apply(w,{spriteFor:k=>styles[k]},{node:{worldRotation:{}}},scale);
 for(const [kind,speed,length] of [['jeep',330,660],['pink',990,220],['ordinary',572,396]]){
  assert.equal(styles[kind].width,length*scale);assert.equal(styles[kind].height,143*scale);
  w.vehicles=[];const car=spawnVehicle(w,kind,0);
  if(kind==='ordinary' && level<5){assert.equal(car,undefined);continue;}
  assert(car);assert.equal(car.cruise,speed*scale);
  const before=car.x;updateTraffic(w,0.1,false);assert(Math.abs(Math.abs(car.x-before)-speed*scale*.1)<1e-8);
  assert(car.shapes);
 }
 const kinds=new Set();for(let i=0;i<100;i++){w.vehicles=[];kinds.add(spawnVehicle(w).kind);}
 assert.equal(kinds.has('ordinary'),level===5);assert(kinds.has('jeep')&&kinds.has('pink'));
}
console.log('PASS vehicle profiles: scene mapping, exact speeds/sizes at two scales, first four levels exclude van, fifth includes all types');
