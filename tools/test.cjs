const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { applyObstacles, segmentHitsCircle } = require('../assets/Scripts/game/domain/ObstacleSystem.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/resources/levels.json'), 'utf8'));
const catalog = parseLevelCatalog(raw);
let count = 0;
function test(name, run) { run(); count++; console.log(`PASS ${name}`); }
function invalid(edit, pattern) { const value = structuredClone(raw); edit(value); assert.throws(() => parseLevelCatalog(value), pattern); }
function fixture(effect, chance = 1) {
    const definition = { id: 1, name: 'test', median: false, intersection: false, obstacles: [
        { id: 'a', type: 'test', effect, chance, x: 0, z: 0, radius: 0.5, scale: 1, rotation: 0 }
    ] };
    const w = new World(1, 42, { zombieCount: 1, ditchSlipChance: 0 }, {}, definition);
    const z = w.zombies[0]; Object.assign(z, { x: 0, z: 0.51, state: 'walking', direction: { x: 0, z: -1 }, disoriented: 10, speed: 2 });
    return { w, z };
}
test('five authored levels preserve manually placed obstacles, no startup hedge', () => {
    assert.equal(catalog.levels.length, 5);
    for (const l of catalog.levels) {
        const w = new World(l.id, 42, {}, {}, l);
        assert.equal(w.layout.bushes.length, 0);
        assert.deepEqual(w.layout.obstacles, l.obstacles);
        w.layout.obstacles[0].x = 100; assert.notEqual(l.obstacles[0].x, 100);
    }
});
test('every placed type resolves to a unique assigned scene SpriteFrame', () => {
    const scene = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets/Scenes/ZombieRoad.scene'), 'utf8'));
    const settings = scene.find(entry => Array.isArray(entry.obstacleSprites));
    assert.equal(settings.useSprites, true);
    const entries = settings.obstacleSprites.map(ref => scene[ref.__id__]);
    assert.equal(new Set(entries.map(e => e.type)).size, entries.length);
    const frames = new Set();
    for (const type of new Set(catalog.levels.flatMap(l => l.obstacles.map(o => o.type)))) {
        const binding = entries.find(e => e.type === type);
        assert.ok(binding, `Missing Obstacle Sprites binding: ${type}`);
        const frame = scene[binding.sprite.__id__].frame;
        const meta = JSON.parse(fs.readFileSync(path.join(__dirname, `../assets/Sprites/${type}.png.meta`), 'utf8'));
        assert.equal(frame.__uuid__, meta.subMetas.f9941.uuid, `Wrong frame for ${type}`);
        frames.add(frame.__uuid__);
    }
    assert.equal(frames.size, 4);
});
test('sprite material disables face culling at initialization, not via MaterialInstance-only API', () => {

    const file = path.join(__dirname, '../assets/Scripts/game/presentation/WorldSprites.ts');
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    let initializer;
    function visit(node) {
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
            && node.expression.expression.getText(source) === 'material') {
            assert.notEqual(node.expression.name.text, 'overridePipelineStates', 'Only MaterialInstance supports this API');
            if (node.expression.name.text === 'initialize') initializer = node.arguments[0];
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(initializer, 'Missing material initialization');
    const info = require('node:vm').runInNewContext(`(${initializer.getText(source)})`, {
        translucent: false,
        gfx: { CullMode: { NONE: 0 } }
    });
    assert.equal(info.states?.rasterizerState?.cullMode, 0, 'Mirroring reverses quad winding: both faces must render');
    assert.equal(info.defines.USE_ALPHA_TEST, true, 'Transparent margins must not occlude other sprites');
    assert.notEqual(info.states?.depthStencilState?.depthTest, false, 'Keep normal world occlusion');
    assert.notEqual(info.states?.depthStencilState?.depthWrite, false, 'Keep cutout depth writes');
});
test('level 3 reference has four rows, all four types; no level has a crossing or median', () => {
    const level = catalog.levels.find(l => l.id === 3);
    for (const l of catalog.levels) assert.ok(!('median' in l) && !('intersection' in l));
    for (const l of raw.levels) assert.ok(!('median' in l) && !('intersection' in l), 'levels.json carries no median/intersection');
    assert.equal(level.obstacles.length, 19);
    for (const [type, count] of Object.entries({ tire: 7, pipe: 2, tin: 5, danger: 5 }))
        assert.equal(level.obstacles.filter(o => o.type === type).length, count);
    for (const [z, count] of [[-2.7, 4], [-0.9, 6], [0.9, 4], [2.7, 5]]) {
        const row = level.obstacles.filter(o => o.z === z);
        assert.equal(row.length, count);
        assert.deepEqual(row.map(o => o.x), row.map(o => o.x).sort((a, b) => a - b));
    }
    assert.ok(level.obstacles.find(o => o.id === 'pipe-1').x < -12);
    assert.ok(level.obstacles.find(o => o.id === 'tire-7').x > 10);
});
test('validator rejects invalid version, ids, unknown type and non-finite coordinates', () => {
    invalid(v => v.version = 2, /version/);
    invalid(v => v.levels.pop(), /пять/);
    invalid(v => v.levels[1].id = 1, /повторяющийся/);
    invalid(v => v.levels[0].obstacles.push(v.levels[0].obstacles[0]), /повторяющийся/);
    invalid(v => v.obstacleTypes.push(v.obstacleTypes[0]), /повторяющийся/);
    invalid(v => v.levels[0].obstacles[0].type = 'missing', /неизвестный/);
    for (const axis of ['x', 'z']) {
        for (const value of [NaN, Infinity, -Infinity, '3.8', null, undefined])
            invalid(v => v.levels[0].obstacles[0][axis] = value, /конечное число/);
    }
    invalid(v => v.levels[0].obstacles[0].scale = -1, /число/);
    const legacy = structuredClone(raw); legacy.levels[3].median = true; legacy.levels[3].intersection = true;
    const parsed = parseLevelCatalog(legacy).levels[3];
    assert.ok(!('median' in parsed) && !('intersection' in parsed), 'Legacy median/intersection flags are ignored');
    invalid(v => v.obstacleTypes[0].effect = 'unknown', /effect/);
});
test('manual obstacle coordinates have no road or radius bounds and reach World unchanged', () => {
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/levels.schema.json'), 'utf8'));
    for (const axis of ['x', 'z']) assert.deepEqual(schema.$defs.obstacle.properties[axis], { type: 'number' });
    for (const [x, z] of [[-9.2, 3.8], [15, -3.6], [-1000, 1000], [1000, -1000]]) {
        const value = structuredClone(raw);
        Object.assign(value.levels[1].obstacles[3], { x, z, radius: 2 });
        const level = parseLevelCatalog(value).levels[1];
        const world = new World(level.id, 42, {}, {}, level);
        assert.equal(world.layout.obstacles[3].x, x);
        assert.equal(world.layout.obstacles[3].z, z);
        assert.deepEqual(value.levels[1].obstacles[3], { ...raw.levels[1].obstacles[3], x, z, radius: 2 });
    }
});
test('empty level is supported; defaults do not mutate JSON', () => {
    const v = structuredClone(raw); v.levels[0].obstacles = [];
    delete v.levels[1].obstacles[1].scale;
    const before = structuredClone(v);
    const parsed = parseLevelCatalog(v);
    assert.equal(parsed.levels[0].obstacles.length, 0);
    assert.equal(parsed.levels[1].obstacles[1].scale, 1);
    assert.deepEqual(v, before);
});
test('swept circle catches crossing, rejects misses and handles zero movement', () => {
    assert.equal(segmentHitsCircle({ x: -4, z: 0 }, { x: 4, z: 0 }, { x: 0, z: 0 }, 0.2), true);
    assert.equal(segmentHitsCircle({ x: -4, z: 1 }, { x: 4, z: 1 }, { x: 0, z: 0 }, 0.2), false);
    assert.equal(segmentHitsCircle({ x: 0, z: 0 }, { x: 0, z: 0 }, { x: 0, z: 0 }, 0.2), true);
});
for (const effect of ['trip', 'slip', 'snare']) test(`${effect}: real movement triggers once and has correct state`, () => {
    const { w, z } = fixture(effect); updateZombies(w, 1 / 60);
    assert.equal(z.state, 'stuck');
    assert.equal(z.visitedObstacles.size, 1);
    assert.equal(z.timer, 10);
    assert.equal(w.events.filter(e => e.type === 'fall').length, 0);
    z.state = 'walking'; z.immunity = 0; applyObstacles(w, z, { x: 0, z: 0 });
    assert.equal(z.state, 'walking');
});
test('empty ground never causes falls, including legacy ditch crossings on all levels', () => {
    for (let level = 1; level <= 5; level++) {
        const definition = { ...catalog.levels[level - 1], obstacles: [] };

        const w = new World(level, 42, { zombieCount: 1, ditchSlipChance: 1 }, {}, definition);
        const z = w.zombies[0];
        Object.assign(z, { x: 0, goalX: 0, z: 8, state: 'walking', speed: 2, immunity: 0 });
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) {
            updateZombies(w, 1 / 60);
            assert.ok(z.state === 'walking' || z.state === 'saved');
        }
        assert.equal(z.state, 'saved');
        assert.equal(w.events.filter(e => e.type === 'fall').length, 0);
    }
});
test('obstacle holds are mandatory despite legacy chance, immunity and modifiers', () => {
    for (const effect of ['trip', 'slip', 'snare']) {
        const { w, z } = fixture(effect, 0); z.z = 0; z.immunity = 1;
        w.modifiers.slipMultiplier = w.modifiers.snagMultiplier = 0;
        applyObstacles(w, z, z);
        assert.equal(z.state, 'stuck'); assert.equal(z.timer, 10);
    }
});
test('another walking zombie cannot release a snared zombie early', () => {
    const { w, z } = fixture('snare'); updateZombies(w, 1 / 60);
    w.zombies.push({ ...z, id: 2, x: 0.55, state: 'walking', visited: new Set(), visitedObstacles: new Set(['a']) });
    updateZombies(w, 1 / 60); assert.equal(z.state, 'stuck');
    assert.ok(!w.events.some(e => e.type === 'freed' && e.id === z.id));
});
test('trapped zombie remains vulnerable to cars', () => {
    const { w, z } = fixture('trip'); updateZombies(w, 1 / 60);
    const car = spawnVehicle(w, 'jeep', 0); Object.assign(car, { x: -1.4, direction: 1, z: z.z, lane: z.z, targetLane: z.z });
    updateTraffic(w, 1 / 60, false); assert.equal(z.state, 'dead'); assert.equal(w.remains.length, 1);
});
test('selection, retry and all five transitions use fresh authored layouts', () => {
    const storage = new Map(); const progress = new Progress({ getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) });
    const flow = new GameFlow(progress, { duration: 10 }, 42, 1, catalog);
    flow.select(3); flow.start(); assert.equal(flow.world.layout.level, 3);
    flow.world.zombies[0].visitedObstacles.add('test'); flow.pause(); flow.start();
    assert.equal(flow.world.zombies[0].visitedObstacles.size, 0);
    flow.levels(); flow.select(1); flow.start();
    for (let id = 1; id <= 5; id++) {
        assert.deepEqual(flow.world.layout.obstacles, catalog.levels[id - 1].obstacles);
        for (const z of flow.world.zombies) z.state = 'saved';
        flow.update(1 / 60); assert.equal(flow.screen, 'result');
        assert.equal(flow.advance(), id < 5);

        if (id < 5) { assert.equal(flow.screen, 'prelevel'); flow.start(); }
    }
    assert.equal(flow.screen, 'complete'); assert.ok(storage.size > 0);
});
test('fixed step equivalence, pause and launch guards', () => {
    const a = new World(1, 42, {}, {}, catalog.levels[0]), b = new World(1, 42, {}, {}, catalog.levels[0]);
    assert.equal(a.launch(1, { x: NaN, z: -3 }), false);
    a.launch(1, { x: 0, z: -3 }); b.launch(1, { x: 0, z: -3 });
    for (let i = 0; i < 120; i++) a.update(1 / 60);
    for (let i = 0; i < 60; i++) b.update(1 / 30);
    assert.deepEqual(a.zombies, b.zombies); assert.deepEqual(a.vehicles, b.vehicles);
    a.paused = true; const time = a.elapsed; a.update(0.2); assert.equal(a.elapsed, time);
    assert.equal(a.launch(2, { x: 0, z: -3 }), false);
});
test('five complete deterministic rounds produce finite state and stay within vehicle cap', () => {
    for (const l of catalog.levels) {
        const w = new World(l.id, 42, { duration: 20 }, {}, l);
        for (const z of w.zombies) w.launch(z.id, { x: 0, z: -3 });
        for (let i = 0; i < 1300 && !w.result; i++) {
            w.update(1 / 60); assert.ok(w.vehicles.length <= w.config.maxVehicles);
            for (const z of w.zombies) assert.ok(Number.isFinite(z.x) && Number.isFinite(z.z));
        }
        assert.ok(w.result); assert.ok(w.result.saved <= w.result.total);
    }
});
console.log(`\n${count} tests passed`);
require('./test-obstacle-finish.cjs');
require('./test-vehicle-contact.cjs');
require('./test-vehicle-sprites.cjs');
require('./test-drivers.cjs');
require('./test-ui.cjs');
require('./test-saved.cjs');
require('./test-lanes.cjs');
require('./test-boosters.cjs');
