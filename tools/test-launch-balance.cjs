const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
require.extensions['.ts']=(m,f)=>m._compile(compile(f),f);
const {World}=require('../assets/Scripts/game/domain/World.ts');
const {updateZombies}=require('../assets/Scripts/game/domain/ZombieSystem.ts');
const {attachIdleMovement}=require('../assets/Scripts/game/domain/IdleMovement.ts');
const events={on(){},off(){}};
const cc={_decorator:{ccclass:()=>c=>c,property:()=>()=>{}},CCFloat:Number,Component:class{},geometry:{Ray:class{}},Input:{EventType:{}},input:events,game:events,Game:{EVENT_HIDE:'hide'},EventMouse:{BUTTON_LEFT:0},view:{getViewportRect:()=>({x:0,y:0,width:1280,height:720}),getVisibleSize:()=>({width:1280,height:720})}};
const load=file=>{const exports={};vm.runInNewContext(compile(file),{exports,require:id=>id==='cc'?cc:require(path.resolve(path.dirname(file),id+'.ts'))});return exports;};
const {LevelSettings}=load('../assets/Scripts/game/presentation/LevelSettings.ts');
const {SlingshotInput}=load('../assets/Scripts/game/presentation/SlingshotInput.ts');
const scene=JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene','utf8'));
const serialized=scene.find(o=>o._id==='level-table-settings');
const component=Object.assign(new LevelSettings(),serialized,{enabled:true});
const settings=scene.find(o=>o._id==='zombie-road-settings');
const config=component.configure({zombieCount:1,maxVehicles:0,laneOffsetZ:settings.laneOffsetZ,finishOffsetZ:settings.finishOffsetZ});
assert.equal(config.flightMaxPixels,220);assert.equal(config.flightMinPixels,110);assert.equal(config.flightSpeedPixels,1760);
const sx=config.unitsPerPixel,sz=config.depthPerPixel;
const profile={mode:2,speed:66*sx,walkMin:2,walkMax:4,restMin:1,restMax:2.5,jumpMin:132*sx,jumpMax:220*sx,jumpDuration:.25,jumpsMin:1,jumpsMax:2,jumpPause:.15,jumpHeight:.2};
for(let level=1;level<=5;level++)for(const device of ['mouse','touch'])for(const direction of [-1,0,1]) {
    const w=new World(level,42,config),z=w.zombies[0];w.layout.obstacles=[];
    attachIdleMovement(z,profile,w.random);
    const scale=25;
    const camera={screenPointToRay(x,y,ray){ray.o={x:(x-640)/scale,y:10,z:(500-y)/scale};ray.d={x:0,y:-1,z:0};},worldToScreen(p){return{x:640+p.x*scale,y:500-p.z*scale};}};
    let aim;
    const visual={zombiePickPosition:(x,z)=>({x,z}),showAim(origin,pull){aim=origin&&pull?{x:origin.x+pull.x,z:origin.z+pull.z}:null;}};
    const c=new SlingshotInput(camera,()=>w,visual);
    const event=(x,y)=>device==='mouse'?{getButton:()=>0,getLocationX:()=>x,getLocationY:()=>y}:{getID:()=>7,getLocation:()=>({x,y})};
    const p=camera.worldToScreen(z);
    const target={x:640+direction*400,y:600};
    c[device==='mouse'?'mouseDown':'touchStart'](event(p.x,p.y));
    c[device==='mouse'?'mouseMove':'touchMove'](event(target.x,target.y));
    for(let frame=0;frame<10;frame++) {
        w.update(1/60);c.update();
        const pixels=Math.hypot((aim.x-z.x)/sx,(aim.z-z.z)/sz);
        assert(Math.abs(pixels-220)<1e-7,'long gesture stays capped, including moving spawn');
    }
    const endpoint={...aim},from={x:z.x,z:z.z};
    c[device==='mouse'?'mouseUp':'touchEnd'](event(target.x,target.y));
    assert(z.flight);const duration=z.flight.remaining/z.flight.speed;
    assert(Math.abs(duration-.125)<1e-8);
    updateZombies(w,duration);
    assert(!z.flight);assert.equal(z.state,'walking','max throw cannot instantly rescue');
    assert(Math.abs(z.x-endpoint.x)<1e-7 && Math.abs(z.z-endpoint.z)<1e-7,'actual landing equals aim tip');
    assert(z.z>w.layout.finishZ && from.z-z.z<=220*sz+1e-8);
    assert.equal(w.launch(z.id,{x:0,z:-100}),false);
    c.destroy();
}
for(const input of [{x:0,z:-.3},{x:1,z:-1},{x:10000,z:-10000}]) {
    const w=new World(1,42,config),v=w.launchVector(input);
    const length=Math.hypot(v.x/sx,v.z/sz);
    assert(length>=110-1e-8 && length<=220+1e-8);
}
console.log('PASS scene launch balance: 5 levels, mouse/touch, diagonal/straight, stationary pointer, moving spawn, 110-220px cap, aim=landing, no instant finish or relaunch');
