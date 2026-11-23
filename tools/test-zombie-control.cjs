
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = file => ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText;
require.extensions['.ts'] = (module, file) => module._compile(compile(file), file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const load = (file, cc) => {
    const exports = {};
    vm.runInNewContext(compile(__dirname + '/../assets/Scripts/game/presentation/' + file), {
        exports, require: id => {
            if (id === 'cc') return cc;
            if (id === './ScreenFit') return require('../assets/Scripts/game/presentation/ScreenFit.ts');
            if (id === '../domain/Model') return require('../assets/Scripts/game/domain/Model.ts');

            assert.ok(['../../../base/pools/SmartNodePool', './ActorAnimation', './WorldSprites'].includes(id));
            return {};
        }
    });
    return exports;
};
const listeners = [];
const events = {
    on(type, fn, target) { listeners.push({ type, fn, target }); },
    off(type, fn, target) { const i = listeners.findIndex(l => l.type === type && l.fn === fn && l.target === target); if (i >= 0) listeners.splice(i, 1); },
    emit(type) { for (const l of [...listeners]) if (l.type === type) l.fn.call(l.target); }
};
const { SlingshotInput } = load('SlingshotInput.ts', {
    Input: { EventType: {} }, input: events, game: events, Game: { EVENT_HIDE: 'hide' },
    EventMouse: { BUTTON_LEFT: 0 }, geometry: { Ray: class {} },
    view: { getViewportRect: () => ({ x: 0, y: 0, width: 1280, height: 720 }), getVisibleSize: () => ({ width: 1280, height: 720 }) }
});
const camera = {
    screenPointToRay(x, y, ray) { ray.o = { x, y: 10, z: -y }; ray.d = { x: 0, y: -1, z: 0 }; },
    worldToScreen(p) { return { x: p.x, y: -p.z }; }
};
const mouse = (x, y) => ({ getButton: () => 0, getLocationX: () => x, getLocationY: () => y });
const touch = (x, y) => ({ getID: () => 7, getLocation: () => ({ x, y }) });
for (const device of ['mouse', 'touch']) {
    const w = new World(1, 42, { zombieCount: 2 });
    const z = w.zombies[0]; Object.assign(z, { x: 400, z: -200 });
    let visible = false, shows = 0;
    const view = { zombiePickPosition: (x, z) => ({ x, z }), showAim(origin, pull) {
        visible = !!origin && !!pull; if (visible) shows++;
    } };
    const c = new SlingshotInput(camera, () => w, view);
    const event = device === 'mouse' ? mouse : touch;
    const down = p => c[device === 'mouse' ? 'mouseDown' : 'touchStart'](event(...p));
    const move = p => c[device === 'mouse' ? 'mouseMove' : 'touchMove'](event(...p));
    const up = p => c[device === 'mouse' ? 'mouseUp' : 'touchEnd'](event(...p));
    down([400, 200]); c.cancel(); assert.equal(z.state, 'idle');
    down([400, 200]); up([400, 200]); assert.equal(z.state, 'idle');
    down([400, 200]); move([400, 300]); assert.equal(visible, true);
    up([400, 300]); assert.equal(z.state, 'walking'); assert.equal(visible, false);
    assert.equal(w.events.filter(e => e.type === 'launched').length, 1);
    const previousShows = shows;
    for (const state of ['walking', 'stuck', 'fallen', 'eating', 'saved', 'dead', 'lost']) {
        z.state = state;
        const before = JSON.stringify(z);
        down([400, 200]); move([450, 250]); up([450, 250]);
        assert.equal(c.aiming, false); assert.equal(visible, false);
        assert.equal(shows, previousShows, `no aim for ${state}`);
        assert.equal(w.launch(z.id, { x: 1, z: -3 }), false);
        assert.equal(JSON.stringify(z), before);
    }

    z.state = 'idle'; down([400, 200]); move([400, 300]);
    z.state = 'walking'; move([400, 310]);
    assert.equal(visible, false); assert.equal(c.aiming, false);
    up([400, 310]); assert.equal(w.events.filter(e => e.type === 'launched').length, 1);
    c.destroy();
    console.log(`PASS ${device}: single launch; no reselection/aim; cancel and short drag preserve launch`);
}
for (const state of ['stuck', 'fallen', 'eating']) {
    const w = new World(1, 42, { maxVehicles: 0 });
    const z = w.zombies[0]; assert.equal(w.launch(z.id, { x: 0, z: -3 }), true);
    z.state = state; z.timer = 0.01;
    updateZombies(w, 1 / 60); assert.equal(z.state, 'walking');
    assert.equal(w.launch(z.id, { x: 3, z: 0 }), false);
}
for (const pull of [{ x: 0, z: 3 }, { x: 3, z: 1 }, { x: -3, z: 0 }, { x: 0, z: -0.1 }, { x: NaN, z: -3 }, { x: 0, z: -Infinity }]) {
    const w = new World();
    const before = JSON.stringify(w.zombies[0]);
    assert.equal(w.launch(1, pull), false);
    assert.equal(JSON.stringify(w.zombies[0]), before);
    assert.equal(w.events.length, 0);
    assert.equal(w.launch(1, { x: 0, z: -3 }), true);
}
for (const x of [-3, 0, 3]) {
    const w = new World();
    assert.equal(w.launch(1, { x, z: -3 }), true);
    assert.ok(w.zombies[0].direction.z < 0);
}
console.log('PASS domain rejects backward, sideways, short and invalid launches without consuming control');
assert.equal(new World().launch(1, { x: 0, z: -3 }), true);
console.log('PASS recovery never unlocks control; fresh round allows launch');
class Vec3 {
    constructor(x, y, z) { Object.assign(this, { x, y, z }); }
    add(p) { this.x += p.x; this.y += p.y; this.z += p.z; return this; }
}
const { WorldView } = load('WorldView.ts', { Vec3 });
for (const sprite of [false, true]) for (let level = 1; level <= 5; level++) {
    const w = new World(level, 42, { zombieCount: 1, laneWidths: [5, 5, 5, 5, 5], laneOffsetZ: 3.5 });
    const z = w.zombies[0]; z.state = 'walking';
    const v = Object.create(WorldView.prototype);
    let position;
    const visual = { node: { setPosition: (x, y, z) => position = { x, y, z }, setRotationFromEuler() {} },
        animations: [], ...(sprite ? { sprite: {} } : {}) };
    v.visuals = new Map([[`z${z.id}`, visual]]); v.staticSprites = [];
    v.sprites = { pose: (_, x, y, z) => position = { x, y, z } };
    const style = { width: 1, height: 1, lift: 0.02, bottomAnchor: false, billboard: false, frame: {} };
    v.settings = { spriteFor: () => null };
    v.zombieSkins = sprite ? [style] : [];
    for (const point of [6.61, 6.6, 6.59, 5.85, 5.11, 5.1, 5.09, ...w.layout.laneCenters]) {
        z.z = point; v.sync(w);
        assert.equal(position.y, 0.1, `level ${level}, Z=${point}, sprite=${sprite}`);
        assert.ok(position.y > 0.076 + 0.01 / 2, 'feet stay above lane surface');
        if (sprite) assert.equal(v.zombiePickPosition(z.x, point).y, position.y + style.lift);
    }
}
console.log('PASS sprite/prefab height stays above every lane, including old ditch; picking matches');
for (const device of ['mouse', 'touch']) {
    const w = new World(1, 42, { zombieCount: 2, maxVehicles: 0 });
    const z = w.zombies[0];
    z.direction = { x: 1, z: 0 }; z.wander = 10;
    const camera = {
        screenPointToRay(x, y, ray) { ray.o = { x: (x - 500) / 10, y: 10, z: (400 - y) / 10 }; ray.d = { x: 0, y: -1, z: 0 }; },
        worldToScreen(p) { return { x: 500 + p.x * 10, y: 400 - p.z * 10 }; },
    };
    const node = () => ({ setPosition(x, y, z) { this.position = { x, y, z }; }, setScale(x, y, z) { this.scale = { x, y, z }; }, setRotationFromEuler() {} });
    const v = Object.create(WorldView.prototype); v.aim = node(); v.marker = node();
    v.zombiePickPosition = (x, z) => ({ x, z });
    const c = new SlingshotInput(camera, () => w, v);
    const p = camera.worldToScreen(z), event = device === 'mouse' ? mouse : touch;
    c[device === 'mouse' ? 'mouseDown' : 'touchStart'](event(p.x, p.y));
    c[device === 'mouse' ? 'mouseMove' : 'touchMove'](event(p.x + 10, p.y + 30));
    const start = { x: z.x, z: z.z };
    for (let frame = 0; frame < 60; frame++) {
        w.update(1 / 60); c.update();
        assert.equal(v.aim.active, true);
        assert.ok(Math.abs(v.aim.position.x - 0.5 - z.x) < 1e-9);
        assert.ok(Math.abs(v.aim.position.z + 1.5 - z.z) < 1e-9);
        assert.ok(Math.abs(v.marker.position.x - 1 - z.x) < 1e-9);
        assert.ok(Math.abs(v.marker.position.z + 3 - z.z) < 1e-9);
    }
    assert.deepEqual({ x: z.x, z: z.z }, start);
    assert.equal(z.aimHeld, true);
    c[device === 'mouse' ? 'mouseUp' : 'touchEnd'](event(p.x + 10, p.y + 30));
    assert.equal(z.state, 'walking'); assert.ok(z.direction.z < 0);
    assert.equal(v.aim.active, false); c.destroy();
}
console.log('PASS selected slug stays still and WorldView aim remains aligned across 60 frames for mouse/touch');
for (const device of ['mouse', 'touch']) {
    const w = new World(1, 42, { zombieCount: 1, maxVehicles: 0 });
    const z = w.zombies[0];
    const { attachIdleMovement } = require('../assets/Scripts/game/domain/IdleMovement.ts');
    attachIdleMovement(z, { mode: 2, jumpMin: 3.3, jumpMax: 5.5, jumpDuration: 0.25, jumpsMin: 1, jumpsMax: 2, jumpPause: 0.15, restMin: 1, restMax: 2.5, jumpHeight: 2 }, w.random);
    w.update(0.125); assert(z.idleMotion.height > 1);
    const camera = {
        screenPointToRay(x,y,ray) { ray.o={x:(x-500)/10,y:10,z:(400-y)/10}; ray.d={x:0,y:-1,z:0}; },
        worldToScreen(p) { return {x:500+p.x*10,y:400-p.z*10+p.y*60}; }
    };
    const v = Object.create(WorldView.prototype);
    v.settings={spriteFor:()=>null}; v.zombieSkins=[];
    const node=()=>({setPosition(x,y,z){this.position={x,y,z};},setScale(){},setRotationFromEuler(){}});
    v.aim=node(); v.marker=node();
    const c=new SlingshotInput(camera,()=>w,v);
    const p=camera.worldToScreen(v.zombiePickPosition(z.x,z.z,0,z.idleMotion.height));
    const event=device==='mouse'?mouse:touch;
    c[device==='mouse'?'mouseDown':'touchStart'](event(p.x,p.y)); assert(c.aiming);
    c[device==='mouse'?'mouseMove':'touchMove'](event(p.x,p.y+20));
    const frozen = JSON.stringify(z);
    for (let frame = 0; frame < 60; frame++) { w.update(1/60); c.update(); }
    assert.equal(JSON.stringify(z), frozen);
    assert.equal(v.aim.position.y,0.18+z.idleMotion.height);
    c.cancel(); assert.equal(z.aimHeld, undefined);
    w.update(1/60); assert.notEqual(z.idleMotion.height, JSON.parse(frozen).idleMotion.height);
    const again=camera.worldToScreen(v.zombiePickPosition(z.x,z.z,0,z.idleMotion.height));
    c[device==='mouse'?'mouseDown':'touchStart'](event(again.x,again.y));
    c[device==='mouse'?'mouseMove':'touchMove'](event(again.x,again.y+20));
    c[device==='mouse'?'mouseUp':'touchEnd'](event(p.x,p.y+20));
    assert.equal(z.state,'walking'); assert.equal(w.launch(z.id,{x:0,z:-1}),false); c.destroy();
    console.log(`PASS ${device}: airborne spawn picking, moving aim and single launch`);
}
for (const device of ['mouse', 'touch']) for (const release of ['cancel', 'short', 'backward', 'outside', 'pause', 'hide', 'destroy', 'replacement']) {
    let w = new World(1, 42, { zombieCount: 2, maxVehicles: 0 });
    const z = w.zombies[0], other = w.zombies[1];
    z.direction = other.direction = { x: 1, z: 0 }; z.wander = other.wander = 10;
    const camera = {
        screenPointToRay(x,y,ray) { ray.o={x:(x-500)/10,y:10,z:(400-y)/10}; ray.d={x:0,y:-1,z:0}; },
        worldToScreen(p) { return {x:500+p.x*10,y:400-p.z*10}; }
    };
    const c = new SlingshotInput(camera, () => w, { zombiePickPosition:(x,z)=>({x,z}), showAim(){} });
    const p = camera.worldToScreen(z), event=device==='mouse'?mouse:touch;
    c[device==='mouse'?'mouseDown':'touchStart'](event(p.x,p.y));
    const before=JSON.stringify(z), otherX=other.x;
    for(let i=0;i<60;i++) w.update(1/60);
    assert.equal(JSON.stringify(z),before); assert.notEqual(other.x,otherX);
    if(release==='short') c[device==='mouse'?'mouseUp':'touchEnd'](event(p.x,p.y));
    else if(release==='backward') c[device==='mouse'?'mouseUp':'touchEnd'](event(p.x,p.y-20));
    else if(release==='outside') c[device==='mouse'?'mouseUp':'touchEnd'](event(-10,-10));
    else if(release==='pause') { w.paused=true; c.update(); w.paused=false; }
    else if(release==='destroy') c.destroy();
    else if(release==='replacement') { w=new World(1,43,{maxVehicles:0}); c.update(); }
    else if(release==='hide') events.emit('hide');
    else c.cancel();
    assert.equal(z.aimHeld,undefined); assert.equal(z.state,'idle'); assert.equal(c.aiming,false);
    const x=z.x; updateZombies({ ...w, zombies:[z], drivers:[], vehicles:[] },1/60); assert.notEqual(z.x,x);
    c.destroy();
}
console.log('PASS mouse/touch: only held slug freezes; cancel, short/backward/outside release, pause, hide, destroy and world replacement resume movement');
require('./test-input.cjs');
