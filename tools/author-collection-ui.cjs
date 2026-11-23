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
const COLLECTION = scriptType('assets/Scripts/game/presentation/CollectionWindow.ts');
const CARD = scriptType('assets/Scripts/game/presentation/PreLevelCard.ts');
const PRE = scriptType('assets/Scripts/game/presentation/PreLevelWindow.ts');
const POST = scriptType('assets/Scripts/game/presentation/PostLevelWindow.ts');
const BOOT = scriptType('assets/Scripts/game/GameBootstrap.ts');

assert.ok(!scene.some(o => o._name === 'CollectionPanel'), 'CollectionPanel already exists; edit it in Cocos instead');
const pre = scene.find(o => o.__type__ === PRE), post = scene.find(o => o.__type__ === POST), boot = scene.find(o => o.__type__ === BOOT);
assert.ok(pre && post && boot, 'PreLevelWindow/PostLevelWindow/GameBootstrap not found');
const preNode = pre.node.__id__, postNode = post.node.__id__;
const canvas = scene[preNode]._parent.__id__;
assert.equal(scene[canvas]._name, 'GameUI');

const add = object => { scene.push(object); return scene.length - 1; };
function component(node, type, fields = {}) {
    const id = add({ __type__: type, _name: '', _objFlags: 0, __editorExtras__: {}, node: ref(node), _enabled: true, __prefab: null, ...fields, _id: `collection-c-${scene.length}` });
    scene[node]._components.push(ref(id)); return id;
}
function node(parent, name, x, y, width, height, { active = true, anchorY = 0.5, attach = true } = {}) {
    const id = add({ __type__: 'cc.Node', _name: name, _objFlags: 0, __editorExtras__: {}, _parent: ref(parent), _children: [], _active: active, _components: [], _prefab: null, _lpos: vec(x, y), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: 0, w: 1 }, _lscale: vec(1, 1, 1), _mobility: 0, _layer: 33554432, _euler: vec(), _id: `collection-n-${scene.length}` });
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
const INK = '#26352f', MUTED = '#7d8782', LINE = '#2f5b55';
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

const zombieFrame = scene[pre.skins[0]?.__id__]?.frame ?? null;
const CARD_FRAME = pre.cardFrame ?? panelFrame;

const win = panel(canvas, 'CollectionPanel', 0, 0, 1280, 720, '#dfe3d3', { active: false, attach: false });
component(win, 'cc.BlockInputEvents');
const preWidget = scene[preNode]._components.map(r => scene[r.__id__]).find(c => c.__type__ === 'cc.Widget');
if (preWidget) { const { _id, node: _n, ...fields } = preWidget; component(win, 'cc.Widget', { ...fields }); }
framed(win, 'Frame', 0, 15, 1250, 650, LINE, '#eef1e2', 6);
text(win, 'Title', 'КОЛЛЕКЦИЯ', -320, 300, 580, 44, 30, INK, { align: 0, bold: true });
const coinsPill = framed(win, 'CoinsPanel', 500, 300, 210, 54, '#c9962e', '#f7d774', 3);
const coins = text(coinsPill.fill, 'CoinsLabel', 'Монеты 0', 0, 0, 190, 44, 24, INK, { bold: true });
const back = button(win, 'Back', 'Назад', -515, 244, 150, 46, '#ffffff', { fontSize: 20, hover: '#f3f3ee', pressed: '#e3e6dc' });
text(win, 'Hint', 'Здесь слизни в безопасности', -230, 244, 420, 30, 20, MUTED, { align: 0 });

const COLS = 5, CW = 136, CH = 160, VIEW_W = 824, VIEW_H = 400, SY = 14, N = 40;
const SX = Math.floor((VIEW_W - 12 - COLS * CW) / (COLS - 1));
const rowsCount = Math.ceil(N / COLS);
const gridH = 12 + rowsCount * CH + (rowsCount - 1) * SY;
const scroll = node(win, 'CollectionScroll', -188, 0, VIEW_W, VIEW_H);
const view = node(scroll, 'View', 0, 0, VIEW_W, VIEW_H);
component(view, 'cc.Graphics', { _customMaterial: null, _srcBlendFactor: 2, _dstBlendFactor: 4, _color: color('#ffffff'), _lineWidth: 1, _strokeColor: color('#000000'), _lineJoin: 2, _lineCap: 0, _fillColor: color('#ffffff'), _miterLimit: 10 });
component(view, 'cc.Mask', { _type: 0, _inverted: false, _segments: 64, _alphaThreshold: 0.1 });
const content = node(view, 'Members', 0, VIEW_H / 2, VIEW_W, gridH, { anchorY: 1 });
component(content, 'cc.Layout', { _resizeMode: 1, _layoutType: 3, _cellSize: size(CW, CH), _startAxis: 0, _paddingLeft: 6, _paddingRight: 6, _paddingTop: 6, _paddingBottom: 6, _spacingX: SX, _spacingY: SY, _verticalDirection: 1, _horizontalDirection: 0, _constraint: 2, _constraintNum: COLS, _affectedByScale: false, _isAlign: false });
component(scroll, 'cc.ScrollView', { bounceDuration: 0.23, brake: 0.75, elastic: true, inertia: true, horizontal: false, vertical: true, cancelInnerEvents: true, scrollEvents: [], _content: ref(content), _horizontalScrollBar: null, _verticalScrollBar: null });
const empty = text(win, 'Empty', 'Коллекция пуста. Отправляй сюда слизней кнопкой «В коллекцию».', -188, 0, 700, 60, 22, MUTED, { active: false });
const cards = [];
for (let i = 0; i < N; i++) {
    const col = i % COLS, row = Math.floor(i / COLS);
    const card = node(content, `Card${i + 1}`, -VIEW_W / 2 + 6 + CW / 2 + col * (CW + SX), -(6 + CH / 2 + row * (CH + SY)), CW, CH, { active: i < 8 });
    const body = node(card, 'Body', 0, 0, CW, CH);
    const bodySprite = sprite(body, '#ffffff', CARD_FRAME, false);
    const picture = node(card, 'Picture', 0, 10, 109, 76);
    const pictureSprite = sprite(picture, '#ffffff', zombieFrame, false);
    const name = text(card, 'Name', 'Обычный', 0, -40, 140, 26, 20, INK, { bold: true });
    const caption = text(card, 'Caption', 'Рост 2/8', 0, -62, 140, 20, 16, MUTED);
    const sel = panel(card, 'SelectedBadge', 0, 64, 100, 26, '#3f8f80', { active: false });
    text(sel, 'BadgeLabel', 'Выбран', 0, 0, 92, 24, 17, '#ffffff', { bold: true });
    const btn = component(card, 'cc.Button', { clickEvents: [], _interactable: true, _transition: 3, _normalColor: color('#ffffff'), _hoverColor: color('#ffffff'), _pressedColor: color('#ffffff'), _disabledColor: color('#ffffff'), _normalSprite: null, _hoverSprite: null, _pressedSprite: null, _disabledSprite: null, _duration: 0.1, _zoomScale: 0.96, _target: ref(body) });
    cards.push(ref(component(card, CARD, { body: ref(bodySprite), picture: ref(pictureSprite), pictureTransform: ref(scene[picture]._components[0].__id__), title: ref(name), caption: ref(caption), selectedBadge: ref(sel), button: ref(btn) })));
}

const right = framed(win, 'DetailsPanel', 429.5, 0, 325, 400, LINE, '#fffbe9', 4);
const partyLabel = text(right.fill, 'PartyLabel', 'В партии 20 / 20', 0, 170, 290, 28, 18, MUTED);
const details = node(right.fill, 'Details', 0, -10, 300, 350, { active: false });
const pic = node(details, 'Picture', 0, 80, 150, 104);
const picSprite = sprite(pic, '#ffffff', zombieFrame, false);
const detailName = text(details, 'Name', 'Редкий слизень', 0, -10, 290, 34, 24, INK, { bold: true });
const detailCaption = text(details, 'Caption', 'Подросток · рост 2/8', 0, -46, 290, 26, 18, MUTED);
const toParty = button(details, 'ToParty', 'В партию', 0, -120, 280, 64, '#c8e57a', { fontSize: 26, hover: '#d3ec8a', pressed: '#b2d165' });
const detailsEmpty = text(right.fill, 'DetailsEmpty', 'Выбери слизня слева', 0, 0, 290, 60, 22, MUTED);
const footer = text(win, 'Footer', 'Если партия полная, этот слизень заменит выбранного на подготовке.', -300, -272, 600, 22, 16, MUTED, { align: 0 });

const windowComp = component(win, COLLECTION, {
    coins: ref(coins), partyLabel: ref(partyLabel), backButton: ref(back.button), cards,
    empty: ref(labelNode(empty)), details: ref(details), detailsEmpty: ref(labelNode(detailsEmpty)),
    picture: ref(picSprite), pictureTransform: ref(scene[pic]._components[0].__id__),
    nameLabel: ref(detailName), caption: ref(detailCaption), toPartyButton: ref(toParty.button), toPartyLabel: ref(toParty.label),
    footer: ref(footer), pictureMaxWidth: 110, pictureMaxHeight: 76, detailPictureMax: 150,
    nameSuffix: 'слизень', addText: 'В партию', replaceText: 'Заменить выбранного',
    footerText: 'Если партия полная, этот слизень заменит выбранного на подготовке.',
    fullFooterText: 'Партия полная: сначала выбери слизня на подготовке, его заменит этот.',
});
const preIndex = scene[canvas]._children.findIndex(r => r.__id__ === preNode);
scene[canvas]._children.splice(preIndex + 1, 0, ref(win));
boot.collection = ref(windowComp);

function enable(buttonId, { hover, pressed } = {}) {
    const b = scene[buttonId];
    b._interactable = true; b._transition = 1;
    const target = scene[b._target.__id__]._components.map(r => scene[r.__id__]).find(c => c.__type__ === 'cc.Sprite');
    if (target) { b._normalColor = { ...target._color }; b._hoverColor = hover ? color(hover) : { ...target._color }; b._pressedColor = pressed ? color(pressed) : { ...target._color }; }
    b._disabledColor = color('#c9cfc4');
    return buttonId;
}
const preCollection = childNamed(preNode, 'Collection'), preToCollection = childNamed(preNode, 'ToCollection');
assert.ok(preCollection !== undefined && preToCollection !== undefined, 'PreLevel Collection/ToCollection not found');
pre.collectionButton = ref(enable(buttonOf(preCollection), { hover: '#f3efdc', pressed: '#e6e1cb' }));
pre.toCollectionButton = ref(enable(buttonOf(preToCollection), { hover: '#8fd4c1', pressed: '#6ab3a0' }));
pre.maxGrowth = 8;
const preFooter = childNamed(preNode, 'Footer'), preHint = childNamed(preNode, 'Hint');
if (preFooter !== undefined) scene[labelOf(preFooter)]._string = 'Свободные места заполняй слизнями из коллекции.';
if (preHint !== undefined) scene[labelOf(preHint)]._string = 'Выбери слизня и нажми «В коллекцию», чтобы убрать его из партии.';

const postSelected = scene.findIndex(o => o.__type__ === 'cc.Node' && o._name === 'SelectedPanel');
const postToCollection = childNamed(scene[postSelected]._children[0].__id__, 'ToCollection');
assert.ok(postToCollection !== undefined, 'PostLevel ToCollection not found');
post.toCollectionButton = ref(enable(buttonOf(postToCollection), { hover: '#8fd4c1', pressed: '#6ab3a0' }));
const postFooter = childNamed(postNode, 'Footer'), postHint = childNamed(postNode, 'Hint');
if (postFooter !== undefined) post.footer = ref(labelOf(postFooter));
post.wonFooter = 'Не воскрешённые сбитые не пойдут на следующий уровень.';
post.lostFooter = 'Нажми «Повторить»: сбитые вернутся в партию бесплатно.';
if (postHint !== undefined) scene[labelOf(postHint)]._string = 'Выбери слизня и нажми «В коллекцию», чтобы сохранить его.';

assert.equal(fs.readFileSync(file, 'utf8'), original, 'Scene changed concurrently; aborting');
const backup = path.join(root, '.sharrowkin/ZombieRoad.scene.before-collection');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, original);
fs.writeFileSync(file, JSON.stringify(scene, null, 2) + '\n');
console.log(`CollectionPanel authored: ${cards.length} cards; PreLevel/PostLevel buttons wired; backup ${path.relative(root, backup)}`);
