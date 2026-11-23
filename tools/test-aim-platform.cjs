const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('../assets/Scripts/game/presentation/WorldView.ts', 'utf8');
class Node {
    constructor(name) { this.name = name; this.layer = 1; this.children = []; }
    setParent(parent) { parent.children.push(this); }
    setPosition(x, y, z) { this.position = { x, y, z }; }
    setScale(x, y, z) { this.scale = { x, y, z }; }
    setRotationFromEuler() {}
    addComponent() { return { setSharedMaterial() {} }; }
}
class Material { initialize() {} setProperty() {} }
let mesh;
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: exportsObject,
    require: id => id === 'cc' ? {
        Node, Material, Color: { WHITE: {} }, utils: { createMesh: data => (mesh = data) },
        gfx: { CullMode: { NONE: 0 }, BlendFactor: {} }
    } : id === './ForegroundLayers' ? { ACTOR_LAYER: 1 << 19 } : {}
});
const view = Object.create(exportsObject.WorldView.prototype);
view.platformMaterials = [];
const parent = new Node('World');
view.platform = view.createPlatformNode(parent, 'AimPlatform');
view.platformAspect = 238 / 142;
view.arrowAspect = 158 / 356;
view.aim = new Node('Aim');
view.marker = new Node('Arrow');
assert.deepEqual(Array.from(mesh.uvs), [0, 0, 1, 0, 0, 1, 1, 1]);
assert.equal(view.platform.layer, parent.layer);
assert.equal(view.platform.children[0].layer, parent.layer);
assert.equal(view.platform.layer & (1 << 19), 0);
for (const pull of [null, { x: 0, z: -2 }, null, { x: 1, z: -2 }]) {
    view.showAim({ x: 3, z: 7, idleMotion: { height: 2 } }, pull);
    assert.equal(view.platform.active, true);
    assert.equal(view.platform.position.y, 0.09);
    assert.equal(view.platform.position.x, 3);
    assert.equal(view.platform.position.z, 7);
    assert.equal(view.platform.layer, parent.layer);
}
view.showAim(null, null);
assert.equal(view.platform.active, false);
console.log('PASS aim platform: upright UV, world layer below actors, stable height for valid/backward aim, cancel hides platform');
