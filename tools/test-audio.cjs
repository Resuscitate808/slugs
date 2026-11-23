const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] ??= (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, file);
const { World } = require('../assets/Scripts/game/domain/World.ts');
const { spawnVehicle, hitZombie } = require('../assets/Scripts/game/domain/TrafficSystem.ts');
class Target {
    listeners = new Map();
    on(key, fn, self) { const list = this.listeners.get(key) ?? []; list.push([fn, self]); this.listeners.set(key, list); }
    off(key, fn, self) { this.listeners.set(key, (this.listeners.get(key) ?? []).filter(item => item[0] !== fn || item[1] !== self)); }
    emit(key, ...args) { for (const [fn, self] of [...this.listeners.get(key) ?? []]) fn.apply(self, args); }
}
class Source {
    starts = 0; stops = 0; pauses = 0; shots = []; playing = false;
    play() { this.starts++; this.playing = true; this.shots.push({ clip: this.clip, gain: this.volume }); }
    stop() { this.stops++; this.playing = false; }
    pause() { this.pauses++; this.playing = false; }
    playOneShot(clip, gain) { this.shots.push({ clip, gain }); }
    destroy() { this.destroyed = true; }
}
class Button { static EventType = { CLICK: 'click' }; node = new Target(); }
const game = new Target();
const cc = { _decorator: { ccclass: () => v => v, property: () => () => {} }, Component: class { enabledInHierarchy = true; },
    AudioClip: class {}, AudioSource: Source, Button, CCFloat: Number, Node: class {}, Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' }, game };
function load(file, deps = {}) {
    const exports = {};
    const src = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true }
    }).outputText;
    vm.runInNewContext(src, { exports, require: id => id === 'cc' ? cc : deps[id] ?? {} });
    return exports;
}
const { GameAudioController } = load('assets/Scripts/game/presentation/GameAudioController.ts', { './GameSettings': { GameSettings: class {} }, '../domain/VehicleContact': require('../assets/Scripts/game/domain/VehicleContact.ts') });
let count = 0;
function test(name, fn) { fn(); count++; console.log(`PASS audio ${name}`); }
function setup() {
    const sources = [], buttons = [new Button(), new Button()];
    const audio = new GameAudioController();
    audio.node = { addComponent() { const s = new Source(); sources.push(s); return s; } };
    audio.buttonRoot = { getComponentsInChildren: () => buttons };
    audio.musicClip = { name: 'music' }; audio.buttonClip = { name: 'click' }; audio.hitClip = { name: 'hit' };
    const sounds = Object.fromEntries(['ordinary', 'jeep', 'pink'].map(kind => [kind, { clip: { name: kind }, volume: 0.3 }]));
    audio.settings = { soundFor: kind => sounds[kind] };
    audio.onLoad(); audio.onEnable();
    return { audio, sources, buttons, sounds, close: () => { audio.onDisable(); audio.onDestroy(); } };
}
test('scene uses existing node, valid component UUID and references; all links resolve', () => {
    const scene = JSON.parse(fs.readFileSync(path.join(root, 'assets/Scenes/ZombieRoad.scene'), 'utf8'));
    const meta = JSON.parse(fs.readFileSync(path.join(root, 'assets/Scripts/game/presentation/GameAudioController.ts.meta'), 'utf8'));
    const hex = meta.uuid.replaceAll('-', '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let compressed = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(hex.slice(i, i + 3), 16); compressed += chars[n >> 6] + chars[n & 63]; }
    const nodes = scene.filter(o => o.__type__ === 'cc.Node' && o._name === 'AudioController');
    assert.equal(nodes.length, 1);
    const component = scene[nodes[0]._components[0].__id__];
    assert.equal(component.__type__, compressed);
    assert.equal(scene[component.node.__id__], nodes[0]);
    assert.equal(scene[component.settings.__id__]._id, 'zombie-road-settings');
    assert.equal(scene[component.buttonRoot.__id__]._name, 'GameUI');
    assert.equal(scene[scene.find(o => o._id === 'zombie-road-bootstrap').audio.__id__], component);
    const walk = value => { if (!value || typeof value !== 'object') return; if ('__id__' in value) assert.ok(scene[value.__id__]); for (const v of Object.values(value)) walk(v); };
    walk(scene);
});
test('music loops; each click sounds once even when handler closes window; no duplicate subscriptions', () => {
    const f = setup();
    assert.equal(f.sources[0].loop, true); assert.equal(f.sources[0].starts, 1); assert.equal(f.sources[0].volume, 0.5);
    f.audio.buttonVolume = 0.23;
    for (const button of f.buttons) button.node.emit('click');
    assert.equal(f.sources[1].shots.length, 2); assert.equal(f.sources[1].shots[0].gain, 0.23);
    f.audio.onDisable(); f.buttons[0].node.emit('click'); assert.equal(f.sources[1].shots.length, 2);
    f.audio.onEnable(); f.buttons[0].node.emit('click'); assert.equal(f.sources[1].shots.length, 3);
    f.close(); assert.ok(f.sources.every(s => s.destroyed));
});
test('real death event sounds once; repeated collision, save, fall, crash do not', () => {
    const f = setup(), w = new World(1, 4, { zombieCount: 2, driverExitEnabled: false });
    const car = spawnVehicle(w, 'ordinary', 0);
    hitZombie(w, car, w.zombies[0]); hitZombie(w, car, w.zombies[0]);
    f.audio.hitVolume = 0.7;
    for (const event of w.drainEvents()) f.audio.handleEvent(event);
    for (const type of ['saved', 'fall', 'crash']) f.audio.handleEvent({ type, id: 1 });
    assert.equal(f.sources[1].shots.length, 1); assert.equal(f.sources[1].shots[0].gain, 0.7);
    f.close();
});
test('real traffic movement starts loops; blocked and stopped cars are silent; same kind shares channel', () => {
    const f = setup(), w = new World(1, 4, { zombieCount: 1, trafficInterval: 999, driverExitEnabled: false });
    const car = spawnVehicle(w, 'ordinary', 0); car.x = 0;
    f.audio.sync(w, true); assert.equal(f.sources[2].starts, 0);
    w.update(1 / 60); f.audio.sync(w, true); assert.equal(f.sources[2].starts, 1);
    for (let i = 0; i < 10; i++) { w.update(1 / 60); f.audio.sync(w, true); }
    assert.equal(f.sources[2].starts, 1);
    const blocker = { ...car, id: 999, x: car.x + car.direction * 2.6, abandoned: true };
    const adjacent = { ...blocker, id: 1000, z: w.layout.laneCenters[1] + w.config.vehicleOffsetZ };
    w.vehicles.push(blocker, adjacent);
    for (let i = 0; i < 3; i++) { w.update(1 / 60); f.audio.sync(w, true); }
    assert.equal(f.sources[2].playing, false);
    w.vehicles.splice(1); w.update(1 / 60); f.audio.sync(w, true); assert.equal(f.sources[2].playing, true);
    car.stopped = 1; w.update(1 / 60); f.audio.sync(w, true); assert.equal(f.sources[2].playing, false);
    f.close();
});
test('all kinds have independent clips and volumes; pause, menu, hidden, new round and removal stop loops', () => {
    const f = setup(), w = new World(4, 9, { zombieCount: 1, trafficInterval: 999 });
    for (const [index, kind] of ['ordinary', 'jeep', 'pink'].entries()) {
        const car = spawnVehicle(w, kind, index); assert.ok(car); car.x = index * 5;
        f.sounds[kind].volume = 0.2 + index * 0.1;
    }
    const tick = () => { w.elapsed += 1 / 60; w.vehicles.forEach(c => c.x += c.direction * 0.01); f.audio.sync(w, true); };
    f.audio.sync(w, true); for (let i = 0; i < 20; i++) tick();
    f.sources.slice(2).forEach((s, i) => { assert.equal(s.playing, true); assert.equal(s.volume, 0.2 + i * 0.1); });
    f.audio.sync(w, false); assert.ok(f.sources.slice(2).every(s => !s.playing));
    tick(); tick(); game.emit('hide'); assert.ok(f.sources.every(s => !s.playing));
    game.emit('show'); assert.equal(f.sources[0].playing, true);
    tick(); tick(); w.paused = true; f.audio.sync(w, true); assert.ok(f.sources.slice(2).every(s => !s.playing));
    w.paused = false; tick(); tick();
    f.audio.sync(new World(), true); assert.ok(f.sources.slice(2).every(s => !s.playing));
    tick(); tick(); w.vehicles = []; tick(); assert.ok(f.sources.slice(2).every(s => !s.playing));
    f.close();
});
test('missing clips and zero or invalid volume are safe', () => {
    const f = setup(); f.audio.buttonClip = null; f.buttons[0].node.emit('click');
    f.audio.hitVolume = NaN; f.audio.handleEvent({ type: 'hit', id: 1 });
    f.audio.hitVolume = 0; f.audio.handleEvent({ type: 'hit', id: 2 });
    assert.equal(f.sources[1].shots.length, 0); f.close();
});
test('first visible car owns the only channel until exit, fades on both edges and hands over smoothly', () => {
    for (const direction of [-1, 1]) {
        const f = setup(), w = new World(1, 4, { zombieCount: 1, trafficInterval: 999 });
        const first = spawnVehicle(w, 'ordinary', 0);
        Object.assign(first, { x: 0, direction });
        const second = { ...first, id: 999, x: -direction * 8 };
        w.vehicles.push(second);
        const tick = () => { w.elapsed += 1 / 60; w.vehicles.forEach(c => c.x += direction * 0.01); f.audio.sync(w, true, { left: -15, right: 15 }); };
        f.audio.sync(w, true);
        for (let i = 0; i < 30; i++) tick();
        const source = f.sources[2];
        assert.equal(source.starts, 1); assert.equal(source.volume, 0.3);
        assert.equal(f.audio.engines.get('ordinary').owner, first.id);
        let gain = source.volume;
        for (const x of [13, 14, 15, 16]) {
            first.x = direction * x; tick();
            assert.ok(source.volume < gain); gain = source.volume;
            assert.equal(source.starts, 1);
        }
        first.x = direction * 17; tick();
        assert.equal(f.audio.engines.get('ordinary').owner, second.id);
        assert.equal(source.starts, 2); assert.equal(source.stops, 1);
        assert.ok(source.volume > 0 && source.volume < 0.03);
        for (let i = 0; i < 30; i++) tick();
        assert.equal(source.volume, 0.3);
        second.x = direction * 18; tick(); assert.equal(source.playing, false);
        f.close();
    }
});
test('offscreen cars stay silent and first entry wins over spawn order', () => {
    const f = setup(), w = new World();
    const first = spawnVehicle(w, 'ordinary', 0); first.x = -19; first.direction = 1;
    const second = { ...first, id: 998, x: 0 };
    w.vehicles.push(second);
    f.audio.sync(w, true);
    w.elapsed += 0.1; first.x += 0.1; second.x += 0.1; f.audio.sync(w, true);
    assert.equal(f.audio.engines.get('ordinary').owner, second.id);
    first.x = -10; w.elapsed += 0.1; second.x += 0.1; f.audio.sync(w, true);
    assert.equal(f.audio.engines.get('ordinary').owner, second.id);
    f.close();
});
test('mute stops current playback and suppresses buttons hits traffic and tab resume', () => {
    const f = setup(), w = new World();
    f.buttons[0].node.emit('click');
    f.audio.setSoundEnabled(false);
    assert.ok(f.sources.every(s => !s.playing));
    const before = f.sources.map(s => s.starts);
    f.buttons[0].node.emit('click');
    f.audio.handleEvent({ type: 'hit', id: 7 });
    f.audio.sync(w, true); game.emit('hide'); game.emit('show');
    assert.deepEqual(f.sources.map(s => s.starts), before);
    f.audio.setSoundEnabled(true);
    assert.equal(f.sources[0].playing, true);
    f.buttons[0].node.emit('click');
    assert.equal(f.sources[1].starts, before[1] + 1);
    f.close();
});
console.log(`${count} audio checks passed (real simulation + AudioSource doubles; no audible playback verification)`);
