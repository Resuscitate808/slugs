

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
    return { __type__: 'cc.Color', r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255 };
};
function scriptType(relative) {
    const uuid = JSON.parse(fs.readFileSync(path.join(root, relative + '.meta'), 'utf8')).uuid.replace(/-/g, '');
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = uuid.slice(0, 5);
    for (let i = 5; i < 32; i += 3) { const n = parseInt(uuid.slice(i, i + 3), 16); result += chars[n >> 6] + chars[n & 63]; }
    return result;
}
const WINDOW_TYPE = scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts');
const CARD_TYPE = scriptType('assets/Scripts/game/presentation/PreLevelCard.ts');

const P = scene.findIndex(o => o._name === 'PreLevel' && o.__type__ === 'cc.Node');
assert.ok(P > 0, 'PreLevel not found');
const oldWin = scene.find(o => o.__type__ === WINDOW_TYPE);
assert.ok(oldWin && oldWin.slots, 'PreLevel already restyled (no slots); edit it in Cocos instead');
const owned = new Set();
(function walk(id) {
    owned.add(id);
    for (const c of scene[id]._components) owned.add(c.__id__);
    for (const c of scene[id]._children) walk(c.__id__);
})(P);
for (const s of oldWin.skins) owned.add(s.__id__);
for (let i = P; i < scene.length; i++) assert.ok(owned.has(i), `Object ${i} after PreLevel is not part of it; aborting`);
assert.equal(owned.size, scene.length - P, 'PreLevel is not a contiguous tail; aborting');
const canvas = scene[P]._parent.__id__;
const bootstrapIndex = scene.findIndex(o => o.__type__ === scriptType('assets/Scripts/game/GameBootstrap.ts'));
(function checkOutside() {
    const bad = [];
    function walk(value, owner, key) {
        if (!value || typeof value !== 'object') return;
        if ('__id__' in value && value.__id__ >= P && !(owner === canvas && key === '_children') && !(owner === bootstrapIndex && key === 'preLevel')) bad.push(owner);
        for (const [k, v] of Object.entries(value)) walk(v, owner, key ?? k);
    }
    for (let i = 0; i < P; i++) for (const [k, v] of Object.entries(scene[i])) walk(v, i, k);
    assert.deepEqual(bad, [], 'Objects outside PreLevel reference it; aborting');
})();
const keptSkins = oldWin.skins.map(r => {
    const s = { ...scene[r.__id__] };
    if (s.name === 'Слизень') s.name = 'Обычный';
    if (s.caption === undefined) s.caption = 'Малыш';
    return s;
});
const keptSettings = { claimCoins: oldWin.claimCoins, claimIntervalHours: oldWin.claimIntervalHours };
const zombieFrame = keptSkins.find(s => s.frame)?.frame ?? null;
const childIndex = scene[canvas]._children.findIndex(r => r.__id__ === P);
const before = scene.slice(0, P).map(o => structuredClone(o));
scene.length = P;
scene[canvas]._children.splice(childIndex, 1);

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `prelevel2-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, { active = true, at, anchorY = 0.5 } = {}) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `prelevel2-n-${scene.length}` });
    if (at === undefined) scene[parent]._children.push(ref(id)); else scene[parent]._children.splice(at, 0, ref(id));
    component(id, 'cc.UITransform', { _contentSize: size(width, height), _anchorPoint: { __type__: 'cc.Vec2', x: 0.5, y: anchorY } });
    return id;
}
const panelFrame = { __uuid__: 'ce3d2b73-7688-449d-a534-512835c16c86@f9941', __expectedType__: 'cc.SpriteFrame' };
function sprite(id, tint, frame = panelFrame, sliced = true) {
    return component(id, 'cc.Sprite', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _spriteFrame: frame, _type: sliced ? 1 : 0, _fillType: 0, _sizeMode: 0, _fillCenter: { __type__: 'cc.Vec2', x: 0, y: 0 }, _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null });
}
function panel(parent, name, x, y, w, h, tint, opts) { const id = node(parent, name, x, y, w, h, opts); sprite(id, tint); return id; }

function framed(parent, name, x, y, w, h, border, fill, thickness = 3, opts) {
    const outer = panel(parent, name, x, y, w, h, border, opts);
    const face = panel(outer, 'Fill', 0, 0, w - thickness * 2, h - thickness * 2, fill);
    return { node: outer, fill: face };
}
const INK = '#26352f', MUTED = '#7d8782', LINE = '#2f5b55';
function text(parent, name, value, x, y, w, h, fontSize, tint = INK, { align = 1, bold = false } = {}) {
    const id = node(parent, name, x, y, w, h);
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: align, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 6, _overflow: 2, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: bold, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}

function button(parent, name, title, x, y, w, h, fill, { enabled = true, fontSize = 24, hover, pressed } = {}) {
    const box = framed(parent, name, x, y, w, h, LINE, fill, 3);
    const label = text(box.fill, name + 'Label', title, 0, 0, w - 20, h - 10, fontSize, INK, { bold: true });
    const comp = component(box.node, 'cc.Button', { clickEvents: [], _interactable: enabled, _transition: enabled ? 1 : 0, _normalColor: color(fill), _hoverColor: color(hover ?? fill), _pressedColor: color(pressed ?? fill), _disabledColor: color('#c9cfc4'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.97, _target: ref(box.fill) });
    return { node: box.node, button: comp, label };
}

const win = panel(canvas, 'PreLevel', 0, 0, 1280, 720, '#dfe3d3', { active: false, at: childIndex });
component(win, 'cc.BlockInputEvents');
framed(win, 'Frame', 0, 15, 1250, 650, LINE, '#f6f1dc', 6);

const title = text(win, 'Title', 'ТЕПЛИЦЫ / Уровень 01', -320, 300, 580, 44, 30, INK, { align: 0, bold: true });
const coinsPill = framed(win, 'CoinsPanel', 500, 300, 210, 54, '#c9962e', '#f7d774', 3);
const coins = text(coinsPill.fill, 'CoinsLabel', 'Монеты 0', 0, 0, 190, 44, 24, INK, { bold: true });
const batch = text(win, 'Batch', 'В партии 20 / 20', -320, 258, 580, 30, 20, INK, { align: 0, bold: true });

const COLS = 5, ROWS = 6, CW = 152, CH = 160, SX = 13, SY = 16, PAD = 6, PADT = 12;
const viewW = PAD * 2 + COLS * CW + (COLS - 1) * SX, viewH = 350;
const scroll = node(win, 'SkinsScroll', -188, 61, viewW, viewH);
const view = node(scroll, 'View', 0, 0, viewW, viewH);
component(view, 'cc.Graphics', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color('#ffffff'), _lineWidth: 1, _strokeColor: color('#000000'), _lineJoin: 2, _lineCap: 0, _fillColor: color('#ffffff'), _miterLimit: 10 });
component(view, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
const visibleCards = 20;
const contentH = PADT * 2 + Math.ceil(visibleCards / COLS) * CH + (Math.ceil(visibleCards / COLS) - 1) * SY;
const grid = node(view, 'Skins', 0, viewH / 2, viewW, contentH, { anchorY: 1 });
component(grid, 'cc.Layout', { _resizeMode: 1, _layoutType: 3, _cellSize: size(CW, CH), _startAxis: 0, _paddingLeft: PAD, _paddingRight: PAD, _paddingTop: PADT, _paddingBottom: PADT, _spacingX: SX, _spacingY: SY, _verticalDirection: 1, _horizontalDirection: 0, _constraint: 2, _constraintNum: COLS, _affectedByScale: false, _isAlign: false });
component(scroll, 'cc.ScrollView', { bounceDuration: 0.23, brake: 0.75, elastic: true, inertia: true, horizontal: false, vertical: true, cancelInnerEvents: true, scrollEvents: [], _content: ref(grid), _horizontalScrollBar: null, _verticalScrollBar: null });
const cards = [];
for (let i = 0; i < COLS * ROWS; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = -viewW / 2 + PAD + CW / 2 + col * (CW + SX), y = -(PADT + CH / 2 + row * (CH + SY));
    const card = node(grid, `Card${i + 1}`, x, y, CW, CH, { active: i < visibleCards });
    const ring = panel(card, 'SelectedRing', 0, 0, CW + 8, CH + 8, LINE, { active: i === 0 });
    const face = framed(card, 'Body', 0, 0, CW, CH, '#b9c4b7', '#fbf7e8', 3);
    const picture = node(card, 'Picture', 0, 12, 78, 78);
    const pictureSprite = sprite(picture, '#ffffff', zombieFrame, false);
    const name = text(card, 'Name', 'Обычный', 0, -40, CW - 12, 26, 20, INK, { bold: true });
    const caption = text(card, 'Caption', 'Малыш', 0, -62, CW - 12, 20, 16, MUTED);
    const badge = panel(card, 'SelectedBadge', 0, CH / 2 - 16, 100, 26, '#3f8f80', { active: i === 0 });
    text(badge, 'BadgeLabel', 'Выбран', 0, 0, 92, 24, 17, '#ffffff', { bold: true });
    const btn = component(card, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 3, _normalColor: color('#ffffff'), _hoverColor: color('#ffffff'), _pressedColor: color('#ffffff'), _disabledColor: color('#ffffff'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.96, _target: ref(face.node) });
    cards.push(ref(component(card, CARD_TYPE, { picture: ref(pictureSprite), title: ref(name), caption: ref(caption), selectedRing: ref(ring), selectedBadge: ref(badge), button: ref(btn) })));
}
text(win, 'Hint', 'Выбранного слизня можно заменить или сохранить.', -300, -128, 600, 26, 18, MUTED, { align: 0 });

const gen = framed(win, 'GeneratorPanel', 429.5, 57, 325, 384, LINE, '#fbf7e8', 5);
text(gen.fill, 'GeneratorTitle', 'ГЕНЕРАТОР', 0, 150, 280, 34, 26, INK, { bold: true });
const robot = panel(gen.fill, 'Robot', -30, 66, 110, 84, '#5fa79a');
panel(robot, 'Antenna', 0, 54, 8, 24, LINE);
panel(robot, 'Screen', 0, 2, 64, 44, '#fbf7e8');
panel(gen.fill, 'Battery', 80, 66, 34, 66, '#f2c94c');
text(gen.fill, 'Ready', 'Готово 0 / 10', 0, -12, 280, 38, 28, INK, { bold: true });
const timer = text(gen.fill, 'ClaimTimer', 'Можно забрать', 0, -48, 280, 24, 16, MUTED);
const claim = button(gen.fill, 'Claim', 'Забрать · 60 монет', 0, -122, 270, 58, '#9bd36f', { fontSize: 22, hover: '#a8dc7e', pressed: '#86bf5c' });

const bottom = [
    ['Collection', 'Коллекция', -505, 190, '#fbf7e8'],
    ['ToCollection', 'В коллекцию', -299, 190, '#7fc8b4'],
    ['Replace', 'Заменить', -93, 190, '#fbf7e8'],
    ['Eggs', 'Яйца', 113, 190, '#f7d774'],
];
for (const [name, label, x, w, fill] of bottom) button(win, name, label, x, -206, w, 60, fill, { enabled: false });
const road = button(win, 'Road', 'В дорогу', 429.5, -206, 325, 70, '#c8e57a', { fontSize: 30, hover: '#d3ec8a', pressed: '#b2d165' });
text(win, 'Footer', 'Обычные малыши бесплатно заполняют свободные места.', -300, -272, 600, 22, 16, MUTED, { align: 0 });

const skins = keptSkins.map(s => ref(add(s)));
const windowComp = component(win, WINDOW_TYPE, {
    skins, ...keptSettings,
    title: ref(title), coins: ref(coins), batchLabel: ref(batch), claimLabel: ref(claim.label), claimTimer: ref(timer),
    cards, roadButton: ref(road.button), claimButton: ref(claim.button),
});
scene[bootstrapIndex].preLevel = ref(windowComp);

for (let i = 0; i < P; i++) if (i !== canvas && i !== bootstrapIndex) assert.deepEqual(scene[i], before[i]);
assert.equal(scene[canvas]._children[childIndex].__id__, P);
assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-prelevel-restyle');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`Restyled PreLevel: ${scene.length - P} objects, ${cards.length} cards; backup ${path.relative(root, backup)}`);
