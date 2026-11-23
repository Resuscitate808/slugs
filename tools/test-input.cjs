const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] ??= (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, file);
const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/SlingshotInput.ts'), 'utf8');
const events = { on() {}, off() {} };
const cc = {
    Input: { EventType: {} }, input: events, game: events, Game: { EVENT_HIDE: 'hide' },
    EventMouse: { BUTTON_LEFT: 0 }, geometry: { Ray: class {} },
    view: { getViewportRect: () => ({ x: 0, y: 0, width: 1280, height: 720 }), getVisibleSize: () => ({ width: 1280, height: 720 }) },
};
const out = {};
vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText, { exports: out, require: id => {
    if (id === './ScreenFit') return require('../assets/Scripts/game/presentation/ScreenFit.ts');
    if (id === '../domain/Model') return require('../assets/Scripts/game/domain/Model.ts');
    assert.equal(id, 'cc'); return cc;
} });
const camera = {
    screenPointToRay(x, y, ray) { ray.o = { x, y: 10, z: -y }; ray.d = { x: 0, y: -1, z: 0 }; },
    worldToScreen(p) { return { x: p.x, y: -p.z }; },
};
for (const device of ['mouse', 'touch']) {
    let aim = null, launch = null, enabled = true;
    const z = { id: 1, x: 400, z: -200, state: 'idle' };
    const world = { config: {}, zombies: [z], launch(id, direction) { launch = { id, ...direction }; } };
    const view = { zombiePickPosition: (x, z) => ({ x, z }), showAim(origin, direction) {
        aim = origin ? { origin: { x: origin.x, z: origin.z }, direction: { ...direction } } : null;
    } };
    const c = new out.SlingshotInput(camera, () => world, view, () => enabled);
    const event = (x, y) => device === 'mouse'
        ? { getButton: () => 0, getLocationX: () => x, getLocationY: () => y }
        : { getID: () => 7, getLocation: () => ({ x, y }) };
    const down = (x = 400, y = 200) => c[device === 'mouse' ? 'mouseDown' : 'touchStart'](event(x, y));
    const move = (x, y) => c[device === 'mouse' ? 'mouseMove' : 'touchMove'](event(x, y));
    const up = (x, y) => c[device === 'mouse' ? 'mouseUp' : 'touchEnd'](event(x, y));
    for (const [x, y] of [[400, 300], [450, 300], [350, 300]]) {
        down(); move(x, y);
        assert.deepEqual(aim.direction, { x: x - 400, z: 200 - y });
        up(x, y);
        assert.deepEqual(launch, { id: 1, x: x - 400, z: 200 - y });
        assert.equal(c.aiming, false);
        assert.equal(aim, null);
    }
    for (const [x, y] of [[400, 100], [450, 100], [450, 200], [400, 200]]) {
        launch = null; down(); move(x, y); c.update();
        assert.equal(aim, null); up(x, y); assert.equal(launch, null);
        assert.equal(c.aiming, false);
    }
    down(); move(450, 300);
    for (let frame = 0; frame < 30; frame++) {
        z.x += 0.1; z.z -= 0.05;
        c.update();
        assert.deepEqual(aim.origin, { x: z.x, z: z.z });
        assert.deepEqual(aim.direction, { x: 50, z: -100 });
    }
    up(450, 300); assert.deepEqual(launch, { id: 1, x: 50, z: -100 });
    z.x = 400; z.z = -200;
    for (const condition of ['paused', 'result', 'disabled', 'walking', 'missing']) {
        down(); move(400, 300);
        if (condition === 'paused') world.paused = true;
        if (condition === 'result') world.result = {};
        if (condition === 'disabled') enabled = false;
        if (condition === 'walking') z.state = 'walking';
        if (condition === 'missing') world.zombies = [];
        c.update(); assert.equal(aim, null); assert.equal(c.aiming, false);
        world.paused = false; world.result = null; enabled = true; z.state = 'idle'; world.zombies = [z];
    }
    down(); move(400, 100); assert.equal(aim, null);
    move(400, 300); assert.ok(aim); up(400, 300);
    down(); move(400, 300); move(400, 100); launch = null; up(400, 100); assert.equal(launch, null);
    c.destroy();
    console.log(`PASS ${device}: upward diagonals, downward/sideways rejection, stationary pointer tracking and frame cancellation`);
}
const bootstrap = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/GameBootstrap.ts'), 'utf8');
const refresh = bootstrap.slice(bootstrap.indexOf('private refresh('), bootstrap.indexOf('private togglePause('));
assert.ok(refresh.indexOf('this.controls.update()') > refresh.indexOf('this.visuals.sync(this.world)'));
console.log('PASS aim frame refresh follows current world visual synchronization');
