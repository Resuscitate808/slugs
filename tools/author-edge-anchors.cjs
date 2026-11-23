const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
const ref = id => ({ __id__: id });
const TOP = 1, BOTTOM = 4, LEFT = 8, RIGHT = 32;

const gameUi = scene.findIndex(o => o.__type__ === 'cc.Node' && o._name === 'GameUI');
assert.ok(gameUi >= 0, 'GameUI not found');
assert.ok(!scene.some(o => o.__type__ === 'cc.Node' && o._name === 'TopBackdrop'), 'TopBackdrop already exists; edit it in Cocos instead');
const child = (parent, name) => {
    const id = scene[parent]._children.map(r => r.__id__).find(i => scene[i]._name === name);
    assert.ok(id != null, `Node ${name} not found under ${scene[parent]._name}`);
    return id;
};
const transformOf = id => scene[scene[id]._components.map(r => r.__id__).find(i => scene[i].__type__ === 'cc.UITransform')];
const hasWidget = id => scene[id]._components.some(r => scene[r.__id__].__type__ === 'cc.Widget');
const add = object => { scene.push(object); return scene.length - 1; };

function widget(node, flags, margins = {}) {
    assert.ok(!hasWidget(node), `${scene[node]._name} already has a Widget`);
    const size = transformOf(node)._contentSize;
    const id = add({
        __type__: 'cc.Widget', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null,
        _alignFlags: flags, _target: null,
        _left: margins.left ?? 0, _right: margins.right ?? 0, _top: margins.top ?? 0, _bottom: margins.bottom ?? 0,
        _horizontalCenter: 0, _verticalCenter: 0,
        _isAbsLeft: true, _isAbsRight: true, _isAbsTop: true, _isAbsBottom: true, _isAbsHorizontalCenter: true, _isAbsVerticalCenter: true,
        _originalWidth: size.width, _originalHeight: size.height, _alignMode: 2, _lockFlags: 0, _id: `edge-anchor-${scene.length}`,
    });
    scene[node]._components.push(ref(id));
    return id;
}

const playing = child(gameUi, 'Playing');
const STRETCH = TOP | BOTTOM | LEFT | RIGHT;
widget(playing, STRETCH);
for (const name of ['LevelSelect', 'PreLevel', 'PostLevel', 'PausePanel', 'TestComplete', 'LevelLoading']) widget(child(gameUi, name), STRETCH);

widget(child(gameUi, 'LandscapeHint'), TOP, { top: 8 });
widget(child(playing, 'TopHud'), TOP, { top: 0 });
widget(child(playing, 'Pause'), TOP | RIGHT, { top: 12, right: 8 });
widget(child(playing, 'Hint'), BOTTOM, { bottom: 10 });
widget(child(playing, 'CancelAim'), BOTTOM | RIGHT, { bottom: 6, right: 32 });
widget(child(playing, 'TeleportHint'), TOP, { top: 102 });

const panelSprite = scene.find(o => o.__type__ === 'cc.Sprite' && o._spriteFrame && o.node.__id__ === child(playing, 'Pause'));
assert.ok(panelSprite, 'ui-panel Sprite on Pause expected');
const HEIGHT = 88, OVERSCAN = 20;
const backdrop = add({
    __type__: 'cc.Node', _name: 'TopBackdrop', _objFlags: 0, __editorExtras__: {}, _parent: ref(playing), _children: [], _active: true, _components: [], _prefab: null,
    _lpos: { __type__: 'cc.Vec3', x: 0, y: 360 - (HEIGHT + OVERSCAN) / 2 + OVERSCAN, z: 0 }, _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 },
    _mobility: 0, _layer: 33554432, _euler: { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 }, _id: 'edge-anchor-backdrop',
});
const uiTransform = add({ __type__: 'cc.UITransform', _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(backdrop), _enabled: true, __prefab: null, _contentSize: { __type__: 'cc.Size', width: 1320, height: HEIGHT + OVERSCAN }, _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 }, _id: 'edge-anchor-backdrop-t' });
const backdropSprite = add({
    ...JSON.parse(JSON.stringify(panelSprite)), node: ref(backdrop), _color: { __type__: 'cc.Color', r: 238, g: 229, b: 203, a: 255 }, _id: 'edge-anchor-backdrop-s',
});
scene[backdrop]._components.push(ref(uiTransform), ref(backdropSprite));
scene[playing]._children.unshift(ref(backdrop));
widget(backdrop, TOP | LEFT | RIGHT, { top: -OVERSCAN, left: -OVERSCAN, right: -OVERSCAN });

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-edge-anchors');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`Edge anchors authored (${scene.length} objects); backup ${path.relative(root, backup)}`);
