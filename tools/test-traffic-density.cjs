const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const catalog = parseLevelCatalog(JSON.parse(fs.readFileSync('../assets/resources/levels.json', 'utf8')));
const counts = [];
for (let level = 1; level <= 5; level++) {
    const w = new World(level, 42, { duration: 600, zombieCount: 1, driverExitEnabled: false }, {}, catalog.levels[level - 1]);
    let count = 0;
    const times = [];
    for (let frame = 0; frame < 300 * 60; frame++) {
        w.update(1 / 60);
        if (w.vehicles.length) { count += w.vehicles.length; times.push(w.elapsed); }
        w.vehicles = [];
    }
    assert.equal(w.result, null);
    assert.ok(Math.abs(times[0] - 1.2) < 0.02);
    const oldBase = w.config.trafficInterval / (1 + (level - 1) * 0.12);
    const multiplier = [2, 1.7, 1.4, 1.2, 1][level - 1];
    for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        assert.ok(gap >= oldBase * multiplier * 0.8 - 0.001);
        assert.ok(gap <= oldBase * multiplier * 1.3 + 1 / 60 + 0.001);
    }
    const pausedTime = w.elapsed;
    w.paused = true;
    w.update(0.25);
    assert.equal(w.elapsed, pausedTime);
    counts.push(count);
}
for (let i = 1; i < counts.length; i++) assert.ok(counts[i] > counts[i - 1], counts.join(', '));
const source = fs.readFileSync('../assets/Scripts/game/domain/World.ts', 'utf8');
const oldSource = source.replace(' * intervalMultiplier * this.random.range', ' * this.random.range');
assert.notEqual(source, oldSource);
const Module = require('node:module');
const path = require('node:path');
const file = path.resolve('../assets/Scripts/game/domain/World.ts');
const legacy = new Module(file, module);
legacy.filename = file;
legacy.paths = module.paths;
legacy._compile(ts.transpileModule(oldSource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, file);
for (const seed of [1, 42, 123]) {
    const args = [5, seed, { duration: 600, zombieCount: 1, driverExitEnabled: false }, {}, catalog.levels[4]];
    const current = new World(...args);
    const previous = new legacy.exports.World(...args);
    for (let frame = 0; frame < 120 * 60; frame++) {
        current.update(1 / 60); previous.update(1 / 60);
        assert.deepEqual(current.vehicles, previous.vehicles);
    }
}
console.log(`PASS traffic density: increasing spawns over 300s (${counts.join(', ')}); interval ranges; pause; level 5 identical to previous timing for 3 seeds`);
