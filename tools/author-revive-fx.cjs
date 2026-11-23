

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
const ref = id => ({ __id__: id });
const vec = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const size = (width, height) => ({ __type__: 'cc.Size', width, height });
const color = hex => {
    const s = hex.replace('#', '');
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: 255 };
};
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const POST = scriptType('assets/Scripts/game/presentation/PostLevelWindow.ts');
const FX = scriptType('assets/Scripts/game/presentation/ReviveEffect.ts');
assert.ok(!scene.some(o => o._name === 'ReviveFx'), 'ReviveFx already exists; edit it in Cocos instead');
const post = scene.find(o => o.__type__ === POST);
assert.ok(post, 'PostLevelWindow not found');
const win = post.node.__id__;

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `revivefx-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, active = true) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `revivefx-n-${scene.length}` });
    scene[parent]._children.push(ref(id));
    component(id, 'cc.UITransform', { _contentSize: size(width, height), _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return id;
}
function sprite(id, tint, frame, sliced) {
    return component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _spriteFrame: frame, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
}
const panelFrame = { __uuid__: 'ce3d2b73-7688-449d-a534-512835c16c86@f9941', __expectedType__: 'cc.SpriteFrame' };
const restarter = { __uuid__: 'cf730fb5-aa26-48f7-b5d8-2aa958747e9f@f9941', __expectedType__: 'cc.SpriteFrame' };

const fx = node(win, 'ReviveFx', 0, 20, 220, 220, false);
const opacity = component(fx, 'cc.UIOpacity', { _opacity: 255 });
const plate = node(fx, 'Plate', 0, 0, 220, 220);
sprite(plate, '#2f5b55', panelFrame, true);
const face = node(plate, 'Fill', 0, 0, 208, 208);
sprite(face, '#fbf7e8', panelFrame, true);
const icon = node(plate, 'Restarter', 0, 0, 118, 145);
sprite(icon, '#ffffff', restarter, false);
const fxComp = component(fx, FX, { plate: ref(plate), icon: ref(icon), opacity: ref(opacity), duration: 3, appear: 0.35, fade: 0.5, turns: 1 });
post.reviveEffect = ref(fxComp);

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-revive-fx');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`ReviveFx authored under PostLevel (component ${fxComp}); backup ${path.relative(root, backup)}`);
