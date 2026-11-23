
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/resources/levels.json'), 'utf8'));
const catalog = parseLevelCatalog(raw);
const directions = [[-1, 1], [-1, 1], [1, -1, 1], [1, -1, 1, -1], [1, -1, 1, -1]];
const centers = [[-0.9, 0.9], [-0.9, 0.9], [-1.8, 0, 1.8], [-2.7, -0.9, 0.9, 2.7], [-2.7, -0.9, 0.9, 2.7]];
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }

function world(id) { return new World(id, 42, { vehicleOffsetZ: 0 }, {}, catalog.levels[id - 1]); }
test('lane catalog validates directions, length, legacy defaults and JSON schema', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/levels.schema.json'), 'utf8'));
    assert.deepEqual(schema.properties.levels.items.properties.laneDirections.items.enum, ['left', 'right']);
    for (const value of [null, [], ['left'], ['left', 'up'], [1, -1], Array(5).fill('right')]) {
        const bad = structuredClone(raw); bad.levels[0].laneDirections = value;
        assert.throws(() => parseLevelCatalog(bad), /laneDirections/);
    }
    const legacy = structuredClone(raw); legacy.levels.forEach(l => delete l.laneDirections);
    assert.deepEqual(parseLevelCatalog(legacy).levels.map(l => l.laneDirections), catalog.levels.map(l => l.laneDirections));
});
test('all five layouts spawn every lane from the correct edge and move in its direction', () => {
    for (let id = 1; id <= 5; id++) {
        const w = world(id);
        assert.deepEqual(w.layout.laneDirections, directions[id - 1]);
        assert.deepEqual(new World(id).layout.laneDirections, directions[id - 1]);
        assert.ok(!('intersection' in w.layout) && !('median' in w.layout), 'Levels differ only by lanes');
        w.layout.laneCenters.forEach((z, i) => assert.ok(Math.abs(z - centers[id - 1][i]) < 1e-10));
        for (let i = 0; i < directions[id - 1].length; i++) {
            const car = spawnVehicle(w, 'ordinary', i);
            assert.ok(car); assert.equal(car.axis, 'x'); assert.equal(car.direction, directions[id - 1][i]);

            const laneZ = w.layout.laneCenters[i] + w.config.vehicleOffsetZ;
            assert.equal(car.x, -car.direction * 18); assert.equal(car.z, laneZ);
            assert.equal(spawnVehicle(w, 'ordinary', i), undefined, 'Occupied entry must block a duplicate');
            const oldX = car.x; updateTraffic(w, 0.1, false);
            assert.ok((car.x - oldX) * car.direction > 0); assert.equal(car.z, laneZ);
            w.vehicles = [];
        }
        for (const invalid of [-1, directions[id - 1].length, 0.5, NaN]) assert.equal(spawnVehicle(w, 'ordinary', invalid), undefined);
        assert.equal(spawnVehicle(w, 'ordinary', 0, true).axis, 'x', 'No crossing road: an extra argument cannot spawn cross traffic');
        w.vehicles = [];
        const seen = new Set();
        for (let i = 0; i < 150; i++) {
            updateTraffic(w, 0.01, true);
            const car = w.vehicles[0]; assert.equal(car.axis, 'x');
            const lane = w.layout.laneCenters.indexOf(car.lane);
            assert.ok(lane >= 0); assert.equal(car.direction, directions[id - 1][lane]);
            seen.add(lane); w.vehicles = [];
        }
        assert.equal(seen.size, directions[id - 1].length);
    }
});
test('jeeps and pink cars never steer across alternating oncoming lanes', () => {
    for (let id = 1; id <= 5; id++) for (const kind of ['jeep', 'pink']) {
        for (let lane = 0; lane < directions[id - 1].length; lane++) {
            const w = world(id), car = spawnVehicle(w, kind, lane);
            car.x = 0;
            const z = w.zombies[0]; Object.assign(z, { x: car.direction * 4, z: car.z + (lane ? -1.7 : 1.7) });
            updateTraffic(w, 0.1, false);
            assert.equal(car.targetLane, w.layout.laneCenters[lane]);
            assert.equal(car.z, w.layout.laneCenters[lane]);
        }
    }

    const definition = { ...catalog.levels[3], laneDirections: ['right', 'right', 'left', 'left'] };
    const w = new World(4, 42, { vehicleOffsetZ: 0 }, {}, definition), car = spawnVehicle(w, 'jeep', 0);
    car.x = 0; Object.assign(w.zombies[0], { x: 4, z: w.layout.laneCenters[1] });
    updateTraffic(w, 0.1, false); assert.equal(car.targetLane, w.layout.laneCenters[1]);
});
test('level selection, retry and progression retain the correct lane configuration', () => {
    const flow = new GameFlow(new Progress({ getItem: () => null, setItem: () => {} }), {}, 42, 1, catalog);
    for (let id = 1; id <= 5; id++) {
        flow.levels(); flow.select(id); flow.start();
        assert.deepEqual(flow.world.layout.laneDirections, directions[id - 1]);
        flow.pause(); flow.start(); assert.deepEqual(flow.world.layout.laneDirections, directions[id - 1]);
        flow.world.zombies.forEach(z => z.state = 'saved'); flow.update(1 / 60); flow.advance(); flow.start();
        if (id < 5) assert.deepEqual(flow.world.layout.laneDirections, directions[id]);
    }
});
test('WorldView builds exactly N-1 divider rows for N traffic lanes (no GPU assertions)', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldView.ts'), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require: () => ({}) });
    for (let id = 1; id <= 5; id++) {
        const view = Object.create(exports.WorldView.prototype), w = world(id), rows = new Set();
        view.clearActors = () => {}; view.buildObstacles = () => {};
        view.environment = { children: [] }; view.obstacles = { children: [] };
        view.settings = { generateEnvironment: true, useSprites: false };
        view.primitives = { box: (root, name, color, x, y, z) => {
            if (name === 'LaneDash') rows.add(z);
            return { setRotationFromEuler() {} };
        } };
        view.build(w);
        assert.equal(rows.size, directions[id - 1].length - 1);
        [...rows].forEach((z, i) => assert.ok(Math.abs(z - (centers[id - 1][i] + centers[id - 1][i + 1]) / 2) < 1e-10));
    }
});
test('shared lane width centers every group and drives actual spawn/movement', () => {
    for (const width of [1.4, 1.8, 2.4]) for (let id = 1; id <= 5; id++) {
        const w = new World(id, 42, { laneWidths: Array(5).fill(width), vehicleOffsetZ: 0 }, {}, catalog.levels[id - 1]);
        const l = w.layout, n = directions[id - 1].length;
        assert.equal(l.laneWidth, width);
        assert.ok(Math.abs(l.laneCenters.reduce((a, b) => a + b, 0)) < 1e-10);
        assert.ok(Math.abs(l.laneCenters[0] - width / 2 + n * width / 2) < 1e-10);
        assert.ok(Math.abs(l.laneCenters[n - 1] + width / 2 - n * width / 2) < 1e-10);
        assert.ok(l.roadHalf >= n * width / 2);
        for (let i = 0; i < n; i++) {
            const car = spawnVehicle(w, 'ordinary', i);
            assert.ok(car); assert.equal(car.z, l.laneCenters[i]);
            const x = car.x; updateTraffic(w, 0.1, false);
            assert.equal(car.z, l.laneCenters[i]); assert.ok((car.x - x) * car.direction > 0);
            w.vehicles = [];
        }
        assert.deepEqual(l.obstacles, catalog.levels[id - 1].obstacles);

        assert.equal(l.spawnZ, world(id).layout.spawnZ); assert.equal(l.finishZ, world(id).layout.finishZ);
    }
    for (const bad of [NaN, Infinity, -Infinity]) assert.equal(new World(1, 42, { laneWidths: Array(5).fill(bad) }).layout.laneWidth, 1.8);
    for (const small of [-4, 0, 1]) assert.equal(new World(1, 42, { laneWidths: Array(5).fill(small) }).layout.laneWidth, 1.4);

    for (let id = 1; id <= 5; id++) assert.equal(new World(id, 42, { laneWidths: [2, 2.5, 3, 3.5, 4] }, {}, catalog.levels[id - 1]).layout.laneWidth, 1.5 + id * 0.5);
});
test('custom lane width survives selection, retry and next level', () => {
    const flow = new GameFlow(new Progress({ getItem: () => null, setItem: () => {} }), { laneWidths: Array(5).fill(2.2) }, 42, 1, catalog);
    for (let id = 1; id <= 5; id++) {
        flow.levels(); flow.select(id); flow.start();
        assert.equal(flow.world.layout.laneWidth, 2.2);
        flow.pause(); flow.start(); assert.equal(flow.world.layout.laneWidth, 2.2);
        flow.world.zombies.forEach(z => z.state = 'saved'); flow.update(1 / 60); flow.advance(); flow.start();
        assert.equal(flow.world.layout.laneWidth, 2.2);
    }
});
test('lane surfaces alternate exact colors and match traffic with/without landscape', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/WorldView.ts'), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports, require: () => ({}) });
    for (const offset of [-2, 0, 3]) for (const textured of [false, true]) for (const width of [1.8, 2.4]) for (let id = 1; id <= 5; id++) {
        const w = new World(id, 42, { laneWidths: Array(5).fill(width), laneOffsetZ: offset, vehicleOffsetZ: 0 }, {}, catalog.levels[id - 1]);
        const view = Object.create(exports.WorldView.prototype), boxes = [];
        view.clearActors = () => {}; view.buildObstacles = () => {};
        view.environment = { children: [] }; view.obstacles = { children: [] };
        view.settings = { generateEnvironment: true, useSprites: textured,
            landscapeSprites: [{ level: 0, x: 0, z: 2, sprite: { frame: {}, lift: 0 } }] };
        view.sprites = { create: () => ({}), pose: () => {} };
        view.primitives = { box: (root, name, color, x, y, z, sx, sy, sz) => {
            boxes.push({ name, color, x, y, z, sx, sy, sz }); return { setRotationFromEuler() {} };
        } };
        view.build(w);
        const bands = boxes.filter(b => b.name.startsWith('LaneSurface-'));
        assert.equal(bands.length, directions[id - 1].length);
        bands.forEach((b, i) => {
            assert.equal(b.color, i % 2 ? '#8d5c44' : '#956147');
            assert.equal(b.z, w.layout.laneCenters[i]); assert.equal(b.sz, width);
            assert.equal(b.x, 0); assert.equal(b.sx, 36);
            assert.ok(b.y - b.sy / 2 >= 0.07 && b.y + b.sy / 2 < 0.09);
        });
        boxes.length = 0; view.settings.generateEnvironment = false; view.build(w);
        assert.equal(boxes.length, 0, 'Hand-authored environment opt-out is preserved');
    }
});
test('inspector lane width reaches World through GameSettings.toConfig', () => {
    const source = fs.readFileSync(path.join(__dirname, '../assets/Scripts/game/presentation/GameSettings.ts'), 'utf8');
    const exports = {};

    const property = (...args) => args.length >= 2 ? undefined : () => {};
    const cc = { Component: class {}, CCFloat: 'Float', CCInteger: 'Integer', CCBoolean: 'Boolean', _decorator: { ccclass: () => value => value, property } };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
    } }).outputText, { exports, require: id => id === 'cc' ? cc
        : id === './SpriteStyle' ? { actorStyle: () => ({}) }
        : require('../assets/Scripts/game/domain/Model.ts') });
    const settings = new exports.GameSettings();

    assert.deepEqual([...settings.laneWidths], [1.8, 1.8, 1.8, 1.8, 1.8]);
    settings.laneWidths = Array(5).fill(2.2);
    assert.equal(settings.laneOffsetZ, 0);
    settings.laneOffsetZ = 3;
    const flow = new GameFlow(new Progress({ getItem: () => null, setItem: () => {} }), settings.toConfig(), 42, 3, catalog);
    flow.start();
    assert.equal(flow.world.layout.laneWidth, 2.2);
    assert.deepEqual(flow.world.layout.laneCenters, [3 - 2.2, 3, 3 + 2.2]);
    flow.pause(); flow.start(); assert.equal(flow.world.config.laneOffsetZ, 3);
    flow.world.zombies.forEach(z => z.state = 'saved'); flow.update(1 / 60); flow.advance(); flow.start();
    assert.equal(flow.world.config.laneOffsetZ, 3);
});
test('lane offset shifts traffic on all levels without moving authored objects', () => {
    for (const offset of [-3, 0, 4]) for (let id = 1; id <= 5; id++) {
        const base = world(id);
        const w = new World(id, 42, { laneOffsetZ: offset, vehicleOffsetZ: 0 }, {}, catalog.levels[id - 1]);
        w.layout.laneCenters.forEach((z, i) => {
            assert.equal(z, base.layout.laneCenters[i] + offset);
            const car = spawnVehicle(w, 'ordinary', i);
            assert.ok(car); assert.equal(car.z, z);
            updateTraffic(w, 0.1, false); assert.equal(car.z, z);
            w.vehicles = [];
        });
        assert.deepEqual(w.layout.obstacles, base.layout.obstacles);
        assert.equal(w.layout.spawnZ, base.layout.spawnZ);
        assert.equal(w.layout.finishZ, base.layout.finishZ);
    }
    for (const value of [NaN, Infinity, -Infinity]) {
        assert.deepEqual(new World(1, 42, { laneOffsetZ: value }).layout.laneCenters, world(1).layout.laneCenters);
    }
});
console.log(`${count} lane checks passed (domain + presentation unit tests; no GPU assertions)`);
