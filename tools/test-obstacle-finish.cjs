
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { DEFAULT_CONFIG } = require('../assets/Scripts/game/domain/Model.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { applyObstacles } = require('../assets/Scripts/game/domain/ObstacleSystem.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const catalog = parseLevelCatalog(JSON.parse(fs.readFileSync(__dirname + '/../assets/resources/levels.json', 'utf8')));
let count = 0;
function test(name, run) { run(); count++; console.log('PASS ' + name); }
function obstacle(id, z = 0) {
    return { id, type: 'tire', effect: 'trip', chance: 0, x: 0, z, radius: 0.5, scale: 1, rotation: 0 };
}
function fixture(obstacles = [obstacle('first')]) {
    const w = new World(1, 42, { zombieCount: 2, maxVehicles: 0, driverExitEnabled: false, bloodSlipChance: 0 }, {}, {
        id: 1, name: 'hold', median: false, intersection: false, laneDirections: ['left', 'right'], obstacles
    });
    const z = w.zombies[0];
    Object.assign(z, { x: 0, z: 0.33, state: 'walking', goalX: 0, direction: { x: 0, z: -1 }, speed: 2, disoriented: 0 });
    return { w, z };
}
test('every authored obstacle holds for 10 seconds, regardless of old effect/chance', () => {
    for (const level of catalog.levels) for (const o of level.obstacles) {
        const { w, z } = fixture([o]);
        Object.assign(z, { x: o.x, z: o.z, immunity: 2 });
        w.modifiers.slipMultiplier = w.modifiers.snagMultiplier = 0;
        applyObstacles(w, z, { x: z.x, z: z.z });
        assert.equal(z.state, 'stuck', `${level.id}/${o.id}`);
        assert.equal(z.timer, 10);
    }
});
test('full 10-second hold: no early rescue/launch, resumes to finish once, pause freezes timer', () => {
    const { w, z } = fixture(); w.update(1 / 60);
    assert.equal(z.state, 'stuck'); assert.equal(z.timer, 10);
    const position = { x: z.x, z: z.z };
    const neighbor = w.zombies[1];
    Object.assign(neighbor, { x: z.x + 0.3, z: z.z, state: 'walking', speed: 0 });
    assert.equal(w.launch(z.id, { x: 0, z: -4 }), false);
    w.paused = true; w.update(0.25); assert.equal(z.timer, 10); w.paused = false;
    for (let i = 0; i < 599; i++) {
        w.update(1 / 60);
        assert.equal(z.state, 'stuck');
        assert.deepEqual({ x: z.x, z: z.z }, position);
    }
    w.update(1 / 60); assert.equal(z.state, 'walking'); assert.equal(z.timer, 0);
    assert.equal(w.events.filter(e => e.type === 'freed' && e.id === z.id).length, 1);
    w.update(1 / 60); assert.ok(z.z < position.z);
    for (let i = 0; i < 600 && z.state !== 'saved'; i++) w.update(1 / 60);
    assert.equal(z.state, 'saved'); assert.equal(z.visitedObstacles.size, 1);
    assert.equal(w.events.filter(e => e.type === 'saved' && e.id === z.id).length, 1);
});
test('fast launch stops at nearest obstacle, not JSON order or beyond the finish', () => {
    const { w, z } = fixture([obstacle('far', -1), obstacle('near', 1)]);
    z.z = 3; z.speed = 100;
    updateZombies(w, 0.2);
    assert.equal(z.state, 'stuck'); assert.ok(Math.abs(z.z - 1.325) < 1e-9);
    assert.deepEqual([...z.visitedObstacles], ['near']);
    for (let i = 0; i < 600; i++) updateZombies(w, 1 / 60);
    z.speed = 2;
    for (let i = 0; i < 100 && z.state === 'walking'; i++) updateZombies(w, 1 / 60);
    assert.equal(z.state, 'stuck'); assert.equal(z.timer, 10);
    assert.deepEqual([...z.visitedObstacles], ['near', 'far']);
});
test('miss does not hold; retry creates clean obstacle visits', () => {
    const { w, z } = fixture(); z.x = z.goalX = 2;
    updateZombies(w, 0.1); assert.equal(z.state, 'walking'); assert.equal(z.visitedObstacles.size, 0);
    const fresh = fixture(); updateZombies(fresh.w, 1 / 60);
    assert.equal(fresh.z.state, 'stuck'); assert.equal(fresh.z.timer, 10);
});
test('during actual hold front kills; side/rear/stationary car does not; death never resumes', () => {
    for (const direction of [-1, 1]) for (const mode of ['front', 'side', 'rear', 'stopped']) {
        const { w, z } = fixture(); updateZombies(w, 1 / 60);
        assert.equal(z.state, 'stuck');
        w.config.maxVehicles = 1;
        const car = spawnVehicle(w, 'ordinary', 0);
        Object.assign(car, { x: z.x - direction * 1.4, z: z.z, lane: z.z, targetLane: z.z,
            direction, speed: 6, cruise: 6, reaction: 100 });
        if (mode === 'side') { car.x = z.x; car.z = z.z + 0.74; }
        if (mode === 'rear') car.x = z.x + direction * 1.4;
        if (mode === 'stopped') car.stopped = 30;
        updateTraffic(w, 1 / 60, false);
        assert.equal(z.state, mode === 'front' ? 'dead' : 'stuck');
        assert.equal(w.remains.length, mode === 'front' ? 1 : 0);
        if (mode === 'front') {
            for (let i = 0; i < 660; i++) updateZombies(w, 1 / 60);
            assert.equal(z.state, 'dead');
            assert.ok(!w.events.some(e => e.type === 'freed' && e.id === z.id));
        }
    }
});
test('finish and saved slots shift down on all levels without moving road/start/obstacles', () => {
    for (let level = 1; level <= 5; level++) {
        const a = new World(level, 42, { finishOffsetZ: 0 }, {}, catalog.levels[level - 1]);
        const b = new World(level, 42, { finishOffsetZ: 1 }, {}, catalog.levels[level - 1]);
        assert.ok(Math.abs(b.layout.finishZ - a.layout.finishZ - 1) < 1e-9);
        assert.deepEqual(b.layout.laneCenters, a.layout.laneCenters);
        assert.deepEqual(b.layout.obstacles, a.layout.obstacles);
        assert.deepEqual(b.zombies, a.zombies);
        for (const w of [a, b]) {
            const z = w.zombies[0];
            Object.assign(z, { x: 5, goalX: 5, z: w.layout.finishZ + 0.001, state: 'walking' });
            updateZombies(w, 1 / 60); assert.equal(z.state, 'saved');
        }
        assert.ok(Math.abs(b.zombies[0].savedTarget.z - a.zombies[0].savedTarget.z - 1) < 1e-9);
        assert.equal(b.zombies[0].savedTarget.x, a.zombies[0].savedTarget.x);
    }
    assert.equal(new World().config.finishOffsetZ, 1);
    for (const invalid of [NaN, Infinity, -Infinity])
        assert.equal(new World(1, 42, { finishOffsetZ: invalid }).config.finishOffsetZ, DEFAULT_CONFIG.finishOffsetZ);
});
test('disabled obstacles preserve layout and ignore both silhouette and fallback contacts', () => {
    for (let level = 1; level <= 5; level++) for (const precise of [false, true]) {
        const w = new World(level, 42, { zombieCount: 1, maxVehicles: 0, obstaclesEnabled: false }, {}, catalog.levels[level - 1]);
        const layout = structuredClone(w.layout.obstacles);
        const z = w.zombies[0];
        const o = w.layout.obstacles[0];
        Object.assign(z, { x: o.x, z: o.z + 0.1, state: 'walking', goalX: o.x, speed: 2, disoriented: 0 });
        let calls = 0;
        if (precise) w.spriteContacts = { obstacleEntry() { calls++; return 0; }, frontHit() { return false; } };
        const before = z.z;
        updateZombies(w, 0.01);
        assert.notEqual(z.state, 'stuck');
        assert.ok(z.z < before);
        assert.equal(z.visitedObstacles.size, 0);
        assert.equal(calls, 0);
        assert.deepEqual(w.layout.obstacles, layout);
        w.config.obstaclesEnabled = true;
        Object.assign(z, { x: o.x, z: o.z, state: 'walking' });
        applyObstacles(w, z, { x: z.x, z: z.z });
        assert.equal(z.state, 'stuck');
        assert.equal(z.timer, 10);
        if (precise) assert.ok(calls > 0);
    }
    assert.equal(new World().config.obstaclesEnabled, true);
});
console.log(`${count} obstacle/finish checks passed (real simulation, no GPU assertions)`);
require('./test-saved.cjs');
