const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, updateTraffic } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
const { vehicleCenter: center, vehicleExtent: extent } = require('../assets/Scripts/game/domain/VehicleContact.ts');
function setup(kind, direction, extra = {}) {
    const w = new World(1, 42, { zombieCount: 0, driverExitEnabled: false, laneWidths: [3,3,3,3,3], ...extra });
    const lane = direction > 0 ? 1 : 0;
    const leader = spawnVehicle(w, 'pink', lane);
    leader.x = -direction * 4;
    leader.cruise = leader.speed = 1;
    const car = spawnVehicle(w, kind, lane);
    car.x = -direction * 10;
    car.cruise = car.speed = 4;
    return { w, leader, car, lane };
}
let count = 0;
function test(name, fn) { fn(); count++; console.log('PASS ' + name); }
for (const kind of ['ordinary', 'pink']) for (const direction of [-1, 1]) test(`${kind} passes and returns ${direction}`, () => {
    const { w, leader, car, lane } = setup(kind, direction);
    const home = car.z;
    let started = false, passed = false, returned = false;
    for (let i = 0; i < 900; i++) {
        updateTraffic(w, 1 / 60, false);
        if (car.overtake) {
            started = true;
            assert.equal(spawnVehicle(w, 'jeep', 1 - lane), undefined);
        }
        assert.ok(Math.abs(center(car,'x') - center(leader,'x')) >= extent(car,'x') + extent(leader,'x')
            || Math.abs(center(car,'z') - center(leader,'z')) >= extent(car,'z') + extent(leader,'z'));
        passed ||= (car.x - leader.x) * direction > 3;
        if (started && !car.overtake && Math.abs(car.z - home) < 0.001) { returned = true; break; }
    }
    assert.ok(started && passed && returned);
    assert.ok(spawnVehicle(w, 'jeep', 1 - lane));
    assert.equal(w.events.filter(e => e.type === 'crash').length, 0);
});
test('jeep stays behind slower car', () => {
    const { w, car, leader } = setup('jeep', 1);
    const home = car.z;
    for (let i = 0; i < 300; i++) updateTraffic(w, 1 / 60, false);
    assert.equal(car.z, home); assert.equal(car.overtake, undefined); assert.ok(car.x < leader.x);
});
test('oncoming traffic prevents overtake', () => {
    const { w, car } = setup('ordinary', 1);
    const opposite = spawnVehicle(w, 'jeep', 0);
    assert.ok(opposite); opposite.x = 10;
    car.x = -6.60001;
    updateTraffic(w, 1 / 60, false);
    assert.equal(car.overtake, undefined);
});
test('insufficient sprite clearance prevents overtake', () => {
    const bounds = { halfX: 1.2, halfZ: 2, offsetX: 0, offsetZ: 0 };
    const shape = Object.fromEntries(['xPositive','xNegative','zPositive','zNegative'].map(k => [k, bounds]));
    const { w, car } = setup('ordinary', 1, { vehicleShapes: { ordinary: shape, pink: shape } });
    car.x = -6.60001;
    updateTraffic(w, 1 / 60, false); assert.equal(car.overtake, undefined);
});
test('parked leader can be passed', () => {
    const { w, leader, car } = setup('pink', -1);
    leader.abandoned = true;
    for (let i = 0; i < 900; i++) updateTraffic(w, 1 / 60, false);
    assert.ok(car.x < leader.x - 3); assert.equal(car.overtake, undefined);
});
console.log(`${count} overtaking checks passed (simulation, no rendering assertions)`);
