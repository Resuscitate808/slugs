const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const cache = new Map();
const cc = { _decorator: { ccclass: () => v => v, property: () => () => {} }, Component: class {}, Button: class { static EventType = { CLICK: 'click' }; }, Sprite: class {}, UITransform: class {}, ScrollView: class {} };
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
const { LeaveWarning } = load(root + 'presentation/LeaveWarning.ts');
function button() { let handler; return { node: { on(_, fn, self) { handler = () => fn.call(self); }, off() { handler = null; } }, click() { handler?.(); } }; }
function ui() {
    const w = new LeaveWarning();
    w.node = { active: false, parent: { children: [1, 2] }, setSiblingIndex() {} };
    w.back = button(); w.dismiss = button(); w.confirm = button();
    w.content = { setContentSize(w, h) { this.height = h; } };
    w.scroll = { scrollToTop() {} };
    w.pictures = Array.from({ length: 100 }, () => ({ node: { active: false, setPosition() {} }, spriteFrame: null }));
    w.transforms = w.pictures.map(() => ({ setContentSize(w, h) { this.width = w; this.height = h; } }));
    w.bind(); return w;
}
const catalog = { kindFrame: kind => ({ kind, originalSize: { width: 200, height: 100 } }) };
for (const won of [true, false]) for (const action of ['advance', 'levels', 'start']) {
    const storage = new Map();
    const p = new Progress({ getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) });
    const f = new GameFlow(p, { zombieCount: 8 }, 42);
    f.start(); f.world.zombies.forEach((z, i) => z.state = won && i < 2 ? 'saved' : 'dead'); f.update(1 / 60);
    assert.equal(f.screen, 'result'); assert.equal(f.outcome.won, won);
    p.data.coins = 20;
    assert.equal(f.revive(0, 10), true); assert.equal(f.revive(0, 10), false);
    const lostIds = f.outcome.fallen.filter(e => !e.revived).map(e => e.member.id);
    const w = ui(); let proceeded = 0;
    const proceed = () => { proceeded++; f[action](); };
    w.request(f, catalog, proceed);
    assert.equal(w.isOpen, true);
    assert.equal(w.pictures.filter(x => x.node.active).length, lostIds.length);
    assert.equal(w.transforms[0].width, 110); assert.equal(w.transforms[0].height, 55);
    w.back.click(); assert.equal(w.isOpen, false); assert.equal(proceeded, 0); assert.equal(f.screen, 'result');
    w.request(f, catalog, proceed); w.dismiss.click(); assert.equal(proceeded, 0);
    w.request(f, catalog, proceed); w.request(f, catalog, () => { throw Error('Replaced pending action'); });
    w.confirm.click(); w.confirm.click(); assert.equal(proceeded, 1);
    assert.ok(p.party.every(m => !lostIds.includes(m.id)));
    const restored = new Progress({ getItem: k => storage.get(k) ?? null, setItem() {} });
    assert.ok(restored.party.every(m => !lostIds.includes(m.id)));
    w.unbind();
}
const w = ui(); let calls = 0;
for (const fallen of [[], [{ member: { id: 1, kind: 0 }, revived: true }]]) {
    w.request({ screen: 'result', outcome: { fallen } }, catalog, () => calls++);
    assert.equal(w.isOpen, false);
}
assert.equal(calls, 2);
w.request({ screen: 'result', outcome: { fallen: Array.from({ length: 100 }, (_, i) => ({ member: { id: i, kind: i % 3 }, revived: false })) } }, catalog, () => {});
assert.equal(w.pictures.filter(p => p.node.active).length, 100); assert.equal(w.content.height, 2400);
w.close(); w.unbind();
const scene = JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene', 'utf8'));
const boot = scene.find(c => c.preLevel && c.postLevel);
const c = scene[boot.leaveWarning.__id__];
assert.equal(scene[c.node.__id__]._name, 'LeaveWarning'); assert.equal(c.pictures.length, 100);
assert.equal(scene[c.node.__id__]._active, false);
assert.ok(scene[c.node.__id__]._components.some(r => scene[r.__id__].__type__ === 'cc.BlockInputEvents'));
for (const key of ['back', 'dismiss', 'confirm']) assert.equal(scene[c[key].__id__].__type__, 'cc.Button');
assert.equal(scene[c.scroll.__id__].__type__, 'cc.ScrollView');
assert.doesNotMatch(fs.readFileSync(root + 'presentation/LeaveWarning.ts', 'utf8'), /new Node|instantiate\(|addComponent\(/);
console.log('PASS leave warning: win/loss × next/menu/retry, cancel/cross/confirm once, revive on loss, persisted loss, empty/all revived skip, 100 slots, aspect ratio, scene wiring');
