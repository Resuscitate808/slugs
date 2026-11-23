const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, f);
const { shapeEntry } = require('../assets/Scripts/game/domain/SpriteContact.ts');
const { contactGeometry, alphaRectangles, clipContactShape, obstacleBodyShape } = require('../assets/Scripts/game/presentation/SpriteContactGeometry.ts');
const { DEFAULT_CAMERA_BASIS: basis } = require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { applyObstacles } = require('../assets/Scripts/game/domain/ObstacleSystem.ts');
const { updateTraffic, spawnVehicle } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const rect = (l, b, r, t) => ({ polygons: [[{ x:l,z:b },{ x:r,z:b },{ x:r,z:t },{ x:l,z:t }]] });
const p = (x,z) => ({x,z});
const origin = p(0,0);
assert.equal(shapeEntry(rect(-.5,-.5,.5,.5), p(-3,0), p(3,0), rect(-.5,-.5,.5,.5), origin), 1/3);
assert.equal(shapeEntry(rect(-.5,-.5,.5,.5), p(-3,1.01), p(3,1.01), rect(-.5,-.5,.5,.5), origin), undefined);
const mask = alphaRectangles(4,4,(x,y) => x===1 && y>=1 && y<=2);
assert.deepEqual(mask, [{left:-.25,right:0,bottom:-.25,top:.25}]);
const style = { width:4,height:4,billboard:false,bottomAnchor:false,flipWithDirection:false,rotation:0,lift:0,
 frame:{originalSize:{width:4,height:4},rect:{width:4,height:4},offset:{x:0,y:0}} };
for (const billboard of [false,true]) for (const rotation of [0,33,90]) for (const direction of [-1,1]) {
    const s={...style,billboard,rotation,flipWithDirection:true,bottomAnchor:true,lift:.3};
    const {vehicleSpriteShapes}=require('../assets/Scripts/game/presentation/VehicleSpriteBounds.ts');
    const b=vehicleSpriteShapes(s,basis)[direction>0?'xPositive':'xNegative'];
    const geometry=contactGeometry(s,[{left:-.5,bottom:-.5,right:.5,top:.5}],basis,.18,direction,direction*90);
    for(const axis of ['x','z']) {
        const values=geometry.polygons.flat().map(p=>p[axis]);
        const half=axis==='x'?b.halfX:b.halfZ, offset=axis==='x'?b.offsetX:b.offsetZ;
        assert.ok(Math.abs(Math.min(...values)-(offset-half))<1e-8);
        assert.ok(Math.abs(Math.max(...values)-(offset+half))<1e-8);
    }
}
const narrow = contactGeometry(style,mask,basis,.1);
assert.equal(shapeEntry(narrow,p(2,0),p(2,-3),rect(-.1,-.1,.1,.1),origin),undefined);
assert.notEqual(shapeEntry(narrow,p(.5,2),p(.5,-2),rect(-.1,-.1,.1,.1),origin),undefined);
const exportsObject = {};
let pixels = new Uint8ClampedArray(4*4*4);
for(let y=1;y<=2;y++) pixels[(y*4+1)*4+3]=255;
class Vec3 { constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});} static transformQuat(out,v){return Object.assign(out, v.x ? basis.right : v.y ? basis.up : {x:-basis.forward.x,y:-basis.forward.y,z:-basis.forward.z});} }
vm.runInNewContext(ts.transpileModule(fs.readFileSync('../assets/Scripts/game/presentation/SpriteContacts.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText,{
 exports:exportsObject, console, Uint8Array, Uint8ClampedArray, document:{ createElement:()=>({width:4,height:4,getContext:()=>({drawImage(){},getImageData:()=>({data:pixels})})}) },
 require:id=>id==='cc'?{Vec3}:id==='./GameSettings'?{}:require(require('node:path').resolve('../assets/Scripts/game/presentation',id+'.ts'))
});
const frame = {...style.frame,uuid:'fixture',name:'fixture',uv:[0,1,1,1,0,0,1,0],texture:{width:4,height:4,image:{data:{}}}};
const sprite={...style,frame};
const w=new World(1,42,{zombieCount:1,driverExitEnabled:false});
const settings={useSprites:true,obstacleSprites:[{type:'test',sprite}],spriteFor:()=>sprite};
const contacts=new exportsObject.SpriteContacts(w,settings,{node:{worldRotation:{}}},()=>sprite);
assert.equal(contacts.mask(frame).length,1);
assert.equal(contacts.mask(frame)[0].left,-.25);
w.spriteContacts=contacts;
w.layout.obstacles=[{id:'test',type:'test',x:0,z:0,radius:10,rotation:0,scale:1}];
const z=w.zombies[0];Object.assign(z,{x:3,z:0,state:'walking',direction:p(0,-1)});
applyObstacles(w,z,p(3,1));assert.equal(z.state,'walking','oversized JSON radius must not catch sprite');
Object.assign(z,{x:0,z:-1,state:'walking'});applyObstacles(w,z,p(0,4));assert.equal(z.state,'stuck');assert.equal(z.timer,10);
const car=spawnVehicle(w,'ordinary',0);Object.assign(car,{x:0,z:0,axis:'x',direction:1,speed:6,cruise:6,reaction:100,targetLane:0,lane:0});
Object.assign(z,{x:2,z:5,state:'stuck',timer:10});updateTraffic(w,1/60,false);assert.equal(z.state,'stuck','transparent vertical gap cannot kill');
const c={...car,x:1,z:0};
Object.assign(z,{x:1,z:0,state:'walking'});assert.equal(contacts.frontHit(c,p(-3,0),z),true,'swept opaque contact');
assert.equal(contacts.frontHit(c,p(1,0),z),false,'stationary');
Object.assign(z,{x:-3,z:0});assert.equal(contacts.frontHit(c,p(0,0),z),false,'rear');
assert.equal(shapeEntry({polygons:[]},origin,origin,narrow,origin),undefined);
const billboardStyle = {...sprite,billboard:true,flipWithDirection:true};
const before = contacts.shapes.size;
for(let i=0;i<500;i++) contacts.shape(billboardStyle,'stable',.1,1,i);
assert.equal(contacts.shapes.size,before+1,'billboard heading must not create new geometry');
for(let i=0;i<500;i++) contacts.shape(sprite,'rotating',.1,1,0,i);
assert.ok(contacts.shapes.size<=256,'rotating sprites must not grow geometry cache without bound');
const trimmed = {...style,frame:{originalSize:{width:8,height:8},rect:{width:4,height:4},offset:{x:1,y:-1}}};
const trimmedShape = contactGeometry(trimmed,[{left:-.5,bottom:-.5,right:.5,top:.5}],basis,.1);
assert.deepEqual(trimmedShape.polygons[0].map(v=>v.x),[-.5,1.5,1.5,-.5],'trimmed sprite keeps original size and offset');
const obstacleShape = contacts.shape(sprite,'obstacle',.13);
const originalShape = contactGeometry(sprite,contacts.mask(frame),basis,.13);
for (const axis of ['x','z']) {
    const extent = shape => {
        const values = shape.polygons.flat().map(p => p[axis]);
        return { size: Math.max(...values)-Math.min(...values), center:(Math.max(...values)+Math.min(...values))/2 };
    };
    const before = extent(originalShape), after = extent(obstacleShape);
    assert.ok(Math.abs(after.size - before.size) < 1e-9);
    assert.ok(Math.abs(after.center - before.center) < 1e-9);
}
for (const direction of [-1,1]) {
    const original = contactGeometry(sprite,contacts.mask(frame),basis,.18,direction,direction*90);
    const reduced = contacts.shape(sprite,'car:x',.18,direction,direction*90);
    for (const axis of ['x','z']) {
        const range = shape => {
            const values = shape.polygons.flat().map(p=>p[axis]);
            return {min:Math.min(...values),max:Math.max(...values)};
        };
        const a=range(original), b=range(reduced);
        assert.ok(Math.abs((b.min+b.max)-(a.min+a.max))<1e-9,'contact center stays fixed');
        assert.ok(Math.abs((b.max-b.min)-(a.max-a.min)*(axis==='z'?.8:1))<1e-9,'only vertical contact shrinks');
    }
}
contacts.zombie = () => rect(-.01,-.01,.01,.01);
for (const direction of [-1,1]) {
    const original = contactGeometry(sprite,contacts.mask(frame),basis,.18,direction,direction*90);
    const pts = original.polygons.flat();
    const minZ=Math.min(...pts.map(p=>p.z)), maxZ=Math.max(...pts.map(p=>p.z));
    const centerZ=(minZ+maxZ)/2;
    const moving={...car,x:direction*3,z:0,direction};
    for (const side of [-1,1]) {
        Object.assign(z,{x:0,z:centerZ+side*(maxZ-minZ)*.475});
        assert.equal(contacts.frontHit(moving,p(-direction*3,0),z),false,'trimmed top and bottom no longer kill');
    }
    Object.assign(z,{x:0,z:centerZ});
    assert.equal(contacts.frontHit(moving,p(-direction*3,0),z),true,'central front contact still kills');
}
const obstacle = w.layout.obstacles[0];
const points = originalShape.polygons.flat();
const left = Math.min(...points.map(p=>p.x)), right = Math.max(...points.map(p=>p.x));
const bottom = Math.min(...points.map(p=>p.z)), top = Math.max(...points.map(p=>p.z));
const edgeX = left + (right-left)*.05;
Object.assign(z,{x:edgeX,z:bottom-2});
assert.notEqual(contacts.obstacleEntry(z,p(edgeX,top+2),obstacle),undefined,'opaque contour edge traps without shifting the silhouette');
Object.assign(z,{x:(left+right)/2});
assert.notEqual(contacts.obstacleEntry(z,p(z.x,top+2),obstacle),undefined,'center still traps');
for (const direction of [-1,1]) for (const side of [-1,1]) {
    const lateralCar = {...car,x:0,z:side*2,direction};
    const shape = contacts.shape(sprite,'car:x',.18,direction,direction*90);
    const values = shape.polygons.flat();
    const x = (Math.min(...values.map(p=>p.x))+Math.max(...values.map(p=>p.x)))/2;
    const edge = Math.max(...values.map(p=>p.z*side));
    Object.assign(z,{x,z:side*(edge+1)});
    assert.equal(contacts.frontHit(lateralCar,p(0,0),z),false,'lateral-only sweep is not a front impact');
    Object.assign(z,{x:x+10});
    assert.equal(contacts.frontHit(lateralCar,p(0,0),z),false,'transparent lateral gap');
    Object.assign(z,{x,z:-side*10});
    assert.equal(contacts.frontHit(lateralCar,p(0,0),z),false,'lateral moving away');
}
settings.useSprites=false;
Object.assign(obstacle,{radius:1});
Object.assign(z,{x:.8,z:-2});
assert.equal(contacts.obstacleEntry(z,p(.8,2),obstacle),undefined,'fallback radius also shrinks');
Object.assign(z,{x:0});
assert.notEqual(contacts.obstacleEntry(z,p(0,2),obstacle),undefined);
w.spriteContacts=undefined;
z.visitedObstacles.clear();Object.assign(z,{state:'walking',x:.8,z:-2});
applyObstacles(w,z,p(.8,2));assert.equal(z.state,'walking','domain fallback also shrinks');
Object.assign(z,{x:0});applyObstacles(w,z,p(0,2));assert.equal(z.state,'stuck');
const opaqueMask=contacts.mask(frame);
assert.equal(opaqueMask[0].right,0,'transparent padding stays outside collision contour');
pixels = new Uint8ClampedArray(4*4*4);
for (let y=0;y<4;y++) for (let x=0;x<4;x++) pixels[(y*4+x)*4+3]=x===1?255:80;
const shadowFrame={...frame,uuid:'shadow'};
assert.equal(contacts.mask(shadowFrame)[0].left,-.25,'translucent shadow excluded');
assert.equal(contacts.mask(shadowFrame)[0].right,0,'only opaque body remains');
assert.equal(contacts.mask(shadowFrame,.1)[0].left,-.5,'threshold has a separate cache');
const ring={polygons:[...rect(-2,-2,-1,2).polygons,...rect(1,-2,2,2).polygons,...rect(-1,1,1,2).polygons]};
const clipped=clipContactShape(ring,1,.8);
assert.equal(shapeEntry(rect(-.1,-.1,.1,.1),p(0,-3),p(0,.5),clipped,origin),undefined,'clipping preserves concave opening');
assert.equal(shapeEntry(rect(-.05,-.05,.05,.05),p(0,.9),p(0,.9),clipped,origin),undefined,'top bar never shifts into the hole');
assert.notEqual(shapeEntry(rect(-.1,-.1,.1,.1),p(0,-3),p(0,2),clipped,origin),undefined,'opaque ring still stops a sweep');
const fresh=new exportsObject.SpriteContacts(w,settings,{node:{worldRotation:{}}},()=>sprite);
settings.useSprites=true;
const movingZombie={...z,x:1,z:3,state:'walking',direction:p(0,-1)};
const single={...car,x:0,z:0};
const {moveAroundVehicles}=require('../assets/Scripts/game/domain/VehicleContact.ts');
const move=step=>moveAroundVehicles(movingZombie,[single],step,p(1,-5),20,fresh.vehiclePadding(movingZombie),
    (from,to,c)=>fresh.vehicleEntry(movingZombie,from,to,c));
move(6);
assert.equal(movingZombie.z,-3,'walking beside transparent car pixels is not blocked by its box');
Object.assign(movingZombie,{x:0,z:5});
move(10);
assert.ok(movingZombie.z>-5 && movingZombie.z<5,'opaque body stops movement');
const body=fresh.shape(sprite,'car:x',.18,single.direction,single.direction*90);
const slug=fresh.zombie(movingZombie);
const minCarZ=Math.min(...body.polygons.flat().map(p=>p.z));
const maxSlugZ=Math.max(...slug.polygons.flat().map(p=>p.z));
Object.assign(movingZombie,{x:0,z:minCarZ-maxSlugZ+.02});
assert.equal(fresh.vehicleEntry(movingZombie,p(movingZombie.x,movingZombie.z),p(0,movingZombie.z-1),single),null,'passed car behind cannot block departure');
assert.equal(fresh.vehicleEntry(movingZombie,p(movingZombie.x,movingZombie.z),p(0,movingZombie.z+1),single),0,'movement into overlapping car remains blocked');
const walkingShape=fresh.zombie(movingZombie);
movingZombie.state='stuck';
assert.deepEqual(fresh.zombie(movingZombie),walkingShape,'obstacle hold preserves contact pose');
const rawFrame={...frame,uuid:'raw',texture:{width:4,height:4,image:{data:pixels}}};
assert.equal(fresh.mask(rawFrame)[0].left,-.25,'raw RGBA8 buffer reads alpha without drawImage');
const delayedFrame={...frame,uuid:'delayed',texture:{width:4,height:4,image:null}};
const delayedStyle={...sprite,frame:delayedFrame};
const cachedShapes=fresh.shapes.size;
fresh.shape(delayedStyle,'zombie',.1);
assert.equal(fresh.shapes.size,cachedShapes,'failed read cannot cache rectangular geometry');
assert.equal(fresh.masks.has(delayedFrame),false,'failed read cannot cache rectangular mask');
delayedFrame.texture.image={data:pixels};
fresh.maskFailures.set(delayedFrame,Date.now()-1001);
const recovered=fresh.shape(delayedStyle,'zombie',.1);
assert.equal(fresh.maskFailures.has(delayedFrame),false,'image availability recovers contour');
assert.equal(fresh.mask(delayedFrame)[0].left,-.25);
assert.equal(recovered.polygons.length,1);
const bodyPixels=(size,column,rows)=>{const data=new Uint8ClampedArray(size*size*4);for(const y of rows)data[(y*size+column)*4+3]=255;return data;};
const packedUv=(x,y,w,h,size)=>[x/size,(y+h)/size,(x+w)/size,(y+h)/size,x/size,y/size,(x+w)/size,y/size];
const atlasTexture={width:16,height:16,image:null};
const packedFrame={...frame,uuid:'packed',rect:{x:6,y:5,width:4,height:4},uv:packedUv(6,5,4,4,16),texture:atlasTexture,
    original:{_texture:{width:4,height:4,image:{data:bodyPixels(4,1,[1,2])}},_x:0,_y:0}};
assert.deepEqual(fresh.mask(packedFrame),[{left:-.25,right:0,bottom:-.25,top:.25}],'dynamic atlas frame reads its original image');
assert.equal(fresh.maskFailures.has(packedFrame),false,'dynamic atlas frame is not a failed read');
const packedTrimmed={...frame,uuid:'packed-trimmed',rect:{x:7,y:8,width:4,height:4},uv:packedUv(7,8,4,4,16),texture:atlasTexture,
    original:{_texture:{width:8,height:8,image:{data:bodyPixels(8,3,[2,3])}},_x:2,_y:1}};
assert.deepEqual(fresh.mask(packedTrimmed),[{left:-.25,right:0,bottom:-.25,top:.25}],'atlas offset keeps the trimmed source rectangle');
const packedStyle={...sprite,frame:packedFrame};
const packedShape=fresh.shape(packedStyle,'zombie',.1);
assert.equal(packedShape.polygons.length,1);
const unpackedFrame={...frame,uuid:'unpacked',texture:{width:4,height:4,image:{data:bodyPixels(4,1,[1,2])}}};
assert.deepEqual(packedShape,fresh.shape({...sprite,frame:unpackedFrame},'zombie',.1),'packed and unpacked frames give the same contour');
const lostFrame={...packedFrame,uuid:'packed-lost',original:null};
assert.equal(JSON.stringify(fresh.mask(lostFrame)),JSON.stringify([{left:-.5,bottom:-.5,right:.5,top:.5}]),'atlas texture without its source image still falls back');
assert.equal(fresh.maskFailures.has(lostFrame),true);
const fullBody=rect(-1,-1,1,1), trap=rect(-2,-2,2,0);
const rearBody=obstacleBodyShape(fullBody,p(0,-1));
assert.equal(shapeEntry(fullBody,p(0,3),p(0,.9),trap,origin)!==undefined,true);
assert.equal(shapeEntry(rearBody,p(0,3),p(0,.01),trap,origin),undefined,'front half may overlap without trapping');
assert.equal(shapeEntry(rearBody,p(0,3),p(0,-3),trap,origin),.5,'capture at body midpoint');
assert.equal(shapeEntry(fullBody,p(0,3),p(0,-3),trap,origin),1/3,'original vehicle body remains unchanged');
for(const d of [p(1,0),p(-1,0),p(0,1),p(1,1),p(-1,-1)]) {
    const h=obstacleBodyShape(fullBody,d), dots=h.polygons.flat().map(v=>v.x*d.x+v.z*d.z);
    assert.ok(Math.abs(Math.max(...dots))<1e-9,'directional half ends at body midpoint');
}
assert.equal(obstacleBodyShape(fullBody,p(0,-1),0),fullBody);
const hollow={polygons:[...rect(-2,-2,-1,2).polygons,...rect(1,-2,2,2).polygons]};
assert.equal(shapeEntry(obstacleBodyShape(hollow,p(0,-1)),p(0,3),p(0,-3),rect(-.5,-.1,.5,.1),origin),undefined,'cut preserves transparent body gap');
const offsetBody=rect(3,4,5,8);
assert.equal(Math.min(...obstacleBodyShape(offsetBody,p(0,-1)).polygons.flat().map(v=>v.z)),6,'opaque bounds, not pivot, set halfway');
const capture=new exportsObject.SpriteContacts(w,settings,{node:{worldRotation:{}}},()=>sprite);
capture.zombie=()=>fullBody;
capture.shape=()=>trap;
w.spriteContacts=capture;
w.layout.obstacles=[{...obstacle,id:'deep',x:0,z:0}];
Object.assign(z,{x:0,z:.1,state:'walking',direction:p(0,-1)});z.visitedObstacles.clear();
applyObstacles(w,z,p(0,3));assert.equal(z.state,'walking');assert.equal(z.visitedObstacles.size,0);
Object.assign(z,{z:-.1});applyObstacles(w,z,p(0,.1));
assert.equal(z.state,'stuck');assert.ok(Math.abs(z.z)<1e-9);assert.equal(z.timer,10);
const cachedBody=capture.obstacleBodies.get(z).body;
Object.assign(z,{z:-4,state:'walking'});z.visitedObstacles.clear();applyObstacles(w,z,p(0,4));
assert.equal(z.state,'stuck');assert.ok(Math.abs(z.z)<1e-9,'fast flight catches midpoint without tunnelling');
assert.equal(capture.obstacleBodies.get(z).body,cachedBody,'stable direction reuses clipped body');
const smallTrap=rect(-2,-.05,2,0);capture.shape=()=>smallTrap;
Object.assign(z,{z:-4,state:'walking'});z.visitedObstacles.clear();applyObstacles(w,z,p(0,4));
assert.equal(z.state,'stuck');assert.ok(Math.abs(z.z)<1e-9,'thin obstacle still catches at midpoint');
const sideContacts=new exportsObject.SpriteContacts(w,settings,{node:{worldRotation:{}}},()=>sprite);
const slugShape=rect(-.3,-.3,.3,.3);
const taperedCar={polygons:[[{x:-2,z:-1},{x:2,z:-1},{x:2,z:.2},{x:1.5,z:1},{x:-2,z:1}]]};
sideContacts.zombie=()=>slugShape;
sideContacts.shape=()=>taperedCar;
for(const direction of [-1,1]) {
    const vehicle={...car,x:0,z:0,direction,axis:'x'};
    const shape=direction===1?taperedCar:{polygons:taperedCar.polygons.map(poly=>poly.map(v=>p(-v.x,v.z)).reverse())};
    sideContacts.shape=()=>shape;
    const waiting={...z,x:direction*1.7,z:1.25,state:'walking',direction:p(0,-1)};
    assert.notEqual(shapeEntry(shape,origin,p(direction*.2,0),slugShape,waiting),undefined,'tapered lower side actually reaches body');
    assert.equal(sideContacts.frontHit({...vehicle,x:direction*.2},origin,waiting),false,'lower side is not a front impact');
    const victim={...waiting,x:direction*2.5,z:0};
    assert.equal(sideContacts.frontHit({...vehicle,x:direction},origin,victim),true,'front bumper still kills');
    Object.assign(waiting,{x:0,z:2});
    for(let frame=0;frame<240;frame++) {
        const from=p(vehicle.x,vehicle.z);
        vehicle.x+=direction*.025;
        assert.equal(sideContacts.frontHit(vehicle,from,waiting),false,'waiting slug survives passing side');
        moveAroundVehicles(waiting,[vehicle],.025,p(0,-5),20,p(.3,.3),(a,b,c)=>sideContacts.vehicleEntry(waiting,a,b,c));
    }
    assert.ok(waiting.z<0,'slug resumes toward finish after car clears');
}
for (const direction of [-1,1]) {
    const mirror=shape=>direction===1?shape:{polygons:shape.polygons.map(poly=>poly.map(v=>p(-v.x,v.z)).reverse())};
    const shape=mirror(taperedCar);
    sideContacts.shape=()=>shape;
    const beside={...z,x:direction*1.2,z:1.25,state:'walking',direction:p(0,-1)};
    const diagonal={...z,x:direction*3.4,z:1.25,state:'walking',direction:p(0,-1)};
    const vehicle={...car,x:0,z:0,direction,axis:'x'};
    for(let frame=0;frame<240;frame++) {
        const from=p(vehicle.x,vehicle.z);
        vehicle.x+=direction*.025;
        assert.equal(sideContacts.frontHit(vehicle,from,beside),false,'slug waiting at the lower side never dies');
        assert.equal(sideContacts.frontHit(vehicle,from,diagonal),false,'slug diagonally beside the bumper is not a front hit');
    }
    const front={...z,x:direction*3.4,z:.7,state:'walking',direction:p(0,-1)};
    const passing={...car,x:0,z:0,direction,axis:'x'};
    let dead=false;
    for(let frame=0;frame<240 && !dead;frame++) {
        const from=p(passing.x,passing.z);
        passing.x+=direction*.025;
        dead=sideContacts.frontHit(passing,from,front)===true;
    }
    assert.equal(dead,true,'slug in the car lane still dies from the front bumper');
}
for (const direction of [-1,1]) for (const state of ['walking','stuck']) for (const dt of [1/120,1/30,.25]) {
    const world=new World(1,42,{zombieCount:1,driverExitEnabled:false});
    const victim=world.zombies[0];
    Object.assign(victim,{x:direction*2.25,z:.9,state,timer:10});
    const vehicle=spawnVehicle(world,'ordinary',0);
    Object.assign(vehicle,{x:0,z:0,axis:'x',direction,speed:6,cruise:6,reaction:100,lane:0,targetLane:0});
    const shape=direction===1?taperedCar:{polygons:taperedCar.polygons.map(poly=>poly.map(v=>p(-v.x,v.z)).reverse())};
    sideContacts.shape=()=>shape;
    world.spriteContacts=sideContacts;
    assert.equal(shapeEntry(shape,origin,origin,slugShape,victim),undefined,'victim starts outside recessed nose');
    for(let i=0;i<Math.ceil(.3/dt) && victim.state!=='dead';i++) updateTraffic(world,dt,false);
    assert.equal(victim.state,'dead',`recessed opaque front hits ${state}, direction ${direction}, dt ${dt}`);
    assert.equal(vehicle.hits,1,'front impact counted exactly once');
    assert.equal(world.events.filter(e=>e.type==='hit').length,1,'one death event');
}
console.log('PASS recessed front: both directions, walking and obstacle-held victims, 120/30 FPS and fast sweep');
console.log('PASS lower car side: tapered silhouette, both directions, waiting and resuming, lethal front bumper');
console.log('PASS obstacle overlap: half-body entry, directions, opaque offsets, holes, incremental movement, fast flight, thin obstacles, cache and unchanged vehicle silhouette');
console.log('PASS sprite contacts: dynamic atlas frames, swept silhouettes, concave gaps, shadow thresholds, unshifted contours, precise walking barrier, hold pose, vehicle clipping, RGBA8, failed-read recovery');
