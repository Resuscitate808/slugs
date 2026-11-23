const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { updateZombies } = require('../assets/Scripts/game/domain/ZombieSystem.ts');
const { vehicleExtent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
function fixture(direction = 1, gap = 0.2, number = 1, speed = 2) {
    const w = new World(1, 42, { zombieCount: 1, driverExitEnabled: false }, {}, {
        id: 1, name: 'waiting', median: false, intersection: false, obstacles: [], laneDirections: ['left', 'right']
    });
    const car = spawnVehicle(w, 'ordinary', 0);
    Object.assign(car, { x: 0, z: 0, direction, lane: 0, targetLane: 0, speed, cruise: speed, reaction: 1000 });
    w.vehicles = Array.from({ length: number }, (_, i) => ({ ...car, id: 100 + i, x: -direction * i * (2.4 + gap) }));
    const z = w.zombies[0];
    Object.assign(z, { x: 0, z: 0.76, state: 'walking', goalX: 0, direction: { x: 0, z: -1 }, speed: 2, wander: 1000, boost: 0, disoriented: 0 });
    return { w, z };
}
function tick(w) { updateTraffic(w, 1 / 60, false); updateZombies(w, 1 / 60); }
for (const direction of [-1, 1]) {
    test(`side wait, no detour, resume ${direction}`, () => {
        const { w, z } = fixture(direction);
        for (let i = 0; i < 15; i++) { tick(w); assert.equal(z.x, 0); assert.ok(z.z >= 0.63 - 1e-6); }
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) tick(w);
        assert.equal(z.state, 'saved'); assert.equal(w.remains.length, 0);
    });
    for (const gap of [0.2, 0.4, 0.59]) test(`continuous three-car queue ${direction}/${gap}`, () => {
        const { w, z } = fixture(direction, gap, 3);
        for (let i = 0; i < 600 && z.state !== 'saved'; i++) {
            tick(w);
            const tail = w.vehicles.find(c => c.id === 102);
            if (tail && tail.x * direction - vehicleExtent(tail, 'x') <= 0.15) {
                assert.ok(z.z >= 0.63 - 1e-6, 'must not enter the tiny queue gap');
                assert.equal(z.x, 0, 'must not sidestep');
            }
            assert.notEqual(z.state, 'dead');
        }
        assert.equal(z.state, 'saved'); assert.equal(w.events.filter(e => e.type === 'hit').length, 0);
    });
    test(`large gap is not a permanent barrier ${direction}`, () => {
        const { w, z } = fixture(direction, 10, 2, 1);
        let crossedBeforeFollower = false;
        for (let i = 0; i < 240; i++) {
            tick(w);
            if (z.z < -0.8 && w.vehicles[1].x * direction < -5) crossedBeforeFollower = true;
        }
        assert.ok(crossedBeforeFollower); assert.notEqual(z.state, 'dead');
    });
}
test('parked car waits indefinitely, removal resumes without timer or detour', () => {
    const { w, z } = fixture(); w.vehicles[0].abandoned = true;
    for (let i = 0; i < 300; i++) tick(w);
    assert.equal(z.x, 0); assert.ok(z.z >= 0.63 - 1e-6); assert.equal(z.state, 'walking'); assert.equal(z.timer, 0);
    w.vehicles = [];
    const before = z.z; tick(w); assert.ok(z.z < before);
});
test('fast launch stops at body, never tunnels or walks backwards', () => {
    const { w, z } = fixture(); w.vehicles[0].abandoned = true;
    z.z = 3; z.speed = 100; updateZombies(w, 0.25);
    assert.equal(z.x, 0); assert.ok(z.z >= 0.63 - 1e-6 && z.z < 3);
});
test('offset large sprite uses its zombie extent while waiting', () => {
    const { w, z } = fixture(1, 0.2, 2);
    const shape = { halfX: 1.6, halfZ: 1.1, offsetX: 0.3, offsetZ: -0.4 };
    for (const c of w.vehicles) c.shapes = { xPositive: shape, xNegative: shape, zPositive: shape, zNegative: shape };
    w.vehicles[1].x = -3.4; z.z = 2;
    w.spriteContacts = { vehiclePadding: () => ({ x: 0.4, z: 0.8 }), frontHit: () => undefined, obstacleEntry: () => undefined };
    for (let i = 0; i < 60; i++) { tick(w); assert.ok(z.z >= 1.28 - 1e-5); assert.equal(z.x, 0); }
    assert.notEqual(z.state, 'dead');
});
test('waiting does not grant immunity against an unrelated frontal car', () => {
    const { w, z } = fixture(); w.vehicles[0].abandoned = true;
    for (let i = 0; i < 30; i++) tick(w);
    const attacker = { ...w.vehicles[0], id: 999, x: -2, z: z.z, abandoned: false, speed: 6, cruise: 6, lane: z.z, targetLane: z.z };
    w.vehicles.push(attacker);
    updateTraffic(w, 0.2, false);
    assert.equal(z.state, 'dead');
});
test('overlapping far side continues toward finish instead of waiting for cars behind', () => {
    for (const direction of [-1, 1]) for (const number of [1, 3]) for (const padding of [0.15, 0.8]) {
        const { w, z } = fixture(direction, 0.2, number, 0);
        w.vehicles.forEach(car => { car.abandoned = true; });
        w.spriteContacts = { vehiclePadding: () => ({ x: 0.4, z: padding }), frontHit: () => undefined, obstacleEntry: () => undefined };
        z.z = -(0.48 + padding) + 0.05;
        const start = z.z;
        for (let i = 0; i < 30; i++) {
            const before = z.z;
            updateZombies(w, 1 / 60);
            assert.ok(z.z < before, 'car behind must not hold a slug moving away');
            assert.equal(z.x, 0);
        }
        assert.ok(z.z < start - 0.9);
        assert.equal(z.state, 'walking');
    }
});
test('near-side overlap still waits when moving into the car', () => {
    for (const direction of [-1, 1]) {
        const { w, z } = fixture(direction);
        w.vehicles[0].abandoned = true;
        z.z = 0.6;
        for (let i = 0; i < 30; i++) updateZombies(w, 1 / 60);
        assert.equal(z.z, 0.6);
        assert.equal(z.x, 0);
    }
});
console.log(`${count} vehicle waiting checks passed (real simulation; no rendering assertions)`);
