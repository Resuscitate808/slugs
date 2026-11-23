

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'assets/Scenes/ZombieRoad.scene');
const original = fs.readFileSync(file, 'utf8');
const scene = JSON.parse(original);
assert.ok(!scene.some(o => o._name === 'PreLevel'), 'PreLevel already exists; edit it in Cocos, do not regenerate');
const baseline = structuredClone(scene);
const ref = id => ({ __id__: id });
const vec = (x = 0, y = 0, z = 0) => ({ __type__: 'cc.Vec3', x, y, z });
const size = (width, height) => ({ __type__: 'cc.Size', width, height });
const color = hex => {
    const s = hex.replace('#', '');
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255 };
};
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `prelevel-component-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, active = true, childIndex) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `prelevel-node-${scene.length}` });
    if (childIndex === undefined) scene[parent]._children.push(ref(id)); else scene[parent]._children.splice(childIndex, 0, ref(id));
    component(id, 'cc.UITransform', { _contentSize: size(width, height), _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: 0.5 } });
    return id;
}
const panelFrame = { __uuid__: 'ce3d2b73-7688-449d-a534-512835c16c86@f9941', __expectedType__: 'cc.SpriteFrame' };
const settings = scene.find(o => o.zombieSprite);
assert.ok(settings, 'GameSettings not found');
const zombieFrame = scene[settings.zombieSprite.__id__].frame ?? panelFrame;
function sprite(id, tint, frame = panelFrame, sliced = true) {
    return component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _spriteFrame: frame, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
}
function panel(parent, name, x, y, w, h, tint, active = true, childIndex) {
    const id = node(parent, name, x, y, w, h, active, childIndex); sprite(id, tint); return id;
}
function text(parent, name, value, x, y, w, h, fontSize, tint, align = 1) {
    const id = node(parent, name, x, y, w, h);
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: align, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 8, _overflow: 2, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: false, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}

function button(parent, name, title, x, y, width, enabled = true, fontSize = 24) {
    const tint = enabled ? '#41645f' : '#6f7775';
    const id = panel(parent, name, x, y, width, 56, tint);
    const label = text(id, name + 'Label', title, 0, 0, width - 16, 52, fontSize, enabled ? '#fff1cc' : '#d4d4d0');
    const comp = component(id, 'cc.Button', { clickEvents: [], _interactable: enabled, _transition: enabled ? 3 : 1, _normalColor: color(tint), _hoverColor: color(enabled ? '#527b73' : '#6f7775'), _pressedColor: color(enabled ? '#36534f' : '#6f7775'), _disabledColor: color('#6f7775'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.98, _target: ref(id) });
    return { node: id, button: comp, label };
}

const canvas = scene.findIndex(o => o._name === 'GameUI');
const levelSelect = scene.findIndex(o => o._name === 'LevelSelect');
assert.ok(canvas >= 0 && levelSelect >= 0, 'GameUI/LevelSelect not found');

const insertAt = scene[canvas]._children.findIndex(r => r.__id__ === levelSelect) + 1;
const win = panel(canvas, 'PreLevel', 0, 0, 1280, 720, '#172b35', false, insertAt);
component(win, 'cc.BlockInputEvents');

const title = text(win, 'Title', 'Уровень 1 — Название', -260, 316, 700, 44, 30, '#f6eccd', 0);
const coinsPanel = panel(win, 'CoinsPanel', 510, 316, 220, 56, '#1c3038');
const coins = text(coinsPanel, 'CoinsLabel', 'Монеты 0', 0, 0, 200, 48, 24, '#f6eccd');

const COLS = 10, ROWS = 3, CELL = 76, GAP = 12, PAD = 16;
const gridW = COLS * CELL + (COLS - 1) * GAP + PAD * 2, gridH = ROWS * CELL + (ROWS - 1) * GAP + PAD * 2;
const card = panel(win, 'SkinsCard', -150, 40, gridW + 40, gridH + 96, '#1c3038');
const skinsInfo = text(card, 'SkinsInfo', 'Зомби на уровне: 20   •   Видов зомби в игре: 1', 0, (gridH + 96) / 2 - 34, gridW, 36, 22, '#c0d8ce');
const grid = node(card, 'Skins', 0, -24, gridW, gridH);
component(grid, 'cc.Layout', { _resizeMode: 0, _layoutType: 3, _cellSize: size(CELL, CELL), _startAxis: 0, _paddingLeft: PAD, _paddingRight: PAD, _paddingTop: PAD, _paddingBottom: PAD, _spacingX: GAP, _spacingY: GAP, _verticalDirection: 1, _horizontalDirection: 0, _constraint: 2, _constraintNum: COLS, _affectedByScale: false, _isAlign: false });
const slots = [];
for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = -gridW / 2 + PAD + CELL / 2 + col * (CELL + GAP), y = gridH / 2 - PAD - CELL / 2 - row * (CELL + GAP);
    const slot = node(grid, `Skin${i + 1}`, x, y, CELL, CELL, i < 20);
    slots.push(ref(sprite(slot, '#ffffff', zombieFrame, false)));
}

const gen = panel(win, 'GeneratorsPanel', 480, 40, 280, 250, '#1c3038');
text(gen, 'GeneratorsLabel', 'Генераторы 0/10', 0, 78, 256, 40, 26, '#f6eccd');
const claim = button(gen, 'Claim', 'Забрать 60 монет', 0, 0, 252, true, 22);
const timer = text(gen, 'ClaimTimer', 'Можно забрать', 0, -60, 256, 28, 16, '#c0d8ce');

const bottom = [['Collection', 'Коллекция', false], ['ToCollection', 'В коллекцию', false], ['Replace', 'Заменить', false], ['Eggs', 'Яйца', false], ['Road', 'В дорогу', true]];
const buttons = bottom.map(([name, label, enabled], i) => button(win, name, label, -480 + i * 240, -300, 220, enabled));
const road = buttons[4];

const skin = add({ __type__: 'ZombieSkin', name: 'Слизень', frame: zombieFrame });
const windowComp = component(win, scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts'), {
    skins: [ref(skin)], claimCoins: 60, claimIntervalHours: 6,
    title: ref(title), coins: ref(coins), skinsInfo: ref(skinsInfo), claimLabel: ref(claim.label), claimTimer: ref(timer),
    slots, roadButton: ref(road.button), claimButton: ref(claim.button),
});
const bootstrapIndex = scene.findIndex(o => o.__type__ === scriptType('assets/Scripts/game/GameBootstrap.ts'));
assert.ok(bootstrapIndex >= 0, 'Bootstrap not found');
scene[bootstrapIndex].preLevel = ref(windowComp);

for (let i = 0; i < baseline.length; i++) if (i !== canvas && i !== bootstrapIndex) assert.deepEqual(scene[i], baseline[i]);
assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`Authored ${scene.length - baseline.length} PreLevel objects; existing objects preserved.`);
