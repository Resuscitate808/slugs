const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, hitZombie, crash } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
for (const enabled of [false, true]) {
    for (const event of ['hit', 'crash']) {
        const w = new World(1, 42, { driverExitEnabled: enabled, driverExitChance: 1 });
        const car = spawnVehicle(w, 'ordinary', 0);
        if (event === 'hit') {
            hitZombie(w, car, w.zombies[0]);
            assert.equal(w.zombies[0].state, 'dead');
            assert.equal(w.remains.length, 1);
        } else crash(w, car);
        assert.equal(w.drivers.length, enabled ? 1 : 0);
        assert.equal(car.driverCreated, enabled);
        assert.equal(car.stopped, enabled ? w.config.driverInspectDuration : 0);
        assert.equal(w.events.filter(e => e.type === 'driver').length, enabled ? 1 : 0);
        console.log(`PASS driver exit enabled=${enabled}, event=${event}`);
    }
}
const w = new World(1, 42, { driverExitChance: 0 });
assert.equal(w.config.driverExitEnabled, true);
const car = spawnVehicle(w, 'ordinary', 0);
hitZombie(w, car, w.zombies[0]);
assert.equal(w.drivers.length, 0);
console.log('PASS enabled by default; existing exit chance still applies');
