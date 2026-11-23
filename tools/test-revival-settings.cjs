const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, f);
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
for (const enabled of [false, true]) for (const won of [false, true]) {
    const data = new Map();
    const p = new Progress({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) });
    const f = new GameFlow(p, { levelTable: true }, 42);
    f.revivalEnabled = enabled;
    f.start();
    const original = structuredClone(p.party);
    f.world.zombies.forEach((z, i) => z.state = i < (won ? 3 : 1) ? 'saved' : 'dead');
    f.update(1 / 60);
    assert.equal(f.screen, 'result');
    const saved = won ? 3 : 1;
    assert.equal(p.party.length, enabled ? saved : original.length);
    assert.equal(f.outcome.fallen.length, enabled ? original.length - saved : 0);
    for (const member of original) {
        const kept = p.party.find(m => m.id === member.id);
        if (!enabled || original.indexOf(member) < saved) {
            assert.deepEqual(kept, { ...member, growth: member.growth + (original.indexOf(member) < saved ? 1 : 0) });
        } else assert.equal(kept, undefined);
    }
    const restored = new Progress({ getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) });
    assert.deepEqual(restored.party, p.party);
    p.data.coins = 100;
    const coins = p.data.coins;
    assert.equal(f.revive(0, 10), enabled);
    assert.equal(p.data.coins, coins - (enabled ? 10 : 0));
    assert.equal(f.showPostLevel(), enabled);
    f.advance();
    assert.equal(f.screen, 'prelevel');
    assert.equal(f.selectedLevel, won ? 2 : 1);
}
const scene = JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene', 'utf8'));
const boot = scene.find(c => c._id === 'zombie-road-bootstrap');
assert.equal(scene[boot.postLevel.__id__].revivalEnabled, false);
console.log('PASS revival toggle: both outcomes, enabled/disabled, spending guard, next/retry and scene default');
