
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] ??= (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const root = path.resolve(__dirname, '..');
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const catalog = parseLevelCatalog(JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/levels.json'), 'utf8')));
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS boosters ${name}`); }
const memory = () => { const store = new Map(); return { store, port: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } }; };

test('new and old saves start with one charge of each booster; corrupt counts ignored', () => {
    assert.deepEqual(new Progress(memory().port).data.boosters, { slow: 1, teleport: 1 });
    const old = new Progress({ getItem: () => JSON.stringify({ version: 1, coins: 5, unlockedLevel: 1, best: {} }), setItem: () => {} });
    assert.deepEqual(old.data.boosters, { slow: 1, teleport: 1 }); assert.equal(old.data.coins, 5);
    const bad = new Progress({ getItem: () => JSON.stringify({ version: 1, coins: 0, unlockedLevel: 1, best: {}, boosters: { slow: -3, teleport: 4 } }), setItem: () => {} });
    assert.deepEqual(bad.data.boosters, { slow: 1, teleport: 4 });
});
test('slow: all cars move slower for exactly the duration, then normal speed again', () => {
    const run = slow => {
        const w = new World(1, 7, { zombieCount: 1, trafficInterval: 999 }, {}, catalog.levels[0]);
        const car = spawnVehicle(w, 'ordinary', 0); const x0 = car.x;
        if (slow) assert.equal(w.slowTraffic(5, 0.4), true);
        for (let i = 0; i < 60; i++) w.update(1 / 60);
        return { w, car, moved: Math.abs(car.x - x0) };
    };
    const normal = run(false), slowed = run(true);
    assert.ok(Math.abs(slowed.moved / normal.moved - 0.4) < 0.01, `ratio ${slowed.moved / normal.moved}`);
    assert.ok(Math.abs(slowed.w.slowTime - 4) < 0.02);
    for (let i = 0; i < 4 * 60 + 2; i++) slowed.w.update(1 / 60);
    assert.equal(slowed.w.slowTime, 0);
    const x = slowed.car.x; slowed.w.update(1 / 60);
    assert.ok(Math.abs(Math.abs(slowed.car.x - x) - slowed.car.speed / 60) < 1e-6, 'Back to full speed');
});
test('slow does not run during pause', () => {
    const w = new World(1, 7, { zombieCount: 1 }, {}, catalog.levels[0]);
    w.slowTraffic(5, 0.4); w.paused = true;
    for (let i = 0; i < 120; i++) w.update(1 / 60);
    assert.equal(w.slowTime, 5);
});
test('teleport: any zombie in play is saved at once, cars cannot hit it, it lands on its saved place', () => {
    const w = new World(1, 7, { zombieCount: 3, trafficInterval: 999 }, {}, catalog.levels[0]);
    const [idle, walking, dead] = w.zombies;
    Object.assign(walking, { state: 'walking', x: 0, z: w.layout.laneCenters[0] });
    dead.state = 'dead';
    assert.equal(w.teleport(dead.id), false, 'Dead zombies cannot be teleported');
    assert.equal(w.teleport(walking.id, 0.6), true);
    assert.equal(walking.state, 'saved'); assert.ok(walking.savedTarget);
    assert.equal(w.teleport(walking.id), false, 'Only once');

    const car = spawnVehicle(w, 'ordinary', 0); Object.assign(car, { x: walking.x - car.direction * 0.5, z: walking.z });
    for (let i = 0; i < 20; i++) w.update(1 / 60);
    assert.equal(walking.state, 'saved');
    for (let i = 0; i < 40; i++) w.update(1 / 60);
    assert.equal(walking.teleport, undefined);
    assert.deepEqual({ x: walking.x, z: walking.z }, walking.savedTarget);
    assert.ok(walking.z <= w.layout.finishZ, 'Behind the finish line');
    assert.equal(w.teleport(idle.id), true, 'Waiting zombies can be teleported too');
});
test('the last zombie teleported: the round ends after the animation, counted as saved', () => {
    const w = new World(1, 7, { zombieCount: 1 }, {}, catalog.levels[0]);
    w.teleport(w.zombies[0].id, 0.5);
    w.update(1 / 60); assert.equal(w.result, null, 'Animation plays first');
    for (let i = 0; i < 40 && !w.result; i++) w.update(1 / 60);
    assert.equal(w.result.saved, 1);
});
test('flow: charges are spent only on success, persist, and run out', () => {
    const { store, port } = memory();
    const p = new Progress(port);
    const f = new GameFlow(p, { zombieCount: 4 }, 3, 1, catalog);
    assert.equal(f.useSlow(5, 0.4), false, 'Not outside the round');
    assert.equal(f.armTeleport(), false);
    f.start();
    assert.equal(f.useSlow(5, 0.4), true); assert.equal(p.boosterCount('slow'), 0);
    assert.equal(f.useSlow(5, 0.4), false, 'No charges left');
    assert.equal(f.teleport(f.world.zombies[0].id, 0.5), false, 'Needs arming first');
    assert.equal(f.armTeleport(), true); assert.equal(f.teleportArmed, true);
    assert.equal(f.armTeleport(), false, 'Second press cancels'); assert.equal(f.teleportArmed, false);
    assert.equal(p.boosterCount('teleport'), 1, 'Cancel does not spend');
    f.armTeleport(); f.togglePause(); assert.equal(f.teleportArmed, false, 'Pause cancels target mode'); f.togglePause();
    f.armTeleport();
    f.world.zombies[1].state = 'dead';
    assert.equal(f.teleport(f.world.zombies[1].id, 0.5), false); assert.equal(p.boosterCount('teleport'), 1, 'Miss does not spend');
    assert.equal(f.teleport(f.world.zombies[0].id, 0.5), true);
    assert.equal(p.boosterCount('teleport'), 0); assert.equal(f.teleportArmed, false);
    assert.equal(f.armTeleport(), false, 'No charges left');
    assert.deepEqual(JSON.parse(store.get('zombie-road.progress.v1')).boosters, { slow: 0, teleport: 0 });
    p.addBooster('teleport', 2); assert.equal(new Progress(port).boosterCount('teleport'), 2, 'Shop-ready: added charges persist');
});
test('PlayingHud: level, saved/target, mark position, smooth fill, booster states', () => {
    class Btn { static EventType = { CLICK: 'click' }; constructor() { this.interactable = true; this.node = { on() {}, off() {} }; } getComponent() { return null; } }
    const cc = { _decorator: { ccclass: () => v => v, property: () => () => {} }, Component: class {}, Button: Btn, Label: class {}, Node: class {}, Sprite: class {}, UITransform: class {} };
    const exports = {};
    const src = ts.transpileModule(fs.readFileSync(path.join(root, 'assets/Scripts/game/presentation/PlayingHud.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
    vm.runInNewContext(src, { exports, require: id => id === 'cc' ? cc : {} });
    const hud = new exports.PlayingHud();
    const label = () => ({ string: '' });
    const nodeAt = x => ({ active: true, position: { x, y: 0, z: 0 }, setPosition(x, y, z) { this.position = { x, y, z }; } });
    Object.assign(hud, { levelLabel: label(), timeLabel: label(), savedLabel: label(), targetLabel: label(), slowCount: label(), teleportCount: label(),
        track: { width: 400, anchorX: 0.5, node: nodeAt(0) }, targetTrack: { width: 200 },
        targetFill: { width: 0, height: 58, node: { active: false }, setContentSize(w) { this.width = w; } },
        fill: { width: 0, height: 14, node: { active: false }, setContentSize(w) { this.width = w; } },
        slowButton: new Btn(), teleportButton: new Btn(), teleportArmed: { active: false }, teleportHint: { active: false } });
    const p = new Progress(memory().port);
    const f = new GameFlow(p, { zombieCount: 20 }, 3, 3, catalog);
    f.start();
    hud.refresh(f.world, p, f);
    assert.equal(hud.levelLabel.string, '003'); assert.equal(hud.savedLabel.string, '0 / 20'); assert.equal(hud.targetLabel.string, '0 / 5');
    assert.equal(hud.targetFill.width, 0);
    assert.equal(hud.fill.node.active, false, 'Empty bar at start');
    assert.equal(hud.slowCount.string, '×1'); assert.equal(hud.slowButton.interactable, true);
    f.world.zombies.slice(0, 10).forEach(z => z.state = 'saved');
    hud.refresh(f.world, p, f);
    assert.equal(hud.savedLabel.string, '10 / 20'); assert.equal(hud.fill.width, 0, 'Fill animates, not jumps');
    hud.update(0.1); assert.ok(Math.abs(hud.fill.width - 400 * 0.15) < 1e-6, 'Fills at fillSpeed');
    for (let i = 0; i < 10; i++) hud.update(0.1);
    assert.equal(hud.fill.width, 200, 'Stops at the saved share'); assert.equal(hud.fill.node.active, true);
    assert.equal(hud.targetFill.width, 200, 'Goal fill caps at full');
    assert.equal(hud.targetLabel.string, '10 / 5');
    f.useSlow(5, 0.4); hud.refresh(f.world, p, f);
    assert.equal(hud.slowCount.string, '5 с'); assert.equal(hud.slowButton.interactable, false);
    f.armTeleport(); hud.refresh(f.world, p, f);
    assert.equal(hud.teleportArmed.active, true); assert.equal(hud.teleportHint.active, true); assert.equal(hud.teleportButton.interactable, true, 'Pressable to cancel');
    f.togglePause(); hud.refresh(f.world, p, f);
    assert.equal(hud.teleportHint.active, false); assert.equal(hud.slowButton.interactable, false);

    assert.equal(f.start(), true); hud.refresh(f.world, p, f);
    assert.equal(hud.fill.node.active, false, 'New round resets the bar');
});
console.log(`${count} booster checks passed (domain, save, flow, presenter; no rendering assertions)`);
