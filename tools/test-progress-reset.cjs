const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../assets/Scripts/game');
const stopped = new Set();
const cc = {
    _decorator: { ccclass: () => c => c, property: () => () => {}, requireComponent: () => c => c },
    Enum: v => v, Component: class {}, Color: class {},
    KeyCode: { KEY_R: 82, ESCAPE: 27, SPACE: 32 },
    Button: class { static EventType = { CLICK: 'click' }; },
    Tween: { stopAllByTarget: target => stopped.add(target) },
    view: { getFrameSize: () => ({ width: 1280, height: 720 }) },
};
const cache = new Map();
function load(file) {
    file = path.resolve(root, file);
    if (cache.has(file)) return cache.get(file);
    const exports = {}; cache.set(file, exports);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;
    vm.runInNewContext(source, { exports, console, Date, Math, require: id => id === 'cc' ? cc : id.includes('base/') ? { EventBus: class {} } : load(path.resolve(path.dirname(file), id + '.ts')) });
    return exports;
}
const { Progress } = load('application/Progress.ts');
const { GameFlow } = load('application/GameFlow.ts');
const { GeneratorReward } = load('application/GeneratorReward.ts');
const { GameBootstrap } = load('GameBootstrap.ts');
const { GameHud } = load('presentation/GameHud.ts');
const { PostLevelWindow } = load('presentation/PostLevelWindow.ts');
const { ReviveEffect } = load('presentation/ReviveEffect.ts');
const { EconomyWindows } = load('presentation/EconomyWindows.ts');
const { LeaveWarning } = load('presentation/LeaveWarning.ts');
const { EggWindow } = load('presentation/EggWindow.ts');
const { CollectionWindow } = load('presentation/CollectionWindow.ts');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const values = new Map([['unrelated', 'keep']]);
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const progress = new Progress(storage);
    const flow = new GameFlow(progress, { levelTable: true }, 42, 1, undefined, 3);
    return { values, storage, progress, flow };
}
function dirty(f) {
    f.flow.select(5); f.flow.prepare(); f.flow.start();
    f.flow.world.zombies.forEach(z => { z.state = 'dead'; });
    f.flow.world.finish(); f.flow.update(0);
    Object.assign(f.progress.data, { coins: 999, unlockedLevel: 5, best: { 1: 3, 5: 5 }, eggs: 99, boosters: { slow: 9, teleport: 8 }, generatorClaimedAt: 1000 });
    f.progress.data.collection = [f.progress.createMember(2, 7)];
    f.flow.teleportArmed = true;
    f.progress.save();
}
const fresh = plain(fixture().progress.data);
for (const screen of ['levels', 'prelevel', 'playing', 'paused', 'result', 'complete']) {
    const f = fixture(); dirty(f); f.flow.screen = screen;
    const old = f.flow.world;
    f.flow.resetProgress();
    assert.deepEqual(plain(f.progress.data), fresh);
    assert.equal(f.flow.screen, 'levels'); assert.equal(f.flow.selectedLevel, 1);
    assert.equal(f.flow.world.paused, true); assert.equal(old.paused, true); assert.notEqual(f.flow.world, old);
    assert.equal(f.flow.outcome, null); assert.equal(f.flow.teleportArmed, false);
    assert.equal(f.flow.world.zombies.length, 4); assert.equal(f.flow.world.vehicles.length, 0);
    assert.equal(new GeneratorReward(f.progress, { coins: 60, intervalHours: 6 }).remaining(1001), 0);
    assert.deepEqual(plain(new Progress(f.storage).data), fresh);
    assert.equal(f.values.get('unrelated'), 'keep');
    f.flow.update(100); assert.deepEqual(plain(f.progress.data), fresh);
    f.flow.prepare(); assert(f.flow.start());
    f.flow.world.zombies.forEach(z => { z.state = 'saved'; });
    f.flow.world.finish(); f.flow.update(0);
    assert.equal(f.progress.eggs, 3); assert(f.progress.data.coins > 0);
    f.flow.resetProgress(); assert.deepEqual(plain(f.progress.data), fresh);
}
console.log('PASS reset from all screens: fresh roster/economy, persistence, no stale settlement, new round rewards');
const f = fixture(); dirty(f);
const node = () => ({ active: true });
const fx = Object.assign(new ReviveEffect(), { node: node(), plate: node(), icon: node(), opacity: {} });
const post = Object.assign(new PostLevelWindow(), { node: node(), reviveEffect: fx, outcome: f.flow.outcome, pendingReviveId: 1, shown: [{ member: { id: 1 } }], selectedIndex: 0 });
const economy = Object.assign(new EconomyWindows(), { insufficient: node(), battery: node(), returnToShortage: true, cost: 999 });
let resumed = 0; economy.closed = () => resumed++;
const leave = Object.assign(new LeaveWarning(), { node: node(), pending: () => { throw Error('stale navigation'); } });
const egg = Object.assign(new EggWindow(), { node: node(), member: { id: 7 }, dialog: node(), halo: node(), picture: { node: node() } });
const collection = Object.assign(new CollectionWindow(), { node: node(), isOpen: true, selectedIndex: 0 });
const hud = Object.assign(new GameHud(), { gameLayer: node(), levels: node(), paused: node(), complete: node(), portrait: node(), hint: { string: 'old' }, levelInfo: {}, wallet: {}, levelLabels: Array.from({ length: 5 }, () => ({})), levelStars: Array.from({ length: 5 }, () => ({})) });
let cancelled = 0, rebuilt = 0;
const host = Object.assign(Object.create(GameBootstrap.prototype), { ready: true, resetKeyHeld: false, flow: f.flow, progress: f.progress, postLevel: post, economy, leaveWarning: leave, egg, collection, hud, preLevel: { selectedIndex: 0 }, resumeAfterEconomy: true,
    controls: { cancel() { cancelled++; } }, rebuild() { rebuilt++; }, refresh() { hud.refresh(f.flow.world, f.progress, f.flow); egg.refresh(f.flow, f.progress); collection.refresh(f.flow, f.progress); post.refresh(f.flow, f.progress); } });
host.onKey({ keyCode: 82 });
assert.equal(rebuilt, 1); assert.equal(cancelled, 1); assert.equal(resumed, 0);
assert.equal(host.resumeAfterEconomy, false); assert.equal(host.preLevel.selectedIndex, -1);
assert.equal(leave.pending, null); assert.equal(leave.isOpen, false); assert.equal(economy.isOpen, false);
assert.equal(egg.member, null); assert.equal(egg.node.active, false); assert.equal(collection.node.active, false);
assert.equal(post.pendingReviveId, null); assert.equal(post.outcome, null); assert.equal(fx.node.active, false);
for (const target of [fx.node, fx.plate, fx.icon, fx.opacity, egg.dialog, egg.halo, egg.picture.node]) assert(stopped.has(target));
assert.equal(hud.levels.active, true); assert.equal(hud.paused.active, false); assert.equal(hud.gameLayer.active, false);
assert.equal(hud.wallet.string, 'Монеты: 0'); assert.equal(hud.hint.string, '');
assert(hud.levelStars.every(label => label.string === 'Не пройден'));
for (let i = 0; i < 20; i++) host.onKey({ keyCode: 82 });
assert.equal(rebuilt, 1);
host.onKeyUp({ keyCode: 82 }); host.onKey({ keyCode: 82 }); assert.equal(rebuilt, 2);
host.ready = false; host.onKeyUp({ keyCode: 82 }); host.onKey({ keyCode: 82 }); assert.equal(rebuilt, 2);
console.log('PASS R handler: LevelSelect visible, modal cancellation, tween cleanup, repeat guard, loading guard');
const failing = new Progress({ getItem: () => null, setItem: () => { throw Error('storage blocked'); } });
const failingFlow = new GameFlow(failing, { levelTable: true }, 42);
failing.data.coins = 123; failingFlow.resetProgress();
assert.equal(failing.available, false); assert.equal(failing.data.coins, 0); assert.equal(failingFlow.screen, 'levels');
console.log('PASS unavailable storage: in-memory reset remains playable and failure is reported');
