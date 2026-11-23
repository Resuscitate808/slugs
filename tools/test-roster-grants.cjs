const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, f);
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
function fixture(raw = null) {
    let saved = raw;
    const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
    const progress = new Progress(storage);
    const flow = new GameFlow(progress, { levelTable: true }, 42, 1, undefined, 3);
    return { progress, flow, storage };
}
function choose(flow, level) { flow.levels(); flow.select(level); assert(flow.prepare()); }
for (let level = 1; level <= 5; level++) {
    const { progress, flow } = fixture();
    choose(flow, level);
    assert.equal(progress.party.length, [4,5,6,8,10][level-1]);
    assert(flow.start());
    assert.equal(flow.world.zombies.length, [4,5,6,8,10][level-1]);
    assert.equal(flow.target, [3,4,5,6,7][level-1]);
}
console.log('PASS fresh player selects each level: full roster and actual world count');
const { progress, flow, storage } = fixture();
for (let level = 1; level <= 5; level++) {
    choose(flow, level);
    assert.equal(progress.party.length, [4,5,6,8,10][level-1]);
}
assert.equal(new Set(progress.party.map(m => m.id)).size, 10);
const storedId = progress.party[0].id;
assert(flow.storeMember(storedId));
assert(flow.sellMember(progress.party[0].id, 80));
assert.equal(progress.party.length, 8);
choose(flow, 5);
assert.equal(progress.party.length, 8);
let reloaded = new GameFlow(new Progress(storage), { levelTable: true }, 42, 5, undefined, 3);
assert.equal(reloaded.world.zombies.length, 8);
assert.equal(reloaded.progress.collection[0].id, storedId);
console.log('PASS incremental grants, sale, collection and reload do not duplicate members');
const lost = fixture();
assert(lost.flow.start());
lost.flow.world.zombies.forEach((z,i) => { z.state = i === 0 ? 'dead' : 'saved'; });
lost.flow.world.finish(); lost.flow.update(0);
assert.equal(lost.progress.party.length, 3);
assert(lost.flow.advance());
assert.equal(lost.flow.selectedLevel, 2);
assert.equal(lost.progress.party.length, 4);
assert(lost.flow.start());
lost.flow.world.zombies.forEach(z => { z.state = 'dead'; });
lost.flow.world.finish(); lost.flow.update(0);
assert(lost.flow.advance());
assert.equal(lost.progress.party.length, 0);
assert.equal(lost.flow.start(), false);
const restored = new GameFlow(new Progress(lost.storage), { levelTable: true }, 42, 2, undefined, 3);
assert.equal(restored.world.zombies.length, 0);
console.log('PASS victory adds only level increment; defeat/retry/reload never restores deaths');
for (const count of [0, 3, 4, 10]) {
    const legacy = JSON.stringify({version:1,coins:0,unlockedLevel:1,best:{},party:Array.from({length:count},(_,i)=>({id:i+1,kind:i%3,growth:0})),collection:[]});
    const old = fixture(legacy);
    choose(old.flow,5);
    assert.equal(old.progress.party.length + old.progress.collection.length, count + 10 - Math.max(4,count));
    if (count === 10) assert.equal(old.progress.collection.length, 6);
    choose(old.flow,5);
    assert.equal(old.progress.data.rosterGranted,10);
}
console.log('PASS legacy saves migrate once without resetting losses or granting an extra full party');
