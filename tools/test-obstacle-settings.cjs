const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = '../assets/Scripts/game/';
const source = fs.readFileSync(root + 'presentation/ObstacleSettings.ts', 'utf8');
const exportsObject = {};
const Component = class { enabled = true; };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText, {
    exports: exportsObject,
    require: name => { assert.equal(name, 'cc'); return { Component, _decorator: { ccclass: () => x => x, property: () => {} } }; }
});
const settings = new exportsObject.ObstacleSettings();
const config = { zombieCount: 4, levelTable: true };
assert.equal(settings.configure(config).obstaclesEnabled, true);
assert.equal(settings.configure(config).obstaclesVisible, true);
for (const enabled of [true, false]) for (const visible of [true, false]) {
    settings.obstaclesEnabled = enabled;
    settings.obstaclesVisible = visible;
    assert.equal(settings.configure(config).obstaclesEnabled, enabled);
    assert.equal(settings.configure(config).obstaclesVisible, visible);
}
settings.obstaclesVisible = true;
settings.obstaclesEnabled = false;
assert.equal(settings.configure(config).obstaclesEnabled, false);
settings.obstaclesEnabled = true;
settings.enabled = false;
assert.equal(settings.configure(config).obstaclesEnabled, false);
assert.deepEqual(config, { zombieCount: 4, levelTable: true });
const scene = JSON.parse(fs.readFileSync('../assets/Scenes/ZombieRoad.scene', 'utf8'));
const meta = JSON.parse(fs.readFileSync(root + 'presentation/ObstacleSettings.ts.meta', 'utf8'));
const hex = meta.uuid.replace(/-/g, '');
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
let type = hex.slice(0, 5);
for (let i = 5; i < 32; i += 3) {
    const n = parseInt(hex.slice(i, i + 3), 16);
    type += alphabet[n >> 6] + alphabet[n & 63];
}
const components = scene.filter(x => x.__type__ === type);
assert.equal(components.length, 1);
const component = components[0];
assert.equal(typeof component.obstaclesEnabled, 'boolean');
assert.equal(component.obstaclesVisible, true);
assert.equal(component._enabled, true);
const node = scene[component.node.__id__];
assert.equal(node._name, 'ZombieRoad');
assert.ok(node._components.some(ref => scene[ref.__id__] === component));
const bootstrap = fs.readFileSync(root + 'GameBootstrap.ts', 'utf8');
assert.ok(bootstrap.includes('config = this.getComponent(ObstacleSettings)?.configure(config) ?? config;'));
assert.ok(bootstrap.includes('new GameFlow(this.progress, config,'));
const viewExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(root + 'presentation/WorldView.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
}).outputText, { exports: viewExports, require: () => ({}) });
for (const useSprites of [false, true]) for (const visible of [undefined, false, true]) {
    const created = [];
    const view = Object.create(viewExports.WorldView.prototype);
    Object.assign(view, {
        settings: { useSprites, generateEnvironment: false, showObstacleBounds: true, obstacleSprites: [{ type: 'tire', sprite: { frame: {} } }] },
        obstacles: { children: [] }, environment: { children: [] }, clearActors() {},
        sprites: { create() { created.push('sprite'); return { root: { setScale() {} } }; }, pose() {} },
        primitives: { box() { created.push('box'); return { setRotationFromEuler() {} }; } }
    });
    const world = { config: { obstaclesVisible: visible }, layout: { obstacles: [{ id: 'a', type: 'tire', x: 0, z: 0, radius: 1, scale: 1, rotation: 0 }] } };
    view.build(world);
    assert.equal(created.length, visible === false ? 0 : 33);
    assert.equal(world.layout.obstacles.length, 1);
    if (visible !== false) assert.equal(created[0], useSprites ? 'sprite' : 'box');
    const old = { active: true, destroy() { this.destroyed = true; } };
    view.obstacles.children = [old];
    world.config.obstaclesVisible = false;
    created.length = 0;
    view.build(world);
    assert.equal(old.active, false);
    assert.equal(old.destroyed, true);
    assert.equal(created.length, 0);
    assert.equal(view.staticSprites.length, 0);
}
console.log('PASS obstacle settings and visibility: independent toggles, scene wiring, real WorldView build, sprites/primitives/bounds, rebuild cleanup and unchanged layout');
