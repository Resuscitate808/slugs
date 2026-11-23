const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function fixture(axis = 'x', direction = 1, kind = 'ordinary') {
    const w = new World(1, 42, { zombieCount: 1, driverExitEnabled: false, bloodSlipChance: 0 }, {}, {
        id: 1, name: 'contact', median: false, intersection: true, obstacles: [], laneDirections: ['left', 'right']
    });
    const car = spawnVehicle(w, kind, 0);
    Object.assign(car, { x: 0, z: 0, axis, direction, lane: 0, targetLane: 0, speed: 6, cruise: 6, reaction: 100 });
    const z = w.zombies[0];
    Object.assign(z, { x: 0, z: 0, state: 'walking', goalX: 0, speed: 2, wander: 100, boost: 0, disoriented: 0 });
    return { w, car, z, cross: axis === 'x' ? 'z' : 'x' };
}
for (const axis of ['x', 'z']) for (const direction of [-1, 1]) {
    test(`${axis}/${direction}: front kills once, even across a long step; sides/rear do not`, () => {
        for (const kind of ['ordinary', 'jeep', 'pink']) {
            for (const state of ['walking', 'fallen', 'stuck']) {
                const { w, car, z, cross } = fixture(axis, direction, kind);
                z[axis] = direction * 1.4; z[cross] = 0.2; z.state = state;
                updateTraffic(w, 1 / 60, false);
                assert.equal(z.state, 'dead'); assert.equal(car.hits, 1); assert.equal(w.remains.length, 1);
                updateTraffic(w, 1 / 60, false);
                assert.equal(car.hits, 1); assert.equal(w.remains.length, 1);
            }
            for (const side of [-0.74, 0.74]) {
                const { w, car, z, cross } = fixture(axis, direction, kind);
                z[axis] = 0; z[cross] = side;
                updateTraffic(w, 1 / 60, false);
                assert.equal(z.state, 'walking'); assert.equal(car.hits, 0); assert.equal(w.remains.length, 0);
            }
            const rear = fixture(axis, direction, kind);
            rear.z[axis] = -direction * 1.4;
            updateTraffic(rear.w, 1 / 60, false); assert.equal(rear.z.state, 'walking');
        }
        const fast = fixture(axis, direction); fast.z[axis] = direction * 3;
        updateTraffic(fast.w, 1, false); assert.equal(fast.z.state, 'dead');
        const miss = fixture(axis, direction); miss.z[axis] = direction * 1.4; miss.z[miss.cross] = 0.8;
        updateTraffic(miss.w, 1 / 60, false); assert.equal(miss.z.state, 'walking');
    });
}
test('stationary, abandoned, saved and lateral-only contacts never kill', () => {
    for (const mode of ['stopped', 'abandoned', 'zero', 'saved', 'lateral']) {
        const { w, car, z } = fixture('x', 1, 'jeep');
        z.x = mode === 'saved' ? 1.4 : 0;
        if (mode === 'stopped') car.stopped = 30;
        if (mode === 'abandoned') car.abandoned = true;
        if (mode === 'zero' || mode === 'lateral') car.speed = car.cruise = 0;
        if (mode === 'saved') z.state = 'saved';
        if (mode === 'lateral') { car.targetLane = 2; z.z = 0.6; }
        updateTraffic(w, 0.2, false);
        assert.notEqual(z.state, 'dead'); assert.equal(w.remains.length, 0); assert.equal(car.hits, 0);
    }
});
test('lane-change body sweep never kills; only a later front hit does', () => {
    for (const direction of [-1, 1]) for (const side of [-1, 1]) {
        const { w, car, z } = fixture('x', direction);
        car.targetLane = side * 3;
        z.x = 0; z.z = side * 1.2;
        updateTraffic(w, 0.25, false);
        assert.equal(z.state, 'walking', 'lateral body must not kill');
        assert.equal(car.hits, 0); assert.equal(w.remains.length, 0);
        updateTraffic(w, 0.25, false);
        assert.equal(car.hits, 0);
        const rear = fixture('x', direction);
        rear.car.targetLane = side * 3;
        rear.z.x = 0; rear.z.z = -side * 1.2;
        updateTraffic(rear.w, 0.25, false);
        assert.equal(rear.z.state, 'walking', 'moving away is safe');
        const front = fixture('x', direction);
        front.car.targetLane = side * 3;
        front.z.x = direction * 4; front.z.z = side * 3;
        for (let i = 0; i < 4 && front.z.state !== 'dead'; i++) updateTraffic(front.w, 0.25, false);
        assert.equal(front.z.state, 'dead', 'front bumper still kills ahead in the target lane');
        assert.equal(front.car.hits, 1);
    }
});
test('walking zombie waits at stopped cars on both axes without crossing their body', () => {
    for (const axis of ['x', 'z']) for (const direction of [-1, 1]) for (const x of [-0.3, 0, 0.3]) {
        const { w, car, z } = fixture(axis, direction);
        car.stopped = 100; z.x = x; z.goalX = x; z.z = 2;
        for (let i = 0; i < 300; i++) {
            updateTraffic(w, 1 / 60, false); updateZombies(w, 1 / 60);
            assert.equal(z.x, x); assert.equal(z.state, 'walking');
            assert.ok(z.z >= (axis === 'x' ? 0.63 : 1.11) - 1e-6);
        }
        w.vehicles = [];
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) updateZombies(w, 1 / 60);
        assert.equal(z.state, 'saved'); assert.equal(w.remains.length, 0);
    }
});
test('side contact with passing car survives and resumes crossing', () => {
    for (const direction of [-1, 1]) {
        const { w, z } = fixture('x', direction);
        z.z = 0.76;
        for (let i = 0; i < 400 && z.state !== 'saved'; i++) {
            updateTraffic(w, 1 / 60, false); updateZombies(w, 1 / 60);
            assert.notEqual(z.state, 'dead');
        }
        assert.equal(z.state, 'saved'); assert.equal(w.remains.length, 0);
    }
});
test('fast zombie launch cannot tunnel through parked car; another car blocks detour', () => {
    const { w, car, z } = fixture(); car.abandoned = true; z.z = 2;
    w.launch(z.id, { x: 0, z: -4 }); z.speed = 100;
    updateZombies(w, 0.25);
    assert.ok(Math.abs(z.x) >= 1.35 || Math.abs(z.z) >= 0.63);
    assert.equal(z.state, 'walking');
    const second = { ...car, id: 999, x: -2.5, z: 0 };
    w.vehicles.push(second); z.speed = 2;
    for (let i = 0; i < 120; i++) {
        updateZombies(w, 1 / 60);
        for (const c of w.vehicles) assert.ok(Math.abs(z.x - c.x) >= 1.35 - 1e-6 || Math.abs(z.z - c.z) >= 0.63 - 1e-6);
    }
});
test('two parked cars block movement; initial overlap stays still without teleporting', () => {
    for (const setup of ['adjacent', 'squeezed']) {
        const { w, car, z } = fixture(); car.abandoned = true;
        const second = { ...car, id: 999, x: setup === 'adjacent' ? -2.8 : 0, z: setup === 'adjacent' ? 0 : 1.2 };
        w.vehicles.push(second); z.z = setup === 'adjacent' ? 2 : 0.6;
        for (let i = 0; i < 900 && z.state !== 'saved'; i++) {
            updateZombies(w, 1 / 60);
            if (setup === 'squeezed') { assert.equal(z.x, 0); assert.equal(z.z, 0.6); }
            else for (const c of w.vehicles) assert.ok(Math.abs(z.x - c.x) >= 1.35 - 1e-6 || Math.abs(z.z - c.z) >= 0.63 - 1e-6, setup);
        }
        assert.equal(z.state, 'walking', setup + ': waits until the stationary cars leave');
        w.vehicles = [];
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) updateZombies(w, 1 / 60);
        assert.equal(z.state, 'saved');
    }
});
test('blood is visual only even with guaranteed legacy slip settings', () => {
    for (const chance of [0, 1]) {
        const { w, z } = fixture(); w.vehicles = [];
        w.config.bloodSlipChance = chance; w.modifiers.slipMultiplier = 100;
        z.z = 1;
        w.remains.push({ id: 200, source: 201, x: 0, z: 1, bloodRadius: 100 });
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) {
            const before = z.z;
            updateZombies(w, 1 / 60);
            assert.ok(z.state === 'walking' || z.state === 'saved');
            assert.ok(z.z < before, 'blood must not stop or redirect the crossing');
        }
        assert.equal(z.state, 'saved');
        assert.equal(z.visited.size, 0);
        assert.ok(!w.events.some(e => e.type === 'fall'));
        assert.equal(w.remains.length, 1);
    }
});
test('WorldView sync requests only blood for deaths; settings and scene expose no Corpse', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldView.ts'), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require: () => ({}) });
    const view = Object.create(exports.WorldView.prototype), requested = [];
    view.staticSprites = []; view.visuals = new Map();
    view.get = (key, kind) => { requested.push(kind); return {}; }; view.place = () => {};
    view.sync({ zombies: [{ state: 'dead' }], vehicles: [], drivers: [], remains: [{ id: 1, x: 0, z: 0 }] });
    assert.deepEqual(requested, ['blood']);
    const scene = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/Scenes/ZombieRoad.scene'), 'utf8'));
    const settings = scene.find(s => s.obstacleSprites);
    assert.equal(settings.corpseSprite, undefined); assert.equal(settings.corpsePrefab, undefined);
    assert.equal(settings.corpseEatChance, undefined); assert.equal(settings.driverEatSeconds, 8);
    assert.ok(scene[settings.bloodSprite.__id__].frame);
    const settingsSource = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/GameSettings.ts'), 'utf8');
    assert.doesNotMatch(settingsSource, /corpse/i);
});
console.log(`${count} vehicle/blood checks passed (production simulation; presenter doubles, no GPU assertions)`);
