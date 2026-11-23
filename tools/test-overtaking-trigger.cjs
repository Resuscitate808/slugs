const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { vehicleCenter: center, vehicleExtent: extent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
let count = 0, failures = 0;
function test(name, fn) {
    try { fn(); count++; console.log('PASS ' + name); }
    catch (e) { failures++; console.error('FAIL ' + name + ': ' + e.message); }
}
function setup(direction = 1, kind = 'ordinary', speed = 4) {
    const w = new World(1, 42, { zombieCount: 0, driverExitEnabled: false, laneWidths: [3,3,3,3,3] });
    const lane = direction > 0 ? 1 : 0;
    const leader = spawnVehicle(w, 'jeep', lane);
    leader.x = 0; leader.speed = leader.cruise = 1;
    const car = spawnVehicle(w, kind, lane);
    car.x = -direction * 2.60001; car.speed = car.cruise = speed;
    return { w, car, leader, lane };
}
function clear(w) {
    for (const a of w.vehicles) for (const b of w.vehicles) if (a !== b) {
        assert.ok(Math.abs(center(a, 'x') - center(b, 'x')) >= extent(a, 'x') + extent(b, 'x') - 1e-6
            || Math.abs(center(a, 'z') - center(b, 'z')) >= extent(a, 'z') + extent(b, 'z') - 1e-6, 'overlapping cars');
    }
}
for (const direction of [-1, 1]) {
    test(`no premature overtake while distant ${direction}`, () => {
        const { w, car } = setup(direction);
        car.x = -direction * 9;
        updateTraffic(w, 1 / 60, false);
        assert.equal(car.overtake, undefined);
    });
    test(`equal speed leader does not trigger overtake ${direction}`, () => {
        const { w, car, leader } = setup(direction);
        leader.speed = leader.cruise = car.cruise;
        for (let i = 0; i < 30; i++) updateTraffic(w, 1 / 60, false);
        assert.equal(car.overtake, undefined);
    });
    for (const kind of ['ordinary', 'pink']) for (const speed of [2.6, 4.2, 6]) test(`bumper departure matches speed ${kind} ${speed} ${direction}`, () => {
        const { w, car, leader } = setup(direction, kind, speed);
        w.vehicles.reverse();
        const home = car.z;
        updateTraffic(w, 1 / 60, false);
        assert.ok(car.overtake);
        assert.ok(Math.abs(Math.abs(car.z - home) - speed / 60) < 1e-6, `lateral speed ${Math.abs(car.z - home) * 60} != ${speed}`);
        for (let i = 0; i < 900 && (car.overtake || (car.x - leader.x) * direction < 3); i++) {
            const before = car.z;
            updateTraffic(w, 1 / 60, false); clear(w);
            if (car.overtake?.returning) {
                const expected = Math.min(Math.abs(home - before), speed / 60);
                assert.ok(Math.abs(Math.abs(car.z - before) - expected) < 1e-6, 'return speed must match car speed');
            }
        }
        assert.ok((car.x - leader.x) * direction > 3);
        assert.equal(car.overtake, undefined);
        assert.ok(Math.abs(car.z - home) < 1e-6);
    });
    test(`queued nominally faster leader can be passed ${direction}`, () => {
        const { w, car, leader } = setup(direction);
        leader.speed = leader.cruise = 6;
        const front = { ...leader, id: 999, x: direction * 2.60001, speed: 0.5, cruise: 0.5 };
        w.vehicles = [car, leader, front];
        updateTraffic(w, 1 / 60, false);
        assert.ok(car.overtake, 'queue speed, not free-running leader speed, must determine need');
        for (let i = 0; i < 1200 && (car.overtake || (car.x - front.x) * direction < 3); i++) {
            updateTraffic(w, 1 / 60, false); clear(w);
        }
        assert.ok((car.x - front.x) * direction > 3);
        assert.equal(car.overtake, undefined);
    });
    test(`lane departure hits only actual forward segment ${direction}`, () => {
        const { w, car } = setup(direction);
        w.vehicles.reverse();
        const home = car.z;
        const side = direction > 0 ? -1 : 1;
        const x = car.x + direction * (1.2 + 0.15 + 0.25);
        w.zombies = [
            { id: 800, state: 'walking', x, z: home + side * 2.5 },
            { id: 801, state: 'walking', x, z: home + side * 0.5 }
        ];
        updateTraffic(w, 0.5, false);
        assert.equal(w.zombies[0].state, 'dead');
        assert.equal(w.zombies[1].state, 'walking');
    });
    test(`reaction speed is preserved during overtake ${direction}`, () => {
        const { w, car } = setup(direction, 'pink', 2.6);
        car.speed = 6.5; car.reaction = 4;
        const home = car.z;
        updateTraffic(w, 1 / 60, false);
        assert.ok(car.overtake);
        assert.equal(car.speed, 6.5);
        assert.ok(Math.abs(Math.abs(car.z - home) * 60 - 6.5) < 1e-6);
    });
    test(`distant faster adjacent traffic does not veto overtake ${direction}`, () => {
        const { w, car } = setup(direction);
        const z = w.layout.laneCenters[direction > 0 ? 0 : 1] + w.config.vehicleOffsetZ;
        w.vehicles.push({ ...car, id: 999, x: direction * 12, z, lane: z, targetLane: z, speed: 6, cruise: 6 });
        updateTraffic(w, 1 / 60, false);
        assert.ok(car.overtake);
        clear(w);
    });
    test(`close follower does not veto free adjacent lane ${direction}`, () => {
        const { w, car } = setup(direction);
        const tail = { ...car, kind: 'jeep', id: 999, x: car.x - direction * 2.60001, speed: 6, cruise: 6 };
        w.vehicles.push(tail);
        updateTraffic(w, 1 / 60, false);
        assert.ok(car.overtake);
        clear(w);
    });
}
console.log(`${count} trigger checks passed; ${failures} failed`);
if (failures) process.exitCode = 1;
