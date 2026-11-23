const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require('node:path').join(__dirname, '../assets/Scripts/game/presentation/WorldSprites.ts'), 'utf8');
class Material {
    properties = {};
    initialize(info) { this.info = info; }
    setProperty(key, value) { this.properties[key] = value; }
    destroy() { this.destroyed = true; }
}
class Node {
    setParent() {}
    setPosition() {}
    setWorldRotation() {}
    setRotationFromEuler() {}
    setRotation() {}
    setScale() {}
    addComponent() { return { setSharedMaterial(value) { this.material = value; } }; }
}
const exportsObject = {};
const gfx = { CullMode: { NONE: 0 }, BlendFactor: { SRC_ALPHA: 6, ONE_MINUS_SRC_ALPHA: 7, ONE: 1 } };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: exportsObject,
    require: () => ({ Material, Node, gfx, Color: { WHITE: {} }, Quat: class { static fromEuler() {} },
        utils: { createMesh: () => ({ destroy() { this.destroyed = true; } }) } })
});
const sprites = new exportsObject.WorldSprites({ node: { worldRotation: {} } });
const frame = { uv: [0, 0, 1, 0, 0, 1, 1, 1], texture: {}, originalSize: { width: 100, height: 50 }, rect: { width: 100, height: 50 }, offset: { x: 0, y: 0 } };
const style = { frame, width: 2, height: 1, billboard: true, rotation: 0, lift: 0 };
for (const name of ['ordinary', 'jeep', 'pink', 'zombie', 'zombie#0', 'zombie#7']) {
    const actorFrame = { ...frame };
    sprites.create(new Node(), name, { ...style, frame: actorFrame });
    assert.ok(sprites.vehicleResources.has(actorFrame), `${name} must preserve shadow transparency`);
    assert.equal(sprites.resources.has(actorFrame), false);
}
sprites.destroy();
for (const name of ['ordinary', 'jeep', 'pink', 'Landscape', 'zombie', 'zombie#0']) sprites.create(new Node(), name, style);
const blended = sprites.vehicleResources.get(frame);
const cutout = sprites.resources.get(frame);
assert.notEqual(blended, cutout);
assert.equal(sprites.vehicleResources.size, 1);
assert.equal(sprites.resources.size, 1);
const states = blended.material.info.states;
assert.equal(states.depthStencilState.depthTest, true);
assert.equal(states.depthStencilState.depthWrite, false);
const blend = states.blendState.targets[0];
assert.equal(blend.blend, true);
assert.equal(blend.blendSrc, gfx.BlendFactor.SRC_ALPHA);
assert.equal(blend.blendDst, gfx.BlendFactor.ONE_MINUS_SRC_ALPHA);
assert.equal(blend.blendSrcAlpha, gfx.BlendFactor.ONE);
assert.equal(blend.blendDstAlpha, gfx.BlendFactor.ONE_MINUS_SRC_ALPHA);
assert.equal(blended.material.properties.alphaThreshold, 1 / 255);
assert.equal(cutout.material.properties.alphaThreshold, 0.1);
assert.equal(cutout.material.info.states.blendState, undefined);
assert.equal(states.rasterizerState.cullMode, gfx.CullMode.NONE);
sprites.destroy();
for (const resource of [blended, cutout]) {
    assert.equal(resource.mesh.destroyed, true);
    assert.equal(resource.material.destroyed, true);
}
assert.equal(sprites.vehicleResources.size, 0);
assert.equal(sprites.resources.size, 0);
console.log('PASS sprite transparency: vehicle and zombie skin alpha blend, depth test, separate shared caches, cutout preserved, resource disposal (no GPU acceptance)');
