
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { spawnVehicle, hitZombie, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function cross(w, z) {
    Object.assign(z, { x: 5, z: w.layout.finishZ + 0.001, state: 'walking', direction: { x: 0, z: -1 }, disoriented: 10 });
    updateZombies(w, 1 / 60);
    assert.equal(z.state, 'saved');
}
test('spawn offset shifts positions and idle bounds, not road or finish; launch remains valid', () => {
    const a = new World(1, 42, { spawnOffsetZ: 0 }), b = new World(1, 42, { spawnOffsetZ: 4 });
    assert.equal(b.layout.finishZ, a.layout.finishZ);
    assert.deepEqual(b.layout.laneCenters, a.layout.laneCenters);
    for (let i = 0; i < a.zombies.length; i++) assert.ok(Math.abs(b.zombies[i].z - a.zombies[i].z - 4) < 1e-10);
    for (let step = 0; step < 3600; step++) { updateZombies(a, 1 / 60); updateZombies(b, 1 / 60); }
    for (let i = 0; i < a.zombies.length; i++) {
        assert.ok(Math.abs(b.zombies[i].z - a.zombies[i].z - 4) < 1e-8);
        assert.equal(b.zombies[i].state, 'idle');
    }
    const z = b.zombies[0]; z.z = b.layout.spawnZ + 1.6;
    assert.equal(b.launch(z.id, { x: 0, z: -2 }), true);
    updateZombies(b, 1 / 60); assert.equal(z.state, 'walking');
    const { DEFAULT_CONFIG, createLayout } = require('../assets/Scripts/game/domain/Model.ts');
    assert.equal(new World().layout.spawnZ, createLayout(1).spawnZ + DEFAULT_CONFIG.spawnOffsetZ);
    for (const invalid of [NaN, Infinity, -Infinity])
        assert.equal(new World(1, 42, { spawnOffsetZ: invalid }).config.spawnOffsetZ, DEFAULT_CONFIG.spawnOffsetZ);
    for (const offset of [-4, 4, 999]) {
        const w = new World(1, 42, { spawnOffsetZ: offset });
        assert.equal(w.config.spawnOffsetZ, offset);
        assert.equal(w.layout.spawnZ, a.layout.spawnZ + offset);
    }
    const settings = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/GameSettings.ts'), 'utf8');
    assert.ok(!settings.includes('spawnOffsetZ'), 'Inspector must not override the code-only spawn setting');
});
test('saved crowd gets unique safe positions and only one event each, stays immune and unlaunchable', () => {
    const w = new World(4, 42, { zombieCount: 100 });
    for (const z of w.zombies) cross(w, z);
    assert.equal(new Set(w.zombies.map(z => JSON.stringify(z.savedTarget))).size, 100);
    assert.equal(w.drainEvents().filter(e => e.type === 'saved').length, 100);
    const car = spawnVehicle(w, 'jeep', 0);
    assert.ok(car);
    for (const z of w.zombies) {
        assert.equal(w.launch(z.id, { x: 0, z: 3 }), false);
        hitZombie(w, car, z);
        assert.equal(z.state, 'saved');
        assert.ok(Math.abs(z.savedTarget.x) >= 3);
    }
    for (let step = 0; step < 6000; step++) {
        updateZombies(w, 1 / 60);
        if (step < 10) updateTraffic(w, 1 / 60, false);
        for (const z of w.zombies) assert.ok(z.z <= w.layout.finishZ);
    }
    for (const z of w.zombies) assert.ok(Math.hypot(z.x - z.savedTarget.x, z.z - z.savedTarget.z) < 0.001);
    assert.equal(w.drainEvents().filter(e => e.type === 'saved').length, 0);
    assert.equal(w.remains.length, 0);
    assert.equal(w.finish().saved, 100);
    assert.equal(w.zombies.filter(z => z.state === 'saved').length, 100);
});
test('saved crowd persists on pause/result and resets on retry/next level', () => {
    const flow = new GameFlow(new Progress({ getItem: () => null, setItem: () => {} }), { zombieCount: 2 }, 42);
    flow.start(); cross(flow.world, flow.world.zombies[0]);
    flow.pause(); const snapshot = JSON.stringify(flow.world.zombies);
    flow.update(0.25); assert.equal(JSON.stringify(flow.world.zombies), snapshot);
    flow.togglePause(); flow.world.zombies[1].state = 'dead'; flow.update(1 / 60);
    assert.equal(flow.screen, 'result'); assert.equal(flow.world.result.saved, 1);
    assert.equal(flow.world.zombies[0].state, 'saved');
    assert.equal(flow.advance(), true); assert.equal(flow.screen, 'prelevel'); flow.start();
    assert.ok(flow.world.zombies.every(z => z.state === 'idle' && !z.savedTarget));
    cross(flow.world, flow.world.zombies[0]); flow.pause(); flow.start();
    assert.ok(flow.world.zombies.every(z => z.state === 'idle' && !z.savedTarget));
});
test('WorldView.sync retains saved sprite and prefab visuals, hides dead/lost, clears old round', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldView.ts'), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require: () => ({}) });

    for (const sprite of [false, true]) {
        const view = Object.create(exports.WorldView.prototype);
        const w = new World(1, 42, { zombieCount: 3 });
        const z = w.zombies[0]; cross(w, z);
        w.zombies[1].state = 'dead'; w.zombies[2].state = 'lost';
        let positions = 0, animation;
        const visual = { node: { setPosition: () => positions++, setRotationFromEuler: () => {} },
            animations: [{ apply: state => animation = state }], ...(sprite ? { sprite: {} } : {}) };
        const key = `z${z.id}`;
        view.visuals = new Map([[key, visual]]); view.staticSprites = [];
        view.sprites = { pose: () => positions++ };
        let released = 0; view.release = () => released++;
        view.sync(w); view.sync(w);
        assert.equal(positions, 2); assert.equal(released, 0);
        assert.equal(view.visuals.get(key), visual); assert.equal(animation, 'walking');
        Object.assign(z, z.savedTarget); w.finish(); view.sync(w);
        assert.equal(animation, 'idle'); assert.equal(released, 0);
        view.clearActors(); assert.equal(released, 1); assert.equal(view.visuals.size, 0);
    }
});
console.log(`${count} saved/spawn checks passed (no GPU assertions)`);
