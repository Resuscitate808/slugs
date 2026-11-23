const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
const cc = { _decorator: { ccclass: () => v => v, property: (...args) => args.length > 1 ? undefined : () => {} }, Component: class {}, Button: class { static EventType = { CLICK: 'click' }; }, Label: class {}, UITransform: class {} };
function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } }).outputText;
    vm.runInNewContext(source, { exports, console, Date, Math, require: id => id === 'cc' ? cc : load(path.resolve(path.dirname(file), id + '.ts')) });
    return exports;
}
const root = '../assets/Scripts/game/';
const { Progress } = load(root + 'application/Progress.ts');
const { GameFlow } = load(root + 'application/GameFlow.ts');
const { LevelResultWindow } = load(root + 'presentation/LevelResultWindow.ts');
function button() {
    let handler;
    return { node: { on(_, fn, self) { handler = () => fn.call(self); }, off() { handler = null; } }, click() { handler?.(); } };
}
function ui(won) {
    const w = new LevelResultWindow();
    w.node = { active: false }; w.won = won;
    w.nextButton = button(); w.levelsButton = button(); w.exitButton = button();
    w.savedLabel = { string: '' }; w.targetLabel = { string: '' };
    w.track = w.targetTrack = { width: 276 };
    const fill = () => ({ width: 0, height: 58, node: { active: false }, setContentSize(w, h) { this.width = w; this.height = h; } });
    w.fill = fill(); w.targetFill = fill();
    return w;
}
for (const won of [true, false]) for (const action of ['nextButton', 'levelsButton', 'exitButton']) {
    const storage = new Map();
    const p = new Progress({ getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) });
    const f = new GameFlow(p, { levelTable: true }, 42);
    f.start();
    f.world.zombies.forEach((z, i) => z.state = i < (won ? 4 : 1) ? 'saved' : 'dead');
    f.update(1 / 60);
    assert.equal(f.screen, 'result'); assert.equal(f.resultIntro, true);
    assert.equal(f.world.result.won, won);
    const coins = p.data.coins, eggs = p.eggs, outcome = f.outcome, world = f.world;
    const win = ui(true), fail = ui(false);
    let nextCalls = 0, menuCalls = 0;
    const refresh = () => { win.refresh(f); fail.refresh(f); };
    for (const w of [win, fail]) w.bind({ next: () => { if (f.showPostLevel()) nextCalls++; refresh(); }, levels: () => { menuCalls++; f.levels(); refresh(); } });
    refresh();
    const active = won ? win : fail, hidden = won ? fail : win;
    assert.equal(active.node.active, true); assert.equal(hidden.node.active, false);
    assert.equal(active.savedLabel.string, `${won ? 4 : 1} / 4`);
    assert.equal(active.targetLabel.string, `${won ? 4 : 1} / 3`);
    assert.equal(active.fill.width, won ? 276 : 69);
    assert.equal(active.targetFill.width, won ? 276 : 92);
    hidden.nextButton.click(); hidden.exitButton.click();
    assert.equal(f.resultIntro, true); assert.equal(menuCalls, 0);
    for (let i = 0; i < 10; i++) f.update(1);
    active[action].click(); active[action].click();
    assert.equal(p.data.coins, coins); assert.equal(p.eggs, eggs);
    assert.equal(f.resultIntro, false);
    if (action === 'nextButton') {
        assert.equal(nextCalls, 1); assert.equal(f.screen, 'result');
        assert.equal(f.world, world); assert.equal(f.outcome, outcome);
        f.advance(); assert.equal(f.selectedLevel, won ? 2 : 1); assert.equal(f.screen, 'prelevel');
    } else { assert.equal(menuCalls, 1); assert.equal(f.screen, 'levels'); }
    win.unbind(); fail.unbind();
    f.resetProgress(); assert.equal(f.resultIntro, false); assert.equal(f.screen, 'levels');
}
const scene = JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene', 'utf8'));
const boot = scene.find(c => c._id === 'zombie-road-bootstrap');
for (const [field, name, won] of [['levelComplete', 'LevelComolete', true], ['levelFailed', 'LevelFailed', false]]) {
    const c = scene[boot[field].__id__], node = scene[c.node.__id__];
    assert.equal(node._name, name); assert.equal(c.won, won); assert.equal(node._active, false);
    assert.ok(node._components.some(r => scene[r.__id__].__type__ === 'cc.BlockInputEvents'));
    for (const k of ['nextButton', 'levelsButton', 'exitButton']) assert.equal(scene[c[k].__id__].__type__, 'cc.Button');
    for (const k of ['savedLabel', 'targetLabel']) assert.equal(scene[c[k].__id__].__type__, 'cc.Label');
    for (const k of ['track', 'fill', 'targetTrack', 'targetFill']) assert.equal(scene[c[k].__id__].__type__, 'cc.UITransform');
}
const bootSource = fs.readFileSync(root + 'GameBootstrap.ts', 'utf8');
assert.match(bootSource, /levels: \(\) => this.requestLeave\(\(\) => \{ this.flow.levels\(\)/);
assert.match(fs.readFileSync(root + 'presentation/PostLevelWindow.ts', 'utf8'), /!flow.resultIntro/);
assert.doesNotMatch(fs.readFileSync(root + 'presentation/LevelResultWindow.ts', 'utf8'), /new Node|instantiate\(|addComponent\(/);
console.log('PASS result windows: win/loss, all six buttons, final counts/fills, hidden and duplicate clicks, single rewards, PostLevel continuity, next/retry, reset and scene wiring');
