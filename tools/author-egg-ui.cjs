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
const color = (hex, a = 255) => {
    const s = hex.replace('#', '');
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a };
};
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const EGG = scriptType('assets/Scripts/game/presentation/EggWindow.ts');
const PRE = scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts');
const POST = scriptType('assets/Scripts/game/presentation/PostLevelWindow.ts');
const BOOT = scriptType('assets/Scripts/game/GameBootstrap.ts');

assert.ok(!scene.some(o => o._name === 'EggPanel'), 'EggPanel already exists; edit it in Cocos instead');
const pre = scene.find(o => o.__type__ === PRE), post = scene.find(o => o.__type__ === POST), boot = scene.find(o => o.__type__ === BOOT);
assert.ok(pre && post && boot, 'PreLevelWindow/PostLevelWindow/GameBootstrap not found');
const preNode = pre.node.__id__;
const canvas = scene[preNode]._parent.__id__;
assert.equal(scene[canvas]._name, 'GameUI');

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `egg-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, { active = true, attach = true } = {}) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `egg-n-${scene.length}` });
    if (attach) scene[parent]._children.push(ref(id));
    component(id, 'cc.UITransform', { _contentSize: size(width, height), _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return id;
}
const panelFrame = { __uuid__: 'ce3d2b73-7688-449d-a534-512835c16c86@f9941', __expectedType__: 'cc.SpriteFrame' };
function sprite(id, tint, frame = panelFrame, sliced = true) {
    return component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: typeof tint === 'string' ? color(tint) : tint, _spriteFrame: frame, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
}
function panel(parent, name, x, y, w, h, tint, opts) { const id = node(parent, name, x, y, w, h, opts); sprite(id, tint); return id; }
function framed(parent, name, x, y, w, h, border, fill, thickness = 3, opts) {
    const outer = panel(parent, name, x, y, w, h, border, opts);
    const face = panel(outer, 'Fill', 0, 0, w - thickness * 2, h - thickness * 2, fill);
    return { node: outer, fill: face };
}
const INK = '#26352f', MUTED = '#7d8782', LINE = '#26352f';
function text(parent, name, value, x, y, w, h, fontSize, tint = INK, { align = 1, bold = false, active = true } = {}) {
    const id = node(parent, name, x, y, w, h, { active });
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: align, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 6, _overflow: 2, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: bold, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}
function button(parent, name, title, x, y, w, h, fill, { fontSize = 24, hover, pressed } = {}) {
    const box = framed(parent, name, x, y, w, h, LINE, fill, 3);
    const label = text(box.fill, name + 'Label', title, 0, 0, w - 16, h - 6, fontSize, INK, { bold: true });
    const comp = component(box.node, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 1, _normalColor: color(fill), _hoverColor: color(hover ?? fill), _pressedColor: color(pressed ?? fill), _disabledColor: color('#c9cfc4'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.97, _target: ref(box.fill) });
    return { node: box.node, button: comp, label };
}
const labelNode = id => scene[id].node.__id__;
const childNamed = (parent, name) => scene[parent]._children.map(r => r.__id__).find(i => scene[i]._name === name);
const buttonOf = n => scene[n]._components.map(r => r.__id__).find(i => scene[i].__type__ === 'cc.Button');
const labelOf = n => scene[n]._components.map(r => r.__id__).find(i => scene[i].__type__ === 'cc.Label');
const findNode = (parent, name) => {
    for (const r of scene[parent]._children) { if (scene[r.__id__]._name === name) return r.__id__; const deep = findNode(r.__id__, name); if (deep !== undefined) return deep; }
    return undefined;
};
const zombieFrame = scene[pre.skins[0]?.__id__]?.frame ?? null;

const win = node(canvas, 'EggPanel', 0, 0, 1280, 720, { active: false, attach: false });
sprite(win, color('#26352f', 140));
component(win, 'cc.BlockInputEvents');
const preWidget = scene[preNode]._components.map(r => scene[r.__id__]).find(c => c.__type__ === 'cc.Widget');
if (preWidget) { const { _id, node: _n, ...fields } = preWidget; component(win, 'cc.Widget', { ...fields }); }

const dialog = framed(win, 'Dialog', 0, 0, 700, 420, LINE, '#fffbe9', 4);
const title = text(dialog.fill, 'Title', 'Новый слизень!', -150, 168, 380, 40, 30, INK, { align: 0, bold: true });
const close = button(dialog.fill, 'Close', '×', 300, 168, 54, 50, '#ffffff', { fontSize: 30, hover: '#f3f3ee', pressed: '#e3e6dc' });
const rarityPill = framed(dialog.fill, 'RarityPill', 0, 110, 240, 34, LINE, '#5fcdb7', 2);
const rarity = text(rarityPill.fill, 'RarityLabel', 'Редкий · малыш', 0, 0, 230, 30, 18, INK, { bold: true });
const halo = panel(dialog.fill, 'Halo', 0, 10, 160, 160, '#e8efc9');
const picture = node(dialog.fill, 'Picture', 0, 10, 150, 104);
const pictureSprite = sprite(picture, '#ffffff', zombieFrame, false);
const toCollection = button(dialog.fill, 'ToCollection', 'В коллекцию', -160, -140, 280, 64, '#ffffff', { fontSize: 24, hover: '#f3f3ee', pressed: '#e3e6dc' });
const toParty = button(dialog.fill, 'ToParty', 'В партию', 160, -140, 280, 64, '#d4ef6f', { fontSize: 24, hover: '#ddf388', pressed: '#bcd95a' });
const hint = text(dialog.fill, 'Hint', 'Партия полная: выбери слизня на подготовке, его заменит новый.', 0, -88, 640, 26, 16, MUTED, { active: false });

const windowComp = component(win, EGG, {
    dialog: ref(dialog.node), halo: ref(halo), title: ref(title), rarity: ref(rarity),
    picture: ref(pictureSprite), pictureTransform: ref(scene[picture]._components[0].__id__),
    closeButton: ref(close.button), toCollectionButton: ref(toCollection.button), toPartyButton: ref(toParty.button),
    toPartyLabel: ref(toParty.label), hint: ref(hint), pictureMax: 150,
    titleText: 'Новый слизень!', addText: 'В партию', replaceText: 'Заменить выбранного',
    fullHint: 'Партия полная: выбери слизня на подготовке, его заменит новый.', appear: 0.35,
});
const children = scene[canvas]._children;
const collectionIndex = children.findIndex(r => scene[r.__id__]._name === 'CollectionPanel');
const preIndex = children.findIndex(r => r.__id__ === preNode);
children.splice(Math.max(collectionIndex, preIndex) + 1, 0, ref(win));
boot.egg = ref(windowComp);

function enable(buttonId, { hover, pressed } = {}) {
    const b = scene[buttonId];
    b._interactable = true; b._transition = 1;
    const target = scene[b._target.__id__]._components.map(r => scene[r.__id__]).find(c => c.__type__ === 'cc.Sprite');
    if (target) { b._normalColor = { ...target._color }; b._hoverColor = hover ? color(hover) : { ...target._color }; b._pressedColor = pressed ? color(pressed) : { ...target._color }; }
    b._disabledColor = color('#c9cfc4');
    return buttonId;
}
const eggs = childNamed(preNode, 'Eggs');
assert.ok(eggs !== undefined, 'PreLevel/Eggs not found');
pre.eggsButton = ref(enable(buttonOf(eggs), { hover: '#f9e08f', pressed: '#e6c35c' }));
pre.eggsLabel = ref(labelOf(findNode(eggs, 'EggsLabel')));
pre.eggsText = 'Яйца';

const sell = findNode(post.node.__id__, 'Sell');
assert.ok(sell !== undefined, 'PostLevel Sell not found');
post.sellButton = ref(enable(buttonOf(sell), { hover: '#f9e08f', pressed: '#e6c35c' }));
post.sellLabel = ref(labelOf(findNode(sell, 'SellLabel')));
post.sellText = 'Продать';
post.sellStep = 80;

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-eggs');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`EggPanel authored (${labelNode(rarity)}); Eggs and Sell buttons wired; backup ${path.relative(root, backup)}`);
