

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
const ROW = scriptType('assets/Scripts/game/presentation/FallenRow.ts');
const CARD = scriptType('assets/Scripts/game/presentation/PreLevelCard.ts');
const PRE = scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts');
const HUD = scriptType('assets/Scripts/game/presentation/GameHud.ts');
const BOOT = scriptType('assets/Scripts/game/GameBootstrap.ts');

assert.ok(!scene.some(o => o._name === 'PostLevel'), 'PostLevel already exists; edit it in Cocos instead');
const hud = scene.find(o => o.__type__ === HUD), boot = scene.find(o => o.__type__ === BOOT), pre = scene.find(o => o.__type__ === PRE);
assert.ok(hud && boot && pre && hud.result, 'GameHud/GameBootstrap/PreLevelWindow/RoundResult not found');
const R = hud.result.__id__;
assert.equal(scene[R]._name, 'RoundResult');
const canvas = scene[R]._parent.__id__;
const childIndex = scene[canvas]._children.findIndex(r => r.__id__ === R);

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `postlevel-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, { active = true, anchorY = 0.5, attach = true } = {}) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `postlevel-n-${scene.length}` });
    if (attach) scene[parent]._children.push(ref(id));
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
const INK = '#26352f', MUTED = '#7d8782', LINE = '#2f5b55', SOFT = '#b9c4b7';
function text(parent, name, value, x, y, w, h, fontSize, tint = INK, { align = 1, bold = false, active = true } = {}) {
    const id = node(parent, name, x, y, w, h, { active });
    return component(id, 'cc.Label', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color(tint), _string: value, _horizontalAlign: align, _verticalAlign: 1, _actualFontSize: fontSize, _fontSize: fontSize, _fontFamily: 'Arial', _lineHeight: fontSize + 6, _overflow: 2, _enableWrapText: true, _font: null, _isSystemFontUsed: true, _spacingX: 0, _isBold: bold, _isItalic: false, _isUnderline: false, _cacheMode: 0 });
}
function button(parent, name, title, x, y, w, h, fill, { enabled = true, fontSize = 24, hover, pressed } = {}) {
    const box = framed(parent, name, x, y, w, h, LINE, fill, 3);
    const label = text(box.fill, name + 'Label', title, 0, 0, w - 16, h - 6, fontSize, INK, { bold: true });
    const comp = component(box.node, 'cc.Button', { clickEvents: [], _interactable: enabled, _transition: enabled ? 1 : 0, _normalColor: color(fill), _hoverColor: color(hover ?? fill), _pressedColor: color(pressed ?? fill), _disabledColor: color('#c9cfc4'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.97, _target: ref(box.fill) });
    return { node: box.node, button: comp, label };
}

function scrollList(parent, name, x, y, w, h, contentName, contentH, layout) {
    const scroll = node(parent, name, x, y, w, h);
    const view = node(scroll, 'View', 0, 0, w, h);
    component(view, 'cc.Graphics', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color('#ffffff'), _lineWidth: 1, _strokeColor: color('#000000'), _lineJoin: 2, _lineCap: 0, _fillColor: color('#ffffff'), _miterLimit: 10 });
    component(view, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
    const content = node(view, contentName, 0, h / 2, w, contentH, { anchorY: 1 });
    component(content, 'cc.Layout', { _resizeMode: 1, _paddingLeft: 6, _paddingRight: 6, _paddingTop: 6, _paddingBottom: 6, _verticalDirection: 1, _horizontalDirection: 0, _affectedByScale: false, _isAlign: false, ...layout });
    component(scroll, 'cc.ScrollView', { bounceDuration: 0.23, brake: 0.75, elastic: true, inertia: true, horizontal: false, vertical: true, cancelInnerEvents: true, scrollEvents: [], _content: ref(content), _horizontalScrollBar: null, _verticalScrollBar: null });
    return { scroll, view, content };
}
const zombieFrame = scene[pre.skins[0]?.__id__]?.frame ?? null;
const CARD_FRAME = pre.cardFrame ?? panelFrame;

const win = panel(canvas, 'PostLevel', 0, 0, 1280, 720, '#dfe3d3', { active: false, attach: false });
component(win, 'cc.BlockInputEvents');
framed(win, 'Frame', 0, 0, 1250, 690, LINE, '#eef1e2', 6);
const header = framed(win, 'Header', 0, 300, 1230, 86, LINE, '#c8e57a', 4);
const title = text(header.fill, 'Title', 'ПАРТИЯ ДОСТАВЛЕНА!', -300, 0, 600, 50, 34, INK, { align: 0, bold: true });
const earnedPill = framed(header.fill, 'EarnedPanel', 285, 0, 230, 50, LINE, '#ffffff', 3);
const earned = text(earnedPill.fill, 'EarnedLabel', 'Монеты +0', 0, 0, 210, 40, 22, INK, { bold: true });
const coinsPill = framed(header.fill, 'CoinsPanel', 505, 0, 190, 50, '#c9962e', '#f7d774', 3);
const coins = text(coinsPill.fill, 'CoinsLabel', 'Монеты 0', 0, 0, 170, 40, 22, INK, { bold: true });
const summary = text(win, 'Summary', 'Спасено 7/20 · цель 5 · ★', -330, 228, 560, 32, 22, INK, { align: 0, bold: true });

const left = framed(win, 'DeliveredPanel', -185, -10, 820, 420, LINE, '#fbf7e8', 4);
const deliveredTitle = text(left.fill, 'DeliveredTitle', 'Доставленные: 7', -250, 182, 300, 34, 24, INK, { align: 0, bold: true });
const badge = framed(left.fill, 'GrowthBadge', 250, 182, 240, 36, LINE, '#c8e57a', 3);
text(badge.fill, 'GrowthLabel', 'Рост +1', 0, 0, 220, 30, 20, INK, { bold: true });
const COLS = 6, CW = 106, CH = 125, VIEW_W = 780, VIEW_H = 272, SY = 10, N = 30;
const SX = Math.floor((VIEW_W - 12 - COLS * CW) / (COLS - 1));
const gridH = 12 + Math.ceil(N / COLS) * CH + (Math.ceil(N / COLS) - 1) * SY;
const grid = scrollList(left.fill, 'DeliveredScroll', 0, 22, VIEW_W, VIEW_H, 'Delivered', gridH,
    { _layoutType: 3, _cellSize: size(CW, CH), _startAxis: 0, _spacingX: SX, _spacingY: SY, _constraint: 2, _constraintNum: COLS });
const deliveredEmpty = text(left.fill, 'DeliveredEmpty', 'Никто не дошёл до финиша', 0, 22, 600, 34, 22, MUTED, { active: false });
const cards = [];
for (let i = 0; i < N; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const card = node(grid.content, `Card${i + 1}`, -VIEW_W / 2 + 6 + CW / 2 + col * (CW + SX), -(6 + CH / 2 + row * (CH + SY)), CW, CH, { active: i < 7 });
    const body = node(card, 'Body', 0, 0, CW, CH);
    const bodySprite = sprite(body, '#ffffff', CARD_FRAME, false);
    const picture = node(card, 'Picture', 0, 14, 58, 58);
    const pictureSprite = sprite(picture, '#ffffff', zombieFrame, false);
    const name = text(card, 'Name', 'Обычный', 0, -30, CW - 8, 22, 17, INK, { bold: true });
    const caption = text(card, 'Caption', 'Подросток', 0, -48, CW - 8, 18, 14, MUTED);
    const sel = panel(card, 'SelectedBadge', 0, CH / 2 - 12, 84, 22, '#3f8f80', { active: false });
    text(sel, 'BadgeLabel', 'Выбран', 0, 0, 80, 20, 15, '#ffffff', { bold: true });
    const btn = component(card, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 3, _normalColor: color('#ffffff'), _hoverColor: color('#ffffff'), _pressedColor: color('#ffffff'), _disabledColor: color('#ffffff'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.96, _target: ref(body) });
    cards.push(ref(component(card, CARD, { body: ref(bodySprite), picture: ref(pictureSprite), pictureTransform: ref(scene[picture]._components[0].__id__), title: ref(name), caption: ref(caption), selectedBadge: ref(sel), button: ref(btn) })));
}

const strip = framed(left.fill, 'SelectedPanel', 0, -161, 780, 78, SOFT, '#e6edd5', 3);
const selPic = node(strip.fill, 'SelectedPicture', -340, 0, 56, 56, { active: false });
const selPicSprite = sprite(selPic, '#ffffff', zombieFrame, false);
const selLabel = text(strip.fill, 'SelectedLabel', 'Выбери доставленного зомби', -40, 17, 480, 28, 20, INK, { align: 0, bold: true });
button(strip.fill, 'Sell', 'Продать', -95, -15, 210, 36, '#f7d774', { enabled: false, fontSize: 18 });
button(strip.fill, 'ToCollection', 'В коллекцию', 135, -15, 210, 36, '#7fc8b4', { enabled: false, fontSize: 18 });

const right = framed(win, 'FallenPanel', 425, -10, 370, 420, LINE, '#fbf7e8', 4);
const fallenTitle = text(right.fill, 'FallenTitle', 'Сбитые: 3', -60, 182, 220, 34, 24, INK, { align: 0, bold: true });
const RW = 330, RH = 100, RS = 12;
const list = scrollList(right.fill, 'FallenScroll', 0, -20, 340, 370, 'Fallen', 12 + N * RH + (N - 1) * RS,
    { _layoutType: 2, _spacingY: RS });
const fallenEmpty = text(right.fill, 'FallenEmpty', 'Никого не сбили', 0, -20, 300, 34, 22, MUTED, { active: false });
const rows = [];
for (let i = 0; i < N; i++) {
    const row = node(list.content, `Row${i + 1}`, 0, -(6 + RH / 2 + i * (RH + RS)), RW, RH, { active: i < 3 });
    const face = framed(row, 'Body', 0, 0, RW, RH, SOFT, '#f3e3d3', 3);
    const pic = node(face.fill, 'Picture', -118, 0, 56, 56);
    const picSprite = sprite(pic, '#ffffff', zombieFrame, false);
    const name = text(face.fill, 'Name', 'Обычный', 35, 24, 220, 28, 20, INK, { align: 0, bold: true });
    const revive = button(face.fill, 'Revive', 'Воскресить · 10', 35, -18, 220, 42, '#7fc8b4', { fontSize: 18, hover: '#8fd4c1', pressed: '#6ab3a0' });
    rows.push(ref(component(row, ROW, { picture: ref(picSprite), pictureTransform: ref(scene[pic]._components[0].__id__), title: ref(name), reviveLabel: ref(revive.label), reviveButton: ref(revive.button) })));
}
text(win, 'Hint', 'Доставленные сохраняются. Они получили рост.', -300, -248, 600, 26, 18, MUTED, { align: 0 });
text(win, 'Footer', 'Сбитых можно воскресить за монеты: они вернутся в партию на следующий уровень.', -300, -280, 600, 22, 15, MUTED, { align: 0 });
const next = button(win, 'Next', 'Дальше', 425, -265, 370, 66, '#c8e57a', { fontSize: 30, hover: '#d3ec8a', pressed: '#b2d165' });

const windowComp = component(win, POST, {
    title: ref(title), earned: ref(earned), coins: ref(coins), summary: ref(summary),
    deliveredTitle: ref(deliveredTitle), fallenTitle: ref(fallenTitle), growthBadge: ref(badge.node),
    deliveredEmpty: ref(scene[deliveredEmpty].node.__id__), fallenEmpty: ref(scene[fallenEmpty].node.__id__),
    cards, rows, selectedPicture: ref(selPicSprite), selectedPictureTransform: ref(scene[selPic]._components[0].__id__),
    selectedLabel: ref(selLabel), nextButton: ref(next.button), pictureMaxWidth: 84, pictureMaxHeight: 58, rowPictureMax: 56,
});
scene[canvas]._children[childIndex] = ref(win);
boot.postLevel = ref(windowComp);

pre.growthCaptions = ['Малыш', 'Подросток', 'Взрослый'];
for (const r of pre.skins) {
    const skin = scene[r.__id__];
    delete skin.caption;
    if (skin.reviveCost === undefined) skin.reviveCost = /легенд/i.test(skin.name) ? 100 : /редк/i.test(skin.name) ? 40 : 10;
}

for (const key of ['result', 'resultText', 'advanceLabel', 'advanceButton', 'resultLevelsButton']) delete hud[key];
const drop = new Set();
(function dropTree(id) {
    drop.add(id);
    for (const c of scene[id]._components) drop.add(c.__id__);
    for (const c of scene[id]._children) dropTree(c.__id__);
})(R);
const map = new Map(); let nextId = 0;
scene.forEach((_, i) => { if (!drop.has(i)) map.set(i, nextId++); });
function remap(value) {
    if (!value || typeof value !== 'object') return;
    if ('__id__' in value) { assert.ok(map.has(value.__id__), `Kept object references removed ${value.__id__}`); value.__id__ = map.get(value.__id__); return; }
    for (const v of Object.values(value)) remap(v);
}
const kept = scene.filter((_, i) => !drop.has(i));
for (const o of kept) for (const v of Object.values(o)) remap(v);

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-postlevel');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');
console.log(`PostLevel authored: ${cards.length} cards, ${rows.length} rows; removed RoundResult (${drop.size} objects); backup ${path.relative(root, backup)}`);
