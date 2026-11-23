
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const scene = JSON.parse(read('assets/Scenes/ZombieRoad.scene'));
function typeFor(file) {
    const hex = JSON.parse(read(file + '.meta')).uuid.replaceAll('-', '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(hex.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
function test(name, fn) { fn(); console.log('PASS UI ' + name); }

function findMeta(uuid) {
    let hit = null;
    (function scan(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) scan(full);
            else if (e.name.endsWith('.png.meta') && Object.values(JSON.parse(fs.readFileSync(full, 'utf8')).subMetas || {}).some(s => s.uuid === uuid)) hit = full;
        }
    })(path.join(root, 'assets'));
    return hit;
}
const hudFile = 'assets/Scripts/game/presentation/GameHud.ts';
const startupFile = 'assets/Scripts/game/presentation/StartupScreen.ts';
const bootstrap = scene.find(o => o.__type__ === typeFor('assets/Scripts/game/GameBootstrap.ts'));
const hudData = scene[bootstrap.hud.__id__], startupData = scene[bootstrap.startup.__id__];
const components = node => node._components.map(r => scene[r.__id__]);
test('all serialized references, node parents and component owners resolve', () => {
    function walk(value) {
        if (!value || typeof value !== 'object') return;
        if ('__id__' in value) assert.ok(Number.isInteger(value.__id__) && scene[value.__id__], `Bad reference ${value.__id__}`);
        for (const child of Object.values(value)) walk(child);
    }
    walk(scene);
    scene.forEach((o, id) => {
        if (o._children) for (const r of o._children) assert.equal(scene[r.__id__]._parent.__id__, id);
        if (o._components) for (const r of o._components) assert.equal(scene[r.__id__].node.__id__, id);
    });
    assert.equal(hudData.__type__, typeFor(hudFile));
    assert.equal(startupData.__type__, typeFor(startupFile));
    assert.equal(scene.filter(o => o.__type__ === 'cc.Canvas').length, 1);

    assert.equal(scene.filter(o => o.__type__ === 'cc.Button').length, 177);
    assert.ok(!('result' in hudData) && !scene.some(o => o._name === 'RoundResult'), 'Win/loss lives in PostLevel only');
    for (const key of ['levels', 'paused', 'complete'])
        assert.ok(components(scene[hudData[key].__id__]).some(c => c.__type__ === 'cc.BlockInputEvents'));
    assert.ok(components(scene[scene[bootstrap.postLevel.__id__].node.__id__]).some(c => c.__type__ === 'cc.BlockInputEvents'));
    assert.ok(components(scene[startupData.panel.__id__]).some(c => c.__type__ === 'cc.BlockInputEvents'));

    const known = new Set();
    (function scan(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) scan(full);
            else if (entry.name.endsWith('.meta')) {
                try { for (const sub of Object.values(JSON.parse(fs.readFileSync(full, 'utf8')).subMetas || {})) if (sub.uuid) known.add(sub.uuid); } catch {}
            }
        }
    })(path.join(root, 'assets'));
    for (const sprite of scene.filter(o => o.__type__ === 'cc.Sprite')) {
        if (sprite._spriteFrame) assert.ok(known.has(sprite._spriteFrame.__uuid__), `Unknown SpriteFrame ${sprite._spriteFrame.__uuid__}`);
        assert.equal(sprite._sizeMode, 0, 'Custom size must survive replacing a frame');
    }
});
test('presenters never generate, destroy or search for UI nodes', () => {
    for (const file of [hudFile, startupFile]) {
        const source = read(file);
        assert.doesNotMatch(source, /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    }
    assert.doesNotMatch(read('assets/Scripts/game/GameBootstrap.ts'), /new (GameHud|StartupScreen)\s*\(/);
});

class FakeNode {
    constructor() { this.active = true; this.listeners = new Map(); }
    on(event, fn, target) { const list = this.listeners.get(event) || []; list.push({ fn, target }); this.listeners.set(event, list); }
    off(event, fn, target) { this.listeners.set(event, (this.listeners.get(event) || []).filter(x => x.fn !== fn || x.target !== target)); }
    emit(event) { for (const x of this.listeners.get(event) || []) x.fn.call(x.target); }
    setScale(x, y, z) { this.scale = [x, y, z]; }
}
const tweens = [];
function fakeTween(target) {
    const t = { target, steps: [], started: false };
    for (const m of ['to', 'delay', 'call', 'repeat', 'repeatForever']) t[m] = (...a) => { t.steps.push([m, a]); return t; };
    t.start = () => { t.started = true; tweens.push(t); return t; };
    return t;
}
class FakeButton { static EventType = { CLICK: 'click' }; }
class Color { constructor(r, g, b, a) { Object.assign(this, { r, g, b, a }); } }
let frame = { width: 1280, height: 720 };
const cc = { _decorator: { ccclass: () => value => value, property: () => () => {} }, Component: class {}, Node: FakeNode, Label: class {}, Button: FakeButton, Sprite: class {}, SpriteFrame: class {}, UITransform: class {}, CCInteger: 'Integer', CCString: 'String', Color, view: { getFrameSize: () => frame }, tween: fakeTween, Tween: { stopAllByTarget: () => {} }, Vec3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } };
function load(file) {
    const exports = {};
    const compiled = ts.transpileModule(read(file), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText;

    vm.runInNewContext(compiled, { exports, require: id => id === 'cc' ? cc : id.startsWith('./') ? load(path.join(path.dirname(file), id + '.ts')) : require(path.resolve(root, path.dirname(file), id + '.ts')) });
    return exports;
}
const objects = scene.map(o => o.__type__ === 'cc.Node' ? Object.assign(new FakeNode(), { active: o._active }) : {});
scene.forEach((o, i) => { if (o.node) objects[i].node = objects[o.node.__id__]; });
function hydrate(instance, data) {
    for (const [key, value] of Object.entries(data)) {
        if (key.startsWith('_') || key === 'node') continue;
        instance[key] = Array.isArray(value) ? value.map(v => v && typeof v === 'object' && '__id__' in v ? objects[v.__id__] : v) : value && typeof value === 'object' && '__id__' in value ? objects[value.__id__] : value;
    }
    return instance;
}
const hud = hydrate(new (load(hudFile).GameHud)(), hudData);
const startup = hydrate(new (load(startupFile).StartupScreen)(), startupData);
const { parseLevelCatalog } = require('../assets/Scripts/game/domain/LevelCatalog.ts');
const { Progress } = require('../assets/Scripts/game/application/Progress.ts');
const { GameFlow } = require('../assets/Scripts/game/application/GameFlow.ts');
const progress = new Progress({ getItem: () => null, setItem: () => {} });
const flow = new GameFlow(progress, {}, 42, 1, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))));
let cancels = 0, actionsRun = 0;
const refresh = () => hud.refresh(flow.world, progress, flow);
const action = fn => () => { actionsRun++; fn(); refresh(); };
const actions = { select: level => { flow.select(level); refresh(); }, play: action(() => flow.prepare()), pause: action(() => flow.togglePause()), retry: action(() => flow.start()), levels: action(() => flow.levels()), cancel: () => cancels++ };
const click = button => button.node.emit('click');
test('scene-bound selection, start, pause, resume, retry and menu actions', () => {
    hud.bind(actions); hud.bind(actions); refresh();
    assert.equal(hud.levels.active, true);
    click(hud.levelButtons[2]); assert.equal(flow.selectedLevel, 3);
    assert.match(hud.levelInfo.string, /^Уровень 03\nЦель:/, 'No authored level names/descriptions');
    click(hud.playButton); assert.equal(actionsRun, 1, 'Rebind must not duplicate listeners');
    assert.equal(flow.screen, 'prelevel'); assert.equal(hud.levels.active, false); assert.equal(hud.gameLayer.active, false);
    assert.equal(flow.start(), true); refresh();
    assert.equal(flow.screen, 'playing'); assert.equal(hud.gameLayer.active, true); assert.equal(hud.levels.active, false);
    assert.equal(hud.cancelButton.node.active, false, 'Cancel must remain hidden during gameplay');
    const topBar = scene.find(o => o._name === 'TopBar');

    const topSprite = topBar && components(topBar).find(c => c.__type__ === 'cc.Sprite');
    if (topSprite) assert.deepEqual([topSprite._color.r, topSprite._color.g, topSprite._color.b, topSprite._color.a], [238, 229, 203, 255]);
    assert.equal(cancels, 0);
    click(hud.pauseButton); assert.equal(flow.screen, 'paused'); assert.equal(hud.paused.active, true);
    click(hud.resumeButton); assert.equal(flow.screen, 'playing');
    click(hud.pauseButton); const oldWorld = flow.world; click(hud.restartButton); assert.notEqual(flow.world, oldWorld);
    click(hud.pauseButton); click(hud.pauseLevelsButton); assert.equal(flow.screen, 'levels');
});
test('loss/retry, victory/advance, five-level completion, portrait and cleanup', () => {
    flow.select(1); flow.start();
    for (const z of flow.world.zombies) z.state = 'dead';
    flow.update(1 / 60); refresh(); assert.equal(flow.screen, 'result'); assert.equal(hud.levels.active, false);
    assert.equal(flow.advance(), true); assert.equal(flow.screen, 'prelevel'); assert.equal(flow.selectedLevel, 1, 'Loss repeats the level');
    assert.equal(flow.start(), false, 'All unrevived slugs lost; empty party cannot start');
    const baby = flow.hatchEgg(() => 0);
    assert.ok(baby);
    assert.equal(flow.takeFromCollection(baby.id), true);
    for (let level = 1; level <= 5; level++) {
        flow.start();
        for (const z of flow.world.zombies) z.state = 'saved';
        flow.update(1 / 60); refresh();
        flow.advance(); refresh();
        if (level < 5) { assert.equal(flow.screen, 'prelevel'); assert.equal(flow.selectedLevel, level + 1); }
    }
    assert.equal(flow.screen, 'complete'); assert.equal(hud.complete.active, true);
    assert.match(hud.completionText.string, /5 из 5/);
    click(hud.chooseLevelButton); assert.equal(flow.screen, 'levels');
    frame = { width: 390, height: 844 }; refresh(); assert.equal(hud.portrait.active, true);
    hud.notice('test'); assert.equal(hud.hint.string, 'test');
    hud.unbind(); const calls = actionsRun; click(hud.playButton); assert.equal(actionsRun, calls);
});
test('loading/error/retry reuses scene nodes without duplicate listeners', () => {
    let retries = 0;
    startup.bind(() => retries++); startup.bind(() => retries++);
    startup.show('loading', false); assert.equal(startup.panel.active, true); assert.equal(startup.retryButton.node.active, false);
    startup.show('JSON error', true); assert.equal(startup.status.string, 'JSON error'); assert.equal(startup.retryButton.node.active, true);
    click(startup.retryButton); assert.equal(retries, 1);
    startup.hide(); assert.equal(startup.panel.active, false);
    startup.show('retry', false); assert.equal(startup.panel.active, true);
    startup.unbind(); click(startup.retryButton); assert.equal(retries, 1);
});
test('PreLevel window: scene node, own component, one picture per zombie, only Road works', () => {
    const preFile = 'assets/Scripts/game/presentation/PreLevelWindow.ts';
    for (const f of [preFile, 'assets/Scripts/game/presentation/PreLevelCard.ts'])
        assert.doesNotMatch(read(f), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    const data = scene[bootstrap.preLevel.__id__];
    assert.equal(data.__type__, typeFor(preFile));
    const host = scene[data.node.__id__];
    assert.equal(host._name, 'PreLevel'); assert.equal(scene[host._parent.__id__]._name, 'GameUI');
    assert.ok(components(host).some(c => c.__type__ === 'cc.BlockInputEvents'));
    const skinsIndex = scene.findIndex(o => o._name === 'Skins');
    assert.ok(data.cards.length >= 20, 'One authored card per zombie of the level');
    for (const r of data.cards) assert.equal(scene[scene[r.__id__].node.__id__]._parent.__id__, skinsIndex);
    assert.ok(components(scene[scene[skinsIndex]._parent.__id__]).some(c => c.__type__ === 'cc.Mask'), 'Cards are clipped by a mask');
    assert.ok(scene.some(o => o.__type__ === 'cc.ScrollView' && o._content.__id__ === skinsIndex), 'Cards scroll when more than two rows');
    assert.ok(components(scene[skinsIndex]).some(c => c.__type__ === 'cc.Layout'));
    const gameSettings = scene.find(o => o.obstacleSprites && o.landscapeSprites);
    assert.ok(!('skins' in gameSettings), 'Skins must not live in GameSettings');
    assert.ok(!('zombieSprite' in gameSettings), 'Zombie pictures come only from PreLevelWindow → Skins');
    assert.doesNotMatch(read('assets/Scripts/game/presentation/GameSettings.ts'), /zombieSprite/);
    assert.equal(scene[data.zombieLook.__id__].__type__, 'ZombieLook', 'Road look of skins lives on PreLevelWindow');
    for (const name of ['Replace']) {
        const b = components(scene.find(o => o._name === name && o.__type__ === 'cc.Node')).find(c => c.__type__ === 'cc.Button');
        assert.equal(b._interactable, false, name + ' is a placeholder');
    }
    assert.equal(scene[data.eggsButton.__id__]._interactable, true, 'Eggs opens the egg window');
    assert.equal(scene[data.collectionButton.__id__]._interactable, true, 'Collection opens the collection window');
    assert.equal(scene[data.toCollectionButton.__id__].__type__, 'cc.Button');
    const win = hydrate(new (load(preFile).PreLevelWindow)(), data);
    win.node = objects[data.node.__id__];
    const { ZombieLook } = load('assets/Scripts/game/presentation/SpriteStyle.ts');
    const { __type__: _lookType, ...lookData } = scene[data.zombieLook.__id__];
    win.zombieLook = Object.assign(new ZombieLook(), lookData);

    const { PreLevelCard } = load('assets/Scripts/game/presentation/PreLevelCard.ts');
    win.cards = data.cards.map(r => { const c = Object.setPrototypeOf(hydrate(objects[r.__id__], scene[r.__id__]), PreLevelCard.prototype); c.node = objects[scene[r.__id__].node.__id__]; return c; });
    for (const c of win.cards) {
        c.title.string = ''; c.caption.string = '';
        c.pictureTransform.setContentSize = (w, h) => { c.pictureTransform.size = [w, h]; };
    }

    const frames = [{ id: 'a', originalSize: { width: 50, height: 100 } }, { id: 'b', originalSize: { width: 300, height: 100 } }];
    assert.deepEqual(win.growthCaptions, ['Малыш', 'Подросток', 'Взрослый'], 'Growth stages authored in the scene');
    for (const r of data.skins) assert.ok(!('caption' in scene[r.__id__]) && Number.isInteger(scene[r.__id__].reviveCost));
    win.skins = [{ name: 'A', reviveCost: 10, frame: frames[0] }, { name: 'B', reviveCost: 40, frame: frames[1] }];
    const store = new Map();
    const p = new Progress({ getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    assert.equal(p.data.coins, 0, 'Starting balance stays 0');
    const { GeneratorReward } = require('../assets/Scripts/game/application/GeneratorReward.ts');
    const reward = new GeneratorReward(p, win.rewardRules);
    const f = new GameFlow(p, {}, 7, 2, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))), win.kindCount);
    let road = 0, now = 1_000_000;
    const acts = { road: () => { road++; f.start(); }, claim: () => { reward.claim(now); } };
    win.bind(acts); win.bind(acts);
    const show = () => win.refresh(f.world, p, f, reward, now);
    show(); assert.equal(win.node.active, false, 'Hidden outside prelevel');
    assert.equal(f.prepare(), true); show();
    assert.equal(win.node.active, true); assert.match(win.title.string, /^Уровень 02$/);
    assert.equal(win.coins.string, 'Монеты 0');
    const count = f.world.zombies.length;
    assert.equal(win.batchLabel.string, `В партии ${count} / ${f.partyLimit}`);
    assert.equal(win.cards.filter(c => c.node.active).length, Math.min(count, win.cards.length));
    assert.equal(win.cards[0].picture.spriteFrame, frames[0]); assert.equal(win.cards[1].picture.spriteFrame, frames[1]); assert.equal(win.cards[2].picture.spriteFrame, frames[0], 'Kinds repeat');
    assert.equal(win.cards[1].title.string, 'B'); assert.equal(win.cards[1].caption.string, 'Малыш', 'New party: all babies');
    const ratio = c => c.pictureTransform.size[0] / c.pictureTransform.size[1];
    assert.ok(Math.abs(ratio(win.cards[0]) - 0.5) < 0.02 && Math.abs(ratio(win.cards[1]) - 3) < 0.05, 'Pictures keep original proportions');
    for (const c of win.cards.slice(0, 2)) assert.ok(c.pictureTransform.size[0] <= win.pictureMaxWidth && c.pictureTransform.size[1] <= win.pictureMaxHeight);
    const frameName = r => path.basename(findMeta(r.__uuid__), '.png.meta');
    assert.equal(frameName(win.cardFrame), 'Vector-2'); assert.equal(frameName(win.selectedCardFrame), 'Vector-3');
    assert.ok(!scene.some(o => o._name === 'SelectedRing'), 'Selection is shown by the Vector-3 body');
    const marked = () => win.cards.map((c, i) => c.selectedBadge.active && c.body.spriteFrame === win.selectedCardFrame ? i : -1).filter(i => i >= 0);
    assert.ok(win.cards.every(c => !c.node.active || c.body.spriteFrame === win.cardFrame), 'Every card starts with Vector-2');
    assert.deepEqual(marked(), [], 'No card is preselected');
    for (const r of data.cards) {
        const card = scene[r.__id__];
        assert.equal(scene[card.body.__id__]._spriteFrame.__uuid__, data.cardFrame.__uuid__, 'Scene Body is Vector-2');
        assert.equal(scene[card.selectedBadge.__id__]._active, false, 'Scene badge hidden');
    }

    const styles = win.zombieStyles();
    assert.deepEqual(styles.map(s => s.frame), frames);
    assert.ok(styles.every(s => s.width === lookData.width && s.billboard === lookData.billboard && s.lift === lookData.lift));

    const viewExports = {};
    vm.runInNewContext(ts.transpileModule(read('assets/Scripts/game/presentation/WorldView.ts'), { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText,
        { exports: viewExports, require: () => ({}) });
    const { WorldView } = viewExports;
    const roadView = Object.create(WorldView.prototype);
    roadView.zombieSkins = styles;
    for (let i = 0; i < count; i++) assert.equal(roadView.styleFor(roadView.zombieKind(i)).frame, win.cards[i].picture.spriteFrame, `zombie ${i} matches card ${i}`);
    roadView.zombieSkins = [];
    assert.equal(roadView.zombieKind(0), 'zombie', 'Empty Skins keeps prefab fallback');
    const worldBefore = f.world, screenBefore = f.screen;
    click(win.cards[3].button); assert.deepEqual(marked(), [3]); assert.equal(win.selectedIndex, 3);
    assert.equal(f.world, worldBefore); assert.equal(f.screen, screenBefore, 'Selection is cosmetic only');
    show(); assert.deepEqual(marked(), [3], 'Refresh keeps the highlight');
    assert.equal(win.claimButton.interactable, true); assert.equal(win.claimTimer.string, 'Можно забрать');
    click(win.claimButton); show();
    assert.equal(p.data.coins, 60); assert.equal(win.coins.string, 'Монеты 60');
    assert.equal(win.claimButton.interactable, false); assert.equal(win.claimTimer.string, 'Следующая через 06:00:00');
    now += 6 * 3600 * 1000 - 1000; click(win.claimButton); show();
    assert.equal(p.data.coins, 60, 'No claim before 6 hours'); assert.equal(win.claimTimer.string, 'Следующая через 00:00:01');
    const reloaded = new Progress({ getItem: k => store.get(k) ?? null, setItem: () => {} });
    assert.equal(new GeneratorReward(reloaded, win.rewardRules).remaining(now), 1000, 'Cooldown survives restart');
    now += 1000; click(win.claimButton); assert.equal(p.data.coins, 120);
    assert.equal(new GeneratorReward(p, win.rewardRules).remaining(now - 10_000), 6 * 3600 * 1000, 'Clock rewind restarts wait, no free claims');
    assert.equal(f.screen, 'prelevel', 'Claim never starts the level');
    click(win.roadButton); assert.equal(road, 1, 'Rebind must not duplicate listeners'); assert.equal(f.screen, 'playing');
    show(); assert.equal(win.node.active, false);
    win.unbind(); click(win.roadButton); assert.equal(road, 1);
});
test('PostLevel: delivered grow, run-over can be revived for coins, party carries to the next PreLevel', () => {
    const postFile = 'assets/Scripts/game/presentation/PostLevelWindow.ts';
    for (const f of [postFile, 'assets/Scripts/game/presentation/FallenRow.ts'])
        assert.doesNotMatch(read(f), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    const data = scene[bootstrap.postLevel.__id__];
    assert.equal(data.__type__, typeFor(postFile));
    const host = scene[data.node.__id__];
    assert.equal(host._name, 'PostLevel'); assert.equal(scene[host._parent.__id__]._name, 'GameUI'); assert.equal(host._active, false);
    assert.ok(data.cards.length >= 20 && data.rows.length >= 20, 'Enough cards/rows for every zombie of a level');
    assert.equal(scene[scene[data.sellButton.__id__].node.__id__]._name, 'Sell', 'PostLevel Sell is wired');
    assert.equal(scene[data.toCollectionButton.__id__].__type__, 'cc.Button', 'PostLevel ToCollection is wired');
    const fit = t => { if (t) t.setContentSize = (w, h) => { t.size = [w, h]; }; };
    const post = hydrate(new (load(postFile).PostLevelWindow)(), data);
    post.node = objects[data.node.__id__];
    const { PreLevelCard } = load('assets/Scripts/game/presentation/PreLevelCard.ts');
    post.cards = data.cards.map(r => { const c = Object.setPrototypeOf(hydrate(objects[r.__id__], scene[r.__id__]), PreLevelCard.prototype); c.node = objects[scene[r.__id__].node.__id__]; fit(c.pictureTransform); return c; });
    post.rows = data.rows.map(r => { const row = hydrate(objects[r.__id__], scene[r.__id__]); row.node = objects[scene[r.__id__].node.__id__]; fit(row.pictureTransform); return row; });
    fit(post.selectedPictureTransform);
    const pre = new (load('assets/Scripts/game/presentation/PreLevelWindow.ts').PreLevelWindow)();
    const frames = [{ originalSize: { width: 50, height: 100 } }, { originalSize: { width: 100, height: 50 } }];
    pre.skins = [{ name: 'Обычный', reviveCost: 10, frame: frames[0] }, { name: 'Редкий', reviveCost: 40, frame: frames[1] }];
    post.catalog = pre; post.setCardFrames('normal', 'selected');

    const fxData = scene[data.reviveEffect.__id__];
    assert.equal(fxData.__type__, typeFor('assets/Scripts/game/presentation/ReviveEffect.ts'));
    const fxNode = scene[fxData.node.__id__];
    assert.equal(fxNode._name, 'ReviveFx'); assert.equal(fxNode._parent.__id__, data.node.__id__); assert.equal(fxNode._active, false, 'Hidden until a revive');
    const iconSprite = components(scene[fxData.icon.__id__]).find(c => c.__type__ === 'cc.Sprite');
    assert.equal(path.basename(findMeta(iconSprite._spriteFrame.__uuid__), '.png.meta'), 'Restarter');
    assert.equal(fxData.duration, 3);
    assert.doesNotMatch(read('assets/Scripts/game/presentation/ReviveEffect.ts'), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(/);
    let plays = 0;
    post.reviveEffect = { node: { active: false }, play() { plays++; this.node.active = true; } };
    const store = new Map();
    const p = new Progress({ getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    const f = new GameFlow(p, { zombieCount: 6 }, 3, 1, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))), pre.kindCount);
    let nexts = 0;
    const acts = { next: () => { nexts++; f.advance(); }, revive: (i, cost) => f.revive(i, cost) };
    post.bind(acts); post.bind(acts);
    const show = () => post.refresh(f, p);
    f.start(); show(); assert.equal(post.node.active, false, 'Hidden during the round');
    assert.deepEqual(f.lineup.map(m => m.kind), [0, 1, 0, 1, 0, 1]);

    f.world.zombies.forEach((z, i) => z.state = i < 4 ? 'saved' : 'dead');
    f.update(1 / 60); show();
    assert.equal(post.node.active, false, 'Intermediate result precedes PostLevel');
    assert.equal(f.showPostLevel(), true); show();
    assert.equal(post.node.active, true);
    assert.equal(post.title.string, 'ПАРТИЯ ДОСТАВЛЕНА!');
    assert.ok(post.headerBackground && post.nextLabel, 'Header plate and Next label are wired in the scene');
    const plateNode = scene[scene[data.headerBackground.__id__].node.__id__];
    assert.equal(plateNode._name, 'Fill'); assert.equal(scene[plateNode._parent.__id__]._name, 'Header', 'Plate is PostLevel/Header/Fill');
    assert.equal(scene[scene[data.nextLabel.__id__].node.__id__]._name, 'NextLabel');
    const rgb = c => [c.r, c.g, c.b];
    assert.deepEqual(rgb(post.headerBackground.color), [0xc8, 0xe5, 0x7a], 'Win plate stays green');
    assert.equal(post.nextLabel.string, 'Дальше');
    assert.equal(post.deliveredTitle.string, 'Доставленные: 4'); assert.equal(post.fallenTitle.string, 'Сбитые: 2');
    assert.equal(post.cards.filter(c => c.node.active).length, 4);
    assert.equal(post.cards[1].title.string, 'Редкий'); assert.equal(post.cards[1].caption.string, 'Подросток', 'Delivered are no longer babies');
    assert.equal(post.rows.filter(r => r.node.active).length, 2);
    assert.equal(post.rows[1].reviveLabel.string, 'Воскресить · 40');
    assert.equal(p.data.coins, f.world.result.coins, 'Round reward credited once');
    p.data.coins = 20; show(); const coins = 20;
    assert.equal(post.rows[0].reviveButton.interactable, true); assert.equal(post.rows[1].reviveButton.interactable, true, 'Insufficient balance opens the coins dialog');
    click(post.rows[1].reviveButton); assert.equal(p.data.coins, coins, 'Disabled revive never charges');
    assert.equal(plays, 0, 'No toast without a paid revive');
    click(post.rows[0].reviveButton);
    assert.ok(post.rows.every(row => !row.reviveButton.interactable), 'All revive buttons lock immediately, before refresh');
    p.data.coins = 100;
    click(post.rows[1].reviveButton);
    assert.equal(p.data.coins, 100, 'Rapid click on another zombie cannot spend coins during the effect');
    assert.equal(f.outcome.fallen[1].revived, false);
    show();
    assert.equal(post.rows[1].reviveButton.interactable, false, 'Refresh cannot unlock buttons while the effect is visible');
    assert.equal(post.cards.filter(c => c.node.active).length, 4, 'Revived slug stays hidden while ReviveFx is visible');
    assert.equal(f.outcome.fallen[0].revived, true, 'Paid revive is saved immediately');
    click(post.rows[1].reviveButton);
    assert.equal(plays, 1, 'Blocked clicks cannot restart the effect');
    assert.equal(p.data.coins, 100);
    post.reviveEffect.node.active = false; show();
    assert.equal(post.rows[1].reviveButton.interactable, true, 'Eligible revive unlocks when the effect hides');
    assert.equal(post.rows[0].reviveButton.interactable, false, 'Already revived zombie stays disabled');
    p.data.coins = coins - 10; show();
    assert.equal(post.rows[1].reviveButton.interactable, true, 'Insufficient balance remains clickable after unlocking');
    assert.equal(p.data.coins, coins - 10); assert.equal(post.rows[0].reviveLabel.string, 'Воскрешён');
    assert.equal(plays, 1, 'Paid revive shows ReviveFx');
    click(post.rows[0].reviveButton); assert.equal(p.data.coins, coins - 10, 'One revive per fallen zombie');
    assert.equal(plays, 1, 'Repeated click shows nothing');
    click(post.cards[2].button); show();
    assert.equal(post.cards[2].body.spriteFrame, 'selected'); assert.equal(post.cards[0].body.spriteFrame, 'normal');
    assert.match(post.selectedLabel.string, /^Выбран: обычный · подросток$/);
    assert.equal(post.toCollectionButton.interactable, true, 'Selected delivered slug can go to the collection');
    assert.equal(post.cards.filter(c => c.node.active).length, 5, 'Revived slug appears in the left grid');
    assert.match(post.cards[4].caption.string, /воскрешён$/);
    assert.match(post.deliveredTitle.string, /воскрешены: 1/);

    const saved = JSON.parse(store.get('zombie-road.progress.v1')).party;
    assert.deepEqual(saved, [{ id: 1, kind: 0, growth: 1 }, { id: 2, kind: 1, growth: 1 }, { id: 3, kind: 0, growth: 1 }, { id: 4, kind: 1, growth: 1 }, { id: 5, kind: 0, growth: 0 }]);
    click(post.nextButton); assert.equal(nexts, 1, 'Rebind must not duplicate listeners');
    assert.equal(f.screen, 'prelevel'); assert.equal(f.selectedLevel, 2); show(); assert.equal(post.node.active, false);
    assert.deepEqual(f.lineup, saved, 'Not revived slug is gone, no free babies fill the gap');
    assert.equal(f.world.zombies.length, 5);

    const reloaded = new Progress({ getItem: k => store.get(k) ?? null, setItem: () => {} });
    assert.deepEqual(reloaded.party, saved);
    f.start(); f.world.zombies[0].state = 'saved'; f.world.zombies.slice(1).forEach(z => z.state = 'dead'); f.update(1 / 60);
    assert.equal(f.outcome.delivered[0].growth, 2); assert.equal(pre.growthCaption(2), 'Взрослый'); assert.equal(pre.growthCaption(9), 'Взрослый');
    assert.equal(f.world.result.won, false); f.showPostLevel(); show(); assert.equal(post.title.string, 'НЕ ВСЕ ДОБРАЛИСЬ');
    assert.deepEqual(rgb(post.headerBackground.color), [0xff, 0xab, 0x8d], 'Loss plate is #ffab8d');
    assert.equal(post.nextLabel.string, 'Повторить', 'A loss never offers «Дальше»');
    assert.match(post.rows[0].reviveLabel.string, /^Воскресить/);
    assert.equal(post.rows[0].reviveButton.interactable, true, 'Paid revive is available on a loss');
    click(post.nextButton); assert.equal(f.selectedLevel, 2, 'Retry returns to PreLevel of the same level');
    assert.equal(f.screen, 'prelevel');
    assert.equal(f.lineup.length, 1, 'Retry keeps only survivors and revived slugs');

    const bad = new Progress({ getItem: () => JSON.stringify({ version: 1, coins: 0, unlockedLevel: 1, best: {}, party: [{ kind: -1, growth: 0 }, { kind: 'x' }, { kind: 1, growth: 2 }] }), setItem: () => {} });
    assert.deepEqual(bad.party, [{ id: 1, kind: 1, growth: 2 }]);
    post.unbind(); click(post.nextButton); assert.equal(nexts, 2);

    const plate = { color: null }, label = { string: '' };
    const parts = { 'Header/Fill': plate, 'Next/Fill/NextLabel': label };
    post.headerBackground = null; post.nextLabel = null;
    post.node.getChildByPath = p => parts[p] ? { getComponent: () => parts[p] } : null;
    f.start(); f.world.zombies.forEach(z => z.state = 'dead'); f.update(1 / 60);
    assert.equal(f.world.result.won, false); f.showPostLevel(); show();
    assert.deepEqual(rgb(plate.color), [0xff, 0xab, 0x8d], 'Fallback plate gets the loss color');
    assert.equal(label.string, 'Повторить', 'Fallback label reads «Повторить»');
});
test('Collection: scene window, PreLevel/PostLevel to collection, back to party, replace, retry loses unrevived', () => {
    const file = 'assets/Scripts/game/presentation/CollectionWindow.ts';
    assert.doesNotMatch(read(file), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    assert.ok(bootstrap.collection, 'GameBootstrap.collection is wired');
    const data = scene[bootstrap.collection.__id__];
    assert.equal(data.__type__, typeFor(file));
    const host = scene[data.node.__id__];
    assert.equal(host._name, 'CollectionPanel'); assert.equal(scene[host._parent.__id__]._name, 'GameUI'); assert.equal(host._active, false);
    assert.ok(components(host).some(c => c.__type__ === 'cc.BlockInputEvents'));
    const gameUi = scene[host._parent.__id__];
    const order = gameUi._children.map(r => scene[r.__id__]._name);
    assert.ok(order.indexOf('CollectionPanel') > order.indexOf('PreLevel'), 'Collection is drawn over PreLevel');
    assert.ok(data.cards.length >= 40);

    const fit = t => { if (t) t.setContentSize = (w, h) => { t.size = [w, h]; }; };
    const { PreLevelCard } = load('assets/Scripts/game/presentation/PreLevelCard.ts');
    const win = hydrate(new (load(file).CollectionWindow)(), data);
    win.node = objects[data.node.__id__];
    win.cards = data.cards.map(r => { const c = Object.setPrototypeOf(hydrate(objects[r.__id__], scene[r.__id__]), PreLevelCard.prototype); c.node = objects[scene[r.__id__].node.__id__]; fit(c.pictureTransform); return c; });
    fit(win.pictureTransform);
    const pre = new (load('assets/Scripts/game/presentation/PreLevelWindow.ts').PreLevelWindow)();
    pre.skins = [{ name: 'Обычный', reviveCost: 10, frame: { originalSize: { width: 50, height: 50 } } }, { name: 'Редкий', reviveCost: 40, frame: { originalSize: { width: 80, height: 40 } } }];
    win.catalog = pre; win.setCardFrames('normal', 'selected');

    const store = new Map();
    const p = new Progress({ getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    const f = new GameFlow(p, { zombieCount: 4 }, 5, 1, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))), 2);
    assert.deepEqual(p.party.map(m => m.id), [1, 2, 3, 4], 'Starting party gets stable ids');
    assert.deepEqual(p.collection, [], 'Collection starts empty');
    let replaceId;
    win.bind({ back: () => win.close(), take: id => f.takeFromCollection(id, f.partyFull ? replaceId : undefined) });
    const show = () => win.refresh(f, p, replaceId);
    f.prepare(); show(); assert.equal(win.node.active, false, 'Closed until «Коллекция» is pressed');
    win.open(); show();
    assert.equal(win.node.active, true); assert.equal(win.empty.active, true); assert.equal(win.cards.filter(c => c.node.active).length, 0);
    assert.equal(win.partyLabel.string, 'В партии 4 / 4');

    assert.equal(f.storeMember(2), true); assert.equal(f.storeMember(3), true);
    assert.deepEqual(p.party.map(m => m.id), [1, 4]); assert.deepEqual(p.collection.map(m => m.id), [2, 3]);
    assert.equal(f.world.zombies.length, 2, 'Stored slugs leave the round');
    show();
    assert.equal(win.cards.filter(c => c.node.active).length, 2); assert.equal(win.empty.active, false);
    assert.equal(win.cards[0].caption.string, 'Рост 0/8'); assert.equal(win.cards[0].title.string, 'Редкий');
    assert.equal(win.details.active, false); assert.equal(win.toPartyButton.interactable, false, 'Nothing selected');
    click(win.cards[0].button); show();
    assert.equal(win.cards[0].body.spriteFrame, 'selected');
    assert.equal(win.details.active, true); assert.equal(win.nameLabel.string, 'Редкий слизень');
    assert.equal(win.caption.string, 'Малыш · рост 0/8'); assert.equal(win.toPartyLabel.string, 'В партию');
    assert.equal(win.toPartyButton.interactable, true);
    click(win.toPartyButton); show();
    assert.deepEqual(p.party.map(m => m.id), [1, 4, 2]); assert.deepEqual(p.collection.map(m => m.id), [3]);
    assert.equal(f.world.zombies.length, 3); assert.equal(win.selectedIndex, -1);

    p.data.party = [...p.party, p.createMember(0)]; f.prepare && (f.screen = 'prelevel'); f.takeFromCollection(-1);
    assert.equal(f.partyFull, true);
    click(win.cards[0].button); show();
    assert.equal(win.toPartyLabel.string, 'Заменить выбранного');
    assert.equal(win.toPartyButton.interactable, false, 'Full party needs a selected PreLevel slug');
    assert.match(win.footer.string, /^Партия полная/);
    assert.equal(f.takeFromCollection(3), false, 'Party never exceeds the level maximum');
    replaceId = 1; show();
    assert.equal(win.toPartyButton.interactable, true);
    click(win.toPartyButton);
    assert.deepEqual(p.party.map(m => m.id), [3, 4, 2, 5], 'Replaced in place'); assert.deepEqual(p.collection.map(m => m.id), [1]);
    assert.ok(p.party.length <= f.partyLimit);
    click(win.backButton); show(); assert.equal(win.node.active, false);
    replaceId = undefined;

    f.start();
    f.world.zombies.forEach((z, i) => z.state = i === 0 ? 'saved' : 'dead');
    f.update(1 / 60);
    assert.equal(f.world.result.won, true, '1 of 4 is enough for one star');
    assert.deepEqual(p.party.map(m => m.id), [3], 'Not revived slugs leave the party');
    assert.equal(f.storeMember(3), true, 'Delivered slug can go to the collection from PostLevel');
    assert.deepEqual(p.party, []); assert.deepEqual(p.collection.map(m => m.id), [1, 3]);
    f.advance();
    assert.equal(f.screen, 'prelevel'); assert.equal(f.world.zombies.length, 0);
    assert.equal(f.start(), false, 'Empty party cannot start'); assert.equal(f.screen, 'prelevel');
    assert.equal(f.takeFromCollection(1), true); assert.equal(f.takeFromCollection(3), true);
    assert.deepEqual(p.party.map(m => m.id), [1, 3]);

    f.start();
    f.world.zombies.forEach(z => z.state = 'dead');
    f.update(1 / 60);
    assert.equal(f.world.result.won, false);
    assert.equal(f.revive(0, 0), true, 'Revive is available on a loss');
    assert.deepEqual(p.party.map(m => m.id), [1]);
    f.advance();
    assert.deepEqual(p.party.map(m => m.id), [1], 'Retry does not return the unrevived slug');
    assert.equal(f.selectedLevel, 2);

    const reloaded = new Progress({ getItem: k => store.get(k) ?? null, setItem: () => {} });
    assert.deepEqual(reloaded.party, p.party); assert.deepEqual(reloaded.collection, p.collection);
    assert.equal(reloaded.createMember(0).id, p.data.nextMemberId, 'Ids keep growing after reload');
    const legacy = new Progress({ getItem: () => JSON.stringify({ version: 1, coins: 0, unlockedLevel: 1, best: {}, party: [{ kind: 1, growth: 2 }] }), setItem: () => {} });
    const lf = new GameFlow(legacy, { zombieCount: 3 }, 1, 1, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))), 2);
    assert.equal(legacy.party.length, 3, 'Old saves keep a full party once'); assert.deepEqual(legacy.party[0], { id: 1, kind: 1, growth: 2 });
    assert.deepEqual(legacy.collection, []); assert.equal(lf.world.zombies.length, 3);
    win.unbind(); const before = p.collection.length; click(win.toPartyButton); assert.equal(p.collection.length, before);
});
test('Eggs and Sell: scene EggPanel, 2 starting eggs, +1 per round, random baby, sell price 80/160/240', () => {
    const file = 'assets/Scripts/game/presentation/EggWindow.ts';
    assert.doesNotMatch(read(file), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    assert.ok(bootstrap.egg, 'GameBootstrap.egg is wired');
    const data = scene[bootstrap.egg.__id__];
    assert.equal(data.__type__, typeFor(file));
    const host = scene[data.node.__id__];
    assert.equal(host._name, 'EggPanel'); assert.equal(scene[host._parent.__id__]._name, 'GameUI'); assert.equal(host._active, false);
    assert.ok(components(host).some(c => c.__type__ === 'cc.BlockInputEvents'));
    const order = scene[host._parent.__id__]._children.map(r => scene[r.__id__]._name);
    assert.ok(order.indexOf('EggPanel') > order.indexOf('PreLevel') && order.indexOf('EggPanel') > order.indexOf('CollectionPanel'), 'EggPanel is drawn on top');
    const preData = scene.find(o => o.__type__ === typeFor('assets/Scripts/game/presentation/PreLevelWindow.ts'));
    const postData = scene.find(o => o.__type__ === typeFor('assets/Scripts/game/presentation/PostLevelWindow.ts'));
    assert.equal(scene[scene[preData.eggsButton.__id__].node.__id__]._name, 'Eggs');
    assert.equal(scene[preData.eggsButton.__id__]._interactable, true);
    assert.equal(scene[scene[postData.sellButton.__id__].node.__id__]._name, 'Sell');
    assert.equal(scene[postData.sellButton.__id__]._interactable, true);
    assert.equal(scene[postData.sellLabel.__id__]._string, 'Продать');

    const { sellPrice } = require('../assets/Scripts/game/application/Party.ts');
    assert.deepEqual([0, 1, 2, 3].map(g => sellPrice(g)), [80, 160, 240, 320]);

    const store = new Map();
    const p = new Progress({ getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) });
    assert.equal(p.eggs, 2, 'Two eggs at the start');
    const f = new GameFlow(p, { zombieCount: 3 }, 7, 1, parseLevelCatalog(JSON.parse(read('assets/resources/levels.json'))), 2);
    assert.equal(f.hatchEgg(), null, 'No hatching outside PreLevel');
    f.prepare();

    const pre = new (load('assets/Scripts/game/presentation/PreLevelWindow.ts').PreLevelWindow)();
    pre.skins = [{ name: 'Обычный', reviveCost: 10, frame: { originalSize: { width: 50, height: 50 } } }, { name: 'Редкий', reviveCost: 40, frame: { originalSize: { width: 80, height: 40 } } }];
    const win = hydrate(new (load(file).EggWindow)(), data);
    win.node = objects[data.node.__id__];
    win.picture.node = new FakeNode();
    win.pictureTransform.setContentSize = (w, h) => { win.pictureTransform.size = [w, h]; };
    win.catalog = pre;
    let replaceId;
    win.bind({ toParty: id => f.takeFromCollection(id, f.partyFull ? replaceId : undefined) });
    const show = () => win.refresh(f, p, replaceId);
    show(); assert.equal(win.node.active, false, 'Hidden until «Яйца» is pressed');

    const baby = f.hatchEgg(() => 0.99);
    assert.ok(baby); assert.equal(baby.kind, 1, 'Random kind from Skins'); assert.equal(baby.growth, 0, 'Always a baby');
    assert.equal(p.eggs, 1);
    assert.ok(p.collection.some(m => m.id === baby.id), 'Saved to the collection at once');
    tweens.length = 0;
    win.show(baby); show();
    assert.equal(win.node.active, true); assert.ok(tweens.length >= 2, 'Appear animation runs');
    assert.equal(win.title.string, 'Новый слизень!'); assert.equal(win.rarity.string, 'Редкий · малыш');
    assert.deepEqual(win.pictureTransform.size, [150, 75], 'Picture keeps proportions');
    assert.equal(win.toPartyButton.interactable, false, 'Party 3/3 is full, nothing selected');
    assert.equal(win.toPartyLabel.string, 'Заменить выбранного');
    assert.equal(win.hint.node.active, true);
    click(win.toCollectionButton); show();
    assert.equal(win.node.active, false, '«В коллекцию» closes the window');
    assert.ok(p.collection.some(m => m.id === baby.id));

    assert.equal(f.hatchEgg(() => 0).kind, 0); assert.equal(p.eggs, 0);
    assert.equal(f.hatchEgg(), null, 'No eggs left');
    const second = p.collection[p.collection.length - 1];
    win.show(second); replaceId = p.party[0].id; show();
    assert.equal(win.toPartyButton.interactable, true);
    click(win.toPartyButton); show();
    assert.ok(p.party.some(m => m.id === second.id), '«В партию» moves the new slug into the party');
    assert.ok(p.party.length <= f.partyLimit); assert.equal(win.node.active, false);
    replaceId = undefined;

    f.start(); f.world.zombies.forEach(z => z.state = 'dead'); f.update(1 / 60); f.update(1 / 60);
    assert.equal(f.world.result.won, false); assert.equal(p.eggs, 1, 'Loss gives one egg, once');
    f.advance(); assert.equal(f.takeFromCollection(baby.id), true); f.start(); f.world.zombies.forEach(z => z.state = 'saved'); f.update(1 / 60);
    assert.equal(f.world.result.won, true); assert.equal(p.eggs, 2, 'Win gives one egg');

    const coins = p.data.coins;
    const delivered = f.outcome.delivered[0];
    assert.equal(delivered.growth, 1);
    const post = new (load('assets/Scripts/game/presentation/PostLevelWindow.ts').PostLevelWindow)();
    Object.assign(post, { cards: [], rows: [], sellStep: 80, sellText: 'Продать', sellButton: { node: new FakeNode(), interactable: false }, sellLabel: { string: '' }, selectedLabel: { string: '' }, selectedPicture: null, toCollectionButton: null });
    post.nextButton = { node: new FakeNode() };
    post.shown = [{ member: delivered, revived: false }];
    post.bind({ next: () => {}, revive: () => false, sell: (id, price) => f.sellMember(id, price) });
    post.markSelection();
    assert.equal(post.sellButton.interactable, false); assert.equal(post.sellLabel.string, 'Продать');
    post.selectedIndex = 0; post.markSelection();
    assert.equal(post.sellButton.interactable, true);
    assert.equal(post.sellLabel.string, 'Продать за 160', 'Grown slug costs 160');
    assert.equal(post.priceOf({ growth: 0 }), 80); assert.equal(post.priceOf({ growth: 2 }), 240);
    click(post.sellButton);
    assert.equal(p.data.coins, coins + 160, 'Price is added to the balance');
    assert.ok(!p.party.some(m => m.id === delivered.id), 'Sold slug leaves the party');
    assert.equal(post.selectedIndex, -1);
    assert.equal(f.sellMember(delivered.id, 160), false, 'Cannot sell twice');
    assert.equal(f.sellMember(p.party[0]?.id ?? -1, -5), false, 'Negative price rejected');

    const reloaded = new Progress({ getItem: k => store.get(k) ?? null, setItem: () => {} });
    assert.equal(reloaded.eggs, 2, 'Eggs persist'); assert.equal(reloaded.data.coins, p.data.coins);
    const legacy = new Progress({ getItem: () => JSON.stringify({ version: 1, coins: 0, unlockedLevel: 1, best: {} }), setItem: () => {} });
    assert.equal(legacy.eggs, 2, 'Old saves get two eggs');
    win.unbind(); post.unbind();
});
test('TopHud replaces Title/Status: level, progress bar, boosters wired to PlayingHud', () => {
    const file = 'assets/Scripts/game/presentation/PlayingHud.ts';
    assert.doesNotMatch(read(file), /new Node\s*\(|addComponent\s*\(|instantiate\s*\(|\.destroy\s*\(|getChildByName\s*\(/);
    const data = scene[bootstrap.playingHud.__id__];
    assert.equal(data.__type__, typeFor(file));
    const host = scene[data.node.__id__];
    assert.equal(host._name, 'TopHud'); assert.equal(scene[host._parent.__id__]._name, 'Playing');
    const playing = scene[hudData.gameLayer.__id__];
    const names = playing._children.map(r => scene[r.__id__]._name);
    assert.ok(!names.includes('Title') && !names.includes('Status'), 'Title/Status removed');
    assert.ok(!('status' in hudData));
    assert.equal(scene[scene[data.fill.__id__].node.__id__]._parent.__id__, scene[data.track.__id__].node.__id__, 'Fill grows inside the track');
    assert.equal(scene[data.fill.__id__]._anchorPoint.x, 0, 'Fill anchored left');
    for (const key of ['slowButton', 'teleportButton']) assert.equal(scene[data[key].__id__].__type__, 'cc.Button');
    assert.equal(data.slowDuration, 5);
    const battery = scene.find(o => o._name === 'BatteryIcon');
    const icon = components(battery).find(c => c.__type__ === 'cc.Sprite');
    assert.equal(path.basename(findMeta(icon._spriteFrame.__uuid__), '.png.meta'), 'Group-11');
});
test('screen fit: no letterbox policy, HUD pinned to edges, backdrop hides the strip under the HUD', () => {
    const fit = load('assets/Scripts/game/presentation/ScreenFit.ts');
    assert.equal(fit.fitMode(1920, 1080), 'height');
    assert.equal(fit.fitMode(2400, 1080), 'height');
    assert.equal(fit.fitMode(1024, 768), 'width');
    assert.equal(fit.fitMode(0, 0), 'height');
    const wide = fit.visibleSizeFor(2400, 1080);
    assert.equal(wide.height, 720); assert.ok(wide.width > 1280);
    const tall = fit.visibleSizeFor(1024, 768);
    assert.equal(tall.width, 1280); assert.ok(tall.height > 720);
    assert.equal(fit.playableFraction(720), 632 / 720);
    assert.ok(fit.playableFraction(960) > fit.playableFraction(720));
    const boot = read('assets/Scripts/game/GameBootstrap.ts');
    assert.doesNotMatch(boot, /SHOW_ALL/, 'SHOW_ALL leaves empty side fields');
    assert.match(boot, /FIXED_HEIGHT/); assert.match(boot, /FIXED_WIDTH/);

    const widgetOf = node => components(node).find(c => c.__type__ === 'cc.Widget');
    const named = (parent, name) => scene[parent._children.map(r => r.__id__).find(i => scene[i]._name === name)];
    const gameUi = scene.find(o => o.__type__ === 'cc.Node' && o._name === 'GameUI');
    const playing = named(gameUi, 'Playing');
    for (const n of [playing, ...['LevelSelect', 'PreLevel', 'PostLevel', 'PausePanel', 'TestComplete', 'LevelLoading'].map(x => named(gameUi, x))])
        assert.equal(widgetOf(n)._alignFlags, 45, n._name + ' stretches to the screen');
    assert.equal(widgetOf(named(playing, 'TopHud'))._alignFlags & 4, 0, 'TopHud is pinned to the top, not the bottom');
    assert.equal(widgetOf(named(playing, 'TopHud'))._alignFlags & 1, 1);
    assert.equal(widgetOf(named(playing, 'Pause'))._alignFlags, 1 | 32);
    const backdrop = named(playing, 'TopBackdrop');
    assert.equal(playing._children[0].__id__, scene.indexOf(backdrop), 'backdrop is drawn first, under TopHud');
    const color = components(backdrop).find(c => c.__type__ === 'cc.Sprite')._color;
    assert.deepEqual([color.r, color.g, color.b], [0xee, 0xe5, 0xcb]);
    assert.equal(widgetOf(backdrop)._alignFlags, 1 | 8 | 32);
});
console.log('10 UI checks passed (scene contracts + presenter unit tests; no rendering assertions)');
